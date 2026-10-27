import { describe, expect, it } from 'vitest'
import { metrosDoDeslocamento, passouDoDeslocamento } from './movimento'

describe('movimento contado (KAN-120)', () => {
  it('lê o deslocamento do bestiário', () => {
    expect(metrosDoDeslocamento('12m | 8')).toBe(12)
    expect(metrosDoDeslocamento('9 m (6q), escalada 4,5m')).toBe(9)
    expect(metrosDoDeslocamento('veja o texto')).toBeNull()
    expect(metrosDoDeslocamento(null)).toBeNull()
  })
  it('avisa quando passa', () => {
    expect(passouDoDeslocamento(9, 9)).toBe(false)
    expect(passouDoDeslocamento(10.5, 9)).toBe(true)
    expect(passouDoDeslocamento(30, null)).toBe(false)
  })
})
