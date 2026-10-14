// O celular na mesa (pedido da Millie, 13/10). Jogador: o celular do personagem dele, flutuando
// sobre o mapa; ligação recebida abre sozinha e mensagem nova toca e avisa. Mestre: a central com
// todos os celulares e NPCs da mesa, os efeitos (sem sinal, interferência, brilho, bateria) e, ao
// abrir um celular, responde pelos NPCs da conversa.
import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCircleUser, faMobileScreen, faPlus, faUserSecret, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { ConfigTempo } from '../Mesa/tempo'
import Celular from './Celular'
import { useCelularDoBanco, type EstadoDoCelular } from './estado'
import * as db from './dados'
import type { Celular as Cel, Ligacao, Mensagem, NpcDoCelular } from './dados'
import { IconeDoApp } from './IconeDoApp'
import { tocarNotificacao } from './sons'
import { escolherImagem } from './arquivos'
import { useTamanhoDoCelular } from './tamanho'
import { entregarAgendadas } from './dadosDosApps'

const ELEMENTOS = [['', 'Nenhum'], ['conhecimento', 'Conhecimento (dourado)'], ['sangue', 'Sangue'], ['morte', 'Morte'], ['energia', 'Energia'], ['medo', 'Medo']] as const

type Aviso = { id: string; titulo: string; texto: string }

// Janela que dá pra arrastar pela borda de cima, com o celular dentro.
// O celular inteiro arrasta pra qualquer lugar da tela (pedido da Millie, 14/10): pela moldura, pela
// barrinha de cima ou pelo fundo da central. Botões, campos e a tela do celular continuam
// funcionando (lá dentro o arrasto é o do próprio celular: deslizar, rolar). O lugar fica guardado.
const CHAVE_POSICAO = 'arkanis-celular-posicao'
const NAO_ARRASTA = 'button, input, select, textarea, label, a, audio, video, .cel-tela'

function posicaoGuardada(): { x: number; y: number } {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE_POSICAO) ?? '')
    // Janela do navegador menor que da última vez: traz de volta pra dentro.
    if (typeof p?.x === 'number' && typeof p?.y === 'number') return { x: Math.max(0, Math.min(window.innerWidth - 60, p.x)), y: Math.max(0, Math.min(window.innerHeight - 60, p.y)) }
  } catch { /* primeira vez */ }
  return { x: Math.max(12, window.innerWidth - 420), y: Math.max(12, window.innerHeight - 720) }
}

function Flutuante({ onFechar, children, titulo }: { onFechar: () => void; children: React.ReactNode; titulo?: string }) {
  const tamanho = useTamanhoDoCelular()
  const [pos, setPos] = useState(posicaoGuardada)
  const arrasto = useRef<{ dx: number; dy: number } | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  // Sempre sobra um pedaço visível pra pegar de volta.
  const prender = (x: number, y: number) => {
    const r = caixa.current?.getBoundingClientRect()
    const w = r?.width ?? 200
    const h = r?.height ?? 200
    return { x: Math.min(window.innerWidth - 40, Math.max(40 - w, x)), y: Math.min(window.innerHeight - 30, Math.max(-h + 30, y)) }
  }
  return (
    <div
      ref={caixa}
      className={`cel-flutuante${arrasto.current ? ' arrastando' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest(NAO_ARRASTA)) return
        arrasto.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => { if (arrasto.current) setPos(prender(e.clientX - arrasto.current.dx, e.clientY - arrasto.current.dy)) }}
      onPointerUp={() => {
        if (!arrasto.current) return
        arrasto.current = null
        try { localStorage.setItem(CHAVE_POSICAO, JSON.stringify(pos)) } catch { /* sem armazenamento */ }
      }}
    >
      <div className="cel-flutuante-conteudo" style={{ zoom: tamanho / 100 }}>
        <div className="cel-flutuante-alca">
          <span>{titulo}</span>
          <button type="button" className="cel-flutuante-fechar" onClick={onFechar} aria-label="Guardar o celular"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Avisos({ avisos, modelo, onAbrir, onTirar }: { avisos: Aviso[]; modelo: Cel['modelo']; onAbrir: () => void; onTirar: (id: string) => void }) {
  return (
    <div className="cel-avisos" aria-live="polite">
      {avisos.map((a) => (
        <button key={a.id} type="button" className="cel-aviso" onClick={() => { onTirar(a.id); onAbrir() }}>
          <IconeDoApp id="mensagens" modelo={modelo} tamanho={30} />
          <span><strong>{a.titulo}</strong><small>{a.texto}</small></span>
        </button>
      ))}
    </div>
  )
}

function textoDaMensagem(m: Mensagem): string {
  if (m.efeito?.corrompida) return '▓▒░ ▓▒░'
  if (m.tipo === 'texto') return m.texto ?? ''
  return { foto: '📷 Foto', video: '🎥 Vídeo', audio: '🎤 Áudio', arquivo: '📎 Arquivo', sistema: m.texto ?? '' }[m.tipo] ?? ''
}

// ---- Jogador ----

function CelularDoJogador({ campanhaId, characterId, tempo, aberto, setAberto }: { campanhaId: string; characterId: string; tempo: Partial<ConfigTempo> | null; aberto: boolean; setAberto: (v: boolean) => void }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const atual = useRef<EstadoDoCelular | null>(null)
  const abertoRef = useRef(aberto)
  abertoRef.current = aberto

  const { estado, erro } = useCelularDoBanco({
    campanhaId, characterId, souMestre: false, tempo,
    aoChegar: (tipo, linha) => {
      const e = atual.current
      if (!e || !('celular' in e.eu)) return
      const meu = e.eu.celular
      if (tipo === 'ligacao') {
        const l = linha as unknown as Ligacao
        if (l.para_celular_id === meu && l.estado === 'chamando') setAberto(true)
        return
      }
      const m = linha as unknown as Mensagem
      if (m.estado !== 'enviada' || m.apagada || m.de_celular_id === meu) return
      const minha = e.participantes.some((p) => p.conversa_id === m.conversa_id && p.celular_id === meu && !p.saiu_em && !p.silenciada)
      if (!minha) return
      // Só avisa mensagem nova (não as que voltaram por edição).
      if (Date.now() - Date.parse(m.created_at) > 15000) return
      tocarNotificacao(e.celular.toque_mensagem)
      if (abertoRef.current) return
      const conversa = e.conversas.find((c) => c.id === m.conversa_id)
      const autor = m.de_celular_id ? e.celulares.find((c) => c.id === m.de_celular_id)?.nome_no_perfil : e.npcs.find((n) => n.id === m.de_npc_id)?.nome
      const contato = e.contatos.find((k) => (m.de_celular_id ? k.contato_celular_id === m.de_celular_id : k.npc_id === m.de_npc_id))
      const nome = contato?.desconhecido ? 'Número desconhecido' : contato?.apelido || autor || 'Mensagem'
      const aviso = { id: m.id, titulo: conversa?.tipo === 'grupo' ? `${conversa.nome} · ${nome}` : nome, texto: textoDaMensagem(m) }
      setAvisos((l) => [...l.filter((x) => x.id !== m.id), aviso].slice(-3))
      window.setTimeout(() => setAvisos((l) => l.filter((x) => x.id !== m.id)), 6000)
    },
  })
  atual.current = estado

  return (
    <>
      {!aberto && estado && <Avisos avisos={avisos} modelo={estado.celular.modelo} onAbrir={() => setAberto(true)} onTirar={(id) => setAvisos((l) => l.filter((x) => x.id !== id))} />}
      {aberto && (
        <Flutuante onFechar={() => setAberto(false)}>
          {estado ? <Celular estado={estado} /> : <div className="cel-carregando">{erro ?? 'Ligando o celular…'}</div>}
        </Flutuante>
      )}
    </>
  )
}

// ---- Mestre ----

type Escolha = { characterId: string } | { npcId: string }

function CelularEscolhido({ campanhaId, escolha, tempo }: { campanhaId: string; escolha: Escolha; tempo: Partial<ConfigTempo> | null }) {
  const { estado, erro } = useCelularDoBanco({ campanhaId, souMestre: true, tempo, ...('characterId' in escolha ? { characterId: escolha.characterId } : { npcId: escolha.npcId }) })
  return estado ? <Celular estado={estado} /> : <div className="cel-carregando">{erro ?? 'Abrindo…'}</div>
}

function CentralDoMestre({ campanhaId, tempo, fichas, aberto, setAberto }: {
  campanhaId: string
  tempo: Partial<ConfigTempo> | null
  /** Personagens da mesa (pra abrir o celular de quem ainda não abriu o seu). */
  fichas: { id: string; nome: string; foto: string | null }[]
  aberto: boolean
  setAberto: (v: boolean) => void
}) {
  const [celulares, setCelulares] = useState<Cel[]>([])
  const [npcs, setNpcs] = useState<NpcDoCelular[]>([])
  const [escolha, setEscolha] = useState<Escolha | null>(null)
  const [novoNpc, setNovoNpc] = useState<{ nome: string; numero: string; foto: string | null } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function recarregar() {
    setCelulares(await db.celularesDaMesa(campanhaId))
    setNpcs(await db.npcsVisiveis(campanhaId))
  }
  useEffect(() => {
    void recarregar()
    // Ligação pra um NPC: abre o celular dele pra o mestre atender.
    return db.ouvirCelulares(campanhaId, (tabela, linha) => {
      if (tabela === 'celulares' || tabela === 'celular_npcs') void recarregar()
      if (tabela === 'celular_ligacoes') {
        const l = linha as unknown as Ligacao
        if (l.estado === 'chamando' && l.para_npc_id) { setEscolha({ npcId: l.para_npc_id }); setAberto(true) }
      }
    })
  }, [campanhaId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mensagem agendada: confere a cada 10 s se o relógio do jogo já chegou na hora (com a mesa aberta).
  useEffect(() => {
    const t = window.setInterval(() => { void entregarAgendadas(campanhaId) }, 10000)
    void entregarAgendadas(campanhaId)
    return () => window.clearInterval(t)
  }, [campanhaId])

  async function efeito(celularesAlvo: string[] | undefined, efeitos: Parameters<typeof db.efeitoNoCelular>[1], bateria?: number) {
    setErro(await db.efeitoNoCelular(campanhaId, efeitos, { celulares: celularesAlvo, bateria }))
    void recarregar()
  }

  async function criarNpc() {
    if (!novoNpc?.nome.trim()) return
    const r = await db.criarNpc({ campanhaId, nome: novoNpc.nome, numero: novoNpc.numero || null, foto: novoNpc.foto })
    if (r.erro) setErro(r.erro)
    setNovoNpc(null)
    void recarregar()
  }

  if (!aberto) return null
  const doCelular = (characterId: string) => celulares.find((c) => c.character_id === characterId)

  return (
    <Flutuante onFechar={() => setAberto(false)} titulo={escolha ? undefined : 'Central dos celulares'}>
      {escolha ? (
        <div className="cel-central-aberto">
          <button type="button" className="cel-central-voltar" onClick={() => setEscolha(null)}><FontAwesomeIcon icon={faArrowLeft} /> Central</button>
          <CelularEscolhido campanhaId={campanhaId} escolha={escolha} tempo={tempo} />
        </div>
      ) : (
        <div className="cel-central">
          <section>
            <h3>Celulares da mesa</h3>
            <div className="cel-central-todos">
              <span>Todos:</span>
              <button type="button" onClick={() => efeito(undefined, { sem_sinal: true })}>Sem sinal</button>
              <button type="button" onClick={() => efeito(undefined, { sem_sinal: null, interferencia: null, brilho: null, desligado: null })}>Normal</button>
            </div>
            {fichas.map((f) => {
              const c = doCelular(f.id)
              return (
                <div key={f.id} className="cel-central-linha">
                  <button type="button" className="cel-central-quem" onClick={() => setEscolha({ characterId: f.id })}>
                    {c?.foto_perfil || f.foto ? <img src={c?.foto_perfil || f.foto!} alt="" /> : <FontAwesomeIcon icon={faCircleUser} />}
                    <span><strong>{c?.nome_no_perfil || f.nome}</strong><small>{c ? `${c.modelo === 'iphone' ? 'iPhone' : 'Samsung'} · ${c.bateria}%` : 'ainda sem celular'}</small></span>
                    <FontAwesomeIcon icon={faMobileScreen} />
                  </button>
                  {c && (
                    <div className="cel-central-efeitos">
                      <label><input type="checkbox" checked={!!c.efeitos.sem_sinal} onChange={(ev) => efeito([c.id], { sem_sinal: ev.target.checked || null })} /> Sem sinal</label>
                      <label><input type="checkbox" checked={!!c.efeitos.interferencia} onChange={(ev) => efeito([c.id], { interferencia: ev.target.checked || null })} /> Interferência</label>
                      <label><input type="checkbox" checked={!!c.efeitos.desligado} onChange={(ev) => efeito([c.id], { desligado: ev.target.checked || null })} /> Desligado</label>
                      <select value={c.efeitos.brilho ?? ''} onChange={(ev) => efeito([c.id], { brilho: ev.target.value || null })} aria-label="Brilho de ritual">
                        {ELEMENTOS.map(([v, n]) => <option key={v} value={v}>{v ? `Brilho: ${n}` : 'Sem brilho'}</option>)}
                      </select>
                      <label className="cel-central-bateria">🔋 <input key={c.bateria} type="range" min={0} max={100} step={5} defaultValue={c.bateria} onMouseUp={(ev) => efeito([c.id], {}, Number((ev.target as HTMLInputElement).value))} onKeyUp={(ev) => efeito([c.id], {}, Number((ev.target as HTMLInputElement).value))} /></label>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
          <section>
            <h3>NPCs <button type="button" className="cel-central-mais" onClick={() => setNovoNpc({ nome: '', numero: '', foto: null })} aria-label="Novo NPC"><FontAwesomeIcon icon={faPlus} /></button></h3>
            {novoNpc && (
              <div className="cel-central-novo">
                <button type="button" className="cel-central-foto" onClick={async () => {
                  const f = await escolherImagem('quadrado', 'Foto do NPC')
                  if (!f) return
                  const r = await db.enviarArquivo(f, f.name)
                  if (r.url) setNovoNpc((n) => (n ? { ...n, foto: r.url } : n))
                }}>{novoNpc.foto ? <img src={novoNpc.foto} alt="" /> : <FontAwesomeIcon icon={faCircleUser} />}</button>
                <input placeholder="Nome (Veríssimo)" value={novoNpc.nome} onChange={(ev) => setNovoNpc({ ...novoNpc, nome: ev.target.value })} />
                <input placeholder="Número" value={novoNpc.numero} onChange={(ev) => setNovoNpc({ ...novoNpc, numero: ev.target.value })} />
                <button type="button" onClick={criarNpc}>Criar</button>
              </div>
            )}
            {npcs.map((n) => (
              <button key={n.id} type="button" className="cel-central-quem" onClick={() => setEscolha({ npcId: n.id })}>
                {n.foto ? <img src={n.foto} alt="" /> : <FontAwesomeIcon icon={faUserSecret} />}
                <span><strong>{n.nome}</strong><small>{n.numero ?? 'sem número'}</small></span>
                <FontAwesomeIcon icon={faMobileScreen} />
              </button>
            ))}
            {npcs.length === 0 && !novoNpc && <p className="cel-central-dica">Crie um NPC (o Veríssimo, o pai da Nina…) pra mandar mensagem e ligar como ele.</p>}
          </section>
          {erro && <p className="cel-erro" onClick={() => setErro(null)}>{erro}</p>}
        </div>
      )}
    </Flutuante>
  )
}

export default function CelularNaMesa(p: {
  campanhaId: string
  souMestre: boolean
  tempo: Partial<ConfigTempo> | null
  meuPersonagemId: string | null
  fichas: { id: string; nome: string; foto: string | null }[]
  aberto: boolean
  setAberto: (v: boolean) => void
}) {
  if (p.souMestre) return <CentralDoMestre campanhaId={p.campanhaId} tempo={p.tempo} fichas={p.fichas} aberto={p.aberto} setAberto={p.setAberto} />
  if (!p.meuPersonagemId) {
    return p.aberto ? (
      <Flutuante onFechar={() => p.setAberto(false)}><div className="cel-carregando">Escolha um personagem nesta mesa pra ter celular.</div></Flutuante>
    ) : null
  }
  return <CelularDoJogador campanhaId={p.campanhaId} characterId={p.meuPersonagemId} tempo={p.tempo} aberto={p.aberto} setAberto={p.setAberto} />
}
