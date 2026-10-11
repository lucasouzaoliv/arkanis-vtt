import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useVersaoDaFicha } from './fichaAoVivo'
import { efeitosValendo, type AlvoDeBonus, modsComEfeitosDoItem } from './itemMods'

// Bônus de atributo/PV/PE dos itens equipados (descrição, modificação e maldição), igual à aba
// Agente: os que valem sempre e os ligáveis que a pessoa ligou. Usado onde o atributo entra numa
// conta fora da aba Agente (Combate, Rituais).
export function useBonusDosItens(characterId: string, recarregar?: unknown): Partial<Record<AlvoDeBonus, number>> {
  const [bonus, setBonus] = useState<Partial<Record<AlvoDeBonus, number>>>({})
  const versao = useVersaoDaFicha()
  useEffect(() => {
    let cancelado = false
    supabase
      .from('character_inventory')
      .select('active_bonuses, applied_modifiers, equipment_items(description), custom_item')
      .eq('character_id', characterId)
      .eq('is_equipped', true)
      .then(({ data }) => {
        if (cancelado) return
        const porAlvo: Partial<Record<AlvoDeBonus, number>> = {}
        for (const i of (data ?? []) as any[]) {
          for (const e of efeitosValendo(i.equipment_items?.description ?? i.custom_item?.description, modsComEfeitosDoItem(i.custom_item?.stats, i.applied_modifiers), i.active_bonuses ?? [])) {
            if (e.alvo) porAlvo[e.alvo] = (porAlvo[e.alvo] ?? 0) + e.valor
          }
        }
        setBonus(porAlvo)
      })
    return () => { cancelado = true }
  }, [characterId, recarregar, versao])
  return bonus
}
