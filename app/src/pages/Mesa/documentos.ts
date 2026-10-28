// Documentos encontráveis (KAN-118, pedido da Millie 27/10): o mestre escreve, esconde no mapa e
// o jogador acha clicando. Regras puras, testadas.

export type EstiloDocumento = 'carta' | 'jornal' | 'relatorio' | 'diario' | 'bilhete'

export const ESTILOS_DOCUMENTO: { id: EstiloDocumento; rotulo: string; dica: string }[] = [
  { id: 'carta', rotulo: 'Carta', dica: 'Papel envelhecido, escrita à mão.' },
  { id: 'jornal', rotulo: 'Recorte de jornal', dica: 'Manchete grande e texto em colunas.' },
  { id: 'relatorio', rotulo: 'Relatório confidencial', dica: 'Máquina de escrever, carimbo da Ordem.' },
  { id: 'diario', rotulo: 'Página de diário', dica: 'Papel pautado, letra corrida.' },
  { id: 'bilhete', rotulo: 'Bilhete', dica: 'Pedaço de papel rasgado, poucas linhas.' },
]

export type Documento = {
  id: string
  campaign_id: string
  titulo: string
  estilo: EstiloDocumento
  texto: string
  assinatura: string | null
  imagem_url: string | null
  revelado_todos: boolean
  encontrado_por: string[]
  created_at: string
}

// Quem já pode ler: o mestre sempre; o jogador se achou ou se o mestre mostrou pra todos.
export function podeLer(d: Pick<Documento, 'revelado_todos' | 'encontrado_por'>, userId: string, souMestre: boolean): boolean {
  return souMestre || d.revelado_todos || d.encontrado_por.includes(userId)
}

// Documentos que o jogador acabou de ganhar (o mestre mostrou pra todos): abrem sozinhos na tela.
export function recemRevelados(antes: Documento[], agora: Documento[], userId: string): Documento[] {
  const ja = new Set(antes.filter((d) => podeLer(d, userId, false)).map((d) => d.id))
  return agora.filter((d) => d.revelado_todos && !ja.has(d.id))
}

// Texto em parágrafos (linha em branco separa).
export function paragrafos(texto: string): string[] {
  return texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

// Papel no mapa: uma folha dobrada (o jogador clica nela pra achar).
export const IMAGEM_DOCUMENTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<g transform="rotate(-8 32 32)">' +
    '<path d="M14 8h28l10 10v38H14Z" fill="#e9dcbc" stroke="#7a6640" stroke-width="1.5"/>' +
    '<path d="M42 8v10h10" fill="#cdbb8f" stroke="#7a6640" stroke-width="1.5"/>' +
    '<path d="M20 26h24M20 32h26M20 38h22M20 44h16" stroke="#8a7a5a" stroke-width="2" stroke-linecap="round"/>' +
    '</g></svg>',
)
