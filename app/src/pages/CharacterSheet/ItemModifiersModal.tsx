import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AppliedModifier } from './itemMods'
import EditorDeEfeitos from './EditorDeEfeitos'
import { resumoDosEfeitos, type EfeitoEscolhido } from './efeitosEscolhidos'
import { TextareaFormatada } from '../../components/TextoRico'
import { supabase } from '../../lib/supabase'

export type { AppliedModifier } from './itemMods'

type CatalogEntry = { id: string; name: string; effect: string; elemento?: string | null }

type ItemType = 'arma' | 'municao' | 'protecao' | 'geral' | 'paranormal'

// Cada tipo de item so aceita as modificacoes feitas pra ele: o catalogo guarda isso na
// coluna applies_to, com nomes diferentes nas duas tabelas.
const WEAPON_MOD_SCOPE: Record<string, string[]> = {
  arma: ['corpo_a_corpo_disparo', 'armas_fogo'],
  municao: ['municao_balas'],
  protecao: ['protecoes'],
  geral: ['acessorios'],
}

const CURSE_SCOPE: Record<string, string> = {
  arma: 'arma',
  protecao: 'protecao',
  geral: 'acessorio',
}

// O catalogo tem entradas repetidas (a mesma modificacao semeada duas vezes com applies_to
// diferente), entao junto pelo conteudo antes de mostrar.
function dedupe(entries: CatalogEntry[]) {
  const vistos = new Set<string>()
  return entries.filter((e) => {
    const chave = `${e.name}|${e.effect}|${e.elemento ?? ''}`
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

export default function ItemModifiersModal({
  itemType,
  applied,
  onClose,
  onApply,
}: {
  itemType: ItemType
  applied: AppliedModifier[]
  onClose: () => void
  onApply: (next: AppliedModifier[]) => void
}) {
  const [tab, setTab] = useState<'modificacao' | 'maldicao'>('modificacao')
  const [search, setSearch] = useState('')
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [creatingCustom, setCreatingCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customElement, setCustomElement] = useState('')
  const [customEffect, setCustomEffect] = useState('')
  const [customEfeitos, setCustomEfeitos] = useState<EfeitoEscolhido[]>([])

  const singular = tab === 'modificacao' ? 'Modificação' : 'Maldição'
  const plural = tab === 'modificacao' ? 'Modificações' : 'Maldições'

  useEffect(() => {
    setCreatingCustom(false)
    if (tab === 'modificacao') {
      const scopes = WEAPON_MOD_SCOPE[itemType] ?? []
      if (scopes.length === 0) { setCatalog([]); return }
      supabase.from('weapon_mods').select('id, name, effect').in('applies_to', scopes).order('name')
        .then(({ data }) => setCatalog(dedupe(data ?? [])))
      return
    }
    const scope = CURSE_SCOPE[itemType]
    if (!scope) { setCatalog([]); return }
    supabase.from('cursed_afflictions').select('id, name, effect, elemento').eq('applies_to', scope).order('name')
      .then(({ data }) => setCatalog(dedupe(data ?? [])))
  }, [tab, itemType])

  const filtrados = catalog.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  function adicionarDoCatalogo(entry: CatalogEntry) {
    onApply([...applied, { kind: tab, name: entry.name, effect: entry.effect, elemento: entry.elemento ?? null }])
  }

  function adicionarCustom() {
    // Os efeitos escolhidos valem sozinhos; o texto é a descrição (vazio: vira o resumo deles).
    const efeitos = customEfeitos.filter((e) => e.valor)
    const effect = customEffect.trim() || resumoDosEfeitos(efeitos)
    if (!customName.trim() || !effect) return
    onApply([...applied, { kind: tab, name: customName.trim(), effect, elemento: customElement.trim() || null, ...(efeitos.length ? { efeitos } : {}) }])
    setCustomName(''); setCustomElement(''); setCustomEffect(''); setCustomEfeitos([]); setCreatingCustom(false)
  }

  function remover(index: number) {
    onApply(applied.filter((_, i) => i !== index))
  }

  return createPortal(
    <div className="conditions-modal-backdrop mods-modal-backdrop" onClick={onClose}>
      <div className="mods-modal-shell" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ritual-close-outside" onClick={onClose} aria-label="Fechar">
          <span className="ritual-close-word">FECHAR</span>
          <span className="ritual-close-x">X</span>
        </button>

        <div className="conditions-modal mods-modal-panel">
          <div className="conditions-modal-texture" />

          <div className="conditions-modal-search combat-search-field mods-modal-search">
            <input
              className="combat-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${plural}`}
            />
            <svg className="combat-search-icon" viewBox="0 0 24 24" aria-hidden>
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <div className="mods-modal-tabs">
            <button type="button" className={tab === 'modificacao' ? 'active' : ''} onClick={() => setTab('modificacao')}>Modificações</button>
            <button type="button" className={tab === 'maldicao' ? 'active' : ''} onClick={() => setTab('maldicao')}>Maldições</button>
          </div>

          <div className="mods-modal-body">
            {applied.length > 0 && !creatingCustom && (
              <div className="mods-modal-applied">
                <h4 className="conditions-modal-custom-section-title">Já aplicadas</h4>
                {applied.map((m, i) => (
                  <div key={`${m.name}-${i}`} className="mods-modal-applied-row">
                    <span className="mods-modal-entry-name">
                      {m.name}
                      {m.elemento ? <span className="mods-modal-entry-element"> ({m.elemento})</span> : null}
                    </span>
                    <button type="button" className="mods-modal-remove" onClick={() => remover(i)} aria-label={`Remover ${m.name}`}>×</button>
                  </div>
                ))}
              </div>
            )}

            {creatingCustom ? (
              <>
                <h4 className="conditions-modal-custom-section-title">Nova {singular}</h4>
                <label className="conditions-modal-custom-label">Nome</label>
                <input className="conditions-modal-custom-name" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={singular} />
                <label className="conditions-modal-custom-label">Elemento</label>
                <input className="conditions-modal-custom-name" value={customElement} onChange={(e) => setCustomElement(e.target.value)} placeholder="Nenhum" />
                <label className="conditions-modal-custom-label">Efeito</label>
                <TextareaFormatada className="conditions-modal-custom-description" value={customEffect} onChange={(e) => setCustomEffect(e.target.value)} placeholder="O que essa alteração faz" />
                <label className="conditions-modal-custom-label">O que ela mexe na ficha</label>
                <EditorDeEfeitos contexto="item" efeitos={customEfeitos} onChange={setCustomEfeitos} />
              </>
            ) : filtrados.length === 0 ? (
              <p className="conditions-modal-placeholder">
                Nenhuma {singular.toLowerCase()} do catálogo serve pra esse tipo de item. Dá pra criar uma no botão abaixo.
              </p>
            ) : (
              <div className="mods-modal-list">
                {filtrados.map((c) => (
                  <button key={c.id} type="button" className="mods-modal-entry" onClick={() => adicionarDoCatalogo(c)}>
                    <span className="mods-modal-entry-name">
                      {c.name}
                      {c.elemento ? <span className="mods-modal-entry-element"> ({c.elemento})</span> : null}
                    </span>
                    <span className="mods-modal-entry-effect">{c.effect}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mods-modal-footer">
            {creatingCustom ? (
              <>
                <button type="button" className="mods-modal-btn" onClick={() => setCreatingCustom(false)}>Voltar</button>
                <button type="button" className="mods-modal-btn mods-modal-btn-primary" onClick={adicionarCustom}>Adicionar {singular}</button>
              </>
            ) : (
              <>
                <button type="button" className="mods-modal-btn" onClick={onClose}>Voltar</button>
                <button type="button" className="mods-modal-btn mods-modal-btn-primary" onClick={() => setCreatingCustom(true)}>Criar nova {singular}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
