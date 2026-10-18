import { describe, expect, it } from 'vitest'
import { bonusDeFichaDaDescricao, efeitosLigaveis, efeitosSempre, efeitosValendo } from './itemMods'

const maldicao = (name: string, effect: string) => ({ kind: 'maldicao' as const, name, effect, elemento: null })

// Textos reais do catálogo.
const PUJANCA = maldicao('Pujança', '+1 Força.')
const DESTREZA = maldicao('Destreza', '+1 Agilidade.')
const CARISMA = maldicao('Carisma', '+1 Presença (sem PE extra).')
const VITALIDADE = maldicao('Vitalidade', '+15 PV (ativa após 1 dia de uso).')
const ESFORCO = maldicao('Esforço Adicional', '+5 PE (ativa após 1 dia de uso).')
const LEPIDA = maldicao('Lépida', '+10 Atletismo, +3m deslocamento; 2 PE pra ignorar terreno difícil.')

describe('bonusDeFichaDaDescricao', () => {
  it('le bonus de atributo', () => {
    expect(bonusDeFichaDaDescricao(PUJANCA.effect)).toEqual([{ alvo: 'forca', valor: 1, condicao: '' }])
    expect(bonusDeFichaDaDescricao(DESTREZA.effect)).toEqual([{ alvo: 'agilidade', valor: 1, condicao: '' }])
    expect(bonusDeFichaDaDescricao(CARISMA.effect)).toEqual([{ alvo: 'presenca', valor: 1, condicao: '', semPe: true }])
  })

  // Carisma dá +1 Presença mas não o PE que viria dela (bug 18/10).
  it('Carisma aplicado no item marca o bonus como sem PE', () => {
    const [e] = efeitosSempre(null, [CARISMA])
    expect(e).toMatchObject({ alvo: 'presenca', valor: 1, semPe: true })
    expect(efeitosSempre(null, [PUJANCA])[0].semPe).toBeUndefined()
  })

  // "ativa após 1 dia de uso" não é algo que o app saiba medir: vira liga/desliga.
  it('"ativa apos 1 dia" marca o bonus como condicional', () => {
    const b = bonusDeFichaDaDescricao(VITALIDADE.effect)
    expect(b[0].alvo).toBe('pv')
    expect(b[0].valor).toBe(15)
    expect(b[0].condicao).toContain('ativa após 1 dia')
  })

  it('le PE tambem', () => {
    expect(bonusDeFichaDaDescricao(ESFORCO.effect)[0].alvo).toBe('pe')
  })

  it('texto sem bonus de ficha devolve vazio', () => {
    expect(bonusDeFichaDaDescricao('+2 em testes de ataque')).toEqual([])
    expect(bonusDeFichaDaDescricao(null)).toEqual([])
  })
})

describe('efeitos do item equipado', () => {
  it('atributo de maldicao vale ao equipar, sem precisar ligar', () => {
    const sempre = efeitosSempre(null, [PUJANCA])
    expect(sempre).toHaveLength(1)
    expect(sempre[0].alvo).toBe('forca')
    expect(sempre[0].rotulo).toBe('+1 Força (Pujança)')
  })

  it('Vitalidade e Esforco Adicional aparecem como ligaveis, nao somam sozinhos', () => {
    expect(efeitosSempre(null, [VITALIDADE, ESFORCO])).toEqual([])
    expect(efeitosLigaveis(null, [VITALIDADE, ESFORCO])).toHaveLength(2)
  })

  it('ligando a Vitalidade, ela passa a valer', () => {
    const chave = efeitosLigaveis(null, [VITALIDADE])[0].chave
    expect(efeitosValendo(null, [VITALIDADE], []).some((e) => e.alvo === 'pv')).toBe(false)
    expect(efeitosValendo(null, [VITALIDADE], [chave]).some((e) => e.alvo === 'pv')).toBe(true)
  })

  // A chave não é o índice: se a ordem mudar, o que estava ligado não vira outro bônus.
  it('a chave descreve a origem do bonus', () => {
    expect(efeitosLigaveis(null, [VITALIDADE])[0].chave).toContain('Vitalidade')
  })

  it('Lepida da +10 Atletismo, que e pericia, nao atributo', () => {
    const e = efeitosSempre(null, [LEPIDA])
    expect(e.some((x) => x.pericias?.includes('Atletismo'))).toBe(true)
    expect(e.some((x) => x.alvo)).toBe(false)
  })

  it('item sem nada nao gera efeito', () => {
    expect(efeitosDoNada()).toEqual([])
  })
})

function efeitosDoNada() {
  return efeitosSempre(null, [])
}
