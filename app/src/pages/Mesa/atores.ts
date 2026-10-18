// Regras puras da aba Personagens (KAN-49 parte 2, spec 12.7).

export type TipoAtor = 'jogador' | 'npc' | 'ameaca'
export type NivelAcesso = 'nenhum' | 'limitado' | 'observador' | 'dono'

export type Variacao = { id: string; nome: string; url: string; pasta?: string | null }
export type PastaDeVariacao = { id: string; nome: string }

export type Ator = {
  id: string
  campaign_id: string
  folder_id: string | null
  tipo: TipoAtor
  character_id: string | null
  creature_id: string | null
  name: string
  token_url: string | null
  token_variacoes: Variacao[]
  token_pastas: PastaDeVariacao[]
  acesso_padrao: NivelAcesso
  acesso_jogadores: Record<string, NivelAcesso>
  mostrar_mestres: boolean
  pv_atual: number | null
  // Condições e efeitos da ameaça na mesa (18/10): cada cópia tem as suas.
  condicoes?: string[]
  condicoes_personalizadas?: unknown
  sort: number
  created_at: string
}

export const NIVEIS: { id: NivelAcesso; rotulo: string }[] = [
  { id: 'nenhum', rotulo: 'Nenhum' },
  { id: 'limitado', rotulo: 'Limitado' },
  { id: 'observador', rotulo: 'Observador' },
  { id: 'dono', rotulo: 'Dono' },
]

export const ROTULO_TIPO: Record<TipoAtor, string> = { jogador: 'Personagem de Jogador', npc: 'NPC', ameaca: 'Ameaça/Monstro' }

// Nível de acesso de um jogador a um NPC/Ameaça: o individual, se houver, senão o padrão.
export function nivelDoJogador(a: Pick<Ator, 'acesso_padrao' | 'acesso_jogadores'>, userId: string): NivelAcesso {
  return a.acesso_jogadores[userId] ?? a.acesso_padrao
}

// Personagem de jogador segue os toggles da própria ficha (5.8).
export function nivelNaFichaDoJogador(dono: boolean, ficha: { hidden_from_others: boolean; editable_by_others: boolean }): NivelAcesso {
  if (dono) return 'dono'
  if (ficha.hidden_from_others) return 'limitado'
  return ficha.editable_by_others ? 'dono' : 'observador'
}

// Imagem que vai pro mapa: o token principal; sem ele, a foto da ficha ou da criatura.
export function imagemDoToken(a: Pick<Ator, 'token_url'>, reserva: string | null): string | null {
  return a.token_url || reserva || null
}

// Todas as imagens que o token pode usar (principal primeiro), pra "Variação de Token".
export function variacoesDoToken(a: Pick<Ator, 'token_url' | 'token_variacoes'>): Variacao[] {
  const lista = a.token_url ? [{ id: 'principal', nome: 'Token Principal', url: a.token_url }] : []
  return [...lista, ...a.token_variacoes.filter((v) => v.url && v.url !== a.token_url)]
}

// Nome padrão de cada variação nova = nome do arquivo, sem extensão (como nos Posicionáveis).
// Tokens que a criatura do bestiário já traz (Biblioteca de Tokens): viram as variações do personagem.
export function variacoesDaCriatura(lista: { nome: string; url: string }[] | null | undefined): Variacao[] {
  return (lista ?? []).map((v) => ({ id: crypto.randomUUID(), nome: v.nome, url: v.url, pasta: null }))
}

export function nomeDoArquivo(nome: string): string {
  return nome.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Variação'
}

export function copiaDoAtor(a: Ator): Omit<Ator, 'id' | 'created_at' | 'character_id'> {
  const { id: _id, created_at: _c, character_id: _p, ...resto } = a
  return { ...resto, name: `${a.name} (cópia)` }
}

// Variações separadas por pasta, na ordem das pastas; as sem pasta (ou de pasta apagada) no fim.
export function agruparVariacoes(variacoes: Variacao[], pastas: PastaDeVariacao[]): { pasta: PastaDeVariacao | null; itens: Variacao[] }[] {
  const ids = new Set(pastas.map((p) => p.id))
  const grupos = pastas.map((p) => ({ pasta: p as PastaDeVariacao | null, itens: variacoes.filter((v) => v.pasta === p.id) }))
  grupos.push({ pasta: null, itens: variacoes.filter((v) => !v.pasta || !ids.has(v.pasta)) })
  return grupos
}
