// Configurações da mesa (KAN-54, prints do Foundry da Millie, 06/10). Regras puras, testadas.

// ---- Permissões dos jogadores (Configuração de Permissões de Usuários) ----
// O mestre sempre pode tudo; o jogador, o que estiver marcado (ausente = liberado).
export type Permissao = 'criarDiario' | 'pingar' | 'medir'

export const PERMISSOES: { id: Permissao; rotulo: string; descricao: string }[] = [
  { id: 'criarDiario', rotulo: 'Criar Diário', descricao: 'Permite que os jogadores criem registros no Diário (ficam donos do que criam).' },
  { id: 'pingar', rotulo: 'Pingar o Mapa', descricao: 'Permite que os jogadores usem o Ping Todos do botão direito.' },
  { id: 'medir', rotulo: 'Usar a Régua', descricao: 'Permite que os jogadores meçam distâncias com a régua.' },
]

export type PermissoesCampanha = Partial<Record<Permissao, boolean>>

export function podeJogador(p: PermissoesCampanha | null | undefined, chave: Permissao, souMestre: boolean): boolean {
  return souMestre || p?.[chave] !== false
}

// ---- Configurações da campanha (mestre) ----
export type FonteAdicional = { nome: string; url: string; peso: string; estilo: 'normal' | 'italic' }

export type ConfigCampanha = {
  fontes?: FonteAdicional[]
  // Tempo e Calendário (ver tempo.ts); ausente = desligado.
  tempo?: Partial<import('./tempo').ConfigTempo>
  combate?: { vidaNoCarrossel?: boolean; caveirasAutomaticas?: boolean }
}

export const PESOS_FONTE: { id: string; rotulo: string }[] = [
  { id: '100', rotulo: 'Thin 100' },
  { id: '300', rotulo: 'Light 300' },
  { id: '400', rotulo: 'Regular 400' },
  { id: '500', rotulo: 'Medium 500' },
  { id: '600', rotulo: 'Semibold 600' },
  { id: '700', rotulo: 'Bold 700' },
  { id: '900', rotulo: 'Black 900' },
]

export function combateDa(c: ConfigCampanha | null | undefined): { vidaNoCarrossel: boolean; caveirasAutomaticas: boolean } {
  return { vidaNoCarrossel: c?.combate?.vidaNoCarrossel !== false, caveirasAutomaticas: c?.combate?.caveirasAutomaticas !== false }
}

// Nome da família de cada fonte (sem repetir).
export function nomesDasFontes(c: ConfigCampanha | null | undefined): string[] {
  return [...new Set((c?.fontes ?? []).map((f) => f.nome.trim()).filter(Boolean))]
}

// ---- Interface do usuário (no navegador de cada um) ----
// loucura: a tela derrete com a SAN baixa (KAN-116); dá pra desligar (enjoo).
export type PreferenciasInterface = { escala: number; loucura: boolean }

export const INTERFACE_PADRAO: PreferenciasInterface = { escala: 1, loucura: true }

const CHAVE_INTERFACE = 'arkanis-interface'

export function lerInterface(): PreferenciasInterface {
  try {
    const p = { ...INTERFACE_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_INTERFACE) ?? '{}') }
    return { escala: Math.min(1.4, Math.max(0.75, Number(p.escala) || 1)), loucura: p.loucura !== false }
  } catch {
    return INTERFACE_PADRAO
  }
}

export function salvarInterface(p: PreferenciasInterface) {
  try {
    localStorage.setItem(CHAVE_INTERFACE, JSON.stringify(p))
  } catch {
    // sem armazenamento: vale só até recarregar
  }
  aplicarInterface(p)
  window.dispatchEvent(new Event('arkanis-interface'))
}

// Escala da interface: o tamanho base da fonte (tudo em rem acompanha; o mapa não muda).
export function aplicarInterface(p: PreferenciasInterface) {
  document.documentElement.style.fontSize = p.escala === 1 ? '' : `${Math.round(p.escala * 100)}%`
}

// ---- Controles (atalhos de teclado e mouse) ----
export const ATALHOS: { grupo: string; itens: { teclas: string; acao: string; mestre?: boolean }[] }[] = [
  {
    grupo: 'Mapa',
    itens: [
      { teclas: 'Botão direito + arrastar', acao: 'Mover o mapa' },
      { teclas: 'Rolagem do mouse', acao: 'Zoom' },
      { teclas: 'Botão direito', acao: 'Menu (ping, token, objeto)' },
      { teclas: 'Duplo clique', acao: 'Abrir a configuração do que foi clicado' },
    ],
  },
  {
    grupo: 'Tokens',
    itens: [
      { teclas: 'Clique / arrastar', acao: 'Selecionar / mover' },
      { teclas: 'Shift + clique', acao: 'Somar à seleção' },
      { teclas: 'Setas', acao: 'Andar um quadrado' },
      { teclas: 'Shift ou Ctrl + rolagem', acao: 'Girar' },
      { teclas: 'M', acao: 'Marcar/desmarcar como alvo' },
      { teclas: 'Delete', acao: 'Excluir (o jogador, só o próprio)' },
      { teclas: 'Esc', acao: 'Tirar a seleção / limpar alvos / apagar a régua' },
    ],
  },
  {
    grupo: 'Mestre',
    itens: [
      { teclas: 'Ctrl + C / Ctrl + V', acao: 'Copiar / colar', mestre: true },
      { teclas: 'Ctrl + Z', acao: 'Desfazer', mestre: true },
      { teclas: 'Ctrl + Y ou Ctrl + Shift + Z', acao: 'Refazer', mestre: true },
    ],
  },
  {
    grupo: 'Chat',
    itens: [
      { teclas: 'Enter', acao: 'Enviar' },
      { teclas: 'Shift + Enter', acao: 'Quebrar linha' },
      { teclas: '/r 1d20+5', acao: 'Rolar dados (/r 2d20kh1 # Ataque)' },
    ],
  },
]
