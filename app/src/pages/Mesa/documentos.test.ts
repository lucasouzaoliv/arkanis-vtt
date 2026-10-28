import { expect, it } from 'vitest'
import { paragrafos, podeLer, recemRevelados, type Documento } from './documentos'

const doc = (id: string, c: Partial<Documento> = {}): Documento => ({
  id, campaign_id: 'k', titulo: id, estilo: 'carta', texto: '', assinatura: null, imagem_url: null, revelado_todos: false, encontrado_por: [], created_at: '', ...c,
})

it('quem pode ler um documento (KAN-118)', () => {
  expect(podeLer(doc('a'), 'u', true)).toBe(true)
  expect(podeLer(doc('a'), 'u', false)).toBe(false)
  expect(podeLer(doc('a', { encontrado_por: ['u'] }), 'u', false)).toBe(true)
  expect(podeLer(doc('a', { revelado_todos: true }), 'u', false)).toBe(true)
})

it('o que o mestre acabou de mostrar abre sozinho', () => {
  const antes = [doc('velho', { revelado_todos: true }), doc('achei', { encontrado_por: ['u'] })]
  const agora = [...antes.slice(0, 1), doc('achei', { encontrado_por: ['u'], revelado_todos: true }), doc('novo', { revelado_todos: true })]
  expect(recemRevelados(antes, agora, 'u').map((d) => d.id)).toEqual(['novo'])
})

it('parágrafos', () => {
  expect(paragrafos('Oi.\n\n  Tudo bem?\nSim.\n\n\n')).toEqual(['Oi.', 'Tudo bem?\nSim.'])
})
