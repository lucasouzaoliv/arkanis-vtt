import { useEffect, useRef, useState } from 'react'
import { lerInterface } from './configuracoes'

// Visão do Oculto dentro da escuridão (pedido da Millie, 01/11): só um detalhe de imersão, sem poluir.
// Borda dourada fina nas beiradas da tela e poucos sigilos de Conhecimento que surgem, flutuam e somem
// perto das bordas, nunca no meio da visão. Dá pra desligar nas Configurações da Interface.

const LETRAS = 'abcdefghijklmnopqrstuvwxyz'
const QUANTOS = 6

type Sigilo = { id: number; x: number; y: number; tam: number; letra: string; dur: number; atraso: number; giro: number }

function novoSigilo(id: number, atraso: number): Sigilo {
  const r = Math.random
  const faixa = (a: number) => (r() < 0.5 ? a + r() * 7 : 100 - a - r() * 7)
  const pos = r() < 0.5 ? { x: 6 + r() * 88, y: faixa(4) } : { x: faixa(2.5), y: 8 + r() * 84 }
  return { id, ...pos, tam: 16 + r() * 14, letra: LETRAS[Math.floor(r() * LETRAS.length)], dur: 7 + r() * 5, atraso, giro: r() * 30 - 15 }
}

export default function VisaoDoOcultoNaTela() {
  const [sigilos, setSigilos] = useState<Sigilo[]>(() => Array.from({ length: QUANTOS }, (_, i) => novoSigilo(i, i * 1.7)))
  const proximo = useRef(QUANTOS)
  return (
    <div className="oculto" aria-hidden>
      <div className="oculto-borda" />
      {sigilos.map((s) => (
        <span
          key={s.id}
          className="oculto-sigilo"
          style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: s.tam, rotate: `${s.giro}deg`, animationDuration: `${s.dur}s`, animationDelay: `${s.atraso}s` }}
          onAnimationEnd={() => setSigilos((l) => l.map((x) => (x.id === s.id ? novoSigilo(proximo.current++, Math.random() * 3) : x)))}
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
