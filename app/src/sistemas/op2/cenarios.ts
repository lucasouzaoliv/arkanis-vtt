import type { Dado } from './dados'

// Os dois cenários dos playtests de Ordem Paranormal 2. A lista de perícias muda de um pro outro,
// então ela é dado do cenário, não do código. Os nomes seguem as fichas oficiais (que valem sobre
// o texto do livro, ver VTT_Especificacao_Funcional 13.3).

export type Atributo = 'fisico' | 'mente' | 'emocao'
export type IdCenario = 'maldicao' | 'contos'

export const ATRIBUTOS: { id: Atributo; nome: string }[] = [
  { id: 'fisico', nome: 'Físico' },
  { id: 'mente', nome: 'Mente' },
  { id: 'emocao', nome: 'Emoção' },
]

// Atributo começa no d6 (média humana); perícia no d4 (destreinado).
export const DADO_BASE_DO_ATRIBUTO: Dado = 6
export const DADO_BASE_DA_PERICIA: Dado = 4

export type PericiaDoCenario = {
  id: string
  nome: string
  atributo: Atributo
  // Perícia com campos (Aptidão, Ofício): uma linha por campo, cada uma com o próprio dado.
  campos?: string[]
}

export type Cenario = {
  id: IdCenario
  nome: string
  // Maldição do Ídolo de Pedra tem dois atos; Contos da Vigília não.
  atos: { id: string; nome: string }[]
  // Como o livro chama o segundo rótulo do personagem.
  rotuloDaVocacao: string
  pericias: PericiaDoCenario[]
}

const p = (id: string, nome: string, atributo: Atributo, campos?: string[]): PericiaDoCenario => ({ id, nome, atributo, ...(campos ? { campos } : {}) })

export const CENARIOS: Record<IdCenario, Cenario> = {
  maldicao: {
    id: 'maldicao',
    nome: 'Maldição do Ídolo de Pedra',
    atos: [{ id: 'ato1', nome: 'Ato I' }, { id: 'ato2', nome: 'Ato II' }],
    rotuloDaVocacao: 'Ocupação',
    pericias: [
      p('acrobacia', 'Acrobacia', 'fisico'),
      p('aptidao', 'Aptidão', 'mente', ['Artes', 'Atualidades', 'Burocracia', 'Exatas', 'Humanas', 'Tática']),
      p('atletismo', 'Atletismo', 'fisico'),
      p('crime', 'Crime', 'fisico'),
      p('disciplina', 'Disciplina', 'emocao'),
      p('enganacao', 'Enganação', 'emocao'),
      p('furtividade', 'Furtividade', 'fisico'),
      p('intimidar', 'Intimidar', 'emocao'),
      p('intuicao', 'Intuição', 'emocao'),
      p('luta', 'Luta', 'fisico'),
      p('maquinas', 'Máquinas', 'mente'),
      p('medicina', 'Medicina', 'mente'),
      p('ocultismo', 'Ocultismo', 'mente'),
      p('percepcao', 'Percepção', 'mente'),
      p('persuasao', 'Persuasão', 'emocao'),
      p('pesquisar', 'Pesquisar', 'mente'),
      p('pontaria', 'Pontaria', 'fisico'),
      p('sobrevivencia', 'Sobrevivência', 'mente'),
      p('tecnologia', 'Tecnologia', 'mente'),
      p('vigor', 'Vigor', 'fisico'),
    ],
  },
  contos: {
    id: 'contos',
    nome: 'Contos da Vigília',
    atos: [],
    rotuloDaVocacao: 'Vocação',
    pericias: [
      p('acrobacia', 'Acrobacia', 'fisico'),
      p('animais', 'Animais', 'emocao'),
      p('aptidao', 'Aptidão', 'mente', ['Artes', 'Erudição', 'Folclore', 'Guerra', 'Nobreza', 'Religião']),
      p('atletismo', 'Atletismo', 'fisico'),
      p('crime', 'Crime', 'fisico'),
      p('disciplina', 'Disciplina', 'emocao'),
      p('enganacao', 'Enganação', 'emocao'),
      p('furtividade', 'Furtividade', 'fisico'),
      p('inspecionar', 'Inspecionar', 'mente'),
      p('intimidar', 'Intimidar', 'emocao'),
      p('intuicao', 'Intuição', 'emocao'),
      p('luta', 'Luta', 'fisico'),
      p('medicina', 'Medicina', 'mente'),
      p('ocultismo', 'Ocultismo', 'mente'),
      p('oficio', 'Ofício', 'mente', ['Metalurgia']),
      p('percepcao', 'Percepção', 'mente'),
      p('persuasao', 'Persuasão', 'emocao'),
      p('pontaria', 'Pontaria', 'fisico'),
      p('sobrevivencia', 'Sobrevivência', 'mente'),
      p('vigor', 'Vigor', 'fisico'),
    ],
  },
}

// Uma linha de perícia na ficha. dadoDoAtributo só existe nas fichas prontas que vieram impressas
// com um segundo dado diferente do atributo da ficha (decisão da Millie: copiar como impresso).
export type LinhaDePericia = {
  pericia: string
  campo?: string
  dado: Dado
  atributo: Atributo
  dadoDoAtributo?: Dado
}

export const chaveDaLinha = (l: Pick<LinhaDePericia, 'pericia' | 'campo'>) => (l.campo ? `${l.pericia}:${l.campo}` : l.pericia)

export function nomeDaLinha(cenario: IdCenario, l: Pick<LinhaDePericia, 'pericia' | 'campo'>): string {
  const nome = CENARIOS[cenario].pericias.find((x) => x.id === l.pericia)?.nome ?? l.pericia
  return l.campo ? `${nome} (${l.campo})` : nome
}

// Ficha vazia: todas as perícias do cenário no d4, cada uma no seu atributo-base; Aptidão e Ofício
// com uma linha por campo.
export function periciasVazias(cenario: IdCenario): LinhaDePericia[] {
  return CENARIOS[cenario].pericias.flatMap((x) =>
    x.campos
      ? x.campos.map((campo) => ({ pericia: x.id, campo, dado: DADO_BASE_DA_PERICIA, atributo: x.atributo }))
      : [{ pericia: x.id, dado: DADO_BASE_DA_PERICIA, atributo: x.atributo }],
  )
}
