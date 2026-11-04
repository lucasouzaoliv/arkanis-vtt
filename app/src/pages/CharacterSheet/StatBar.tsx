import healIcon from '../../assets/heal-icon.svg'
import emptySkullIcon from '../../assets/empty-skull-icon.svg'
import markedSkullIcon from '../../assets/marked-skull-icon.svg'
import emptyBrainIcon from '../../assets/empty-brain-icon.svg'
import markedBrainIcon from '../../assets/marked-brain-icon.svg'

// A caixinha do número do tamanho do número, pra barra "/" ficar com o mesmo espaço dos dois lados.
const larguraDoNumero = (n: number) => `${Math.max(1, String(n).length) + 0.3}ch`

export default function StatBar({
  label,
  icon,
  current,
  max,
  temp,
  colorClass,
  note,
  onDecrement,
  onIncrement,
  onTempDecrement,
  onTempIncrement,
  onTempChange,
  tempNota,
  onCurrentChange,
  onMaxChange,
  deathMarks,
  onToggleDeathMark,
  onHeal,
}: {
  label: string
  icon?: string
  current: number
  max: number
  temp?: number
  colorClass: 'pv' | 'sanidade' | 'esforco' | 'pd'
  note?: string
  onDecrement: () => void
  onIncrement: () => void
  onTempDecrement?: () => void
  onTempIncrement?: () => void
  // Digitar quanto de temporário ganhou, sem ir de um em um.
  onTempChange?: (value: number) => void
  tempNota?: string
  onCurrentChange?: (value: number) => void
  onMaxChange?: (value: number) => void
  deathMarks?: number
  onToggleDeathMark?: (index: number) => void
  onHeal?: () => void
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  const dying = current <= 0 && deathMarks !== undefined
  const emptyMarkIcon = colorClass === 'sanidade' ? emptyBrainIcon : emptySkullIcon
  const markedMarkIcon = colorClass === 'sanidade' ? markedBrainIcon : markedSkullIcon

  return (
    <div className="stat-bar-row">
      {icon && <img src={icon} alt="" className="vtt-stat-icon" />}
      <div className="stat-bar-body">
        <div className="stat-bar-label-row">
          <span className="stat-bar-label">{label}</span>
          {temp !== undefined && (
            <span className={`stat-bar-temp${temp > 0 ? ' stat-bar-temp-active' : ''}`}>
              Temp.
              <button type="button" className="stat-bar-temp-arrow" onClick={onTempDecrement} aria-label={`-1 Temp. ${label}`}>‹</button>
              {onTempChange ? (
                <input
                  type="number"
                  min={0}
                  className="stat-bar-temp-input"
                  value={temp}
                  style={{ width: larguraDoNumero(temp) }}
                  onChange={(e) => onTempChange(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                  onFocus={(e) => e.target.select()}
                  aria-label={`Temporário de ${label}`}
                />
              ) : temp}
              <button type="button" className="stat-bar-temp-arrow" onClick={onTempIncrement} aria-label={`+1 Temp. ${label}`}>›</button>
              {tempNota && temp > 0 && <span className="stat-bar-temp-nota" title={tempNota}>físico</span>}
            </span>
          )}
        </div>
        {temp !== undefined && temp > 0 && <div className="stat-bar-temp-glow" />}
        <div className={`stat-bar-fill-wrap${temp !== undefined && temp > 0 ? ' stat-bar-fill-wrap-temp' : ''}`}>
          <div className={`stat-bar-fill ${colorClass}`} style={{ width: `${pct}%` }} />
          {dying ? (
            <>
              <button type="button" className="stat-bar-heal-btn" onClick={onHeal}>
                <img src={healIcon} alt="" className="stat-bar-heal-icon" />
                Curar
              </button>
              <span className="stat-bar-value">
                {current}<span className="stat-bar-sep">/</span>{max}
              </span>
              <span className="stat-bar-death-marks">
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    type="button"
                    className="stat-bar-death-mark"
                    onClick={() => onToggleDeathMark?.(i)}
                    aria-label={`Marca de morte ${i + 1}`}
                  >
                    <img src={((deathMarks ?? 0) >> i) & 1 ? markedMarkIcon : emptyMarkIcon} alt="" />
                  </button>
                ))}
              </span>
            </>
          ) : (
            <>
              <button type="button" className="stat-bar-arrow stat-bar-arrow-left" onClick={onDecrement} aria-label={`-1 ${label}`}>‹</button>
              <span className="stat-bar-value">
                {onCurrentChange ? (
                  <input
                    type="number"
                    className="stat-bar-value-input"
                    value={current}
                    style={{ width: larguraDoNumero(current) }}
                    onChange={(e) => onCurrentChange(Number(e.target.value))}
                    aria-label={label}
                  />
                ) : current}
                <span className="stat-bar-sep">/</span>
                {onMaxChange ? (
                  <input
                    type="number"
                    className="stat-bar-value-input stat-bar-max-input"
                    value={max}
                    style={{ width: larguraDoNumero(max) }}
                    onChange={(e) => onMaxChange(Number(e.target.value))}
                    aria-label={`Máximo de ${label}`}
                  />
                ) : max}
              </span>
              <button type="button" className="stat-bar-arrow stat-bar-arrow-right" onClick={onIncrement} aria-label={`+1 ${label}`}>›</button>
            </>
          )}
        </div>
        {note && <p className="stat-bar-note">{note}</p>}
      </div>
    </div>
  )
}
