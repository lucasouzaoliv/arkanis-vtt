import { expect, it } from 'vitest'
import { sistemaDe } from './index'

it('Ordem Paranormal 2 na mesa: PV e PD, perícias dos dois cenários', () => {
  const s = sistemaDe('ordem_paranormal_2')
  expect(s.nome).toBe('Ordem Paranormal 2')
  expect(s.recursos.map((r) => r.rotulo)).toEqual(['PV', 'PD'])
  expect(s.atributos.map((a) => a.id)).toEqual(['fisico', 'mente', 'emocao'])
  expect(s.pericias).toContain('Aptidão (Guerra)')
  expect(s.pericias).toContain('Máquinas')
  expect(s.pericias).toContain('Animais')
  expect(new Set(s.pericias).size).toBe(s.pericias.length)
  const r = s.rolarTeste({ dados: 1, bonus: 0 })
  expect(r.total).toBeGreaterThanOrEqual(2)
  expect(r.total).toBeLessThanOrEqual(10)
  // Jogo desconhecido continua caindo no Ordem 1.
  expect(sistemaDe('outro').id).toBe('ordem_paranormal')
})
