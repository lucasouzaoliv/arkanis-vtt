import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faFileLines, faNoteSticky, faPen, faThumbtack, faTrash, faUpload, faXmark } from '@fortawesome/free-solid-svg-icons'
import Janela from './Janela'
import { curvaDoBarbante, LARGURA_PISTA, tachinha, type Pista } from './pistas'
import type { usePistas } from './usePistas'

type Ponto = { x: number; y: number }
type Gesto =
  | { tipo: 'mural'; x: number; y: number; vx: number; vy: number }
  | { tipo: 'pista'; id: string; x: number; y: number; px: number; py: number; andou: boolean }

// Quadro de pistas (KAN-117): mural de cortiça da campanha. Arrastar o fundo anda pelo mural,
// arrastar um papel muda ele de lugar; com o Barbante ligado, clica numa pista e depois na outra.
export default function QuadroDePistas({ q, onAbrirDocumento, onEnviarImagem, onFechar }: {
  q: ReturnType<typeof usePistas>
  onAbrirDocumento: (documentoId: string) => void
  onEnviarImagem: (f: File) => Promise<string | null>
  onFechar: () => void
}) {
  const largura = Math.min(1040, window.innerWidth - 80)
  const [vista, setVista] = useState<Ponto>({ x: 40, y: 40 })
  const [ligando, setLigando] = useState(false)
  const [primeira, setPrimeira] = useState<string | null>(null)
  const [mouse, setMouse] = useState<Ponto | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [novaFoto, setNovaFoto] = useState<{ url: string; legenda: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const muralRef = useRef<HTMLDivElement>(null)
  const gesto = useRef<Gesto | null>(null)
  // Acabou de arrastar o papel: o clique que vem junto não abre o documento.
  const arrastou = useRef(false)

  const noMural = (cx: number, cy: number): Ponto => {
    const r = muralRef.current!.getBoundingClientRect()
    return { x: cx - r.left - vista.x, y: cy - r.top - vista.y }
  }
  // Pista nova: no meio do que está aparecendo, um pouco espalhada.
  const meio = (): Ponto => {
    const r = muralRef.current!.getBoundingClientRect()
    return { x: Math.round(r.width / 2 - vista.x - 85 + (Math.random() - 0.5) * 120), y: Math.round(r.height / 2 - vista.y - 80 + (Math.random() - 0.5) * 80) }
  }

  function apertarMural(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as Element).closest('.pista, .quadro-barbante')) return
    setPrimeira(null)
    gesto.current = { tipo: 'mural', x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function apertarPista(e: React.PointerEvent, p: Pista) {
    if (e.button !== 0 || editando === p.id) return
    // Ligando, vale clicar em qualquer parte do papel (até no botão do documento).
    if (!ligando && (e.target as Element).closest('button, textarea')) return
    e.stopPropagation()
    if (ligando) {
      if (!primeira) setPrimeira(p.id)
      else {
        if (primeira !== p.id) q.ligar(primeira, p.id)
        setPrimeira(null)
      }
      return
    }
    gesto.current = { tipo: 'pista', id: p.id, x: e.clientX, y: e.clientY, px: p.x, py: p.y, andou: false }
    muralRef.current?.setPointerCapture(e.pointerId)
  }

  function mover(e: React.PointerEvent) {
    if (ligando && primeira) setMouse(noMural(e.clientX, e.clientY))
    const g = gesto.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (g.tipo === 'mural') setVista({ x: g.vx + dx, y: g.vy + dy })
    else {
      if (Math.abs(dx) + Math.abs(dy) > 3) g.andou = true
      if (g.andou) q.alterar(g.id, { x: Math.round(g.px + dx), y: Math.round(g.py + dy) }, false)
    }
  }

  function soltar(e: React.PointerEvent) {
    const g = gesto.current
    gesto.current = null
    arrastou.current = g?.tipo === 'pista' && g.andou
    if (g?.tipo === 'pista' && g.andou) q.alterar(g.id, { x: Math.round(g.px + e.clientX - g.x), y: Math.round(g.py + e.clientY - g.y) })
  }

  const porId = new Map(q.pistas.map((p) => [p.id, p]))
  const origem = primeira ? porId.get(primeira) : undefined

  return (
    <Janela titulo="Quadro de Pistas" icone={faThumbtack} largura={largura} onFechar={onFechar} className="quadro-janela">
      <div className="quadro-barra">
        <button type="button" className="janela-botao" onClick={() => { const m = meio(); q.criar({ tipo: 'nota', texto: '', ...m }).then(() => undefined) }}>
          <FontAwesomeIcon icon={faNoteSticky} /> Nota
        </button>
        <button type="button" className="janela-botao" onClick={() => setNovaFoto({ url: '', legenda: '' })}>
          <FontAwesomeIcon icon={faCamera} /> Foto
        </button>
        <button type="button" className={`janela-botao quadro-barbante-botao${ligando ? ' ativo' : ''}`} aria-pressed={ligando} onClick={() => { setLigando((v) => !v); setPrimeira(null) }}>
          <span className="quadro-barbante-icone" aria-hidden /> Barbante
        </button>
        <span className="quadro-dica">
          {ligando
            ? primeira ? 'Agora clique na outra pista.' : 'Clique numa pista e depois em outra pra ligar. Clique num barbante pra cortar.'
            : 'Arraste o fundo pra andar pelo mural. Duplo clique na nota pra escrever. Documentos lidos podem ser presos aqui.'}
        </span>
      </div>
      {novaFoto && (
        <div className="quadro-nova-foto">
          <input autoFocus value={novaFoto.url} onChange={(e) => setNovaFoto({ ...novaFoto, url: e.target.value })} placeholder="Link da imagem" />
          <label className="janela-botao">
            <FontAwesomeIcon icon={faUpload} /> {enviando ? '…' : 'Enviar'}
            <input
              type="file" accept="image/*" hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                setEnviando(true)
                const url = await onEnviarImagem(f)
                setEnviando(false)
                if (url) setNovaFoto((n) => (n ? { ...n, url } : n))
              }}
            />
          </label>
          <input value={novaFoto.legenda} onChange={(e) => setNovaFoto({ ...novaFoto, legenda: e.target.value })} placeholder="Legenda (opcional)" />
          <button type="button" className="janela-botao janela-botao-destaque" disabled={!novaFoto.url.trim()} onClick={() => { q.criar({ tipo: 'foto', imagem_url: novaFoto.url.trim(), texto: novaFoto.legenda, ...meio() }); setNovaFoto(null) }}>
            Prender
          </button>
          <button type="button" className="janela-botao" title="Cancelar" onClick={() => setNovaFoto(null)}><FontAwesomeIcon icon={faXmark} /></button>
        </div>
      )}
      <div
        ref={muralRef}
        className={`quadro${ligando ? ' ligando' : ''}`}
        style={{ backgroundPosition: `${vista.x}px ${vista.y}px` }}
        onPointerDown={apertarMural}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={() => (gesto.current = null)}
      >
        <div className="quadro-mundo" style={{ transform: `translate(${vista.x}px, ${vista.y}px)` }}>
          {q.pistas.map((p) => (
            <div
              key={p.id}
              className={`pista pista-${p.tipo}${primeira === p.id ? ' escolhida' : ''}`}
              style={{ left: p.x, top: p.y, width: LARGURA_PISTA[p.tipo], transform: `rotate(${p.rotacao}deg)` }}
              onPointerDown={(e) => apertarPista(e, p)}
              onDoubleClick={() => { if (!ligando && p.tipo !== 'documento') setEditando(p.id) }}
            >
              <span className="pista-tachinha" aria-hidden />
              {p.tipo === 'foto' && p.imagem_url && <img src={p.imagem_url} alt="" draggable={false} />}
              {p.tipo === 'documento' && (
                <button type="button" className="pista-doc-abrir" onClick={() => { if (!ligando && !arrastou.current && p.documento_id) onAbrirDocumento(p.documento_id) }} title="Ler o documento">
                  <FontAwesomeIcon icon={faFileLines} />
                  <span>{p.texto || 'Documento'}</span>
                </button>
              )}
              {p.tipo !== 'documento' && (editando === p.id ? (
                <textarea
                  autoFocus
                  className="pista-texto editando"
                  defaultValue={p.texto}
                  placeholder={p.tipo === 'foto' ? 'Legenda…' : 'Escreva a pista…'}
                  onBlur={(e) => { setEditando(null); if (e.target.value !== p.texto) q.alterar(p.id, { texto: e.target.value }) }}
                  onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur() }}
                />
              ) : (
                <p className="pista-texto">{p.texto || (p.tipo === 'nota' ? 'Duplo clique pra escrever' : '')}</p>
              ))}
              {!ligando && (
                <span className="pista-acoes" style={{ transform: `rotate(${-p.rotacao}deg)` }}>
                  {p.tipo !== 'documento' && <button type="button" title="Escrever" onClick={() => setEditando(p.id)}><FontAwesomeIcon icon={faPen} /></button>}
                  <button type="button" title="Tirar do quadro" onClick={() => q.excluir(p.id)}><FontAwesomeIcon icon={faTrash} /></button>
                </span>
              )}
            </div>
          ))}
          {/* Barbantes por cima dos papéis, presos nas tachinhas. */}
          <svg className="quadro-barbantes" aria-hidden={!ligando}>
            {q.barbantes.map((b) => {
              const de = porId.get(b.de)
              const para = porId.get(b.para)
              if (!de || !para) return null
              const d = curvaDoBarbante(tachinha(de), tachinha(para))
              return (
                <g key={b.id} className="quadro-barbante" onPointerDown={(e) => { if (ligando) { e.stopPropagation(); q.desligar(b.id) } }}>
                  <path d={d} className="quadro-barbante-toque" />
                  <path d={d} className="quadro-barbante-sombra" />
                  <path d={d} className="quadro-barbante-fio" />
                </g>
              )
            })}
            {origem && mouse && <path d={curvaDoBarbante(tachinha(origem), mouse)} className="quadro-barbante-fio previa" />}
          </svg>
        </div>
        {!q.pistas.length && <p className="quadro-vazio">O quadro está vazio. Prenda uma nota, uma foto ou um documento que vocês acharam.</p>}
      </div>
    </Janela>
  )
}
