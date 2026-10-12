import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { vezesQueTranscendeu } from './transcender'
import { bonusDosPoderes } from './defesa'

describe('Transcender tira a Sanidade daquele NEX (bug 12/10)', () => {
  const plano = [
    { nex_percent: 15, picks: [{ kind: 'poder_classe', label: 'Transcender' }] },
    { nex_percent: 30, picks: [{ kind: 'poder_classe', label: 'Ninja Urbano' }] },
    { nex_percent: 45, picks: [{ kind: 'poder_classe', label: 'Transcender' }] },
  ]
  it('conta só até o NEX atual', () => {
    expect(vezesQueTranscendeu(plano, 10)).toBe(0)
    expect(vezesQueTranscendeu(plano, 30)).toBe(1)
    expect(vezesQueTranscendeu(plano, 50)).toBe(2)
  })
})

describe('poderes com bônus fixo em perícia (bug 12/10)', () => {
  it('Visão do Oculto dá +5 Percepção', () => {
    expect(bonusDosPoderes(['Visão do Oculto']).pericias).toEqual({ Percepção: 5 })
  })
  it('Espreitar da Besta sobe pra +10 com afinidade em Sangue', () => {
    expect(bonusDosPoderes(['Espreitar da Besta']).pericias.Furtividade).toBe(5)
    expect(bonusDosPoderes(['Espreitar da Besta'], { afinidade: 'sangue' }).pericias.Furtividade).toBe(10)
    expect(bonusDosPoderes(['Espreitar da Besta'], { afinidade: 'medo' }).pericias.Furtividade).toBe(5)
  })
  it('Sangue de Ferro só dá Fortitude com afinidade', () => {
    expect(bonusDosPoderes(['Sangue de Ferro']).pericias).toEqual({})
    expect(bonusDosPoderes(['Sangue de Ferro'], { afinidade: 'sangue' }).pericias).toEqual({ Fortitude: 5 })
  })
})
