import type { CondicaoPersonalizada, EfeitoEscolhido } from '../CharacterSheet/efeitosEscolhidos'

// Ajustes do mestre numa ameaça da mesa (pedido da Millie, 08/11): mexer na Defesa ou numa perícia
// de uma cópia só (ex.: a Nivea fica com -5 de Defesa quando descobrem quem ela é). Fica guardado
// como uma condição própria, "Ajustes do mestre", então vale sozinho nos testes dela, quando miram
// nela, aparece nas condições e sai inteiro clicando no X dela.

export const NOME_DOS_AJUSTES = 'Ajustes do mestre'

export type AlvoDoAjuste = { tipo: 'defesa' } | { tipo: 'pericia'; nome: string }

const mesmoAlvo = (e: EfeitoEscolhido, a: AlvoDoAjuste) =>
  e.modo === 'valor' && (a.tipo === 'defesa' ? e.alvo === 'defesa' : e.alvo === 'pericia' && (e.qual ?? '').toLowerCase() === a.nome.toLowerCase())

export function valorDoAjuste(personalizadas: CondicaoPersonalizada[], condicoes: string[], a: AlvoDoAjuste): number {
  if (!condicoes.includes(NOME_DOS_AJUSTES)) return 0
  const c = personalizadas.find((p) => p.nome === NOME_DOS_AJUSTES)
  return (c?.efeitos ?? []).filter((e) => mesmoAlvo(e, a)).reduce((s, e) => s + e.valor, 0)
}

// Troca o valor de um ajuste. Sem nenhum ajuste sobrando, a condição some.
export function comAjuste(condicoes: string[], personalizadas: CondicaoPersonalizada[], a: AlvoDoAjuste, valor: number): { condicoes: string[]; personalizadas: CondicaoPersonalizada[] } {
  const atual = condicoes.includes(NOME_DOS_AJUSTES) ? personalizadas.find((p) => p.nome === NOME_DOS_AJUSTES) : undefined
  const outros = (atual?.efeitos ?? []).filter((e) => !mesmoAlvo(e, a))
  const novo: EfeitoEscolhido | null = valor
    ? a.tipo === 'defesa' ? { alvo: 'defesa', modo: 'valor', valor } : { alvo: 'pericia', qual: a.nome, modo: 'valor', valor }
    : null
  const efeitos = novo ? [...outros, novo] : outros
  const semAjustes = personalizadas.filter((p) => p.nome !== NOME_DOS_AJUSTES)
  if (!efeitos.length) return { condicoes: condicoes.filter((c) => c !== NOME_DOS_AJUSTES), personalizadas: semAjustes }
  return {
    condicoes: condicoes.includes(NOME_DOS_AJUSTES) ? condicoes : [...condicoes, NOME_DOS_AJUSTES],
    personalizadas: [...semAjustes, { nome: NOME_DOS_AJUSTES, descricao: 'Valores mudados pelo mestre nesta ameaça.', icone: atual?.icone ?? '0', efeitos }],
  }
}

// ---- Resistências a dano da cópia (08/11) ----
// Cada ajuste troca o valor daquele tipo (0 tira); "dano" vale pra todos os tipos.
export type ResistenciaAjustada = { tipo: string; valor: number }

export const TIPOS_DE_RESISTENCIA: { id: string; nome: string }[] = [
  { id: 'dano', nome: 'Dano (todos)' },
  { id: 'corte', nome: 'Corte' }, { id: 'impacto', nome: 'Impacto' }, { id: 'perfuracao', nome: 'Perfuração' }, { id: 'balistico', nome: 'Balístico' },
  { id: 'fogo', nome: 'Fogo' }, { id: 'frio', nome: 'Frio' }, { id: 'eletricidade', nome: 'Eletricidade' }, { id: 'quimico', nome: 'Químico' },
  { id: 'mental', nome: 'Mental' }, { id: 'sangue', nome: 'Sangue' }, { id: 'morte', nome: 'Morte' }, { id: 'conhecimento', nome: 'Conhecimento' },
  { id: 'energia', nome: 'Energia' }, { id: 'medo', nome: 'Medo' },
]
export const nomeDaResistencia = (id: string) => TIPOS_DE_RESISTENCIA.find((t) => t.id === id)?.nome ?? id

export function lerResistenciasAjustadas(v: unknown): ResistenciaAjustada[] {
  if (!Array.isArray(v)) return []
  return v.filter((r) => r && typeof r.tipo === 'string' && Number.isFinite(Number(r.valor))).map((r) => ({ tipo: String(r.tipo), valor: Math.max(0, Math.round(Number(r.valor))) }))
}

// Resistências que valem (do bestiário, com os ajustes por cima).
export function resistenciasComAjustes(base: Record<string, number>, ajustes: ResistenciaAjustada[]): Record<string, number> {
  const r = { ...base }
  for (const a of ajustes) {
    if (a.valor > 0) r[a.tipo] = a.valor
    else delete r[a.tipo]
  }
  return r
}

export function comResistencia(ajustes: ResistenciaAjustada[], tipo: string, valor: number): ResistenciaAjustada[] {
  return [...ajustes.filter((a) => a.tipo !== tipo), { tipo, valor: Math.max(0, Math.round(valor) || 0) }]
}

export const textoDasResistencias = (r: Record<string, number>) =>
  Object.entries(r).sort(([a], [b]) => (a === 'dano' ? -1 : b === 'dano' ? 1 : nomeDaResistencia(a).localeCompare(nomeDaResistencia(b)))).map(([t, v]) => `${nomeDaResistencia(t)} ${v}`).join(', ')
