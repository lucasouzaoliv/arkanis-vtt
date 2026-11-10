import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBriefcase, faCamera, faCheck, faDroplet, faEraser, faFileLines, faFont, faHandPointer, faHighlighter, faLightbulb, faMagnifyingGlass,
  faMagnifyingGlassMinus, faMagnifyingGlassPlus, faPen, faRotateLeft, faScissors, faShuffle, faThumbtack, faTrash, faUpload, faXmark,
} from '@fortawesome/free-solid-svg-icons'
import Janela from './Janela'
import {
  arrumarTraco, caminhoDoTraco, CORES_DO_MARCADOR, CORES_UV, curvaDoBarbante, distanciaAoTraco, FONTES_UV, formaDoPingo, GROSSURAS, LARGURA_MAX, LARGURA_MIN,
  LARGURA_PISTA, larguraDa, noPapel, PAPEIS, papelDa, PINO_Y, tachinha, type Marca, type Papel, type Pista, type Ponto2, type Uv, type UvItem,
} from './pistas'
import type { usePistas } from './usePistas'
import type { ItemMesa } from './itens'
import { TIPO_ARRASTO_ITEM } from './PainelItens'

type Ponto = { x: number; y: number }
type Ferramenta = 'mover' | 'ligar' | 'escrever' | 'marcador' | 'lupa' | 'uv'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 3
const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
const CORTICA = [7, 11, 17]
type Gesto =
  | { tipo: 'mural'; x: number; y: number; vx: number; vy: number; andou: boolean; editava: boolean }
  | { tipo: 'pista'; id: string; x: number; y: number; px: number; py: number; andou: boolean }
  | { tipo: 'tamanho'; id: string; largura: number | null }
  | { tipo: 'traco'; id: string }
  // marcas: o que sobrou até agora (null = ainda não apagou nada).
  | { tipo: 'borracha'; id: string; marcas: Marca[] | null }

const corUv = (id: string) => CORES_UV.find((c) => c.id === id)?.cor ?? CORES_UV[1].cor
const fonteUv = (id: string) => FONTES_UV.find((f) => f.id === id)?.familia ?? FONTES_UV[0].familia

// Um escrito ou uma mancha de tinta UV, em cima de um papel de largura w.
function ItemUv({ i, w, selecionado, onPointerDown }: { i: UvItem; w: number; selecionado?: boolean; onPointerDown?: (e: React.PointerEvent) => void }) {
  const classe = `uv-item${selecionado ? ' selecionado' : ''}${i.cor === 'escura' ? ' escura' : ''}`
  if (i.tipo === 'pingo') {
    const f = formaDoPingo(i.semente)
    return (
      <svg
        className={`${classe} uv-pingo`}
        viewBox="-1.4 -1.4 2.8 3.6"
        style={{ left: (i.x - 1.4 * i.tam) * w, top: (i.y - 1.4 * i.tam) * w, width: 2.8 * i.tam * w, height: 3.6 * i.tam * w, color: corUv(i.cor) }}
        onPointerDown={onPointerDown}
      >
        {f.escorridos.map((e, n) => <line key={`e${n}`} x1={e.x} y1={e.y1} x2={e.x} y2={e.y2} stroke="currentColor" strokeWidth={e.l} strokeLinecap="round" />)}
        {f.bolhas.map((b, n) => <circle key={n} cx={b.cx} cy={b.cy} r={b.r} fill="currentColor" />)}
      </svg>
    )
  }
  return (
    <span
      className={`${classe} uv-texto`}
      style={{ left: i.x * w, top: i.y * w, fontSize: Math.max(4, i.tamanho * w), fontFamily: fonteUv(i.fonte), color: corUv(i.cor), transform: `rotate(${i.rot}deg)` }}
      onPointerDown={onPointerDown}
    >
      {i.texto || (onPointerDown ? 'Escreva…' : '')}
    </span>
  )
}

// A tinta UV de um papel. acesa: debaixo da luz; fantasma: o mestre vê apagadinha fora da luz;
// rastro: só as manchas, bem fracas, pra quem não é o mestre desconfiar.
function TintaUv({ uv, w, modo }: { uv: Uv | null; w: number; modo: 'acesa' | 'fantasma' | 'rastro' }) {
  if (!uv) return null
  const itens = modo === 'rastro' ? uv.itens.filter((i) => i.tipo === 'pingo') : uv.itens
  if (!itens.length) return null
  return <div className={`pista-uv ${modo}`} aria-hidden>{itens.map((i) => <ItemUv key={i.id} i={i} w={w} />)}</div>
}

function Marcas({ marcas, w, andamento }: { marcas: Marca[]; w: number; andamento?: Marca | null }) {
  if (!marcas.length && !andamento) return null
  return (
    <svg className="pista-marcas" aria-hidden>
      {[...marcas, ...(andamento ? [andamento] : [])].map((m) => (
        <path key={m.id} d={caminhoDoTraco(m.pontos, w)} stroke={m.cor} strokeWidth={m.grossura * w} />
      ))}
    </svg>
  )
}

// Escrever com UV (só o mestre): o papel ampliado, já debaixo da luz. Clica pra pôr um escrito
// ou uma mancha, arrasta pra mudar de lugar e escolhe letra, tamanho e cor.
function EditorUv({ p, classe, corpo, onSalvar, onFechar }: {
  p: Pista
  classe: string
  corpo: (w: number) => ReactNode
  onSalvar: (uv: Uv | null) => void
  onFechar: () => void
}) {
  const W = Math.min(560, Math.max(260, window.innerWidth - 420))
  const [itens, setItens] = useState<UvItem[]>(p.uv?.itens ?? [])
  const [rastro, setRastro] = useState(p.uv?.rastro ?? false)
  const [modo, setModo] = useState<'texto' | 'pingo'>('texto')
  const [sel, setSel] = useState<string | null>(null)
  const folha = useRef<HTMLDivElement>(null)
  const arrasto = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const ultimo = useRef({ fonte: 'manuscrita', tamanho: 0.08, cor: 'branca', corPingo: 'lilas' })
  const escolhido = itens.find((i) => i.id === sel)

  const ponto = (e: React.PointerEvent): Ponto2 => {
    const r = folha.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / W, (e.clientY - r.top) / W]
  }
  const mudar = (id: string, campos: Partial<UvItem>) => setItens((l) => l.map((i) => (i.id === id ? ({ ...i, ...campos } as UvItem) : i)))

  function apertarFolha(e: React.PointerEvent) {
    if (e.button !== 0 || (e.target as Element).closest('.uv-item')) return
    // Escrito que ficou vazio some quando se começa outro.
    const [x, y] = ponto(e)
    const id = crypto.randomUUID()
    const u = ultimo.current
    const novo: UvItem = modo === 'pingo'
      ? { id, tipo: 'pingo', x, y, tam: 0.1, semente: Math.floor(Math.random() * 1e9) + 1, cor: u.corPingo }
      : { id, tipo: 'texto', x, y: y - u.tamanho / 2, texto: '', fonte: u.fonte, tamanho: u.tamanho, cor: u.cor, rot: 0 }
    setItens((l) => [...l.filter((i) => i.tipo !== 'texto' || i.texto.trim()), novo])
    setSel(id)
  }

  function apertarItem(e: React.PointerEvent, i: UvItem) {
    if (e.button !== 0) return
    e.stopPropagation()
    const [x, y] = ponto(e)
    setSel(i.id)
    arrasto.current = { id: i.id, dx: x - i.x, dy: y - i.y }
    folha.current?.setPointerCapture(e.pointerId)
  }

  function mover(e: React.PointerEvent) {
    const a = arrasto.current
    if (!a) return
    const [x, y] = ponto(e)
    mudar(a.id, { x: x - a.dx, y: y - a.dy })
  }

  function salvar() {
    const bons = itens.filter((i) => i.tipo === 'pingo' || i.texto.trim())
    onSalvar(bons.length ? { itens: bons, rastro } : null)
  }

  return (
    <div className="quadro-uv-editor" role="dialog" aria-label="Escrever com tinta UV">
      <div className="quadro-uv-papel">
        <div
          ref={folha}
          className={`${classe} sob-uv uv-folha modo-${modo}`}
          style={{ width: W }}
          onPointerDown={apertarFolha}
          onPointerMove={mover}
          onPointerUp={() => (arrasto.current = null)}
          onPointerCancel={() => (arrasto.current = null)}
        >
          {corpo(W)}
          <div className="pista-uv acesa editavel">
            {itens.map((i) => <ItemUv key={i.id} i={i} w={W} selecionado={i.id === sel} onPointerDown={(e) => apertarItem(e, i)} />)}
          </div>
        </div>
      </div>
      <div className="quadro-uv-painel">
        <h4><FontAwesomeIcon icon={faLightbulb} /> Tinta UV</h4>
        <p className="janela-dica">Só você vê isto. Os jogadores só enxergam passando a Luz UV por cima do papel.</p>
        <div className="quadro-uv-linha">
          <button type="button" className={`janela-botao${modo === 'texto' ? ' ativo' : ''}`} aria-pressed={modo === 'texto'} onClick={() => setModo('texto')}><FontAwesomeIcon icon={faFont} /> Escrito</button>
          <button type="button" className={`janela-botao${modo === 'pingo' ? ' ativo' : ''}`} aria-pressed={modo === 'pingo'} onClick={() => setModo('pingo')}><FontAwesomeIcon icon={faDroplet} /> Mancha</button>
        </div>
        <p className="janela-dica">{modo === 'texto' ? 'Clique no papel onde o escrito começa.' : 'Clique no papel pra pingar tinta.'} Arraste pra mudar de lugar.</p>

        {escolhido?.tipo === 'texto' && (
          <>
            <textarea
              key={escolhido.id}
              autoFocus
              className="quadro-uv-texto"
              value={escolhido.texto}
              placeholder="O que está escrito com tinta UV…"
              onChange={(e) => mudar(escolhido.id, { texto: e.target.value })}
            />
            <div className="quadro-uv-linha">
              {FONTES_UV.map((f) => (
                <button key={f.id} type="button" className={`janela-botao${escolhido.fonte === f.id ? ' ativo' : ''}`} style={{ fontFamily: f.familia }} onClick={() => { ultimo.current.fonte = f.id; mudar(escolhido.id, { fonte: f.id }) }}>{f.id === 'sigilos' ? 'abc' : f.nome}</button>
              ))}
            </div>
            <div className="quadro-uv-linha">
              <span>Tamanho</span>
              <button type="button" className="janela-botao" aria-label="Menor" onClick={() => { const t = Math.max(0.02, escolhido.tamanho / 1.15); ultimo.current.tamanho = t; mudar(escolhido.id, { tamanho: t }) }}>−</button>
              <button type="button" className="janela-botao" aria-label="Maior" onClick={() => { const t = Math.min(0.5, escolhido.tamanho * 1.15); ultimo.current.tamanho = t; mudar(escolhido.id, { tamanho: t }) }}>+</button>
              <span>Girar</span>
              <button type="button" className="janela-botao" aria-label="Girar pra esquerda" onClick={() => mudar(escolhido.id, { rot: escolhido.rot - 5 })}>↺</button>
              <button type="button" className="janela-botao" aria-label="Girar pra direita" onClick={() => mudar(escolhido.id, { rot: escolhido.rot + 5 })}>↻</button>
            </div>
          </>
        )}
        {escolhido?.tipo === 'pingo' && (
          <div className="quadro-uv-linha">
            <span>Tamanho</span>
            <button type="button" className="janela-botao" aria-label="Menor" onClick={() => mudar(escolhido.id, { tam: Math.max(0.02, escolhido.tam / 1.2) })}>−</button>
            <button type="button" className="janela-botao" aria-label="Maior" onClick={() => mudar(escolhido.id, { tam: Math.min(0.6, escolhido.tam * 1.2) })}>+</button>
            <button type="button" className="janela-botao" onClick={() => mudar(escolhido.id, { semente: Math.floor(Math.random() * 1e9) + 1 })}><FontAwesomeIcon icon={faShuffle} /> Outra forma</button>
          </div>
        )}
        {escolhido && (
          <div className="quadro-uv-linha">
            <span>Cor</span>
            {CORES_UV.map((c) => (
              <button
                key={c.id} type="button" title={c.nome} aria-label={c.nome}
                className={`quadro-amostra${escolhido.cor === c.id ? ' ativa' : ''}`} style={{ background: c.cor }}
                onClick={() => { if (escolhido.tipo === 'texto') ultimo.current.cor = c.id; else ultimo.current.corPingo = c.id; mudar(escolhido.id, { cor: c.id }) }}
              />
            ))}
            <button type="button" className="janela-botao" onClick={() => { setItens((l) => l.filter((i) => i.id !== escolhido.id)); setSel(null) }}><FontAwesomeIcon icon={faTrash} /> Apagar</button>
          </div>
        )}

        <label className="quadro-uv-rastro">
          <input type="checkbox" checked={rastro} onChange={(e) => setRastro(e.target.checked)} />
          <span>Deixar as manchas aparecendo bem fraquinhas sem a luz (dica de que tem algo ali)</span>
        </label>
        <div className="quadro-uv-linha fim">
          {itens.length > 0 && <button type="button" className="janela-botao" onClick={() => { setItens([]); setSel(null) }}>Limpar tudo</button>}
          <button type="button" className="janela-botao" onClick={onFechar}>Cancelar</button>
          <button type="button" className="janela-botao janela-botao-destaque" onClick={salvar}><FontAwesomeIcon icon={faCheck} /> Salvar</button>
        </div>
      </div>
    </div>
  )
}

// Quadro de pistas (KAN-117, aprimorado em 10/11): mural de cortiça da campanha. Ferramentas
// embaixo: Mover, Ligar (barbante), Escrever (notas), Marcador (grifar), Lupa e Luz UV.
export default function QuadroDePistas({ q, itens, souMestre, onAbrirDocumento, onAbrirItem, onEnviarImagem, onFechar }: {
  q: ReturnType<typeof usePistas>
  // Itens da campanha que a pessoa vê (pra mostrar o nome e a imagem atuais).
  itens: Pick<ItemMesa, 'id' | 'name' | 'image_url'>[]
  souMestre: boolean
  onAbrirDocumento: (documentoId: string) => void
  onAbrirItem: (itemId: string) => void
  onEnviarImagem: (f: File) => Promise<string | null>
  onFechar: () => void
}) {
  const largura = Math.min(1200, window.innerWidth - 80)
  const [vista, setVista] = useState<Ponto>({ x: 40, y: 40 })
  const [zoom, setZoom] = useState(1)
  const [soltando, setSoltando] = useState(false)
  const zoomAtual = useRef(1)
  const [ferramenta, setFerramenta] = useState<Ferramenta>('mover')
  const ligando = ferramenta === 'ligar'
  const [primeira, setPrimeira] = useState<string | null>(null)
  // Mouse dentro do mural (px da tela), pra prévia do barbante, lupa e luz UV.
  const [mouse, setMouse] = useState<(Ponto & { forte: boolean }) | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [novaFoto, setNovaFoto] = useState<{ url: string; legenda: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [papel, setPapel] = useState<Papel>('caderno')
  const [corMarca, setCorMarca] = useState(CORES_DO_MARCADOR[0])
  const [grossura, setGrossura] = useState<keyof typeof GROSSURAS>('grosso')
  const [borracha, setBorracha] = useState(false)
  const [traco, setTraco] = useState<{ id: string; marca: Marca } | null>(null)
  const [menu, setMenu] = useState<(Ponto & { id: string }) | null>(null)
  const [uvEditando, setUvEditando] = useState<string | null>(null)
  const muralRef = useRef<HTMLDivElement>(null)
  const gesto = useRef<Gesto | null>(null)
  const pontosDoTraco = useRef<Ponto2[]>([])
  // Grifos feitos por mim nesta sessão, pra Desfazer.
  const feitos = useRef<{ pista: string; marca: string }[]>([])
  // Acabou de arrastar o papel: o clique que vem junto não abre o documento.
  const arrastou = useRef(false)

  // ---- Balanço: o papel pendurado na tachinha vai pra um lado e pro outro quando mexe. ----
  const els = useRef(new Map<string, HTMLDivElement>())
  const balanco = useRef(new Map<string, { ang: number; vel: number; alvo: number }>())
  const quadro = useRef(0)
  const instante = useRef(0)
  const semMovimento = useRef(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  function passo(agora: number) {
    const dt = Math.min(0.033, (agora - instante.current) / 1000)
    instante.current = agora
    for (const [id, b] of balanco.current) {
      b.vel += (-90 * (b.ang - b.alvo) - 6 * b.vel) * dt
      b.ang += b.vel * dt
      b.alvo *= 0.85
      const el = els.current.get(id)
      if (Math.abs(b.ang) < 0.03 && Math.abs(b.vel) < 0.3 && Math.abs(b.alvo) < 0.03) {
        balanco.current.delete(id)
        el?.style.removeProperty('--balanco')
      } else el?.style.setProperty('--balanco', `${b.ang.toFixed(2)}deg`)
    }
    quadro.current = balanco.current.size ? requestAnimationFrame(passo) : 0
  }
  function empurrar(id: string, forca: number) {
    if (semMovimento.current) return
    const b = balanco.current.get(id) ?? { ang: 0, vel: 0, alvo: 0 }
    b.alvo = Math.max(-16, Math.min(16, b.alvo * 0.5 + forca))
    balanco.current.set(id, b)
    if (!quadro.current) {
      instante.current = performance.now()
      quadro.current = requestAnimationFrame(passo)
    }
  }
  useEffect(() => () => cancelAnimationFrame(quadro.current), [])

  // Caixa de dentro do mural (sem a moldura de madeira).
  const caixa = () => {
    const el = muralRef.current!
    const r = el.getBoundingClientRect()
    return { left: r.left + el.clientLeft, top: r.top + el.clientTop, width: el.clientWidth, height: el.clientHeight }
  }
  const noMural = (cx: number, cy: number): Ponto => {
    const r = caixa()
    return { x: (cx - r.left - vista.x) / zoom, y: (cy - r.top - vista.y) / zoom }
  }

  // Zoom mantendo parado o ponto debaixo do mouse (ou o meio do mural, pelos botões).
  const zoomEm = (novo: number, cx?: number, cy?: number) => {
    if (!muralRef.current) return
    const r = caixa()
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
  // Esc: fecha menu, larga o barbante e volta pro Mover.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as Element).closest?.('textarea, input')) return
      setMenu(null)
      setPrimeira(null)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  // Pista nova: no meio do que está aparecendo, um pouco espalhada.
  const meio = (w: number): Ponto => {
    const r = caixa()
    return { x: Math.round((r.width / 2 - vista.x) / zoom - w / 2 + (Math.random() - 0.5) * 120), y: Math.round((r.height / 2 - vista.y) / zoom - 80 + (Math.random() - 0.5) * 80) }
  }

  const porId = new Map(q.pistas.map((p) => [p.id, p]))
  const itemPorId = new Map(itens.map((i) => [i.id, i]))

  function trocarFerramenta(f: Ferramenta) {
    setFerramenta(f)
    setPrimeira(null)
    setMenu(null)
    setEditando(null)
    if (f !== 'lupa' && f !== 'uv') setMouse(null)
  }

  function apertarMural(e: React.PointerEvent<HTMLDivElement>) {
    setMenu(null)
    if (e.button !== 0) return
    const emPapel = (e.target as Element).closest('.pista, .quadro-barbante')
    if (emPapel && ferramenta !== 'lupa' && ferramenta !== 'uv') return
    setPrimeira(null)
    gesto.current = { tipo: 'mural', x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, andou: false, editava: editando !== null }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function apertarPista(e: React.PointerEvent, p: Pista) {
    setMenu(null)
    if (e.button !== 0 || ferramenta === 'lupa' || ferramenta === 'uv') return
    if (editando === p.id) return
    if (ligando) {
      // Ligando, vale clicar em qualquer parte do papel (até no botão do documento).
      e.stopPropagation()
      if (!primeira) setPrimeira(p.id)
      else {
        if (primeira !== p.id) q.ligar(primeira, p.id)
        setPrimeira(null)
      }
      return
    }
    if (ferramenta === 'escrever') {
      if (p.tipo === 'nota') { e.preventDefault(); setEditando(p.id) }
      return
    }
    if (ferramenta === 'marcador') {
      e.stopPropagation()
      const pt = noPapel(p, noMural(e.clientX, e.clientY))
      if (borracha) {
        gesto.current = { tipo: 'borracha', id: p.id, marcas: apagarEm(p.id, p.marcas, pt) }
      } else {
        gesto.current = { tipo: 'traco', id: p.id }
        pontosDoTraco.current = [pt]
        setTraco({ id: p.id, marca: { id: 'andamento', cor: corMarca, grossura: GROSSURAS[grossura], pontos: [pt, pt] } })
      }
      muralRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if ((e.target as Element).closest('.pista-alca')) {
      e.stopPropagation()
      gesto.current = { tipo: 'tamanho', id: p.id, largura: null }
      muralRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if ((e.target as Element).closest('.pista-acoes, textarea')) return
    e.stopPropagation()
    gesto.current = { tipo: 'pista', id: p.id, x: e.clientX, y: e.clientY, px: p.x, py: p.y, andou: false }
    muralRef.current?.setPointerCapture(e.pointerId)
  }

  // Tira os grifos encostados no ponto; devolve o que sobrou (null = nenhum saiu).
  function apagarEm(id: string, marcas: Marca[], pt: Ponto2): Marca[] | null {
    const restam = marcas.filter((m) => distanciaAoTraco(m.pontos, pt) > m.grossura / 2 + 0.012)
    if (restam.length === marcas.length) return null
    q.alterar(id, { marcas: restam }, false)
    return restam
  }

  function mover(e: React.PointerEvent) {
    if (ferramenta === 'lupa' || ferramenta === 'uv' || (ligando && primeira)) {
      const r = caixa()
      setMouse({ x: e.clientX - r.left, y: e.clientY - r.top, forte: e.shiftKey })
    }
    const g = gesto.current
    if (!g) return
    if (g.tipo === 'mural') {
      const dx = e.clientX - g.x
      const dy = e.clientY - g.y
      if (Math.abs(dx) + Math.abs(dy) > 3) g.andou = true
      if (g.andou) setVista({ x: g.vx + dx, y: g.vy + dy })
      return
    }
    const p = porId.get(g.id)
    if (!p) return
    if (g.tipo === 'pista') {
      const dx = e.clientX - g.x
      const dy = e.clientY - g.y
      if (Math.abs(dx) + Math.abs(dy) > 3) g.andou = true
      if (g.andou) {
        q.alterar(g.id, { x: Math.round(g.px + dx / zoom), y: Math.round(g.py + dy / zoom) }, false)
        empurrar(g.id, e.movementX * 0.8)
      }
    } else if (g.tipo === 'tamanho') {
      const [fx] = noPapel(p, noMural(e.clientX, e.clientY))
      g.largura = Math.round(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, fx * larguraDa(p))))
      q.alterar(g.id, { largura: g.largura }, false)
    } else if (g.tipo === 'traco') {
      const pt = noPapel(p, noMural(e.clientX, e.clientY))
      const u = pontosDoTraco.current[pontosDoTraco.current.length - 1]
      if (Math.hypot(pt[0] - u[0], pt[1] - u[1]) < 0.004) return
      pontosDoTraco.current.push(pt)
      setTraco((t) => (t ? { ...t, marca: { ...t.marca, pontos: [...pontosDoTraco.current] } } : t))
    } else if (g.tipo === 'borracha') {
      g.marcas = apagarEm(p.id, g.marcas ?? p.marcas, noPapel(p, noMural(e.clientX, e.clientY))) ?? g.marcas
    }
  }

  async function soltar(e: React.PointerEvent) {
    const g = gesto.current
    gesto.current = null
    arrastou.current = g?.tipo === 'pista' && g.andou
    if (!g) return
    if (g.tipo === 'mural') {
      // Escrever: clique num espaço vazio cria a nota ali, já pronta pra escrever.
      if (ferramenta === 'escrever' && !g.andou && !g.editava) {
        const m = noMural(e.clientX, e.clientY)
        const nova = await q.criar({ tipo: 'nota', texto: '', estilo: papel, x: Math.round(m.x - LARGURA_PISTA.nota / 2), y: Math.round(m.y - PINO_Y) })
        if (nova) { setEditando(nova.id); empurrar(nova.id, 9) }
      }
      return
    }
    const p = porId.get(g.id)
    if (!p) return
    if (g.tipo === 'pista' && g.andou) q.alterar(g.id, { x: Math.round(g.px + (e.clientX - g.x) / zoom), y: Math.round(g.py + (e.clientY - g.y) / zoom) })
    else if (g.tipo === 'tamanho') { if (g.largura) q.alterar(g.id, { largura: g.largura }) }
    else if (g.tipo === 'traco') {
      const marca: Marca = { id: crypto.randomUUID(), cor: corMarca, grossura: GROSSURAS[grossura], pontos: arrumarTraco(pontosDoTraco.current) }
      setTraco(null)
      feitos.current.push({ pista: p.id, marca: marca.id })
      q.alterar(p.id, { marcas: [...p.marcas, marca] })
    } else if (g.tipo === 'borracha' && g.marcas) q.alterar(p.id, { marcas: g.marcas })
  }

  function desfazerGrifo() {
    for (let u = feitos.current.pop(); u; u = feitos.current.pop()) {
      const p = porId.get(u.pista)
      if (p?.marcas.some((m) => m.id === u.marca)) {
        q.alterar(p.id, { marcas: p.marcas.filter((m) => m.id !== u.marca) })
        return
      }
    }
  }

  // Soltou no mural: item da aba Itens (se já estava no quadro, o papel vem pra cá) ou imagens do computador.
  async function soltarNoMural(e: React.DragEvent) {
    setSoltando(false)
    const ponto = noMural(e.clientX, e.clientY)
    const id = e.dataTransfer.getData(TIPO_ARRASTO_ITEM)
    if (id) {
      e.preventDefault()
      const pos = { x: Math.round(ponto.x - LARGURA_PISTA.item / 2), y: Math.round(ponto.y - PINO_Y) }
      const ja = q.pistas.find((x) => x.item_id === id)
      if (ja) return void q.alterar(ja.id, pos)
      const i = itens.find((x) => x.id === id)
      const nova = await q.criar({ tipo: 'item', item_id: id, texto: i?.name ?? '', imagem_url: i?.image_url ?? null, ...pos })
      if (nova) empurrar(nova.id, 9)
      return
    }
    const imagens = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')).slice(0, 8)
    if (!imagens.length) return
    e.preventDefault()
    setEnviando(true)
    for (const [n, f] of imagens.entries()) {
      const url = await onEnviarImagem(f)
      if (!url) continue
      const nova = await q.criar({ tipo: 'foto', imagem_url: url, texto: '', x: Math.round(ponto.x - LARGURA_PISTA.foto / 2 + n * 40), y: Math.round(ponto.y - PINO_Y + n * 30) })
      if (nova) empurrar(nova.id, 9)
    }
    setEnviando(false)
  }

  const classeDa = (p: Pista) => {
    const img = p.tipo === 'foto' || (p.tipo === 'item' && !!(p.item_id ? itemPorId.get(p.item_id)?.image_url ?? p.imagem_url : p.imagem_url))
    return `pista pista-${p.tipo}${img ? ' pista-imagem' : ''}${p.tipo === 'nota' ? ` papel-${papelDa(p.estilo)}` : ''}`
  }

  // O que vai dentro do papel. vivo: é o papel de verdade no mural (os outros são cópias na lupa, na luz UV e no editor).
  function corpo(p: Pista, w: number, vivo: boolean): ReactNode {
    const abrir = (f: () => void) => () => { if (vivo && ferramenta === 'mover' && !arrastou.current) f() }
    if (p.tipo === 'documento') {
      return (
        <button type="button" className="pista-doc-abrir" tabIndex={vivo ? 0 : -1} onClick={abrir(() => p.documento_id && onAbrirDocumento(p.documento_id))} title="Ler o documento">
          <FontAwesomeIcon icon={faFileLines} />
          <span>{p.texto || 'Documento'}</span>
        </button>
      )
    }
    if (p.tipo === 'item') {
      const it = p.item_id ? itemPorId.get(p.item_id) : undefined
      const img = it ? it.image_url : p.imagem_url
      return (
        <button type="button" className="pista-item-abrir" tabIndex={vivo ? 0 : -1} onClick={abrir(() => p.item_id && onAbrirItem(p.item_id))} title="Ver o item">
          {img ? <img src={img} alt="" draggable={false} /> : <span className="pista-item-imagem"><FontAwesomeIcon icon={faBriefcase} /></span>}
          <span className="pista-legenda">{it?.name || p.texto || 'Item'}</span>
        </button>
      )
    }
    const escrevendo = vivo && editando === p.id
    const texto = escrevendo ? (
      <textarea
        autoFocus
        className={`pista-texto editando${p.tipo === 'foto' ? ' pista-legenda' : ''}`}
        defaultValue={p.texto}
        placeholder={p.tipo === 'foto' ? 'Legenda…' : 'Escreva a pista…'}
        onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
        onBlur={(e) => { setEditando((id) => (id === p.id ? null : id)); if (e.target.value !== p.texto) q.alterar(p.id, { texto: e.target.value }) }}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur() }}
      />
    ) : null
    if (p.tipo === 'foto') {
      return (
        <>
          {p.imagem_url && <img src={p.imagem_url} alt="" draggable={false} />}
          {texto ?? (p.texto ? <p className="pista-texto pista-legenda">{p.texto}</p> : null)}
        </>
      )
    }
    return <div className="pista-folha" style={{ fontSize: w * 0.118 }}>{texto ?? <p className="pista-texto">{p.texto || (vivo ? 'Escreva aqui…' : '')}</p>}</div>
  }

  const estiloDa = (p: Pista, w: number) => ({ left: p.x, top: p.y, width: w, transformOrigin: `50% ${PINO_Y}px`, transform: `rotate(calc(${p.rotacao}deg + var(--balanco, 0deg)))` })

  // Cópia parada dos papéis (dentro da lupa e da luz UV).
  const copias = (uv: boolean) => q.pistas.map((p) => {
    const w = larguraDa(p)
    return (
      <div key={p.id} className={`${classeDa(p)}${uv ? ' sob-uv' : ''}`} style={{ ...estiloDa(p, w), transform: `rotate(${p.rotacao}deg)` }}>
        <span className="pista-tachinha" />
        {corpo(p, w, false)}
        <Marcas marcas={p.marcas} w={w} />
        <TintaUv uv={p.uv} w={w} modo={uv ? 'acesa' : souMestre ? 'fantasma' : 'rastro'} />
      </div>
    )
  })

  const barbantes = (vivo: boolean) => (
    <svg className="quadro-barbantes" aria-hidden={!ligando}>
      {q.barbantes.map((b) => {
        const de = porId.get(b.de)
        const para = porId.get(b.para)
        if (!de || !para) return null
        const d = curvaDoBarbante(tachinha(de), tachinha(para))
        return (
          <g key={b.id} className="quadro-barbante" onPointerDown={vivo ? (e) => { if (ligando) { e.stopPropagation(); q.desligar(b.id) } } : undefined}>
            {vivo && <path d={d} className="quadro-barbante-toque" />}
            <path d={d} className="quadro-barbante-sombra" />
            <path d={d} className="quadro-barbante-fio" />
            <path d={d} className="quadro-barbante-trama" />
          </g>
        )
      })}
      {vivo && primeira && mouse && porId.get(primeira) && (() => {
        const d = curvaDoBarbante(tachinha(porId.get(primeira)!), { x: (mouse.x - vista.x) / zoom, y: (mouse.y - vista.y) / zoom })
        return <g className="quadro-barbante previa"><path d={d} className="quadro-barbante-fio" /><path d={d} className="quadro-barbante-trama" /></g>
      })()}
    </svg>
  )

  const lente = mouse && (ferramenta === 'lupa' || ferramenta === 'uv') ? (() => {
    const uv = ferramenta === 'uv'
    const k = uv ? 1 : mouse.forte ? 3.6 : 2.2
    const D = uv ? 260 : 230
    const tx = D / 2 + k * (vista.x - mouse.x)
    const ty = D / 2 + k * (vista.y - mouse.y)
    return (
      <div
        className={`quadro-lente ${ferramenta}`}
        style={{ left: mouse.x - D / 2, top: mouse.y - D / 2, width: D, height: D, backgroundPosition: `${tx}px ${ty}px`, backgroundSize: CORTICA.map((t) => `${t * zoom * k}px ${t * zoom * k}px`).join(', ') }}
        aria-hidden
      >
        <div className="quadro-mundo" style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom * k})`, transformOrigin: '0 0' }}>
          {copias(uv)}
          {barbantes(false)}
        </div>
      </div>
    )
  })() : null

  const dica = ferramenta === 'ligar'
    ? primeira ? 'Agora clique na outra pista.' : 'Clique numa pista e depois em outra pra ligar · clique num barbante pra cortar'
    : ferramenta === 'escrever' ? 'Escolha o papel ou post-it · clique num espaço vazio pra criar · clique num escrito pra editar'
    : ferramenta === 'marcador' ? (borracha ? 'Passe a borracha por cima de um grifo pra apagar' : 'Arraste sobre um papel pra grifar · grifar de novo por cima deixa mais forte')
    : ferramenta === 'lupa' ? 'Passe a lupa por cima do mural · segure Shift pra aumentar mais'
    : ferramenta === 'uv' ? 'Passe a luz UV por cima dos papéis pra ver o que está escondido'
    : `Arraste o fundo pra andar e os papéis pra mudar de lugar · rodinha dá zoom · solte imagens aqui pra prender${souMestre ? ' · botão direito num papel: Escrever com UV' : ''}`

  const FERRAMENTAS: { id: Ferramenta; rotulo: string; icone?: typeof faPen }[] = [
    { id: 'mover', rotulo: 'Mover', icone: faHandPointer },
    { id: 'ligar', rotulo: 'Ligar' },
    { id: 'escrever', rotulo: 'Escrever', icone: faPen },
    { id: 'marcador', rotulo: 'Marcador', icone: faHighlighter },
    { id: 'lupa', rotulo: 'Lupa', icone: faMagnifyingGlass },
    { id: 'uv', rotulo: 'Luz UV', icone: faLightbulb },
  ]
  const pistaDoMenu = menu ? porId.get(menu.id) : undefined
  const pistaUv = uvEditando ? porId.get(uvEditando) : undefined

  return (
    <Janela titulo="Quadro de Pistas" icone={faThumbtack} largura={largura} onFechar={onFechar} className="quadro-janela">
      <div className="quadro-barra">
        <button type="button" className="janela-botao" onClick={() => setNovaFoto({ url: '', legenda: '' })}>
          <FontAwesomeIcon icon={faCamera} /> Foto
        </button>
        <span className="quadro-zoom">
          <button type="button" className="janela-botao" title="Afastar" onClick={() => zoomEm(zoom / 1.25)} disabled={zoom <= ZOOM_MIN}><FontAwesomeIcon icon={faMagnifyingGlassMinus} /></button>
          <button type="button" className="janela-botao quadro-zoom-valor" title="Voltar pra 100%" onClick={() => zoomEm(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="janela-botao" title="Aproximar" onClick={() => zoomEm(zoom * 1.25)} disabled={zoom >= ZOOM_MAX}><FontAwesomeIcon icon={faMagnifyingGlassPlus} /></button>
        </span>
        {enviando && <span className="quadro-dica">Enviando imagem…</span>}
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
          <button type="button" className="janela-botao janela-botao-destaque" disabled={!novaFoto.url.trim()} onClick={() => { q.criar({ tipo: 'foto', imagem_url: novaFoto.url.trim(), texto: novaFoto.legenda, ...meio(LARGURA_PISTA.foto) }).then((n) => n && empurrar(n.id, 9)); setNovaFoto(null) }}>
            Prender
          </button>
          <button type="button" className="janela-botao" title="Cancelar" onClick={() => setNovaFoto(null)}><FontAwesomeIcon icon={faXmark} /></button>
        </div>
      )}
      <div className="quadro-area">
        <div
          ref={muralRef}
          className={`quadro ferramenta-${ferramenta}${ligando ? ' ligando' : ''}${borracha && ferramenta === 'marcador' ? ' borracha' : ''}${soltando ? ' soltando' : ''}`}
          style={{ backgroundPosition: `${vista.x}px ${vista.y}px`, backgroundSize: CORTICA.map((t) => `${t * zoom}px ${t * zoom}px`).join(', ') }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes(TIPO_ARRASTO_ITEM) || e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setSoltando(true) } }}
          onDragLeave={() => setSoltando(false)}
          onDrop={soltarNoMural}
          onPointerDown={apertarMural}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={() => { gesto.current = null; setTraco(null) }}
          onPointerLeave={() => { if (!gesto.current && (ferramenta === 'lupa' || ferramenta === 'uv')) setMouse(null) }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="quadro-mundo" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            {q.pistas.map((p) => {
              const w = larguraDa(p)
              return (
                <div
                  key={p.id}
                  ref={(el) => { if (el) els.current.set(p.id, el); else els.current.delete(p.id) }}
                  className={`${classeDa(p)}${primeira === p.id ? ' escolhida' : ''}${editando === p.id ? ' escrevendo' : ''}`}
                  style={estiloDa(p, w)}
                  onPointerDown={(e) => apertarPista(e, p)}
                  onDoubleClick={() => { if (ferramenta === 'mover' && (p.tipo === 'nota' || p.tipo === 'foto')) setEditando(p.id) }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const r = caixa()
                    setMenu({ id: p.id, x: Math.min(e.clientX - r.left, r.width - 210), y: Math.min(e.clientY - r.top, r.height - 150) })
                  }}
                >
                  <span className="pista-tachinha" aria-hidden />
                  {corpo(p, w, true)}
                  <Marcas marcas={p.marcas} w={w} andamento={traco?.id === p.id ? traco.marca : null} />
                  <TintaUv uv={p.uv} w={w} modo={souMestre ? 'fantasma' : 'rastro'} />
                  {ferramenta === 'mover' && editando !== p.id && (
                    <>
                      <span className="pista-acoes" style={{ transform: `rotate(${-p.rotacao}deg)` }}>
                        {(p.tipo === 'nota' || p.tipo === 'foto') && <button type="button" title={p.tipo === 'foto' ? 'Legenda' : 'Escrever'} onClick={() => setEditando(p.id)}><FontAwesomeIcon icon={faPen} /></button>}
                        {souMestre && <button type="button" title="Escrever com UV" onClick={() => setUvEditando(p.id)}><FontAwesomeIcon icon={faLightbulb} /></button>}
                        <button type="button" title="Tirar do quadro" onClick={() => q.excluir(p.id)}><FontAwesomeIcon icon={faTrash} /></button>
                      </span>
                      <span className="pista-alca" title="Arraste pra mudar o tamanho" aria-hidden />
                    </>
                  )}
                </div>
              )
            })}
            {/* Barbantes por cima dos papéis, presos nas tachinhas. */}
            {barbantes(true)}
          </div>
          {lente}
          {!q.pistas.length && <p className="quadro-vazio">O quadro está vazio. Escolha Escrever pra pôr uma nota, solte uma imagem aqui ou arraste um item da aba Itens.</p>}
          {menu && pistaDoMenu && (
            <ul className="quadro-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
              {(pistaDoMenu.tipo === 'nota' || pistaDoMenu.tipo === 'foto') && (
                <li><button type="button" onClick={() => { trocarFerramenta('mover'); setEditando(menu.id) }}><FontAwesomeIcon icon={faPen} /> {pistaDoMenu.tipo === 'foto' ? 'Legenda' : 'Escrever'}</button></li>
              )}
              {souMestre && <li><button type="button" onClick={() => { setUvEditando(menu.id); setMenu(null) }}><FontAwesomeIcon icon={faLightbulb} /> Escrever com UV</button></li>}
              {pistaDoMenu.marcas.length > 0 && <li><button type="button" onClick={() => { q.alterar(menu.id, { marcas: [] }); setMenu(null) }}><FontAwesomeIcon icon={faEraser} /> Apagar os grifos</button></li>}
              {q.barbantes.some((b) => b.de === menu.id || b.para === menu.id) && (
                <li><button type="button" onClick={() => { q.barbantes.filter((b) => b.de === menu.id || b.para === menu.id).forEach((b) => q.desligar(b.id)); setMenu(null) }}><FontAwesomeIcon icon={faScissors} /> Cortar os barbantes</button></li>
              )}
              {pistaDoMenu.largura != null && <li><button type="button" onClick={() => { q.alterar(menu.id, { largura: null }); setMenu(null) }}><FontAwesomeIcon icon={faRotateLeft} /> Tamanho normal</button></li>}
              <li><button type="button" className="perigo" onClick={() => { q.excluir(menu.id); setMenu(null) }}><FontAwesomeIcon icon={faTrash} /> Tirar do quadro</button></li>
            </ul>
          )}
        </div>

        <div className="quadro-ferramentas">
          <p className="quadro-dica">{dica}</p>
          {ferramenta === 'escrever' && (
            <div className="quadro-opcoes" role="group" aria-label="Papel da nota">
              {PAPEIS.map((pp) => (
                <button
                  key={pp.id} type="button" title={pp.nome} aria-label={pp.nome} aria-pressed={papel === pp.id}
                  className={`quadro-amostra papel-${pp.id}${papel === pp.id ? ' ativa' : ''}`}
                  // Sem tirar o foco da nota que está sendo escrita: ela troca de papel na hora.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setPapel(pp.id); if (editando && porId.get(editando)?.tipo === 'nota') q.alterar(editando, { estilo: pp.id }) }}
                />
              ))}
              <span className="quadro-opcoes-nome">{PAPEIS.find((pp) => pp.id === papel)?.nome}</span>
            </div>
          )}
          {ferramenta === 'marcador' && (
            <div className="quadro-opcoes" role="group" aria-label="Marcador">
              {CORES_DO_MARCADOR.map((c) => (
                <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={!borracha && corMarca === c} className={`quadro-amostra redonda${!borracha && corMarca === c ? ' ativa' : ''}`} style={{ background: c }} onClick={() => { setCorMarca(c); setBorracha(false) }} />
              ))}
              <button type="button" className={`quadro-opcao${!borracha && grossura === 'fino' ? ' ativa' : ''}`} onClick={() => { setGrossura('fino'); setBorracha(false) }}>Fino</button>
              <button type="button" className={`quadro-opcao${!borracha && grossura === 'grosso' ? ' ativa' : ''}`} onClick={() => { setGrossura('grosso'); setBorracha(false) }}>Grosso</button>
              <button type="button" className={`quadro-opcao${borracha ? ' ativa' : ''}`} aria-pressed={borracha} onClick={() => setBorracha((v) => !v)}><FontAwesomeIcon icon={faEraser} /> Borracha</button>
              <button type="button" className="quadro-opcao" onClick={desfazerGrifo}><FontAwesomeIcon icon={faRotateLeft} /> Desfazer</button>
            </div>
          )}
          <div className="quadro-opcoes principal" role="toolbar" aria-label="Ferramentas do quadro">
            {FERRAMENTAS.map((f) => (
              <button key={f.id} type="button" className={`quadro-opcao${ferramenta === f.id ? ' ativa' : ''}`} aria-pressed={ferramenta === f.id} onClick={() => trocarFerramenta(f.id)}>
                {f.icone ? <FontAwesomeIcon icon={f.icone} /> : <span className="quadro-barbante-icone" aria-hidden />} {f.rotulo}
              </button>
            ))}
          </div>
        </div>

        {pistaUv && (
          <EditorUv
            key={pistaUv.id}
            p={pistaUv}
            classe={classeDa(pistaUv)}
            corpo={(w) => <>{corpo(pistaUv, w, false)}<Marcas marcas={pistaUv.marcas} w={w} /></>}
            onSalvar={(uv) => { q.alterar(pistaUv.id, { uv }); setUvEditando(null) }}
            onFechar={() => setUvEditando(null)}
          />
        )}
      </div>
    </Janela>
  )
}
