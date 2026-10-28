import { expect, it } from 'vitest'
import { estagioDaLoucura, intensidadeDaLoucura } from './sanidade'

it('a loucura cresce da metade da SAN pra baixo (KAN-116)', () => {
  expect(intensidadeDaLoucura(20, 20)).toBe(0)
  expect(intensidadeDaLoucura(11, 20)).toBe(0)
  expect(intensidadeDaLoucura(10, 20)).toBe(0.15)
  expect(intensidadeDaLoucura(5, 20)).toBe(0.5)
  expect(intensidadeDaLoucura(0, 20)).toBe(1)
  expect(intensidadeDaLoucura(3, null)).toBe(0)
  expect(estagioDaLoucura(0)).toBe('lucido')
  expect(estagioDaLoucura(0.15)).toBe('abalado')
  expect(estagioDaLoucura(0.5)).toBe('perturbado')
  expect(estagioDaLoucura(1)).toBe('enlouquecendo')
})
