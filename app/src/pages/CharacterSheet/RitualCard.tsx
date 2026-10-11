import defaultRitualImg from '../../assets/rituais/op-default-ritual-img.svg'
import sangueTexture from '../../assets/rituais/sangue-texture.webp'
import morteTexture from '../../assets/rituais/morte-texture.webp'
import conhecimentoTexture from '../../assets/rituais/conhecimento-texture.webp'
import energiaTexture from '../../assets/rituais/energia-texture.webp'
import { TextoRico } from '../../components/TextoRico'
import medoTexture from '../../assets/rituais/medo-texture.webp'

export const ELEMENT_TEXTURE: Record<string, string> = {
  sangue: sangueTexture,
  morte: morteTexture,
  conhecimento: conhecimentoTexture,
  energia: energiaTexture,
  medo: medoTexture,
}

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }

export type RitualView = {
  entryId: string
  name: string
  elemento: string | null
  circle: number
  execution: string | null
  range: string | null
  target: string | null
  area: string | null
  duration: string | null
  resistance: string | null
  effect: string
  description: string | null
  image_url: string | null
  dice: string | null
  diceDiscente: string | null
  diceVerdadeiro: string | null
  discenteCost: number | null
  discenteEffect: string | null
  verdadeiroCost: number | null
  verdadeiroEffect: string | null
}

// Os rituais do catalogo nao guardam a formula de dados numa coluna propria: o dano/cura
// aparece dentro do texto do efeito ("8d6 dano de Energia"). Entao a formula do botao sai
// do primeiro XdY(+Z) que aparecer no texto correspondente a cada modo.
export function diceFromText(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(/\b(\d+d\d+(?:\s*[+-]\s*\d+)?)/i)
  return m ? m[1].replace(/\s+/g, '') : null
}

export default function RitualCard({
  ritual,
  expanded,
  onToggle,
  onRoll,
  onRemove,
  onEdit,
  custo,
  dt,
  sigla = 'PE',
}: {
  ritual: RitualView
  expanded: boolean
  onToggle: () => void
  // Conjura no modo escolhido; formula = null quando o ritual não rola dados.
  onRoll: (mode: 'normal' | 'discente' | 'verdadeiro', formula: string | null) => void
  custo?: (mode: 'normal' | 'discente' | 'verdadeiro') => number
  // DT pra resistir (10 + limite de PE + Presença + poderes), mostrada quando o ritual tem resistência.
  dt?: { dt: number; motivos: string[] }
  sigla?: string
  onRemove: () => void
  onEdit: () => void
}) {
  const texture = ritual.elemento ? ELEMENT_TEXTURE[ritual.elemento] : undefined
  // Cada modo que o ritual tem pode ser conjurado, com ou sem dados.
  const modes: { key: 'normal' | 'discente' | 'verdadeiro'; label: string; formula: string | null; existe: boolean }[] = [
    { key: 'normal', label: 'Normal', formula: ritual.dice, existe: true },
    { key: 'discente', label: 'Discente', formula: ritual.diceDiscente, existe: !!(ritual.diceDiscente || ritual.discenteEffect) },
    { key: 'verdadeiro', label: 'Verdadeiro', formula: ritual.diceVerdadeiro, existe: !!(ritual.diceVerdadeiro || ritual.verdadeiroEffect) },
  ]

  const meta: { label: string; value: string | null }[] = [
    { label: 'Execução', value: ritual.execution },
    { label: 'Alcance', value: ritual.range },
    { label: 'Alvo', value: ritual.target },
    { label: 'Área', value: ritual.area },
    { label: 'Duração', value: ritual.duration },
    { label: 'Resistência', value: ritual.resistance && dt && !/^(nenhuma|—|-)$/i.test(ritual.resistance.trim()) ? `${ritual.resistance} · DT ${dt.dt}` : ritual.resistance },
    { label: 'Efeito', value: ritual.effect },
  ].filter((m) => m.value)

  return (
    <div
      className={`ritual-card${expanded ? ' expanded' : ''}`}
      style={texture ? { backgroundImage: `url(${texture})` } : undefined}
    >
      <button type="button" className="ritual-card-head" onClick={onToggle}>
        <img className="ritual-card-icon" src={ritual.image_url ?? defaultRitualImg} alt="" />
        <span className="ritual-card-circle">{ROMAN[ritual.circle] ?? ritual.circle}</span>
        <span className="ritual-card-name">{ritual.name}</span>
        <span className="ritual-card-chevron">{expanded ? '⌃' : '⌄'}</span>
      </button>

      {expanded && (
        <div className="ritual-card-body">
          <div className="ritual-card-rolls">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                className="ritual-roll-btn"
                disabled={!m.existe}
                title={m.existe ? `Conjurar${m.key === 'normal' ? '' : ` (${m.label})`}${custo ? `: ${custo(m.key)} ${sigla}` : ''}` : undefined}
                onClick={() => m.existe && onRoll(m.key, m.formula)}
              >
                <span className="ritual-roll-formula">{m.formula ?? (m.existe ? 'Conjurar' : '—')}</span>
                <span className="ritual-roll-label">{m.label}{m.existe && custo ? ` · ${custo(m.key)} ${sigla}` : ''}</span>
              </button>
            ))}
          </div>

          <div className="ritual-card-meta">
            {meta.map((m) => (
              <p key={m.label}>
                <strong>{m.label.toUpperCase()}</strong> <TextoRico texto={m.value} />
              </p>
            ))}
          </div>

          {(ritual.discenteEffect || ritual.verdadeiroEffect) && (
            <div className="ritual-card-variants">
              {ritual.discenteEffect && (
                <p>
                  <strong>DISCENTE{ritual.discenteCost != null ? ` (${ritual.discenteCost} PE)` : ''}</strong> <TextoRico texto={ritual.discenteEffect} />
                </p>
              )}
              {ritual.verdadeiroEffect && (
                <p>
                  <strong>VERDADEIRO{ritual.verdadeiroCost != null ? ` (${ritual.verdadeiroCost} PE)` : ''}</strong> <TextoRico texto={ritual.verdadeiroEffect} />
                </p>
              )}
            </div>
          )}

          {ritual.description && <p className="ritual-card-desc"><TextoRico texto={ritual.description} /></p>}

          <div className="ritual-card-actions">
            <button type="button" className="ritual-card-action" onClick={onRemove}>Remover</button>
            <button type="button" className="ritual-card-action" onClick={onEdit}>Editar</button>
          </div>
        </div>
      )}
    </div>
  )
}
