import { recortarImagem } from '../../components/RecortarImagem'
import { nomeSeguro } from '../../lib/nomeDeArquivo'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import radioChecked from '../../assets/combate/radio-checked.svg'
import radioEmpty from '../../assets/combate/radio-empty.svg'
import lixeira from '../../assets/combate/lixeira.png'
import lixeiraAberta from '../../assets/combate/lixeira-aberta.png'
import defaultRitualImg from '../../assets/rituais/op-default-ritual-img.svg'
import sangueSimbolo from '../../assets/rituais/sangue-simbolo.png'
import morteSimbolo from '../../assets/rituais/morte-simbolo.png'
import conhecimentoSimbolo from '../../assets/rituais/conhecimento-simbolo.png'
import energiaSimbolo from '../../assets/rituais/energia-simbolo.png'
import medoSimbolo from '../../assets/rituais/medo-simbolo.png'
import sangueTexture from '../../assets/rituais/sangue-texture.webp'
import morteTexture from '../../assets/rituais/morte-texture.webp'
import conhecimentoTexture from '../../assets/rituais/conhecimento-texture.webp'
import energiaTexture from '../../assets/rituais/energia-texture.webp'
import { TextareaFormatada } from '../../components/TextoRico'
import medoTexture from '../../assets/rituais/medo-texture.webp'

type ElementKey = 'sangue' | 'morte' | 'conhecimento' | 'energia' | 'medo'

const ELEMENTS: { key: ElementKey; symbol: string; texture: string; color: string }[] = [
  { key: 'sangue', symbol: sangueSimbolo, texture: sangueTexture, color: '#e0403f' },
  { key: 'morte', symbol: morteSimbolo, texture: morteTexture, color: '#f2f2f2' },
  { key: 'conhecimento', symbol: conhecimentoSimbolo, texture: conhecimentoTexture, color: '#e0c040' },
  { key: 'energia', symbol: energiaSimbolo, texture: energiaTexture, color: '#9b5de5' },
  { key: 'medo', symbol: medoSimbolo, texture: medoTexture, color: '#f2f2f2' },
]

const CIRCLES = [1, 2, 3, 4]
const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }

type SourceFilter = 'todos' | 'base' | 'sobrevivendo' | 'arquivos' | 'homebrew'
const SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'base', label: 'Livro Base' },
  { key: 'sobrevivendo', label: 'Sobrevivendo ao Horror' },
  { key: 'arquivos', label: 'Arquivos Secretos' },
  { key: 'homebrew', label: 'Homebrew' },
]

type CatalogRitual = {
  id: string
  name: string
  elemento: string | null
  circle: number
  execution: string | null
  range: string | null
  target: string | null
  duration: string | null
  resistance: string | null
  effect: string
  discente_cost: number | null
  discente_effect: string | null
  verdadeiro_cost: number | null
  verdadeiro_effect: string | null
  image_url: string | null
  sourceSlug: string | null
  homebrewId?: string
}

export type RitualPickResult =
  | { kind: 'catalog'; id: string }
  | {
      kind: 'custom'
      name: string
      elemento: string | null
      circle: number
      execution: string
      duration: string
      target: string
      range: string
      area: string
      resistance: string
      effect: string
      dice: string
      diceDiscente: string
      diceVerdadeiro: string
      image_url: string | null
      description: string
    }

function Picker({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <div className="attack-select ritual-select">
      <button type="button" className="attack-select-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected?.label ?? '—'}</span>
        <span className="attack-select-arrow">{open ? '▲' : '▾'}</span>
      </button>
      {open && (
        <div className="attack-select-list">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={o.value === value ? 'selected' : ''}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function toDraft(): CustomDraft {
  return {
    name: '', elemento: '', circle: 1, execution: '', duration: '', target: '', range: '', area: '',
    resistance: '', effect: '', dice: '', diceDiscente: '', diceVerdadeiro: '', image_url: null, description: '',
  }
}
type CustomDraft = {
  name: string; elemento: string; circle: number; execution: string; duration: string; target: string
  range: string; area: string; resistance: string; effect: string; dice: string; diceDiscente: string
  diceVerdadeiro: string; image_url: string | null; description: string
}

export default function RitualPickerModal({
  characterId,
  onClose,
  onAdd,
  onDeleteHomebrew,
}: {
  characterId: string
  onClose: () => void
  onAdd: (result: RitualPickResult) => void
  onDeleteHomebrew: (characterRitualId: string) => Promise<void>
}) {
  const [elementFilter, setElementFilter] = useState<ElementKey[]>([])
  const [circleFilter, setCircleFilter] = useState<number[]>([])
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('todos')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<CatalogRitual[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<CustomDraft>(toDraft())
  const [trashHover, setTrashHover] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setSelectedId(null)
    setCreating(false)

    if (sourceFilter === 'homebrew') {
      supabase
        .from('character_rituals')
        .select('id, custom_ritual')
        .eq('character_id', characterId)
        .not('custom_ritual', 'is', null)
        .then(({ data }) =>
          setItems(
            (data ?? []).map((r: any) => ({
              id: `hb-${r.id}`,
              homebrewId: r.id,
              name: r.custom_ritual.name,
              elemento: r.custom_ritual.elemento ?? null,
              circle: r.custom_ritual.circle ?? 1,
              execution: r.custom_ritual.execution ?? null,
              range: r.custom_ritual.range ?? null,
              target: r.custom_ritual.target ?? null,
              duration: r.custom_ritual.duration ?? null,
              resistance: r.custom_ritual.resistance ?? null,
              effect: r.custom_ritual.effect ?? '',
              discente_cost: null,
              discente_effect: null,
              verdadeiro_cost: null,
              verdadeiro_effect: null,
              image_url: r.custom_ritual.image_url ?? null,
              sourceSlug: null,
            })),
          ),
        )
      return
    }

    supabase
      .from('rituals')
      .select('id, name, elemento, circle, execution, range, target, duration, resistance, effect, discente_cost, discente_effect, verdadeiro_cost, verdadeiro_effect, image_url, sources(slug)')
      .order('circle')
      .order('name')
      .then(({ data }) =>
        setItems((data ?? []).map((r: any) => ({ ...r, sourceSlug: r.sources?.slug ?? null }))),
      )
  }, [sourceFilter, characterId])

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  function matchesSource(item: CatalogRitual): boolean {
    if (sourceFilter === 'todos' || sourceFilter === 'homebrew') return true
    if (!item.sourceSlug) return true
    if (sourceFilter === 'base') return item.sourceSlug === 'ordem_paranormal'
    if (sourceFilter === 'sobrevivendo') return item.sourceSlug === 'sobrevivendo_ao_horror'
    if (sourceFilter === 'arquivos') return item.sourceSlug.startsWith('arquivos_secretos')
    return true
  }

  const filteredItems = items.filter((r) => {
    if (!matchesSource(r)) return false
    if (elementFilter.length && (!r.elemento || !elementFilter.includes(r.elemento as ElementKey))) return false
    if (circleFilter.length && !circleFilter.includes(r.circle)) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const selected = items.find((r) => r.id === selectedId) ?? null

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    // Recorte (pedido da Millie, 08/10): a pessoa enquadra a parte que quer ou usa a inteira.
    const file = escolhido ? await recortarImagem(escolhido, { proporcao: 'quadrado', titulo: 'Imagem do ritual' }) : null
    if (!file) return
    setUploading(true)
    const path = `${characterId}/${Date.now()}-${nomeSeguro(file.name)}`
    const { error } = await supabase.storage.from('ritual_images').upload(path, file, { upsert: true })
    setUploading(false)
    if (error) return
    const { publicUrl } = supabase.storage.from('ritual_images').getPublicUrl(path).data
    setDraft((d) => ({ ...d, image_url: publicUrl }))
  }

  function submitCatalog() {
    if (!selected) return
    onAdd({ kind: 'catalog', id: selected.id })
  }

  function submitCustom() {
    if (!draft.name.trim()) return
    onAdd({
      kind: 'custom',
      name: draft.name.trim(),
      elemento: draft.elemento || null,
      circle: draft.circle,
      execution: draft.execution,
      duration: draft.duration,
      target: draft.target,
      range: draft.range,
      area: draft.area,
      resistance: draft.resistance,
      effect: draft.effect,
      dice: draft.dice,
      diceDiscente: draft.diceDiscente,
      diceVerdadeiro: draft.diceVerdadeiro,
      image_url: draft.image_url,
      description: draft.description,
    })
  }

  async function trashSelected() {
    if (selected?.homebrewId) {
      await onDeleteHomebrew(selected.homebrewId)
      setItems((list) => list.filter((r) => r.id !== selected.id))
      setSelectedId(null)
    }
  }

  return createPortal(
    <div className="conditions-modal-backdrop ritual-picker-backdrop" onClick={onClose}>
      <div className="conditions-modal-shell ritual-picker-shell" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ritual-close-outside" onClick={onClose} aria-label="Fechar">
          <span className="ritual-close-word">FECHAR</span>
          <span className="ritual-close-x">X</span>
        </button>

        <nav className="ritual-picker-sidebar">
          {ELEMENTS.map((el) => {
            const on = elementFilter.includes(el.key)
            return (
              <button
                key={el.key}
                type="button"
                className={`ritual-el-btn${on ? ' active' : ''}`}
                style={{
                  backgroundImage: `url(${el.texture})`,
                  borderColor: on ? el.color : `rgba(from ${el.color} r g b / .5)`,
                  boxShadow: on ? `0 0 9px 1px ${el.color}` : 'none',
                }}
                onClick={() => setElementFilter((f) => toggle(f, el.key))}
                aria-pressed={on}
                title={el.key}
              >
                <img src={el.symbol} alt={el.key} />
              </button>
            )
          })}

          {CIRCLES.map((c) => (
            <button
              key={c}
              type="button"
              className={`ritual-circle-sq${circleFilter.includes(c) ? ' active' : ''}`}
              onClick={() => setCircleFilter((f) => toggle(f, c))}
              aria-pressed={circleFilter.includes(c)}
            >
              {ROMAN[c]}
            </button>
          ))}

          <button
            type="button"
            className={`ritual-trash-btn${selected?.homebrewId ? '' : ' dim'}`}
            onMouseEnter={() => setTrashHover(true)}
            onMouseLeave={() => setTrashHover(false)}
            onClick={trashSelected}
            aria-label="Excluir ritual homebrew selecionado"
          >
            <img src={trashHover ? lixeiraAberta : lixeira} alt="" />
          </button>
        </nav>

        <div className="conditions-modal ritual-picker-list-panel conditions-modal-list-panel">
          <div className="ritual-picker-veins" />
          <div className="conditions-modal-search combat-search-field ritual-picker-search">
            <input className="combat-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar Rituais" />
            <svg className="combat-search-icon" viewBox="0 0 24 24" aria-hidden>
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <div className="ability-picker-sources">
            {SOURCE_OPTIONS.map((s) => (
              <button key={s.key} type="button" className="ability-picker-source" onClick={() => setSourceFilter(s.key)}>
                <img src={sourceFilter === s.key ? radioChecked : radioEmpty} alt="" />
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="conditions-modal-list">
            {filteredItems.length === 0 && <p className="conditions-modal-placeholder">Nenhum ritual com esses filtros.</p>}
            {filteredItems.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`conditions-modal-list-item${selectedId === r.id ? ' active' : ''}`}
                onClick={() => { setSelectedId(r.id); setCreating(false) }}
              >
                {r.name}
              </button>
            ))}
          </div>

          <button type="button" className="ability-picker-custom-btn" onClick={() => { setCreating(true); setSelectedId(null) }}>Criar novo Ritual</button>
        </div>

        <div className="conditions-modal ritual-picker-detail-panel conditions-modal-detail-panel">
          <div className="ritual-picker-veins" />
          <div className="conditions-modal-content">
            {creating ? (
              <>
                <h4 className="conditions-modal-custom-section-title">Informações Gerais</h4>
                <label className="conditions-modal-custom-label">Nome</label>
                <input className="conditions-modal-custom-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ritual" />
                <div className="ritual-form-row">
                  <div>
                    <label className="conditions-modal-custom-label">Elemento</label>
                    <input className="conditions-modal-custom-name" value={draft.elemento} onChange={(e) => setDraft((d) => ({ ...d, elemento: e.target.value }))} placeholder="Nenhum" />
                  </div>
                  <div>
                    <label className="conditions-modal-custom-label">Círculo</label>
                    <Picker
                      value={String(draft.circle)}
                      onChange={(v) => setDraft((d) => ({ ...d, circle: Number(v) }))}
                      options={CIRCLES.map((c) => ({ value: String(c), label: ROMAN[c] }))}
                    />
                  </div>
                </div>

                <h4 className="conditions-modal-custom-section-title">Conjuração</h4>
                <div className="ritual-form-row-3">
                  <div><label className="conditions-modal-custom-label">Execução</label><input className="conditions-modal-custom-name" value={draft.execution} onChange={(e) => setDraft((d) => ({ ...d, execution: e.target.value }))} placeholder="Ação Livre" /></div>
                  <div><label className="conditions-modal-custom-label">Duração</label><input className="conditions-modal-custom-name" value={draft.duration} onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))} placeholder="Instantânea" /></div>
                  <div><label className="conditions-modal-custom-label">Alvo</label><input className="conditions-modal-custom-name" value={draft.target} onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))} placeholder="Objeto" /></div>
                </div>
                <div className="ritual-form-row-3">
                  <div><label className="conditions-modal-custom-label">Alcance</label><input className="conditions-modal-custom-name" value={draft.range} onChange={(e) => setDraft((d) => ({ ...d, range: e.target.value }))} placeholder="Ilimitado" /></div>
                  <div><label className="conditions-modal-custom-label">Área</label><input className="conditions-modal-custom-name" value={draft.area} onChange={(e) => setDraft((d) => ({ ...d, area: e.target.value }))} placeholder="Esfera" /></div>
                  <div><label className="conditions-modal-custom-label">Resistência</label><input className="conditions-modal-custom-name" value={draft.resistance} onChange={(e) => setDraft((d) => ({ ...d, resistance: e.target.value }))} placeholder="Vontade" /></div>
                </div>
                <div className="ritual-form-row-3">
                  <div><label className="conditions-modal-custom-label">Efeito</label><input className="conditions-modal-custom-name" value={draft.effect} onChange={(e) => setDraft((d) => ({ ...d, effect: e.target.value }))} placeholder="Ilimitado" /></div>
                </div>

                <h4 className="conditions-modal-custom-section-title">Rolagens</h4>
                <div className="ritual-form-row-3">
                  <div><label className="conditions-modal-custom-label">Dados</label><input className="conditions-modal-custom-name" value={draft.dice} onChange={(e) => setDraft((d) => ({ ...d, dice: e.target.value }))} placeholder="1d20" /></div>
                  <div><label className="conditions-modal-custom-label">Dados Discente</label><input className="conditions-modal-custom-name" value={draft.diceDiscente} onChange={(e) => setDraft((d) => ({ ...d, diceDiscente: e.target.value }))} placeholder="1d20" /></div>
                  <div><label className="conditions-modal-custom-label">Dados Verdadeiro</label><input className="conditions-modal-custom-name" value={draft.diceVerdadeiro} onChange={(e) => setDraft((d) => ({ ...d, diceVerdadeiro: e.target.value }))} placeholder="1d20" /></div>
                </div>

                <h4 className="conditions-modal-custom-section-title">Imagem</h4>
                <div className="ritual-form-image">
                  <img src={draft.image_url ?? defaultRitualImg} alt="" />
                  <label className="ritual-form-image-btn">
                    {uploading ? '...' : 'Alterar'}
                    <input type="file" accept="image/*" onChange={handleImage} hidden />
                  </label>
                </div>

                <h4 className="conditions-modal-custom-section-title">Descrição</h4>
                <TextareaFormatada className="conditions-modal-custom-description" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Escreva aqui a descrição" />

                <div className="conditions-modal-custom-submit-row">
                  <button type="button" className="ritual-add-btn ritual-add-btn-inline" onClick={submitCustom}>Adicionar Ritual</button>
                </div>
              </>
            ) : selected ? (
              <>
                <div className="ritual-detail-head">
                  <img className="ritual-detail-img" src={selected.image_url ?? defaultRitualImg} alt="" />
                  <div>
                    <h3>{selected.name}</h3>
                    <p className="ritual-detail-sub">{ROMAN[selected.circle]}º Círculo{selected.elemento ? ` · ${selected.elemento}` : ''}</p>
                  </div>
                </div>
                <div className="ritual-detail-meta">
                  {selected.execution && <span><strong>Execução:</strong> {selected.execution}</span>}
                  {selected.range && <span><strong>Alcance:</strong> {selected.range}</span>}
                  {selected.target && <span><strong>Alvo:</strong> {selected.target}</span>}
                  {selected.duration && <span><strong>Duração:</strong> {selected.duration}</span>}
                  {selected.resistance && <span><strong>Resistência:</strong> {selected.resistance}</span>}
                </div>
                <p className="conditions-modal-detail-text">{selected.effect}</p>
                {selected.discente_effect && <p className="conditions-modal-detail-text"><strong>Discente ({selected.discente_cost} PE):</strong> {selected.discente_effect}</p>}
                {selected.verdadeiro_effect && <p className="conditions-modal-detail-text"><strong>Verdadeiro ({selected.verdadeiro_cost} PE):</strong> {selected.verdadeiro_effect}</p>}
                {!selected.homebrewId && (
                  <button type="button" className="ritual-add-btn" onClick={submitCatalog}>Adicionar Ritual</button>
                )}
              </>
            ) : (
              <p className="conditions-modal-placeholder">Selecione um Ritual ao lado para ver detalhes.</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
