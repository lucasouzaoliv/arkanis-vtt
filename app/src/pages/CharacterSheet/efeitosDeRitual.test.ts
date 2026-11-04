import { describe, expect, it } from 'vitest'
import { camposDaPelicula, efeitoDaTelaDeRuido, extrasDaReacao } from './efeitosDeRitual'
import { lerResistenciasExtras, resistenciasFinais } from './itemMods'
import { danoNoAlvo, perfilDoAlvo } from '../Mesa/mira'

describe('Tela de Ruído', () => {
  it('normal 30/15, discente 60/30, verdadeiro nada; outro ritual nada', () => {
    expect(efeitoDaTelaDeRuido('Tela de Ruído', 'normal')).toEqual({ pvTemp: 30, resistencia: 15 })
    expect(efeitoDaTelaDeRuido('tela de ruido', 'discente')).toEqual({ pvTemp: 60, resistencia: 30 })
    expect(efeitoDaTelaDeRuido('Tela de Ruído', 'verdadeiro')).toBeNull()
    expect(efeitoDaTelaDeRuido('Cicatrização', 'normal')).toBeNull()
  })

  it('PV temporários não somam: fica o maior', () => {
    expect(camposDaPelicula(0, 30)?.temp_pv).toBe(30)
    expect(camposDaPelicula(10, 30)?.temp_pv).toBe(30)
    expect(camposDaPelicula(40, 30)).toBeNull()
    expect(camposDaPelicula(30, 60)?.temp_pv).toBe(60)
  })

  it('a reação troca a anterior e não mexe nas outras', () => {
    const outra = { id: 'x', tipo: 'Fogo', valor: 5 }
    const uma = extrasDaReacao([outra], 15, 'a')
    expect(uma).toHaveLength(2)
    const duas = extrasDaReacao(uma, 30, 'b')
    expect(duas.map((e) => e.valor)).toEqual([5, 30])
  })
})

describe('resistências na ficha', () => {
  const itens = [{ tipo: 'Corte', valor: 2 }, { tipo: 'impacto', valor: 2 }]

  it('soma com os itens pela maior de cada tipo', () => {
    const r = resistenciasFinais(itens, [{ id: 'a', tipo: 'Corte', valor: 5 }, { id: 'b', tipo: 'Fogo', valor: 3, temporaria: true }])
    expect(r).toEqual([{ tipo: 'Corte', valor: 5 }, { tipo: 'impacto', valor: 2 }, { tipo: 'Fogo', valor: 3 }])
  })

  it('dá pra tirar a que vem do item', () => {
    const r = resistenciasFinais(itens, [{ id: 'a', tipo: 'Corte', valor: 0, semItem: true }])
    expect(r).toEqual([{ tipo: 'impacto', valor: 2 }])
  })

  it('valor estragado no banco não quebra', () => {
    expect(lerResistenciasExtras(null)).toEqual([])
    expect(lerResistenciasExtras('x')).toEqual([])
    expect(lerResistenciasExtras([{ tipo: 'Fogo', valor: 3 }, { valor: 2 }, 'y'])).toHaveLength(1)
  })
})

describe('dano com as resistências e os PV temporários da ficha', () => {
  const ficha = { tipo: 'ficha' as const, nome: 'Kevin', agilidade: 1, condicoes: [], defesa_outros: 0, bloqueio: 0, itens: [] }

  it('resistência editada na ficha desconta no dano; a de Todo Dano vale em tudo', () => {
    const p = perfilDoAlvo({ ...ficha, resistencias_extras: [{ id: 'a', tipo: 'Fogo', valor: 5 }, { id: 'b', tipo: 'Dano', valor: 2 }] })
    expect(danoNoAlvo([{ valor: 10, tipo: 'Fogo' }], p).pv).toBe(5)
    expect(danoNoAlvo([{ valor: 10, tipo: 'Corte' }], p).pv).toBe(8)
  })

  it('película da Tela de Ruído só absorve dano físico', () => {
    const p = perfilDoAlvo({ ...ficha, temp_pv_tipos: ['balistico', 'corte', 'impacto', 'perfuracao'] })
    expect(danoNoAlvo([{ valor: 10, tipo: 'Corte' }], p).pvNoTemp).toBe(10)
    expect(danoNoAlvo([{ valor: 10, tipo: 'Fogo' }], p).pvNoTemp).toBe(0)
    expect(danoNoAlvo([{ valor: 10, tipo: 'Corte' }, { valor: 4, tipo: 'Fogo' }], p)).toMatchObject({ pv: 14, pvNoTemp: 10 })
  })

  it('o bloqueio tira do total sem deixar a parte absorvível maior que o dano', () => {
    const p = perfilDoAlvo({ ...ficha, temp_pv_tipos: ['corte'] })
    expect(danoNoAlvo([{ valor: 10, tipo: 'Corte' }], p, 4)).toMatchObject({ pv: 6, pvNoTemp: 6 })
  })

  it('sem restrição, nada muda: os PV temporários absorvem tudo', () => {
    expect(danoNoAlvo([{ valor: 10, tipo: 'Fogo' }], perfilDoAlvo(ficha)).pvNoTemp).toBeUndefined()
  })
})
