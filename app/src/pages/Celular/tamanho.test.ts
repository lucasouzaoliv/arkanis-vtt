import { describe, expect, it } from 'vitest'
import { prenderTamanho } from './tamanho'

describe('tamanho do celular na tela (14/10)', () => {
  it('vai de 30% a 100%', () => {
    expect(prenderTamanho(10)).toBe(30)
    expect(prenderTamanho(64.4)).toBe(64)
    expect(prenderTamanho(140)).toBe(100)
  })
  it('sem valor guardado, normal', () => {
    expect(prenderTamanho(0)).toBe(100)
    expect(prenderTamanho(Number.NaN)).toBe(100)
  })
})
