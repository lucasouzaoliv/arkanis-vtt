import { describe, expect, it } from 'vitest'
import { comAjuste, NOME_DOS_AJUSTES, valorDoAjuste } from './ajustesDaAmeaca'
import { defesaDeCondicoes, penalidadeDeCondicoes } from '../CharacterSheet/condicoes'

describe('ajustes do mestre na ameaça', () => {
  it('Defesa -5 vira condição própria e vale na Defesa', () => {
    const r = comAjuste(['Abalado'], [], { tipo: 'defesa' }, -5)
    expect(r.condicoes).toEqual(['Abalado', NOME_DOS_AJUSTES])
    expect(valorDoAjuste(r.personalizadas, r.condicoes, { tipo: 'defesa' })).toBe(-5)
    expect(defesaDeCondicoes(r.condicoes, r.personalizadas).valor).toBe(-5)
  })

  it('perícia soma no teste dela e não nas outras', () => {
    const r = comAjuste([], [], { tipo: 'pericia', nome: 'Percepção' }, 3)
    expect(penalidadeDeCondicoes(r.condicoes, { atributo: null, pericia: 'Percepção' }, r.personalizadas).valor).toBe(3)
    expect(penalidadeDeCondicoes(r.condicoes, { atributo: null, pericia: 'Luta' }, r.personalizadas).valor).toBe(0)
  })

  it('trocar mantém os outros ajustes; zerar tudo tira a condição', () => {
    let r = comAjuste([], [], { tipo: 'defesa' }, -5)
    r = comAjuste(r.condicoes, r.personalizadas, { tipo: 'pericia', nome: 'Luta' }, 2)
    r = comAjuste(r.condicoes, r.personalizadas, { tipo: 'defesa' }, -3)
    expect(valorDoAjuste(r.personalizadas, r.condicoes, { tipo: 'defesa' })).toBe(-3)
    expect(valorDoAjuste(r.personalizadas, r.condicoes, { tipo: 'pericia', nome: 'Luta' })).toBe(2)
    r = comAjuste(r.condicoes, r.personalizadas, { tipo: 'defesa' }, 0)
    r = comAjuste(r.condicoes, r.personalizadas, { tipo: 'pericia', nome: 'Luta' }, 0)
    expect(r.condicoes).toEqual([])
    expect(r.personalizadas).toEqual([])
  })
})

import { comResistencia, resistenciasComAjustes } from './ajustesDaAmeaca'
import { danoNoAlvo, perfilDoAlvo } from './mira'

describe('resistências ajustadas da ameaça', () => {
  const criatura = { tipo: 'criatura' as const, nome: 'X', defesa: 20, resistencias: 'Balístico 10, Sangue 20', vulnerabilidades: null }

  it('troca, tira e adiciona tipos por cima do bestiário', () => {
    let a = comResistencia([], 'sangue', 5)
    a = comResistencia(a, 'balistico', 0)
    a = comResistencia(a, 'fogo', 8)
    expect(resistenciasComAjustes({ balistico: 10, sangue: 20 }, a)).toEqual({ sangue: 5, fogo: 8 })
  })

  it('o dano contra a ameaça usa as resistências ajustadas', () => {
    const p = perfilDoAlvo({ ...criatura, resistencias_ajustadas: [{ tipo: 'sangue', valor: 5 }, { tipo: 'balistico', valor: 0 }] })
    expect(danoNoAlvo([{ valor: 12, tipo: 'Sangue' }], p).pv).toBe(7)
    expect(danoNoAlvo([{ valor: 12, tipo: 'Balístico' }], p).pv).toBe(12)
  })

  it('sem ajuste fica igual ao bestiário', () => {
    expect(danoNoAlvo([{ valor: 12, tipo: 'Sangue' }], perfilDoAlvo(criatura)).pv).toBe(0)
  })
})
