import { recortarImagem } from '../../components/RecortarImagem'
import { nomeSeguro } from '../../lib/nomeDeArquivo'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import defaultRitualImg from '../../assets/rituais/op-default-ritual-img.svg'
import { TextareaFormatada } from '../../components/TextoRico'
import type { RitualView } from './RitualCard'

const CIRCLES = [1, 2, 3, 4]
const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }

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
            <button key={o.value} type="button" className={o.value === value ? 'selected' : ''} onClick={() => { onChange(o.value); setOpen(false) }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RitualEditModal({
  characterId,
  entryId,
  initial,
  onClose,
  onSaved,
}: {
  characterId: string
  entryId: string
  initial: RitualView
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [elemento, setElemento] = useState(initial.elemento ?? '')
  const [circle, setCircle] = useState(initial.circle)
  const [execution, setExecution] = useState(initial.execution ?? '')
  const [duration, setDuration] = useState(initial.duration ?? '')
  const [target, setTarget] = useState(initial.target ?? '')
  const [range, setRange] = useState(initial.range ?? '')
  const [area, setArea] = useState(initial.area ?? '')
  const [resistance, setResistance] = useState(initial.resistance ?? '')
  const [effect, setEffect] = useState(initial.effect ?? '')
  const [dice, setDice] = useState(initial.dice ?? '')
  const [diceDiscente, setDiceDiscente] = useState(initial.diceDiscente ?? '')
  const [diceVerdadeiro, setDiceVerdadeiro] = useState(initial.diceVerdadeiro ?? '')
  const [imageUrl, setImageUrl] = useState(initial.image_url)
  const [description, setDescription] = useState(initial.description ?? '')
  const [discenteCost, setDiscenteCost] = useState(initial.discenteCost != null ? String(initial.discenteCost) : '')
  const [discenteEffect, setDiscenteEffect] = useState(initial.discenteEffect ?? '')
  const [verdadeiroCost, setVerdadeiroCost] = useState(initial.verdadeiroCost != null ? String(initial.verdadeiroCost) : '')
  const [verdadeiroEffect, setVerdadeiroEffect] = useState(initial.verdadeiroEffect ?? '')
  const [uploading, setUploading] = useState(false)

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
    setImageUrl(supabase.storage.from('ritual_images').getPublicUrl(path).data.publicUrl)
  }

  // Editar um ritual do catalogo nao altera o catalogo global: a entrada da ficha vira uma
  // copia custom (ritual_id = null), entao a edicao fica so nesse personagem.
  async function save() {
    if (!name.trim()) return
    await supabase
      .from('character_rituals')
      .update({
        ritual_id: null,
        custom_ritual: {
          name: name.trim(),
          elemento: elemento || null,
          circle,
          execution: execution || null,
          duration: duration || null,
          target: target || null,
          range: range || null,
          area: area || null,
          resistance: resistance || null,
          effect,
          dice: dice || null,
          dice_discente: diceDiscente || null,
          dice_verdadeiro: diceVerdadeiro || null,
          discente_cost: discenteCost ? Number(discenteCost) : null,
          discente_effect: discenteEffect || null,
          verdadeiro_cost: verdadeiroCost ? Number(verdadeiroCost) : null,
          verdadeiro_effect: verdadeiroEffect || null,
          image_url: imageUrl,
          description: description || null,
        },
      })
      .eq('id', entryId)
    onSaved()
    onClose()
  }

  return createPortal(
    <div className="conditions-modal-backdrop ritual-picker-backdrop" onClick={onClose}>
      <div className="conditions-modal-shell ritual-picker-shell" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ritual-close-outside" onClick={onClose} aria-label="Fechar">
          <span className="ritual-close-word">FECHAR</span>
          <span className="ritual-close-x">X</span>
        </button>

        <div className="conditions-modal ritual-picker-detail-panel conditions-modal-detail-panel">
          <div className="ritual-picker-veins" />
          <div className="conditions-modal-content">
            <h4 className="conditions-modal-custom-section-title">Informações Gerais</h4>
            <label className="conditions-modal-custom-label">Nome</label>
            <input className="conditions-modal-custom-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ritual" />
            <div className="ritual-form-row">
              <div>
                <label className="conditions-modal-custom-label">Elemento</label>
                <input className="conditions-modal-custom-name" value={elemento} onChange={(e) => setElemento(e.target.value)} placeholder="Nenhum" />
              </div>
              <div>
                <label className="conditions-modal-custom-label">Círculo</label>
                <Picker value={String(circle)} onChange={(v) => setCircle(Number(v))} options={CIRCLES.map((c) => ({ value: String(c), label: ROMAN[c] }))} />
              </div>
            </div>

            <h4 className="conditions-modal-custom-section-title">Conjuração</h4>
            <div className="ritual-form-row-3">
              <div><label className="conditions-modal-custom-label">Execução</label><input className="conditions-modal-custom-name" value={execution} onChange={(e) => setExecution(e.target.value)} placeholder="Ação Livre" /></div>
              <div><label className="conditions-modal-custom-label">Duração</label><input className="conditions-modal-custom-name" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Instantânea" /></div>
              <div><label className="conditions-modal-custom-label">Alvo</label><input className="conditions-modal-custom-name" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Objeto" /></div>
            </div>
            <div className="ritual-form-row-3">
              <div><label className="conditions-modal-custom-label">Alcance</label><input className="conditions-modal-custom-name" value={range} onChange={(e) => setRange(e.target.value)} placeholder="Ilimitado" /></div>
              <div><label className="conditions-modal-custom-label">Área</label><input className="conditions-modal-custom-name" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Esfera" /></div>
              <div><label className="conditions-modal-custom-label">Resistência</label><input className="conditions-modal-custom-name" value={resistance} onChange={(e) => setResistance(e.target.value)} placeholder="Vontade" /></div>
            </div>
            <div className="ritual-form-row-3">
              <div><label className="conditions-modal-custom-label">Efeito</label><input className="conditions-modal-custom-name" value={effect} onChange={(e) => setEffect(e.target.value)} placeholder="Ilimitado" /></div>
            </div>

            <h4 className="conditions-modal-custom-section-title">Rolagens</h4>
            <div className="ritual-form-row-3">
              <div><label className="conditions-modal-custom-label">Dados</label><input className="conditions-modal-custom-name" value={dice} onChange={(e) => setDice(e.target.value)} placeholder="1d20" /></div>
              <div><label className="conditions-modal-custom-label">Dados Discente</label><input className="conditions-modal-custom-name" value={diceDiscente} onChange={(e) => setDiceDiscente(e.target.value)} placeholder="1d20" /></div>
              <div><label className="conditions-modal-custom-label">Dados Verdadeiro</label><input className="conditions-modal-custom-name" value={diceVerdadeiro} onChange={(e) => setDiceVerdadeiro(e.target.value)} placeholder="1d20" /></div>
            </div>

            <h4 className="conditions-modal-custom-section-title">Discente</h4>
            <div className="ritual-form-row">
              <div style={{ flex: '0 0 90px' }}>
                <label className="conditions-modal-custom-label">Custo (PE)</label>
                <input className="conditions-modal-custom-name" type="number" value={discenteCost} onChange={(e) => setDiscenteCost(e.target.value)} placeholder="—" />
              </div>
            </div>
            <TextareaFormatada className="conditions-modal-custom-description" value={discenteEffect} onChange={(e) => setDiscenteEffect(e.target.value)} placeholder="O que muda usando Discente" />

            <h4 className="conditions-modal-custom-section-title">Verdadeiro</h4>
            <div className="ritual-form-row">
              <div style={{ flex: '0 0 90px' }}>
                <label className="conditions-modal-custom-label">Custo (PE)</label>
                <input className="conditions-modal-custom-name" type="number" value={verdadeiroCost} onChange={(e) => setVerdadeiroCost(e.target.value)} placeholder="—" />
              </div>
            </div>
            <TextareaFormatada className="conditions-modal-custom-description" value={verdadeiroEffect} onChange={(e) => setVerdadeiroEffect(e.target.value)} placeholder="O que muda usando Verdadeiro" />

            <h4 className="conditions-modal-custom-section-title">Imagem</h4>
            <div className="ritual-form-image">
              <img src={imageUrl ?? defaultRitualImg} alt="" />
              <label className="ritual-form-image-btn">
                {uploading ? '...' : 'Alterar'}
                <input type="file" accept="image/*" onChange={handleImage} hidden />
              </label>
            </div>

            <h4 className="conditions-modal-custom-section-title">Descrição</h4>
            <TextareaFormatada className="conditions-modal-custom-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Escreva aqui a descrição" />

            <div className="conditions-modal-custom-submit-row">
              <button type="button" className="ritual-add-btn ritual-add-btn-inline" onClick={save}>Salvar Ritual</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
