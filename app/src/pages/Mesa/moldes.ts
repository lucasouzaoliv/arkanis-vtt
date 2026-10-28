// Moldes de área (KAN-119, pedido da Millie 27/10): círculo, cone, linha e quadrado arrastáveis
// no mapa, em metros pela grade, mostrando quem foi pego. Regras puras, testadas.
import type { Caixa } from './tokens'

export type Ponto = { x: number; y: number }
export type FormaMolde = 'circulo' | 'cone' | 'linha' | 'quadrado'

export const FORMAS_MOLDE: { id: FormaMolde; rotulo: string }[] = [
  { id: 'circulo', rotulo: 'Círculo' },
  { id: 'cone', rotulo: 'Cone' },
  { id: 'linha', rotulo: 'Linha' },
  { id: 'quadrado', rotulo: 'Quadrado' },
]

// x/y: a origem (centro do círculo, ponta do cone/linha, canto do quadrado). angulo em graus.
export type Molde = { forma: FormaMolde; x: number; y: number; angulo: number; metros: number }

type Celula = { w: number; h: number }

// A origem encaixa no canto ou no centro de quadrado mais perto.
export function origemDoMolde(p: Ponto, c: Celula): Ponto {
  const canto = { x: Math.round(p.x / c.w) * c.w, y: Math.round(p.y / c.h) * c.h }
  const centro = { x: (Math.floor(p.x / c.w) + 0.5) * c.w, y: (Math.floor(p.y / c.h) + 0.5) * c.h }
  return Math.hypot(p.x - canto.x, p.y - canto.y) <= Math.hypot(p.x - centro.x, p.y - centro.y) ? canto : centro
}

// Arrastando da origem até p: direção e tamanho, sempre um número inteiro de quadrados (mín. 1).
export function arrastoDoMolde(forma: FormaMolde, a: Ponto, p: Ponto, c: Celula, metrosPorQuadrado: number): { angulo: number; metros: number; quadrados: number } {
  const dx = (p.x - a.x) / c.w
  const dy = (p.y - a.y) / c.h
  const dist = forma === 'quadrado' ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.hypot(dx, dy)
  const quadrados = Math.max(1, Math.round(dist))
  const angulo = (Math.atan2(dy, dx) * 180) / Math.PI
  return { angulo, metros: Math.round(quadrados * metrosPorQuadrado * 10) / 10, quadrados }
}

// Metade da abertura do cone: no fim ele é tão largo quanto comprido.
const MEIA_ABERTURA = Math.atan(0.5)

// O contorno do molde em pixels do mapa (o círculo vira um polígono de muitos lados).
export function contornoDoMolde(m: Molde, c: Celula, metrosPorQuadrado: number): Ponto[] {
  const q = m.metros / metrosPorQuadrado
  const t = (m.angulo * Math.PI) / 180
  // Em "quadrados" a partir da origem; no fim vira pixel.
  let pts: [number, number][]
  if (m.forma === 'circulo') {
    pts = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2
      return [Math.cos(a) * q, Math.sin(a) * q]
    })
  } else if (m.forma === 'cone') {
    const arco = Array.from({ length: 17 }, (_, i) => {
      const a = t - MEIA_ABERTURA + (i / 16) * MEIA_ABERTURA * 2
      return [Math.cos(a) * q, Math.sin(a) * q] as [number, number]
    })
    pts = [[0, 0], ...arco]
  } else if (m.forma === 'linha') {
    // Um quadrado de largura, da origem até o fim.
    const ux = Math.cos(t), uy = Math.sin(t)
    const nx = -uy * 0.5, ny = ux * 0.5
    pts = [[nx, ny], [ux * q + nx, uy * q + ny], [ux * q - nx, uy * q - ny], [-nx, -ny]]
  } else {
    // Quadrado: do canto (origem) pro lado em que foi arrastado.
    const sx = Math.cos(t) < -1e-9 ? -1 : 1
    const sy = Math.sin(t) < -1e-9 ? -1 : 1
    pts = [[0, 0], [sx * q, 0], [sx * q, sy * q], [0, sy * q]]
  }
  return pts.map(([x, y]) => ({ x: m.x + x * c.w, y: m.y + y * c.h }))
}

export function caminhoDoMolde(pts: Ponto[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + 'Z'
}

function dentro(p: Ponto, pts: Ponto[]): boolean {
  let sim = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) sim = !sim
  }
  return sim
}

// Os pontos que contam de um token: o centro de cada quadrado que ele ocupa (token menor que um
// quadrado: o centro dele).
function pontosDoToken(t: Caixa, c: Celula): Ponto[] {
  const l: Ponto[] = []
  for (let i = Math.floor(t.x / c.w); (i + 0.5) * c.w < t.x + t.width; i++) {
    for (let j = Math.floor(t.y / c.h); (j + 0.5) * c.h < t.y + t.height; j++) {
      const p = { x: (i + 0.5) * c.w, y: (j + 0.5) * c.h }
      if (p.x >= t.x && p.y >= t.y) l.push(p)
    }
  }
  return l.length ? l : [{ x: t.x + t.width / 2, y: t.y + t.height / 2 }]
}

// Quem o molde pega: algum quadrado do token com o centro dentro da área.
export function pegosPeloMolde<T extends Caixa & { id: string }>(m: Molde, tokens: T[], c: Celula, metrosPorQuadrado: number): string[] {
  const pts = contornoDoMolde(m, c, metrosPorQuadrado)
  // Um fio de folga: centro exatamente na borda conta.
  const folga = (p: Ponto) => [p, { x: p.x + 0.01, y: p.y + 0.01 }, { x: p.x - 0.01, y: p.y - 0.01 }]
  // Cone e linha saem de quem usa: o token em cima da origem não se pega.
  const deQuemUsa = (t: Caixa) => (m.forma === 'cone' || m.forma === 'linha') && m.x > t.x && m.x < t.x + t.width && m.y > t.y && m.y < t.y + t.height
  return tokens.filter((t) => !deQuemUsa(t) && pontosDoToken(t, c).some((p) => folga(p).some((q) => dentro(q, pts)))).map((t) => t.id)
}

// Onde vai o rótulo: na ponta (cone/linha), em cima (círculo), no canto oposto (quadrado).
export function rotuloDoMolde(m: Molde, c: Celula, metrosPorQuadrado: number): Ponto {
  const q = m.metros / metrosPorQuadrado
  const t = (m.angulo * Math.PI) / 180
  if (m.forma === 'circulo') return { x: m.x, y: m.y - q * c.h }
  if (m.forma === 'quadrado') {
    const sx = Math.cos(t) < -1e-9 ? -1 : 1
    const sy = Math.sin(t) < -1e-9 ? -1 : 1
    return { x: m.x + (sx * q * c.w) / 2, y: m.y + (sy < 0 ? -q : 0) * c.h }
  }
  return { x: m.x + Math.cos(t) * q * c.w, y: m.y + Math.sin(t) * q * c.h }
}

export function nomeDoMolde(m: Pick<Molde, 'forma' | 'metros'>): string {
  const f = FORMAS_MOLDE.find((x) => x.id === m.forma)?.rotulo ?? ''
  const medida = `${m.metros.toLocaleString('pt-BR')} m`
  return m.forma === 'circulo' ? `${f} · raio ${medida}` : m.forma === 'quadrado' ? `${f} · ${medida} de lado` : `${f} · ${medida}`
}
