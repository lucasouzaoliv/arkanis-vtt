import { expect, it } from 'vitest'
import { gerarNpc, textoDoNpc } from './geradorNpc'

it('gera um NPC completo (KAN-122)', () => {
  const n = gerarNpc(() => 0)
  expect(n).toMatchObject({ nome: 'Ana Silva', idade: 18 })
  expect(textoDoNpc(n)).toContain('Algo estranho: conta as pessoas')
  const outro = gerarNpc(() => 0.999)
  expect(outro.idade).toBe(77)
  expect(outro.nome).toBe('Benedito Monteiro')
})
