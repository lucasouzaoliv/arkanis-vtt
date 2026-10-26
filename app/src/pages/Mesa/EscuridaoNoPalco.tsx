import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import Janela from './Janela'
import type { Cena } from './cenas'
import { caixaDoArrasto } from './desenhos'
import { caminhoDoCone, COR_DA_LANTERNA, type Cone } from './luz'
import type { AreaEscura, useEscuridao } from './useEscuridao'

type Ponto = { x: number; y: number }

// Áreas de Escuridão da barra esquerda (pedido da Millie, 05/10): o mestre pinta retângulos.
export const FERRAMENTAS_ESCURIDAO = ['escuridao-selecionar', 'escuridao-desenhar'] as const

type Gesto =
  | { tipo: 'area'; inicio: Ponto }
  | { tipo: 'mover'; inicio: Ponto; origem: Record<string, Ponto>; dx: number; dy: number }
  | { tipo: 'caixa'; inicio: Ponto; somar: boolean }

export function useEscuridaoNoPalco({ cena, ferramenta, souMestre, esc, pontoNoMapa, escala, pedidoLimpar }: {
  cena: Cena | null
  ferramenta: string
  souMestre: boolean
  esc: ReturnType<typeof useEscuridao>
  pontoNoMapa: (x: number, y: number) => Ponto
  escala: number
  pedidoLimpar: number
}) {
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [previa, setPrevia] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [caixa, setCaixa] = useState<{ a: Ponto; b: Ponto } | null>(null)
  const [limpando, setLimpando] = useState(false)
  const gesto = useRef<Gesto | null>(null)

  const ativo = souMestre && (FERRAMENTAS_ESCURIDAO as readonly string[]).includes(ferramenta)

  useEffect(() => { if (pedidoLimpar && souMestre) setLimpando(true) }, [pedidoLimpar, souMestre])
  useEffect(() => setSelecionados([]), [cena?.id, ferramenta])

  function aoApertar(e: React.PointerEvent<HTMLDivElement>): boolean {
    if (!ativo || e.button !== 0 || !cena) return false
    const p = pontoNoMapa(e.clientX, e.clientY)
    if (ferramenta === 'escuridao-desenhar') gesto.current = { tipo: 'area', inicio: p }
    else {
      if (!e.shiftKey) setSelecionados([])
      gesto.current = { tipo: 'caixa', inicio: p, somar: e.shiftKey }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    return true
  }

  function aoMover(e: React.PointerEvent): void {
    const g = gesto.current
    if (!ativo || !g) return
    const p = pontoNoMapa(e.clientX, e.clientY)
    if (g.tipo === 'area') setPrevia(caixaDoArrasto(g.inicio, p))
    else if (g.tipo === 'caixa') setCaixa({ a: g.inicio, b: p })
    else {
      g.dx = p.x - g.inicio.x
      g.dy = p.y - g.inicio.y
      for (const [id, o] of Object.entries(g.origem)) esc.alterar(id, { x: o.x + g.dx, y: o.y + g.dy }, false)
    }
  }

  function aoSoltar(e?: React.PointerEvent): boolean {
    const g = gesto.current
    gesto.current = null
    if (!g) return false
    const p = e ? pontoNoMapa(e.clientX, e.clientY) : null
    setPrevia(null)
    if (g.tipo === 'area' && p && cena) {
      const c = caixaDoArrasto(g.inicio, p)
      if (c.width > 10 && c.height > 10) esc.criar({ scene_id: cena.id, campaign_id: cena.campaign_id, ...c })
    } else if (g.tipo === 'mover') {
      if (g.dx || g.dy) for (const [id, o] of Object.entries(g.origem)) esc.alterar(id, { x: o.x + g.dx, y: o.y + g.dy })
    } else if (g.tipo === 'caixa') {
      const c = caixa
      setCaixa(null)
      if (c) {
        const x1 = Math.min(c.a.x, c.b.x), x2 = Math.max(c.a.x, c.b.x), y1 = Math.min(c.a.y, c.b.y), y2 = Math.max(c.a.y, c.b.y)
        const pegos = esc.areas.filter((a) => a.x < x2 && a.x + a.width > x1 && a.y < y2 && a.y + a.height > y1).map((a) => a.id)
        setSelecionados((atual) => (g.somar ? [...new Set([...atual, ...pegos])] : pegos))
      }
    }
    return true
  }

  function pegarArea(e: React.PointerEvent, a: AreaEscura) {
    if (ferramenta !== 'escuridao-selecionar' || e.button !== 0) return
    e.stopPropagation()
    let sel = selecionados
    if (e.shiftKey) sel = sel.includes(a.id) ? sel.filter((x) => x !== a.id) : [...sel, a.id]
    else if (!sel.includes(a.id)) sel = [a.id]
    setSelecionados(sel)
    gesto.current = {
      tipo: 'mover', inicio: pontoNoMapa(e.clientX, e.clientY), dx: 0, dy: 0,
      origem: Object.fromEntries(esc.areas.filter((x) => sel.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }])),
    }
    ;(e.currentTarget as Element).closest('.mesa-palco')?.setPointerCapture(e.pointerId)
  }

  function aoTeclar(e: KeyboardEvent): boolean {
    if (!ativo) return false
    if ((e.key === 'Delete' || e.key === 'Backspace') && selecionados.length) {
      esc.excluir(selecionados)
      setSelecionados([])
      return true
    }
    if (e.key === 'Escape' && selecionados.length) {
      setSelecionados([])
      return true
    }
    return false
  }

  // Contorno das áreas pro mestre, só com a ferramenta aberta (a escuridão em si vem da LuzesNoPalco).
  const px = 1 / escala
  const camada = souMestre && cena && ferramenta.startsWith('escuridao') ? (
    <svg className={`mesa-escuras${ferramenta === 'escuridao-selecionar' ? ' selecionando' : ''}`} aria-hidden>
      {esc.areas.map((a) => (
        <rect
          key={a.id}
          className="mesa-escura"
          x={a.x} y={a.y} width={a.width} height={a.height}
          strokeWidth={(selecionados.includes(a.id) ? 2.5 : 1.5) * px}
          onPointerDown={(e) => pegarArea(e, a)}
        />
      ))}
      {previa && <rect className="mesa-escura previa" x={previa.x} y={previa.y} width={previa.width} height={previa.height} strokeWidth={1.5 * px} />}
      {caixa && (
        <rect
          x={Math.min(caixa.a.x, caixa.b.x)} y={Math.min(caixa.a.y, caixa.b.y)} width={Math.abs(caixa.b.x - caixa.a.x)} height={Math.abs(caixa.b.y - caixa.a.y)}
          fill="rgba(240,240,242,0.06)" stroke="rgba(240,240,242,0.5)" strokeWidth={1.5 * px} strokeDasharray={`${6 * px} ${4 * px}`}
        />
      )}
    </svg>
  ) : null

  const janelas = limpando ? (
    <Janela titulo="Limpar Áreas de Escuridão" icone={faTrash} largura={400} onFechar={() => setLimpando(false)}>
      <p className="janela-pergunta">Excluir permanentemente todas as áreas de escuridão desta cena?</p>
      <div className="janela-sim-nao">
        <button type="button" className="janela-botao" onClick={() => { esc.excluir(esc.areas.map((a) => a.id)); setSelecionados([]); setLimpando(false) }}>
          <FontAwesomeIcon icon={faCheck} /> Sim
        </button>
        <button type="button" className="janela-botao janela-botao-destaque" onClick={() => setLimpando(false)}>
          <FontAwesomeIcon icon={faXmark} /> Não
        </button>
      </div>
    </Janela>
  ) : null

  return { ativo, camada, janelas, aoApertar, aoMover, aoSoltar, aoTeclar }
}

// Fogo tremulando / pulsando (Luz Ambiente): a animação vai no recorte e no brilho.
const animacaoDa = (c: Cone) => (c.animacao && c.animacao !== 'nenhuma' ? `luz-anim-${c.animacao}` : undefined)

// Escuridão (a da cena + as áreas pintadas) com os cones das lanternas recortando ela, e o
// brilho de cada lanterna por cima. O mestre vê a escuridão mais clara, pra poder trabalhar.
export function LuzesNoPalco({ mapa, souMestre, nivel, areas, cones, celula, sobreTokens = false }: {
  mapa: { w: number; h: number }
  souMestre: boolean
  nivel: number // Nível de Escuridão da cena (0 a 1)
  areas: AreaEscura[]
  cones: Cone[]
  celula: { w: number; h: number }
  // Por cima dos tokens (visão de jogador): ids próprios pra não colidir com a camada do mestre.
  sobreTokens?: boolean
}) {
  if (!areas.length && !nivel) return null
  const sufixo = sobreTokens ? '-j' : ''
  const borrar = Math.max(celula.w, celula.h) * 0.25
  const temEscuro = areas.length > 0 || nivel > 0
  return (
    <svg className={`mesa-luzes${sobreTokens ? ' sobre-tokens' : ''}`} width={mapa.w} height={mapa.h} aria-hidden>
      <defs>
        <filter id={`luz-borda${sufixo}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={borrar} />
        </filter>
        {cones.map((c) => (
          <g key={c.id}>
            {/* Na máscara: preto = luz (a escuridão some), mais forte perto do token. */}
            <radialGradient id={`luz-m-${c.id}${sufixo}`} gradientUnits="userSpaceOnUse" cx={c.cx} cy={c.cy} r={c.raio}>
              <stop offset="0" stopColor="#000" stopOpacity={c.forca} />
              <stop offset={c.forte} stopColor="#000" stopOpacity={c.forca} />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </g>
        ))}
        {temEscuro && (
          <mask id={`luz-mascara${sufixo}`} maskUnits="userSpaceOnUse" x={0} y={0} width={mapa.w} height={mapa.h}>
            <rect width={mapa.w} height={mapa.h} fill="#fff" />
            <g filter={`url(#luz-borda${sufixo})`}>
              {cones.map((c) => <path key={c.id} className={animacaoDa(c)} d={caminhoDoCone(c)} fill={`url(#luz-m-${c.id}${sufixo})`} />)}
            </g>
          </mask>
        )}
      </defs>
      {temEscuro && (
        <g mask={`url(#luz-mascara${sufixo})`} opacity={souMestre ? 0.55 : 1}>
          {nivel > 0 && <rect width={mapa.w} height={mapa.h} fill="#000" opacity={nivel * 0.92} />}
          {areas.map((a) => <rect key={a.id} x={a.x} y={a.y} width={a.width} height={a.height} fill="#000" />)}
        </g>
      )}
    </svg>
  )
}

// Brilho das lanternas, por cima de tudo o que a luz pega (mapa, tokens, desenhos): a comum
// clareia num tom quente; a UV pinta de roxo (pedido da Millie, 06/10: o token na luz UV tem
// que ficar roxo, não como se fosse a lanterna normal).
export function BrilhoDasLanternas({ mapa, cones, celula }: { mapa: { w: number; h: number }; cones: Cone[]; celula: { w: number; h: number } }) {
  if (!cones.length) return null
  const borrar = Math.max(celula.w, celula.h) * 0.25
  const gradiente = (id: string, c: Cone, cor: string, opacidade: number) => (
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={c.cx} cy={c.cy} r={c.raio}>
      <stop offset="0" stopColor={cor} stopOpacity={opacidade} />
      <stop offset={c.forte} stopColor={cor} stopOpacity={opacidade * 0.8} />
      <stop offset="1" stopColor={cor} stopOpacity="0" />
    </radialGradient>
  )
  const defs = (sufixo: string) => (
    <defs>
      <filter id={`brilho-borda-${sufixo}`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={borrar} />
      </filter>
      {cones.map((c) => (
        <g key={c.id}>
          {sufixo === 'luz' ? gradiente(`brilho-${c.id}`, c, c.cor, c.brilho) : gradiente(`tinta-${c.id}`, c, COR_DA_LANTERNA.uv, 0.9)}
        </g>
      ))}
    </defs>
  )
  const uv = cones.filter((c) => c.tipo === 'uv')
  // Duas camadas: a UV tinge de roxo o que está embaixo (mistura "multiplicar"); depois todas acendem ("tela").
  return (
    <>
      {uv.length > 0 && (
        <svg className="mesa-luzes-brilho tinta" width={mapa.w} height={mapa.h} aria-hidden>
          {defs('tinta')}
          <g filter="url(#brilho-borda-tinta)">
            {uv.map((c) => <path key={c.id} d={caminhoDoCone(c)} fill={`url(#tinta-${c.id})`} />)}
          </g>
        </svg>
      )}
      <svg className="mesa-luzes-brilho luz" width={mapa.w} height={mapa.h} aria-hidden>
        {defs('luz')}
        <g filter="url(#brilho-borda-luz)">
          {cones.map((c) => <path key={c.id} className={animacaoDa(c)} d={caminhoDoCone(c)} fill={`url(#brilho-${c.id})`} />)}
        </g>
      </svg>
    </>
  )
}
