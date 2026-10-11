import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useVersaoDaFicha } from './fichaAoVivo'
import removeIcon from '../../assets/pericias/remove-icon.svg'

export type Modifier = {
  id: string
  name: string
  dice_bonus: number
  value_bonus: number
  threat_margin_bonus: number
  multiplier_bonus: number
  damage_type: string | null
  is_active: boolean
}

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="modpanel-counter">
      <span className="modpanel-counter-label">{label}</span>
      <div className="modpanel-counter-row">
        <button type="button" onClick={() => onChange(value - 1)} aria-label={`Diminuir ${label}`}>−</button>
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <button type="button" onClick={() => onChange(value + 1)} aria-label={`Aumentar ${label}`}>+</button>
      </div>
    </div>
  )
}

export default function ModifiersPanel({
  characterId,
  scope,
  title = 'MODIFICADOR DE TESTES',
  showThreatAndMultiplier,
  onChange,
  onDraftChange,
}: {
  characterId: string
  scope: 'teste' | 'ataque' | 'dano'
  title?: string
  showThreatAndMultiplier?: boolean
  onChange?: (modifiers: Modifier[]) => void
  onDraftChange?: (draft: { diceBonus: number; valueBonus: number }) => void
}) {
  // Recarrega quando a ficha muda em qualquer lugar (Realtime, 11/10).
  const versao = useVersaoDaFicha()
  const [modifiers, setModifiers] = useState<Modifier[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [diceBonus, setDiceBonus] = useState(0)
  const [valueBonus, setValueBonus] = useState(0)
  const [threatBonus, setThreatBonus] = useState(0)
  const [multiplierBonus, setMultiplierBonus] = useState(0)
  const [damageType, setDamageType] = useState('')

  async function load() {
    const { data } = await supabase
      .from('character_modifiers')
      .select('id, name, dice_bonus, value_bonus, threat_margin_bonus, multiplier_bonus, damage_type, is_active')
      .eq('character_id', characterId)
      .eq('scope', scope)
    setModifiers(data ?? [])
    onChange?.(data ?? [])
  }

  useEffect(() => { load() }, [characterId, scope, versao])

  useEffect(() => { onDraftChange?.({ diceBonus, valueBonus }) }, [diceBonus, valueBonus])

  async function addModifier() {
    if (!name) return
    await supabase.from('character_modifiers').insert({
      character_id: characterId,
      scope,
      name,
      dice_bonus: diceBonus,
      value_bonus: valueBonus,
      threat_margin_bonus: threatBonus,
      multiplier_bonus: multiplierBonus,
      damage_type: damageType || null,
    })
    setName(''); setDiceBonus(0); setValueBonus(0); setThreatBonus(0); setMultiplierBonus(0); setDamageType('')
    await load()
  }

  async function toggleActive(m: Modifier) {
    await supabase.from('character_modifiers').update({ is_active: !m.is_active }).eq('id', m.id)
    await load()
  }

  async function remove(id: string) {
    await supabase.from('character_modifiers').delete().eq('id', id)
    await load()
  }

  return (
    <div className="modpanel">
      <button type="button" className="modpanel-title" onClick={() => setOpen((o) => !o)}>
        {title}
      </button>

      {open && (
        <div className="modpanel-body">
          <div className="modpanel-counters">
            <Counter label="Dados Bônus" value={diceBonus} onChange={setDiceBonus} />
            <Counter label="Valor Bônus" value={valueBonus} onChange={setValueBonus} />
          </div>

          {showThreatAndMultiplier && (
            <div className="modpanel-counters">
              <label className="modpanel-field">Margem Crítica Bônus <input type="number" value={threatBonus} onChange={(e) => setThreatBonus(Number(e.target.value))} /></label>
              <label className="modpanel-field">Multiplicador Crítico Bônus <input type="number" value={multiplierBonus} onChange={(e) => setMultiplierBonus(Number(e.target.value))} /></label>
            </div>
          )}

          {scope === 'dano' && (
            <label className="modpanel-field">Tipo de Dano <input value={damageType} onChange={(e) => setDamageType(e.target.value)} /></label>
          )}

          <div className="modpanel-add-row">
            <input
              className="modpanel-name-input"
              placeholder="Nome do Modificador"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addModifier()}
            />
            <button type="button" className="modpanel-add-btn" onClick={addModifier}>Adicionar</button>
          </div>

          {modifiers.length > 0 && (
            <ul className="modpanel-list">
              {modifiers.map((m) => (
                <li key={m.id} className="modpanel-pill">
                  <label className="modpanel-pill-check">
                    <input type="checkbox" checked={m.is_active} onChange={() => toggleActive(m)} />
                    <span>
                      {m.name}
                      {m.dice_bonus ? ` ${m.dice_bonus >= 0 ? '+' : ''}${m.dice_bonus}d` : ''}
                      {m.value_bonus ? ` ${m.value_bonus >= 0 ? '+' : ''}${m.value_bonus}` : ''}
                      {showThreatAndMultiplier && m.threat_margin_bonus ? ` margem ${m.threat_margin_bonus >= 0 ? '+' : ''}${m.threat_margin_bonus}` : ''}
                      {showThreatAndMultiplier && m.multiplier_bonus ? ` mult. ${m.multiplier_bonus >= 0 ? '+' : ''}${m.multiplier_bonus}` : ''}
                    </span>
                  </label>
                  <button type="button" className="modpanel-pill-remove" onClick={() => remove(m.id)} aria-label={`Remover ${m.name}`}>
                    <img src={removeIcon} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
