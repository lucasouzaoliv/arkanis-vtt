import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { desinstalarApp, horaDaMensagem, instalarApp, naoLidas, nomeDaLoja } from './dados'

describe('apps do celular', () => {
  const novo = { instalados: ['telefone', 'mensagens', 'configuracoes', 'mapas', 'loja'] }
  it('baixa da loja e não repete', () => {
    expect(instalarApp(novo, 'galeria').instalados).toContain('galeria')
    expect(instalarApp(instalarApp(novo, 'galeria'), 'galeria').instalados.filter((a) => a === 'galeria')).toHaveLength(1)
    expect(instalarApp(novo, 'nao-existe')).toBe(novo)
  })
  it('os de fábrica não saem', () => {
    expect(desinstalarApp(novo, 'telefone')).toBe(novo)
    const comGaleria = { instalados: [...novo.instalados, 'galeria'], dock: ['telefone', 'galeria'] }
    expect(desinstalarApp(comGaleria, 'galeria')).toEqual({ instalados: novo.instalados, dock: ['telefone'] })
  })
  it('loja certa pro aparelho', () => {
    expect(nomeDaLoja('iphone')).toBe('App Store')
    expect(nomeDaLoja('android')).toBe('Play Store')
  })
})

describe('hora da mensagem', () => {
  const tempo = { modo: 'tradicional' as const, relogio: true, calendario: true, inicio: { ano: 2026, mes: 10, dia: 7, hora: 8, minuto: 0 }, minutos: 0 }
  it('usa o relógio do jogo', () => {
    // 8:00 + 947 minutos = 23:47
    expect(horaDaMensagem(tempo, 947, '2026-10-13T15:00:00Z')).toBe('23:47')
  })
  it('sem relógio na campanha, a hora real', () => {
    const d = new Date(2026, 9, 13, 9, 5)
    expect(horaDaMensagem(null, null, d.toISOString())).toBe('09:05')
  })
})

describe('não lidas', () => {
  const m = (de: string, quando: string, extra = {}) => ({ de_celular_id: de, created_at: quando, estado: 'enviada' as const, apagada: false, ...extra })
  it('conta só as dos outros depois do lido', () => {
    const lista = [
      m('eu', '2026-10-13T10:00:00Z'),
      m('ela', '2026-10-13T10:01:00Z'),
      m('ela', '2026-10-13T10:05:00Z'),
      m('ela', '2026-10-13T10:06:00Z', { apagada: true }),
      m('ela', '2026-10-13T10:07:00Z', { estado: 'pendente' }),
    ]
    expect(naoLidas(lista, 'eu', '2026-10-13T10:02:00Z')).toBe(1)
    expect(naoLidas(lista, 'eu', null)).toBe(2)
  })
})
