import { useEffect, useState } from 'react'
import { lerInterface } from './configuracoes'

// O mapa com a SAN baixa (KAN-116): vai pelo filtro do palco (derrete e perde a cor).
export function filtroDaLoucura(i: number): string {
  return `url(#loucura-derreter) saturate(${(1 - 0.65 * i).toFixed(2)}) contrast(${(1 + 0.2 * i).toFixed(2)}) brightness(${(1 - 0.15 * i).toFixed(2)})`
}

// Sombras que rastejam das bordas pra dentro: lado, posição (%), atraso e duração (s).
const SOMBRAS: { lado: 'cima' | 'baixo' | 'esquerda' | 'direita'; pos: number; atraso: number; dur: number; tam: number }[] = [
  { lado: 'esquerda', pos: 22, atraso: 0, dur: 7, tam: 1 },
  { lado: 'direita', pos: 64, atraso: 1.2, dur: 8, tam: 1.1 },
  { lado: 'baixo', pos: 30, atraso: 2.5, dur: 6.5, tam: 0.9 },
  { lado: 'cima', pos: 72, atraso: 0.6, dur: 9, tam: 1 },
  { lado: 'esquerda', pos: 70, atraso: 3.1, dur: 7.5, tam: 1.2 },
  { lado: 'direita', pos: 18, atraso: 4, dur: 6, tam: 0.8 },
  { lado: 'baixo', pos: 78, atraso: 1.8, dur: 8.5, tam: 1.1 },
  { lado: 'cima', pos: 25, atraso: 3.6, dur: 7, tam: 0.9 },
  { lado: 'esquerda', pos: 46, atraso: 5, dur: 9, tam: 0.8 },
  { lado: 'direita', pos: 42, atraso: 2.2, dur: 7.2, tam: 1.3 },
  { lado: 'baixo', pos: 55, atraso: 4.4, dur: 6.8, tam: 1 },
  { lado: 'cima', pos: 48, atraso: 5.5, dur: 8, tam: 1.1 },
]

const GIRO = { esquerda: 0, cima: 90, direita: 180, baixo: 270 }

// Um tentáculo de sombra (sai da borda, à esquerda do desenho).
const TENTACULO = 'M0 26C30 14 62 40 104 24C132 13 156 30 176 20C190 13 198 18 200 17C194 26 180 33 160 33C128 35 108 50 70 44C42 40 20 50 0 52Z'

type Olho = { id: number; x: number; y: number }

// Olhos piscando nos cantos (SAN bem baixa): de tempos em tempos um some e outro aparece.
function novoOlho(id: number): Olho {
  const borda = Math.random()
  const longe = () => (Math.random() < 0.5 ? 4 + Math.random() * 14 : 82 + Math.random() * 14)
  return borda < 0.5 ? { id, x: longe(), y: 8 + Math.random() * 84 } : { id, x: 8 + Math.random() * 84, y: longe() }
}

function Olhos({ quantos }: { quantos: number }) {
  const [olhos, setOlhos] = useState<Olho[]>(() => Array.from({ length: quantos }, (_, i) => novoOlho(i)))
  useEffect(() => {
    let n = quantos
    const t = window.setInterval(() => {
      setOlhos((l) => {
        const fora = Math.floor(Math.random() * l.length)
        return [...l.filter((_, i) => i !== fora), novoOlho(n++)].slice(-quantos)
      })
    }, 2600)
    return () => window.clearInterval(t)
  }, [quantos])
  return (
    <>
      {olhos.map((o) => (
        <span key={o.id} className="loucura-olhos" style={{ left: `${o.x}%`, top: `${o.y}%` }}>
          <i />
          <i />
        </span>
      ))}
    </>
  )
}

// Por cima do mapa (não pega nos painéis): bordas escuras, sombras rastejando e, zerada, olhos e o
// coração batendo. O derreter em si é o filtro "loucura-derreter", que fica aqui também.
export default function LoucuraNaTela({ intensidade }: { intensidade: number }) {
  const i = Math.max(0, Math.min(1, intensidade))
  const escala = Math.round(5 + 40 * i)
  const sombras = i < 0.3 ? 0 : Math.round(4 + 8 * i)
  return (
    <div className={`loucura${i >= 1 ? ' enlouquecendo' : ''}`} aria-hidden>
      <svg className="loucura-defs" width="0" height="0">
        <filter id="loucura-derreter" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          {/* Ruído esticado na vertical: o mapa escorre e ondula, devagar. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.016" numOctaves="2" seed="7" result="ruido">
            <animate attributeName="baseFrequency" dur="13s" values="0.004 0.016;0.0055 0.024;0.003 0.012;0.004 0.016" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale={escala} xChannelSelector="R" yChannelSelector="G">
            <animate attributeName="scale" dur="5s" values={`${escala * 0.55};${escala};${escala * 0.55}`} repeatCount="indefinite" />
          </feDisplacementMap>
        </filter>
      </svg>
      <div
        className="loucura-vinheta"
        style={{ background: `radial-gradient(ellipse at center, transparent ${Math.round(58 - 30 * i)}%, rgba(8, 2, 12, ${(0.35 + 0.55 * i).toFixed(2)}) 100%)` }}
      />
      {SOMBRAS.slice(0, sombras).map((s, n) => {
        const horizontal = s.lado === 'esquerda' || s.lado === 'direita'
        const pos = horizontal
          ? { top: `${s.pos}%`, [s.lado === 'esquerda' ? 'left' : 'right']: 0 }
          : { left: `${s.pos}%`, [s.lado === 'cima' ? 'top' : 'bottom']: 0 }
        return (
          <div key={n} className="loucura-sombra" style={{ ...pos, ['--giro' as string]: `${GIRO[s.lado]}deg`, ['--tam' as string]: String(s.tam * (0.7 + 0.5 * i)) }}>
            <svg viewBox="0 0 200 70" style={{ animationDelay: `-${s.atraso}s`, animationDuration: `${s.dur}s` }}>
              <path d={TENTACULO} />
            </svg>
          </div>
        )
      })}
      {i >= 0.5 && <Olhos quantos={i >= 1 ? 4 : 2} />}
    </div>
  )
}

// A pessoa pode desligar nas Configurações da Interface (muda na hora).
export function useLoucuraLigada(): boolean {
  const [ligada, setLigada] = useState(() => lerInterface().loucura)
  useEffect(() => {
    const ouvir = () => setLigada(lerInterface().loucura)
    window.addEventListener('arkanis-interface', ouvir)
    return () => window.removeEventListener('arkanis-interface', ouvir)
  }, [])
  return ligada
}
