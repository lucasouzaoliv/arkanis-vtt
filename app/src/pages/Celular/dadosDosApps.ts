// Dados dos apps do celular que vieram depois (migration 0169, 14/10): Notas, Notícias, Instagram,
// E-mail, Mapas e mensagens agendadas.
import { useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { Lado } from './dados'

const erroDe = (e: { message?: string } | null) => (e ? e.message || 'Não deu certo.' : null)

// Recarrega quando a tabela muda (tempo real); as regras do banco já filtram o que cada um vê.
export function useAoVivo(tabela: string, filtro: string | null, recarregar: () => void) {
  const r = useRef(recarregar)
  r.current = recarregar
  useEffect(() => {
    r.current()
    const canal = supabase.channel(`${tabela}-${filtro ?? 'tudo'}-${Math.random().toString(36).slice(2)}`)
    canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela, ...(filtro ? { filter: filtro } : {}) }, () => r.current())
    canal.subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [tabela, filtro])
}

// ---- Notas ----

export type Nota = { id: string; celular_id: string; titulo: string | null; texto: string | null; minuto_no_jogo: number | null; created_at: string; updated_at: string }

export async function notasDo(celularId: string): Promise<Nota[]> {
  const { data } = await supabase.from('celular_notas').select('*').eq('celular_id', celularId).order('updated_at', { ascending: false })
  return (data ?? []) as Nota[]
}

export async function salvarNota(n: { id?: string; celularId: string; titulo: string; texto: string }): Promise<{ id: string | null; erro: string | null }> {
  if (n.id) {
    const { error } = await supabase.from('celular_notas').update({ titulo: n.titulo || null, texto: n.texto || null, updated_at: new Date().toISOString() }).eq('id', n.id)
    return { id: n.id, erro: erroDe(error) }
  }
  const { data, error } = await supabase.from('celular_notas').insert({ celular_id: n.celularId, titulo: n.titulo || null, texto: n.texto || null }).select('id').single()
  return { id: (data as { id: string } | null)?.id ?? null, erro: erroDe(error) }
}

export async function apagarNota(id: string): Promise<string | null> {
  const { error } = await supabase.from('celular_notas').delete().eq('id', id)
  return erroDe(error)
}

// ---- Notícias ----

export type Noticia = { id: string; campaign_id: string; titulo: string; texto: string | null; imagem: string | null; fonte: string | null; minuto_no_jogo: number | null; publicada: boolean; created_at: string }

export async function noticiasDa(campanhaId: string): Promise<Noticia[]> {
  const { data } = await supabase.from('celular_noticias').select('*').eq('campaign_id', campanhaId).order('created_at', { ascending: false })
  return (data ?? []) as Noticia[]
}

export async function publicarNoticia(n: { campanhaId: string; titulo: string; texto?: string; imagem?: string | null; fonte?: string; minutoNoJogo?: number | null }): Promise<string | null> {
  const { error } = await supabase.from('celular_noticias').insert({
    campaign_id: n.campanhaId, titulo: n.titulo.trim(), texto: n.texto?.trim() || null, imagem: n.imagem ?? null, fonte: n.fonte?.trim() || null, minuto_no_jogo: n.minutoNoJogo ?? null,
  })
  return erroDe(error)
}

export async function apagarNoticia(id: string): Promise<string | null> {
  const { error } = await supabase.from('celular_noticias').delete().eq('id', id)
  return erroDe(error)
}

// ---- Instagram ----

export type Post = { id: string; campaign_id: string; de_celular_id: string | null; de_npc_id: string | null; imagem: string; legenda: string | null; minuto_no_jogo: number | null; created_at: string }
export type Curtida = { post_id: string; celular_id: string }

export async function postsDa(campanhaId: string): Promise<{ posts: Post[]; curtidas: Curtida[] }> {
  const { data } = await supabase.from('celular_posts').select('*').eq('campaign_id', campanhaId).order('created_at', { ascending: false }).limit(100)
  const posts = (data ?? []) as Post[]
  const { data: c } = posts.length ? await supabase.from('celular_curtidas').select('post_id, celular_id').in('post_id', posts.map((p) => p.id)) : { data: [] }
  return { posts, curtidas: (c ?? []) as Curtida[] }
}

export async function postar(p: { campanhaId: string; de: Lado; imagem: string; legenda?: string; minutoNoJogo?: number | null }): Promise<string | null> {
  const { error } = await supabase.from('celular_posts').insert({
    campaign_id: p.campanhaId, de_celular_id: 'celular' in p.de ? p.de.celular : null, de_npc_id: 'npc' in p.de ? p.de.npc : null,
    imagem: p.imagem, legenda: p.legenda?.trim() || null, minuto_no_jogo: p.minutoNoJogo ?? null,
  })
  return erroDe(error)
}

export async function curtir(postId: string, celularId: string, curtido: boolean): Promise<string | null> {
  const { error } = curtido
    ? await supabase.from('celular_curtidas').delete().eq('post_id', postId).eq('celular_id', celularId)
    : await supabase.from('celular_curtidas').insert({ post_id: postId, celular_id: celularId })
  return erroDe(error)
}

export async function apagarPost(id: string): Promise<string | null> {
  const { error } = await supabase.from('celular_posts').delete().eq('id', id)
  return erroDe(error)
}

// ---- E-mail ----

export type Email = {
  id: string; campaign_id: string; para_celular_id: string; de_celular_id: string | null; de_npc_id: string | null; remetente: string | null
  assunto: string; corpo: string | null; anexos: { nome: string; url: string }[]; lido: boolean; minuto_no_jogo: number | null; created_at: string
}

export async function emailsDo(celularId: string): Promise<Email[]> {
  const { data } = await supabase.from('celular_emails').select('*').or(`para_celular_id.eq.${celularId},de_celular_id.eq.${celularId}`).order('created_at', { ascending: false })
  return (data ?? []) as Email[]
}

// E-mails que um NPC mandou (o mestre, no celular do NPC).
export async function emailsDoNpc(npcId: string): Promise<Email[]> {
  const { data } = await supabase.from('celular_emails').select('*').eq('de_npc_id', npcId).order('created_at', { ascending: false })
  return (data ?? []) as Email[]
}

export async function mandarEmail(e: { campanhaId: string; para: string; de?: Lado | null; remetente?: string | null; assunto: string; corpo?: string; anexos?: { nome: string; url: string }[]; minutoNoJogo?: number | null }): Promise<string | null> {
  const { error } = await supabase.from('celular_emails').insert({
    campaign_id: e.campanhaId, para_celular_id: e.para,
    de_celular_id: e.de && 'celular' in e.de ? e.de.celular : null, de_npc_id: e.de && 'npc' in e.de ? e.de.npc : null,
    remetente: e.remetente?.trim() || null, assunto: e.assunto.trim(), corpo: e.corpo?.trim() || null, anexos: e.anexos ?? [], minuto_no_jogo: e.minutoNoJogo ?? null,
  })
  return erroDe(error)
}

export async function marcarEmailLido(id: string): Promise<void> {
  await supabase.from('celular_emails').update({ lido: true }).eq('id', id)
}

export async function apagarEmail(id: string): Promise<string | null> {
  const { error } = await supabase.from('celular_emails').delete().eq('id', id)
  return erroDe(error)
}

// ---- Mapas ----

export type Mapa = { campaign_id: string; imagem: string | null; nome: string | null }
export type PontoNoMapa = { id: string; campaign_id: string; nome: string; descricao: string | null; x: number; y: number; cor: string | null; celular_id: string | null; visivel_para: string[] | null }

export async function mapaDa(campanhaId: string): Promise<{ mapa: Mapa | null; pontos: PontoNoMapa[] }> {
  const { data: m } = await supabase.from('celular_mapas').select('*').eq('campaign_id', campanhaId).maybeSingle()
  const { data: p } = await supabase.from('celular_mapa_pontos').select('*').eq('campaign_id', campanhaId)
  return { mapa: (m as Mapa | null) ?? null, pontos: ((p ?? []) as PontoNoMapa[]).map((x) => ({ ...x, x: Number(x.x), y: Number(x.y) })) }
}

export async function salvarMapa(campanhaId: string, imagem: string | null, nome?: string | null): Promise<string | null> {
  const { error } = await supabase.from('celular_mapas').upsert({ campaign_id: campanhaId, imagem, nome: nome ?? null, updated_at: new Date().toISOString() })
  return erroDe(error)
}

export async function criarPonto(p: Omit<PontoNoMapa, 'id'>): Promise<string | null> {
  const { error } = await supabase.from('celular_mapa_pontos').insert(p)
  return erroDe(error)
}

export async function mudarPonto(id: string, m: Partial<Omit<PontoNoMapa, 'id' | 'campaign_id'>>): Promise<string | null> {
  const { error } = await supabase.from('celular_mapa_pontos').update(m).eq('id', id)
  return erroDe(error)
}

export async function apagarPonto(id: string): Promise<string | null> {
  const { error } = await supabase.from('celular_mapa_pontos').delete().eq('id', id)
  return erroDe(error)
}

// ---- Mensagem agendada ----

// Solta as agendadas cuja hora do jogo chegou (o mestre chama de tempos em tempos).
export async function entregarAgendadas(campanhaId: string): Promise<number> {
  const { data } = await supabase.rpc('entregar_agendadas', { p_campaign_id: campanhaId })
  return Number(data) || 0
}
