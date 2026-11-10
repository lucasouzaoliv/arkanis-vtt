// Quadro de pistas (KAN-117, pedido da Millie 27/10): mural de cortiça da campanha com notas,
// fotos e documentos presos por tachinha e ligados por barbante. Regras puras, testadas.

export type TipoPista = 'nota' | 'foto' | 'documento' | 'item'

export type Pista = {
  id: string
  campaign_id: string
  author_id: string
  tipo: TipoPista
  texto: string
  imagem_url: string | null
  documento_id: string | null
  // Item da aba Itens (texto e imagem_url guardam como ele era quando foi preso).
  item_id: string | null
  x: number
  y: number
  rotacao: number
  // Papel da nota, largura no mural, grifos e tinta UV (10/11).
  estilo: string | null
  largura: number | null
  marcas: Marca[]
  uv: Uv | null
  created_at: string
}

export type Barbante = { id: string; campaign_id: string; de: string; para: string; created_at: string }

export const LARGURA_PISTA: Record<TipoPista, number> = { nota: 190, foto: 240, documento: 150, item: 170 }

// A tachinha fica no meio, em cima do papel: é dali que sai o barbante.
export function tachinha(p: Pick<Pista, 'tipo' | 'x' | 'y'> & { largura?: number | null }): { x: number; y: number } {
  return { x: p.x + larguraDa({ tipo: p.tipo, largura: p.largura ?? null }) / 2, y: p.y + PINO_Y }
}

// Barbante entre duas tachinhas: cai um pouco no meio (quanto mais comprido, mais cai).
export function curvaDoBarbante(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const queda = Math.min(60, dist * 0.12)
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2 + queda
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

// Papel preso meio torto, como num mural de verdade.
export function inclinacao(sorteio: () => number = Math.random): number {
  return Math.round((sorteio() * 8 - 4) * 10) / 10
}

// Já existe barbante entre as duas (em qualquer sentido)?
export function jaLigadas(barbantes: Pick<Barbante, 'de' | 'para'>[], a: string, b: string): boolean {
  return barbantes.some((l) => (l.de === a && l.para === b) || (l.de === b && l.para === a))
}

// ---- Quadro aprimorado (pedido da Millie, 10/11) ----

// Altura da tachinha dentro do papel: o barbante sai daqui e o papel balança em volta dela.
export const PINO_Y = 10
export const LARGURA_MIN = 90
export const LARGURA_MAX = 1200

export function larguraDa(p: Pick<Pista, 'tipo' | 'largura'>): number {
  return p.largura && p.largura > 0 ? p.largura : LARGURA_PISTA[p.tipo]
}

// Papéis da nota: folha de caderno, folha parda e post-its (o preto leva letra branca).
export const PAPEIS = [
  { id: 'caderno', nome: 'Folha de caderno' },
  { id: 'pardo', nome: 'Folha parda' },
  { id: 'amarelo', nome: 'Post-it amarelo' },
  { id: 'rosa', nome: 'Post-it rosa' },
  { id: 'verde', nome: 'Post-it verde' },
  { id: 'azul', nome: 'Post-it azul' },
  { id: 'laranja', nome: 'Post-it laranja' },
  { id: 'vermelho', nome: 'Post-it vermelho' },
  { id: 'preto', nome: 'Post-it preto' },
] as const
export type Papel = (typeof PAPEIS)[number]['id']
export const papelDa = (estilo: string | null | undefined): Papel => PAPEIS.find((p) => p.id === estilo)?.id ?? 'amarelo'

// Marca-texto: traço em fração da largura do papel (x e y divididos pela largura).
export type Ponto2 = [number, number]
export type Marca = { id: string; cor: string; grossura: number; pontos: Ponto2[] }
export const CORES_DO_MARCADOR = ['#ffe14a', '#6fe36a', '#ff7fc4', '#62b6ff']
export const GROSSURAS = { fino: 0.022, grosso: 0.05 }

export function lerMarcas(v: unknown): Marca[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((m) => m && typeof m.id === 'string' && Array.isArray(m.pontos) && m.pontos.length >= 2)
    .map((m) => ({
      id: m.id as string,
      cor: typeof m.cor === 'string' ? m.cor : CORES_DO_MARCADOR[0],
      grossura: Number(m.grossura) > 0 ? Number(m.grossura) : GROSSURAS.fino,
      pontos: (m.pontos as unknown[]).filter((p): p is Ponto2 => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [p[0], p[1]] as Ponto2),
    }))
    .filter((m) => m.pontos.length >= 2)
}

const arred = (n: number) => Math.round(n * 10000) / 10000

function distAoSegmento(p: Ponto2, a: Ponto2, b: Ponto2): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

export function distanciaAoTraco(pontos: Ponto2[], p: Ponto2): number {
  let d = Infinity
  for (let i = 1; i < pontos.length; i++) d = Math.min(d, distAoSegmento(p, pontos[i - 1], pontos[i]))
  return d
}

function simplificar(pontos: Ponto2[], tolerancia: number): Ponto2[] {
  if (pontos.length <= 2) return pontos
  let maior = 0
  let onde = 0
  for (let i = 1; i < pontos.length - 1; i++) {
    const d = distAoSegmento(pontos[i], pontos[0], pontos[pontos.length - 1])
    if (d > maior) { maior = d; onde = i }
  }
  if (maior <= tolerancia) return [pontos[0], pontos[pontos.length - 1]]
  return [...simplificar(pontos.slice(0, onde + 1), tolerancia).slice(0, -1), ...simplificar(pontos.slice(onde), tolerancia)]
}

// A mão treme: soltou o marcador, o traço se arruma. Quase reto vira reta (e quase deitado fica
// deitado de vez); curva de verdade só perde o tremido.
export function arrumarTraco(pontos: Ponto2[]): Ponto2[] {
  if (pontos.length < 2) {
    const p = pontos[0] ?? [0, 0]
    return [[arred(p[0] - 0.01), arred(p[1])], [arred(p[0] + 0.01), arred(p[1])]]
  }
  const a = pontos[0]
  const b = pontos[pontos.length - 1]
  const comprimento = Math.hypot(b[0] - a[0], b[1] - a[1])
  const desvio = Math.max(...pontos.map((p) => distAoSegmento(p, a, b)))
  if (comprimento > 0.02 && desvio <= Math.max(0.012, comprimento * 0.08)) {
    if (Math.abs(b[1] - a[1]) <= comprimento * 0.07) {
      const y = arred(pontos.reduce((s, p) => s + p[1], 0) / pontos.length)
      return [[arred(a[0]), y], [arred(b[0]), y]]
    }
    return [[arred(a[0]), arred(a[1])], [arred(b[0]), arred(b[1])]]
  }
  return simplificar(pontos, 0.006).map((p) => [arred(p[0]), arred(p[1])] as Ponto2)
}

// Caminho do traço em px (fração × largura), com as quinas amaciadas.
export function caminhoDoTraco(pontos: Ponto2[], largura: number): string {
  const px = pontos.map((p) => [p[0] * largura, p[1] * largura])
  const f = (n: number) => n.toFixed(1)
  if (px.length < 2) return ''
  if (px.length === 2) return `M${f(px[0][0])} ${f(px[0][1])}L${f(px[1][0])} ${f(px[1][1])}`
  let d = `M${f(px[0][0])} ${f(px[0][1])}`
  for (let i = 1; i < px.length - 1; i++) {
    const mx = (px[i][0] + px[i + 1][0]) / 2
    const my = (px[i][1] + px[i + 1][1]) / 2
    d += `Q${f(px[i][0])} ${f(px[i][1])} ${f(mx)} ${f(my)}`
  }
  const u = px[px.length - 1]
  return `${d}L${f(u[0])} ${f(u[1])}`
}

// Ponto do mural → ponto dentro do papel (em fração da largura), desfazendo a inclinação dele.
export function noPapel(p: Pick<Pista, 'tipo' | 'largura' | 'x' | 'y' | 'rotacao'>, mundo: { x: number; y: number }): Ponto2 {
  const w = larguraDa(p)
  const cx = p.x + w / 2
  const cy = p.y + PINO_Y
  const a = (-p.rotacao * Math.PI) / 180
  const dx = mundo.x - cx
  const dy = mundo.y - cy
  const rx = cx + dx * Math.cos(a) - dy * Math.sin(a)
  const ry = cy + dx * Math.sin(a) + dy * Math.cos(a)
  return [(rx - p.x) / w, (ry - p.y) / w]
}

// Tinta UV: o mestre escreve por cima do papel e só a luz UV mostra.
export const FONTES_UV = [
  { id: 'manuscrita', nome: 'Manuscrita', familia: "'Caveat', cursive" },
  { id: 'pincel', nome: 'Pincel', familia: "'Freehand', cursive" },
  { id: 'digitada', nome: 'Digitada', familia: "'Special Elite', 'Courier New', monospace" },
  { id: 'sigilos', nome: 'Sigilos', familia: "'Sigilos De Conhecimento', 'Caveat', cursive" },
] as const
export const CORES_UV = [
  { id: 'branca', nome: 'Branca', cor: '#ffffff' },
  { id: 'lilas', nome: 'Lilás', cor: '#e2b8ff' },
  { id: 'rosa', nome: 'Rosa', cor: '#ff9ae6' },
  { id: 'escura', nome: 'Escura', cor: '#150a55' },
] as const
export type UvTexto = { id: string; tipo: 'texto'; x: number; y: number; texto: string; fonte: string; tamanho: number; cor: string; rot: number }
export type UvPingo = { id: string; tipo: 'pingo'; x: number; y: number; tam: number; semente: number; cor: string }
export type UvItem = UvTexto | UvPingo
// rastro: as manchas aparecem fraquinhas mesmo sem a luz, como dica de que tem algo ali.
export type Uv = { itens: UvItem[]; rastro: boolean }

export function lerUv(v: unknown): Uv | null {
  const o = v as { itens?: unknown; rastro?: unknown } | null
  if (!o || !Array.isArray(o.itens)) return null
  const num = (n: unknown, padrao: number) => (n != null && Number.isFinite(Number(n)) ? Number(n) : padrao)
  const itens: UvItem[] = []
  for (const i of o.itens as Record<string, unknown>[]) {
    if (!i || typeof i.id !== 'string') continue
    const base = { id: i.id, x: num(i.x, 0.1), y: num(i.y, 0.1), cor: typeof i.cor === 'string' ? i.cor : 'lilas' }
    if (i.tipo === 'pingo') itens.push({ ...base, tipo: 'pingo', tam: num(i.tam, 0.12), semente: num(i.semente, 1) })
    else if (i.tipo === 'texto') itens.push({ ...base, tipo: 'texto', texto: typeof i.texto === 'string' ? i.texto : '', fonte: typeof i.fonte === 'string' ? i.fonte : 'manuscrita', tamanho: num(i.tamanho, 0.08), rot: num(i.rot, 0) })
  }
  return itens.length ? { itens, rastro: o.rastro === true } : null
}

// Mancha de tinta sorteada pela semente (sempre igual pra mesma semente): bolhas juntas,
// respingos em volta e um ou dois escorridos. Medidas em "tamanhos" (1 = raio da mancha).
export function formaDoPingo(semente: number): { bolhas: { cx: number; cy: number; r: number }[]; escorridos: { x: number; y1: number; y2: number; l: number }[] } {
  let s = (Math.floor(semente) || 1) >>> 0
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const f = (n: number) => Math.round(n * 1000) / 1000
  const bolhas = [{ cx: 0, cy: 0, r: 0.55 }]
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2
    const d = 0.25 + rnd() * 0.3
    bolhas.push({ cx: f(Math.cos(a) * d), cy: f(Math.sin(a) * d), r: f(0.22 + rnd() * 0.25) })
  }
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2
    const d = 0.85 + rnd() * 0.45
    bolhas.push({ cx: f(Math.cos(a) * d), cy: f(Math.sin(a) * d * 0.8), r: f(0.04 + rnd() * 0.09) })
  }
  const escorridos = []
  const quantos = 1 + Math.floor(rnd() * 2)
  for (let i = 0; i < quantos; i++) escorridos.push({ x: f(-0.3 + rnd() * 0.6), y1: 0.2, y2: f(0.9 + rnd() * 0.9), l: f(0.07 + rnd() * 0.07) })
  return { bolhas, escorridos }
}
