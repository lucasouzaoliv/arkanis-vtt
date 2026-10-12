import { describe, expect, it } from 'vitest'
import { aplicarAjustes, ajustesDaEdicao, moverNaLista } from './ajustesDoAtaque'
import { numerosDoAtaque } from './itemMods'
import { rotuloDoTipoDeDano } from '../../lib/tiposDeDano'

const punhal = { d20_bonus: 0, threat_margin: 19, multiplier: 2, damage: [{ formula: '1d4', tipo: 'Perfuração' }] }

describe('ataque vindo da arma, editado (bug 12/10)', () => {
  it('o dano a mais e o tipo que a pessoa salvou continuam depois do recálculo', () => {
    const ajustes = ajustesDaEdicao(punhal, { ...punhal, damage: [{ formula: '1d4', tipo: 'Perfuração' }, { formula: '1d6', tipo: 'Conhecimento' }] })
    expect(ajustes).toEqual({ extras: [{ formula: '1d6', tipo: 'Conhecimento' }] })
    expect(aplicarAjustes(punhal, ajustes).damage).toEqual([
      { formula: '1d4', tipo: 'Perfuração' },
      { formula: '1d6', tipo: 'Conhecimento' },
    ])
  })

  it('trocar o dano da arma e o crítico vira diferença, e a maldição nova da arma ainda soma', () => {
    const ajustes = ajustesDaEdicao(punhal, { d20_bonus: 2, threat_margin: 19, multiplier: 3, damage: [{ formula: '1d6', tipo: 'Corte' }] })
    expect(ajustes).toEqual({ trocas: { 0: { formula: '1d6', tipo: 'Corte' } }, d20: 2, multiplicador: 1 })
    // A arma ganhou uma modificação que dá +1 no ataque: 1 + 2 da edição.
    const depois = aplicarAjustes({ ...punhal, d20_bonus: 1 }, ajustes)
    expect(depois.d20_bonus).toBe(3)
    expect(depois.multiplier).toBe(3)
    expect(depois.damage).toEqual([{ formula: '1d6', tipo: 'Corte' }])
  })

  it('sem edição, nada muda', () => {
    expect(ajustesDaEdicao(punhal, punhal)).toEqual({})
    expect(aplicarAjustes(punhal, undefined)).toBe(punhal)
  })
})

describe('dano a mais escrito no item', () => {
  it('entra como linha própria no ataque', () => {
    const n = numerosDoAtaque({ dano: '1d4', tipo_dano: 'Perfuração', danos_extras: [{ formula: '1d6', tipo: 'Conhecimento' }, { formula: '', tipo: 'Medo' }] }, [])
    expect(n.damage).toEqual([{ formula: '1d4', tipo: 'Perfuração' }, { formula: '1d6', tipo: 'Conhecimento' }])
  })
})

describe('rotuloDoTipoDeDano', () => {
  it('reconhece o que o pessoal escreve', () => {
    expect(rotuloDoTipoDeDano('perfurante')).toBe('Perfuração')
    expect(rotuloDoTipoDeDano('contundente')).toBe('Impacto')
    expect(rotuloDoTipoDeDano('P')).toBe('Perfuração')
    expect(rotuloDoTipoDeDano('conhecimento')).toBe('Conhecimento')
    expect(rotuloDoTipoDeDano('Dum Dum')).toBeNull()
    expect(rotuloDoTipoDeDano('')).toBeNull()
  })
})

describe('moverNaLista (arrastar ataques)', () => {
  it('pra baixo e pra cima', () => {
    expect(moverNaLista(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
    expect(moverNaLista(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
    expect(moverNaLista(['a', 'b'], 'a', 'a')).toEqual(['a', 'b'])
  })
})
