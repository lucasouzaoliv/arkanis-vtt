import { recortarImagem } from '../../components/RecortarImagem'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import mysteryIcon from '../../assets/combate/op-icon-misterio-custom.png'
import { BuscaBiblioteca } from '../Mesa/JanelaBiblioteca'
import { buscaInicialDoItem } from '../Mesa/biblioteca'
import { categoriaComMods, partesDoCritico } from './itemMods'
import { TextareaFormatada } from '../../components/TextoRico'
import EditorDeEfeitos from './EditorDeEfeitos'
import type { EfeitoEscolhido } from './efeitosEscolhidos'
import ItemModifiersModal, { type AppliedModifier } from './ItemModifiersModal'
import CampoTipoDeDano from './CampoTipoDeDano'

type ItemType = 'arma' | 'municao' | 'protecao' | 'geral' | 'paranormal'

// Tipo do item (bug 08/10): dá pra corrigir um item criado com o tipo errado; é ele que decide
// quais modificações e maldições aparecem.
const TIPO_DO_ITEM_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'arma', label: 'Arma' },
  { value: 'municao', label: 'Munição' },
  { value: 'protecao', label: 'Proteção / Escudo' },
  { value: 'geral', label: 'Geral / Acessório' },
  { value: 'paranormal', label: 'Item Amaldiçoado' },
]

const CATEGORIA_OPTIONS = ['0', 'I', 'II', 'III', 'IV'].map((c) => ({ value: c, label: c }))

const TIPO_OPTIONS = [
  { value: 'corpo_a_corpo', label: 'Corpo a Corpo' },
  { value: 'arremesso', label: 'Arremesso' },
  { value: 'disparo', label: 'Disparo' },
  { value: 'fogo', label: 'Fogo' },
]

const EMPUNHADURA_OPTIONS = [
  { value: 'leve', label: 'Leve' },
  { value: 'uma_mao', label: 'Uma Mão' },
  { value: 'duas_maos', label: 'Duas Mãos' },
]

const ALCANCE_OPTIONS = [
  { value: 'curto', label: 'Curto' },
  { value: 'medio', label: 'Médio' },
  { value: 'longo', label: 'Longo' },
  { value: 'extremo', label: 'Extremo' },
]

const SIM_NAO = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
]

// Mesmo seletor do modal de ataque: o <select> nativo abre a lista branca do sistema.
function SelectField({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
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

function TextField({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="attack-field">
      <span className="attack-field-label">{label}</span>
      <input className="attack-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export type ItemToEdit = {
  id: string
  name: string
  type: ItemType
  category: string
  spaces: number | null
  description: string | null
  stats: Record<string, unknown>
  applied_modifiers: AppliedModifier[]
  image_url?: string | null
  /** Quantas unidades a pessoa tem na bolsa. Fica na linha do inventario, nao no item. */
  quantity: number
}

export default function ItemEditModal({
  item,
  onClose,
  onSaved,
}: {
  item: ItemToEdit
  onClose: () => void
  onSaved: () => void
}) {
  const s = item.stats ?? {}

  const [name, setName] = useState(item.name)
  const [categoria, setCategoria] = useState(item.category || 'I')
  const [espacos, setEspacos] = useState(String(item.spaces ?? 1))
  const [unidades, setUnidades] = useState(String(item.quantity ?? 1))
  const [tipo, setTipo] = useState(String(s.natureza ?? 'corpo_a_corpo'))
  const [empunhadura, setEmpunhadura] = useState(String(s.empunhadura ?? 'uma_mao'))
  const [proficiencia, setProficiencia] = useState(String(s.proficiencia ?? ''))
  const [alcance, setAlcance] = useState(String(s.alcance ?? 'curto'))

  const [possuiElemento, setPossuiElemento] = useState(s.elemento ? 'sim' : 'nao')
  const [elemento, setElemento] = useState(String(s.elemento ?? ''))
  const [amaldicoado, setAmaldicoado] = useState(s.amaldicoado ? 'sim' : 'nao')

  const [dano, setDano] = useState(String(s.dano ?? ''))
  const [tipoDano, setTipoDano] = useState(String(s.tipo_dano ?? ''))
  // O banco guarda margem e multiplicador juntos em "critico" ("19/x3"), que e como o
  // resto da ficha le. Aqui eles aparecem em dois campos, entao quebro na abertura e
  // junto de volta ao salvar.
  // Pelo formato, não pela posição: "x3" sozinho é multiplicador (antes virava "x3/x2" ao salvar).
  const [critico, setCritico] = useState(String(partesDoCritico(s.critico).margem ?? ''))
  const [multiplicador, setMultiplicador] = useState(String(partesDoCritico(s.critico).multiplicador ?? ''))
  const [danoAlternativo, setDanoAlternativo] = useState(String(s.dano_alternativo ?? ''))
  // Dano a mais da arma (Punhal: 1d4 Perfuração + 1d6 Conhecimento), pedido 12/10.
  const [danosExtras, setDanosExtras] = useState<{ formula: string; tipo: string }[]>(() => (Array.isArray(s.danos_extras) ? (s.danos_extras as { formula: string; tipo: string }[]) : []))

  const [tipoMunicao, setTipoMunicao] = useState(String(s.tipo_municao ?? ''))
  const [capacidade, setCapacidade] = useState(String(s.capacidade ?? '0'))

  const [descricao, setDescricao] = useState(item.description ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(item.image_url ?? null)
  const [uploading, setUploading] = useState(false)
  // Escolher a imagem na Biblioteca (pedido da Millie, 07/10): já abre procurando o que o item é.
  const [biblioteca, setBiblioteca] = useState(false)

  const [modifiers, setModifiers] = useState<AppliedModifier[]>(item.applied_modifiers ?? [])
  const [showModModal, setShowModModal] = useState(false)
  // Bônus do próprio item (Vestimenta/Utensílio: +2 numa perícia escolhida…), pedido 11/10.
  const [efeitosDoItem, setEfeitosDoItem] = useState<EfeitoEscolhido[]>(() => (Array.isArray(s.efeitos) ? (s.efeitos as EfeitoEscolhido[]) : []))
  const [tipoDoItem, setTipoDoItem] = useState<ItemType>(item.type)

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    // Recorte (pedido da Millie, 08/10): a pessoa enquadra a parte que quer ou usa a inteira.
    const file = escolhido ? await recortarImagem(escolhido, { proporcao: 'quadrado', titulo: 'Imagem do item' }) : null
    if (!file) return
    setUploading(true)
    // A pasta tem que ser a de quem envia (regra do banco); antes ia na do item e dava erro.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploading(false)
      return
    }
    const path = `${user.id}/${item.id}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('attack_images').upload(path, file, { upsert: true })
    setUploading(false)
    if (error) {
      window.alert('Não deu pra enviar a imagem.')
      return
    }
    setImageUrl(supabase.storage.from('attack_images').getPublicUrl(path).data.publicUrl)
  }

  // Editar um item do catalogo nao altera o catalogo global: a entrada da ficha vira uma
  // copia custom, entao a mudanca fica so nesse personagem.
  async function salvar() {
    if (!name.trim()) return
    const margemFinal = critico.trim()
    const multFinal = multiplicador.trim()

    const stats: Record<string, unknown> = {
      ...s,
      natureza: tipo,
      empunhadura,
      alcance,
      proficiencia: proficiencia || null,
      elemento: possuiElemento === 'sim' ? elemento || null : null,
      amaldicoado: amaldicoado === 'sim',
      dano: dano || null,
      tipo_dano: tipoDano || null,
      dano_alternativo: danoAlternativo || null,
      danos_extras: danosExtras.filter((d) => d.formula.trim()),
      tipo_municao: tipoMunicao || null,
      capacidade: Number(capacidade) || 0,
    }
    stats.efeitos = efeitosDoItem.filter((e) => e.valor)
    if (margemFinal || multFinal) {
      stats.critico = `${margemFinal || '20'}/x${multFinal || '2'}`
    }

    await supabase.from('character_inventory').update({
      equipment_item_id: null,
      custom_item: {
        name: name.trim(),
        type: tipoDoItem,
        category: categoria,
        spaces: Number(espacos) || 0,
        description: descricao || null,
        image_url: imageUrl,
        stats,
      },
      applied_modifiers: modifiers,
      // A categoria escolhida aqui (já com modificações/maldições) passa a ser a do item.
      category_override: null,
      quantity: Math.max(0, Number(unidades) || 0),
    }).eq('id', item.id)

    onSaved()
    onClose()
  }

  return createPortal(
    <>
    <div className="attack-modal-backdrop" onClick={onClose}>
      <div className="attack-modal-wrap" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ritual-close-outside" onClick={onClose} aria-label="Fechar">
          <span className="ritual-close-word">FECHAR</span>
          <span className="ritual-close-x">X</span>
        </button>

        <div className="attack-modal">
          <div className="attack-modal-body">
            <div className="attack-section-title"><span>INFORMAÇÕES GERAIS</span></div>
            <div className="attack-field-row">
              <TextField label="Nome" value={name} onChange={setName} placeholder="Item" />
              <SelectField label="Categoria" value={categoria} options={CATEGORIA_OPTIONS} onChange={setCategoria} />
              <TextField label="Espaços" value={espacos} onChange={setEspacos} placeholder="1" />
              <TextField label="Quantas unidades" value={unidades} onChange={setUnidades} placeholder="1" />
            </div>
            <div className="attack-field-row">
              <SelectField label="Tipo do Item" value={tipoDoItem} options={TIPO_DO_ITEM_OPTIONS} onChange={(v) => setTipoDoItem(v as ItemType)} />
              <SelectField label="Tipo" value={tipo} options={TIPO_OPTIONS} onChange={setTipo} />
              <SelectField label="Empunhadura" value={empunhadura} options={EMPUNHADURA_OPTIONS} onChange={setEmpunhadura} />
            </div>
            <div className="attack-field-row">
              <TextField label="Proficiência" value={proficiencia} onChange={setProficiencia} placeholder="Armas Táticas" />
              <SelectField label="Alcance" value={alcance} options={ALCANCE_OPTIONS} onChange={setAlcance} />
            </div>

            <div className="attack-section-title"><span>PARANORMAL</span></div>
            <div className="attack-field-row">
              <SelectField label="Possui elemento?" value={possuiElemento} options={SIM_NAO} onChange={setPossuiElemento} />
              <div className="attack-field">
                <span className="attack-field-label">Elemento</span>
                <input
                  className="attack-input"
                  value={elemento}
                  placeholder="Nenhum"
                  disabled={possuiElemento !== 'sim'}
                  onChange={(e) => setElemento(e.target.value)}
                />
              </div>
              <SelectField label="É amaldiçoado?" value={amaldicoado} options={SIM_NAO} onChange={setAmaldicoado} />
            </div>

            <div className="attack-section-title attack-section-title-inline">
              <span>DANO</span>
              <button type="button" className="attack-add-row-btn" onClick={() => setDanosExtras((d) => [...d, { formula: '', tipo: '' }])} aria-label="Adicionar outro dano">+</button>
            </div>
            <div className="attack-field-row">
              <TextField label="Dano" value={dano} onChange={setDano} placeholder="2d8" />
              <CampoTipoDeDano value={tipoDano} onChange={setTipoDano} />
            </div>
            {danosExtras.map((d, i) => (
              <div className="attack-field-row attack-damage-row" key={i}>
                <TextField label="Dano a mais" value={d.formula} onChange={(v) => setDanosExtras((l) => l.map((x, j) => (j === i ? { ...x, formula: v } : x)))} placeholder="1d6" />
                <CampoTipoDeDano value={d.tipo} onChange={(v) => setDanosExtras((l) => l.map((x, j) => (j === i ? { ...x, tipo: v } : x)))} />
                <button type="button" className="attack-damage-remove" onClick={() => setDanosExtras((l) => l.filter((_, j) => j !== i))} aria-label="Remover dano">×</button>
              </div>
            ))}
            <div className="attack-field-row">
              <TextField label="Crítico" value={critico} onChange={setCritico} placeholder="19" />
              <TextField label="Multiplicador" value={multiplicador} onChange={setMultiplicador} placeholder="3" />
              <TextField label="Dano Alternativo" value={danoAlternativo} onChange={setDanoAlternativo} placeholder="2d8" />
            </div>

            <div className="attack-section-title"><span>MUNIÇÃO</span></div>
            <div className="attack-field-row">
              <TextField label="Tipo de Munição" value={tipoMunicao} onChange={setTipoMunicao} placeholder="Balas curtas" />
              <TextField label="Capacidade" value={capacidade} onChange={setCapacidade} placeholder="0" />
            </div>

            <div className="attack-section-title"><span>IMAGEM</span></div>
            <div className="attack-image-box">
              <img src={imageUrl ?? mysteryIcon} alt="" className="attack-image-preview" />
              <label className="attack-image-alter">
                {uploading ? '...' : 'Alterar'}
                <input type="file" accept="image/*" onChange={handleImage} hidden />
              </label>
              <button type="button" className="attack-image-alter attack-image-biblioteca" onClick={() => setBiblioteca(true)}>Escolher da Biblioteca</button>
            </div>

            <div className="attack-section-title"><span>BÔNUS DO ITEM</span></div>
            <p className="efeitos-escolhidos-dica">Ex.: Vestimenta ou Utensílio com +2 numa perícia. Escolha a perícia e quanto; "só quando ligado" vira um liga/desliga no item. Com a modificação Aprimorado, o +2 vira +5 sozinho; com Função adicional, adicione outra linha com a segunda perícia.</p>
            <EditorDeEfeitos contexto="item" efeitos={efeitosDoItem} onChange={setEfeitosDoItem} />

            <div className="attack-section-title attack-section-title-inline">
              <span>MODIFICADORES E MALDIÇÕES</span>
              <button type="button" className="attack-add-row-btn" onClick={() => setShowModModal(true)}>Adicionar</button>
            </div>
            {modifiers.length > 0 && (
              <div className="attack-mod-list">
                {modifiers.map((m, i) => (
                  <div className="attack-mod-pill" key={`${m.name}-${i}`}>
                    <div className="attack-mod-pill-head">
                      <strong>{m.name}{m.elemento ? ` (${m.elemento})` : ''} | {m.kind === 'modificacao' ? 'MODIFICAÇÃO' : 'MALDIÇÃO'}</strong>
                      <button type="button" onClick={() => { const next = modifiers.filter((_, idx) => idx !== i); setCategoria((c) => categoriaComMods(c, modifiers, next) ?? c); setModifiers(next) }}>Remover</button>
                    </div>
                    <p>{m.effect}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="attack-section-title"><span>DESCRIÇÃO</span></div>
            <TextareaFormatada className="attack-textarea" value={descricao} placeholder="Descrição aqui" onChange={(e) => setDescricao(e.target.value)} />

            <button type="button" className="attack-submit-btn" onClick={salvar}>Editar</button>
          </div>
        </div>
      </div>
    </div>

    {biblioteca && (
      <div className="attack-modal-backdrop biblioteca-ficha-fundo" onClick={() => setBiblioteca(false)}>
        <div className="attack-modal-wrap biblioteca-ficha" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="ritual-close-outside" onClick={() => setBiblioteca(false)} aria-label="Fechar">
            <span className="ritual-close-word">FECHAR</span>
            <span className="ritual-close-x">X</span>
          </button>
          <div className="attack-modal">
            <BuscaBiblioteca
              buscaInicial={buscaInicialDoItem(name)}
              tags={['item']}
              arrastavel={false}
              escolhidos={imageUrl ? [imageUrl] : []}
              dica="Clique na imagem pra usar neste item."
              onEscolher={(_, url) => {
                setImageUrl(url)
                setBiblioteca(false)
              }}
            />
          </div>
        </div>
      </div>
    )}

    {showModModal && (
      <ItemModifiersModal
        itemType={tipoDoItem}
        applied={modifiers}
        onClose={() => setShowModModal(false)}
        onApply={(next) => { setCategoria((c) => categoriaComMods(c, modifiers, next) ?? c); setModifiers(next) }}
      />
    )}
    </>,
    document.body,
  )
}
