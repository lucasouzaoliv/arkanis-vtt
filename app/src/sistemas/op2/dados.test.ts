import { describe, expect, it } from 'vitest'
import { avaliarTeste, danoDoAtaque, dtCrescente, passo, passosAte, rolarTeste, type DadoRolado } from './dados'

const d = (lados: DadoRolado['lados'], valor: number, origem: DadoRolado['origem'] = 'pericia'): DadoRolado => ({ lados, valor, origem })

describe('passos do dado', () => {
  it('sobe e desce na escada d4–d12, sem passar das pontas', () => {
    expect(passo(6, 1)).toBe(8)
    expect(passo(6, 2)).toBe(10)
    expect(passo(12, 1)).toBe(12)
    expect(passo(4, -1)).toBe(4)
    expect(passo(8, -1)).toBe(6)
    expect(passosAte(6, 10)).toBe(2)
    expect(passosAte(6, 4)).toBe(-1)
  })
})

describe('teste', () => {
  it('soma atributo e perícia contra DT 7', () => {
    const r = avaliarTeste([d(6, 3, 'atributo'), d(8, 5)], null)
    expect(r).toMatchObject({ total: 8, ra: 5, rb: 3, sucesso: true, sucessoCritico: false, falhaCritica: false })
    expect(avaliarTeste([d(6, 2, 'atributo'), d(4, 3)], null).sucesso).toBe(false)
  })

  it('RA e RB são o valor que saiu, não o tipo de dado', () => {
    const r = avaliarTeste([d(6, 6, 'atributo'), d(8, 3)], null)
    expect([r.ra, r.rb]).toEqual([6, 3])
  })

  it('sucesso crítico: dois dados iguais de 6 pra cima, passa mesmo com DT alta', () => {
    expect(avaliarTeste([d(8, 6, 'atributo'), d(10, 6)], null, 16)).toMatchObject({ sucessoCritico: true, sucesso: true, duasMaiores: 12 })
    expect(avaliarTeste([d(8, 5, 'atributo'), d(10, 5)], null).sucessoCritico).toBe(false)
  })

  it('falha crítica: todos 1', () => {
    expect(avaliarTeste([d(8, 1, 'atributo'), d(10, 1)], null)).toMatchObject({ falhaCritica: true, sucesso: false })
  })

  it('no máximo 4 rolados e 3 somados (os maiores)', () => {
    const r = rolarTeste({ atributo: 6, pericia: 6, bonus: [6, 6, 6] }, () => 0.5)
    expect(r.dados).toHaveLength(4)
    const s = avaliarTeste([d(6, 2, 'atributo'), d(6, 5), d(8, 7, 'bonus'), d(4, 4, 'bonus')], null)
    expect(s.total).toBe(5 + 7 + 4)
    expect(s.dados.filter((x) => x.somado).map((x) => x.valor).sort()).toEqual([4, 5, 7])
  })
})

describe('dado de pavor', () => {
  it('não soma e anula os menores que ele (exemplos do Beta)', () => {
    expect(avaliarTeste([d(8, 7, 'atributo'), d(6, 2)], d(6, 4, 'pavor')).total).toBe(7)
    expect(avaliarTeste([d(8, 6, 'atributo'), d(6, 5)], d(6, 3, 'pavor')).total).toBe(11)
    expect(avaliarTeste([d(8, 3, 'atributo'), d(6, 1)], d(6, 5, 'pavor'))).toMatchObject({ total: 0, falhaCritica: true })
  })

  it('igual ao pavor não é anulado; 1 no pavor vence o medo', () => {
    expect(avaliarTeste([d(8, 4, 'atributo'), d(6, 3)], d(6, 4, 'pavor')).total).toBe(4)
    expect(avaliarTeste([d(8, 4, 'atributo'), d(6, 3)], d(6, 1, 'pavor')).venceuOPavor).toBe(true)
  })

  it('abraçando o pavor: vira dado bônus e soma', () => {
    const r = rolarTeste({ atributo: 6, pericia: 6, pavor: 8, pavorComoBonus: true }, () => 0.99)
    expect(r.pavor).toBeNull()
    expect(r.dados.map((x) => x.lados)).toEqual([6, 6, 8])
    expect(r.total).toBe(6 + 6 + 8)
  })
})

describe('ataque e testes que sobem', () => {
  it('dano = RA + modificador; no crítico, as duas maiores', () => {
    expect(danoDoAtaque({ ra: 5, duasMaiores: 8, sucessoCritico: false }, 3)).toBe(8)
    expect(danoDoAtaque({ ra: 6, duasMaiores: 12, sucessoCritico: true }, 3)).toBe(15)
  })

  it('lesão, trauma e morte: DT 7, +3 por teste já feito na cena', () => {
    expect([0, 1, 2, 3].map((n) => dtCrescente(n))).toEqual([7, 10, 13, 16])
  })
})
