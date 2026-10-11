import { useState } from 'react'
import { TextareaFormatada } from '../../components/TextoRico'
import { createPortal } from 'react-dom'

export type AbilityEditDraft = { name: string; hasElement: boolean; element: string; description: string }

export default function AbilityEditModal({
  initial,
  onClose,
  onSave,
}: {
  initial: AbilityEditDraft
  onClose: () => void
  onSave: (draft: AbilityEditDraft) => void
}) {
  const [name, setName] = useState(initial.name)
  const [hasElement, setHasElement] = useState(initial.hasElement)
  const [element, setElement] = useState(initial.element)
  const [description, setDescription] = useState(initial.description)

  function submit() {
    if (!name.trim() || !description.trim()) return
    onSave({ name: name.trim(), hasElement, element: hasElement ? element.trim() : '', description: description.trim() })
  }

  return createPortal(
    <div className="attack-modal-backdrop" onClick={onClose}>
      <div className="attack-modal-wrap ability-edit-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="attack-modal-toolbar ability-edit-toolbar">
          <button type="button" className="attack-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="attack-modmodal ability-edit-modal">
          <div className="attack-section-title"><span>INFORMAÇÕES GERAIS</span></div>
          <div className="attack-field">
            <span className="attack-field-label ability-edit-label">Nome</span>
            <input className="attack-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Habilidade" />
          </div>

          <div className="attack-section-title"><span>PARANORMAL</span></div>
          <div className="attack-field-row">
            <div className="attack-field">
              <span className="attack-field-label ability-edit-label">Possui elemento?</span>
              <select className="ability-picker-select" value={hasElement ? 'sim' : 'nao'} onChange={(e) => setHasElement(e.target.value === 'sim')}>
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </div>
            <div className="attack-field">
              <span className="attack-field-label ability-edit-label">Elemento</span>
              <input className="attack-input" value={element} onChange={(e) => setElement(e.target.value)} placeholder="Nenhum" disabled={!hasElement} />
            </div>
          </div>

          <div className="attack-section-title"><span>DESCRIÇÃO</span></div>
          <TextareaFormatada className="attack-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Escreva aqui a descrição" />

          <button type="button" className="attack-submit-btn" onClick={submit}>Editar Habilidade</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
