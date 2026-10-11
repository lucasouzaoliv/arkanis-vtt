import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import radioChecked from '../../assets/combate/radio-checked.svg'
import { TextareaFormatada } from '../../components/TextoRico'
import radioEmpty from '../../assets/combate/radio-empty.svg'

type Category = 'Combatente' | 'Especialista' | 'Ocultista' | 'Sobrevivente' | 'Mundano' | 'Poderes Paranormais' | 'Poderes Gerais' | 'Origens' | 'Aliados'

const CATEGORIES: Category[] = ['Combatente', 'Especialista', 'Ocultista', 'Sobrevivente', 'Mundano', 'Poderes Paranormais', 'Poderes Gerais', 'Origens', 'Aliados']

const CLASS_SLUGS: Record<string, string> = {
  Combatente: 'combatente',
  Especialista: 'especialista',
  Ocultista: 'ocultista',
  Sobrevivente: 'sobrevivente',
  Mundano: 'mundano',
}

type SourceFilter = 'todos' | 'base' | 'sobrevivendo' | 'arquivos' | 'homebrew'

const SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'base', label: 'Livro Base' },
  { key: 'sobrevivendo', label: 'Sobrevivendo ao Horror' },
  { key: 'arquivos', label: 'Arquivos Secretos' },
  { key: 'homebrew', label: 'Homebrew' },
]

export type AbilityPickResult =
  | { kind: 'class_power' | 'paranormal_power' | 'general_power' | 'origin' | 'ally'; id: string }
  | { kind: 'custom'; name: string; hasElement: boolean; element: string | null; description: string }

type Item = { id: string; name: string; description: string; sourceSlug?: string | null; imageUrl?: string | null }

/** Texto do aliado como aparece na ficha: o bonus e a habilidade, como no livro. */
export function textoDoAliado(a: { descricao?: string | null; bonus: string; habilidade_nome: string; habilidade: string }) {
  return [a.descricao, `Bônus. ${a.bonus}`, `${a.habilidade_nome}. ${a.habilidade}`].filter(Boolean).join('\n\n')
}

export default function AbilityPickerModal({
  characterId,
  onClose,
  onAdd,
}: {
  characterId: string
  onClose: () => void
  onAdd: (result: AbilityPickResult) => void
}) {
  const [category, setCategory] = useState<Category>('Combatente')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('todos')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creatingCustom, setCreatingCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customHasElement, setCustomHasElement] = useState(false)
  const [customElement, setCustomElement] = useState('')
  const [customDescription, setCustomDescription] = useState('')

  useEffect(() => {
    setSelectedId(null)
    setCreatingCustom(false)

    if (sourceFilter === 'homebrew') {
      supabase
        .from('character_abilities')
        .select('id, custom_ability')
        .eq('character_id', characterId)
        .not('custom_ability', 'is', null)
        .then(({ data }) => setItems((data ?? []).map((r: any) => ({ id: r.id, name: r.custom_ability.name, description: r.custom_ability.description }))))
      return
    }

    if (category === 'Poderes Gerais') {
      supabase.from('general_powers').select('id, name, description, sources(slug)').order('name').then(({ data }) =>
        setItems((data ?? []).map((r: any) => ({ id: r.id, name: r.name, description: r.description, sourceSlug: r.sources?.slug ?? null }))))
      return
    }
    if (category === 'Poderes Paranormais') {
      supabase.from('paranormal_powers').select('id, name, description, sources(slug)').order('name').then(({ data }) =>
        setItems((data ?? []).map((r: any) => ({ id: r.id, name: r.name, description: r.description, sourceSlug: r.sources?.slug ?? null }))))
      return
    }
    if (category === 'Aliados') {
      // Pessoas primeiro, depois os tipos de aliado drone (Drone de Combate Tatico).
      supabase.from('allies').select('id, name, tipo, descricao, bonus, habilidade_nome, habilidade, image_url, sources(slug)').order('tipo', { ascending: false }).order('sort_order').then(({ data }) =>
        setItems((data ?? []).map((r: any) => ({ id: r.id, name: r.name, description: textoDoAliado(r), sourceSlug: r.sources?.slug ?? null, imageUrl: r.image_url }))))
      return
    }
    if (category === 'Origens') {
      supabase.from('origins').select('id, power_name, power_description, sources(slug)').order('sort_order').then(({ data }) =>
        setItems((data ?? []).map((r: any) => ({ id: r.id, name: r.power_name, description: r.power_description, sourceSlug: r.sources?.slug ?? null }))))
      return
    }
    const slug = CLASS_SLUGS[category]
    supabase.from('classes').select('id').eq('slug', slug).single().then(({ data: cls }) => {
      if (!cls) return setItems([])
      supabase
        .from('class_powers')
        .select('id, name, description, sources(slug)')
        .eq('class_id', cls.id)
        .eq('is_base_ability', false)
        .order('sort_order')
        .then(({ data }) => setItems((data ?? []).map((r: any) => ({ id: r.id, name: r.name, description: r.description, sourceSlug: r.sources?.slug ?? null }))))
    })
  }, [category, sourceFilter, characterId])

  function matchesSource(item: Item): boolean {
    if (sourceFilter === 'todos' || sourceFilter === 'homebrew') return true
    if (!item.sourceSlug) return true
    if (sourceFilter === 'base') return item.sourceSlug === 'ordem_paranormal'
    if (sourceFilter === 'sobrevivendo') return item.sourceSlug === 'sobrevivendo_ao_horror'
    if (sourceFilter === 'arquivos') return item.sourceSlug.startsWith('arquivos_secretos')
    return true
  }

  const filteredItems = items.filter((i) => matchesSource(i) && i.name.toLowerCase().includes(search.toLowerCase()))
  const selectedItem = items.find((i) => i.id === selectedId) ?? null

  const abilityKindByCategory: Record<Category, 'class_power' | 'paranormal_power' | 'general_power' | 'origin' | 'ally'> = {
    Combatente: 'class_power', Especialista: 'class_power', Ocultista: 'class_power', Sobrevivente: 'class_power', Mundano: 'class_power',
    'Poderes Paranormais': 'paranormal_power', 'Poderes Gerais': 'general_power', Origens: 'origin', Aliados: 'ally',
  }

  function submitCustom() {
    if (!customName.trim() || !customDescription.trim()) return
    onAdd({ kind: 'custom', name: customName.trim(), hasElement: customHasElement, element: customHasElement ? customElement.trim() || null : null, description: customDescription.trim() })
  }

  function submitCatalogItem() {
    if (!selectedItem) return
    if (sourceFilter === 'homebrew') {
      onAdd({ kind: 'custom', name: selectedItem.name, hasElement: false, element: null, description: selectedItem.description })
      return
    }
    onAdd({ kind: abilityKindByCategory[category], id: selectedItem.id })
  }

  return createPortal(
    <div className="conditions-modal-backdrop ability-picker-backdrop" onClick={onClose}>
      <div className="conditions-modal-shell ability-picker-shell" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ritual-close-outside" onClick={onClose} aria-label="Fechar">
          <span className="ritual-close-word">FECHAR</span>
          <span className="ritual-close-x">X</span>
        </button>

        <nav className="conditions-modal-sidebar">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`conditions-modal-nav-btn${category === c ? ' active' : ''}`}
              onClick={() => setCategory(c)}
            >
              <span>{c}</span>
            </button>
          ))}
        </nav>

        <div className="conditions-modal ability-picker-list-panel conditions-modal-list-panel">
          <div className="conditions-modal-texture" />
          <div className="conditions-modal-search combat-search-field">
            <input
              className="combat-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar Habilidades"
            />
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
            {filteredItems.length === 0 && <p className="conditions-modal-placeholder">Em breve.</p>}
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`conditions-modal-list-item${selectedId === item.id ? ' active' : ''}`}
                onClick={() => { setSelectedId(item.id); setCreatingCustom(false) }}
              >
                {item.name}
              </button>
            ))}
          </div>

          <button type="button" className="ability-picker-custom-btn" onClick={() => { setCreatingCustom(true); setSelectedId(null) }}>Criar Nova Habilidade</button>
        </div>

        <div className="conditions-modal conditions-modal-detail-panel ability-picker-detail-panel">
          <div className="conditions-modal-texture" />
          <div className="conditions-modal-content">
            {creatingCustom ? (
              <>
                <h4 className="conditions-modal-custom-section-title">Informações Gerais</h4>
                <label className="conditions-modal-custom-label">Nome</label>
                <input className="conditions-modal-custom-name" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Habilidade" />

                <h4 className="conditions-modal-custom-section-title">Paranormal</h4>
                <div className="ability-picker-element-row">
                  <div>
                    <label className="conditions-modal-custom-label">Possui elemento?</label>
                    <select className="ability-picker-select" value={customHasElement ? 'sim' : 'nao'} onChange={(e) => setCustomHasElement(e.target.value === 'sim')}>
                      <option value="nao">Não</option>
                      <option value="sim">Sim</option>
                    </select>
                  </div>
                  <div>
                    <label className="conditions-modal-custom-label">Elemento</label>
                    <input className="conditions-modal-custom-name" value={customElement} onChange={(e) => setCustomElement(e.target.value)} placeholder="Nenhum" disabled={!customHasElement} />
                  </div>
                </div>

                <h4 className="conditions-modal-custom-section-title">Descrição</h4>
                <TextareaFormatada className="conditions-modal-custom-description" value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="Escreva aqui a descrição" />

                <div className="conditions-modal-custom-submit-row">
                  <button type="button" className="conditions-modal-add-btn" onClick={submitCustom}>Adicionar Habilidade</button>
                </div>
              </>
            ) : selectedItem ? (
              <>
                <h3>{selectedItem.name}</h3>
                {selectedItem.imageUrl && <img className="aliado-token aliado-token-grande" src={selectedItem.imageUrl} alt="" />}
                <p className="conditions-modal-detail-text">{selectedItem.description}</p>
                <button type="button" className="conditions-modal-add-btn" onClick={submitCatalogItem}>Adicionar Habilidade</button>
              </>
            ) : (
              <p className="conditions-modal-placeholder">Selecione uma Habilidade ao lado para ver detalhes.</p>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body,
  )
}
