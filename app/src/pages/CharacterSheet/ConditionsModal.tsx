import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import conditionsIcon from '../../assets/condicoes/conditions.svg'
import enemyEffectsIcon from '../../assets/condicoes/enemy-effects.svg'
import ritualsIcon from '../../assets/condicoes/rituals.svg'
import skillsIcon from '../../assets/condicoes/skills.svg'
import extraIcon from '../../assets/condicoes/extra.svg'
import biteIcon from '../../assets/condicoes/bite.svg'
import fearIcon from '../../assets/condicoes/fear.svg'
import fireIcon from '../../assets/condicoes/fire.svg'
import flowerIcon from '../../assets/condicoes/flower.svg'
import handIcon from '../../assets/condicoes/hand.svg'
import mentalIcon from '../../assets/condicoes/mental.svg'
import paralysisIcon from '../../assets/condicoes/paralysis.svg'
import resetIcon from '../../assets/condicoes/reset.svg'
import tiredIcon from '../../assets/condicoes/tired.svg'
import ritual1Icon from '../../assets/condicoes/ritual-1.svg'
import ritual2Icon from '../../assets/condicoes/ritual-2.svg'
import EditorDeEfeitos from './EditorDeEfeitos'
import type { CondicaoPersonalizada, EfeitoEscolhido } from './efeitosEscolhidos'
import { TextareaFormatada } from '../../components/TextoRico'
import ritual3Icon from '../../assets/condicoes/ritual-3.svg'

type CategoryKey = 'conditions' | 'enemy-effects' | 'rituals' | 'skills' | 'extra'

const CATEGORIES: { key: CategoryKey; label: string; icon: string }[] = [
  { key: 'conditions', label: 'Condições', icon: conditionsIcon },
  { key: 'enemy-effects', label: 'Efeitos Inimigos', icon: enemyEffectsIcon },
  { key: 'rituals', label: 'Rituais', icon: ritualsIcon },
  { key: 'skills', label: 'Habilidades', icon: skillsIcon },
  { key: 'extra', label: 'Extras', icon: extraIcon },
]

const EFFECTS_CATEGORY: Partial<Record<CategoryKey, string>> = {
  conditions: 'condicao',
  'enemy-effects': 'efeito_inimigo',
  skills: 'habilidade',
  extra: 'extra',
}

const CURATED_SKILLS: { table: 'class_powers' | 'paranormal_powers' | 'general_powers' | 'class_track_tiers'; name: string }[] = [
  { table: 'paranormal_powers', name: 'Arma de Sangue' },
  { table: 'paranormal_powers', name: 'Aura de Pavor' },
  { table: 'paranormal_powers', name: 'Encarar a Morte' },
  { table: 'class_track_tiers', name: 'Discurso Motivador' },
  { table: 'class_track_tiers', name: 'Gladiador Paranormal' },
  { table: 'class_powers', name: 'Nos Olhos do Monstro' },
  { table: 'general_powers', name: 'Palavras de Devoção' },
  { table: 'general_powers', name: 'Poder da Amizade' },
  { table: 'paranormal_powers', name: 'Potencial Reaproveitado' },
  { table: 'paranormal_powers', name: 'Sangue Vivo' },
  { table: 'class_powers', name: 'Sentido Tático' },
  { table: 'class_powers', name: 'Sincronia Paranormal' },
]

export const CUSTOM_ICONS = [
  conditionsIcon, enemyEffectsIcon, ritualsIcon, skillsIcon, extraIcon,
  biteIcon, fearIcon, fireIcon, flowerIcon, handIcon, mentalIcon, paralysisIcon, resetIcon, tiredIcon,
  ritual1Icon, ritual2Icon, ritual3Icon,
]

type CatalogItem = {
  id: string
  name: string
  description: string
  discenteCost?: number | null
  discenteEffect?: string | null
  discenteCircle?: number | null
  verdadeiroCost?: number | null
  verdadeiroEffect?: string | null
  verdadeiroCircle?: number | null
  verdadeiroAffinity?: boolean
}

type RitualMode = 'normal' | 'discente' | 'verdadeiro'

const RITUAL_MODES: { key: RitualMode; label: string; icon: string }[] = [
  { key: 'normal', label: 'Normal', icon: ritual1Icon },
  { key: 'discente', label: 'Discente', icon: ritual2Icon },
  { key: 'verdadeiro', label: 'Verdadeiro', icon: ritual3Icon },
]

export default function ConditionsModal({
  onClose,
  onAddCondition,
}: {
  onClose: () => void
  onAddCondition: (name: string, propria?: CondicaoPersonalizada) => void
}) {
  const [active, setActive] = useState<CategoryKey | 'custom'>('conditions')
  const [customName, setCustomName] = useState('')
  const [customIcon, setCustomIcon] = useState(CUSTOM_ICONS[0])
  const [customDescription, setCustomDescription] = useState('')
  const [customEfeitos, setCustomEfeitos] = useState<EfeitoEscolhido[]>([])
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ritualMode, setRitualMode] = useState<RitualMode>('normal')
  const activeCategory = CATEGORIES.find((c) => c.key === active)

  useEffect(() => {
    if (active === 'custom') return
    setLoading(true)
    setSelectedId(null)
    setRitualMode('normal')

    if (active === 'rituals') {
      supabase
        .from('rituals')
        .select('id, name, effect, discente_cost, discente_effect, discente_requires_circle, verdadeiro_cost, verdadeiro_effect, verdadeiro_requires_circle, verdadeiro_requires_affinity')
        .order('name')
        .then(({ data }) => {
          setItems((data ?? []).map((r) => ({
            id: r.id, name: r.name, description: r.effect,
            discenteCost: r.discente_cost, discenteEffect: r.discente_effect, discenteCircle: r.discente_requires_circle,
            verdadeiroCost: r.verdadeiro_cost, verdadeiroEffect: r.verdadeiro_effect, verdadeiroCircle: r.verdadeiro_requires_circle,
            verdadeiroAffinity: r.verdadeiro_requires_affinity,
          })))
          setLoading(false)
        })
      return
    }

    if (active === 'skills') {
      const namesFor = (table: string) => CURATED_SKILLS.filter((s) => s.table === table).map((s) => s.name)
      Promise.all([
        supabase.from('class_powers').select('id, name, description').in('name', namesFor('class_powers')),
        supabase.from('paranormal_powers').select('id, name, description').in('name', namesFor('paranormal_powers')),
        supabase.from('general_powers').select('id, name, description').in('name', namesFor('general_powers')),
        supabase.from('class_track_tiers').select('id, name, description, nex_percent').in('name', namesFor('class_track_tiers')),
        supabase.from('effects_catalog').select('id, name, description').eq('category', 'habilidade'),
      ]).then(([classPowers, paranormalPowers, generalPowers, trackTiers, effectsHabilidade]) => {
        const merged: CatalogItem[] = [
          ...(classPowers.data ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description })),
          ...(paranormalPowers.data ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description })),
          ...(generalPowers.data ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description })),
          ...(trackTiers.data ?? []).map((r) => ({ id: r.id, name: `NEX ${r.nex_percent}% - ${r.name}`, description: r.description })),
          ...(effectsHabilidade.data ?? []),
        ]
        merged.sort((a, b) => a.name.localeCompare(b.name))
        setItems(merged)
        setLoading(false)
      })
      return
    }

    const category = EFFECTS_CATEGORY[active]
    supabase
      .from('effects_catalog')
      .select('id, name, description')
      .eq('category', category)
      .order('name')
      .then(({ data }) => {
        setItems(data ?? [])
        setLoading(false)
      })
  }, [active])

  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  const availableRitualModes = RITUAL_MODES.filter((m) => {
    if (m.key === 'discente') return selectedItem?.discenteCost != null
    if (m.key === 'verdadeiro') return selectedItem?.verdadeiroCost != null
    return true
  })

  function ritualDescription(item: CatalogItem): string {
    const parts = [item.description]
    if (item.discenteCost != null) {
      parts.push(`Discente (+${item.discenteCost} PE): ${item.discenteEffect ?? ''}${item.discenteCircle ? ` Requer ${item.discenteCircle}º círculo.` : ''}`)
    }
    if (item.verdadeiroCost != null) {
      parts.push(`Verdadeiro (+${item.verdadeiroCost} PE): ${item.verdadeiroEffect ?? ''}${item.verdadeiroCircle ? ` Requer ${item.verdadeiroCircle}º círculo.` : ''}${item.verdadeiroAffinity ? ' Requer afinidade.' : ''}`)
    }
    return parts.join('\n\n')
  }

  function ritualLabel(item: CatalogItem, mode: RitualMode): string {
    if (mode === 'normal') return item.name
    return `${item.name} (${mode === 'discente' ? 'Discente' : 'Verdadeiro'})`
  }

  function submitCustom() {
    if (!customName.trim()) return
    // A definição vai junto: a ficha guarda e aplica os efeitos escolhidos (08/10).
    onAddCondition(customName.trim(), {
      nome: customName.trim(),
      descricao: customDescription.trim() || undefined,
      icone: String(Math.max(0, CUSTOM_ICONS.indexOf(customIcon))),
      efeitos: customEfeitos.filter((e) => e.valor),
    })
    setCustomName('')
    setCustomDescription('')
    setCustomEfeitos([])
  }

  return createPortal(
    <div className="conditions-modal-backdrop" onClick={onClose}>
      <svg className="conditions-modal-svg-defs" width="0" height="0">
        <defs>
          <filter id="conditions-liquid-flow">
            <feTurbulence type="fractalNoise" numOctaves={2} seed={7} result="noise">
              <animate attributeName="baseFrequency" values="0.008 0.015;0.014 0.009;0.008 0.015" dur="18s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="28" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div className="conditions-modal-shell" onClick={(e) => e.stopPropagation()}>
        <nav className="conditions-modal-sidebar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`conditions-modal-nav-btn${active === cat.key ? ' active' : ''}`}
              onClick={() => setActive(cat.key)}
            >
              <img src={cat.icon} alt="" />
              <span>{cat.label}</span>
            </button>
          ))}

          <button
            type="button"
            className={`conditions-modal-nav-btn conditions-modal-custom${active === 'custom' ? ' active' : ''}`}
            onClick={() => setActive('custom')}
          >
            <span className="conditions-modal-custom-icon">!</span>
            <span>Personalizado</span>
          </button>
        </nav>

        {active === 'custom' ? (
          <div className="conditions-modal">
            <div className="conditions-modal-texture" />

            <div className="conditions-modal-content">
              <h4 className="conditions-modal-custom-section-title">Informações Gerais</h4>

              <label className="conditions-modal-custom-label">Nome</label>
              <input
                autoFocus
                className="conditions-modal-custom-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nome do Efeito"
              />

              <label className="conditions-modal-custom-label">Ícone</label>
              <div className="conditions-modal-custom-icons">
                {CUSTOM_ICONS.map((icon, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`conditions-modal-custom-icon-btn${customIcon === icon ? ' active' : ''}`}
                    onClick={() => setCustomIcon(icon)}
                  >
                    <img src={icon} alt="" />
                  </button>
                ))}
              </div>

              <label className="conditions-modal-custom-label">Descrição</label>
              <TextareaFormatada
                className="conditions-modal-custom-description"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Escreva aqui a descrição"
              />

              <h4 className="conditions-modal-custom-section-title">Efeitos</h4>
              <EditorDeEfeitos contexto="condicao" efeitos={customEfeitos} onChange={setCustomEfeitos} />

              <div className="conditions-modal-custom-submit-row">
                <button type="button" className="conditions-modal-add-btn" onClick={submitCustom}>Adicionar</button>
              </div>
            </div>

            <button type="button" className="conditions-modal-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>
        ) : (
          <>
            <div className="conditions-modal conditions-modal-list-panel">
              <div className="conditions-modal-texture" />
              <div className="conditions-modal-search">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Buscar em ${activeCategory?.label}`}
                />
              </div>
              <div className="conditions-modal-list">
                {loading && <p className="conditions-modal-placeholder">Carregando...</p>}
                {!loading && filteredItems.length === 0 && (
                  <p className="conditions-modal-placeholder">Em breve.</p>
                )}
                {!loading && filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`conditions-modal-list-item${selectedId === item.id ? ' active' : ''}`}
                    onClick={() => { setSelectedId(item.id); setRitualMode('normal') }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="conditions-modal conditions-modal-detail-panel">
              <div className="conditions-modal-texture" />
              <div className="conditions-modal-content">
                {selectedItem ? (
                  <>
                    <h3>{selectedItem.name}</h3>
                    <p className="conditions-modal-detail-text">
                      {active === 'rituals' ? ritualDescription(selectedItem) : selectedItem.description}
                    </p>

                    {active === 'rituals' && (
                      <div className="conditions-modal-ritual-modes">
                        {availableRitualModes.map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            className={`conditions-modal-ritual-mode-btn${ritualMode === m.key ? ' active' : ''}`}
                            onClick={() => setRitualMode(m.key)}
                          >
                            <span>{m.label}</span>
                            <img src={m.icon} alt="" />
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      className="conditions-modal-add-btn"
                      onClick={() => onAddCondition(active === 'rituals' ? ritualLabel(selectedItem, ritualMode) : selectedItem.name)}
                    >
                      Adicionar à Ficha
                    </button>
                  </>
                ) : (
                  <>
                    <h3>{activeCategory?.label}</h3>
                    <p className="conditions-modal-placeholder">Selecione um item na lista.</p>
                  </>
                )}
              </div>

              <button type="button" className="conditions-modal-close" onClick={onClose} aria-label="Fechar">×</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
