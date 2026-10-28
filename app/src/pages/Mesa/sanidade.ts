// Sanidade mexendo na tela (KAN-116, pedido da Millie 27/10, "tipo Don't Starve"): com a SAN
// baixa, a visão do jogador derrete, escurece nas bordas e coisas aparecem. Regras puras, testadas.

export type EstagioLoucura = 'lucido' | 'abalado' | 'perturbado' | 'enlouquecendo'

// Acima da metade, nada. Da metade pra baixo vai crescendo; zerada (enlouquecendo), tudo no máximo.
export function intensidadeDaLoucura(atual: number, max: number | null): number {
  if (!max || max <= 0) return 0
  if (atual <= 0) return 1
  const pct = atual / max
  if (pct > 0.5) return 0
  return Math.round((0.15 + ((0.5 - pct) / 0.5) * 0.7) * 100) / 100
}

export function estagioDaLoucura(intensidade: number): EstagioLoucura {
  if (intensidade <= 0) return 'lucido'
  if (intensidade >= 1) return 'enlouquecendo'
  return intensidade >= 0.5 ? 'perturbado' : 'abalado'
}
