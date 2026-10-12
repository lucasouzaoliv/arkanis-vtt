import { supabase } from '../../lib/supabase'
import type { AttributeKey } from '../../lib/rules'

// Teste de ataque escolhido no próprio item, no inventário (pedido 12/10): perícia, atributo do
// teste e atributo do dano. Fica em stats (pericia_ataque, atributo_ataque, atributo_dano); vazio
// é o automático de sempre.

const ATRIBUTOS = [
  { value: 'forca', label: 'Força' },
  { value: 'agilidade', label: 'Agilidade' },
  { value: 'intelecto', label: 'Intelecto' },
  { value: 'vigor', label: 'Vigor' },
  { value: 'presenca', label: 'Presença' },
]

export const ATRIBUTO_DO_ATAQUE_OPTIONS = [{ value: '', label: 'Automático' }, ...ATRIBUTOS]
export const ATRIBUTO_DO_DANO_OPTIONS = [{ value: '', label: 'Automático' }, { value: 'nenhum', label: 'Nenhum' }, ...ATRIBUTOS]

export type TesteDoAtaque = {
  skill_id: string | null
  attribute: AttributeKey
  damage_attribute: AttributeKey | null
  sem_atributo_no_dano: boolean
}

// O que vai pro ataque: a escolha do item ou o automático (corpo a corpo = Luta/Força).
export function escolhaDoTeste(
  stats: Record<string, unknown>,
  corpoACorpo: boolean,
  idDaPericia: (nome: string) => string | null,
): TesteDoAtaque {
  const dano = String(stats.atributo_dano ?? '')
  return {
    skill_id: stats.pericia_ataque ? String(stats.pericia_ataque) : idDaPericia(corpoACorpo ? 'Luta' : 'Pontaria'),
    attribute: (stats.atributo_ataque ? String(stats.atributo_ataque) : corpoACorpo ? 'forca' : 'agilidade') as AttributeKey,
    damage_attribute: dano && dano !== 'nenhum' ? (dano as AttributeKey) : null,
    sem_atributo_no_dano: dano === 'nenhum',
  }
}

export async function testeDoItem(stats: Record<string, unknown>, corpoACorpo: boolean): Promise<TesteDoAtaque> {
  const { data } = await supabase.from('skills').select('id, name')
  const pericias = (data ?? []) as { id: string; name: string }[]
  return escolhaDoTeste(stats, corpoACorpo, (nome) => pericias.find((p) => p.name === nome)?.id ?? null)
}

// Salvou o item: os ataques já enviados dele acompanham o que foi escolhido (só o que não é automático).
export async function atualizarAtaquesDoItem(inventarioId: string, escolha: { pericia: string; atributo: string; atributoDano: string }) {
  if (!escolha.pericia && !escolha.atributo && !escolha.atributoDano) return
  const { data } = await supabase.from('character_attacks').select('id, general_info').eq('from_inventory_item_id', inventarioId)
  for (const a of (data ?? []) as { id: string; general_info: Record<string, unknown> | null }[]) {
    const patch: Record<string, unknown> = {}
    if (escolha.pericia) patch.skill_id = escolha.pericia
    if (escolha.atributo) patch.attribute = escolha.atributo
    if (escolha.atributoDano) {
      patch.damage_attribute = escolha.atributoDano === 'nenhum' ? null : escolha.atributoDano
      patch.general_info = { ...(a.general_info ?? {}), sem_atributo_no_dano: escolha.atributoDano === 'nenhum' }
    }
    await supabase.from('character_attacks').update(patch).eq('id', a.id)
  }
}
