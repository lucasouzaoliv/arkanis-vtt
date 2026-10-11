import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TextoRico } from '../../components/TextoRico'
import mysteryIcon from '../../assets/combate/op-icon-misterio-custom.png'

export type InventoryCardItem = {
  type?: string
  name: string
  category?: string | null
  spaces?: number | null
  description?: string | null
  stats?: Record<string, unknown>
  /** Arte do item (catalogo ou item editado na ficha); sem ela, o icone de misterio. */
  image_url?: string | null
}

const ALCANCE_LABEL: Record<string, string> = {
  curto: 'Curto',
  medio: 'Médio',
  longo: 'Longo',
  extremo: 'Extremo',
}

const NATUREZA_LABEL: Record<string, string> = {
  corpo_a_corpo: 'Corpo a Corpo',
  disparo: 'Disparo',
  fogo: 'Fogo',
}

const EMPUNHADURA_LABEL: Record<string, string> = {
  nenhuma: 'Nenhuma',
  uma_mao: 'Uma Mão',
  duas_maos: 'Duas Mãos',
}

function rotulo(mapa: Record<string, string>, valor: unknown) {
  const chave = String(valor ?? '')
  if (!chave) return null
  return mapa[chave] ?? chave
}

// A linha de resumo muda conforme o tipo: arma mostra dano e critico, protecao mostra
// defesa, e todo item mostra categoria e espaco.
export function resumo(item: InventoryCardItem): { label: string; value: string }[] {
  const stats = item.stats ?? {}
  const linha: { label: string; value: string }[] = []

  if (item.type === 'arma') {
    linha.push({ label: 'Dano', value: String(stats.dano ?? '—') })
    linha.push({ label: 'Crítico', value: String(stats.critico ?? '—') })
    linha.push({ label: 'Alcance', value: rotulo(ALCANCE_LABEL, stats.alcance) ?? '—' })
  }
  if (item.type === 'protecao') {
    linha.push({ label: 'Defesa', value: `+${stats.defesa ?? 0}` })
  }

  linha.push({ label: 'Categoria', value: String(item.category ?? '—') })
  linha.push({ label: 'Espaço', value: String(item.spaces ?? 0) })
  return linha
}

// No card aberto, so aparecem os campos que o item realmente tem.
export function detalhes(item: InventoryCardItem): { label: string; value: string }[] {
  const stats = item.stats ?? {}
  const pares: { label: string; value: string | null }[] = [
    { label: 'Tipo', value: rotulo(NATUREZA_LABEL, stats.natureza) },
    { label: 'Alcance', value: rotulo(ALCANCE_LABEL, stats.alcance) },
    { label: 'Empunhadura', value: rotulo(EMPUNHADURA_LABEL, stats.empunhadura) },
    { label: 'Munição', value: stats.tipo_municao ? String(stats.tipo_municao) : null },
    { label: 'Proficiência', value: stats.proficiencia ? String(stats.proficiencia) : null },
  ]
  return pares.filter((p): p is { label: string; value: string } => !!p.value)
}

export default function InventoryItemCard({
  item,
  expanded,
  onToggle,
  quantidade,
  children,
  actions,
}: {
  item: InventoryCardItem
  expanded: boolean
  onToggle: () => void
  /** Linha de QUANTIDADE, quando o item controla usos/munição. Aparece com o card fechado também. */
  quantidade?: React.ReactNode
  /** Conteúdo extra dentro do card aberto (munição vinculada, equipar, modificações). */
  children?: React.ReactNode
  actions?: React.ReactNode
}) {
  const linhaResumo = resumo(item)
  // Documento coletado na mesa (ou qualquer item com arte): abre a imagem grande pra ler de novo.
  const [vendo, setVendo] = useState(false)
  const listaDetalhes = detalhes(item)

  return (
    <div className={`inv-item-card${expanded ? ' expanded' : ''}`}>
      <button type="button" className="inv-item-head" onClick={onToggle}>
        <img className={`inv-item-icon${item.image_url ? ' inv-item-icon-arte' : ''}`} src={item.image_url || mysteryIcon} alt="" />
        <span className="inv-item-name">{item.name}</span>
        <span className={`inv-item-chevron${expanded ? ' up' : ''}`} aria-hidden>⌄</span>
      </button>

      <div className="inv-item-stats">
        {linhaResumo.map((s) => (
          <span key={s.label} className="inv-item-stat">
            <span className="inv-item-stat-label">{s.label}</span>
            <span className="inv-item-stat-value">{s.value}</span>
          </span>
        ))}
      </div>

      {quantidade && <div className="inv-item-qty-row">{quantidade}</div>}

      {expanded && (
        <>
          {listaDetalhes.length > 0 && (
            <>
              <div className="inv-item-divider" />
              <dl className="inv-item-details">
                {listaDetalhes.map((d) => (
                  <div key={d.label}>
                    <dt>{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {item.description && (
            <>
              <div className="inv-item-divider" />
              <p className="inv-item-description"><TextoRico texto={item.description} /></p>
            </>
          )}

          {item.image_url && (
            <button type="button" className="inv-item-btn inv-item-ver" onClick={() => setVendo(true)}>Ver imagem</button>
          )}

          {children}

          {actions && <div className="inv-item-actions">{actions}</div>}
        </>
      )}
      {vendo && item.image_url && createPortal(
        <div className="inv-item-imagem-fundo" role="dialog" aria-label={item.name} onClick={() => setVendo(false)}>
          <img src={item.image_url} alt={item.name} />
          <button type="button" className="ritual-close-outside" aria-label="Fechar" onClick={() => setVendo(false)}>
            <span className="ritual-close-word">FECHAR</span>
            <span className="ritual-close-x">X</span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
