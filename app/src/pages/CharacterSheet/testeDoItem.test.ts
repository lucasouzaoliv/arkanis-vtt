import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { escolhaDoTeste } from './testeDoItem'

const ids = (nome: string) => ({ Luta: 'luta-id', Pontaria: 'pontaria-id' })[nome] ?? null

describe('teste de ataque escolhido no item (pedido 12/10)', () => {
  it('sem escolha: corpo a corpo é Luta/Força, o resto Pontaria/Agilidade', () => {
    expect(escolhaDoTeste({}, true, ids)).toEqual({ skill_id: 'luta-id', attribute: 'forca', damage_attribute: null, sem_atributo_no_dano: false })
    expect(escolhaDoTeste({}, false, ids)).toMatchObject({ skill_id: 'pontaria-id', attribute: 'agilidade' })
  })

  it('Luta com Agilidade e nada somado no dano', () => {
    const t = escolhaDoTeste({ pericia_ataque: 'luta-id', atributo_ataque: 'agilidade', atributo_dano: 'nenhum' }, true, ids)
    expect(t).toEqual({ skill_id: 'luta-id', attribute: 'agilidade', damage_attribute: null, sem_atributo_no_dano: true })
  })

  it('atributo de dano escolhido vai pro ataque', () => {
    expect(escolhaDoTeste({ atributo_dano: 'agilidade' }, true, ids).damage_attribute).toBe('agilidade')
  })
})
