import { useEffect, useRef, useState } from 'react'
import { lerInterface } from './configuracoes'

// Visão do Oculto dentro da escuridão (pedido da Millie, 01/11): a pessoa vê através do Conhecimento.
// Borda dourada em volta da tela e sigilos que surgem, flutuam e somem nas beiradas e, mais transparentes
// pra não tampar o mapa, no meio da visão. Dá pra desligar nas Configurações da Interface.

const LETRAS = 'abcdefghijklmnopqrstuvwxyz'
const NAS_BEIRADAS = 10
const NO_MEIO = 4

type Sigilo = { id: number; meio: boolean; x: number; y: number; tam: number; letra: string; dur: number; atraso: number; giro: number }

function novoSigilo(id: number, atraso: number, meio: boolean): Sigilo {
  const r = Math.random
  const faixa = (a: number) => (r() < 0.5 ? a + r() * 7 : 100 - a - 4 - r() * 7)
  const beirada = r() < 0.5 ? { x: 6 + r() * 88, y: faixa(4) } : { x: faixa(2.5), y: 8 + r() * 84 }
  const pos = meio ? { x: 20 + r() * 58, y: 18 + r() * 58 } : beirada
  return { id, meio, ...pos, tam: meio ? 56 + r() * 44 : 32 + r() * 26, letra: LETRAS[Math.floor(r() * LETRAS.length)], dur: 5 + r() * 4, atraso, giro: r() * 30 - 15 }
}

export default function VisaoDoOcultoNaTela() {
  const [sigilos, setSigilos] = useState<Sigilo[]>(() => Array.from({ length: NAS_BEIRADAS + NO_MEIO }, (_, i) => novoSigilo(i, i * 0.5, i >= NAS_BEIRADAS)))
  const proximo = useRef(NAS_BEIRADAS + NO_MEIO)
  return (
    <div className="oculto" aria-hidden>
      <div className="oculto-borda" />
      {sigilos.map((s) => (
        <span
          key={s.id}
          className={`oculto-sigilo${s.meio ? ' meio' : ''}`}
          style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: s.tam, rotate: `${s.giro}deg`, animationDuration: `${s.dur}s`, animationDelay: `${s.atraso}s` }}
          onAnimationEnd={() => setSigilos((l) => l.map((x) => (x.id === s.id ? novoSigilo(proximo.current++, Math.random(), x.meio) : x)))}
        >
          {s.letra}
        </span>
      ))}
    </div>
  )
}

// A pessoa pode desligar nas Configurações da Interface (muda na hora).
export function useVisaoDoOcultoLigada(): boolean {
  const [ligada, setLigada] = useState(() => lerInterface().visaoOculto)
  useEffect(() => {
    const ouvir = () => setLigada(lerInterface().visaoOculto)
    window.addEventListener('arkanis-interface', ouvir)
    return () => window.removeEventListener('arkanis-interface', ouvir)
  }, [])
  return ligada
}
