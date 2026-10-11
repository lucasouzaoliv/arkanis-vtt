import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import radioChecked from '../../assets/combate/radio-checked.svg'
import radioEmpty from '../../assets/combate/radio-empty.svg'
import { TextareaFormatada } from '../../components/TextoRico'
import { detalhes, resumo } from './InventoryItemCard'

// As categorias da lateral sao os tipos de item do banco. "Itens Amaldicoados" e o tipo
// paranormal, e "Geral" e o mesmo que os "Equipamentos" do filtro da aba.
type EquipmentType = 'arma' | 'municao' | 'protecao' | 'paranormal' | 'geral'

const CATEGORIES: { key: EquipmentType; label: string }[] = [
  { key: 'arma', label: 'Armas' },
  { key: 'municao', label: 'Munições' },
  { key: 'protecao', label: 'Proteções' },
  { key: 'paranormal', label: 'Itens Amaldiçoados' },
  { key: 'geral', label: 'Geral' },
]

type SourceFilter = 'todos' | 'base' | 'sobrevivendo' | 'arquivos' | 'homebrew'

const SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'base', label: 'Livro Base' },
  { key: 'sobrevivendo', label: 'Sobrevivendo ao Horror' },
  { key: 'arquivos', label: 'Arquivos Secretos' },
  { key: 'homebrew', label: 'Homebrew' },
]

const ITEM_CATEGORIES = ['0', 'I', 'II', 'III', 'IV']

// Tipo do item criado na mão (bug 08/10: pegava a aba aberta, e quase sempre virava arma).
// É o tipo que decide quais modificações e maldições aparecem pra ele.
const TIPOS_DO_ITEM: { key: EquipmentType; label: string }[] = [
  { key: 'arma', label: 'Arma' },
  { key: 'municao', label: 'Munição' },
  { key: 'protecao', label: 'Proteção / Escudo' },
  { key: 'geral', label: 'Geral / Acessório' },
  { key: 'paranormal', label: 'Item Amaldiçoado' },
]

export type EquipmentPickResult =
  | { kind: 'catalog'; id: string }
  | { kind: 'custom'; name: string; type: EquipmentType; category: string; spaces: number; description: string; stats?: Record<string, unknown>; image_url?: string | null }

type Item = {
  id: string
  name: string
  description: string | null
  category: string | null
  spaces: number | null
  type: EquipmentType
  stats: Record<string, unknown>
  sourceSlug?: string | null
  image_url?: string | null
  /** Item amaldiçoado especial (tabela própria): entra na ficha como cópia. */
  especial?: boolean
}

// Dropdown proprio: o <select> nativo abre a lista branca do sistema, que nao estiliza.
function Picker({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="attack-select ritual-select">
      <button type="button" className="attack-select-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{value}</span>
        <span className="attack-select-arrow">{open ? '▲' : '▾'}</span>
      </button>
      {open && (
        <div className="attack-select-list">
          {options.map((o) => (
            <button key={o} type="button" className={o === value ? 'selected' : ''} onClick={() => { onChange(o); setOpen(false) }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EquipmentPickerModal({
  characterId,
  onClose,
  onAdd,
}: {
  characterId: string
  onClose: () => void
  onAdd: (result: EquipmentPickResult) => void
}) {
  const [category, setCategory] = useState<EquipmentType>('arma')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('todos')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creatingCustom, setCreatingCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCategory, setCustomCategory] = useState('I')
  const [customType, setCustomType] = useState<EquipmentType>('geral')
  const [customSpaces, setCustomSpaces] = useState('1')
  const [customDescription, setCustomDescription] = useState('')

  useEffect(() => {
    setSelectedId(null)
    setCreatingCustom(false)

    // Homebrew nao vive no catalogo global: sao os itens que a propria pessoa criou e que
    // ficam no jsonb custom_item da ficha dela.
    if (sourceFilter === 'homebrew') {
      supabase
        .from('character_inventory')
        .select('id, custom_item')
        .eq('character_id', characterId)
        .not('custom_item', 'is', null)
        .then(({ data }) => setItems(
          (data ?? [])
            .filter((r: any) => (r.custom_item?.type ?? 'geral') === category)
            .map((r: any) => ({
              id: r.id,
              name: r.custom_item.name,
              description: r.custom_item.description ?? null,
              category: r.custom_item.category ?? null,
              spaces: r.custom_item.spaces ?? null,
              type: (r.custom_item.type ?? 'geral') as EquipmentType,
              stats: r.custom_item.stats ?? {},
            })),
        ))
      return
    }

    const catalogo = supabase
      .from('equipment_items')
      .select('id, name, description, category, spaces, type, stats, image_url, sources(slug)')
      .eq('type', category)
      .order('name')
      .then(({ data }) => (data ?? []).map((r: any): Item => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        spaces: r.spaces,
        type: r.type,
        stats: r.stats ?? {},
        sourceSlug: r.sources?.slug ?? null,
        image_url: r.image_url ?? null,
      })))

    // Os itens amaldiçoados especiais dos livros (Anel Invertido, Larva da Fúria...) ficam
    // numa tabela própria e não apareciam em lugar nenhum: entram junto em Itens Amaldiçoados.
    const especiais = category !== 'paranormal'
      ? Promise.resolve([] as Item[])
      : supabase
        .from('cursed_items_special')
        .select('id, name, description, category, spaces, image_url, sources(slug)')
        .order('name')
        .then(({ data }) => (data ?? []).map((r: any): Item => ({
          id: r.id,
          name: r.name,
          description: r.description,
          category: r.category,
          spaces: r.spaces,
          type: 'paranormal',
          stats: {},
          sourceSlug: r.sources?.slug ?? null,
          image_url: r.image_url ?? null,
          especial: true,
        })))

    let ativo = true
    Promise.all([catalogo, especiais]).then(([a, b]) => {
      if (ativo) setItems([...a, ...b].sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')))
    })
    return () => { ativo = false }
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

  function submitCustom() {
    if (!customName.trim()) return
    onAdd({
      kind: 'custom',
      name: customName.trim(),
      type: customType,
      category: customCategory,
      spaces: Number(customSpaces) || 0,
      description: customDescription.trim(),
    })
  }

  function submitCatalogItem() {
    if (!selectedItem) return
    // Item homebrew ja existe como copia na ficha: adicionar de novo cria outra copia.
    if (sourceFilter === 'homebrew') {
      onAdd({
        kind: 'custom',
        name: selectedItem.name,
        type: category,
        category: selectedItem.category ?? 'I',
        spaces: selectedItem.spaces ?? 0,
        description: selectedItem.description ?? '',
        stats: selectedItem.stats,
      })
      return
    }
    if (selectedItem.especial) {
      // Não existe em equipment_items: vira uma cópia na ficha, como os itens homebrew.
      onAdd({
        kind: 'custom',
        name: selectedItem.name,
        type: 'paranormal',
        category: selectedItem.category ?? 'I',
        spaces: selectedItem.spaces ?? 0,
        description: selectedItem.description ?? '',
        stats: {},
        image_url: selectedItem.image_url ?? null,
      })
      return
    }
    onAdd({ kind: 'catalog', id: selectedItem.id })
  }

  return createPortal(
    <div className="conditions-modal-backdrop ability-picker-backdrop" onClick={onClose}>
      <div className="conditions-modal-shell ability-picker-shell equipment-picker-shell" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ritual-close-outside" onClick={onClose} aria-label="Fechar">
          <span className="ritual-close-word">FECHAR</span>
          <span className="ritual-close-x">X</span>
        </button>

        <nav className="conditions-modal-sidebar">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`conditions-modal-nav-btn${category === c.key ? ' active' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              <span>{c.label}</span>
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
              placeholder="Buscar Equipamentos"
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
            {filteredItems.length === 0 && <p className="conditions-modal-placeholder">Nenhum equipamento aqui ainda.</p>}
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

          <button type="button" className="ability-picker-custom-btn" onClick={() => { setCreatingCustom(true); setSelectedId(null); setCustomType(category) }}>Criar novo Equipamento</button>
        </div>

        <div className="conditions-modal conditions-modal-detail-panel ability-picker-detail-panel">
          <div className="conditions-modal-texture" />
          <div className="conditions-modal-content">
            {creatingCustom ? (
              <>
                <h4 className="conditions-modal-custom-section-title">Informações Gerais</h4>
                <label className="conditions-modal-custom-label">Nome</label>
                <input className="conditions-modal-custom-name" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Equipamento" />

                <div className="ritual-form-row">
                  <div>
                    <label className="conditions-modal-custom-label">Categoria</label>
                    <Picker value={customCategory} options={ITEM_CATEGORIES} onChange={setCustomCategory} />
                  </div>
                  <div>
                    <label className="conditions-modal-custom-label">Tipo do Item</label>
                    <Picker
                      value={TIPOS_DO_ITEM.find((t) => t.key === customType)?.label ?? ''}
                      options={TIPOS_DO_ITEM.map((t) => t.label)}
                      onChange={(rotulo) => setCustomType(TIPOS_DO_ITEM.find((t) => t.label === rotulo)?.key ?? 'geral')}
                    />
                  </div>
                  <div>
                    <label className="conditions-modal-custom-label">Espaços</label>
                    <input className="conditions-modal-custom-name" type="number" value={customSpaces} onChange={(e) => setCustomSpaces(e.target.value)} placeholder="1" />
                  </div>
                </div>

                <h4 className="conditions-modal-custom-section-title">Descrição</h4>
                <TextareaFormatada className="conditions-modal-custom-description" value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="Escreva aqui a descrição" />

                <div className="conditions-modal-custom-submit-row">
                  <button type="button" className="conditions-modal-add-btn" onClick={submitCustom}>Adicionar Equipamento</button>
                </div>
              </>
            ) : selectedItem ? (
              <>
                <h3>{selectedItem.name}</h3>
                {selectedItem.image_url && <img className="equip-picker-arte" src={selectedItem.image_url} alt="" />}

                <div className="inv-item-stats">
                  {resumo(selectedItem).map((e) => (
                    <span key={e.label} className="inv-item-stat">
                      <span className="inv-item-stat-label">{e.label}</span>
                      <span className="inv-item-stat-value">{e.value}</span>
                    </span>
                  ))}
                </div>

                {detalhes(selectedItem).length > 0 && (
                  <>
                    <div className="inv-item-divider" />
                    <dl className="inv-item-details">
                      {detalhes(selectedItem).map((d) => (
                        <div key={d.label}>
                          <dt>{d.label}</dt>
                          <dd>{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}

                {selectedItem.description && (
                  <>
                    <div className="inv-item-divider" />
                    <p className="conditions-modal-detail-text">{selectedItem.description}</p>
                  </>
                )}

                <button type="button" className="conditions-modal-add-btn" onClick={submitCatalogItem}>Adicionar Equipamento</button>
              </>
            ) : (
              <p className="conditions-modal-placeholder">Selecione um Equipamento ao lado para ver detalhes.</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
