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
  created_at: string
}

export type Barbante = { id: string; campaign_id: string; de: string; para: string; created_at: string }

export const LARGURA_PISTA: Record<TipoPista, number> = { nota: 170, foto: 170, documento: 150, item: 150 }

// A tachinha fica no meio, em cima do papel: é dali que sai o barbante.
export function tachinha(p: Pick<Pista, 'tipo' | 'x' | 'y'>): { x: number; y: number } {
  return { x: p.x + LARGURA_PISTA[p.tipo] / 2, y: p.y + 8 }
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
