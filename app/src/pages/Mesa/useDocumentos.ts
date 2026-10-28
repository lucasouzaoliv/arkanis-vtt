import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { recemRevelados, type Documento } from './documentos'

const trocar = (l: Documento[], d: Documento) => (l.some((x) => x.id === d.id) ? l.map((x) => (x.id === d.id ? d : x)) : [...l, d])

// Documentos da campanha (KAN-118), em tempo real. O banco só manda o que a pessoa pode ler.
// onRevelado: o mestre mostrou um documento pra todos; ele abre sozinho na tela do jogador.
export function useDocumentos(campanhaId: string | undefined, userId: string, souMestre: boolean, onRevelado?: (d: Documento) => void) {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const atual = useRef<Documento[]>([])
  const avisar = useRef(onRevelado)
  avisar.current = onRevelado

  const mudar = useCallback((f: (l: Documento[]) => Documento[]) => {
    const antes = atual.current
    const depois = f(antes)
    atual.current = depois
    setDocumentos(depois)
    if (!souMestre) recemRevelados(antes, depois, userId).forEach((d) => avisar.current?.(d))
  }, [souMestre, userId])

  useEffect(() => {
    atual.current = []
    setDocumentos([])
    if (!campanhaId) return
    let cancelado = false
    supabase.from('campaign_documents').select('*').eq('campaign_id', campanhaId).order('created_at').then(({ data }) => {
      if (cancelado) return
      atual.current = (data ?? []) as Documento[]
      setDocumentos(atual.current)
    })
    const filtro = `campaign_id=eq.${campanhaId}`
    const canal = supabase
      .channel(`documentos:${campanhaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_documents', filter: filtro }, (p) => mudar((l) => trocar(l, p.new as Documento)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_documents', filter: filtro }, (p) => mudar((l) => trocar(l, p.new as Documento)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'campaign_documents' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) mudar((l) => l.filter((d) => d.id !== id))
      })
      .subscribe()
    return () => {
      cancelado = true
      supabase.removeChannel(canal)
    }
  }, [campanhaId, mudar])

  const criar = useCallback(async (campos: Partial<Documento> = {}) => {
    if (!campanhaId) return null
    const { data } = await supabase.from('campaign_documents').insert({ campaign_id: campanhaId, titulo: 'Documento sem título', ...campos }).select('*').single()
    if (data) mudar((l) => trocar(l, data as Documento))
    return (data as Documento | null) ?? null
  }, [campanhaId, mudar])

  const salvar = useCallback(async (id: string, campos: Partial<Documento>) => {
    mudar((l) => l.map((d) => (d.id === id ? { ...d, ...campos } : d)))
    await supabase.from('campaign_documents').update(campos).eq('id', id)
  }, [mudar])

  const excluir = useCallback(async (id: string) => {
    mudar((l) => l.filter((d) => d.id !== id))
    await supabase.from('campaign_documents').delete().eq('id', id)
  }, [mudar])

  // O jogador clicou no papel do mapa: acha e já devolve o documento pra abrir.
  const achar = useCallback(async (tokenId: string): Promise<Documento | null> => {
    const { data: id, error } = await supabase.rpc('achar_documento', { p_token_id: tokenId })
    if (error || !id) return null
    const { data } = await supabase.from('campaign_documents').select('*').eq('id', id).single()
    if (!data) return null
    const d = data as Documento
    // Achado aqui não "abre sozinho" de novo pelo realtime.
    atual.current = trocar(atual.current, d)
    setDocumentos(atual.current)
    return d
  }, [])

  return { documentos, criar, salvar, excluir, achar }
}
