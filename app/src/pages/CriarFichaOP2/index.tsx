import { useState } from 'react'
import { CENARIOS, type IdCenario } from '../../sistemas/op2/cenarios'
import { fichasDoCenario, type FichaPronta, type Perfil } from '../../sistemas/op2/fichasProntas'
import fundo from '../../assets/op2/background-idolo-de-pedra.webp'
import ornamento from '../../assets/op2/title-decoration.svg'

// Ordem Paranormal 2: "Qual tipo de ficha você quer?" (prints do site oficial, 05/11/2026).
// À esquerda, ficha vazia por perfil; à direita, as fichas prontas do cenário escolhido.

const CARDS = import.meta.glob('../../assets/op2/fichas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const cardDa = (f: FichaPronta) => CARDS[`../../assets/op2/fichas/${f.card}`]

const PERFIS: { id: Perfil; nome: string; destaque: string; resto: string }[] = [
  { id: 'executor', nome: 'Executor', destaque: 'Você age primeiro e pensa depois.', resto: ' E, se não der certo da primeira vez, tenta de novo até conseguir, vencendo pela força de sua perseverança.' },
  { id: 'analista', nome: 'Analista', destaque: 'Você observa, entende e se prepara, para só então agir.', resto: ' Pode demorar para tomar uma atitude, mas quando o faz, é com a maior precisão possível.' },
  { id: 'vigilante', nome: 'Vigilante', destaque: 'Você está sempre atento aos arredores, aproveitando as brechas perfeitas para agir primeiro.', resto: ' Se adapta a imprevistos e não tem problemas em tomar decisões sob pressão.' },
]

// Canto do card de perfil: arabesco desenhado em código (a imagem do site não sai).
function Arabesco() {
  return (
    <svg className="op2-perfil-arabesco" viewBox="0 0 60 44" aria-hidden>
      <path d="M58 6v36H18" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M52 40a20 20 0 0 1 4-20M44 40a13 13 0 0 1 12-13M36 40a7 7 0 0 1 7-6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="49" cy="33" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M26 42l4-6 4 6M12 42l3-4 3 4M54 12l-4 3 4 3M54 2l-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M22 36h6M40 24h5M47 18v5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default function CriarFichaOP2() {
  const [cenario, setCenario] = useState<IdCenario>('maldicao')
  const [ato, setAto] = useState('ato1')
  const [aviso, setAviso] = useState<string | null>(null)
  const atos = CENARIOS[cenario].atos
  const fichas = fichasDoCenario(cenario, atos.length ? ato : undefined)

  // A ficha do OP2 é o próximo passo: por enquanto só registra a escolha.
  function escolherPerfil(p: Perfil) {
    setAviso(`Ficha vazia de ${PERFIS.find((x) => x.id === p)?.nome}: a ficha do Ordem Paranormal 2 ainda está sendo feita.`)
  }
  function escolherPronta(f: FichaPronta) {
    setAviso(`${f.nome}: a ficha do Ordem Paranormal 2 ainda está sendo feita.`)
  }

  return (
    <main className={`op2-escolha op2-${cenario}`} style={{ backgroundImage: `url(${fundo})` }}>
      <div className="op2-escolha-conteudo">
        <header className="op2-escolha-topo">
          <h1 className="op2-titulo">Qual tipo de ficha você quer?</h1>
          <div className="op2-abas" role="tablist" aria-label="Cenário">
            {(Object.keys(CENARIOS) as IdCenario[]).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={cenario === id} className={`op2-aba${cenario === id ? ' ativa' : ''}`} onClick={() => setCenario(id)}>
                <span>{CENARIOS[id].nome}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="op2-escolha-colunas">
          <section className="op2-coluna-perfis" aria-label="Ficha vazia">
            <div className="op2-moldura">
              <p>Selecione um perfil e comece com uma <strong>ficha vazia...</strong></p>
            </div>
            {PERFIS.map((p) => (
              <button key={p.id} type="button" className={`op2-perfil op2-perfil-${p.id}`} onClick={() => escolherPerfil(p.id)}>
                <span className="op2-perfil-aba">{p.nome}</span>
                <span className="op2-perfil-corpo">
                  <strong>{p.destaque}</strong>{p.resto}
                  <Arabesco />
                </span>
              </button>
            ))}
          </section>

          <section className="op2-coluna-prontas" aria-label="Fichas prontas">
            <p className="op2-prontas-titulo">...ou selecione uma <strong>ficha pronta.</strong></p>
            {atos.length > 0 && (
              <div className="op2-atos" role="tablist" aria-label="Ato">
                <img src={ornamento} alt="" className="op2-ornamento" />
                {atos.map((a) => (
                  <button key={a.id} type="button" role="tab" aria-selected={ato === a.id} className={`op2-aba op2-aba-ato${ato === a.id ? ' ativa' : ''}`} onClick={() => setAto(a.id)}>
                    <span>{a.nome}</span>
                  </button>
                ))}
                <img src={ornamento} alt="" className="op2-ornamento espelhado" />
              </div>
            )}
            <div className="op2-fichas">
              {fichas.map((f) => (
                <button key={f.id} type="button" className={`op2-ficha op2-perfil-${f.perfil}`} onClick={() => escolherPronta(f)} aria-label={`${f.nome}${f.sobrenome ? ` ${f.sobrenome}` : ''}, ${f.perfil}, ${f.vocacao}, nível ${f.nivel}`}>
                  <img src={cardDa(f)} alt="" draggable={false} />
                </button>
              ))}
            </div>
          </section>
        </div>
        {aviso && (
          <p className="op2-aviso" role="status">
            {aviso}
            <button type="button" aria-label="Fechar" onClick={() => setAviso(null)}>×</button>
          </p>
        )}
      </div>
    </main>
  )
}
