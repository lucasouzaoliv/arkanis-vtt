import { describe, expect, it } from 'vitest'
import { faixaDaDistancia, faixasDoAlcance, raioDaFaixa } from './alcance'
import { ordemParanormal } from '../../sistemas/ordemParanormal'

const alcances = ordemParanormal.alcances

describe('alcance visível (KAN-115)', () => {
  it('faixas do Ordem: curto, médio, longo e extremo, sem o "(9 m)"', () => {
    expect(faixasDoAlcance(alcances).map((f) => [f.rotulo, f.metros])).toEqual([['Curto', 9], ['Médio', 18], ['Longo', 36], ['Extremo', 90]])
  })
  it('raio conta da borda do token, pela grade', () => {
    expect(raioDaFaixa({ x: 0, y: 0, width: 100, height: 100 }, 9, { w: 100, h: 100 }, 1.5)).toBe(650)
  })
  it('em qual faixa o alvo está', () => {
    expect(faixaDaDistancia(1.5, alcances)).toBe('Toque')
    expect(faixaDaDistancia(9, alcances)).toBe('Curto')
    expect(faixaDaDistancia(10.5, alcances)).toBe('Médio')
    expect(faixaDaDistancia(120, alcances)).toBe('Fora de alcance')
  })
})
