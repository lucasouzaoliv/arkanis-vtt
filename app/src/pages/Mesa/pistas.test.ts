import { expect, it } from 'vitest'
import { curvaDoBarbante, inclinacao, jaLigadas, tachinha } from './pistas'

it('quadro de pistas (KAN-117)', () => {
  expect(tachinha({ tipo: 'nota', x: 100, y: 50 })).toEqual({ x: 195, y: 60 })
  expect(curvaDoBarbante({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe('M0.0 0.0Q50.0 12.0 100.0 0.0')
  expect(curvaDoBarbante({ x: 0, y: 0 }, { x: 1000, y: 0 })).toContain('Q500.0 60.0')
  expect(inclinacao(() => 0)).toBe(-4)
  expect(inclinacao(() => 1)).toBe(4)
  expect(jaLigadas([{ de: 'a', para: 'b' }], 'b', 'a')).toBe(true)
  expect(jaLigadas([{ de: 'a', para: 'b' }], 'a', 'c')).toBe(false)
})

import { arrumarTraco, caminhoDoTraco, distanciaAoTraco, formaDoPingo, larguraDa, lerMarcas, lerUv, noPapel, papelDa } from './pistas'

it('quadro aprimorado: papel, grifo e tinta UV (10/11)', () => {
  expect(larguraDa({ tipo: 'foto', largura: null })).toBe(240)
  expect(larguraDa({ tipo: 'foto', largura: 400 })).toBe(400)
  expect(papelDa('caderno')).toBe('caderno')
  expect(papelDa(null)).toBe('amarelo')
  // Traço tremido quase deitado vira uma reta deitada.
  expect(arrumarTraco([[0.1, 0.5], [0.2, 0.505], [0.3, 0.495], [0.4, 0.5]])).toEqual([[0.1, 0.5], [0.4, 0.5]])
  // Diagonal firme continua diagonal, só reta.
  expect(arrumarTraco([[0, 0], [0.1, 0.11], [0.2, 0.2]])).toEqual([[0, 0], [0.2, 0.2]])
  // Curva de verdade continua curva.
  expect(arrumarTraco([[0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2]]).length).toBeGreaterThan(2)
  expect(caminhoDoTraco([[0, 0], [0.5, 0]], 200)).toBe('M0.0 0.0L100.0 0.0')
  expect(distanciaAoTraco([[0, 0], [1, 0]], [0.5, 0.2])).toBeCloseTo(0.2)
  // Papel sem inclinação: o ponto do mural vira fração da largura.
  expect(noPapel({ tipo: 'foto', largura: 200, x: 100, y: 50, rotacao: 0 }, { x: 200, y: 150 })).toEqual([0.5, 0.5])
  // A tachinha não sai do lugar quando o papel inclina.
  const pino = noPapel({ tipo: 'foto', largura: 200, x: 100, y: 50, rotacao: 30 }, { x: 200, y: 60 })
  expect(pino[0]).toBeCloseTo(0.5)
  expect(pino[1]).toBeCloseTo(0.05)
  expect(lerMarcas([{ id: 'a', cor: '#fff', grossura: 0.02, pontos: [[0, 0], [1, 1]] }, { id: 'b', pontos: [[0, 0]] }, 'lixo'])).toHaveLength(1)
  expect(lerUv(null)).toBeNull()
  expect(lerUv({ itens: [] })).toBeNull()
  expect(lerUv({ itens: [{ id: 'a', tipo: 'texto', x: 0.1, y: 0.2, texto: 'oi' }, { id: 'b', tipo: 'pingo', x: 0.5, y: 0.5 }], rastro: true })).toMatchObject({ rastro: true, itens: [{ tipo: 'texto', fonte: 'manuscrita' }, { tipo: 'pingo', tam: 0.12 }] })
  expect(formaDoPingo(42)).toEqual(formaDoPingo(42))
  expect(formaDoPingo(42)).not.toEqual(formaDoPingo(43))
})
