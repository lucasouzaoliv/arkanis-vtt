import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBriefcase, faCamera, faFileLines, faMagnifyingGlassMinus, faMagnifyingGlassPlus, faNoteSticky, faPen, faThumbtack, faTrash, faUpload, faXmark } from '@fortawesome/free-solid-svg-icons'
import Janela from './Janela'
import { curvaDoBarbante, LARGURA_PISTA, tachinha, type Pista } from './pistas'
import type { usePistas } from './usePistas'
import type { ItemMesa } from './itens'
import { TIPO_ARRASTO_ITEM } from './PainelItens'

type Ponto = { x: number; y: number }

const ZOOM_MIN = 0.35
const ZOOM_MAX = 1.8
const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
type Gesto =
  | { tipo: 'mural'; x: number; y: number; vx: number; vy: number }
  | { tipo: 'pista'; id: string; x: number; y: number; px: number; py: number; andou: boolean }

// Quadro de pistas (KAN-117): mural de cortiça da campanha. Arrastar o fundo anda pelo mural,
// arrastar um papel muda ele de lugar; com o Barbante ligado, clica numa pista e depois na outra.
export default function QuadroDePistas({ q, itens, onAbrirDocumento, onAbrirItem, onEnviarImagem, onFechar }: {
  q: ReturnType<typeof usePistas>
  // Itens da campanha que a pessoa vê (pra mostrar o nome e a imagem atuais).
  itens: Pick<ItemMesa, 'id' | 'name' | 'image_url'>[]
  onAbrirDocumento: (documentoId: string) => void
  onAbrirItem: (itemId: string) => void
  onEnviarImagem: (f: File) => Promise<string | null>
  onFechar: () => void
}) {
  const largura = Math.min(1040, window.innerWidth - 80)
  const [vista, setVista] = useState<Ponto>({ x: 40, y: 40 })
  const [zoom, setZoom] = useState(1)
  const [soltando, setSoltando] = useState(false)
  const zoomAtual = useRef(1)
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
    return { x: (cx - r.left - vista.x) / zoom, y: (cy - r.top - vista.y) / zoom }
  }

  // Zoom mantendo parado o ponto debaixo do mouse (ou o meio do mural, pelos botões).
  const zoomEm = (novo: number, cx?: number, cy?: number) => {
    const r = muralRef.current?.getBoundingClientRect()
    if (!r) return
    const antes = zoomAtual.current
    const z = limitarZoom(novo)
    zoomAtual.current = z
    const ox = cx === undefined ? r.width / 2 : cx - r.left
    const oy = cy === undefined ? r.height / 2 : cy - r.top
    setVista((v) => ({ x: ox - ((ox - v.x) / antes) * z, y: oy - ((oy - v.y) / antes) * z }))
    setZoom(z)
  }
  const zoomRef = useRef(zoomEm)
  zoomRef.current = zoomEm
  // Rodinha do mouse: ouvinte nativo pra poder impedir a página de rolar.
  useEffect(() => {
    const el = muralRef.current
    if (!el) return
    const rodar = (e: WheelEvent) => {
      e.preventDefault()
      zoomRef.current(zoomAtual.current * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', rodar, { passive: false })
    return () => el.removeEventListener('wheel', rodar)
  }, [])
  // Pista nova: no meio do que está aparecendo, um pouco espalhada.
  const meio = (): Ponto => {
    const r = muralRef.current!.getBoundingClientRect()
    return { x: Math.round((r.width / 2 - vista.x) / zoom - 85 + (Math.random() - 0.5) * 120), y: Math.round((r.height / 2 - vista.y) / zoom - 80 + (Math.random() - 0.5) * 80) }
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
      if (g.andou) q.alterar(g.id, { x: Math.round(g.px + dx / zoom), y: Math.round(g.py + dy / zoom) }, false)
    }
  }

  function soltar(e: React.PointerEvent) {
    const g = gesto.current
    gesto.current = null
    arrastou.current = g?.tipo === 'pista' && g.andou
    if (g?.tipo === 'pista' && g.andou) q.alterar(g.id, { x: Math.round(g.px + (e.clientX - g.x) / zoom), y: Math.round(g.py + (e.clientY - g.y) / zoom) })
  }

  // Item arrastado da aba Itens: prende onde soltou (se já estava no quadro, o papel vem pra cá).
  function soltarItem(e: React.DragEvent) {
    setSoltando(false)
    const id = e.dataTransfer.getData(TIPO_ARRASTO_ITEM)
    if (!id) return
    e.preventDefault()
    const p = noMural(e.clientX, e.clientY)
    const pos = { x: Math.round(p.x - LARGURA_PISTA.item / 2), y: Math.round(p.y - 20) }
    const ja = q.pistas.find((x) => x.item_id === id)
    if (ja) return q.alterar(ja.id, pos)
    const i = itens.find((x) => x.id === id)
    q.criar({ tipo: 'item', item_id: id, texto: i?.name ?? '', imagem_url: i?.image_url ?? null, ...pos })
  }

  const porId = new Map(q.pistas.map((p) => [p.id, p]))
  const itemPorId = new Map(itens.map((i) => [i.id, i]))
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
        <span className="quadro-zoom">
          <button type="button" className="janela-botao" title="Afastar" onClick={() => zoomEm(zoom / 1.25)} disabled={zoom <= ZOOM_MIN}><FontAwesomeIcon icon={faMagnifyingGlassMinus} /></button>
          <button type="button" className="janela-botao quadro-zoom-valor" title="Voltar pra 100%" onClick={() => zoomEm(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="janela-botao" title="Aproximar" onClick={() => zoomEm(zoom * 1.25)} disabled={zoom >= ZOOM_MAX}><FontAwesomeIcon icon={faMagnifyingGlassPlus} /></button>
        </span>
        <span className="quadro-dica">
          {ligando
            ? primeira ? 'Agora clique na outra pista.' : 'Clique numa pista e depois em outra pra ligar. Clique num barbante pra cortar.'
            : 'Arraste o fundo pra andar, rodinha do mouse pra zoom. Arraste um item da aba Itens pra cá pra prender.'}
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
        className={`quadro${ligando ? ' ligando' : ''}${soltando ? ' soltando' : ''}`}
        style={{ backgroundPosition: `${vista.x}px ${vista.y}px`, backgroundSize: [7, 11, 17].map((t) => `${t * zoom}px ${t * zoom}px`).join(', ') }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes(TIPO_ARRASTO_ITEM)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setSoltando(true) } }}
        onDragLeave={() => setSoltando(false)}
        onDrop={soltarItem}
        onPointerDown={apertarMural}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={() => (gesto.current = null)}
      >
        <div className="quadro-mundo" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
          {q.pistas.map((p) => (
            <div
              key={p.id}
              className={`pista pista-${p.tipo}${primeira === p.id ? ' escolhida' : ''}`}
              style={{ left: p.x, top: p.y, width: LARGURA_PISTA[p.tipo], transform: `rotate(${p.rotacao}deg)` }}
              onPointerDown={(e) => apertarPista(e, p)}
              onDoubleClick={() => { if (!ligando && p.tipo !== 'documento' && p.tipo !== 'item') setEditando(p.id) }}
            >
              <span className="pista-tachinha" aria-hidden />
              {p.tipo === 'foto' && p.imagem_url && <img src={p.imagem_url} alt="" draggable={false} />}
              {p.tipo === 'documento' && (
                <button type="button" className="pista-doc-abrir" onClick={() => { if (!ligando && !arrastou.current && p.documento_id) onAbrirDocumento(p.documento_id) }} title="Ler o documento">
                  <FontAwesomeIcon icon={faFileLines} />
                  <span>{p.texto || 'Documento'}</span>
                </button>
              )}
              {p.tipo === 'item' && (() => {
                const it = p.item_id ? itemPorId.get(p.item_id) : undefined
                const img = it ? it.image_url : p.imagem_url
                return (
                  <button type="button" className="pista-item-abrir" onClick={() => { if (!ligando && !arrastou.current && p.item_id) onAbrirItem(p.item_id) }} title="Ver o item">
                    <span className="pista-item-imagem">{img ? <img src={img} alt="" draggable={false} /> : <FontAwesomeIcon icon={faBriefcase} />}</span>
                    <span>{it?.name || p.texto || 'Item'}</span>
                  </button>
                )
              })()}
              {p.tipo !== 'documento' && p.tipo !== 'item' && (editando === p.id ? (
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
                  {p.tipo !== 'documento' && p.tipo !== 'item' && <button type="button" title="Escrever" onClick={() => setEditando(p.id)}><FontAwesomeIcon icon={faPen} /></button>}
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
        {!q.pistas.length && <p className="quadro-vazio">O quadro está vazio. Prenda uma nota, uma foto ou arraste um item da aba Itens pra cá.</p>}
      </div>
    </Janela>
  )
}
