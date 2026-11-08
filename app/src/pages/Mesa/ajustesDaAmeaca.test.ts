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
