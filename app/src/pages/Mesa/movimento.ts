// Movimento contado (KAN-120, pedido da Millie 27/10): ao arrastar o token, quantos metros andou
// e, no combate, quanto já andou no turno contra o deslocamento. Regras puras, testadas.

// "12m | 8", "9 m", "Voo 12m" → o primeiro número em metros (12). Sem número, null.
export function metrosDoDeslocamento(texto: string | null | undefined): number | null {
  const m = texto?.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*m\b/i)
  return m ? Number(m[1]) : null
}

// Quantos deslocamentos já gastou (1 = um movimento; passou de 2 = mais que as duas ações).
export function passouDoDeslocamento(andado: number, deslocamento: number | null): boolean {
  return deslocamento !== null && andado > deslocamento + 1e-6
}
