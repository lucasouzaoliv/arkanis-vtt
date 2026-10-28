import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { ObjetoCena } from './cenas'
import type { CamposObjeto } from './tokens'

const CAMPOS =
  'id, scene_id, campaign_id, name, image_url, x, y, width, height, rotation, layer, sort, locked, flip_h, flip_v, character_id, group_id, actor_id, move_permission, movable_by, luz, lanterna, lanterna_ajuste, lanterna_estado, nota, documento_id, luz_ajuste, efeito, so_uv, item_id, created_at'

export type Ping = { id: string; x: number; y: number; foco: boolean; nome: string }

// Régua de alguém medindo distância (12.13), vista ao vivo por todos. pontos null = apagou.
export type Regua = { userId: string; nome: string; pontos: { x: number; y: number }[] | null }

function trocar(lista: ObjetoCena[], o: ObjetoCena): ObjetoCena[] {
  return lista.some((x) => x.id === o.id) ? lista.map((x) => (x.id === o.id ? o : x)) : [...lista, o]
}

function numeros(o: ObjetoCena): ObjetoCena {
  // numeric vem como string do Postgres em algumas leituras
  return { ...o, x: Number(o.x), y: Number(o.y), width: Number(o.width), height: Number(o.height), rotation: Number(o.rotation) }
}

// Objetos (imagens e tokens) da cena que esta pessoa está vendo, em tempo real.
// Arrastar e pings passam por broadcast (ao vivo, sem gravar); soltar grava no banco.
export function useObjetos(cenaId: string | null, onPing: (p: Ping) => void) {
  const [objetos, setObjetos] = useState<ObjetoCena[]>([])
  const [reguas, setReguas] = useState<Record<string, Regua>>({})
  const canalRef = useRef<RealtimeChannel | null>(null)
  const pingRef = useRef(onPing)
  pingRef.current = onPing

  useEffect(() => {
    setObjetos([])
    setReguas({})
    if (!cenaId) return
    let cancelado = false
    supabase
      .from('scene_tokens')
      .select(CAMPOS)
      .eq('scene_id', cenaId)
      .then(({ data }) => {
        if (!cancelado) setObjetos(((data ?? []) as ObjetoCena[]).map(numeros))
      })

    const filtro = `scene_id=eq.${cenaId}`
    const canal = supabase
      .channel(`objetos:${cenaId}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scene_tokens', filter: filtro }, (p) => setObjetos((l) => trocar(l, numeros(p.new as ObjetoCena))))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scene_tokens', filter: filtro }, (p) => setObjetos((l) => trocar(l, numeros(p.new as ObjetoCena))))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'scene_tokens' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) setObjetos((l) => l.filter((o) => o.id !== id))
      })
      // Alguém está arrastando: mostra o movimento ao vivo (12.8).
      .on('broadcast', { event: 'arrastando' }, ({ payload }) => {
        const posicoes = payload as Record<string, { x: number; y: number }>
        setObjetos((l) => l.map((o) => (posicoes[o.id] ? { ...o, ...posicoes[o.id] } : o)))
      })
      .on('broadcast', { event: 'ping' }, ({ payload }) => pingRef.current(payload as Ping))
      .on('broadcast', { event: 'regua' }, ({ payload }) => {
        const r = payload as Regua
        setReguas((m) => {
          const { [r.userId]: _, ...resto } = m
          return r.pontos ? { ...resto, [r.userId]: r } : resto
        })
      })
      .subscribe()
    canalRef.current = canal

    return () => {
      cancelado = true
      canalRef.current = null
      supabase.removeChannel(canal)
    }
  }, [cenaId])

  const transmitirArrasto = useCallback((posicoes: Record<string, { x: number; y: number }>) => {
    canalRef.current?.send({ type: 'broadcast', event: 'arrastando', payload: posicoes })
  }, [])

  const transmitirRegua = useCallback((r: Regua) => {
    canalRef.current?.send({ type: 'broadcast', event: 'regua', payload: r })
  }, [])

  const pingar = useCallback((p: Ping) => {
    pingRef.current(p)
    canalRef.current?.send({ type: 'broadcast', event: 'ping', payload: p })
  }, [])

  const criar = useCallback(async (dados: Partial<ObjetoCena> & Pick<ObjetoCena, 'scene_id' | 'campaign_id' | 'image_url'>) => {
    const { data } = await supabase.from('scene_tokens').insert({ sort: Date.now() % 2147483647, ...dados }).select(CAMPOS).single()
    const novo = data ? numeros(data as ObjetoCena) : null
    if (novo) setObjetos((l) => trocar(l, novo))
    return novo
  }, [])

  // Recria objetos inteiros (Colar, ou desfazer uma exclusão — com o mesmo id).
  const criarVarios = useCallback(async (lista: ObjetoCena[]) => {
    if (!lista.length) return []
    const { data } = await supabase.from('scene_tokens').insert(lista).select(CAMPOS)
    const novos = ((data ?? []) as ObjetoCena[]).map(numeros)
    setObjetos((l) => novos.reduce(trocar, l))
    return novos
  }, [])

  // Atualiza na tela na hora (arrastar fica liso) e, se pedido, grava no banco (só o mestre).
  const alterarVarios = useCallback(async (mudancas: Record<string, CamposObjeto>, salvar = true) => {
    setObjetos((l) => l.map((o) => (mudancas[o.id] ? { ...o, ...mudancas[o.id] } : o)))
    if (!salvar) return
    await Promise.all(Object.entries(mudancas).map(([id, campos]) => supabase.from('scene_tokens').update(campos).eq('id', id)))
  }, [])

  // Jogador move pela função do banco, que confere a permissão e só mexe na posição.
  const moverComoJogador = useCallback(async (ids: string[], dx: number, dy: number) => {
    const { error } = await supabase.rpc('mover_objetos', { p_ids: ids, p_dx: dx, p_dy: dy })
    return !error
  }, [])

  // Dono do token redimensiona e gira pela função do banco (12.8).
  const transformarComoJogador = useCallback(async (o: Pick<ObjetoCena, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation'>) => {
    const { error } = await supabase.rpc('transformar_objeto', { p_id: o.id, p_x: o.x, p_y: o.y, p_largura: o.width, p_altura: o.height, p_rotacao: o.rotation })
    return !error
  }, [])

  // Dono do token vira na horizontal/vertical pela função do banco (12.8).
  const virarComoJogador = useCallback(async (id: string, flipH: boolean, flipV: boolean) => {
    const { error } = await supabase.rpc('virar_objeto', { p_id: id, p_flip_h: flipH, p_flip_v: flipV })
    return !error
  }, [])

  // Dono do token liga/desliga a lanterna pela função do banco.
  const lanternaComoJogador = useCallback(async (id: string, lanterna: 'comum' | 'uv' | null) => {
    const { error } = await supabase.rpc('lanterna_do_objeto', { p_id: id, p_lanterna: lanterna })
    return !error
  }, [])

  // Configurar Lanterna (dono do token): guarda a seta e liga a lanterna.
  const ajustarLanternaComoJogador = useCallback(async (id: string, ajuste: { ox: number; oy: number; angulo: number }, lanterna: 'comum' | 'uv') => {
    const { error } = await supabase.rpc('ajustar_lanterna', { p_id: id, p_ajuste: ajuste, p_lanterna: lanterna })
    return !error
  }, [])

  // Jogador exclui o próprio token pela função do banco, que confere se é dele.
  const excluirComoJogador = useCallback(async (ids: string[]) => {
    if (!ids.length) return true
    let removidos: ObjetoCena[] = []
    setObjetos((l) => {
      removidos = l.filter((o) => ids.includes(o.id))
      return l.filter((o) => !ids.includes(o.id))
    })
    const { error } = await supabase.rpc('excluir_meus_tokens', { p_ids: ids })
    if (error) setObjetos((l) => removidos.reduce(trocar, l))
    return !error
  }, [])

  const excluirVarios = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    setObjetos((l) => l.filter((o) => !ids.includes(o.id)))
    await supabase.from('scene_tokens').delete().in('id', ids)
  }, [])

  return { objetos, criar, criarVarios, alterarVarios, moverComoJogador, transformarComoJogador, virarComoJogador, lanternaComoJogador, ajustarLanternaComoJogador, excluirComoJogador, excluirVarios, transmitirArrasto, pingar, reguas, transmitirRegua }
}
