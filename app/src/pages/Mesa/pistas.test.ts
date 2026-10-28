import { expect, it } from 'vitest'
import { curvaDoBarbante, inclinacao, jaLigadas, tachinha } from './pistas'

it('quadro de pistas (KAN-117)', () => {
  expect(tachinha({ tipo: 'nota', x: 100, y: 50 })).toEqual({ x: 185, y: 58 })
  expect(curvaDoBarbante({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe('M0.0 0.0Q50.0 12.0 100.0 0.0')
  expect(curvaDoBarbante({ x: 0, y: 0 }, { x: 1000, y: 0 })).toContain('Q500.0 60.0')
  expect(inclinacao(() => 0)).toBe(-4)
  expect(inclinacao(() => 1)).toBe(4)
  expect(jaLigadas([{ de: 'a', para: 'b' }], 'b', 'a')).toBe(true)
  expect(jaLigadas([{ de: 'a', para: 'b' }], 'a', 'c')).toBe(false)
})
