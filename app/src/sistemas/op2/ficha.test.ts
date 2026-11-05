import { describe, expect, it } from 'vitest'
import { fichaDaPronta, fichaVazia } from './ficha'
import { FICHAS_PRONTAS } from './fichasProntas'

const pronta = (id: string) => FICHAS_PRONTAS.find((f) => f.id === id)!

describe('ficha nova do Ordem Paranormal 2', () => {
  it('vazia: perfil escolhido, atributos d6, perícias d4, nível 1, PV/PD 10', () => {
    const f = fichaVazia('contos', 'vigilante')
    expect(f).toMatchObject({ nome: 'Novo Agente', pv: 10, pd: 10 })
    expect(f.op2).toMatchObject({ cenario: 'contos', perfil: 'vigilante', nivel: 1, pronta: null, atributos: { fisico: 6, mente: 6, emocao: 6 } })
    expect(f.op2.pericias.every((l) => l.dado === 4)).toBe(true)
    expect(f.op2.habilidades).toEqual([])
  })

  it('pronta: copia tudo do material, com os contadores das habilidades zerados', () => {
    const f = fichaDaPronta(pronta('rhiona'), () => 'x')
    expect(f).toMatchObject({ nome: 'Rhiona', pv: 22, pd: 12 })
    expect(f.op2).toMatchObject({ pronta: 'rhiona', perfil: 'analista', vocacao: 'Ferreira', nivel: 3, sobrenome: 'Mac Tuirenn', atributos: { fisico: 10, mente: 6, emocao: 6 } })
    expect(f.op2.habilidades.map((h) => h.nome)).toEqual(['Análise', 'Leitura de Combate', 'Segredo do Aço'])
    expect(f.op2.habilidades[0].contador).toEqual({ tipo: 'marcadores', maximo: 4, valor: 0 })
    expect(f.op2.equipamentos).toEqual([
      { id: 'x', nome: 'Martelo de forja', descricao: 'arma corpo a corpo, dano RA+3', usos: null },
      { id: 'x', nome: 'Tenaz de ferreiro', descricao: '', usos: null },
    ])
    expect(f.op2.relacoes).toHaveLength(7)
  })

  it('Ato I sem equipamento nem relações', () => {
    const f = fichaDaPronta(pronta('alan'))
    expect(f.op2.equipamentos).toEqual([])
    expect(f.op2.relacoes).toEqual([])
    expect(f.op2.habilidades.find((h) => h.id === 'impeto')?.contador).toEqual({ tipo: 'espacos', maximo: 3, valor: 0 })
  })

  it('toda ficha pronta vira ficha sem erro', () => {
    for (const p of FICHAS_PRONTAS) expect(() => fichaDaPronta(p)).not.toThrow()
  })
})
