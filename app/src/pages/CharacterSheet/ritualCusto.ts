// Custo de conjurar um ritual (livro base): 1º círculo 1 PE, 2º 3 PE, 3º 6 PE, 4º 10 PE.
// Discente e Verdadeiro somam o "+X PE" da variação ao custo do círculo.
// Na regra opcional "Jogando sem Sanidade" o gasto sai da Determinação (PD), não do PE.

export const CUSTO_POR_CIRCULO = [1, 3, 6, 10]

export type ModoRitual = 'normal' | 'discente' | 'verdadeiro'

export function custoDoRitual(circulo: number, modo: ModoRitual, extraDiscente: number | null, extraVerdadeiro: number | null): number {
  const base = CUSTO_POR_CIRCULO[Math.min(4, Math.max(1, circulo)) - 1]
  if (modo === 'discente') return base + (extraDiscente ?? 0)
  if (modo === 'verdadeiro') return base + (extraVerdadeiro ?? 0)
  return base
}

export function recursoDoRitual(regras: Record<string, boolean> | null | undefined): { campo: 'current_pe' | 'current_pd'; sigla: 'PE' | 'PD' } {
  return regras?.sem_sanidade ? { campo: 'current_pd', sigla: 'PD' } : { campo: 'current_pe', sigla: 'PE' }
}

// Texto que vai embaixo da rolagem no chat e no histórico.
export function notaDoGasto(custo: number, sigla: string, antes: number, depois: number): string {
  return `Gastou ${custo} ${sigla} (${antes} → ${depois})`
}

// ---- DT dos rituais (pedido 11/10) ----
// DT pra resistir = 10 + limite de PE (1 por degrau de NEX) + Presença. Dedicação e Presença
// Poderosa aumentam o limite mas "não afetam a DT", então aqui entra só o limite pelo NEX.
// Poderes: Rituais Eficientes (+5 em todos), Especialista em Elemento (+2 nos do elemento
// escolhido). Mestre em Elemento tira 1 PE do custo dos rituais do elemento escolhido.

export type ElementosEscolhidos = { especialista?: string | null; mestre?: string | null }

const tem = (poderes: (string | null | undefined)[], nome: string) => poderes.some((p) => String(p ?? '').trim().toLowerCase() === nome)

export function dtDoRitual(p: { nexPercent: number; presenca: number; poderes: (string | null | undefined)[]; elementos?: ElementosEscolhidos | null; elementoDoRitual?: string | null }): { dt: number; motivos: string[] } {
  const limite = Math.max(1, p.nexPercent >= 99 ? 20 : Math.round(p.nexPercent / 5))
  let dt = 10 + limite + p.presenca
  const motivos = [`10 + limite de PE ${limite} + Presença ${p.presenca}`]
  if (tem(p.poderes, 'rituais eficientes')) { dt += 5; motivos.push('Poder Rituais Eficientes: +5') }
  const esp = p.elementos?.especialista
  if (esp && p.elementoDoRitual === esp && tem(p.poderes, 'especialista em elemento')) {
    dt += 2
    motivos.push(`Poder Especialista em Elemento (${esp}): +2`)
  }
  return { dt, motivos }
}

export function descontoDeElemento(poderes: (string | null | undefined)[], elementos: ElementosEscolhidos | null | undefined, elementoDoRitual: string | null | undefined): number {
  return elementoDoRitual && elementos?.mestre === elementoDoRitual && tem(poderes, 'mestre em elemento') ? 1 : 0
}
