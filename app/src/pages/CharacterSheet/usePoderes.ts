import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useVersaoDaFicha } from './fichaAoVivo'

// Nomes dos poderes/habilidades da ficha (classe, paranormais, gerais, origem, trilha e os criados
// na mão). A Defesa e os testes de resistência usam pra somar os bônus fixos (ver defesa.ts).
// `carregado` diz quando a lista chegou: antes disso a conta ainda não está completa.
export function usePoderesDaFicha(characterId: string, recarregar?: unknown): { nomes: string[]; carregado: boolean } {
  const [estado, setEstado] = useState<{ nomes: string[]; carregado: boolean }>({ nomes: [], carregado: false })
  const versao = useVersaoDaFicha()
  useEffect(() => {
    let cancelado = false
    supabase
      .from('character_abilities')
      .select('custom_ability, class_powers(name), paranormal_powers(name), general_powers(name), origins(power_name), class_track_tiers(name)')
      .eq('character_id', characterId)
      .then(({ data }) => {
        if (cancelado) return
        const nomes = (data ?? []).map((r: any) =>
          r.class_powers?.name ?? r.paranormal_powers?.name ?? r.general_powers?.name ?? r.origins?.power_name ?? r.class_track_tiers?.name ?? r.custom_ability?.name ?? '',
        ).filter(Boolean)
        setEstado({ nomes, carregado: true })
      })
    return () => { cancelado = true }
  }, [characterId, recarregar, versao])
  return estado
}

export function usePoderes(characterId: string, recarregar?: unknown): string[] {
  return usePoderesDaFicha(characterId, recarregar).nomes
}
