import { describe, expect, it } from 'vitest'
import { CENARIOS, chaveDaLinha, periciasVazias } from './cenarios'
import { FICHAS_PRONTAS, fichasDoCenario, periciasDaFichaPronta } from './fichasProntas'
import { habilidadeDoCatalogo } from './habilidades'

describe('cenários', () => {
  it('cada cenário tem 20 perícias', () => {
    expect(CENARIOS.maldicao.pericias).toHaveLength(20)
    expect(CENARIOS.contos.pericias).toHaveLength(20)
  })

  it('ficha vazia: tudo no d4, no atributo-base, com uma linha por campo de Aptidão', () => {
    const linhas = periciasVazias('maldicao')
    expect(linhas.every((l) => l.dado === 4)).toBe(true)
    expect(linhas.filter((l) => l.pericia === 'aptidao').map((l) => l.campo)).toEqual(['Artes', 'Atualidades', 'Burocracia', 'Exatas', 'Humanas', 'Tática'])
    expect(linhas.find((l) => l.pericia === 'luta')?.atributo).toBe('fisico')
    expect(periciasVazias('contos').find((l) => l.pericia === 'oficio')?.campo).toBe('Metalurgia')
  })
})

describe('fichas prontas', () => {
  it('são 18: 5 no Ato I, 5 no Ato II e 8 em Contos da Vigília', () => {
    expect(FICHAS_PRONTAS).toHaveLength(18)
    expect(fichasDoCenario('maldicao', 'ato1')).toHaveLength(5)
    expect(fichasDoCenario('maldicao', 'ato2')).toHaveLength(5)
    expect(fichasDoCenario('contos')).toHaveLength(8)
  })

  it('toda perícia e habilidade citada existe no cenário da ficha', () => {
    for (const f of FICHAS_PRONTAS) {
      const chaves = new Set(periciasVazias(f.cenario).map(chaveDaLinha))
      for (const c of Object.keys(f.pericias)) expect(chaves.has(c), `${f.id}: ${c}`).toBe(true)
      for (const a of f.ajustes ?? []) expect(chaves.has(a.chave), `${f.id}: ${a.chave}`).toBe(true)
      for (const h of f.habilidades) expect(habilidadeDoCatalogo(f.cenario, h), `${f.id}: ${h}`).toBeTruthy()
    }
  })

  it('a ficha pronta sai como impressa', () => {
    const alan = periciasDaFichaPronta(FICHAS_PRONTAS.find((f) => f.id === 'alan')!)
    expect(alan.find((l) => l.pericia === 'percepcao')?.dado).toBe(8)
    expect(alan.find((l) => l.campo === 'Humanas')?.dado).toBe(6)
    expect(alan.find((l) => l.campo === 'Artes')?.dado).toBe(4)
    const cavan = periciasDaFichaPronta(FICHAS_PRONTAS.find((f) => f.id === 'cavan')!)
    expect(cavan.find((l) => l.pericia === 'inspecionar')).toMatchObject({ dado: 8, atributo: 'emocao', dadoDoAtributo: 10 })
    expect(cavan.find((l) => l.pericia === 'intuicao')).toMatchObject({ atributo: 'fisico' })
    expect(cavan.find((l) => l.pericia === 'vigor')).not.toHaveProperty('dadoDoAtributo')
  })

  it('relações com 7 pessoas em cada ficha de Contos', () => {
    for (const f of fichasDoCenario('contos')) expect(f.relacoes, f.id).toHaveLength(7)
  })
})
