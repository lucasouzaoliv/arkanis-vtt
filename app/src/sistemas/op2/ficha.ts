import { DADO_BASE_DO_ATRIBUTO, periciasVazias, type Atributo, type IdCenario, type LinhaDePericia } from './cenarios'
import type { Dado } from './dados'
import { periciasDaFichaPronta, type FichaPronta, type Perfil, type Relacao } from './fichasProntas'
import { habilidadeDoCatalogo } from './habilidades'

// A ficha de Ordem Paranormal 2 como fica guardada (characters.op2). Nome, foto, PV atual e máximo
// e PD atual ficam nas colunas de sempre (name, avatar_url, current_pv, max_pv_override, current_pd),
// pra mesa (barras, combate, token) enxergar igual aos outros jogos.

export type HabilidadeNaFicha = {
  id: string
  nome: string
  texto: string
  // Estado do contador da habilidade (espaços do Ímpeto, marcadores da Análise).
  contador?: { tipo: 'espacos' | 'marcadores'; maximo: number; valor: number }
}

export type EquipamentoNaFicha = { id: string; nome: string; descricao: string; usos?: { maximo: number; gastos: number } | null }

export type FichaOP2 = {
  versao: 1
  cenario: IdCenario
  // Ficha pronta de onde veio (null = criada do zero).
  pronta: string | null
  perfil: Perfil
  vocacao: string
  nivel: number
  sobrenome?: string
  pdMaximo: number
  atributos: Record<Atributo, Dado>
  pericias: LinhaDePericia[]
  habilidades: HabilidadeNaFicha[]
  equipamentos: EquipamentoNaFicha[]
  pontosDeArmadura: number
  relacoes: Relacao[]
}

// PV e PD da ficha vazia (o playtest não tem fórmula; o site começa em 10/10).
export const PV_INICIAL = 10
export const PD_INICIAL = 10

export type FichaNova = { nome: string; pv: number; pd: number; op2: FichaOP2 }

// Ficha vazia: perfil escolhido, atributos no d6, perícias no d4, nível 1.
export function fichaVazia(cenario: IdCenario, perfil: Perfil): FichaNova {
  return {
    nome: 'Novo Agente',
    pv: PV_INICIAL,
    pd: PD_INICIAL,
    op2: {
      versao: 1, cenario, pronta: null, perfil, vocacao: '', nivel: 1, pdMaximo: PD_INICIAL,
      atributos: { fisico: DADO_BASE_DO_ATRIBUTO, mente: DADO_BASE_DO_ATRIBUTO, emocao: DADO_BASE_DO_ATRIBUTO },
      pericias: periciasVazias(cenario), habilidades: [], equipamentos: [], pontosDeArmadura: 0, relacoes: [],
    },
  }
}

// Ficha pronta: cópia do material oficial, editável depois.
export function fichaDaPronta(f: FichaPronta, novoId: () => string = () => crypto.randomUUID()): FichaNova {
  return {
    nome: f.nome,
    pv: f.pv,
    pd: f.pd,
    op2: {
      versao: 1, cenario: f.cenario, pronta: f.id, perfil: f.perfil, vocacao: f.vocacao, nivel: f.nivel, pdMaximo: f.pd,
      ...(f.sobrenome ? { sobrenome: f.sobrenome } : {}),
      atributos: { ...f.atributos },
      pericias: periciasDaFichaPronta(f),
      habilidades: f.habilidades.map((id) => {
        const h = habilidadeDoCatalogo(f.cenario, id)!
        return { id: h.id, nome: h.nome, texto: h.texto, ...(h.contador ? { contador: { ...h.contador, valor: 0 } } : {}) }
      }),
      equipamentos: (f.equipamento ?? []).map((texto) => {
        const m = /^([^(]+?)\s*(?:\((.*)\))?$/.exec(texto)
        return { id: novoId(), nome: (m?.[1] ?? texto).trim(), descricao: (m?.[2] ?? '').trim(), usos: null }
      }),
      pontosDeArmadura: 0,
      relacoes: (f.relacoes ?? []).map((r) => ({ ...r })),
    },
  }
}
