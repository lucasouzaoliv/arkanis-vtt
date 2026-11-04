// Regras puras dos Encontros de Combate (KAN-50, spec 12.4).
import { rollAttributeTest, rollDiceFormula, trainingBonus, type Training } from '../../lib/rules'

export type FiltroElemento = 'todos' | 'conhecimento' | 'energia' | 'morte' | 'sangue' | 'medo' | 'realidade'

export const FILTROS_ELEMENTO: { id: FiltroElemento; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'conhecimento', rotulo: 'Conhecimento' },
  { id: 'energia', rotulo: 'Energia' },
  { id: 'morte', rotulo: 'Morte' },
  { id: 'sangue', rotulo: 'Sangue' },
  { id: 'medo', rotulo: 'Medo' },
  { id: 'realidade', rotulo: 'Realidade' },
]

// Cores dos elementos (as mesmas da ficha); Realidade = o cinza de "sem afinidade".
export const COR_ELEMENTO: Record<Exclude<FiltroElemento, 'todos'>, string> = {
  sangue: '#c8202b',
  morte: '#e8e8e8',
  energia: '#7b2fd6',
  conhecimento: '#e0b13a',
  medo: '#8a8a90',
  realidade: '#8b8596',
}

export type CriaturaLista = {
  id: string
  name: string
  vd: number | null
  image_url: string | null
  tipo_criatura: string | null
  tamanho: string | null
  descritores: string[] | null
  categoria: string | null
  source_id: string
  iniciativa: string | null
  pv_maximo: number | null
  owner_id?: string | null // Homebrew do mestre
}

// Elemento da criatura: o primeiro descritor que é um elemento; criatura mundana é "Realidade"
// (12.4: Realidade não é elemento, é o que é do nosso mundo — pessoas, animais…).
export function elementoDaCriatura(c: Pick<CriaturaLista, 'descritores' | 'categoria'>): Exclude<FiltroElemento, 'todos'> {
  for (const d of c.descritores ?? []) {
    const k = d.toLowerCase()
    if (k === 'sangue' || k === 'morte' || k === 'energia' || k === 'conhecimento' || k === 'medo') return k
  }
  return c.categoria === 'paranormal' ? 'medo' : 'realidade'
}

// Todos os elementos da criatura (uma pode ter mais de um), pro filtro.
export function elementosDaCriatura(c: Pick<CriaturaLista, 'descritores' | 'categoria'>): Exclude<FiltroElemento, 'todos'>[] {
  const lista = (c.descritores ?? [])
    .map((d) => d.toLowerCase())
    .filter((k): k is 'sangue' | 'morte' | 'energia' | 'conhecimento' | 'medo' => ['sangue', 'morte', 'energia', 'conhecimento', 'medo'].includes(k))
  return lista.length ? lista : [elementoDaCriatura(c)]
}

function normalizar(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function filtrarAmeacas(lista: CriaturaLista[], f: { busca: string; elemento: FiltroElemento; fonte: string | null }): CriaturaLista[] {
  const termo = normalizar(f.busca.trim())
  return lista.filter(
    (c) =>
      (!termo || normalizar(c.name).includes(termo)) &&
      (f.elemento === 'todos' || elementosDaCriatura(c).includes(f.elemento)) &&
      (!f.fonte || c.source_id === f.fonte),
  )
}

export function vdTotal(ids: string[], criaturas: Pick<CriaturaLista, 'id' | 'vd'>[]): number {
  const vd = new Map(criaturas.map((c) => [c.id, c.vd ?? 0]))
  return ids.reduce((soma, id) => soma + (vd.get(id) ?? 0), 0)
}

// O bestiário escreve os testes de vários jeitos; todos viram { dados, bonus }:
//   "+5 (2d20)" → 2 dados, +5        "+5" → 1 dado, +5
//   "1d20+15" / "+2d20+10" → 1 ou 2 dados, +15 / +10
//   "2d20+10, Visão no Escuro" → 2 dados, +10 (o resto é texto)
//   "-1 (0d20)" → 0 dados (rola 2 e fica com o menor)   "—" ou vazio → 1 dado, +0
export function lerTeste(texto: string | null | undefined): { dados: number; bonus: number } {
  if (!texto) return { dados: 1, bonus: 0 }
  const t = texto.replace(/\s+/g, '')
  const entreParenteses = /^([+-]?\d+)\((-?\d+)d20\)/i.exec(t)
  if (entreParenteses) return { dados: Number(entreParenteses[2]), bonus: Number(entreParenteses[1]) }
  const formula = /^\+?(\d+)d20([+-]\d+)?/i.exec(t)
  if (formula) return { dados: Number(formula[1]), bonus: Number(formula[2] ?? 0) }
  const numero = /^([+-]?\d+)/.exec(t)
  if (numero) return { dados: 1, bonus: Number(numero[1]) }
  return { dados: 1, bonus: 0 }
}

// Mesmo teste da ficha: d20 igual ao número de dados, fica com o maior (0 ou menos: 2 e o menor).
export function rolarTeste(t: { dados: number; bonus: number }) {
  const { rolls, kept } = rollAttributeTest(t.dados)
  return { rolls, kept, bonus: t.bonus, total: kept + t.bonus }
}

// Iniciativa do jogador: Agilidade em dados + treino + bônus extra da perícia.
export function testeDeIniciativa(agilidade: number, treino: Training, extra: number): { dados: number; bonus: number } {
  return { dados: agilidade, bonus: trainingBonus(treino) + extra }
}

// "1d4+2 perfuração" → rola e devolve o total e o tipo.
export function rolarDano(texto: string): { total: number; detalhe: string; tipo: string } | null {
  const m = /^\s*([0-9d+\-\s]+?)\s*([a-zà-ú][a-zà-ú\s]*)?$/i.exec(texto.trim())
  if (!m) return null
  const r = rollDiceFormula(m[1].replace(/\s/g, ''))
  if (!r) return null
  return { total: r.total, detalhe: `${r.rolls.join(' + ')}${r.modifier ? ` ${r.modifier > 0 ? '+' : '−'} ${Math.abs(r.modifier)}` : ''}`, tipo: (m[2] ?? '').trim() }
}

export type Combatente = {
  id: string
  combat_id: string
  tipo: 'jogador' | 'ameaca' | 'npc'
  actor_id: string | null
  character_id: string | null
  creature_id: string | null
  name: string
  image_url: string | null
  iniciativa: number
  desempate: number
  created_at: string
}

// Maior pro menor; empate decide pelo bônus e depois por quem entrou antes.
export function ordemDeIniciativa<T extends Pick<Combatente, 'iniciativa' | 'desempate' | 'created_at'>>(lista: T[]): T[] {
  return [...lista].sort((a, b) => b.iniciativa - a.iniciativa || b.desempate - a.desempate || a.created_at.localeCompare(b.created_at))
}

// "Crime +5 (2d20), Furtividade +5 (2d20)" → [{ nome: 'Crime', teste: '+5 (2d20)' }, …]
export function lerPericias(texto: string | null): { nome: string; teste: string }[] {
  if (!texto) return []
  return texto
    .split(/,(?![^(]*\))/)
    .map((p) => p.trim())
    .map((p) => {
      const m = /^(.*?)\s*([+-]\s*\d+.*)$/.exec(p)
      return m ? { nome: m[1].trim(), teste: m[2].trim() } : { nome: p, teste: '' }
    })
    .filter((p) => p.nome)
}

// Carrossel do indicador de turno: a posição de cada um em relação a quem está na vez
// (0 = no centro, positivo = os próximos, à direita; negativo = os que já foram, à esquerda).
// A fila dá a volta (é por rodada), então metade fica de cada lado.
// Cor da vida (verde cheia → vermelha quase no fim) e se desmaiou (pedido da Millie, 06/10).
export function corDaVida(atual: number, max: number | null): string {
  const f = max ? Math.max(0, Math.min(1, atual / max)) : 1
  return `hsl(${Math.round(f * 120)}, 70%, 45%)`
}

export function desmaiado(pv: [number, number | null] | null | undefined): boolean {
  return !!pv && pv[0] <= 0
}

export function posicaoNoCarrossel(indice: number, indiceAtual: number, total: number): number {
  if (total <= 0) return 0
  const frente = (((indice - indiceAtual) % total) + total) % total
  return frente > Math.floor(total / 2) ? frente - total : frente
}

// Ameaças repetidas ganham número: ["Zumbi", "Zumbi", "Cultista"] → ["Zumbi 1", "Zumbi 2", "Cultista"].
export function nomesNumerados(nomes: string[]): string[] {
  const total = new Map<string, number>()
  for (const n of nomes) total.set(n, (total.get(n) ?? 0) + 1)
  const visto = new Map<string, number>()
  return nomes.map((n) => {
    if ((total.get(n) ?? 0) < 2) return n
    const i = (visto.get(n) ?? 0) + 1
    visto.set(n, i)
    return `${n} ${i}`
  })
}

// ---- Sorteio de alvo (pedido da Millie, 01/11): o mestre sorteia quem a ameaça ataca, sem favorecer ninguém. ----

export type Sorteio = { id: string; tokens: string[]; vencedor: string }

type TokenDoSorteio = { id: string; x: number; y: number; width: number; height: number; layer: string; character_id?: string | null; actor_id?: string | null }

// O token de quem está no combate, nessa cena: pelo personagem ou pela ameaça (cada uma tem o seu ator).
export function tokenDoCombatente<T extends { character_id?: string | null; actor_id?: string | null }>(c: Pick<Combatente, 'character_id' | 'actor_id'>, tokens: T[]): T | undefined {
  return tokens.find((o) => (c.character_id && o.character_id === c.character_id) || (c.actor_id && o.actor_id === c.actor_id))
}

// Os personagens jogáveis do combate com token nessa cena (nunca ameaça nem NPC), um token por personagem,
// em volta do meio do grupo: é a ordem em que a seta gira.
export function candidatosDoSorteio(ordem: Pick<Combatente, 'tipo' | 'character_id' | 'actor_id'>[], tokens: TokenDoSorteio[]): string[] {
  const achados: TokenDoSorteio[] = []
  for (const c of ordem) {
    if (c.tipo !== 'jogador') continue
    const t = tokenDoCombatente(c, tokens.filter((o) => o.layer !== 'mestre'))
    if (t && !achados.includes(t)) achados.push(t)
  }
  const centro = (o: TokenDoSorteio) => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 })
  const meio = achados.reduce((m, o) => ({ x: m.x + centro(o).x / achados.length, y: m.y + centro(o).y / achados.length }), { x: 0, y: 0 })
  const angulo = (o: TokenDoSorteio) => Math.atan2(centro(o).y - meio.y, centro(o).x - meio.x)
  return [...achados].sort((a, b) => angulo(a) - angulo(b)).map((o) => o.id)
}

export function sortearVencedor(tokens: string[], sorteio: () => number = Math.random): string {
  return tokens[Math.floor(sorteio() * tokens.length)]
}

// A seta dá algumas voltas e para no vencedor; cada passo demora mais que o anterior.
export function passosDoSorteio(quantos: number, vencedor: number): { indice: number; ms: number }[] {
  if (quantos <= 1) return [{ indice: 0, ms: 0 }]
  const voltas = Math.max(3, Math.ceil(14 / quantos))
  const total = voltas * quantos + vencedor + 1
  return Array.from({ length: total }, (_, i) => ({ indice: i % quantos, ms: Math.round(90 + 860 * (i / (total - 1)) ** 3) }))
}
