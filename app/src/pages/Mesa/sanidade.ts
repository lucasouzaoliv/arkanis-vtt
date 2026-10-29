// Sanidade mexendo na tela (KAN-116, pedido da Millie 27/10, "tipo Don't Starve"): com a SAN
// baixa, a visão do jogador escurece, coisas aparecem e, bem no fim, o mapa derrete.
// Machucado (pedido 28/10): com a vida baixa a visão sangra e borra; desmaiado, quase tudo preto.
// Regras puras, testadas.

// Ajuste da Millie (28/10): com 20 de SAN a pessoa ainda está bem. Começa no 7 (escuro e as
// coisas aparecendo) e só ondula do 3 pra baixo.
export const SAN_COMECA = 7
export const SAN_ONDULA = 3

export type Loucura = {
  intensidade: number // 0 a 1: escurece e perde a cor
  ondulacao: number // 0 a 1: o mapa derretendo (só do SAN_ONDULA pra baixo)
  vultos: number // quantos vultos observando do escuro ao mesmo tempo
  coracao: boolean // zerada: tudo pulsa com o coração
}

export const SEM_LOUCURA: Loucura = { intensidade: 0, ondulacao: 0, vultos: 0, coracao: false }

const duasCasas = (n: number) => Math.round(n * 100) / 100

export function loucuraDaSanidade(atual: number, max: number | null): Loucura {
  if (!max || max <= 0 || atual > SAN_COMECA) return SEM_LOUCURA
  const san = Math.max(0, atual)
  return {
    intensidade: duasCasas(0.15 + ((SAN_COMECA - san) / SAN_COMECA) * 0.85),
    ondulacao: san > SAN_ONDULA ? 0 : duasCasas(0.3 + ((SAN_ONDULA - san) / SAN_ONDULA) * 0.7),
    // Sem sangue nem garra na sanidade (Millie 28/10): só vultos de gente parada no escuro.
    vultos: san > 5 ? 0 : san > 2 ? 1 : san > 0 ? 2 : 3,
    coracao: san <= 0,
  }
}

export type Ferimento = {
  intensidade: number // 0 a 1: a moldura de sangue fechando a visão
  borrao: number // px de desfoque no mapa
  desmaiado: boolean // PV zerado: tela quase preta
}

export const SEM_FERIMENTO: Ferimento = { intensidade: 0, borrao: 0, desmaiado: false }

// Da metade da vida pra baixo a visão sangra; de um quarto pra baixo começa a borrar.
export function ferimentoDaVida(atual: number, max: number | null): Ferimento {
  if (!max || max <= 0) return SEM_FERIMENTO
  if (atual <= 0) return { intensidade: 1, borrao: 6, desmaiado: true }
  const pct = atual / max
  if (pct > 0.5) return SEM_FERIMENTO
  const falta = (0.5 - pct) / 0.5 // 0 na metade, perto de 1 quase zerado
  return {
    intensidade: duasCasas(0.2 + falta * 0.8),
    borrao: pct > 0.25 ? 0 : duasCasas(0.6 + ((0.25 - pct) / 0.25) * 2.4),
    desmaiado: false,
  }
}
