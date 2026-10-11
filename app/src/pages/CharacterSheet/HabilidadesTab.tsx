import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { CharacterRecord } from './index'
import AbilityPickerModal, { textoDoAliado, type AbilityPickResult } from './AbilityPickerModal'
import { TextoRico } from '../../components/TextoRico'
import AbilityEditModal, { type AbilityEditDraft } from './AbilityEditModal'

type AbilityEntry = {
  id: string
  name: string
  description: string
  editable: boolean
  hasElement: boolean
  element: string | null
  /** Token do aliado. */
  imageUrl?: string | null
  /** Poder do livro com texto editado só nesta ficha: dá pra voltar ao original. */
  editadoDoLivro?: boolean
}

export default function HabilidadesTab({ character }: { character: CharacterRecord }) {
  const [current, setCurrent] = useState<AbilityEntry[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<AbilityEntry | null>(null)
  const [tempBonuses, setTempBonuses] = useState<{ id: string; source: string; attribute_group: string; dice: string; remaining: number }[]>([])

  useEffect(() => {
    supabase.from('character_temp_bonuses').select('id, source, attribute_group, dice, remaining').eq('character_id', character.id).gt('remaining', 0).then(({ data }) => setTempBonuses(data ?? []))
  }, [character.id])

  async function loadCurrent() {
    const { data } = await supabase
      .from('character_abilities')
      .select('id, class_power_id, paranormal_power_id, general_power_id, origin_power_of, class_track_tier_id, ally_id, custom_ability, allies(name, descricao, bonus, habilidade_nome, habilidade, image_url), class_powers(name, description), paranormal_powers(name, description), general_powers(name, description), origins(power_name, power_description), class_track_tiers(name, description)')
      .eq('character_id', character.id)

    const entries: AbilityEntry[] = (data ?? []).map((row: any) => {
      // Poder do livro (classe, paranormal, geral, origem, trilha) também é editável (pedido 11/10):
      // o texto editado fica em custom_ability desta ficha e o vínculo com o livro continua.
      const doLivro = !!(row.class_powers || row.paranormal_powers || row.general_powers || row.origins || row.class_track_tiers)
      if (row.custom_ability) {
        return { id: row.id, name: row.custom_ability.name, description: row.custom_ability.description, editable: true, hasElement: !!row.custom_ability.hasElement, element: row.custom_ability.element ?? null, editadoDoLivro: doLivro }
      }
      if (row.class_powers) return { id: row.id, name: row.class_powers.name, description: row.class_powers.description, editable: true, hasElement: false, element: null }
      if (row.paranormal_powers) return { id: row.id, name: row.paranormal_powers.name, description: row.paranormal_powers.description, editable: true, hasElement: false, element: null }
      if (row.general_powers) return { id: row.id, name: row.general_powers.name, description: row.general_powers.description, editable: true, hasElement: false, element: null }
      if (row.origins) return { id: row.id, name: row.origins.power_name, description: row.origins.power_description, editable: true, hasElement: false, element: null }
      if (row.allies) return { id: row.id, name: row.allies.name, description: textoDoAliado(row.allies), editable: false, hasElement: false, element: null, imageUrl: row.allies.image_url }
      if (row.class_track_tiers) return { id: row.id, name: row.class_track_tiers.name, description: row.class_track_tiers.description, editable: true, hasElement: false, element: null }
      return { id: row.id, name: '(desconhecida)', description: '', editable: false, hasElement: false, element: null }
    })
    setCurrent(entries)
  }

  useEffect(() => { loadCurrent() }, [character.id])

  async function removeAbility(id: string) {
    await supabase.from('character_abilities').delete().eq('id', id)
    await loadCurrent()
  }

  async function saveEdit(entry: AbilityEntry, draft: AbilityEditDraft) {
    await supabase.from('character_abilities').update({
      custom_ability: { name: draft.name, hasElement: draft.hasElement, element: draft.hasElement ? draft.element : null, description: draft.description },
    }).eq('id', entry.id)
    setEditing(null)
    await loadCurrent()
  }

  async function voltarAoOriginal(entry: AbilityEntry) {
    await supabase.from('character_abilities').update({ custom_ability: null }).eq('id', entry.id)
    await loadCurrent()
  }

  async function addFromPicker(result: AbilityPickResult) {
    const patch: Record<string, unknown> = {}
    if (result.kind === 'custom') {
      patch.custom_ability = { name: result.name, hasElement: result.hasElement, element: result.element, description: result.description }
    } else if (result.kind === 'paranormal_power') patch.paranormal_power_id = result.id
    else if (result.kind === 'general_power') patch.general_power_id = result.id
    else if (result.kind === 'origin') patch.origin_power_of = result.id
    else if (result.kind === 'ally') patch.ally_id = result.id
    else patch.class_power_id = result.id

    await supabase.from('character_abilities').insert({ character_id: character.id, ...patch })
    setPicking(false)
    await loadCurrent()
  }

  const filtered = current.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {tempBonuses.length > 0 && (
        <div className="combat-ammo-empty">
          <strong>Lembrete — bônus de interlúdio disponíveis:</strong>
          <ul>
            {tempBonuses.map((b) => (
              <li key={b.id}>{b.source}: {b.remaining}x {b.dice} em testes de {b.attribute_group === 'fisico' ? 'Agilidade/Força/Vigor' : b.attribute_group === 'mental' ? 'Intelecto/Presença' : 'qualquer teste'} (use em Interlúdio)</li>
            ))}
          </ul>
        </div>
      )}

      <div className="combat-search-row">
        <div className="combat-search-field">
          <input className="combat-search-input" placeholder="Buscar Habilidades" value={search} onChange={(e) => setSearch(e.target.value)} />
          <svg className="combat-search-icon" viewBox="0 0 24 24" aria-hidden>
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <button type="button" className="combat-add-btn" onClick={() => setPicking(true)}>Adicionar Habilidade</button>
      </div>

      {filtered.map((a) => (
        <div className="ability-frame" key={a.id}>
          <button type="button" className="ability-header" onClick={() => setExpandedId((v) => (v === a.id ? null : a.id))}>
            {a.imageUrl && <img className="aliado-token" src={a.imageUrl} alt="" />}
            <span>{a.name}</span>
            <span className="ability-chevron">{expandedId === a.id ? '▲' : '▾'}</span>
          </button>
          {expandedId === a.id && (
            <div className="ability-body">
              <p className="ability-description"><TextoRico texto={a.description} /></p>
              <div className="ability-actions">
                <button type="button" className="ability-action-btn" onClick={() => removeAbility(a.id)}>Remover</button>
                {a.editable && <button type="button" className="ability-action-btn" onClick={() => setEditing(a)}>Editar</button>}
                {a.editadoDoLivro && <button type="button" className="ability-action-btn" onClick={() => voltarAoOriginal(a)} title="Desfaz a edição e volta ao texto do livro">Voltar ao original</button>}
              </div>
            </div>
          )}
        </div>
      ))}

      {editing && (
        <AbilityEditModal
          initial={{ name: editing.name, hasElement: editing.hasElement, element: editing.element ?? '', description: editing.description }}
          onClose={() => setEditing(null)}
          onSave={(draft) => saveEdit(editing, draft)}
        />
      )}

      {picking && (
        <AbilityPickerModal characterId={character.id} onClose={() => setPicking(false)} onAdd={addFromPicker} />
      )}
    </div>
  )
}
