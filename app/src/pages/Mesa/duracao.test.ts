import { describe, expect, it } from 'vitest'
import { proximaDuracao } from './CondicoesDaAmeaca'
import { rodadasRestantes } from './useCombate'

describe('duração das condições (KAN-121)', () => {
  it('a ampulheta passa por sem duração, 1, 2, 3 rodadas e cena', () => {
    expect(proximaDuracao(undefined)).toBe(1)
    expect(proximaDuracao(1)).toBe(2)
    expect(proximaDuracao(3)).toBe('cena')
    expect(proximaDuracao('cena')).toBeNull()
  })
  it('quanto falta', () => {
    expect(rodadasRestantes(3, 1)).toBe(2)
    expect(rodadasRestantes(2, 2)).toBe(1)
  })
})
