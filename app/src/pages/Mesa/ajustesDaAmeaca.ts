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
