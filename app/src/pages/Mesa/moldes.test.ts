import { describe, expect, it } from 'vitest'
import { arrastoDoMolde, nomeDoMolde, origemDoMolde, pegosPeloMolde, type Molde } from './moldes'

const c = { w: 100, h: 100 }
const token = (id: string, col: number, lin: number, tam = 1) => ({ id, x: col * 100, y: lin * 100, width: tam * 100, height: tam * 100 })

describe('moldes de área (KAN-119)', () => {
  it('a origem encaixa no canto ou no centro do quadrado', () => {
    expect(origemDoMolde({ x: 105, y: 96 }, c)).toEqual({ x: 100, y: 100 })
    expect(origemDoMolde({ x: 140, y: 160 }, c)).toEqual({ x: 150, y: 150 })
  })

  it('o arrasto anda de quadrado em quadrado e vira metros', () => {
    expect(arrastoDoMolde('circulo', { x: 0, y: 0 }, { x: 290, y: 30 }, c, 1.5)).toMatchObject({ quadrados: 3, metros: 4.5 })
    expect(arrastoDoMolde('cone', { x: 0, y: 0 }, { x: 10, y: 0 }, c, 1.5)).toMatchObject({ quadrados: 1, metros: 1.5, angulo: 0 })
    expect(arrastoDoMolde('quadrado', { x: 0, y: 0 }, { x: -210, y: 90 }, c, 1.5).quadrados).toBe(2)
  })

  it('o círculo pega quem tem um quadrado com o centro dentro', () => {
    const m: Molde = { forma: 'circulo', x: 500, y: 500, angulo: 0, metros: 3 } // raio 2 quadrados
    const ts = [token('perto', 5, 5), token('borda', 6, 5), token('diagonal', 6, 6), token('longe', 8, 5), token('grande', 6, 3, 2)]
    expect(pegosPeloMolde(m, ts, c, 1.5).sort()).toEqual(['borda', 'grande', 'perto'])
  })

  it('o cone abre pra onde aponta', () => {
    const m: Molde = { forma: 'cone', x: 500, y: 500, angulo: 0, metros: 6 } // 4 quadrados pra direita
    const ts = [token('frente', 7, 4), token('lado', 8, 6), token('atras', 3, 4), token('fora', 5, 7)]
    expect(pegosPeloMolde(m, ts, c, 1.5).sort()).toEqual(['frente', 'lado'])
  })

  it('a linha tem um quadrado de largura', () => {
    const m: Molde = { forma: 'linha', x: 500, y: 550, angulo: 0, metros: 6 }
    const ts = [token('na-linha', 8, 5), token('vizinho', 8, 6)]
    expect(pegosPeloMolde(m, ts, c, 1.5)).toEqual(['na-linha'])
  })

  it('o quadrado vai pro lado do arrasto', () => {
    const m: Molde = { forma: 'quadrado', x: 500, y: 500, angulo: 135, metros: 3 } // pra esquerda e pra baixo
    const ts = [token('dentro', 3, 6), token('fora', 5, 5)]
    expect(pegosPeloMolde(m, ts, c, 1.5)).toEqual(['dentro'])
  })

  it('nome do molde', () => {
    expect(nomeDoMolde({ forma: 'circulo', metros: 6 })).toBe('Círculo · raio 6 m')
    expect(nomeDoMolde({ forma: 'cone', metros: 4.5 })).toBe('Cone · 4,5 m')
  })
})

it('cone e linha não pegam quem está na origem', () => {
  const m: Molde = { forma: 'cone', x: 550, y: 550, angulo: 0, metros: 6 }
  expect(pegosPeloMolde(m, [token('eu', 5, 5), token('ele', 7, 5)], c, 1.5)).toEqual(['ele'])
})
