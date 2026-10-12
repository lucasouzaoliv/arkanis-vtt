// Ataque enviado do inventário é recalculado pela arma toda vez (tirar uma maldição muda o
// ataque). Isso apagava o que a pessoa editava no ataque: o dano de Conhecimento a mais, o tipo
// trocado (bug 12/10). Agora a edição vira "ajustes" guardados no ataque, aplicados por cima
// dos números da arma: o item continua mandando, e o que a pessoa mexeu continua lá.

export type LinhaDeDano = { formula: string; tipo: string; origem?: string; elemento?: string }

export type NumerosDaArma = { d20_bonus: number; threat_margin: number; multiplier: number; damage: LinhaDeDano[] }

export type AjustesDoAtaque = {
  /** Linha da arma que a pessoa trocou (pela posição): fórmula e tipo novos. */
  trocas?: Record<string, { formula: string; tipo: string }>
  /** Linhas que a pessoa acrescentou depois das da arma. */
  extras?: { formula: string; tipo: string }[]
  /** Diferença no bônus de ataque, na margem e no multiplicador. */
  d20?: number
  margem?: number
  multiplicador?: number
}

export function aplicarAjustes<T extends NumerosDaArma>(numeros: T, ajustes: AjustesDoAtaque | null | undefined): T {
  if (!ajustes) return numeros
  const damage = numeros.damage.map((d, i) => {
    const troca = ajustes.trocas?.[String(i)]
    return troca ? { ...d, formula: troca.formula, tipo: troca.tipo } : d
  }).filter((d) => d.formula)
  return {
    ...numeros,
    d20_bonus: numeros.d20_bonus + (ajustes.d20 ?? 0),
    threat_margin: Math.min(20, Math.max(1, numeros.threat_margin + (ajustes.margem ?? 0))),
    multiplier: Math.max(1, numeros.multiplier + (ajustes.multiplicador ?? 0)),
    damage: [...damage, ...(ajustes.extras ?? []).filter((d) => d.formula)],
  }
}

// O que a pessoa salvou comparado com os números puros da arma.
export function ajustesDaEdicao(
  daArma: NumerosDaArma,
  salvo: { d20_bonus: number; threat_margin: number; multiplier: number; damage: { formula: string; tipo: string }[] },
): AjustesDoAtaque {
  const trocas: Record<string, { formula: string; tipo: string }> = {}
  daArma.damage.forEach((d, i) => {
    const s = salvo.damage[i] ?? { formula: '', tipo: '' }
    if (s.formula !== d.formula || (s.tipo ?? '') !== (d.tipo ?? '')) trocas[String(i)] = { formula: s.formula, tipo: s.tipo ?? '' }
  })
  const ajustes: AjustesDoAtaque = {}
  if (Object.keys(trocas).length) ajustes.trocas = trocas
  const extras = salvo.damage.slice(daArma.damage.length).filter((d) => d.formula).map((d) => ({ formula: d.formula, tipo: d.tipo ?? '' }))
  if (extras.length) ajustes.extras = extras
  if (salvo.d20_bonus !== daArma.d20_bonus) ajustes.d20 = salvo.d20_bonus - daArma.d20_bonus
  if (salvo.threat_margin !== daArma.threat_margin) ajustes.margem = salvo.threat_margin - daArma.threat_margin
  if (salvo.multiplier !== daArma.multiplier) ajustes.multiplicador = salvo.multiplier - daArma.multiplier
  return ajustes
}

// Arrastar um ataque pra cima ou pra baixo (pedido 12/10): ele vai pro lugar do que recebeu.
export function moverNaLista(ids: string[], de: string, para: string): string[] {
  const i = ids.indexOf(de)
  const j = ids.indexOf(para)
  if (i < 0 || j < 0 || i === j) return ids
  const nova = ids.filter((id) => id !== de)
  nova.splice(j, 0, de)
  return nova
}
