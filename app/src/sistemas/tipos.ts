// O que a mesa precisa saber de cada sistema de jogo (Ordem Paranormal hoje; outros livros/jogos
// depois). Os Itens interativos, a mira e o resto da mesa falam com o sistema só por aqui, então
// uma mesa nova é um arquivo novo nesta pasta, e o resto do código continua o mesmo.

export type Opcao = { id: string; rotulo: string }

// Teste montado a partir da ficha de um personagem: quantos dados e quanto de bônus.
// rolar: o sistema que não usa d20 (OP2: dados em passos) rola do jeito dele.
export type TesteDoPersonagem = { nome: string; dados: number; bonus: number; rolar?: () => RolagemDeTeste }

// Resultado de uma rolagem de teste.
export type RolagemDeTeste = { rolls: number[]; kept: number; bonus: number; total: number }

// Uma entrada do compêndio do sistema (equipamentos prontos dos livros).
export type EntradaCompendio = { id: string; nome: string; tipo: string; categoria: string; carga: number; descricao: string; imagem: string | null }

export type Sistema = {
  id: string
  nome: string
  pericias: string[]
  atributos: Opcao[]
  // Alcances com a distância em metros (null = pessoal/ilimitado). Usado pra conferir se o
  // token de quem interage está perto o bastante.
  alcances: (Opcao & { metros: number | null })[]
  tiposDeDano: Opcao[]
  // Recursos que curam/gastam (PV, Sanidade, PE…).
  recursos: Opcao[]
  // Como o sistema chama a "magia" (Ritual no OP) e a tabela do catálogo.
  magia: { nome: string; tabela: string }
  // Categorias de item pra requisição (OP: 0, I, II, III, IV). Vazio = o sistema não usa.
  categoriasDeItem: string[]
  // Monta o teste de uma perícia (ou só atributo) a partir da ficha do personagem.
  testeDoPersonagem(characterId: string, pericia: string, atributo?: string): Promise<TesteDoPersonagem | null>
  rolarTeste(t: Pick<TesteDoPersonagem, 'dados' | 'bonus'>): RolagemDeTeste
  // Dinheiro do personagem (Loja): nome e símbolo. Ex.: R$ 30.
  moeda: { nome: string; simbolo: string }
  // Compêndio de equipamentos dos livros (null = o sistema não tem). Itens criados a partir dele,
  // ao serem pegos, entram no inventário como o equipamento de verdade.
  compendio: { nome: string; tipos: Opcao[]; buscar(termo: string, tipo?: string, categoria?: string): Promise<EntradaCompendio[]> } | null
}
