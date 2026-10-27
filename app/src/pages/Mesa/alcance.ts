// Alcance visível (KAN-115, pedido da Millie 27/10): com a ferramenta de alvos, círculos em volta
// do token de quem ataca (curto, médio, longo, extremo) e a distância até cada alvo marcado.
// Regras puras, testadas.
import type { Caixa } from './tokens'

export type Alcance = { id: string; rotulo: string; metros: number | null }
export type Faixa = { id: string; rotulo: string; metros: number }

// "Curto (9 m)" → "Curto".
const curto = (rotulo: string) => rotulo.replace(/\s*\(.*\)\s*$/, '')

// As faixas que viram círculo: as que têm metros e passam do quadrado vizinho (toque).
export function faixasDoAlcance(alcances: Alcance[]): Faixa[] {
  return alcances
    .filter((a): a is Faixa => a.metros !== null && a.metros > 1.5)
    .map((a) => ({ ...a, rotulo: curto(a.rotulo) }))
    .sort((a, b) => a.metros - b.metros)
}

// Raio do círculo em pixels: da borda do token até onde a faixa chega.
export function raioDaFaixa(token: Caixa, metros: number, celula: { w: number; h: number }, metrosPorQuadrado: number): number {
  return Math.max(token.width, token.height) / 2 + (metros / metrosPorQuadrado) * Math.max(celula.w, celula.h)
}

// Em qual faixa cai a distância (a menor que alcança); passou de todas, "Fora de alcance".
export function faixaDaDistancia(metros: number, alcances: Alcance[]): string {
  const com = alcances.filter((a): a is Faixa => a.metros !== null).sort((a, b) => a.metros - b.metros)
  const f = com.find((a) => metros <= a.metros + 1e-6)
  return f ? curto(f.rotulo) : 'Fora de alcance'
}
