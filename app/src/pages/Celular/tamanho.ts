import { useEffect, useState } from 'react'

// Tamanho do celular na tela (pedido da Millie, 14/10): 100% é o normal; dá pra encolher tudo.
// É uma preferência de quem está olhando, então fica neste navegador.
export const TAMANHOS = [100, 75, 50, 25, 10] as const
const CHAVE = 'arkanis-celular-tamanho'
const EVENTO = 'arkanis-celular-tamanho'

export function lerTamanho(): number {
  try {
    const v = Number(localStorage.getItem(CHAVE))
    return (TAMANHOS as readonly number[]).includes(v) ? v : 100
  } catch {
    return 100
  }
}

export function salvarTamanho(v: number) {
  try { localStorage.setItem(CHAVE, String(v)) } catch { /* sem armazenamento: vale só agora */ }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: v }))
}

export function useTamanhoDoCelular(): number {
  const [t, setT] = useState(lerTamanho)
  useEffect(() => {
    const ouvir = (e: Event) => setT(Number((e as CustomEvent).detail) || 100)
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
