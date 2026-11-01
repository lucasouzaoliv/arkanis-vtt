import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown } from '@fortawesome/free-solid-svg-icons'
import { passosDoSorteio, type Sorteio } from './combate'

// Roleta do combate (pedido da Millie, 01/11): a seta passa de cabeça em cabeça, cada vez mais devagar,
// até parar no sorteado. O vencedor já vem decidido, então a tela de todo mundo mostra o mesmo.
const TEMPO_PARADA = 7000

export default function SetaDoSorteio({ sorteio, tokens, escala, onFim }: {
  sorteio: Sorteio
  tokens: { id: string; x: number; y: number; width: number; name?: string | null }[]
  escala: number
  onFim: () => void
}) {
  const [passos] = useState(() => passosDoSorteio(sorteio.tokens.length, sorteio.tokens.indexOf(sorteio.vencedor)))
  const [atual, setAtual] = useState(0)

  useEffect(() => {
    let i = 0
    let t = 0
    const andar = () => {
      if (i >= passos.length - 1) {
        t = window.setTimeout(onFim, TEMPO_PARADA)
        return
      }
      t = window.setTimeout(() => {
        i += 1
        setAtual(i)
        andar()
      }, passos[i].ms)
    }
    andar()
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passos])

  const passo = passos[atual]
  const alvo = tokens.find((o) => o.id === sorteio.tokens[passo.indice])
  if (!alvo) return null
  const parou = atual === passos.length - 1
  return (
    <div
      className={`mesa-sorteio${parou ? ' parou' : ''}`}
      style={{ left: alvo.x + alvo.width / 2, top: alvo.y, transitionDuration: `${Math.min(passo.ms, 220)}ms`, ['--escala' as string]: String(1 / escala) }}
      aria-live="polite"
    >
      <FontAwesomeIcon icon={faArrowDown} className="mesa-sorteio-seta" />
      {parou && alvo.name && <span className="mesa-sorteio-nome">{alvo.name}</span>}
    </div>
  )
}
