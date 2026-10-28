import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { inclinacao, jaLigadas, type Barbante, type Pista } from './pistas'

const normal = (p: Pista): Pista => ({ ...p, x: Number(p.x), y: Number(p.y), rotacao: Number(p.rotacao) })
function trocar<T extends { id: string }>(l: T[], x: T): T[] {
  return l.some((y) => y.id === x.id) ? l.map((y) => (y.id === x.id ? x : y)) : [...l, x]
}

// Quadro de pistas da campanha (KAN-117), em tempo real: a mesa toda mexe.
export function usePistas(campanhaId: string | undefined) {
  const [pistas, setPistas] = useState<Pista[]>([])
  const [barbantes, setBarbantes] = useState<Barbante[]>([])

  useEffect(() => {
    setPistas([])
    setBarbantes([])
    if (!campanhaId) return
    let cancelado = false
    supabase.from('clue_board_cards').select('*').eq('campaign_id', campanhaId).order('created_at').then(({ data }) => {
      if (!cancelado) setPistas(((data ?? []) as Pista[]).map(normal))
    })
    supabase.from('clue_board_links').select('*').eq('campaign_id', campanhaId).then(({ data }) => {
      if (!cancelado) setBarbantes((data ?? []) as Barbante[])
    })
    const filtro = `campaign_id=eq.${campanhaId}`
    const canal = supabase
      .channel(`pistas:${campanhaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clue_board_cards', filter: filtro }, (p) => setPistas((l) => trocar(l, normal(p.new as Pista))))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clue_board_cards', filter: filtro }, (p) => setPistas((l) => trocar(l, normal(p.new as Pista))))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'clue_board_cards' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) {
          setPistas((l) => l.filter((x) => x.id !== id))
          setBarbantes((l) => l.filter((b) => b.de !== id && b.para !== id))
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clue_board_links', filter: filtro }, (p) => setBarbantes((l) => trocar(l, p.new as Barbante)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'clue_board_links' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) setBarbantes((l) => l.filter((b) => b.id !== id))
      })
      .subscribe()
    return () => {
      cancelado = true
      supabase.removeChannel(canal)
    }
  }, [campanhaId])

  const criar = useCallback(async (campos: Pick<Pista, 'tipo' | 'x' | 'y'> & Partial<Pista>) => {
    if (!campanhaId) return
    const { data } = await supabase.from('clue_board_cards').insert({ campaign_id: campanhaId, rotacao: inclinacao(), ...campos }).select('*').single()
    if (data) setPistas((l) => trocar(l, normal(data as Pista)))
  }, [campanhaId])

  const alterar = useCallback(async (id: string, campos: Partial<Pista>, salvar = true) => {
    setPistas((l) => l.map((p) => (p.id === id ? { ...p, ...campos } : p)))
    if (salvar) await supabase.from('clue_board_cards').update(campos).eq('id', id)
  }, [])

  const excluir = useCallback(async (id: string) => {
    setPistas((l) => l.filter((p) => p.id !== id))
    setBarbantes((l) => l.filter((b) => b.de !== id && b.para !== id))
    await supabase.from('clue_board_cards').delete().eq('id', id)
  }, [])

  const ligar = useCallback(async (de: string, para: string) => {
    if (!campanhaId || de === para || jaLigadas(barbantes, de, para)) return
    const { data } = await supabase.from('clue_board_links').insert({ campaign_id: campanhaId, de, para }).select('*').single()
    if (data) setBarbantes((l) => trocar(l, data as Barbante))
  }, [campanhaId, barbantes])

  const desligar = useCallback(async (id: string) => {
    setBarbantes((l) => l.filter((b) => b.id !== id))
    await supabase.from('clue_board_links').delete().eq('id', id)
  }, [])

  return { pistas, barbantes, criar, alterar, excluir, ligar, desligar }
}
