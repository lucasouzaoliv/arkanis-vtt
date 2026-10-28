import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { computeDerivedStats, type Training } from '../../lib/rules'
import { lerTeste, nomesNumerados, ordemDeIniciativa, rolarTeste, testeDeIniciativa, type Combatente } from './combate'
import { variacoesDaCriatura } from './atores'
import { lerCondicoesPersonalizadas } from '../CharacterSheet/efeitosEscolhidos'
import { penalidadeDeCondicoes, rotuloComCondicoes } from '../CharacterSheet/condicoes'

export type TimerCondicao = { id: string; combat_id: string; campaign_id: string; combatant_id: string; condicao: string; ate_rodada: number | null }

// Rodadas que faltam (no mínimo 1 até vencer no turno de quem está com ela).
export function rodadasRestantes(ateRodada: number, rodada: number): number {
  return Math.max(1, ateRodada - rodada)
}

export type Combate = {
  id: string
  campaign_id: string
  name: string
  ameacas: string[] // escolhidas do bestiário, que ainda não viraram personagem
  atores: string[] // personagens da aba Personagens que lutam aqui
  ativo: boolean
  rodada: number
  turno_atual: string | null
  created_at: string
}

// Barrinhas do jogador (12.4): Vida, Esforço (PE) e Sanidade, atual e máximo.
// mortes: caveiras marcadas na ficha (pv_death_marks, 3 bits) — morrendo, uma por turno.
export type Barras = { pv: [number, number | null]; pe: [number, number | null]; san: [number, number | null]; mortes?: number }

type FichaBarras = {
  id: string
  name: string | null
  avatar_url: string | null
  attributes: Record<string, number>
  nex_percent: number
  class_id: string | null
  current_pv: number | null
  current_pe: number | null
  current_sanity: number | null
  max_pv_override: number | null
  max_sanity_override: number | null
  max_pe_override?: number | null
  pv_death_marks: number | null
  conditions?: string[] | null
  condicoes_personalizadas?: unknown
}

const CAMPOS_FICHA = 'id, name, avatar_url, attributes, nex_percent, class_id, current_pv, current_pe, current_sanity, max_pv_override, max_pe_override, max_sanity_override, pv_death_marks, conditions, condicoes_personalizadas'

type FichaIniciativa = { id: string; user_id: string; name: string | null; avatar_url: string | null; attributes: unknown; conditions: unknown; condicoes_personalizadas?: unknown }

function trocar<T extends { id: string }>(lista: T[], item: T): T[] {
  return lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [...lista, item]
}

// Combates da campanha, a ordem de iniciativa do que está rodando e as barras de cada um.
// Toda ameaça do combate é um personagem da aba Personagens: a vida dela fica nele, então o
// combate, o token e a ficha mexem na mesma vida.
export function useCombate(campanhaId: string | undefined) {
  const [combates, setCombates] = useState<Combate[]>([])
  const [combatentes, setCombatentes] = useState<Combatente[]>([])
  const [fichas, setFichas] = useState<Record<string, FichaBarras>>({})
  // Nomes dos poderes de cada ficha: os que crescem com o NEX mudam o PV/PE máximo.
  const [poderesDe, setPoderesDe] = useState<Record<string, string[]>>({})
  const [classes, setClasses] = useState<Record<string, Parameters<typeof computeDerivedStats>[0]>>({})
  // Condições com duração (KAN-121): o banco tira sozinho quando vence.
  const [timers, setTimers] = useState<TimerCondicao[]>([])

  const carregarFichas = useCallback(async () => {
    if (!campanhaId) return
    // Jogadores e NPCs (as barras do NPC só o mestre vê).
    const { data } = await supabase.from('characters').select(CAMPOS_FICHA).eq('campaign_id', campanhaId)
    const lista = (data ?? []) as FichaBarras[]
    setFichas(Object.fromEntries(lista.map((f) => [f.id, f])))
    if (lista.length) {
      const { data: habs } = await supabase
        .from('character_abilities')
        .select('character_id, custom_ability, class_powers(name), paranormal_powers(name), general_powers(name), origins(power_name), class_track_tiers(name)')
        .in('character_id', lista.map((f) => f.id))
      const mapa: Record<string, string[]> = {}
      for (const r of (habs ?? []) as any[]) {
        const nome = r.class_powers?.name ?? r.paranormal_powers?.name ?? r.general_powers?.name ?? r.origins?.power_name ?? r.class_track_tiers?.name ?? r.custom_ability?.name
        if (nome) (mapa[r.character_id] ??= []).push(nome)
      }
      setPoderesDe(mapa)
    }
    const ids = [...new Set(lista.map((f) => f.class_id).filter((x): x is string => !!x))]
    if (ids.length) {
      const { data: cls } = await supabase.from('classes').select('*').in('id', ids)
      setClasses(Object.fromEntries((cls ?? []).map((c) => [c.id, c])))
    }
  }, [campanhaId])

  useEffect(() => {
    if (!campanhaId) return
    supabase.from('combats').select('*').eq('campaign_id', campanhaId).order('created_at').then(({ data }) => setCombates((data ?? []) as Combate[]))
    supabase.from('combatants').select('*').eq('campaign_id', campanhaId).then(({ data }) => setCombatentes((data ?? []) as Combatente[]))
    carregarFichas()
    supabase.from('combat_condition_timers').select('*').eq('campaign_id', campanhaId).then(({ data }) => setTimers((data ?? []) as TimerCondicao[]))

    const filtro = `campaign_id=eq.${campanhaId}`
    const canal = supabase
      .channel(`combate:${campanhaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combats', filter: filtro }, (p) => {
        if (p.eventType === 'DELETE') return
        setCombates((l) => trocar(l, p.new as Combate))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'combats' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) setCombates((l) => l.filter((c) => c.id !== id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'combatants', filter: filtro }, (p) => setCombatentes((l) => trocar(l, p.new as Combatente)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'combatants', filter: filtro }, (p) => setCombatentes((l) => trocar(l, p.new as Combatente)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'combatants' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) setCombatentes((l) => l.filter((c) => c.id !== id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'combat_condition_timers', filter: filtro }, (p) => setTimers((l) => trocar(l, p.new as TimerCondicao)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'combat_condition_timers', filter: filtro }, (p) => setTimers((l) => trocar(l, p.new as TimerCondicao)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'combat_condition_timers' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) setTimers((l) => l.filter((t) => t.id !== id))
      })
      // Vida/PE/Sanidade mudaram na ficha de alguém: a barra acompanha.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters', filter: filtro }, (p) => {
        const f = p.new as FichaBarras
        setFichas((m) => (m[f.id] ? { ...m, [f.id]: { ...m[f.id], ...f } } : m))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [campanhaId, carregarFichas])

  const ativo = combates.find((c) => c.ativo) ?? null
  const ordem = useMemo(() => (ativo ? ordemDeIniciativa(combatentes.filter((c) => c.combat_id === ativo.id)) : []), [ativo, combatentes])

  function barras(c: Pick<Combatente, 'character_id'>): Barras | null {
    if (!c.character_id) return null
    const f = fichas[c.character_id]
    if (!f) return null
    const cls = f.class_id ? classes[f.class_id] : undefined
    const max = cls ? computeDerivedStats(cls, f.attributes as Parameters<typeof computeDerivedStats>[1], f.nex_percent, poderesDe[f.id]) : null
    const maxPv = f.max_pv_override ?? max?.maxPv ?? null
    const maxSan = f.max_sanity_override ?? max?.maxSanity ?? null
    return {
      pv: [f.current_pv ?? maxPv ?? 0, maxPv],
      pe: [f.current_pe ?? f.max_pe_override ?? max?.maxPe ?? 0, f.max_pe_override ?? max?.maxPe ?? null],
      san: [f.current_sanity ?? maxSan ?? 0, maxSan],
      mortes: f.pv_death_marks ?? 0,
    }
  }

  // Condições da ficha de quem luta (jogador/NPC), pra aparecerem na ordem do combate.
  function condicoesDaFicha(c: Combatente): { condicoes: string[]; personalizadas: unknown } | null {
    const f = c.character_id ? fichas[c.character_id] : undefined
    return f ? { condicoes: Array.isArray(f.conditions) ? f.conditions : [], personalizadas: f.condicoes_personalizadas } : null
  }

  // Quanto falta de cada condição marcada: rodadas, ou 'cena'.
  function duracoesDe(c: Combatente): Record<string, number | 'cena'> {
    return Object.fromEntries(timers.filter((t) => t.combatant_id === c.id).map((t) => [t.condicao, t.ate_rodada == null ? 'cena' : rodadasRestantes(t.ate_rodada, ativo?.rodada ?? 1)]))
  }

  // null tira a duração (a condição fica até alguém tirar).
  const marcarDuracao = useCallback(async (c: Combatente, condicao: string, valor: number | 'cena' | null) => {
    if (!campanhaId) return
    const rodada = combates.find((x) => x.id === c.combat_id)?.rodada ?? 1
    if (valor === null) {
      setTimers((l) => l.filter((t) => !(t.combatant_id === c.id && t.condicao === condicao)))
      await supabase.from('combat_condition_timers').delete().eq('combatant_id', c.id).eq('condicao', condicao)
      return
    }
    const linha = { combat_id: c.combat_id, campaign_id: campanhaId, combatant_id: c.id, condicao, ate_rodada: valor === 'cena' ? null : rodada + valor }
    const { data } = await supabase.from('combat_condition_timers').upsert(linha, { onConflict: 'combatant_id,condicao' }).select().single()
    if (data) setTimers((l) => trocar(l, data as TimerCondicao))
  }, [campanhaId, combates])

  const excluir = useCallback(async (id: string) => {
    setCombates((l) => l.filter((c) => c.id !== id))
    await supabase.from('combats').delete().eq('id', id)
  }, [])

  // Teste de Iniciativa das fichas (jogadores e NPCs): Agilidade em dados + treino + bônus,
  // com as condições (Surdo, Fraco…). O dos jogadores vai pro chat e pro Histórico, como se
  // ele tivesse rolado na ficha.
  // tokenDe: o token atual do personagem (Configurar Token), que vale mais que a foto da ficha.
  const iniciativaDasFichas = useCallback(async (lista: FichaIniciativa[], combate: Combate, tipo: 'jogador' | 'npc', atorDe: Map<string, string>, tokenDe: Map<string, string | null> = new Map()) => {
    if (!campanhaId || !lista.length) return []
    const { data: pericia } = await supabase.from('skills').select('id').eq('name', 'Iniciativa').maybeSingle()
    const { data: treinos } = pericia
      ? await supabase.from('character_skills').select('character_id, training, extra_bonus').eq('skill_id', pericia.id).in('character_id', lista.map((j) => j.id))
      : { data: [] }
    const treino = new Map((treinos ?? []).map((t) => [t.character_id, t]))
    const rolagens: Record<string, unknown>[] = []
    const linhas = lista.map((j) => {
      const t = treino.get(j.id)
      const base = testeDeIniciativa((j.attributes as Record<string, number>)?.agilidade ?? 1, (t?.training ?? 'nenhum') as Training, t?.extra_bonus ?? 0)
      const cond = penalidadeDeCondicoes(j.conditions as string[] | null, { atributo: 'agilidade', pericia: 'Iniciativa' }, lerCondicoesPersonalizadas(j.condicoes_personalizadas))
      const teste = { ...base, dados: base.dados + cond.dados, bonus: base.bonus + cond.valor }
      const r = rolarTeste(teste)
      if (tipo === 'jogador') {
        rolagens.push({
          character_id: j.id, user_id: j.user_id, campaign_id: campanhaId, character_name: j.name || 'Sem nome',
          label: rotuloComCondicoes('Teste de Iniciativa', cond.motivos), total: r.total, bonus: r.bonus,
          detail: `d20 mantido: ${r.kept} (rolados: ${r.rolls.join(', ')}) + bônus ${r.bonus}`,
          dice: r.rolls.map((v) => ({ sides: 20, value: v, discarded: v !== r.kept })),
        })
      }
      return {
        combat_id: combate.id, campaign_id: campanhaId, tipo, character_id: j.id, creature_id: null, actor_id: atorDe.get(j.id) ?? null,
        name: j.name || 'Sem nome', image_url: tokenDe.get(j.id) || j.avatar_url, iniciativa: r.total, desempate: teste.bonus,
      }
    })
    if (rolagens.length) await supabase.from('character_rolls').insert(rolagens)
    return linhas
  }, [campanhaId])

  // Pasta com o nome do combate ("Floresta", "Luta no banco"…) na aba Personagens (cria se não existir).
  const pastaDoCombate = useCallback(async (combate: Combate) => {
    if (!campanhaId) return null
    const nome = combate.name || 'Combate'
    const { data } = await supabase.from('actor_folders').select('id').eq('campaign_id', campanhaId).eq('name', nome).is('parent_id', null).limit(1).maybeSingle()
    if (data) return data.id as string
    const { data: nova } = await supabase.from('actor_folders').insert({ campaign_id: campanhaId, name: nome, parent_id: null }).select('id').single()
    return (nova?.id as string | undefined) ?? null
  }, [campanhaId])

  // Ameaças do bestiário viram personagens (com a vida cheia) na pasta do combate.
  const criarAtoresDoBestiario = useCallback(async (combate: Combate, criaturaIds: string[]) => {
    if (!campanhaId || !criaturaIds.length) return []
    const { data: criaturas } = await supabase.from('creatures').select('id, name, image_url, pv_maximo, token_variacoes').in('id', [...new Set(criaturaIds)])
    const porId = new Map((criaturas ?? []).map((c) => [c.id, c]))
    const validas = criaturaIds.filter((id) => porId.has(id))
    if (!validas.length) return []
    const nomes = nomesNumerados(validas.map((id) => porId.get(id)!.name))
    const pasta = await pastaDoCombate(combate)
    const { data } = await supabase
      .from('campaign_actors')
      .insert(validas.map((id, i) => {
        const c = porId.get(id)!
        return { campaign_id: campanhaId, tipo: 'ameaca', creature_id: id, name: nomes[i], token_url: c.image_url, token_variacoes: variacoesDaCriatura(c.token_variacoes), pv_atual: c.pv_maximo ?? null, folder_id: pasta }
      }))
      .select('id')
    return (data ?? []).map((a) => a.id as string)
  }, [campanhaId, pastaDoCombate])

  // Personagens da aba Personagens (ameaças e NPCs) entrando na ordem de iniciativa.
  const entrarAtores = useCallback(async (combate: Combate, atorIds: string[]) => {
    if (!campanhaId || !atorIds.length) return []
    const { data: atores } = await supabase.from('campaign_actors').select('id, tipo, character_id, creature_id, name, token_url, condicoes, condicoes_personalizadas').in('id', atorIds)
    const lista = (atores ?? []).filter((a) => a.tipo !== 'jogador')
    const idsCriatura = lista.map((a) => a.creature_id).filter((x): x is string => !!x)
    const { data: criaturas } = idsCriatura.length ? await supabase.from('creatures').select('id, iniciativa, image_url').in('id', idsCriatura) : { data: [] }
    const criatura = new Map((criaturas ?? []).map((c) => [c.id, c]))
    const ameacas = lista.filter((a) => a.tipo === 'ameaca').map((a) => {
      const c = a.creature_id ? criatura.get(a.creature_id) : undefined
      // Condição da ameaça (Surdo -2d20 na Iniciativa…) vale aqui também (18/10).
      const base = lerTeste(c?.iniciativa)
      const p = penalidadeDeCondicoes(a.condicoes, { atributo: 'agilidade', pericia: 'Iniciativa' }, lerCondicoesPersonalizadas(a.condicoes_personalizadas))
      const t = { dados: base.dados + p.dados, bonus: base.bonus + p.valor }
      return {
        combat_id: combate.id, campaign_id: campanhaId, tipo: 'ameaca', actor_id: a.id, creature_id: a.creature_id, character_id: null,
        name: a.name, image_url: a.token_url ?? c?.image_url ?? null, iniciativa: rolarTeste(t).total, desempate: t.bonus,
      }
    })
    const npcs = lista.filter((a) => a.tipo === 'npc' && a.character_id)
    const { data: fichasNpc } = npcs.length
      ? await supabase.from('characters').select('id, user_id, name, avatar_url, attributes, conditions, condicoes_personalizadas').in('id', npcs.map((a) => a.character_id!))
      : { data: [] }
    const linhasNpc = await iniciativaDasFichas((fichasNpc ?? []) as FichaIniciativa[], combate, 'npc', new Map(npcs.map((a) => [a.character_id!, a.id])), new Map(npcs.map((a) => [a.character_id!, a.token_url])))
    const linhas = [...ameacas, ...linhasNpc]
    if (!linhas.length) return []
    const { data } = await supabase.from('combatants').insert(linhas).select('*')
    const novos = (data ?? []) as Combatente[]
    setCombatentes((l) => novos.reduce(trocar, l))
    return novos
  }, [campanhaId, iniciativaDasFichas])

  // Guarda no combate quem luta nele (as do bestiário que já viraram personagem saem de "ameacas").
  const gravarAtores = useCallback(async (combate: Combate, atores: string[], ameacas: string[]) => {
    const campos = { atores: [...new Set(atores)], ameacas }
    setCombates((l) => l.map((c) => (c.id === combate.id ? { ...c, ...campos } : c)))
    await supabase.from('combats').update(campos).eq('id', combate.id)
  }, [])

  // Criar Combate (pedido da Millie): as ameaças escolhidas do bestiário já viram personagens
  // na hora de salvar, numa pasta com o nome do combate — pro mestre arrumar os tokens na cena
  // antes de começar a luta.
  const criar = useCallback(async (name: string, ameacas: string[], atores: string[] = []) => {
    if (!campanhaId) return
    const { data } = await supabase.from('combats').insert({ campaign_id: campanhaId, name, ameacas: [], atores }).select('*').single()
    if (!data) return
    const combate = data as Combate
    setCombates((l) => trocar(l, combate))
    const criados = await criarAtoresDoBestiario(combate, ameacas)
    if (criados.length) await gravarAtores(combate, [...atores, ...criados], [])
  }, [campanhaId, criarAtoresDoBestiario, gravarAtores])

  // Editar: as novas do bestiário também viram personagens; trocar o nome renomeia a pasta.
  const salvar = useCallback(async (combate: Combate, campos: { name: string; ameacas: string[]; atores: string[] }) => {
    if (!campanhaId) return
    if (campos.name && campos.name !== combate.name) {
      await supabase.from('actor_folders').update({ name: campos.name }).eq('campaign_id', campanhaId).eq('name', combate.name).is('parent_id', null)
    }
    const atualizado = { ...combate, name: campos.name || combate.name }
    const criados = await criarAtoresDoBestiario(atualizado, campos.ameacas)
    const { data } = await supabase.from('combats').update({ name: atualizado.name, ameacas: [], atores: [...new Set([...campos.atores, ...criados])] }).eq('id', combate.id).select('*').single()
    if (data) setCombates((l) => trocar(l, data as Combate))
  }, [campanhaId, criarAtoresDoBestiario])

  // "Adicionar" com o combate rodando: as do bestiário viram personagens, e todo mundo que
  // entrou já rola a iniciativa.
  const entrarAmeacas = useCallback(async (combate: Combate, criaturaIds: string[], atorIds: string[] = []) => {
    const novos = await criarAtoresDoBestiario(combate, criaturaIds)
    const entram = [...novos, ...atorIds.filter((id) => !combate.atores.includes(id))]
    await gravarAtores(combate, [...combate.atores, ...entram], combate.ameacas)
    return entrarAtores(combate, entram)
  }, [criarAtoresDoBestiario, gravarAtores, entrarAtores])

  // Botão direito no token / arrastar da aba Personagens pro combate. Rodando: já rola a iniciativa.
  const adicionarAtor = useCallback(async (combate: Combate, atorId: string) => {
    if (combate.atores.includes(atorId)) return
    await gravarAtores(combate, [...combate.atores, atorId], combate.ameacas)
    if (combate.ativo) await entrarAtores(combate, [atorId])
  }, [gravarAtores, entrarAtores])

  // Iniciar (12.4): rola a iniciativa de todos os personagens jogáveis e de quem luta no combate.
  // (Combate salvo antes desta mudança ainda pode ter ameaças só do bestiário: viram personagens aqui.)
  const iniciar = useCallback(async (combate: Combate) => {
    if (!campanhaId) return
    const { data: jogadores } = await supabase.from('characters').select('id, user_id, name, avatar_url, attributes, conditions, condicoes_personalizadas').eq('campaign_id', campanhaId).eq('npc', false)
    const { data: atoresJogadores } = jogadores?.length
      ? await supabase.from('campaign_actors').select('id, character_id, token_url').in('character_id', jogadores.map((j) => j.id))
      : { data: [] }
    const atorDoJogador = new Map((atoresJogadores ?? []).map((a) => [a.character_id as string, a.id as string]))
    // Ficha do mestre dada como Dono a um jogador (Configurar Propriedade) é personagem de jogador:
    // entra sozinha no combate, como as outras.
    const { data: npcsDaCampanha } = await supabase.from('campaign_actors').select('id, character_id, token_url, acesso_jogadores').eq('campaign_id', campanhaId).eq('tipo', 'npc')
    const dadas = (npcsDaCampanha ?? []).filter((a) => a.character_id && Object.values((a.acesso_jogadores ?? {}) as Record<string, string>).includes('dono'))
    const { data: fichasDadas } = dadas.length
      ? await supabase.from('characters').select('id, user_id, name, avatar_url, attributes, conditions, condicoes_personalizadas').in('id', dadas.map((a) => a.character_id as string))
      : { data: [] }
    for (const a of dadas) atorDoJogador.set(a.character_id as string, a.id as string)
    const tokenDe = new Map([...(atoresJogadores ?? []), ...dadas].map((a) => [a.character_id as string, (a.token_url as string | null) ?? null]))
    await supabase.from('combatants').delete().eq('combat_id', combate.id)
    setCombatentes((l) => l.filter((c) => c.combat_id !== combate.id))
    const linhas = await iniciativaDasFichas([...(jogadores ?? []), ...(fichasDadas ?? [])] as FichaIniciativa[], combate, 'jogador', atorDoJogador, tokenDe)
    const { data: novos } = linhas.length ? await supabase.from('combatants').insert(linhas).select('*') : { data: [] }
    const criados = await criarAtoresDoBestiario(combate, combate.ameacas)
    const atores = [...new Set([...combate.atores, ...criados])]
    if (criados.length) await gravarAtores(combate, atores, [])
    const ameacas = await entrarAtores({ ...combate, atores, ameacas: [] }, atores.filter((id) => !dadas.some((a) => a.id === id)))
    const todos = ordemDeIniciativa([...((novos ?? []) as Combatente[]), ...ameacas])
    setCombatentes((l) => [...l.filter((c) => c.combat_id !== combate.id), ...todos])
    await supabase.from('combats').update({ ativo: true, rodada: 1, turno_atual: todos[0]?.id ?? null }).eq('id', combate.id)
    setCombates((l) => l.map((c) => (c.id === combate.id ? { ...c, ativo: true, rodada: 1, turno_atual: todos[0]?.id ?? null } : c)))
  }, [campanhaId, iniciativaDasFichas, criarAtoresDoBestiario, gravarAtores, entrarAtores])

  // Encerrar: o combate volta pra lista, pronto pra iniciar de novo. Os personagens da pasta
  // Combates ficam (o mestre apaga o que quiser).
  const encerrar = useCallback(async (combate: Combate) => {
    await supabase.from('combats').update({ ativo: false, turno_atual: null, rodada: 1 }).eq('id', combate.id)
    await supabase.from('combatants').delete().eq('combat_id', combate.id)
    setCombatentes((l) => l.filter((c) => c.combat_id !== combate.id))
    setCombates((l) => l.map((c) => (c.id === combate.id ? { ...c, ativo: false, turno_atual: null, rodada: 1 } : c)))
  }, [])

  const passar = useCallback(async (combate: Combate, voltar = false) => {
    const { error } = await supabase.rpc('passar_turno', { p_combat_id: combate.id, p_voltar: voltar })
    return !error
  }, [])

  // Tirar do combate (ameaça com 0 de vida, 12.4). Se era a vez dela, passa antes.
  const remover = useCallback(async (combate: Combate, combatenteId: string) => {
    if (combate.turno_atual === combatenteId) await supabase.rpc('passar_turno', { p_combat_id: combate.id, p_voltar: false })
    setCombatentes((l) => l.filter((c) => c.id !== combatenteId))
    await supabase.from('combatants').delete().eq('id', combatenteId)
  }, [])

  return { combates, ativo, ordem, barras, condicoesDaFicha, duracoesDe, marcarDuracao, criar, salvar, excluir, iniciar, entrarAmeacas, adicionarAtor, encerrar, passar, remover }
}
