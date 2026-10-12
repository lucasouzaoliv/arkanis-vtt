import { recortarImagem } from '../../components/RecortarImagem'
import { nomeSeguro } from '../../lib/nomeDeArquivo'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import type { AttributeKey } from '../../lib/rules'
import { TextareaFormatada } from '../../components/TextoRico'
import mysteryIcon from '../../assets/combate/op-icon-misterio-custom.png'
import CampoTipoDeDano from './CampoTipoDeDano'
import { ajustesDaEdicao, type NumerosDaArma } from './ajustesDoAtaque'

type DamageRow = { formula: string; tipo: string }
type ModEntry = { kind: 'modificacao' | 'maldicao'; name: string; effect: string; elemento: string | null }

type AttackDraft = {
  name: string
  skillId: string
  attribute: AttributeKey
  d20Bonus: number
  attackBonus: string
  threatMargin: number
  multiplier: number
  damageAttribute: AttributeKey | 'nenhum'
  damage: DamageRow[]
  tipo: string
  empunhadura: string
  alcance: string
  tipoMunicao: string
  descricao: string
}

type AltAttackDraft = AttackDraft & { id: string }

const ATTR_OPTIONS: { value: AttributeKey; label: string }[] = [
  { value: 'forca', label: 'Força' },
  { value: 'agilidade', label: 'Agilidade' },
  { value: 'intelecto', label: 'Intelecto' },
  { value: 'vigor', label: 'Vigor' },
  { value: 'presenca', label: 'Presença' },
]

// Atributo Dano com "Nenhum" (pedido 12/10): arma de Luta que usa Agilidade, sem somar nada no dano.
const ATTR_DANO_OPTIONS: { value: AttributeKey | 'nenhum'; label: string }[] = [{ value: 'nenhum', label: 'Nenhum' }, ...ATTR_OPTIONS]

const TIPO_OPTIONS = [
  { value: '', label: 'Nenhuma' },
  { value: 'corpo_a_corpo', label: 'Corpo a Corpo' },
  { value: 'arremesso', label: 'Arremesso' },
  { value: 'disparo', label: 'Disparo' },
  { value: 'fogo', label: 'Fogo' },
]

const EMPUNHADURA_OPTIONS = [
  { value: '', label: 'Nenhuma' },
  { value: 'leve', label: 'Leve' },
  { value: 'uma_mao', label: 'Uma Mão' },
  { value: 'duas_maos', label: 'Duas Mãos' },
]

const ALCANCE_OPTIONS = [
  { value: '', label: 'Selecione o alcance' },
  { value: 'curto', label: 'Curto' },
  { value: 'medio', label: 'Médio' },
  { value: 'longo', label: 'Longo' },
  { value: 'extremo', label: 'Extremo' },
]

function emptyDraft(): AttackDraft {
  return {
    name: '', skillId: '', attribute: 'forca', d20Bonus: 0, attackBonus: '', threatMargin: 20, multiplier: 2,
    damageAttribute: 'forca', damage: [{ formula: '', tipo: '' }], tipo: '', empunhadura: '', alcance: '', tipoMunicao: '', descricao: '',
  }
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <div className="attack-field">
      <span className="attack-field-label">{label}</span>
      <div className="attack-select">
        <button type="button" className="attack-select-trigger" onClick={() => setOpen((v) => !v)}>
          <span>{selected?.label ?? '—'}</span>
          <span className="attack-select-arrow">{open ? '▲' : '▾'}</span>
        </button>
        {open && (
          <div className="attack-select-list">
            {options.map((o) => (
              <button key={o.value} type="button" className={o.value === value ? 'selected' : ''} onClick={() => { onChange(o.value); setOpen(false) }}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AttackFields({ draft, onChange, skills }: { draft: AttackDraft; onChange: (patch: Partial<AttackDraft>) => void; skills: { id: string; name: string }[] }) {
  function setDamageRow(i: number, patch: Partial<DamageRow>) {
    const next = draft.damage.map((d, idx) => (idx === i ? { ...d, ...patch } : d))
    onChange({ damage: next })
  }
  function addDamageRow() {
    onChange({ damage: [...draft.damage, { formula: '', tipo: '' }] })
  }
  function removeDamageRow(i: number) {
    onChange({ damage: draft.damage.filter((_, idx) => idx !== i) })
  }

  return (
    <>
      <div className="attack-field">
        <span className="attack-field-label">Nome</span>
        <input className="attack-input" placeholder="Ataque" value={draft.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>

      <div className="attack-field-row">
        <SelectField
          label="Perícia"
          value={draft.skillId}
          options={[{ value: '', label: '—' }, ...skills.map((s) => ({ value: s.id, label: s.name }))]}
          onChange={(v) => onChange({ skillId: v })}
        />
        <SelectField label="Atributo" value={draft.attribute} options={ATTR_OPTIONS} onChange={(v) => onChange({ attribute: v as AttributeKey })} />
      </div>

      <div className="attack-field-row">
        <div className="attack-field">
          <span className="attack-field-label">D20 Bônus de Ataque</span>
          <input className="attack-input" type="number" value={draft.d20Bonus} onChange={(e) => onChange({ d20Bonus: Number(e.target.value) })} />
        </div>
        <div className="attack-field">
          <span className="attack-field-label">Bônus de Ataque</span>
          <input className="attack-input" placeholder="1d4+2" value={draft.attackBonus} onChange={(e) => onChange({ attackBonus: e.target.value })} />
        </div>
      </div>

      <div className="attack-field-row">
        <div className="attack-field">
          <span className="attack-field-label">Margem de Ameça</span>
          <input className="attack-input" type="number" value={draft.threatMargin} onChange={(e) => onChange({ threatMargin: Number(e.target.value) })} />
        </div>
        <div className="attack-field">
          <span className="attack-field-label">Multiplicador</span>
          <input className="attack-input" type="number" value={draft.multiplier} onChange={(e) => onChange({ multiplier: Number(e.target.value) })} />
        </div>
      </div>

      <SelectField label="Atributo Dano" value={draft.damageAttribute} options={ATTR_DANO_OPTIONS} onChange={(v) => onChange({ damageAttribute: v as AttackDraft['damageAttribute'] })} />

      <div className="attack-section-title attack-section-title-inline">
        <span>DANO</span>
        <button type="button" className="attack-add-row-btn" onClick={addDamageRow}>+</button>
      </div>
      {draft.damage.map((d, i) => (
        <div className="attack-field-row attack-damage-row" key={i}>
          <div className="attack-field">
            <span className="attack-field-label">Dano</span>
            <input className="attack-input" placeholder="Escreva aqui" value={d.formula} onChange={(e) => setDamageRow(i, { formula: e.target.value })} />
          </div>
          <CampoTipoDeDano value={d.tipo} onChange={(v) => setDamageRow(i, { tipo: v })} />
          {draft.damage.length > 1 && (
            <button type="button" className="attack-damage-remove" onClick={() => removeDamageRow(i)} aria-label="Remover linha de dano">×</button>
          )}
        </div>
      ))}

      <div className="attack-section-title"><span>INFORMAÇÕES GERAIS</span></div>
      <div className="attack-field-row">
        <SelectField label="Tipo" value={draft.tipo} options={TIPO_OPTIONS} onChange={(v) => onChange({ tipo: v })} />
        <SelectField label="Empunhadura" value={draft.empunhadura} options={EMPUNHADURA_OPTIONS} onChange={(v) => onChange({ empunhadura: v })} />
      </div>
      <div className="attack-field-row">
        <SelectField label="Alcance" value={draft.alcance} options={ALCANCE_OPTIONS} onChange={(v) => onChange({ alcance: v })} />
        <div className="attack-field">
          <span className="attack-field-label">Tipo de Munição</span>
          <input className="attack-input" placeholder="Balas curtas" value={draft.tipoMunicao} onChange={(e) => onChange({ tipoMunicao: e.target.value })} />
        </div>
      </div>
    </>
  )
}

type CatalogEntry = { id: string; name: string; effect: string; elemento?: string | null }

function dedupeCatalog(entries: CatalogEntry[]): CatalogEntry[] {
  const seen = new Set<string>()
  return entries.filter((e) => {
    const key = `${e.name}|${e.effect}|${e.elemento ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function ModifiersModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: ModEntry) => void }) {
  const [tab, setTab] = useState<'modificacao' | 'maldicao'>('modificacao')
  const [creating, setCreating] = useState(false)
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [name, setName] = useState('')
  const [elemento, setElemento] = useState('')
  const [effect, setEffect] = useState('')

  useEffect(() => {
    if (tab === 'modificacao') {
      supabase.from('weapon_mods').select('id, name, effect').in('applies_to', ['corpo_a_corpo_disparo', 'armas_fogo']).order('name').then(({ data }) => setCatalog(dedupeCatalog(data ?? [])))
    } else {
      supabase.from('cursed_afflictions').select('id, name, effect, elemento').eq('applies_to', 'arma').order('name').then(({ data }) => setCatalog(dedupeCatalog(data ?? [])))
    }
  }, [tab])

  function addFromCatalog(c: CatalogEntry) {
    onAdd({ kind: tab, name: c.name, effect: c.effect, elemento: c.elemento ?? null })
    onClose()
  }

  function submitCustom() {
    if (!name || !effect) return
    onAdd({ kind: tab, name, effect, elemento: tab === 'maldicao' ? (elemento || null) : null })
    onClose()
  }

  return (
    <div className="attack-modmodal">
      <div className="attack-modmodal-tabs">
        <button type="button" className={tab === 'modificacao' ? 'active' : ''} onClick={() => { setTab('modificacao'); setCreating(false) }}>Modificações</button>
        <button type="button" className={tab === 'maldicao' ? 'active' : ''} onClick={() => { setTab('maldicao'); setCreating(false) }}>Maldições</button>
      </div>

      {creating ? (
        <>
          <div className="attack-section-title"><span>MELHORIAS | {tab === 'modificacao' ? 'MODIFICAÇÃO' : 'MALDIÇÃO'}</span></div>
          <div className="attack-field">
            <span className="attack-field-label">Nome</span>
            <input className="attack-input" placeholder={tab === 'modificacao' ? 'Nova Modificação' : 'Nova Maldição'} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {tab === 'maldicao' && (
            <div className="attack-field">
              <span className="attack-field-label">Elemento</span>
              <input className="attack-input" placeholder="Elemento aqui" value={elemento} onChange={(e) => setElemento(e.target.value)} />
            </div>
          )}
          <div className="attack-section-title"><span>DESCRIÇÃO</span></div>
          <TextareaFormatada className="attack-textarea" placeholder="Descrição aqui" value={effect} onChange={(e) => setEffect(e.target.value)} />
          <div className="attack-modmodal-actions">
            <button type="button" className="attack-modmodal-back" onClick={() => setCreating(false)}>Voltar</button>
            <button type="button" className="attack-modmodal-create" onClick={submitCustom}>Adicionar</button>
          </div>
        </>
      ) : (
        <>
          <div className="attack-modmodal-list">
            {catalog.length === 0 ? (
              <p className="attack-modmodal-empty">Nenhuma {tab === 'modificacao' ? 'modificação' : 'maldição'} cadastrada ainda pra esse tipo de arma.</p>
            ) : (
              catalog.map((c) => (
                <div className="attack-mod-pill" key={c.id}>
                  <div className="attack-mod-pill-head">
                    <strong>{c.name}{c.elemento ? ` (${c.elemento})` : ''}</strong>
                    <button type="button" onClick={() => addFromCatalog(c)}>Adicionar</button>
                  </div>
                  <p>{c.effect}</p>
                </div>
              ))
            )}
          </div>
          <div className="attack-modmodal-actions">
            <button type="button" className="attack-modmodal-back" onClick={onClose}>Voltar</button>
            <button type="button" className="attack-modmodal-create" onClick={() => setCreating(true)}>Criar Nova {tab === 'modificacao' ? 'Modificação' : 'Maldição'}</button>
          </div>
        </>
      )}
    </div>
  )
}

// Passando `editing`, o mesmo modal serve pra editar: ele abre preenchido e salva por cima
// do ataque existente em vez de criar outro.
export type AttackToEdit = {
  id: string
  name: string
  skill_id: string | null
  attribute: AttributeKey | null
  d20_bonus: number
  attack_bonus?: string | null
  threat_margin: number
  multiplier: number
  damage_attribute?: AttributeKey | null
  damage: DamageRow[]
  general_info: Record<string, unknown> | null
  image_url?: string | null
  modifiers?: ModEntry[] | null
  alternative_attacks?: Record<string, unknown>[] | null
  description?: string | null
  from_inventory_item_id?: string | null
  /** Ataque vindo da arma: os números puros do item, pra guardar só o que a pessoa mudou. */
  daArma?: NumerosDaArma
}

function draftFromAttack(a: AttackToEdit): AttackDraft {
  const info = (a.general_info ?? {}) as Record<string, unknown>
  return {
    name: a.name,
    skillId: a.skill_id ?? '',
    attribute: a.attribute ?? 'forca',
    d20Bonus: a.d20_bonus ?? 0,
    attackBonus: a.attack_bonus ?? '',
    threatMargin: a.threat_margin ?? 20,
    multiplier: a.multiplier ?? 2,
    damageAttribute: info.sem_atributo_no_dano || (a as { sem_atributo_no_dano?: boolean }).sem_atributo_no_dano ? 'nenhum' : a.damage_attribute ?? 'forca',
    // Dano de encanto (Amaldiçoar Arma) vem do ritual, não é editável aqui.
    damage: a.damage?.filter((d) => !(d as { origem?: string }).origem).length ? a.damage.filter((d) => !(d as { origem?: string }).origem).map((d) => ({ formula: d.formula, tipo: d.tipo ?? '' })) : emptyDraft().damage,
    tipo: String(info.tipo ?? ''),
    empunhadura: String(info.empunhadura ?? ''),
    alcance: String(info.alcance ?? ''),
    tipoMunicao: String(info.tipo_municao ?? ''),
    descricao: a.description ?? '',
  }
}

export default function AttackFormModal({
  characterId,
  skills,
  editing,
  onClose,
  onSaved,
}: {
  characterId: string
  skills: { id: string; name: string }[]
  editing?: AttackToEdit
  onClose: () => void
  onSaved: () => void
}) {
  const { session } = useAuth()
  const [tab, setTab] = useState<'ataque' | 'alternativos'>('ataque')
  const [draft, setDraft] = useState<AttackDraft>(editing ? draftFromAttack(editing) : emptyDraft())
  const [alternatives, setAlternatives] = useState<AltAttackDraft[]>(
    (editing?.alternative_attacks ?? []).map((alt: any) => ({
      ...draftFromAttack({ ...alt, general_info: null } as AttackToEdit),
      id: crypto.randomUUID(),
    })),
  )
  const [modifiers, setModifiers] = useState<ModEntry[]>(editing?.modifiers ?? [])
  const [imageUrl, setImageUrl] = useState<string | null>(editing?.image_url ?? null)
  const [showModModal, setShowModModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  function patchDraft(patch: Partial<AttackDraft>) {
    setDraft((d) => ({ ...d, ...patch }))
  }

  function addAlternative() {
    setAlternatives((a) => [...a, { ...emptyDraft(), id: crypto.randomUUID() }])
  }

  function patchAlternative(id: string, patch: Partial<AttackDraft>) {
    setAlternatives((a) => a.map((alt) => (alt.id === id ? { ...alt, ...patch } : alt)))
  }

  function removeAlternative(id: string) {
    setAlternatives((a) => a.filter((alt) => alt.id !== id))
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    // Recorte (pedido da Millie, 08/10): a pessoa enquadra a parte que quer ou usa a inteira.
    const file = escolhido ? await recortarImagem(escolhido, { proporcao: 'quadrado', titulo: 'Imagem do ataque' }) : null
    if (!file || !session) return
    setUploading(true)
    const path = `${session.user.id}/${Date.now()}-${nomeSeguro(file.name)}`
    const { error } = await supabase.storage.from('attack_images').upload(path, file, { upsert: true })
    setUploading(false)
    if (error) return
    const { publicUrl } = supabase.storage.from('attack_images').getPublicUrl(path).data
    setImageUrl(publicUrl)
  }

  async function submit() {
    if (!draft.name) return
    const payload = {
      name: draft.name,
      skill_id: draft.skillId || null,
      attribute: draft.attribute,
      d20_bonus: draft.d20Bonus,
      attack_bonus: draft.attackBonus || null,
      threat_margin: draft.threatMargin,
      multiplier: draft.multiplier,
      damage_attribute: draft.damageAttribute === 'nenhum' ? null : draft.damageAttribute,
      damage: draft.damage.filter((d) => d.formula),
      description: draft.descricao.trim() || null,
      general_info: {
        tipo: draft.tipo || null, empunhadura: draft.empunhadura || null, alcance: draft.alcance || null, tipo_municao: draft.tipoMunicao || null,
        sem_atributo_no_dano: draft.damageAttribute === 'nenhum',
        // Veio da arma: guarda o que mudou em relação a ela (a arma é recalculada a cada abertura).
        ...(editing?.daArma ? { ajustes: ajustesDaEdicao(editing.daArma, { d20_bonus: draft.d20Bonus, threat_margin: draft.threatMargin, multiplier: draft.multiplier, damage: draft.damage.filter((d) => d.formula) }) } : {}),
      },
      image_url: imageUrl,
      modifiers,
      alternative_attacks: alternatives.map(({ id: _id, ...alt }) => ({
        name: alt.name,
        skill_id: alt.skillId || null,
        attribute: alt.attribute,
        d20_bonus: alt.d20Bonus,
        attack_bonus: alt.attackBonus || null,
        threat_margin: alt.threatMargin,
        multiplier: alt.multiplier,
        damage_attribute: alt.damageAttribute === 'nenhum' ? null : alt.damageAttribute,
        sem_atributo_no_dano: alt.damageAttribute === 'nenhum',
        damage: alt.damage.filter((d) => d.formula),
      })),
    }

    if (editing) {
      // A edicao nao mexe em general_info.municao nem nos modificadores herdados da
      // municao: isso e vinculo do inventario, nao campo do formulario.
      const info = { ...editing.general_info, ...payload.general_info }
      await supabase.from('character_attacks').update({ ...payload, general_info: info }).eq('id', editing.id)
    } else {
      await supabase.from('character_attacks').insert({ character_id: characterId, ...payload })
    }
    onSaved()
    onClose()
  }

  return createPortal(
    <div className="attack-modal-backdrop" onClick={onClose}>
      <div className="attack-modal-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="attack-modal-toolbar">
          <div className="attack-modal-tabs">
            <button type="button" className={tab === 'ataque' ? 'active' : ''} onClick={() => setTab('ataque')}>Ataque</button>
            <button type="button" className={tab === 'alternativos' ? 'active' : ''} onClick={() => setTab('alternativos')}>Ataques Alternativos</button>
          </div>
          <button type="button" className="attack-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="attack-modal">
        <div className="attack-modal-body">
          {tab === 'ataque' ? (
            <>
              <div className="attack-section-title"><span>ATAQUE</span></div>
              <AttackFields draft={draft} onChange={patchDraft} skills={skills} />

              <div className="attack-section-title"><span>DESCRIÇÃO</span></div>
              <TextareaFormatada className="attack-textarea" placeholder={editing?.daArma ? 'Vazio usa a descrição da arma' : 'Descrição aqui'} value={draft.descricao} onChange={(e) => patchDraft({ descricao: e.target.value })} />

              <div className="attack-section-title"><span>IMAGEM</span></div>
              <div className="attack-image-box">
                <img src={imageUrl ?? mysteryIcon} alt="" className="attack-image-preview" />
                <label className="attack-image-alter">
                  {uploading ? '...' : 'Alterar'}
                  <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                </label>
              </div>

              <div className="attack-section-title attack-section-title-inline">
                <span>MODIFICADORES E MALDIÇÕES</span>
                <button type="button" className="attack-add-row-btn" onClick={() => setShowModModal(true)}>Adicionar</button>
              </div>
              {modifiers.length > 0 && (
                <div className="attack-mod-list">
                  {modifiers.map((m, i) => (
                    <div className="attack-mod-pill" key={i}>
                      <div className="attack-mod-pill-head">
                        <strong>{m.name}{m.elemento ? ` (${m.elemento})` : ''} | {m.kind === 'modificacao' ? 'MODIFICAÇÃO' : 'MALDIÇÃO'}</strong>
                        <button type="button" onClick={() => setModifiers((mods) => mods.filter((_, idx) => idx !== i))}>Remover</button>
                      </div>
                      <p>{m.effect}</p>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className="attack-submit-btn" onClick={submit}>{editing ? 'Editar Ataque' : 'Adicionar Ataque'}</button>
            </>
          ) : (
            <>
              <div className="attack-section-title attack-section-title-inline">
                <span>ATAQUES ALTERNATIVOS</span>
                <button type="button" className="attack-add-row-btn" onClick={addAlternative}>Adicionar</button>
              </div>
              {alternatives.map((alt, i) => (
                <div className="attack-alt-block" key={alt.id}>
                  <div className="attack-section-title"><span>ATAQUE ALTERNATIVO {i + 1}</span></div>
                  <AttackFields draft={alt} onChange={(patch) => patchAlternative(alt.id, patch)} skills={skills} />
                  <button type="button" className="attack-alt-remove" onClick={() => removeAlternative(alt.id)}>Remover</button>
                </div>
              ))}
              <button type="button" className="attack-submit-btn" onClick={submit}>{editing ? 'Editar Ataque' : 'Adicionar Ataque'}</button>
            </>
          )}
        </div>
        </div>

        {showModModal && (
          <div className="attack-modmodal-backdrop" onClick={() => setShowModModal(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <ModifiersModal onClose={() => setShowModModal(false)} onAdd={(m) => setModifiers((mods) => [...mods, m])} />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
