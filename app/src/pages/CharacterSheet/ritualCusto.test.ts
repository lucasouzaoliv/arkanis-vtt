import { describe, expect, it } from 'vitest'
import { custoDoRitual, descontoDeElemento, dtDoRitual, notaDoGasto, recursoDoRitual } from './ritualCusto'

describe('custo do ritual', () => {
  it('custo base por círculo', () => {
    expect([1, 2, 3, 4].map((c) => custoDoRitual(c, 'normal', null, null))).toEqual([1, 3, 6, 10])
  })

  it('Discente e Verdadeiro somam o extra da variação', () => {
    // Amaldiçoar Arma (1º círculo): Discente +2 PE, Verdadeiro +5 PE
    expect(custoDoRitual(1, 'discente', 2, 5)).toBe(3)
    expect(custoDoRitual(1, 'verdadeiro', 2, 5)).toBe(6)
  })

  it('sem Sanidade o gasto sai da Determinação', () => {
    expect(recursoDoRitual({ sem_sanidade: true })).toEqual({ campo: 'current_pd', sigla: 'PD' })
    expect(recursoDoRitual({})).toEqual({ campo: 'current_pe', sigla: 'PE' })
    expect(recursoDoRitual(null)).toEqual({ campo: 'current_pe', sigla: 'PE' })
  })

  it('texto do gasto', () => {
    expect(notaDoGasto(3, 'PE', 12, 9)).toBe('Gastou 3 PE (12 → 9)')
  })
})

describe('DT dos rituais', () => {
  it('10 + limite de PE + Presença', () => {
    expect(dtDoRitual({ nexPercent: 25, presenca: 3, poderes: [] }).dt).toBe(18)
  })
  it('Rituais Eficientes +5 e Especialista em Elemento +2 só no elemento escolhido', () => {
    const base = { nexPercent: 25, presenca: 3, poderes: ['Rituais Eficientes', 'Especialista em Elemento'], elementos: { especialista: 'sangue' } }
    expect(dtDoRitual({ ...base, elementoDoRitual: 'sangue' }).dt).toBe(25)
    expect(dtDoRitual({ ...base, elementoDoRitual: 'morte' }).dt).toBe(23)
  })
  it('Mestre em Elemento tira 1 PE só do elemento escolhido', () => {
    expect(descontoDeElemento(['Mestre em Elemento'], { mestre: 'energia' }, 'energia')).toBe(1)
    expect(descontoDeElemento(['Mestre em Elemento'], { mestre: 'energia' }, 'medo')).toBe(0)
    expect(descontoDeElemento([], { mestre: 'energia' }, 'energia')).toBe(0)
  })
})
