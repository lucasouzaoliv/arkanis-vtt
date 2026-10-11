// Chamadas ao banco do Sistema de Mira (KAN-51). As contas ficam em mira.ts; o banco confere
// quem pode fazer cada passo e grava cada um uma vez só.
import { supabase } from '../../lib/supabase'
import { recordRoll } from '../../lib/rollHistory'
import { computeDerivedStats, rollAttributeTest } from '../../lib/rules'
import { classePropria } from '../CharacterSheet/useClasseDaFicha'
import type { CharacterRecord } from '../CharacterSheet/index'
import type { Mensagem } from './chat'
import {
  danoNoAlvo, defesaDoAlvo, perfilDoAlvo, rolarAtaque, rolarCura, rolarDanoDoAtaque,
  type AcaoAtaque, type AcaoCura, type Alvo, type AtaqueDaAcao, type DadosDoAlvo, type Recurso,
} from './mira'

function motivoDoErro(e: { message?: string } | null): string | null {
  return e ? e.message || 'Não deu certo.' : null
}

export async function dadosDoAlvo(tokenId: string): Promise<DadosDoAlvo | null> {
  const { data } = await supabase.rpc('dados_do_alvo', { p_token_id: tokenId })
  return (data as DadosDoAlvo | null) ?? null
}

// Ficha (ou ameaça, pelo mestre) usou um ataque com alvos marcados: vai pro chat com os botões.
export async function postarAtaque(p: {
  campanhaId: string
  characterId: string | null
  autor: { nome: string; foto: string | null }
  ataque: AtaqueDaAcao
  alvos: Alvo[]
  atorId?: string | null
}): Promise<string | null> {
  const acao: Omit<AcaoAtaque, 'estado'> = {
    tipo: 'ataque', atacante: p.autor.nome, ataque: p.ataque, alvos: p.alvos,
    origem: { character_id: p.characterId, actor_id: p.atorId ?? null },
  }
  const { error } = await supabase.rpc('postar_acao', {
    p_campaign_id: p.campanhaId,
    p_character_id: p.characterId,
    p_autor_nome: p.autor.nome,
    p_autor_foto: p.autor.foto,
    p_acao: acao,
  })
  return motivoDoErro(error)
}

// Botão Ataque: rola e confere a Defesa de cada alvo. Alvo sem ficha (só uma imagem) conta
// como atingido, porque não tem Defesa pra comparar.
export async function rolarAtaqueDaMensagem(m: Mensagem): Promise<string | null> {
  const acao = m.acao
  if (acao?.tipo !== 'ataque') return null
  const r = rolarAtaque(acao.ataque)
  const acertos: Record<string, boolean> = {}
  for (const a of acao.alvos) {
    const dados = await dadosDoAlvo(a.token_id)
    const base = dados ? defesaDoAlvo(dados) : null
    // Esquivar: o bônus de Reflexos soma na Defesa contra este ataque.
    const reacao = acao.estado.reacoes?.[a.token_id]
    const defesa = base === null ? null : base + (reacao?.tipo === 'esquiva' ? reacao.valor : 0)
    acertos[a.token_id] = defesa === null || r.total >= defesa
  }
  const { error } = await supabase.rpc('registrar_na_acao', { p_msg_id: m.id, p_chave: 'ataque', p_valor: { ...r, acertos } })
  if (!error && m.character_id) {
    recordRoll({
      characterId: m.character_id, userId: m.user_id, campaignId: m.campaign_id, characterName: acao.atacante,
      label: `Ataque: ${acao.ataque.nome}${r.critico ? ' (crítico!)' : ''}`, total: r.total,
      detail: `d20 mantido: ${r.kept} (rolados: ${r.rolls.join(', ')}) + bônus ${r.bonus}`,
      dice: r.rolls.map((v) => ({ sides: 20, value: v, discarded: v !== r.kept })), bonus: r.bonus, semChat: true,
    })
  }
  return motivoDoErro(error)
}

// Botão Dano: rola (crítico multiplica os dados) e desconta da Vida de quem foi atingido,
// já com resistências, vulnerabilidades e o Bloqueio de quem bloqueou.
export async function rolarDanoDaMensagem(m: Mensagem): Promise<string | null> {
  const acao = m.acao
  if (acao?.tipo !== 'ataque') return null
  const ataque = acao.estado.ataque
  if (!ataque) return null
  const atingidos = acao.alvos.filter((a) => ataque.acertos[a.token_id])
  const d = rolarDanoDoAtaque(acao.ataque, ataque.critico)
  const efeitos: Record<string, { pv: number; san: number; motivos: string[] } | null> = {}
  for (const a of atingidos) {
    const dados = await dadosDoAlvo(a.token_id)
    efeitos[a.token_id] = dados && dados.tipo !== 'nenhum' ? danoNoAlvo(d.partes, perfilDoAlvo(dados), bloqueioDe(acao, a.token_id)) : null
  }
  const { error } = await supabase.rpc('registrar_na_acao', { p_msg_id: m.id, p_chave: 'dano', p_valor: { ...d, efeitos } })
  if (error) return motivoDoErro(error)
  if (m.character_id) {
    recordRoll({
      characterId: m.character_id, userId: m.user_id, campaignId: m.campaign_id, characterName: acao.atacante,
      label: d.critico ? `Dano Crítico: ${acao.ataque.nome} (x${acao.ataque.multiplicador})` : `Dano: ${acao.ataque.nome}`,
      total: d.total, detail: d.dados.map((x) => `d${x.sides}: ${x.value}`).join(' · '), dice: d.dados, bonus: acao.ataque.bonus_dano, semChat: true,
    })
  }
  for (const [tokenId, e] of Object.entries(efeitos)) {
    if (!e) continue
    const { error: erro } = await supabase.rpc('aplicar_dano_da_acao', { p_msg_id: m.id, p_token_id: tokenId, p_pv: e.pv, p_san: e.san })
    if (erro) return motivoDoErro(erro)
  }
  return null
}

function bloqueioDe(acao: AcaoAtaque, tokenId: string): number {
  const r = acao.estado.reacoes?.[tokenId]
  return r?.tipo === 'bloqueio' ? r.valor : acao.estado.bloqueios?.[tokenId] ?? 0
}

// Reação do alvo: Esquivar (antes do Ataque), Bloquear (antes do Dano) ou Contra-atacar (errou).
export async function reagirAoAtaque(m: Mensagem, tokenId: string, reacao: 'esquiva' | 'bloqueio' | 'contra'): Promise<string | null> {
  const { error } = await supabase.rpc('reagir_na_acao', { p_msg_id: m.id, p_token_id: tokenId, p_reacao: reacao })
  return motivoDoErro(error)
}

// ---- Cura (12.9) ----

export async function postarCura(p: {
  campanhaId: string
  characterId: string
  autor: { nome: string; foto: string | null }
  fonte: string
  imagem?: string | null
  elemento?: string | null
  formula: string
  recurso: Recurso
  teste: AcaoCura['teste']
  alvos: Alvo[]
}): Promise<string | null> {
  const acao: Omit<AcaoCura, 'estado'> = { tipo: 'cura', curador: p.autor.nome, fonte: p.fonte, ...(p.imagem ? { imagem: p.imagem } : {}), ...(p.elemento ? { elemento: p.elemento } : {}), formula: p.formula, recurso: p.recurso, teste: p.teste, alvos: p.alvos }
  const { error } = await supabase.rpc('postar_acao', {
    p_campaign_id: p.campanhaId, p_character_id: p.characterId, p_autor_nome: p.autor.nome, p_autor_foto: p.autor.foto, p_acao: acao,
  })
  return motivoDoErro(error)
}

// Teste do ritual (Ocultismo), com os dados e o bônus que a ficha calculou na hora.
export async function rolarTesteDaCura(m: Mensagem): Promise<string | null> {
  const acao = m.acao
  if (acao?.tipo !== 'cura' || !acao.teste) return null
  const { rolls, kept } = rollAttributeTest(acao.teste.dados)
  const r = { rolls, kept, bonus: acao.teste.bonus, total: kept + acao.teste.bonus }
  const { error } = await supabase.rpc('registrar_na_acao', { p_msg_id: m.id, p_chave: 'teste', p_valor: r })
  if (!error && m.character_id) {
    recordRoll({
      characterId: m.character_id, userId: m.user_id, campaignId: m.campaign_id, characterName: acao.curador,
      label: `Teste de ${acao.teste.nome}`, total: r.total, detail: `d20 mantido: ${kept} (rolados: ${rolls.join(', ')}) + bônus ${r.bonus}`,
      dice: rolls.map((v) => ({ sides: 20, value: v, discarded: v !== kept })), bonus: r.bonus, semChat: true,
    })
  }
  return motivoDoErro(error)
}

// Máximo de Vida/Sanidade/PE do alvo (a mesma conta das barras da ficha).
export async function maximoDoAlvo(d: DadosDoAlvo, recurso: Recurso): Promise<number | null> {
  if (d.tipo === 'criatura') return recurso === 'pv' ? d.pv_maximo ?? null : null
  if (d.tipo !== 'ficha') return null
  if (recurso === 'pv' && d.max_pv_override != null) return d.max_pv_override
  if (recurso === 'san' && d.max_sanity_override != null) return d.max_sanity_override
  if (recurso === 'pe' && d.max_pe_override != null) return d.max_pe_override
  let classe: Parameters<typeof computeDerivedStats>[0] | null = null
  if (d.class_id) {
    const { data } = await supabase.from('classes').select('*').eq('id', d.class_id).maybeSingle()
    classe = data
  } else if (d.custom_class) classe = classePropria(d.custom_class as unknown as NonNullable<CharacterRecord['custom_class']>)
  if (!classe) return null
  const m = computeDerivedStats(classe, (d.atributos ?? {}) as Parameters<typeof computeDerivedStats>[1], d.nex ?? 0, d.poderes)
  return recurso === 'pv' ? m.maxPv : recurso === 'san' ? m.maxSanity : m.maxPe
}

// Botão Curar: rola a cura e soma em cada alvo, sem passar do máximo.
export async function rolarCuraDaMensagem(m: Mensagem): Promise<string | null> {
  const acao = m.acao
  if (acao?.tipo !== 'cura') return null
  const r = rolarCura(acao.formula)
  if (!r) return 'Não deu pra rolar a fórmula da cura.'
  const { error } = await supabase.rpc('registrar_na_acao', { p_msg_id: m.id, p_chave: 'cura', p_valor: r })
  if (error) return motivoDoErro(error)
  if (m.character_id) {
    recordRoll({
      characterId: m.character_id, userId: m.user_id, campaignId: m.campaign_id, characterName: acao.curador,
      label: `Cura: ${acao.fonte}`, total: r.total, detail: r.dados.map((x) => `d${x.sides}: ${x.value}`).join(' · '), dice: r.dados, semChat: true,
    })
  }
  for (const a of acao.alvos) {
    const dados = await dadosDoAlvo(a.token_id)
    if (!dados || dados.tipo === 'nenhum') continue
    const maximo = await maximoDoAlvo(dados, acao.recurso)
    const { error: erro } = await supabase.rpc('aplicar_cura_da_acao', { p_msg_id: m.id, p_token_id: a.token_id, p_valor: r.total, p_maximo: maximo })
    if (erro) return motivoDoErro(erro)
  }
  return null
}
