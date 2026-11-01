import { useEffect, useState } from 'react'

// Pastas minimizadas ficam minimizadas (pedido da Millie, 01/11): cada pessoa, em cada painel, guarda no
// próprio navegador. Os ids das pastas não se repetem entre campanhas, então basta uma lista por painel.
const chaveDe = (painel: string) => `arkanis-pastas-fechadas:${painel}`

export function lerPastasFechadas(painel: string): Set<string> {
  try {
    const salvo = JSON.parse(localStorage.getItem(chaveDe(painel)) ?? '[]')
    return new Set(Array.isArray(salvo) ? salvo.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function salvarPastasFechadas(painel: string, fechadas: Set<string>) {
  try {
    localStorage.setItem(chaveDe(painel), JSON.stringify([...fechadas]))
  } catch {
    // sem armazenamento: vale só até recarregar
  }
}

export function usePastasFechadas(painel: string) {
  const [fechadas, setFechadas] = useState<Set<string>>(() => lerPastasFechadas(painel))
  useEffect(() => salvarPastasFechadas(painel, fechadas), [painel, fechadas])
  return [fechadas, setFechadas] as const
}
