import { useEffect, useState } from 'react'

// Tamanho do celular na tela (pedido da Millie, 14/10): uma barra de arrastar de 100% (normal) até
// 30%. É uma preferência de quem está olhando, então fica neste navegador.
export const TAMANHO_MINIMO = 30
export const TAMANHO_MAXIMO = 100

export function prenderTamanho(v: number): number {
  return Number.isFinite(v) && v > 0 ? Math.min(TAMANHO_MAXIMO, Math.max(TAMANHO_MINIMO, Math.round(v))) : TAMANHO_MAXIMO
}
const CHAVE = 'arkanis-celular-tamanho'
const EVENTO = 'arkanis-celular-tamanho'

export function lerTamanho(): number {
  try {
    return prenderTamanho(Number(localStorage.getItem(CHAVE)))
  } catch {
    return 100
  }
}

export function salvarTamanho(valor: number) {
  const v = prenderTamanho(valor)
  try { localStorage.setItem(CHAVE, String(v)) } catch { /* sem armazenamento: vale só agora */ }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: v }))
}

export function useTamanhoDoCelular(): number {
  const [t, setT] = useState(lerTamanho)
  useEffect(() => {
    const ouvir = (e: Event) => setT(prenderTamanho(Number((e as CustomEvent).detail)))
    window.addEventListener(EVENTO, ouvir)
    return () => window.removeEventListener(EVENTO, ouvir)
  }, [])
  return t
}

// Quanto o elemento está encolhido na tela (o zoom do celular): converte o arrasto do mouse,
// que vem em pixels da tela, pros pixels de dentro do celular.
export function escalaDe(el: Element | null): number {
  if (!el) return 1
  const w = (el as HTMLElement).offsetWidth
  return w ? el.getBoundingClientRect().width / w : 1
}
