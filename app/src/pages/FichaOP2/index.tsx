import { useState } from 'react'
import AbaAgente from './AbaAgente'
import AbaInvestigacao from './AbaInvestigacao'
import AbaRelacoes from './AbaRelacoes'
import { useFichaOP2, type PersonagemOP2 } from './useFichaOP2'
import HistoricoRolagens from '../CharacterSheet/HistoricoRolagens'
import type { CharacterRecord } from '../CharacterSheet'
import fundoIdolo from '../../assets/op2/background-idolo-de-pedra.webp'
import fundoContos from '../../assets/op2/background-contos-da-vigilia.webp'
import historyIcon from '../../assets/icons/history-icon.svg'
import arkanisLogo from '../../assets/icons/arkanis-logo.png'

// Ficha de Ordem Paranormal 2 (prints do site oficial, 05/11/2026). A cor do tema segue o perfil e
// o fundo segue o cenário.
const ABAS = ['Agente', 'Investigação', 'Relações'] as const

export default function FichaOP2({ character }: { character: CharacterRecord }) {
  const personagem = character as unknown as PersonagemOP2
  const ficha = useFichaOP2(personagem)
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Agente')
  const [historico, setHistorico] = useState(false)
  const { op2 } = ficha
  const fundo = op2.cenario === 'contos' ? fundoContos : fundoIdolo

  return (
    <main className={`op2-ficha op2-tema-${op2.perfil} op2-cenario-${op2.cenario}`} style={{ backgroundImage: `url(${fundo})` }}>
      <header className="vtt-topbar op2-topbar">
        <nav className="vtt-tabs">
          <img className="vtt-topbar-logo" src={arkanisLogo} alt="Arkanis" />
          {ABAS.map((a) => (
            <button key={a} type="button" onClick={() => setAba(a)} disabled={aba === a}>{a}</button>
          ))}
        </nav>
        <div className="op2-topbar-acoes">
          <button type="button" className="vtt-icon-btn" aria-label="Histórico de Rolagens" onClick={() => setHistorico((v) => !v)}>
            <img src={historyIcon} alt="" />
          </button>
        </div>
      </header>
      {historico && <HistoricoRolagens character={character} onClose={() => setHistorico(false)} />}
      {aba === 'Agente' && <AbaAgente personagem={personagem} ficha={ficha} />}
      {aba === 'Investigação' && <AbaInvestigacao op2={op2} mudar={ficha.mudar} />}
      {aba === 'Relações' && <AbaRelacoes op2={op2} mudar={ficha.mudar} />}
    </main>
  )
}
