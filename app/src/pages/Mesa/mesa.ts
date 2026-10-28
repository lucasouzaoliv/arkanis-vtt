// Regras puras da mesa (KAN-46): abas das barras, quem está conectado e como
// cada pessoa aparece no painel de sessão. Ficam fora dos componentes pra serem testadas.

export type AbaDireita =
  | 'chat'
  | 'combate'
  | 'cenas'
  | 'posicionaveis'
  | 'personagens'
  | 'itens'
  | 'diario'
  | 'playlist'
  | 'config'

export type CategoriaEsquerda = 'tokens' | 'desenho' | 'som' | 'escuridao'

// Ordem da barra direita conforme a spec (12.3 a 12.12), com o card que constrói cada uma.
export const ABAS_DIREITA: { id: AbaDireita; rotulo: string; card: string }[] = [
  { id: 'chat', rotulo: 'Mensagens de Chat', card: 'KAN-47' },
  { id: 'combate', rotulo: 'Encontros de Combate', card: 'KAN-50' },
  { id: 'cenas', rotulo: 'Cenas', card: 'KAN-48' },
  { id: 'posicionaveis', rotulo: 'Posicionáveis', card: 'KAN-53' },
  { id: 'personagens', rotulo: 'Personagens', card: 'KAN-49' },
  { id: 'itens', rotulo: 'Itens', card: 'KAN-53' },
  { id: 'diario', rotulo: 'Diário', card: 'KAN-53' },
  { id: 'playlist', rotulo: 'Lista de Reprodução', card: 'KAN-53' },
  { id: 'config', rotulo: 'Configurações', card: 'KAN-54' },
]

// Categorias da barra esquerda (12.13). Paredes e Iluminação estão fora do escopo.
export const CATEGORIAS_ESQUERDA: { id: CategoriaEsquerda; rotulo: string }[] = [
  { id: 'tokens', rotulo: 'Controles de Token' },
  { id: 'desenho', rotulo: 'Ferramentas de Desenho' },
  { id: 'som', rotulo: 'Controles de Som Ambiente' },
  { id: 'escuridao', rotulo: 'Áreas de Escuridão' },
]

// Ferramentas de cada categoria (12.13). As de desenho e som entram no KAN-52.
export const FERRAMENTAS: Record<CategoriaEsquerda, { id: string; rotulo: string }[]> = {
  tokens: [
    { id: 'selecionar', rotulo: 'Selecionar Tokens' },
    { id: 'alvos', rotulo: 'Selecionar Alvos' },
    { id: 'medir', rotulo: 'Medir Distância' },
    { id: 'molde', rotulo: 'Moldes de Área' },
  ],
  desenho: [
    { id: 'desenho-selecionar', rotulo: 'Selecionar Desenhos' },
    { id: 'retangulo', rotulo: 'Desenhar Retângulo' },
    { id: 'elipse', rotulo: 'Desenhar Elipse' },
    { id: 'poligono', rotulo: 'Desenhar Polígono' },
    { id: 'livre', rotulo: 'Desenhar à Mão Livre' },
    { id: 'texto', rotulo: 'Desenhar Texto' },
    { id: 'paleta', rotulo: 'Paleta Desenho' },
    { id: 'limpar-desenhos', rotulo: 'Limpar Desenhos' },
  ],
  som: [
    { id: 'som-selecionar', rotulo: 'Selecionar Sons Ambientes' },
    { id: 'som-desenhar', rotulo: 'Desenhar Som Ambiente' },
    { id: 'som-previsualizar', rotulo: 'Pré-visualizar Sons Ambiente' },
    { id: 'som-paleta', rotulo: 'Paleta Som Ambiente' },
    { id: 'som-limpar', rotulo: 'Limpar Sons' },
  ],
  escuridao: [
    { id: 'escuridao-selecionar', rotulo: 'Selecionar Áreas de Escuridão' },
    { id: 'escuridao-desenhar', rotulo: 'Desenhar Área de Escuridão' },
    { id: 'escuridao-limpar', rotulo: 'Limpar Áreas de Escuridão' },
  ],
}

export type Papel = 'mestre' | 'jogador'

export type Membro = {
  userId: string
  papel: Papel
  nomeConta: string
  personagem: string | null
  fotoConta?: string | null
  personagemId?: string | null
  fotoPersonagem?: string | null
}

// O que cada aba aberta da mesa anuncia no canal de presença.
export type Presenca = { userId: string }

export function primeiroNome(nome: string): string {
  const limpo = nome.trim()
  if (!limpo) return 'Sem nome'
  return limpo.split(/\s+/)[0]
}

// "Novo Agente (Millie)" — mesmo padrão do Histórico de Rolagens (5.9).
// Sem personagem na campanha, aparece só o nome da conta.
export function rotuloJogador(m: Pick<Membro, 'nomeConta' | 'personagem'>): string {
  const conta = primeiroNome(m.nomeConta)
  return m.personagem?.trim() ? `${m.personagem.trim()} (${conta})` : conta
}

// Junta os membros com quem está com a mesa aberta agora. Uma pessoa com várias abas
// abertas conta uma vez só. O mestre vem primeiro; jogadores em ordem alfabética.
export function conectados(membros: Membro[], presencas: Presenca[]): Membro[] {
  const online = new Set(presencas.map((p) => p.userId))
  return membros
    .filter((m) => online.has(m.userId))
    .sort((a, b) => {
      if (a.papel !== b.papel) return a.papel === 'mestre' ? -1 : 1
      return rotuloJogador(a).localeCompare(rotuloJogador(b), 'pt-BR')
    })
}

// Quadros por segundo a partir dos instantes (ms) dos últimos quadros desenhados.
export function calcularFps(instantes: number[]): number {
  if (instantes.length < 2) return 0
  const duracao = instantes[instantes.length - 1] - instantes[0]
  if (duracao <= 0) return 0
  return Math.round(((instantes.length - 1) * 1000) / duracao)
}

// Endereço público do site. Convite copiado enquanto se usa o site pelo computador
// (localhost) sai com ele, senão os amigos não conseguem abrir.
export const SITE_PUBLICO = 'https://arkanis-vtt.vercel.app'

export function linkDeConvite(origem: string, codigo: string): string {
  const base = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origem) ? SITE_PUBLICO : origem
  return `${base}/campanha/entrar/${codigo}`
}

// Botões da barra esquerda que fazem uma ação em vez de virar a ferramenta ativa.
export const ACOES_ESQUERDA = ['paleta', 'limpar-desenhos', 'som-paleta', 'som-limpar', 'escuridao-limpar']

// Ajuda que aparece ao passar o mouse na ferramenta (como os "Clipes de Ferramentas" do Foundry).
// Cada linha: rótulo + pedaços de texto; { k } é uma tecla/gesto, que aparece numa caixinha.
export type PecaAjuda = string | { k: string }
export const AJUDA_FERRAMENTA: Record<string, { titulo: string; linhas: [string, PecaAjuda[]][] }> = {
  'desenho-selecionar': {
    titulo: 'Selecionar Desenhos',
    linhas: [
      ['Selecionar', [{ k: 'Clique' }, ' ou ', { k: 'Clique + Arraste' }]],
      ['Selecionar Vários', [{ k: 'SHIFT + Clique' }]],
      ['Mover', [{ k: 'Arrastar' }]],
      ['Editar', [{ k: 'Clique Duplo' }]],
      ['Excluir', [{ k: 'DELETE' }]],
      ['Rotacionar', [{ k: 'SHIFT + Rolagem do Mouse' }, ' ou ', { k: 'CTRL + Rolagem do Mouse' }]],
    ],
  },
  retangulo: { titulo: 'Desenhar Retângulo', linhas: [['Desenhar', [{ k: 'Clique + Arraste' }]], ['Desenhar Proporcionalmente', [{ k: 'ALT + Clique + Arraste' }]]] },
  elipse: { titulo: 'Desenhar Elipse', linhas: [['Desenhar', [{ k: 'Clique + Arraste' }]], ['Desenhar Proporcionalmente', [{ k: 'ALT + Clique + Arraste' }]]] },
  poligono: {
    titulo: 'Desenhar Polígono',
    linhas: [['Desenhar', [{ k: 'Clique + Arraste' }, ' para começar e então ', { k: 'Clique' }, ' para adicionar pontos. ', { k: 'Clique Duplo' }, ' para finalizar.']]],
  },
  livre: { titulo: 'Desenhar à Mão Livre', linhas: [['Desenhar', [{ k: 'Clique + Arraste' }]]] },
  'som-selecionar': {
    titulo: 'Selecionar Sons Ambientes',
    linhas: [
      ['Selecionar', [{ k: 'Clique' }, ' ou ', { k: 'Clique + Arraste' }]],
      ['Selecionar Vários', [{ k: 'SHIFT + Clique' }]],
      ['Mover', [{ k: 'Arrastar' }]],
      ['Editar', [{ k: 'Clique Duplo' }]],
      ['Ligar/Desligar', [{ k: 'Clique Direito' }]],
      ['Excluir', [{ k: 'DELETE' }]],
    ],
  },
  'escuridao-selecionar': {
    titulo: 'Selecionar Áreas de Escuridão',
    linhas: [
      ['Selecionar', [{ k: 'Clique' }, ' ou ', { k: 'Clique + Arraste' }]],
      ['Selecionar Vários', [{ k: 'SHIFT + Clique' }]],
      ['Mover', [{ k: 'Arrastar' }]],
      ['Excluir', [{ k: 'DELETE' }]],
    ],
  },
  'escuridao-desenhar': {
    titulo: 'Desenhar Área de Escuridão',
    linhas: [['Desenhar a área', [{ k: 'Clique + Arraste' }]], ['Iluminar', ['A lanterna dos tokens (botão direito no token → Lanterna) ilumina dentro dela.']]],
  },
  'som-desenhar': {
    titulo: 'Desenhar Som Ambiente',
    linhas: [['Desenhar a área', [{ k: 'Clique + Arraste' }]], ['Ligar/Desligar', [{ k: 'Clique Direito' }]]],
  },
  'som-previsualizar': {
    titulo: 'Pré-visualizar Sons Ambiente',
    linhas: [['Ouvir', ['Passe o cursor sobre um som ambiente para ouvi-lo como se o seu token estivesse naquela posição.']]],
  },
  texto: {
    titulo: 'Desenhar Texto',
    linhas: [
      ['Desenhar', [{ k: 'Clique + Arraste' }]],
      ['Desenhar Proporcionalmente', [{ k: 'ALT + Clique + Arraste' }]],
      ['Editar', [{ k: 'Clique Duplo' }]],
    ],
  },
}

// Ficha que o mestre criou na mesa e deu ao jogador (Configurar Propriedade → Dono): vira o
// personagem dele na mesa, quando ele não tem um próprio na campanha (pedido da Millie, 07/10).
export function comFichasDadas(
  membros: Membro[],
  atores: { tipo: string; character_id: string | null; name: string; token_url: string | null; acesso_jogadores: Record<string, string> }[],
  fotoDaFicha: (characterId: string) => string | null = () => null,
): Membro[] {
  return membros.map((m) => {
    if (m.papel === 'mestre' || m.personagemId) return m
    const dada = atores.find((a) => a.tipo === 'npc' && a.character_id && a.acesso_jogadores[m.userId] === 'dono')
    if (!dada) return m
    return { ...m, personagem: dada.name, personagemId: dada.character_id, fotoPersonagem: fotoDaFicha(dada.character_id!) ?? dada.token_url }
  })
}
