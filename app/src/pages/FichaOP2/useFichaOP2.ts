import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { FichaOP2 } from '../../sistemas/op2/ficha'

// Colunas de sempre que a ficha do OP2 usa (a mesa lê essas).
export type ColunasOP2 = { name: string | null; avatar_url: string | null; current_pv: number | null; max_pv_override: number | null; current_pd: number | null }

export type PersonagemOP2 = ColunasOP2 & { id: string; user_id: string; campaign_id: string | null; updated_at?: string; op2: FichaOP2 }

// Estado da ficha com gravação agrupada: cada clique muda na hora na tela e o banco recebe junto,
// um pouco depois. Mudança vinda de fora (outra aba, mestre) entra quando não há nada pendente.
export function useFichaOP2(p: PersonagemOP2) {
  const [op2, setOp2] = useState<FichaOP2>(p.op2)
  const [cols, setCols] = useState<ColunasOP2>({ name: p.name, avatar_url: p.avatar_url, current_pv: p.current_pv, max_pv_override: p.max_pv_override, current_pd: p.current_pd })
  const pendente = useRef<Record<string, unknown>>({})
  const timer = useRef<number | undefined>(undefined)

  const gravar = useCallback(async () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    const campos = pendente.current
    pendente.current = {}
    if (!Object.keys(campos).length) return
    const { error } = await supabase.from('characters').update(campos).eq('id', p.id)
    if (error) {
      // Não perde a mudança: volta pra fila (sem passar por cima do que veio depois) e tenta de novo.
      pendente.current = { ...campos, ...pendente.current }
      if (timer.current === undefined) timer.current = window.setTimeout(() => void gravarRef.current(), 3000)
    }
  }, [p.id])
  const gravarRef = useRef(gravar)
  gravarRef.current = gravar

  const agendar = useCallback((campos: Record<string, unknown>) => {
    pendente.current = { ...pendente.current, ...campos }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(gravar, 400)
  }, [gravar])

  useEffect(() => () => { void gravar() }, [gravar])

  // Fechou ou trocou de aba: grava o que estiver esperando sem aguardar os 400 ms.
  useEffect(() => {
    const sumiu = () => { if (document.visibilityState === 'hidden' && timer.current !== undefined) void gravar() }
    document.addEventListener('visibilitychange', sumiu)
    window.addEventListener('pagehide', sumiu)
    return () => { document.removeEventListener('visibilitychange', sumiu); window.removeEventListener('pagehide', sumiu) }
  }, [gravar])

  // Veio coisa nova do banco e não tem nada nosso esperando: acompanha.
  useEffect(() => {
    if (timer.current !== undefined) return
    setOp2(p.op2)
    setCols({ name: p.name, avatar_url: p.avatar_url, current_pv: p.current_pv, max_pv_override: p.max_pv_override, current_pd: p.current_pd })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.updated_at])

  const mudar = useCallback((fn: (f: FichaOP2) => FichaOP2) => {
    setOp2((atual) => {
      const nova = fn(atual)
      agendar({ op2: nova })
      return nova
    })
  }, [agendar])

  const mudarColunas = useCallback((campos: Partial<ColunasOP2>) => {
    setCols((c) => ({ ...c, ...campos }))
    agendar(campos)
  }, [agendar])

  return { op2, cols, mudar, mudarColunas }
}
