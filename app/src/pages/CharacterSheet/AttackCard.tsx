import mysteryIcon from '../../assets/combate/op-icon-misterio-custom.png'
import { TextoRico } from '../../components/TextoRico'

// Os mesmos rotulos do card de item: o ataque que vem de uma arma do inventario carrega
// esses codigos, e tem que ler igual nos dois lugares.
const ALCANCE_LABEL: Record<string, string> = {
  curto: 'Curto', medio: 'Médio', longo: 'Longo', extremo: 'Extremo',
}

const NATUREZA_LABEL: Record<string, string> = {
  corpo_a_corpo: 'Corpo a Corpo', arremesso: 'Arremesso', disparo: 'Disparo', fogo: 'Fogo',
}

const EMPUNHADURA_LABEL: Record<string, string> = {
  nenhuma: 'Nenhuma', leve: 'Leve', uma_mao: 'Uma Mão', duas_maos: 'Duas Mãos',
}

function rotulo(mapa: Record<string, string>, valor: unknown) {
  const chave = String(valor ?? '')
  if (!chave) return null
  return mapa[chave] ?? chave
}

export type AttackGeneralInfo = {
  tipo?: string
  empunhadura?: string
  alcance?: string
  tipo_municao?: string
  municao?: string | null
} | null

// So entram os campos que o ataque realmente tem - arma branca nao mostra municao vazia.
export function caracteristicas(info: AttackGeneralInfo): { label: string; value: string }[] {
  const dados = info ?? {}
  const pares: { label: string; value: string | null }[] = [
    { label: 'Tipo', value: rotulo(NATUREZA_LABEL, dados.tipo) },
    { label: 'Alcance', value: rotulo(ALCANCE_LABEL, dados.alcance) },
    { label: 'Empunhadura', value: rotulo(EMPUNHADURA_LABEL, dados.empunhadura) },
    { label: 'Munição', value: dados.municao ?? (dados.tipo_municao ? String(dados.tipo_municao) : null) },
  ]
  return pares.filter((p): p is { label: string; value: string } => !!p.value)
}

export default function AttackCard({
  name,
  ataque,
  dano,
  danoDetalhado,
  critico,
  info,
  descricao,
  imagem,
  custoPE,
  municaoRestante,
  expanded,
  onToggle,
  onRollAtaque,
  onRollDano,
  danoArmado,
  ehCritico,
  onRemove,
  onEdit,
}: {
  name: string
  ataque: string
  dano: string
  /** Cada linha de dano por extenso, para o card expandido (o extra diz de onde veio, na cor do elemento). */
  danoDetalhado?: { texto: string; origem?: string; cor?: string | null }[]
  critico: string
  info: AttackGeneralInfo
  descricao?: string | null
  /** Foto escolhida no ataque (ou a da arma); antes o card sempre mostrava o ícone padrão. */
  imagem?: string | null
  /** "2 PE": o ataque desconta isso ao rolar (pedido 12/10). */
  custoPE?: string | null
  /** "12/15 Balas", quando a arma tem munição vinculada no inventário. */
  municaoRestante?: string | null
  expanded: boolean
  onToggle: () => void
  onRollAtaque: () => void
  onRollDano: (critico: boolean) => void
  /** Depois do teste de ataque, a caixa de dano fica armada para a rolagem. */
  danoArmado: boolean
  ehCritico: boolean
  onRemove: () => void
  onEdit: () => void
}) {
  const lista = caracteristicas(info)

  return (
    <div className={`inv-item-card attack-card${expanded ? ' expanded' : ''}`}>
      <div className="attack-card-head">
        <button type="button" className="attack-card-title" onClick={onToggle}>
          <img className={`attack-card-icon${imagem ? ' attack-card-foto' : ''}`} src={imagem || mysteryIcon} alt="" />
          <span className="inv-item-name">
            {name}
            {custoPE && <span className="attack-card-custo">{custoPE}</span>}
          </span>
        </button>

        {/* As proprias caixas sao os botoes de rolagem: nao existe botao solto embaixo. */}
        <div className="attack-card-boxes">
          <button type="button" className="attack-card-box" onClick={onRollAtaque} title={ataque}>
            <span className="attack-card-box-value">{ataque}</span>
            <span className="attack-card-box-label">Ataque</span>
          </button>
          <button
            type="button"
            className={`attack-card-box${danoArmado && !ehCritico ? ' armado' : ''}`}
            onClick={() => onRollDano(false)}
            title={dano}
          >
            <span className="attack-card-box-value">{dano}</span>
            <span className="attack-card-box-label">Dano</span>
          </button>
          <button
            type="button"
            className={`attack-card-box${danoArmado && ehCritico ? ' armado' : ''}`}
            onClick={() => onRollDano(true)}
          >
            <span className="attack-card-box-value">{critico}</span>
            <span className="attack-card-box-label">Crítico</span>
          </button>
        </div>

        <button type="button" className="attack-card-chevron" onClick={onToggle} aria-label={expanded ? 'Recolher' : 'Expandir'}>
          <span className={`inv-item-chevron${expanded ? ' up' : ''}`} aria-hidden>⌄</span>
        </button>
      </div>

      {municaoRestante && (
        <div className="inv-item-qty-row">
          <span className="inv-item-qty-label">Munição:</span>
          <span className="inv-item-qty-box"><span className="inv-item-qty-value">{municaoRestante}</span></span>
        </div>
      )}

      {expanded && (
        <>
          {danoDetalhado && danoDetalhado.length > 1 && (
            <>
              <div className="inv-item-divider" />
              <dl className="inv-item-details">
                {danoDetalhado.map((linha, i) => (
                  <div key={linha.texto + i}>
                    <dt>{i === 0 ? 'Dano' : 'Dano extra'}</dt>
                    <dd>
                      {linha.texto}
                      {linha.origem && <span className="dano-origem" style={linha.cor ? { color: linha.cor } : undefined}> ({linha.origem})</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {lista.length > 0 && (
            <>
              <div className="inv-item-divider" />
              <dl className="inv-item-details">
                {lista.map((d) => (
                  <div key={d.label}>
                    <dt>{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {descricao && (
            <>
              <div className="inv-item-divider" />
              <p className="inv-item-description"><TextoRico texto={descricao} /></p>
            </>
          )}

          <div className="inv-item-actions">
            <button type="button" className="inv-item-btn" onClick={onRemove}>Remover</button>
            <span className="inv-item-actions-right">
              <button type="button" className="inv-item-btn" onClick={onEdit}>Editar</button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
