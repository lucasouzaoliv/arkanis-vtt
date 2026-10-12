// Tipos de dano do Ordem Paranormal (pedido 12/10): o campo "Tipo de Dano" vira uma lista, pra
// ninguém escrever "perfuracao"/"perfurante" e a resistência do alvo deixar de reconhecer.
export const TIPOS_DE_DANO: { id: string; rotulo: string }[] = [
  ['corte', 'Corte'], ['impacto', 'Impacto'], ['perfuracao', 'Perfuração'], ['balistico', 'Balístico'], ['fogo', 'Fogo'], ['frio', 'Frio'],
  ['quimico', 'Químico'], ['eletricidade', 'Eletricidade'], ['mental', 'Mental'], ['sangue', 'Sangue'], ['morte', 'Morte'],
  ['conhecimento', 'Conhecimento'], ['energia', 'Energia'], ['medo', 'Medo'],
].map(([id, rotulo]) => ({ id, rotulo }))

// Siglas do livro e os nomes que o pessoal usa ("contundente" é o Impacto do OP).
const SIGLAS: Record<string, string> = { c: 'corte', i: 'impacto', p: 'perfuracao', b: 'balistico', contundente: 'impacto', cortante: 'corte', perfurante: 'perfuracao', eletrico: 'eletricidade', acido: 'quimico' }

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.()]/g, '').trim()
}

// O rótulo da lista pro que já estava escrito ("perfurante", "Perf.", "P" → "Perfuração").
// Texto que não é um tipo conhecido volta null (a lista mostra ele como está, pra não sumir).
export function rotuloDoTipoDeDano(valor: string | null | undefined): string | null {
  const n = normalizar(valor ?? '')
  if (!n) return null
  const id = SIGLAS[n] ?? (n.length >= 4 ? TIPOS_DE_DANO.find((t) => t.id.slice(0, 4) === n.slice(0, 4))?.id : undefined)
  return TIPOS_DE_DANO.find((t) => t.id === id)?.rotulo ?? null
}
