import { beforeEach, expect, it } from 'vitest'
import { lerPastasFechadas, salvarPastasFechadas } from './pastasFechadas'

beforeEach(() => localStorage.clear())

it('a pasta minimizada continua minimizada ao abrir de novo', () => {
  expect(lerPastasFechadas('cenas').size).toBe(0)
  salvarPastasFechadas('cenas', new Set(['a', 'b']))
  expect([...lerPastasFechadas('cenas')]).toEqual(['a', 'b'])
})

it('cada painel tem a sua lista', () => {
  salvarPastasFechadas('cenas', new Set(['a']))
  expect(lerPastasFechadas('itens').size).toBe(0)
})

it('valor estragado no navegador não quebra: abre tudo', () => {
  localStorage.setItem('arkanis-pastas-fechadas:cenas', '{isso não é json')
  expect(lerPastasFechadas('cenas').size).toBe(0)
  localStorage.setItem('arkanis-pastas-fechadas:cenas', '{"a":1}')
  expect(lerPastasFechadas('cenas').size).toBe(0)
})
