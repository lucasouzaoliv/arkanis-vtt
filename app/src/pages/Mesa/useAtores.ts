import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { copiaDoAtor, variacoesDaCriatura, type Ator } from './atores'
import type { Pasta } from './cenas'

const CAMPOS =
  'id, campaign_id, folder_id, tipo, character_id, creature_id, name, token_url, token_variacoes, token_pastas, acesso_padrao, acesso_jogadores, mostrar_mestres, pv_atual, condicoes, condicoes_personalizadas, sort, created_at'
const CAMPOS_PASTA = 'id, campaign_id, parent_id, name, color, sort_mode, sort, created_at'

export type FichaResumo = { id: string; user_id: string; avatar_url: string | null; hidden_from_others: boolean; editable_by_others: boolean }
export type CriaturaResumo = { id: string; name: string; vd: number | null; image_url: string | null; tipo_criatura: string | null; tamanho: string | null; pv_maximo?: number | null; deslocamento?: string | null }

function trocar<T extends { id: string }>(lista: T[], item: T): T[] {
  return lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [...lista, item]
}

// Personagens da mesa (12.7), em tempo real, com as fichas e criaturas por trás deles.
export function useAtores(campanhaId: string | undefined) {
  const [atores, setAtores] = useState<Ator[]>([])
  const [pastas, setPastas] = useState<Pasta[]>([])
  const [fichas, setFichas] = useState<Record<string, FichaResumo>>({})
  const [criaturas, setCriaturas] = useState<Record<string, CriaturaResumo>>({})

  const carregarApoio = useCallback(async (lista: Ator[]) => {
    const idsFicha = lista.map((a) => a.character_id).filter((x): x is string => !!x)
    const idsCriatura = lista.map((a) => a.creature_id).filter((x): x is string => !!x)
    if (idsFicha.length) {
      const { data } = await supabase.from('characters').select('id, user_id, avatar_url, hidden_from_others, editable_by_others').in('id', idsFicha)
      setFichas((f) => ({ ...f, ...Object.fromEntries((data ?? []).map((c) => [c.id, c as FichaResumo])) }))
    }
    if (idsCriatura.length) {
      const { data } = await supabase.from('creatures').select('id, name, vd, image_url, tipo_criatura, tamanho, pv_maximo, deslocamento').in('id', idsCriatura)
      setCriaturas((c) => ({ ...c, ...Object.fromEntries((data ?? []).map((x) => [x.id, x as CriaturaResumo])) }))
    }
  }, [])

  useEffect(() => {
    if (!campanhaId) return
    supabase.from('campaign_actors').select(CAMPOS).eq('campaign_id', campanhaId).then(({ data }) => {
      const lista = (data ?? []) as Ator[]
      setAtores(lista)
      carregarApoio(lista)
    })
    supabase.from('actor_folders').select(CAMPOS_PASTA).eq('campaign_id', campanhaId).then(({ data }) => setPastas((data ?? []) as Pasta[]))

    const filtro = `campaign_id=eq.${campanhaId}`
    const canal = supabase
      .channel(`atores:${campanhaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_actors', filter: filtro }, (p) => {
        setAtores((l) => trocar(l, p.new as Ator))
        carregarApoio([p.new as Ator])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_actors', filter: filtro }, (p) => setAtores((l) => trocar(l, p.new as Ator)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'campaign_actors' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) setAtores((l) => l.filter((a) => a.id !== id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actor_folders', filter: filtro }, (p) => setPastas((l) => trocar(l, p.new as Pasta)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'actor_folders', filter: filtro }, (p) => setPastas((l) => trocar(l, p.new as Pasta)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'actor_folders' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) setPastas((l) => l.filter((x) => x.id !== id))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [campanhaId, carregarApoio])

  const inserir = useCallback(async (dados: Partial<Ator>) => {
    const { data } = await supabase.from('campaign_actors').insert(dados).select(CAMPOS).single()
    if (!data) return null
    setAtores((l) => trocar(l, data as Ator))
    carregarApoio([data as Ator])
    return data as Ator
  }, [carregarApoio])

  // NPC: uma ficha completa de Ordem Paranormal do mestre, sem as 5 etapas de criação (12.7).
  const criarNPC = useCallback(async (mestreId: string, nome: string, pastaId: string | null) => {
    if (!campanhaId) return null
    const { data: ficha } = await supabase
      .from('characters')
      .insert({ user_id: mestreId, campaign_id: campanhaId, name: nome, npc: true, system: 'ordem_paranormal' })
      .select('id')
      .single()
    if (!ficha) return null
    return inserir({ campaign_id: campanhaId, tipo: 'npc', character_id: ficha.id, name: nome, folder_id: pastaId })
  }, [campanhaId, inserir])

  const criarAmeaca = useCallback(async (c: CriaturaResumo & { pv_maximo?: number | null }, pastaId: string | null) => {
    if (!campanhaId) return null
    // Todas as formas da criatura (Biblioteca de Tokens) já entram como variações.
    const { data } = await supabase.from('creatures').select('token_variacoes').eq('id', c.id).maybeSingle()
    return inserir({
      campaign_id: campanhaId, tipo: 'ameaca', creature_id: c.id, name: c.name, token_url: c.image_url, pv_atual: c.pv_maximo ?? null, folder_id: pastaId,
      token_variacoes: variacoesDaCriatura(data?.token_variacoes),
    })
  }, [campanhaId, inserir])

  const salvar = useCallback(async (id: string, campos: Partial<Ator>) => {
    setAtores((l) => l.map((a) => (a.id === id ? { ...a, ...campos } : a)))
    const { error } = await supabase.from('campaign_actors').update(campos).eq('id', id)
    return !error
  }, [])

  // Excluir NPC apaga a ficha dele também (o ator some junto, em cascata).
  const excluir = useCallback(async (a: Ator) => {
    setAtores((l) => l.filter((x) => x.id !== a.id))
    if (a.tipo === 'npc' && a.character_id) await supabase.from('characters').delete().eq('id', a.character_id)
    else await supabase.from('campaign_actors').delete().eq('id', a.id)
  }, [])

  // Duplicar: Ameaça copia direto; NPC copia a ficha principal (dados básicos) e os tokens.
  const duplicar = useCallback(async (a: Ator, mestreId: string) => {
    if (!campanhaId) return
    const copia = copiaDoAtor(a)
    if (a.tipo === 'ameaca') {
      await inserir(copia)
      return
    }
    if (a.tipo !== 'npc' || !a.character_id) return
    const { data: original } = await supabase.from('characters').select('*').eq('id', a.character_id).single()
    if (!original) return
    const { id: _id, created_at: _c, updated_at: _u, ...campos } = original as Record<string, unknown>
    const { data: ficha } = await supabase
      .from('characters')
      .insert({ ...campos, user_id: mestreId, campaign_id: campanhaId, npc: true, name: copia.name })
      .select('id')
      .single()
    if (ficha) await inserir({ ...copia, character_id: ficha.id })
  }, [campanhaId, inserir])

  const criarPasta = useCallback(async (campos: Pick<Pasta, 'name' | 'color' | 'sort_mode' | 'parent_id'>) => {
    if (!campanhaId) return
    const { data } = await supabase.from('actor_folders').insert({ ...campos, campaign_id: campanhaId }).select(CAMPOS_PASTA).single()
    if (data) setPastas((l) => trocar(l, data as Pasta))
  }, [campanhaId])

  const salvarPasta = useCallback(async (id: string, campos: Pick<Pasta, 'name' | 'color' | 'sort_mode'>) => {
    const { data } = await supabase.from('actor_folders').update(campos).eq('id', id).select(CAMPOS_PASTA).single()
    if (data) setPastas((l) => trocar(l, data as Pasta))
  }, [])

  const excluirPasta = useCallback(async (id: string) => {
    const { error } = await supabase.from('actor_folders').delete().eq('id', id)
    if (!error) {
      setPastas((l) => l.filter((x) => x.id !== id))
      setAtores((l) => l.map((a) => (a.folder_id === id ? { ...a, folder_id: null } : a)))
    }
  }, [])

  return { atores, pastas, fichas, criaturas, criarNPC, criarAmeaca, salvar, excluir, duplicar, criarPasta, salvarPasta, excluirPasta }
}

// Imagem de token: vai pro bucket e volta como URL pública.
export async function enviarImagemDeToken(userId: string, arquivo: File): Promise<string | null> {
  const caminho = `${userId}/${Date.now()}-${arquivo.name.replace(/[^\w.-]/g, '_') || 'token.png'}`
  const { error } = await supabase.storage.from('token_images').upload(caminho, arquivo)
  if (error) return null
  return supabase.storage.from('token_images').getPublicUrl(caminho).data.publicUrl
}

export async function colocarToken(atorId: string, cenaId: string, x: number, y: number, largura: number, altura: number): Promise<string | null> {
  const { error } = await supabase.rpc('colocar_token', { p_actor_id: atorId, p_scene_id: cenaId, p_x: x, p_y: y, p_largura: largura, p_altura: altura })
  return error ? error.message : null
}

// Com a altura, o token mantém a largura e acompanha o formato da nova imagem.
export async function trocarVariacao(tokenId: string, url: string, altura: number | null): Promise<boolean> {
  const { error } = await supabase.rpc('trocar_variacao', { p_token_id: tokenId, p_url: url, p_altura: altura })
  return !error
}
