// Jump scare (pedido da Millie, 16/10): a central do mestre (sustos prontos, pra quem, testar) e o
// susto em tela cheia na tela de quem toma — imagem/GIF/vídeo, som, flash e tela tremendo.
import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGhost, faPlay, faPenToSquare, faTrash, faPlus, faEye } from '@fortawesome/free-solid-svg-icons'
import { supabase } from '../../lib/supabase'
import Janela from './Janela'
import {
  SONS_PRONTOS, apagarSusto, enviarArquivoDeSusto, idDoYoutube, inicioDoYoutube, salvarSusto, sustosDa, tocarSomPronto, tocarYoutube, volumeDoSusto,
  type Efeito, type Susto, type SustoDisparado, type TipoDeSom,
} from './dadosDosSustos'
import type { Membro } from './mesa'

// ---- O susto na tela ----

// A imagem e o som aparecem juntos (bug 16/10: a imagem vinha antes do som). Tudo carrega escondido;
// o susto aparece quando o som começa e a imagem já carregou. Se passar de 4 s, aparece assim mesmo.
export function SustoNaTela({ susto, onAcabou }: { susto: SustoDisparado; onAcabou: () => void }) {
  const [somPronto, setSomPronto] = useState(susto.som_tipo === 'nenhum' || susto.som_tipo === 'pronto' || !susto.som)
  const [midiaPronta, setMidiaPronta] = useState(!susto.midia_url)
  const [esgotou, setEsgotou] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const visivel = (somPronto && midiaPronta) || esgotou
  const audio = useRef<HTMLAudioElement | null>(null)
  const parar = useRef<() => void>(() => {})

  // Começa a carregar o som na hora que o susto chega.
  useEffect(() => {
    if (susto.som_tipo === 'arquivo' && susto.som) {
      const a = new Audio(susto.som)
      a.preload = 'auto'
      a.volume = Math.min(1, volumeDoSusto())
      a.addEventListener('canplaythrough', () => setSomPronto(true), { once: true })
      a.addEventListener('error', () => setSomPronto(true), { once: true })
      a.load()
      audio.current = a
      parar.current = () => { a.pause(); a.src = '' }
    }
    // YouTube: o próprio player avisa quando o som começou; vídeo bloqueado vira o grito pronto.
    if (susto.som_tipo === 'youtube') {
      tocarYoutube(susto.som, susto.som_inicio, Math.max(8, susto.duracao + 5), () => { tocarSomPronto('grito'); setSomPronto(true) }, () => setSomPronto(true))
    }
    const limite = window.setTimeout(() => setEsgotou(true), 4000)
    return () => { window.clearTimeout(limite); parar.current() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [susto.id])

  // Apareceu: o som pronto e o mp3 tocam nesse instante, e a contagem da duração começa.
  useEffect(() => {
    if (!visivel) return
    if (susto.som_tipo === 'pronto' && susto.som) parar.current = tocarSomPronto(susto.som)
    if (audio.current) void audio.current.play().catch(() => {})
    const sai = window.setTimeout(() => setSaindo(true), susto.duracao * 1000)
    const fim = window.setTimeout(() => { parar.current(); onAcabou() }, susto.duracao * 1000 + 450)
    return () => { window.clearTimeout(sai); window.clearTimeout(fim) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel])

  const comSomDoVideo = susto.midia_tipo === 'video' && susto.som_tipo === 'nenhum'
  return (
    <div className={`susto susto-${susto.efeito}${susto.tremor ? ' susto-tremor' : ''}${saindo ? ' saindo' : ''}${visivel ? '' : ' carregando'}`} role="presentation">
      {visivel && <div className="susto-flash" />}
      {susto.midia_url && (susto.midia_tipo === 'video'
        ? <video className="susto-midia" src={susto.midia_url} autoPlay={visivel} playsInline muted={!comSomDoVideo} loop preload="auto" onCanPlayThrough={() => setMidiaPronta(true)} onError={() => setMidiaPronta(true)} ref={(v) => { if (v && visivel && v.paused) void v.play().catch(() => {}) }} />
        : <img className="susto-midia" src={susto.midia_url} alt="" draggable={false} onLoad={() => setMidiaPronta(true)} onError={() => setMidiaPronta(true)} />)}
    </div>
  )
}

// ---- A central do mestre ----

const EFEITOS: { id: Efeito; nome: string }[] = [
  { id: 'pulo', nome: 'Pula na tela' },
  { id: 'zoom', nome: 'Vem pra cima' },
  { id: 'piscar', nome: 'Pisca' },
]

type Rascunho = Omit<Susto, 'id' | 'created_at' | 'campaign_id'> & { id?: string }

const NOVO: Rascunho = { nome: '', midia_url: null, midia_tipo: 'imagem', som_tipo: 'pronto', som: 'grito', som_inicio: 0, efeito: 'pulo', duracao: 2.5, tremor: true }

function disparo(s: Rascunho | Susto, alvos: string[] | null): SustoDisparado {
  return { id: crypto.randomUUID(), midia_url: s.midia_url, midia_tipo: s.midia_tipo, som_tipo: s.som_tipo, som: s.som, som_inicio: s.som_inicio, efeito: s.efeito, duracao: s.duracao, tremor: s.tremor, alvos }
}

export function CentralDeSustos({ campanhaId, jogadores, onDisparar, onTestar, onFechar }: {
  campanhaId: string
  jogadores: Membro[]
  onDisparar: (s: SustoDisparado) => void
  onTestar: (s: SustoDisparado) => void
  onFechar: () => void
}) {
  const [sustos, setSustos] = useState<Susto[]>([])
  const [editando, setEditando] = useState<Rascunho | null>(null)
  const [alvo, setAlvo] = useState<string>('todos')
  const [criaturas, setCriaturas] = useState<{ id: string; name: string; image_url: string }[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const recarregar = () => { void sustosDa(campanhaId).then(setSustos) }
  useEffect(recarregar, [campanhaId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editando || criaturas.length) return
    void supabase.from('creatures').select('id, name, image_url').not('image_url', 'is', null).order('name').limit(500)
      .then(({ data }) => setCriaturas((data ?? []) as { id: string; name: string; image_url: string }[]))
  }, [editando, criaturas.length])

  const alvos = alvo === 'todos' ? null : [alvo]
  const nomeDoAlvo = alvo === 'todos' ? 'a mesa toda' : jogadores.find((j) => j.userId === alvo)?.personagem || jogadores.find((j) => j.userId === alvo)?.nomeConta || 'o jogador'

  async function subir(accept: string, campo: 'midia' | 'som') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f || !editando) return
      setEnviando(true)
      const r = await enviarArquivoDeSusto(f)
      setEnviando(false)
      if (!r.url) { setErro(r.erro); return }
      setEditando((s) => (s ? (campo === 'midia'
        ? { ...s, midia_url: r.url, midia_tipo: f.type.startsWith('video/') ? 'video' : 'imagem', nome: s.nome || f.name.replace(/\.[^.]+$/, '') }
        : { ...s, som_tipo: 'arquivo', som: r.url }) : s))
    }
    input.click()
  }

  async function guardar() {
    if (!editando) return
    if (!editando.nome.trim()) { setErro('Dê um nome pro susto.'); return }
    if (!editando.midia_url && editando.som_tipo === 'nenhum') { setErro('Escolha uma imagem, um vídeo ou um som.'); return }
    if (editando.som_tipo === 'youtube' && !idDoYoutube(editando.som)) { setErro('Esse link não é do YouTube.'); return }
    const r = await salvarSusto({ ...editando, nome: editando.nome.trim(), campaign_id: campanhaId })
    if (r) { setErro(r); return }
    setEditando(null)
    recarregar()
  }

  function disparar(s: Susto) {
    onDisparar(disparo(s, alvos))
    setAviso(`"${s.nome}" em ${nomeDoAlvo}.`)
    window.setTimeout(() => setAviso(null), 2500)
  }

  return (
    <Janela titulo={editando ? (editando.id ? 'Editar susto' : 'Novo susto') : 'Central dos sustos'} icone={faGhost} largura={420} inicial={{ x: Math.max(16, window.innerWidth - 500), y: 70 }} onFechar={onFechar} className="central-sustos">
      {editando ? (
        <div className="sustos-form">
          <label className="sustos-campo"><span>Nome</span>
            <input value={editando.nome} maxLength={80} placeholder="O Pai no corredor" onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
          </label>

          <div className="sustos-campo"><span>Imagem, GIF ou vídeo</span>
            <div className="sustos-midia">
              {editando.midia_url
                ? (editando.midia_tipo === 'video' ? <video src={editando.midia_url} muted autoPlay loop /> : <img src={editando.midia_url} alt="" />)
                : <span className="sustos-sem">sem imagem</span>}
              <div className="sustos-midia-botoes">
                <button type="button" disabled={enviando} onClick={() => subir('image/*,video/*', 'midia')}>{enviando ? 'Enviando…' : 'Enviar arquivo'}</button>
                <select value="" onChange={(e) => { const c = criaturas.find((x) => x.id === e.target.value); if (c) setEditando({ ...editando, midia_url: c.image_url, midia_tipo: 'imagem', nome: editando.nome || c.name }) }}>
                  <option value="">Imagem de uma criatura…</option>
                  {criaturas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {editando.midia_url && <button type="button" className="perigo" onClick={() => setEditando({ ...editando, midia_url: null })}>Tirar</button>}
              </div>
            </div>
          </div>

          <div className="sustos-campo"><span>Som</span>
            <div className="sustos-abas">
              {([['pronto', 'Pronto'], ['arquivo', 'Arquivo'], ['youtube', 'YouTube'], ['nenhum', 'Nenhum']] as [TipoDeSom, string][]).map(([t, n]) => (
                <button key={t} type="button" className={editando.som_tipo === t ? 'ativo' : ''} onClick={() => setEditando({ ...editando, som_tipo: t, som: t === 'pronto' ? 'grito' : t === editando.som_tipo ? editando.som : null })}>{n}</button>
              ))}
            </div>
            {editando.som_tipo === 'pronto' && (
              <div className="sustos-sons">
                {SONS_PRONTOS.map((s) => (
                  <span key={s.id} className={`sustos-som${editando.som === s.id ? ' ativo' : ''}`}>
                    <button type="button" onClick={() => setEditando({ ...editando, som: s.id })}>{s.nome}</button>
                    <button type="button" aria-label={`Ouvir ${s.nome}`} onClick={() => tocarSomPronto(s.id)}><FontAwesomeIcon icon={faPlay} /></button>
                  </span>
                ))}
              </div>
            )}
            {editando.som_tipo === 'arquivo' && (
              <div className="sustos-linha">
                <button type="button" disabled={enviando} onClick={() => subir('audio/*', 'som')}>{editando.som ? 'Trocar o áudio' : 'Enviar áudio (mp3)'}</button>
                {editando.som && <audio src={editando.som} controls />}
              </div>
            )}
            {editando.som_tipo === 'youtube' && (
              <div className="sustos-linha">
                <input placeholder="https://www.youtube.com/watch?v=…" value={editando.som ?? ''} onChange={(e) => setEditando({ ...editando, som: e.target.value, som_inicio: inicioDoYoutube(e.target.value) || editando.som_inicio })} />
                <label className="sustos-inicio">começa em <input type="number" min={0} value={editando.som_inicio} onChange={(e) => setEditando({ ...editando, som_inicio: Math.max(0, Number(e.target.value) || 0) })} /> s</label>
                <div className="sustos-linha-botoes">
                  <button type="button" disabled={!idDoYoutube(editando.som)} onClick={() => tocarYoutube(editando.som, editando.som_inicio, 6, () => setErro('Esse vídeo não deixa tocar fora do YouTube (o dono bloqueou). Tente outro link ou envie o áudio.'))}><FontAwesomeIcon icon={faPlay} /> Testar o som</button>
                  <small>Toca só o áudio do vídeo.</small>
                </div>
              </div>
            )}
            {editando.som_tipo === 'nenhum' && editando.midia_tipo === 'video' && <small>O vídeo toca com o som dele.</small>}
          </div>

          <div className="sustos-campo"><span>Como aparece</span>
            <div className="sustos-abas">
              {EFEITOS.map((f) => <button key={f.id} type="button" className={editando.efeito === f.id ? 'ativo' : ''} onClick={() => setEditando({ ...editando, efeito: f.id })}>{f.nome}</button>)}
            </div>
            <label className="sustos-check"><input type="checkbox" checked={editando.tremor} onChange={(e) => setEditando({ ...editando, tremor: e.target.checked })} /> Tela tremendo</label>
          </div>

          <label className="sustos-campo"><span>Fica na tela por {editando.duracao.toFixed(1).replace('.', ',')} s</span>
            <input type="range" min={0.5} max={10} step={0.5} value={editando.duracao} onChange={(e) => setEditando({ ...editando, duracao: Number(e.target.value) })} />
          </label>

          {erro && <p className="sustos-erro" onClick={() => setErro(null)}>{erro}</p>}
          <div className="sustos-acoes">
            <button type="button" onClick={() => setEditando(null)}>Cancelar</button>
            <button type="button" onClick={() => onTestar(disparo(editando, null))}><FontAwesomeIcon icon={faEye} /> Testar em mim</button>
            <button type="button" className="principal" onClick={guardar}>Salvar</button>
          </div>
        </div>
      ) : (
        <div className="sustos-central">
          <div className="sustos-alvo">
            <span>Assustar</span>
            <select value={alvo} onChange={(e) => setAlvo(e.target.value)}>
              <option value="todos">a mesa toda</option>
              {jogadores.map((j) => <option key={j.userId} value={j.userId}>{j.personagem || j.nomeConta}</option>)}
            </select>
            <button type="button" className="sustos-novo" onClick={() => { setErro(null); setEditando({ ...NOVO }) }}><FontAwesomeIcon icon={faPlus} /> Novo susto</button>
          </div>
          {aviso && <p className="sustos-aviso">{aviso}</p>}
          <div className="sustos-lista">
            {sustos.map((s) => (
              <div key={s.id} className="sustos-item">
                <span className="sustos-mini">
                  {s.midia_url ? (s.midia_tipo === 'video' ? <video src={s.midia_url} muted /> : <img src={s.midia_url} alt="" />) : <FontAwesomeIcon icon={faGhost} />}
                </span>
                <span className="sustos-info">
                  <strong>{s.nome}</strong>
                  <small>{s.som_tipo === 'pronto' ? SONS_PRONTOS.find((x) => x.id === s.som)?.nome : s.som_tipo === 'youtube' ? 'YouTube' : s.som_tipo === 'arquivo' ? 'Áudio' : 'Sem som'} · {EFEITOS.find((f) => f.id === s.efeito)?.nome} · {s.duracao.toString().replace('.', ',')} s</small>
                </span>
                <button type="button" className="sustos-icone" aria-label="Testar em mim" title="Testar em mim" onClick={() => onTestar(disparo(s, null))}><FontAwesomeIcon icon={faEye} /></button>
                <button type="button" className="sustos-icone" aria-label="Editar" title="Editar" onClick={() => { setErro(null); setEditando({ ...s }) }}><FontAwesomeIcon icon={faPenToSquare} /></button>
                <button type="button" className="sustos-icone perigo" aria-label="Apagar" title="Apagar" onClick={async () => { if (window.confirm(`Apagar o susto "${s.nome}"?`)) { await apagarSusto(s.id); recarregar() } }}><FontAwesomeIcon icon={faTrash} /></button>
                <button type="button" className="sustos-disparar" onClick={() => disparar(s)}>Assustar!</button>
              </div>
            ))}
            {sustos.length === 0 && <p className="sustos-vazio">Nenhum susto ainda. Crie um com a imagem da criatura e um grito.</p>}
          </div>
        </div>
      )}
    </Janela>
  )
}
