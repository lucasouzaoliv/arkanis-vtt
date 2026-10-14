// Mensagens (estilo WhatsApp, referências da Millie de 14/10): lista de conversas, conversa com
// balões, grupos, contatos da mesa e NPCs. O app da Ordem usa as mesmas telas com o visual verde.
import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft, faCamera, faCheck, faCheckDouble, faCircleUser, faClock, faFaceSmile, faMagnifyingGlass, faMicrophone, faPaperPlane,
  faPaperclip, faPenToSquare, faPhone, faStop, faTrash, faUserPlus, faUsers, faImage, faGhost,
} from '@fortawesome/free-solid-svg-icons'
import { horaDaMensagem, naoLidas, type Conversa, type Lado, type Mensagem } from '../dados'
import { ehEu, membrosDaConversa, minhasConversas, pessoa, tituloDaConversa, useCelular, type Pessoa } from '../estado'
import { texto } from '../textos'
import { escolherArquivo, escolherImagem, tipoDoArquivo } from '../arquivos'
import { momento, tempoAtivo, tempoCompleto } from '../../Mesa/tempo'
import { Brasao } from '../Brasao'

type App = Conversa['app']
type Tela =
  | { tipo: 'lista' }
  | { tipo: 'conversa'; id: string }
  | { tipo: 'nova' }
  | { tipo: 'grupo' }
  | { tipo: 'contato' }
  | { tipo: 'info'; id: string }

// Cor do nome de cada pessoa no grupo (como no WhatsApp).
const CORES = ['#e542a3', '#1f7aec', '#d9822b', '#7f66ff', '#02a698', '#c5463e', '#53bdeb', '#a5b337']
function corDe(chave: string): string {
  let h = 0
  for (const c of chave) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return CORES[h % CORES.length]
}

export function Avatar({ foto, tamanho = 44, grupo }: { foto: string | null; tamanho?: number; grupo?: boolean }) {
  return (
    <span className="cel-avatar" style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.9 }}>
      {foto ? <img src={foto} alt="" /> : <FontAwesomeIcon icon={grupo ? faUsers : faCircleUser} />}
    </span>
  )
}

function dataDaMensagem(tempo: ReturnType<typeof useCelular>['tempo'], m: Mensagem): string {
  if (m.minuto_no_jogo != null && tempo && tempoAtivo(tempo)) {
    const t = tempoCompleto(tempo)
    const d = momento({ ...t, minutos: m.minuto_no_jogo })
    return t.calendario ? `${d.data.dia}/${String(d.data.mes).padStart(2, '0')}/${d.data.ano}` : `Dia ${d.dia + 1}`
  }
  return new Date(m.created_at).toLocaleDateString('pt-BR')
}

function previa(m: Mensagem | undefined, idioma: string): string {
  if (!m) return ''
  if (m.apagada) return texto(idioma, 'apagada')
  if (m.tipo === 'foto') return '📷 Foto'
  if (m.tipo === 'video') return '🎥 Vídeo'
  if (m.tipo === 'audio') return '🎤 Áudio'
  if (m.tipo === 'arquivo') return `📎 ${m.arquivo?.nome ?? 'Arquivo'}`
  return m.texto ?? ''
}

// ---- Lista de conversas ----

function ListaDeConversas({ app, ir }: { app: App; ir: (t: Tela) => void }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const [busca, setBusca] = useState('')
  const conversas = minhasConversas(e, app)
  const meu = 'celular' in e.eu ? e.eu.celular : null
  const filtradas = conversas.filter((c) => tituloDaConversa(e, c).nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="cel-msg-lista">
      <header className="cel-msg-topo">
        {app === 'ordem' ? (
          <div className="cel-ordem-cabeca">
            <Brasao tamanho={34} />
            <div><strong>ORDO REALITAS</strong><small>Canal seguro · {conversas.length} canais</small></div>
          </div>
        ) : (
          <>
            <div className="cel-msg-topo-linha">
              <button type="button" className="cel-link" onClick={() => ir({ tipo: 'contato' })}><FontAwesomeIcon icon={faUserPlus} /></button>
              <button type="button" className="cel-link" onClick={() => ir({ tipo: 'nova' })} aria-label={texto(idioma, 'novaConversa')}><FontAwesomeIcon icon={faPenToSquare} /></button>
            </div>
            <h1>{texto(idioma, 'conversas')}</h1>
          </>
        )}
        <label className="cel-busca">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <input placeholder={texto(idioma, 'buscar')} value={busca} onChange={(ev) => setBusca(ev.target.value)} />
        </label>
        <div className="cel-msg-acoes">
          <button type="button" className="cel-link" onClick={() => ir({ tipo: 'grupo' })}>{app === 'ordem' ? '+ Novo canal' : texto(idioma, 'novoGrupo')}</button>
          {app === 'ordem' && <button type="button" className="cel-link" onClick={() => ir({ tipo: 'nova' })}>+ Contato direto</button>}
        </div>
      </header>
      <ul className="cel-msg-itens">
        {filtradas.length === 0 && <li className="cel-vazio">{texto(idioma, 'semConversas')}</li>}
        {filtradas.map((c) => {
          const t = tituloDaConversa(e, c)
          const lista = e.mensagens[c.id] ?? []
          const ultima = lista[lista.length - 1]
          const p = meu ? e.participantes.find((x) => x.conversa_id === c.id && x.celular_id === meu) : null
          const n = meu ? naoLidas(lista, meu, p?.lida_ate ?? null) : 0
          return (
            <li key={c.id}>
              <button type="button" className="cel-msg-item" onClick={() => ir({ tipo: 'conversa', id: c.id })}>
                <Avatar foto={t.foto} grupo={c.tipo === 'grupo'} />
                <span className="cel-msg-item-meio">
                  <strong>{t.nome}</strong>
                  <small>
                    {ultima && ehEu(e.eu, { celular: ultima.de_celular_id, npc: ultima.de_npc_id }) && !ultima.apagada && (
                      <FontAwesomeIcon icon={ultima.estado === 'pendente' ? faClock : faCheckDouble} className="cel-tique" />
                    )}
                    {previa(ultima, idioma)}
                  </small>
                </span>
                <span className="cel-msg-item-fim">
                  <small className={n ? 'novo' : ''}>{ultima ? horaDaMensagem(e.tempo, ultima.minuto_no_jogo, ultima.created_at) : ''}</small>
                  {n > 0 && <b className="cel-contador">{n}</b>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---- Escolher pessoas (nova conversa, novo grupo, adicionar no grupo) ----

function useQuemDaPraChamar(): Pessoa[] {
  const e = useCelular()
  return useMemo(() => {
    // NPC (o mestre): pode falar com qualquer celular da mesa.
    if ('npc' in e.eu) return e.celulares.map((c) => pessoa(e, { celular: c.id }))
    const daAgenda = e.contatos.filter((k) => !k.bloqueado).map((k) => pessoa(e, { celular: k.contato_celular_id, npc: k.npc_id }))
    return daAgenda.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [e])
}

function chaveDe(l: Lado) { return 'celular' in l ? `c:${l.celular}` : `n:${l.npc}` }

function NovaConversa({ app, ir }: { app: App; ir: (t: Tela) => void }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const pessoas = useQuemDaPraChamar()
  const [erro, setErro] = useState<string | null>(null)

  async function comecar(p: Pessoa) {
    const r = await e.acoes.criarConversa({ tipo: 'direta', app, ...('celular' in p.lado ? { celulares: [p.lado.celular] } : { npcs: [p.lado.npc] }) })
    if (r.erro) setErro(r.erro)
    else if (r.id) ir({ tipo: 'conversa', id: r.id })
  }

  return (
    <div className="cel-msg-tela">
      <Topo titulo={texto(idioma, 'novaConversa')} voltar={() => ir({ tipo: 'lista' })} />
      {'celular' in e.eu && (
        <button type="button" className="cel-lista-item cel-lista-destaque" onClick={() => ir({ tipo: 'contato' })}>
          <FontAwesomeIcon icon={faUserPlus} /> {texto(idioma, 'novoContato')}
        </button>
      )}
      <div className="cel-lista">
        {pessoas.map((p) => (
          <button key={chaveDe(p.lado)} type="button" className="cel-lista-item cel-pessoa" onClick={() => comecar(p)}>
            <Avatar foto={p.foto} tamanho={36} />
            <span><strong>{p.nome}</strong>{p.recado && <small>{p.recado}</small>}</span>
          </button>
        ))}
        {pessoas.length === 0 && <p className="cel-vazio">Sua agenda está vazia. Adicione um contato.</p>}
      </div>
      {erro && <p className="cel-erro">{erro}</p>}
    </div>
  )
}

function NovoGrupo({ app, ir }: { app: App; ir: (t: Tela) => void }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const pessoas = useQuemDaPraChamar()
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [nome, setNome] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function trocarFoto() {
    const f = await escolherImagem('quadrado', 'Foto do grupo')
    if (!f) return
    const r = await e.acoes.enviarArquivo(f, f.name)
    if (r.url) setFoto(r.url)
  }

  async function criar() {
    if (!nome.trim() || !escolhidos.length) { setErro('Dê um nome e escolha pelo menos uma pessoa.'); return }
    setOcupado(true)
    const lados = pessoas.filter((p) => escolhidos.includes(chaveDe(p.lado))).map((p) => p.lado)
    const r = await e.acoes.criarConversa({
      tipo: 'grupo', app, nome: nome.trim(), foto,
      celulares: lados.flatMap((l) => ('celular' in l ? [l.celular] : [])),
      npcs: lados.flatMap((l) => ('npc' in l ? [l.npc] : [])),
    })
    setOcupado(false)
    if (r.erro) setErro(r.erro)
    else if (r.id) ir({ tipo: 'conversa', id: r.id })
  }

  return (
    <div className="cel-msg-tela">
      <Topo titulo={app === 'ordem' ? 'Novo canal' : texto(idioma, 'novoGrupo')} voltar={() => ir({ tipo: 'lista' })} />
      <div className="cel-grupo-cabeca">
        <button type="button" className="cel-config-foto pequena" onClick={trocarFoto}>
          {foto ? <img src={foto} alt="" /> : <FontAwesomeIcon icon={faCamera} />}
        </button>
        <input className="cel-input" placeholder={texto(idioma, 'nomeDoGrupo')} value={nome} maxLength={80} onChange={(ev) => setNome(ev.target.value)} />
      </div>
      <div className="cel-lista">
        {pessoas.map((p) => {
          const k = chaveDe(p.lado)
          const marcado = escolhidos.includes(k)
          return (
            <button key={k} type="button" className={`cel-lista-item cel-pessoa${marcado ? ' marcado' : ''}`} onClick={() => setEscolhidos((l) => (marcado ? l.filter((x) => x !== k) : [...l, k]))}>
              <Avatar foto={p.foto} tamanho={36} />
              <span><strong>{p.nome}</strong></span>
              <span className="cel-marca">{marcado && <FontAwesomeIcon icon={faCheck} />}</span>
            </button>
          )
        })}
      </div>
      {erro && <p className="cel-erro">{erro}</p>}
      <button type="button" className="cel-botao-principal" disabled={ocupado} onClick={criar}>{texto(idioma, 'criar')}</button>
    </div>
  )
}

// Novo contato: alguém da mesa, ou um contato inventado (o pai da Nina), que o mestre responde.
function NovoContato({ ir }: { ir: (t: Tela) => void }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const [aba, setAba] = useState<'mesa' | 'outro'>('mesa')
  const [nome, setNome] = useState('')
  const [numero, setNumero] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const meu = 'celular' in e.eu ? e.eu.celular : null
  const daMesa = e.celulares.filter((c) => c.id !== meu && !e.contatos.some((k) => k.contato_celular_id === c.id))

  async function adicionarDaMesa(id: string) {
    const r = await e.acoes.adicionarContato({ celular: id })
    if (r) setErro(r)
    else ir({ tipo: 'nova' })
  }

  async function trocarFoto() {
    const f = await escolherImagem('quadrado', 'Foto do contato')
    if (!f) return
    const r = await e.acoes.enviarArquivo(f, f.name)
    if (r.url) setFoto(r.url)
  }

  async function criarOutro() {
    if (!nome.trim()) { setErro('Dê um nome pro contato.'); return }
    const r = await e.acoes.criarNpc({ nome: nome.trim(), foto, numero: numero.trim() || null })
    if (r.erro || !r.npc) { setErro(r.erro ?? 'Não deu pra criar.'); return }
    const e2 = await e.acoes.adicionarContato({ npc: r.npc.id })
    if (e2) setErro(e2)
    else ir({ tipo: 'nova' })
  }

  return (
    <div className="cel-msg-tela">
      <Topo titulo={texto(idioma, 'novoContato')} voltar={() => ir({ tipo: 'lista' })} />
      <div className="cel-abas">
        <button type="button" className={aba === 'mesa' ? 'ativo' : ''} onClick={() => setAba('mesa')}>{texto(idioma, 'daMesa')}</button>
        <button type="button" className={aba === 'outro' ? 'ativo' : ''} onClick={() => setAba('outro')}>{texto(idioma, 'outros')}</button>
      </div>
      {aba === 'mesa' ? (
        <div className="cel-lista">
          {daMesa.map((c) => (
            <button key={c.id} type="button" className="cel-lista-item cel-pessoa" onClick={() => adicionarDaMesa(c.id)}>
              <Avatar foto={c.foto_perfil} tamanho={36} />
              <span><strong>{c.nome_no_perfil || 'Sem nome'}</strong><small>{c.numero}</small></span>
              <FontAwesomeIcon icon={faUserPlus} />
            </button>
          ))}
          {daMesa.length === 0 && <p className="cel-vazio">Todo mundo da mesa já está na sua agenda.</p>}
        </div>
      ) : (
        <div className="cel-form">
          <p className="cel-dica">Alguém da vida do seu personagem (família, amigos…). Quem responde é o mestre.</p>
          <button type="button" className="cel-config-foto" onClick={trocarFoto}>
            {foto ? <img src={foto} alt="" /> : <FontAwesomeIcon icon={faCircleUser} />}
            <small>{texto(idioma, 'foto')}</small>
          </button>
          <label className="cel-campo"><span>{texto(idioma, 'nome')}</span><input value={nome} maxLength={80} onChange={(ev) => setNome(ev.target.value)} placeholder="Pai" /></label>
          <label className="cel-campo"><span>{texto(idioma, 'numero')}</span><input value={numero} maxLength={30} onChange={(ev) => setNumero(ev.target.value)} placeholder="(11) 9…" /></label>
          <button type="button" className="cel-botao-principal" onClick={criarOutro}>{texto(idioma, 'salvar')}</button>
        </div>
      )}
      {erro && <p className="cel-erro">{erro}</p>}
    </div>
  )
}

function Topo({ titulo, voltar, direita }: { titulo: string; voltar: () => void; direita?: React.ReactNode }) {
  return (
    <header className="cel-topo-simples">
      <button type="button" className="cel-link" onClick={voltar} aria-label="Voltar"><FontAwesomeIcon icon={faArrowLeft} /></button>
      <strong>{titulo}</strong>
      <span>{direita}</span>
    </header>
  )
}

// ---- A conversa ----

function Balao({ m, grupo, onAcao }: { m: Mensagem; grupo: boolean; onAcao: (m: Mensagem) => void }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const minha = ehEu(e.eu, { celular: m.de_celular_id, npc: m.de_npc_id })
  const autor = pessoa(e, { celular: m.de_celular_id, npc: m.de_npc_id })
  const corrompida = !!m.efeito?.corrompida
  // "Some depois de lida": quem recebe vê por uns segundos e a mensagem se apaga.
  useEffect(() => {
    if (!m.efeito?.some_apos_ler || m.apagada || minha) return
    const t = window.setTimeout(() => { void e.acoes.apagarMensagem(m.id) }, 8000)
    return () => window.clearTimeout(t)
  }, [m.id, m.apagada, m.efeito?.some_apos_ler, minha, e.acoes])

  // Lida por todos os outros: os dois tiques ficam azuis.
  const lidaPorTodos = minha && e.participantes
    .filter((p) => p.conversa_id === m.conversa_id && !p.saiu_em && p.celular_id && p.celular_id !== m.de_celular_id)
    .every((p) => p.lida_ate && Date.parse(p.lida_ate) >= Date.parse(m.created_at))

  if (m.tipo === 'sistema') return <div className="cel-sistema">{m.texto}</div>

  return (
    <div className={`cel-balao-linha${minha ? ' minha' : ''}`}>
      <div
        className={`cel-balao${minha ? ' minha' : ''}${corrompida ? ' corrompida' : ''}${m.apagada ? ' apagada' : ''}`}
        style={corrompida && m.efeito?.elemento ? { ['--cel-corrompida' as string]: m.efeito.elemento } : undefined}
        onContextMenu={(ev) => { ev.preventDefault(); onAcao(m) }}
        onDoubleClick={() => onAcao(m)}
      >
        {grupo && !minha && <span className="cel-balao-autor" style={{ color: corDe(autor.nome) }}>{autor.nome}{!autor.naAgenda && autor.numero && autor.nome !== autor.numero ? <small> ~{autor.numero}</small> : null}</span>}
        {m.apagada ? (
          <em><FontAwesomeIcon icon={faTrash} /> {texto(idioma, 'apagada')}</em>
        ) : (
          <>
            {m.tipo === 'foto' && m.arquivo_url && <img className="cel-balao-midia" src={m.arquivo_url} alt="" />}
            {m.tipo === 'video' && m.arquivo_url && <video className="cel-balao-midia" src={m.arquivo_url} controls />}
            {m.tipo === 'audio' && m.arquivo_url && <audio className="cel-balao-audio" src={m.arquivo_url} controls />}
            {m.tipo === 'arquivo' && m.arquivo_url && <a className="cel-balao-arquivo" href={m.arquivo_url} target="_blank" rel="noreferrer"><FontAwesomeIcon icon={faPaperclip} /> {m.arquivo?.nome ?? 'Arquivo'}</a>}
            {m.texto && <span className="cel-balao-texto" data-texto={m.texto}>{m.texto}</span>}
          </>
        )}
        <span className="cel-balao-hora">
          {horaDaMensagem(e.tempo, m.minuto_no_jogo, m.created_at)}
          {minha && !m.apagada && <FontAwesomeIcon icon={m.estado === 'pendente' ? faClock : faCheckDouble} className={lidaPorTodos ? 'lida' : ''} />}
        </span>
      </div>
    </div>
  )
}

function TelaDaConversa({ id, app, ir }: { id: string; app: App; ir: (t: Tela) => void }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const conversa = e.conversas.find((c) => c.id === id)
  const lista = e.mensagens[id] ?? []
  const [escrito, setEscrito] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [acao, setAcao] = useState<Mensagem | null>(null)
  const [gravando, setGravando] = useState<{ rec: MediaRecorder; desde: number } | null>(null)
  const [, setTique] = useState(0)
  const [outroLado, setOutroLado] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  const membros = membrosDaConversa(e, id)
  const npcsAqui = membros.filter((p) => p.npc_id).map((p) => p.npc_id!)
  // O mestre, no celular de alguém, responde como um NPC da conversa.
  const [como, setComo] = useState<string>('eu')

  useEffect(() => { void e.acoes.abrirConversa(id) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
    void e.acoes.marcarLida(id)
  }, [lista.length, id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!gravando) return
    const t = window.setInterval(() => setTique((n) => n + 1), 500)
    return () => window.clearInterval(t)
  }, [gravando])

  if (!conversa) return null
  const t = tituloDaConversa(e, conversa)
  const subtitulo = conversa.tipo === 'grupo'
    ? membros.map((p) => (ehEu(e.eu, { celular: p.celular_id, npc: p.npc_id }) ? 'Você' : pessoa(e, { celular: p.celular_id, npc: p.npc_id }).nome)).join(', ')
    : t.outro?.recado || texto(idioma, 'online')
  const de: Lado | undefined = como !== 'eu' ? { npc: como } : undefined
  const efeito = outroLado && e.souMestre ? { corrompida: true, some_apos_ler: true } : null

  async function mandarTexto() {
    const t2 = escrito.trim()
    if (!t2) return
    setEscrito('')
    const r = await e.acoes.enviar({ conversaId: id, tipo: 'texto', texto: t2, de, efeito })
    setErro(r)
  }

  async function mandarArquivo(f: File | null) {
    if (!f) return
    const up = await e.acoes.enviarArquivo(f, f.name)
    if (!up.url) { setErro(up.erro); return }
    const r = await e.acoes.enviar({ conversaId: id, tipo: tipoDoArquivo(f), arquivoUrl: up.url, arquivo: { nome: f.name }, de, efeito })
    setErro(r)
  }

  async function gravar() {
    if (gravando) {
      gravando.rec.stop()
      return
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(fluxo)
      const pedacos: Blob[] = []
      const desde = Date.now()
      rec.ondataavailable = (ev) => pedacos.push(ev.data)
      rec.onstop = async () => {
        fluxo.getTracks().forEach((tr) => tr.stop())
        const duracao = Math.round((Date.now() - desde) / 1000)
        setGravando(null)
        const blob = new Blob(pedacos, { type: rec.mimeType || 'audio/webm' })
        const up = await e.acoes.enviarArquivo(blob, 'audio.webm')
        if (!up.url) { setErro(up.erro); return }
        setErro(await e.acoes.enviar({ conversaId: id, tipo: 'audio', arquivoUrl: up.url, arquivo: { nome: 'Áudio', duracao }, de, efeito }))
      }
      rec.start()
      setGravando({ rec, desde })
    } catch {
      setErro('Não deu pra usar o microfone.')
    }
  }

  // Separador de dia entre as mensagens.
  let diaAnterior = ''

  return (
    <div className={`cel-conversa cel-conversa-${app}`}>
      <header className="cel-conversa-topo">
        <button type="button" className="cel-link" onClick={() => ir({ tipo: 'lista' })} aria-label="Voltar"><FontAwesomeIcon icon={faArrowLeft} /></button>
        <button type="button" className="cel-conversa-quem" onClick={() => conversa.tipo === 'grupo' && ir({ tipo: 'info', id })}>
          <Avatar foto={t.foto} tamanho={34} grupo={conversa.tipo === 'grupo'} />
          <span><strong>{t.nome}</strong><small>{subtitulo}</small></span>
        </button>
        {t.outro && (
          <button type="button" className="cel-link" aria-label="Ligar" onClick={() => void e.acoes.ligar(t.outro!.lado)}><FontAwesomeIcon icon={faPhone} /></button>
        )}
      </header>

      <div className="cel-conversa-corpo">
        {lista.map((m) => {
          const dia = dataDaMensagem(e.tempo, m)
          const mostrarDia = dia !== diaAnterior
          diaAnterior = dia
          return (
            <div key={m.id}>
              {mostrarDia && <div className="cel-dia"><span>{dia}</span></div>}
              <Balao m={m} grupo={conversa.tipo === 'grupo'} onAcao={setAcao} />
            </div>
          )
        })}
        <div ref={fim} />
      </div>

      {acao && (
        <div className="cel-menu" onClick={() => setAcao(null)}>
          <div className="cel-menu-caixa" onClick={(ev) => ev.stopPropagation()}>
            {acao.tipo === 'foto' && acao.arquivo_url && 'celular' in e.eu && (
              <button type="button" onClick={async () => { await e.acoes.guardarNaGaleria({ url: acao.arquivo_url!, mensagemId: acao.id, minutoNoJogo: acao.minuto_no_jogo }); setAcao(null) }}>
                <FontAwesomeIcon icon={faImage} /> Salvar na galeria
              </button>
            )}
            {(e.souMestre || ehEu(e.eu, { celular: acao.de_celular_id, npc: acao.de_npc_id })) && !acao.apagada && (
              <button type="button" className="perigo" onClick={async () => { await e.acoes.apagarMensagem(acao.id); setAcao(null) }}>
                <FontAwesomeIcon icon={faTrash} /> Apagar
              </button>
            )}
            <button type="button" onClick={() => setAcao(null)}>{texto(idioma, 'cancelar')}</button>
          </div>
        </div>
      )}

      {e.souMestre && (npcsAqui.length > 0 || 'npc' in e.eu) && (
        <div className="cel-como">
          <span>{texto(idioma, 'responderComo')}</span>
          <select value={como} onChange={(ev) => setComo(ev.target.value)}>
            <option value="eu">{'celular' in e.eu ? e.celular.nome_no_perfil || 'Este celular' : pessoa(e, { npc: e.eu.npc }).nome}</option>
            {npcsAqui.filter((n) => !('npc' in e.eu && e.eu.npc === n)).map((n) => <option key={n} value={n}>{pessoa(e, { npc: n }).nome}</option>)}
          </select>
          <label title="Texto corrompido que some depois de lido"><input type="checkbox" checked={outroLado} onChange={(ev) => setOutroLado(ev.target.checked)} /> <FontAwesomeIcon icon={faGhost} /></label>
        </div>
      )}

      {erro && <p className="cel-erro" onClick={() => setErro(null)}>{erro}</p>}

      <footer className="cel-conversa-escrever">
        {gravando ? (
          <div className="cel-gravando">
            <span className="cel-gravando-ponto" />
            {Math.floor((Date.now() - gravando.desde) / 1000)}s
          </div>
        ) : (
          <label className="cel-escrever-caixa">
            <FontAwesomeIcon icon={faFaceSmile} className="cel-escrever-icone" />
            <input
              placeholder={texto(idioma, 'mensagem')}
              value={escrito}
              onChange={(ev) => setEscrito(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); void mandarTexto() } }}
            />
            <button type="button" className="cel-link" aria-label="Anexar" onClick={async () => mandarArquivo(await escolherArquivo('image/*,video/*,audio/*'))}><FontAwesomeIcon icon={faPaperclip} /></button>
            <button type="button" className="cel-link" aria-label="Foto" onClick={async () => mandarArquivo(await escolherImagem('original', 'Foto'))}><FontAwesomeIcon icon={faCamera} /></button>
          </label>
        )}
        <button type="button" className="cel-escrever-enviar" aria-label={escrito.trim() ? 'Enviar' : gravando ? 'Parar e enviar' : 'Gravar áudio'} onClick={() => (escrito.trim() ? mandarTexto() : gravar())}>
          <FontAwesomeIcon icon={escrito.trim() ? faPaperPlane : gravando ? faStop : faMicrophone} />
        </button>
      </footer>
    </div>
  )
}

// ---- Informações do grupo ----

function InfoDoGrupo({ id, ir }: { id: string; ir: (t: Tela) => void }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const conversa = e.conversas.find((c) => c.id === id)
  const membros = membrosDaConversa(e, id)
  const pessoas = useQuemDaPraChamar()
  const [adicionando, setAdicionando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  if (!conversa) return null
  const meuPapel = membros.find((p) => ehEu(e.eu, { celular: p.celular_id, npc: p.npc_id }))?.papel
  const admin = e.souMestre || meuPapel === 'admin'
  const fora = pessoas.filter((p) => !membros.some((m) => ('celular' in p.lado ? m.celular_id === p.lado.celular : m.npc_id === p.lado.npc)))

  async function trocarFoto() {
    const f = await escolherImagem('quadrado', 'Foto do grupo')
    if (!f) return
    const r = await e.acoes.enviarArquivo(f, f.name)
    if (r.url) setErro(await e.acoes.mudarConversa(id, { foto: r.url }))
  }

  return (
    <div className="cel-msg-tela">
      <Topo titulo={conversa.nome || 'Grupo'} voltar={() => ir({ tipo: 'conversa', id })} />
      <div className="cel-grupo-info">
        <button type="button" className="cel-config-foto" onClick={admin ? trocarFoto : undefined}>
          {conversa.foto ? <img src={conversa.foto} alt="" /> : <FontAwesomeIcon icon={faUsers} />}
        </button>
        <strong>{conversa.nome}</strong>
        <small>{membros.length} {texto(idioma, 'participantes')}</small>
      </div>
      <div className="cel-lista">
        {admin && (
          <button type="button" className="cel-lista-item cel-lista-destaque" onClick={() => setAdicionando((v) => !v)}>
            <FontAwesomeIcon icon={faUserPlus} /> {texto(idioma, 'adicionar')}
          </button>
        )}
        {adicionando && fora.map((p) => (
          <button key={chaveDe(p.lado)} type="button" className="cel-lista-item cel-pessoa" onClick={async () => { setErro(await e.acoes.adicionarNaConversa(id, p.lado)); setAdicionando(false) }}>
            <Avatar foto={p.foto} tamanho={32} /><span><strong>{p.nome}</strong></span><FontAwesomeIcon icon={faUserPlus} />
          </button>
        ))}
        {membros.map((m) => {
          const p = pessoa(e, { celular: m.celular_id, npc: m.npc_id })
          return (
            <div key={m.id} className="cel-lista-item cel-pessoa">
              <Avatar foto={p.foto} tamanho={32} />
              <span><strong>{p.nome}</strong>{m.papel === 'admin' && <small>admin</small>}</span>
              {admin && !ehEu(e.eu, { celular: m.celular_id, npc: m.npc_id }) && (
                <button type="button" className="cel-link perigo" onClick={async () => setErro(await e.acoes.sairDaConversa(id, p.lado))}>{texto(idioma, 'remover')}</button>
              )}
            </div>
          )
        })}
      </div>
      {erro && <p className="cel-erro">{erro}</p>}
      <button type="button" className="cel-botao-perigo" onClick={async () => { const r = await e.acoes.sairDaConversa(id, e.eu); if (!r) ir({ tipo: 'lista' }); else setErro(r) }}>
        {texto(idioma, 'sairDoGrupo')}
      </button>
    </div>
  )
}

export default function AppMensagens({ app }: { app: App }) {
  const [tela, ir] = useState<Tela>({ tipo: 'lista' })
  return (
    <div className={`cel-app-mensagens cel-tema-${app}`}>
      {tela.tipo === 'lista' && <ListaDeConversas app={app} ir={ir} />}
      {tela.tipo === 'conversa' && <TelaDaConversa id={tela.id} app={app} ir={ir} />}
      {tela.tipo === 'nova' && <NovaConversa app={app} ir={ir} />}
      {tela.tipo === 'grupo' && <NovoGrupo app={app} ir={ir} />}
      {tela.tipo === 'contato' && <NovoContato ir={ir} />}
      {tela.tipo === 'info' && <InfoDoGrupo id={tela.id} ir={ir} />}
    </div>
  )
}
