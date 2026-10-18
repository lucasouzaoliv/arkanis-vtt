import { describe, expect, it } from 'vitest'
import {
  anguloAte, caixaDoGrupo, camposAtuais, escalarGrupo, girarGrupo, comGrupo, deslocamentoDaTecla, desfazer, HISTORICO_VAZIO, ordemParaFrente, ordemParaTras,
  redimensionarPorAlca, refazer, registrar, tocaNaCaixa, type Passo,
} from './tokens'
import type { ObjetoCena } from './cenas'

const caixa = { x: 100, y: 100, width: 200, height: 100 }

describe('redimensionar pela alça', () => {
  it('canto de baixo à direita cresce sem mexer no canto oposto', () => {
    expect(redimensionarPorAlca(caixa, { hx: 1, hy: 1 }, 100, 0)).toEqual({ x: 100, y: 100, width: 300, height: 150 })
  })

  it('canto de cima à esquerda deixa o de baixo à direita parado', () => {
    const r = redimensionarPorAlca(caixa, { hx: -1, hy: -1 }, -100, 0)
    expect(r).toEqual({ x: 0, y: 50, width: 300, height: 150 })
    expect(r.x + r.width).toBe(300)
    expect(r.y + r.height).toBe(200)
  })

  it('alça do meio de cima cresce pela altura, centralizada na horizontal', () => {
    expect(redimensionarPorAlca(caixa, { hx: 0, hy: -1 }, 0, -50)).toEqual({ x: 50, y: 50, width: 300, height: 150 })
  })

  it('nunca distorce nem some', () => {
    const r = redimensionarPorAlca(caixa, { hx: 1, hy: 0 }, -1000, 0)
    expect(r.width / r.height).toBe(2)
    expect(r.width).toBe(10)
  })
})

describe('girar', () => {
  it('0 é pra cima e gira no sentido horário', () => {
    expect(anguloAte(caixa, 200, 0)).toBe(0)
    expect(anguloAte(caixa, 400, 150)).toBe(90)
    expect(anguloAte(caixa, 200, 300)).toBe(180)
    expect(anguloAte(caixa, 0, 150)).toBe(270)
  })

  it('com Shift encaixa de 15 em 15', () => {
    expect(anguloAte(caixa, 300, 60, true) % 15).toBe(0)
  })
})

it('setas andam um quadrado da grade', () => {
  expect(deslocamentoDaTecla('ArrowLeft', 100)).toEqual({ dx: -100, dy: 0 })
  expect(deslocamentoDaTecla('ArrowDown', 50)).toEqual({ dx: 0, dy: 50 })
  expect(deslocamentoDaTecla('a', 100)).toBeNull()
})

describe('ordem de empilhamento', () => {
  const objs = [{ id: 'a', sort: 1 }, { id: 'b', sort: 5 }, { id: 'c', sort: 3 }]
  it('trazer pra frente passa de todos', () => {
    expect(ordemParaFrente(objs, ['a'])).toEqual({ a: 6 })
  })
  it('enviar pra trás fica atrás de todos', () => {
    expect(ordemParaTras(objs, ['b'])).toEqual({ b: 0 })
  })
})

it('grupo se move junto', () => {
  const objs = [{ id: 'a', group_id: 'g' }, { id: 'b', group_id: 'g' }, { id: 'c', group_id: null }]
  expect(comGrupo(objs, ['a']).sort()).toEqual(['a', 'b'])
  expect(comGrupo(objs, ['c'])).toEqual(['c'])
})

describe('desfazer e refazer', () => {
  const mover: Passo = { tipo: 'alterar', antes: { a: { x: 0 } }, depois: { a: { x: 50 } } }

  it('desfazer aplica o contrário e refazer aplica de novo', () => {
    let h = registrar(HISTORICO_VAZIO, mover)
    const d = desfazer(h)!
    expect(d.aplicar).toEqual({ tipo: 'alterar', antes: { a: { x: 50 } }, depois: { a: { x: 0 } } })
    h = d.historico
    expect(desfazer(h)).toBeNull()
    const r = refazer(h)!
    expect(r.aplicar).toEqual(mover)
    expect(refazer(r.historico)).toBeNull()
  })

  it('desfazer uma criação exclui; desfazer uma exclusão recria', () => {
    const o = { id: 'a' } as ObjetoCena
    expect(desfazer(registrar(HISTORICO_VAZIO, { tipo: 'criar', objetos: [o] }))!.aplicar.tipo).toBe('excluir')
    expect(desfazer(registrar(HISTORICO_VAZIO, { tipo: 'excluir', objetos: [o] }))!.aplicar.tipo).toBe('criar')
  })

  it('passo novo depois de desfazer apaga o que dava pra refazer', () => {
    let h = registrar(HISTORICO_VAZIO, mover)
    h = desfazer(h)!.historico
    h = registrar(h, { tipo: 'alterar', antes: { a: { y: 0 } }, depois: { a: { y: 9 } } })
    expect(h.passos).toHaveLength(1)
    expect(refazer(h)).toBeNull()
  })

  it('guarda só os campos que mudam', () => {
    expect(camposAtuais({ id: 'a', x: 1, y: 2, width: 3 } as ObjetoCena, { x: 9, width: 8 })).toEqual({ x: 1, width: 3 })
  })
})

it('caixa de seleção pega o que encosta nela, em qualquer direção', () => {
  expect(tocaNaCaixa(caixa, { x: 0, y: 0 }, { x: 150, y: 150 })).toBe(true)
  expect(tocaNaCaixa(caixa, { x: 350, y: 250 }, { x: 250, y: 150 })).toBe(true)
  expect(tocaNaCaixa(caixa, { x: 0, y: 0 }, { x: 90, y: 90 })).toBe(false)
})

describe('vários selecionados (18/10)', () => {
  const a = { id: 'a', x: 0, y: 0, width: 100, height: 100, rotation: 0 }
  const b = { id: 'b', x: 200, y: 0, width: 100, height: 100, rotation: 90 }
  it('caixa do grupo cobre todos', () => {
    expect(caixaDoGrupo([a, b])).toEqual({ x: 0, y: 0, width: 300, height: 100 })
  })
  it('encolher a caixa encolhe cada um e mantém o lugar no grupo', () => {
    const r = escalarGrupo([a, b], caixaDoGrupo([a, b]), { x: 0, y: 0, width: 150, height: 50 })
    expect(r.a).toEqual({ x: 0, y: 0, width: 50, height: 50 })
    expect(r.b).toEqual({ x: 100, y: 0, width: 50, height: 50 })
  })
  it('girar 180 troca os dois de lugar e soma o giro de cada um', () => {
    const r = girarGrupo([a, b], { x: 150, y: 50 }, 180)
    expect(r.a).toMatchObject({ x: 200, y: 0, rotation: 180 })
    expect(r.b).toMatchObject({ x: 0, y: 0, rotation: 270 })
  })
})
