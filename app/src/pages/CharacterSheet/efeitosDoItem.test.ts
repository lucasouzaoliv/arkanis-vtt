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
