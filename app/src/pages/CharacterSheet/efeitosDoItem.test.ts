import { describe, expect, it } from 'vitest'
import { categoriaComMods, efeitosValendo, modsComEfeitosDoItem, somaBonuses } from './itemMods'
import { defesaDosItens } from './defesa'

const vestimenta = { efeitos: [{ alvo: 'pericia', qual: 'Diplomacia', modo: 'valor', valor: 2 }, { alvo: 'pericia', qual: 'Enganação', modo: 'valor', valor: 2, ligavel: true }] }

describe('bônus do próprio item (Vestimenta/Utensílio)', () => {
  it('perícia escolhida soma; a ligável só quando ligada', () => {
    const mods = modsComEfeitosDoItem(vestimenta, [], 'Vestimenta')
    const sempre = efeitosValendo('', mods, [])
    expect(sempre.map((e) => [e.pericias, e.valor, e.rotulo])).toEqual([[['Diplomacia'], 2, '+2 em Diplomacia']])
    expect(efeitosValendo('', mods, ['item-esc-1']).length).toBe(2)
  })
  it('não sobe a categoria nem duplica sem efeitos', () => {
    expect(categoriaComMods('I', [], modsComEfeitosDoItem(vestimenta, [], 'Vestimenta'))).toBe('I')
    expect(modsComEfeitosDoItem({}, [], 'x')).toEqual([])
  })
  it('Defesa e ataque também valem', () => {
    const escudo = { efeitos: [{ alvo: 'defesa', modo: 'valor', valor: 2 }, { alvo: 'ataque', modo: 'valor', valor: 1 }] }
    expect(defesaDosItens([{ tipo: 'geral', nome: 'Amuleto', stats: escudo, mods: [] }])).toBe(2)
    expect(somaBonuses(modsComEfeitosDoItem(escudo, [], 'Amuleto')).attackTestBonus).toBe(1)
  })
})

describe('Aprimorado ("bônus em perícia sobe pra +5")', () => {
  const aprimorado = { kind: 'modificacao' as const, name: 'Aprimorado', effect: 'Bônus em perícia sobe pra +5', elemento: null }
  const funcao = { kind: 'modificacao' as const, name: 'Função adicional', effect: '+2 numa perícia adicional', elemento: null }
  it('o +2 escolhido no item vira +5 (troca, não soma)', () => {
    const stats = { efeitos: [{ alvo: 'pericia', qual: 'Vontade', modo: 'valor', valor: 2 }] }
    const v = efeitosValendo('', modsComEfeitosDoItem(stats, [aprimorado], 'Vestimenta'), [])
    expect(v.filter((e) => e.pericias).map((e) => [e.pericias, e.valor])).toEqual([[['Vontade'], 5]])
  })
  it('sem Aprimorado continua +2; texto de Função adicional não vira bônus sozinho', () => {
    const stats = { efeitos: [{ alvo: 'pericia', qual: 'Vontade', modo: 'valor', valor: 2 }] }
    const v = efeitosValendo('', modsComEfeitosDoItem(stats, [funcao], 'Vestimenta'), [])
    expect(v.filter((e) => e.pericias).map((e) => e.valor)).toEqual([2])
  })
})

describe('bônus "uma OU outra" (Câmera: Investigação/Percepção)', () => {
  const desc = '+2 Investigação/Percepção; lanterna 9m ou visão no escuro.'
  it('nenhuma ligada: não soma em nenhuma; a pessoa escolhe', () => {
    expect(efeitosValendo(desc, [], []).filter((e) => e.pericias)).toEqual([])
  })
  it('ligar Percepção soma só em Percepção', () => {
    const v = efeitosValendo(desc, [], ['desc-pericia-0-Percepção'])
    expect(v.filter((e) => e.pericias).map((e) => [e.pericias, e.valor])).toEqual([[['Percepção'], 2]])
  })
  it('com Aprimorado a escolhida vale +5', () => {
    const aprimorado = { kind: 'modificacao' as const, name: 'Aprimorado', effect: 'Bônus em perícia sobe pra +5', elemento: null }
    const v = efeitosValendo(desc, [aprimorado], ['desc-pericia-0-Investigação'])
    expect(v.filter((e) => e.pericias).map((e) => [e.pericias, e.valor])).toEqual([[['Investigação'], 5]])
  })
  it('"as duas juntas" com Aprimorado dá +5 nas duas (pedido 12/10)', () => {
    const aprimorado = { kind: 'modificacao' as const, name: 'Aprimorado', effect: 'Bônus em perícia sobe pra +5', elemento: null }
    const v = efeitosValendo(desc, [aprimorado], ['desc-pericia-0-ambas'])
    expect(v.filter((e) => e.pericias).map((e) => [e.pericias, e.valor])).toEqual([[['Investigação', 'Percepção'], 5]])
  })
  it('"e" continua valendo nas duas', () => {
    const v = efeitosValendo('+2 Religião e Vontade.', [], [])
    expect(v.filter((e) => e.pericias).map((e) => e.pericias)).toEqual([['Religião', 'Vontade']])
  })
})
