import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'

// Ficha ao vivo (pedido 11/10): qualquer mudança na ficha — feita aqui, pela mesa (a ficha da mesa é
// esta mesma página num iframe) ou pelo mestre — chega pelo Realtime e sobe a "versão". Cada parte
// que carrega dados da ficha põe a versão nas dependências e recarrega sozinha.

const TABELAS = [
  'character_inventory', 'character_abilities', 'character_skills', 'character_rituals',
  'character_attacks', 'character_modifiers', 'character_progression_picks', 'character_temp_bonuses',
]

const VersaoDaFicha = createContext(0)

export function useVersaoDaFicha(): number {
  return useContext(VersaoDaFicha)
}

export function FichaAoVivo({ characterId, onPersonagemMudou, children }: { characterId: string; onPersonagemMudou: () => void; children: ReactNode }) {
  const [versao, setVersao] = useState(0)
  const avisar = useRef(onPersonagemMudou)
  avisar.current = onPersonagemMudou

  useEffect(() => {
    // Vários avisos juntos (salvar um item mexe em mais de uma linha) viram uma recarga só.
    let t: ReturnType<typeof setTimeout> | null = null
    let personagem = false
    const mudou = (doPersonagem: boolean) => {
      personagem ||= doPersonagem
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        if (personagem) avisar.current()
        personagem = false
        setVersao((v) => v + 1)
      }, 250)
    }
    let canal = supabase.channel(`ficha:${characterId}`)
    for (const tabela of TABELAS) {
      canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela, filter: `character_id=eq.${characterId}` }, () => mudou(false))
    }
    canal = canal.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters', filter: `id=eq.${characterId}` }, () => mudou(true))
    canal.subscribe()
    return () => {
      if (t) clearTimeout(t)
      supabase.removeChannel(canal)
    }
  }, [characterId])

  return <VersaoDaFicha.Provider value={versao}>{children}</VersaoDaFicha.Provider>
}
