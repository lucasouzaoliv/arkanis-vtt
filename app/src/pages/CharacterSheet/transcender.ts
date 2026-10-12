import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useVersaoDaFicha } from './fichaAoVivo'

// Transcender (OPRPG): no NEX em que a pessoa transcende, ela pega um poder paranormal e não ganha
// a Sanidade daquele aumento. A Progressão já descontava na prévia; a ficha não (bug 12/10).

type LinhaDoPlano = { nex_percent: number; picks: { kind: string; label?: string | null }[] | null }

export function vezesQueTranscendeu(linhas: LinhaDoPlano[], nex: number): number {
  let vezes = 0
  for (const l of linhas) {
    if (l.nex_percent <= nex) vezes += (l.picks ?? []).filter((e) => e.kind === 'poder_classe' && e.label === 'Transcender').length
  }
  return vezes
}

// Quantas vezes a ficha transcendeu até o NEX atual (pela aba Progressão).
export function useTranscendencias(characterId: string, nex: number): number {
  const versao = useVersaoDaFicha()
  const [linhas, setLinhas] = useState<LinhaDoPlano[]>([])
  useEffect(() => {
    supabase.from('character_progression_picks').select('nex_percent, picks').eq('character_id', characterId)
      .then(({ data }) => setLinhas((data ?? []) as LinhaDoPlano[]))
  }, [characterId, versao])
  return vezesQueTranscendeu(linhas, nex)
}
