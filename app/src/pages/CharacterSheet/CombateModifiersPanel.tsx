import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import removeIcon from '../../assets/pericias/remove-icon.svg'
import { useVersaoDaFicha } from './fichaAoVivo'
import type { Modifier } from './ModifiersPanel'

type Scope = 'ataque' | 'dano'

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

export default function CombateModifiersPanel({
  characterId,
  onAttackChange,
  onDamageChange,
}: {
  characterId: string
  onAttackChange: (mods: Modifier[]) => void
  onDamageChange: (mods: Modifier[]) => void
}) {
  // Recarrega quando a ficha muda em qualquer lugar (Realtime, 11/10).
  const versao = useVersaoDaFicha()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Scope>('ataque')
  const [attackMods, setAttackMods] = useState<Modifier[]>([])
  const [damageMods, setDamageMods] = useState<Modifier[]>([])

  const [name, setName] = useState('')
  const [diceBonus, setDiceBonus] = useState(0)
  const [valueBonus, setValueBonus] = useState(0)
  const [threatBonus, setThreatBonus] = useState(0)
  const [multiplierBonus, setMultiplierBonus] = useState(0)
  const [damageType, setDamageType] = useState('')

  async function loadScoped() {
    const [{ data: attackData }, { data: damageData }] = await Promise.all([
      supabase.from('character_modifiers').select('id, name, dice_bonus, value_bonus, threat_margin_bonus, multiplier_bonus, damage_type, is_active').eq('character_id', characterId).eq('scope', 'ataque'),
      supabase.from('character_modifiers').select('id, name, dice_bonus, value_bonus, threat_margin_bonus, multiplier_bonus, damage_type, is_active').eq('character_id', characterId).eq('scope', 'dano'),
    ])
    setAttackMods(attackData ?? [])
    setDamageMods(damageData ?? [])
    onAttackChange(attackData ?? [])
    onDamageChange(damageData ?? [])
  }

  useEffect(() => { loadScoped() }, [characterId, versao])

  async function addModifier() {
    if (!name) return
    await supabase.from('character_modifiers').insert({
      character_id: characterId,
      scope: tab,
      name,
      dice_bonus: tab === 'ataque' ? diceBonus : 0,
      value_bonus: valueBonus,
      threat_margin_bonus: tab === 'ataque' ? threatBonus : 0,
      multiplier_bonus: tab === 'ataque' ? multiplierBonus : 0,
      damage_type: tab === 'dano' ? (damageType || null) : null,
    })
    setName(''); setDiceBonus(0); setValueBonus(0); setThreatBonus(0); setMultiplierBonus(0); setDamageType('')
    await loadScoped()
  }

  async function toggleActive(m: Modifier) {
    await supabase.from('character_modifiers').update({ is_active: !m.is_active }).eq('id', m.id)
    await loadScoped()
  }

  async function remove(id: string) {
    await supabase.from('character_modifiers').delete().eq('id', id)
    await loadScoped()
  }

  const list = tab === 'ataque' ? attackMods : damageMods

  return (
    <div className="combat-modpanel-frame">
      <button type="button" className="combat-modpanel-title" onClick={() => setOpen((o) => !o)}>
        MODIFICADORES DE COMBATE
      </button>

      {open && (
        <div className="modpanel-body combat-modpanel-body">
          <div className="combatmod-tabs">
            <button type="button" className={`combatmod-tab${tab === 'ataque' ? ' active' : ''}`} onClick={() => setTab('ataque')}>MODIFICADOR DE ATAQUE</button>
            <button type="button" className={`combatmod-tab${tab === 'dano' ? ' active' : ''}`} onClick={() => setTab('dano')}>MODIFICADOR DE DANO</button>
          </div>

          {tab === 'ataque' ? (
            <>
              <div className="modpanel-counters">
                <Counter label="Dados Bônus" value={diceBonus} onChange={setDiceBonus} />
                <Counter label="Valor Bônus" value={valueBonus} onChange={setValueBonus} />
              </div>
              <div className="modpanel-counters">
                <Counter label="Margem Crítica Bônus" value={threatBonus} onChange={setThreatBonus} />
                <Counter label="Multiplicador Crítico Bônus" value={multiplierBonus} onChange={setMultiplierBonus} />
              </div>
            </>
          ) : (
            <div className="modpanel-counters">
              <Counter label="Dano Bônus" value={valueBonus} onChange={setValueBonus} />
              <div className="modpanel-field">
                <span className="modpanel-counter-label">Tipo de Dano</span>
                <input value={damageType} onChange={(e) => setDamageType(e.target.value)} />
              </div>
            </div>
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

          {list.length > 0 && (
            <ul className="modpanel-list">
              {list.map((m) => (
                <li key={m.id} className="modpanel-pill">
                  <label className="modpanel-pill-check">
                    <input type="checkbox" checked={m.is_active} onChange={() => toggleActive(m)} />
                    <span>
                      {m.name}
                      {m.dice_bonus ? ` ${m.dice_bonus >= 0 ? '+' : ''}${m.dice_bonus}d` : ''}
                      {m.value_bonus ? ` ${m.value_bonus >= 0 ? '+' : ''}${m.value_bonus}` : ''}
                      {tab === 'ataque' && m.threat_margin_bonus ? ` margem ${m.threat_margin_bonus >= 0 ? '+' : ''}${m.threat_margin_bonus}` : ''}
                      {tab === 'ataque' && m.multiplier_bonus ? ` mult. ${m.multiplier_bonus >= 0 ? '+' : ''}${m.multiplier_bonus}` : ''}
                      {tab === 'dano' && m.damage_type ? ` (${m.damage_type})` : ''}
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
