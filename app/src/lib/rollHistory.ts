import { supabase } from './supabase'

// Dono de cada ficha, pra rolagem sempre sair em nome dele — mesmo quando quem rola é o
// mestre abrindo a ficha do jogador pela mesa (o banco exige isso).
const donos = new Map<string, string>()

async function donoDaFicha(characterId: string, reserva: string): Promise<string> {
  const conhecido = donos.get(characterId)
  if (conhecido) return conhecido
  const { data } = await supabase.from('characters').select('user_id').eq('id', characterId).maybeSingle()
  const dono = data?.user_id ?? reserva
  donos.set(characterId, dono)
  return dono
}

// Quem só está olhando a ficha de outra pessoa (sem poder editar) pode rolar pra ver o resultado,
// mas a rolagem não entra no Histórico nem no chat: não dá pra rolar como o personagem dos outros.
const podeRegistrar = new Map<string, boolean>()

async function podeRegistrarNaFicha(characterId: string): Promise<boolean> {
  const conhecido = podeRegistrar.get(characterId)
  if (conhecido !== undefined) return conhecido
  const { data, error } = await supabase.rpc('pode_editar_ficha', { p_character_id: characterId })
  if (error) return true // na dúvida, tenta gravar (o banco confere de novo)
  podeRegistrar.set(characterId, !!data)
  return !!data
}

export async function recordRoll(params: {
  characterId: string
  userId: string
  campaignId: string | null
  characterName: string
  label: string
  total: number
  detail: string
  dice?: { sides: number; value: number; discarded?: boolean }[]
  bonus?: number
  // Texto embaixo da rolagem (ex.: "Gastou 3 PE (12 → 9)").
  nota?: string | null
  // Registro sem dados (ex.: ritual sem dano): aparece só com o nome e a nota.
  semRolagem?: boolean
  // Rolagem que já aparece no chat de outro jeito (botões do ataque com mira): só no Histórico.
  semChat?: boolean
  // Dano com cada parte separada ("1d6 Impacto: 3", "4d6 Energia (Amaldiçoar Arma): 8").
  partes?: { formula: string; tipo: string; origem?: string; elemento?: string; lados: number; total: number }[]
  // Ritual conjurado: o chat mostra a textura do elemento e o símbolo (11/10).
  ritual?: { nome: string; elemento: string | null; imagem: string | null } | null
  // Som de arma que a mesa toca com o dado (13/10).
  som?: string | null
}) {
  if (!(await podeRegistrarNaFicha(params.characterId))) return
  await supabase.from('character_rolls').insert({
    character_id: params.characterId,
    user_id: await donoDaFicha(params.characterId, params.userId),
    campaign_id: params.campaignId,
    character_name: params.characterName,
    label: params.label,
    total: params.total,
    detail: params.detail,
    dice: params.dice ?? null,
    bonus: params.bonus ?? 0,
    nota: params.nota ?? null,
    sem_rolagem: params.semRolagem ?? false,
    sem_chat: params.semChat ?? false,
    partes: params.partes?.length ? params.partes : null,
    ritual: params.ritual ?? null,
    som: params.som ?? null,
  })
  window.dispatchEvent(new CustomEvent('vtt-roll-recorded'))
}
