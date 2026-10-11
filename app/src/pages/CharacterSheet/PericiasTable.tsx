import { useState } from 'react'
import { createPortal } from 'react-dom'
import { attrValue, type Attributes, type AttributeKey, type Training } from '../../lib/rules'
import d20Icon from '../../assets/icons/d20-paranormal.svg'
import untrainedIcon from '../../assets/pericias/untrained.svg'
import trainedIcon from '../../assets/pericias/trained.svg'
import veteranIcon from '../../assets/pericias/veteran.svg'
import expertIcon from '../../assets/pericias/expert.svg'
import ellipsisIcon from '../../assets/pericias/ellipsis.svg'
import ellipsisGreenIcon from '../../assets/pericias/ellipsis-green.svg'
import { textoDasOrigens } from './defesa'
import ellipsisRedIcon from '../../assets/pericias/ellipsis-red.svg'

type SkillRow = { id: string; name: string; default_attribute: string | null; description: string | null; carga_penalty?: boolean }
type CharacterSkillRow = { skill_id: string; training: Training; attribute_override: string | null; extra_bonus: number }

const ATTR_LABELS: { key: AttributeKey; abbr: string }[] = [
  { key: 'forca', abbr: 'FOR' },
  { key: 'agilidade', abbr: 'AGI' },
  { key: 'intelecto', abbr: 'INT' },
  { key: 'vigor', abbr: 'VIG' },
  { key: 'presenca', abbr: 'PRE' },
]

const TRAINING_ORDER: Training[] = ['nenhum', 'treinado', 'veterano', 'expert']

const TRAINING_ICON: Record<Training, string> = {
  nenhum: untrainedIcon,
  treinado: trainedIcon,
  veterano: veteranIcon,
  expert: expertIcon,
}

function trainingBonus(training: Training): number {
  if (training === 'treinado') return 5
  if (training === 'veterano') return 10
  if (training === 'expert') return 15
  return 0
}

type SortField = 'pericia' | 'treino' | 'atributo' | 'extra' | 'total'

function formatDescription(text: string) {
  return text.split(/(?:\r?\n){2,}/).map((paragraph, i) => {
    const parts = paragraph.split(/(\*\*[^*]+\*\*)/g)
    return (
      <p key={i}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    )
  })
}

function SkillDescriptionModal({ skill, onClose }: { skill: SkillRow; onClose: () => void }) {
  return createPortal(
    <div className="skill-desc-backdrop" onClick={onClose}>
      <div className="skill-desc-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="skill-desc-close" onClick={onClose}>FECHAR ×</button>
        <h2 className="skill-desc-title">{skill.name}</h2>
        <div className="skill-desc-divider" />
        <div className="skill-desc-body">
          {skill.description ? formatDescription(skill.description) : <p>Descrição ainda não cadastrada.</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function PericiasTable({
  skills,
  charSkills,
  attributes,
  testDiceBonus,
  dadosDeCondicoes,
  valorDeCondicoes,
  testValueBonus,
  cargaPenalty,
  bonusDeItens,
  origensDoBonus = {},
  origensDaCarga = [],
  origensDosTestes,
  onSetSkillField,
  onRoll,
}: {
  skills: SkillRow[]
  charSkills: Record<string, CharacterSkillRow>
  attributes: Attributes
  testDiceBonus: number
  /** Dados a mais/menos por causa das condições, por perícia (Frustrado, Fraco…). */
  dadosDeCondicoes?: (pericia: string, atributo: string | null) => number
  /** Valor a mais/menos por condição criada na mão (ex.: -2 em Furtividade). */
  valorDeCondicoes?: (pericia: string, atributo: string | null) => number
  testValueBonus: number
  /** Penalidade da proteção equipada nas perícias afetadas por carga (negativo, ex.: -5). */
  cargaPenalty: number
  /** Bônus por perícia vindos de itens equipados, somados por nome da perícia. */
  bonusDeItens: Record<string, number>
  /** De onde vem cada bônus ("Item Coturnos: +2", "Poder Reflexos Defensivos: +2"), pro mouse em cima. */
  origensDoBonus?: Record<string, string[]>
  origensDaCarga?: string[]
  /** Modificadores ligados e condições que mexem no teste (dados e valor). */
  origensDosTestes?: (pericia: string, atributo: string | null) => string[]
  onSetSkillField: (skillId: string, patch: Partial<CharacterSkillRow>) => void
  onRoll: (skill: SkillRow) => void
}) {
  const [skillFilter, setSkillFilter] = useState('')
  const [onlyTrained, setOnlyTrained] = useState(false)
  // Extra mostra o digitado + itens/poderes (pedido 11/10); editando, só o digitado à mão.
  const [editandoExtra, setEditandoExtra] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('pericia')
  const [treinoPickerFor, setTreinoPickerFor] = useState<string | null>(null)
  const [atributoPickerFor, setAtributoPickerFor] = useState<string | null>(null)
  const [descriptionFor, setDescriptionFor] = useState<SkillRow | null>(null)

  function csOf(skillId: string): CharacterSkillRow {
    return charSkills[skillId] ?? { skill_id: skillId, training: 'nenhum', attribute_override: null, extra_bonus: 0 }
  }

  const rows = skills
    .filter((s) => {
      if (skillFilter && !s.name.toLowerCase().includes(skillFilter.toLowerCase())) return false
      if (onlyTrained && csOf(s.id).training === 'nenhum') return false
      return true
    })
    .map((s) => {
      const cs = csOf(s.id)
      const attr = cs.attribute_override ?? s.default_attribute
      // A Protecao Pesada tira 5 das pericias marcadas com carga_penalty no banco:
      // Acrobacia, Crime e Furtividade.
      const penalidade = s.carga_penalty ? cargaPenalty : 0
      const doItem = bonusDeItens[s.name] ?? 0
      const total = trainingBonus(cs.training) + cs.extra_bonus + testValueBonus + penalidade + doItem + (valorDeCondicoes?.(s.name, attr) ?? 0)
      return { skill: s, cs, attr, total, penalidade, doItem }
    })

  rows.sort((a, b) => {
    if (sortField === 'treino') return TRAINING_ORDER.indexOf(b.cs.training) - TRAINING_ORDER.indexOf(a.cs.training)
    if (sortField === 'atributo') return (a.attr ?? '').localeCompare(b.attr ?? '')
    if (sortField === 'extra') return (b.cs.extra_bonus + b.doItem) - (a.cs.extra_bonus + a.doItem)
    if (sortField === 'total') return b.total - a.total
    return a.skill.name.localeCompare(b.skill.name)
  })

  return (
    <div className="pericias-panel">
      <div className="pericias-toggle-row">
        <button type="button" className={`pericias-toggle${!onlyTrained ? ' active' : ''}`} onClick={() => setOnlyTrained(false)}>TODAS AS PERÍCIAS</button>
        <button type="button" className={`pericias-toggle${onlyTrained ? ' active' : ''}`} onClick={() => setOnlyTrained(true)}>APENAS TREINADAS</button>
      </div>

      <div className="pericias-search">
        <input placeholder="Busque Perícias" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
      </div>

      <div className="pericias-columns">
        <button type="button" className={`pericias-col-btn pericias-col-pericia${sortField === 'pericia' ? ' active' : ''}`} onClick={() => setSortField('pericia')}>Perícia</button>
        <button type="button" className={`pericias-col-btn${sortField === 'treino' ? ' active' : ''}`} onClick={() => setSortField('treino')}>Treino</button>
        <button type="button" className={`pericias-col-btn${sortField === 'atributo' ? ' active' : ''}`} onClick={() => setSortField('atributo')}>Atrib.</button>
        <span />
        <button type="button" className={`pericias-col-btn${sortField === 'extra' ? ' active' : ''}`} onClick={() => setSortField('extra')}>Extra</button>
        <button type="button" className={`pericias-col-btn${sortField === 'total' ? ' active' : ''}`} onClick={() => setSortField('total')}>Total</button>
      </div>

      <div className="pericias-list">
        {rows.map(({ skill, cs, attr, total, penalidade, doItem }) => {
          const dadosExtras = testDiceBonus + (dadosDeCondicoes?.(skill.name, attr) ?? 0)
          const effectiveScore = attr ? attrValue(attributes, attr) + dadosExtras : 0
          const diceCount = effectiveScore > 0 ? effectiveScore : 2
          const bonusPips = Math.min(Math.abs(dadosExtras), diceCount)
          const bonusPipIcon = dadosExtras < 0 ? ellipsisRedIcon : ellipsisGreenIcon
          const origensTeste = origensDosTestes?.(skill.name, attr) ?? []
          const origensItem = origensDoBonus[skill.name] ?? []

          return (
            <div key={skill.id} className="pericias-row" data-training={cs.training}>
              <button type="button" className="pericias-row-roll-btn" onClick={() => onRoll(skill)} disabled={!attr} aria-label={`Rolar ${skill.name}`}>
                <img className="pericias-row-icon" src={d20Icon} alt="" />
              </button>

              <button type="button" className="pericias-row-name-btn" onClick={() => setDescriptionFor(skill)}>
                <span className="pericias-row-name">
                  {skill.name}
                  <span className="pericias-row-formula">
                    <span style={{ color: dadosExtras > 0 ? '#3ecf6e' : dadosExtras < 0 ? '#e0393e' : undefined }} title={dadosExtras !== 0 ? textoDasOrigens(origensTeste) : undefined}>{diceCount}d20</span>
                    {Array.from({ length: diceCount }).map((_, i) => (
                      <img key={i} src={i < diceCount - bonusPips ? ellipsisIcon : bonusPipIcon} alt="" className="pericias-pip" />
                    ))}
                  </span>
                </span>
              </button>

              <div className="pericias-cell pericias-cell-treino" style={{ position: 'relative' }}>
                <button type="button" className="pericias-treino-btn" onClick={() => setTreinoPickerFor((v) => v === skill.id ? null : skill.id)}>
                  <img src={TRAINING_ICON[cs.training]} alt={cs.training} />
                </button>
                {treinoPickerFor === skill.id && (
                  <div className="pericias-picker pericias-picker-treino">
                    {TRAINING_ORDER.map((t) => (
                      <button key={t} type="button" className={t === cs.training ? 'selected' : ''} onClick={() => { onSetSkillField(skill.id, { training: t }); setTreinoPickerFor(null) }}>
                        <img src={TRAINING_ICON[t]} alt={t} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pericias-cell pericias-cell-atributo" style={{ position: 'relative' }}>
                <button type="button" className="pericias-atributo-btn" onClick={() => setAtributoPickerFor((v) => v === skill.id ? null : skill.id)}>
                  {attr ? ATTR_LABELS.find((a) => a.key === attr)?.abbr ?? '—' : '—'}
                </button>
                {atributoPickerFor === skill.id && (
                  <div className="pericias-picker pericias-picker-atributo">
                    {ATTR_LABELS.map((a) => (
                      <button key={a.key} type="button" className={a.key === attr ? 'selected' : ''} onClick={() => { onSetSkillField(skill.id, { attribute_override: a.key }); setAtributoPickerFor(null) }}>
                        {a.abbr}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pericias-divider" />

              <div className="pericias-cell pericias-cell-extra">
                <input
                  type="number"
                  value={editandoExtra === skill.id ? cs.extra_bonus : cs.extra_bonus + doItem}
                  title={doItem ? textoDasOrigens([`Digitado: ${cs.extra_bonus}`, ...(origensDoBonus[skill.name] ?? [])]) : undefined}
                  onFocus={() => setEditandoExtra(skill.id)}
                  onBlur={() => setEditandoExtra(null)}
                  onChange={(e) => onSetSkillField(skill.id, { extra_bonus: Number(e.target.value) })}
                />
              </div>

              {/* a penalidade de carga aparece do lado do total, pra nao sumir dentro dele */}
              <div
                className="pericias-cell pericias-cell-total"
                title={textoDasOrigens([...origensItem, ...(penalidade ? origensDaCarga : []), ...origensTeste.filter((o) => !/d20/.test(o))])}
              >
                {total}
                {(penalidade !== 0 || doItem !== 0) && (
                  <span className="pericias-marcadores">
                    {penalidade !== 0 && <span className="pericias-carga-penalty" title={textoDasOrigens(origensDaCarga)}>{penalidade}</span>}
                    {doItem !== 0 && <span className="pericias-item-bonus" title={textoDasOrigens(origensItem)}>{doItem > 0 ? '+' : ''}{doItem}</span>}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {descriptionFor && <SkillDescriptionModal skill={descriptionFor} onClose={() => setDescriptionFor(null)} />}
    </div>
  )
}
