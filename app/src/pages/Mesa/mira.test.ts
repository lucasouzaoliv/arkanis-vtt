import { describe, expect, it } from 'vitest'
import { ataqueDaCriatura, curaDoTexto, danoNoAlvo, defesaDoAlvo, lerResistenciasDaCriatura, partesDoDanoEmTexto, perfilDoAlvo, rolarDanoDoAtaque, textoDosAlvos, tipoDeDano } from './mira'

describe('tipos de dano', () => {
  it('siglas e acentos viram a mesma chave', () => {
    expect(tipoDeDano('P')).toBe('perfuracao')
    expect(tipoDeDano('Perfuração')).toBe('perfuracao')
    expect(tipoDeDano('balístico')).toBe('balistico')
    expect(tipoDeDano('Sangue')).toBe('sangue')
    expect(tipoDeDano('')).toBe('')
  })
})

describe('resistências do bestiário', () => {
  it('o número vale pra todos os tipos antes dele', () => {
    const p = lerResistenciasDaCriatura('Balístico, impacto e perfuração 10, Sangue 20', 'Morte')
    expect(p.resist).toEqual({ balistico: 10, impacto: 10, perfuracao: 10, sangue: 20 })
    expect(p.vulneravel).toEqual(['morte'])
  })

  it('barras, ponto e vírgula, imunidade e "Dano" geral', () => {
    const p = lerResistenciasDaCriatura('Balístico, corte, impacto e perfuração 10, Conhecimento/Energia/químico 20; imune a fogo', 'Fogo, frio e Sangue')
    expect(p.resist.conhecimento).toBe(20)
    expect(p.resist.quimico).toBe(20)
    expect(p.imune).toEqual(['fogo'])
    expect(p.vulneravel).toEqual(['fogo', 'frio', 'sangue'])
    expect(lerResistenciasDaCriatura('Dano 50', null).resist).toEqual({ dano: 50 })
  })

  it('imune a dano exceto um elemento', () => {
    const p = lerResistenciasDaCriatura('Imune a dano (exceto Conhecimento) e a todas as condições', null)
    expect(p.imuneExceto).toEqual(['conhecimento'])
    expect(danoNoAlvo([{ valor: 30, tipo: 'corte' }], p).pv).toBe(0)
    expect(danoNoAlvo([{ valor: 30, tipo: 'Conhecimento' }], p).pv).toBe(30)
  })

  it('sem número não chuta', () => {
    expect(lerResistenciasDaCriatura('Dano (exceto Conhecimento)', null).resist).toEqual({})
  })
})

describe('dano no alvo', () => {
  const perfil = lerResistenciasDaCriatura('Corte 5, Dano 2', 'Sangue')
  it('resistência do tipo (a maior entre ela e a geral) tira de cada parte', () => {
    expect(danoNoAlvo([{ valor: 12, tipo: 'C' }], perfil)).toMatchObject({ pv: 7 })
    expect(danoNoAlvo([{ valor: 12, tipo: 'impacto' }], perfil)).toMatchObject({ pv: 10 })
  })
  it('vulnerável dobra antes da resistência', () => {
    expect(danoNoAlvo([{ valor: 6, tipo: 'Sangue' }], perfil).pv).toBe(10)
  })
  it('nunca fica negativo; Bloqueio tira do total; mental vai pra Sanidade', () => {
    expect(danoNoAlvo([{ valor: 3, tipo: 'corte' }], perfil).pv).toBe(0)
    expect(danoNoAlvo([{ valor: 10, tipo: 'impacto' }], perfil, 5).pv).toBe(3)
    expect(danoNoAlvo([{ valor: 8, tipo: 'mental' }, { valor: 4, tipo: '' }], perfilDoAlvo({ tipo: 'nenhum', nome: 'x' }))).toMatchObject({ pv: 4, san: 8 })
  })
})

describe('alvo com ficha', () => {
  const ficha = {
    tipo: 'ficha' as const, nome: 'Arthur', agilidade: 2, condicoes: ['Vulnerável'], defesa_outros: 1, bloqueio: 4,
    itens: [{ tipo: 'protecao', stats: { defesa: 5, resistencia: { corte: 2, impacto: 2 } }, mods: [] }, { tipo: 'arma', stats: { defesa: 9 }, mods: [] }],
  }
  it('Defesa igual à da ficha (proteção sim, arma não, condição conta)', () => {
    expect(defesaDoAlvo(ficha)).toBe(10 + 2 + 5 + 1 - 2)
  })
  it('resistência dos itens equipados', () => {
    expect(perfilDoAlvo(ficha).resist).toEqual({ corte: 2, impacto: 2 })
  })
  it('criatura usa a Defesa do bestiário; token sem ficha não tem', () => {
    expect(defesaDoAlvo({ tipo: 'criatura', nome: 'z', defesa: 18, resistencias: null, vulnerabilidades: null })).toBe(18)
    expect(defesaDoAlvo({ tipo: 'nenhum', nome: 'x' })).toBeNull()
  })
  it('condição na ameaça mexe na Defesa dela (18/10)', () => {
    const z = { tipo: 'criatura' as const, nome: 'z', defesa: 18, resistencias: null, vulnerabilidades: null }
    expect(defesaDoAlvo({ ...z, condicoes: ['Vulnerável'] })).toBe(16)
    expect(defesaDoAlvo({ ...z, condicoes: ['Desprevenido'] })).toBe(13)
    expect(defesaDoAlvo({ ...z, condicoes: ['Marcado'], condicoes_personalizadas: [{ nome: 'Marcado', efeitos: [{ alvo: 'defesa', valor: -3, modo: 'valor' }] }] })).toBe(15)
  })
})

describe('ataque da ameaça', () => {
  it('lê teste, crítico e dano', () => {
    expect(ataqueDaCriatura('Garra', '+10 (2d20), crítico 19/x3', '1d6+9 corte')).toEqual({
      nome: 'Garra', dados: 2, bonus: 10, margem: 19, multiplicador: 3, partes: [{ formula: '1d6+9', tipo: 'corte' }], bonus_dano: 0, corpo: true,
    })
    expect(ataqueDaCriatura('Tiro', '+17 (2d20), crítico x3', '4d6+12 balístico')).toMatchObject({ margem: 20, multiplicador: 3, corpo: false })
    expect(ataqueDaCriatura('Mordida', '+5', '1d4+2 perfuração')).toMatchObject({ dados: 1, margem: 20, multiplicador: 2 })
  })
  it('dano com mais de uma parte e texto entre parênteses', () => {
    expect(partesDoDanoEmTexto('1d6+9 corte mais 2d6 Sangue')).toEqual([{ formula: '1d6+9', tipo: 'corte' }, { formula: '2d6', tipo: 'Sangue' }])
    expect(partesDoDanoEmTexto('8d6 impacto (Reflexos DT 19 reduz à metade)')).toEqual([{ formula: '8d6', tipo: 'impacto' }])
    expect(ataqueDaCriatura('x', '+5', 'veja o texto')).toBeNull()
  })
})

it('crítico multiplica só os dados', () => {
  const r = rolarDanoDoAtaque({ nome: 'x', dados: 1, bonus: 0, margem: 20, multiplicador: 3, partes: [{ formula: '1d1+5', tipo: 'corte' }], bonus_dano: 2 }, true)
  expect(r.dados).toHaveLength(3)
  expect(r.total).toBe(3 + 5 + 2)
})

it('nomes dos alvos', () => {
  expect(textoDosAlvos([{ token_id: '1', nome: 'Maria' }])).toBe('Maria')
  expect(textoDosAlvos([{ token_id: '1', nome: 'Maria' }, { token_id: '2', nome: 'Pedro' }, { token_id: '3', nome: 'Zumbi' }])).toBe('Maria, Pedro e Zumbi')
})

describe('cura no texto', () => {
  it('ritual e item', () => {
    expect(curaDoTexto('O alvo recupera 3d8+3 PV, mas envelhece 1 ano automaticamente.')).toEqual({ formula: '3d8+3', recurso: 'pv' })
    expect(curaDoTexto('aumenta a cura para 5d8+5 PV. Requer 2º círculo.')).toEqual({ formula: '5d8+5', recurso: 'pv' })
    expect(curaDoTexto('Ação padrão pra curar 2d8+2 PV em si ou ser adjacente.')).toEqual({ formula: '2d8+2', recurso: 'pv' })
    expect(curaDoTexto('Ação padrão consome, recupera 1d4 PE.')).toEqual({ formula: '1d4', recurso: 'pe' })
    expect(curaDoTexto('recupera 2d6 pontos de Sanidade')).toEqual({ formula: '2d6', recurso: 'san' })
  })
  it('dano e cura sem dados não contam', () => {
    expect(curaDoTexto('causando 6d6 pontos de dano de Sangue. Você então absorve esse sangue, recuperando pontos de vida iguais à metade do dano causado.')).toBeNull()
    expect(curaDoTexto('8d6 dano de Energia')).toBeNull()
  })
})

it('crítico não multiplica o dano extra de encanto', () => {
  const r = rolarDanoDoAtaque({ nome: 'x', dados: 1, bonus: 0, margem: 20, multiplicador: 3, bonus_dano: 0,
    partes: [{ formula: '1d6', tipo: 'I' }, { formula: '4d6', tipo: 'Energia', origem: 'Amaldiçoar Arma', elemento: 'Energia' }] }, true)
  expect(r.dados).toHaveLength(3 + 4)
})
