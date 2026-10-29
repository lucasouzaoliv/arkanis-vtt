import { useEffect, useId, useState } from 'react'
import { lerInterface } from './configuracoes'
import type { Ferimento, Loucura } from './sanidade'

// Filtro do mapa (só o mundo, não os painéis): a SAN tira a cor e escurece, do 3 pra baixo derrete;
// o machucado borra e, desmaiado, apaga quase tudo.
export function filtroDaVisao(l: Loucura, f: Ferimento): string | undefined {
  const partes: string[] = []
  if (l.ondulacao > 0) partes.push('url(#loucura-derreter)')
  if (l.intensidade > 0) {
    const i = l.intensidade
    partes.push(`saturate(${(1 - 0.65 * i).toFixed(2)}) contrast(${(1 + 0.2 * i).toFixed(2)}) brightness(${(1 - 0.25 * i).toFixed(2)})`)
  }
  if (f.desmaiado) partes.push('blur(6px) brightness(0.35)')
  else if (f.borrao > 0) partes.push(`blur(${f.borrao}px)`)
  return partes.length ? partes.join(' ') : undefined
}

// Sorteio que não muda entre renderizações (as manchas e as gotas ficam no mesmo lugar).
function sorteador(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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

// Troca de tempos em tempos: um some e outro aparece em outro lugar.
function useRodizio<T extends { id: number }>(quantos: number, novo: (id: number) => T, cada: number): T[] {
  const [lista, setLista] = useState<T[]>(() => Array.from({ length: quantos }, (_, i) => novo(i)))
  useEffect(() => {
    let n = 1000
    setLista((l) => (l.length === quantos ? l : Array.from({ length: quantos }, (_, i) => l[i] ?? novo(n++))))
    if (!quantos) return
    const t = window.setInterval(() => {
      setLista((l) => {
        const fora = Math.floor(Math.random() * l.length)
        return [...l.filter((_, i) => i !== fora), novo(n++)]
      })
    }, cada)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantos, cada])
  return lista
}

// ---- Vulto: silhueta de gente parada no escuro da borda, observando ----

type Vulto = { id: number; x: number; alt: number; lado: 'esquerda' | 'direita' | 'fundo'; vira: number }

function novoVulto(id: number): Vulto {
  const sorteio = Math.random()
  const lado = sorteio < 0.4 ? 'esquerda' : sorteio < 0.8 ? 'direita' : 'fundo'
  const x = lado === 'esquerda' ? 2 + Math.random() * 12 : lado === 'direita' ? 86 + Math.random() * 12 : 25 + Math.random() * 50
  return { id, x, lado, alt: lado === 'fundo' ? 26 + Math.random() * 10 : 46 + Math.random() * 22, vira: lado === 'esquerda' ? 1 : lado === 'direita' ? -1 : Math.random() < 0.5 ? 1 : -1 }
}

// Corpo comprido, ombros caídos, braços compridos demais pendurados. Os pés somem no escuro.
const CORPO = 'M50 47C43 47 41 52 40 57C28 61 21 69 19 82L13 148C11 172 11 196 9 222C8 228 10 232 12 226C15 200 17 174 21 150L27 106L30 162C30 212 33 258 35 300L65 300C67 258 70 212 70 162L73 106L79 150C83 174 85 200 88 226C90 232 92 228 91 222C89 196 89 172 87 148L81 82C79 69 72 61 60 57C59 52 57 47 50 47Z'

function VultoNoEscuro({ v }: { v: Vulto }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <span className={`loucura-vulto ${v.lado}`} style={{ left: `${v.x}%`, height: `${v.alt}vh` }}>
      <svg viewBox="0 0 100 300" preserveAspectRatio="xMidYMax meet" style={{ transform: `scaleX(${v.vira})` }}>
        <defs>
          <linearGradient id={`some${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <mask id={`mascara${id}`}>
            <rect width="100" height="300" fill={`url(#some${id})`} />
          </mask>
        </defs>
        <g mask={`url(#mascara${id})`}>
          <path d={CORPO} className="loucura-vulto-corpo" />
          <g className="loucura-vulto-cabeca">
            <ellipse cx="50" cy="30" rx="12.5" ry="16.5" className="loucura-vulto-corpo" />
          </g>
        </g>
      </svg>
    </span>
  )
}

function Vultos({ quantos }: { quantos: number }) {
  const vultos = useRodizio(quantos, novoVulto, 6500)
  return <>{vultos.map((v) => <VultoNoEscuro key={v.id} v={v} />)}</>
}

// Por cima do mapa (não pega nos painéis). Do 7 pra baixo: bordas escuras e sombras rastejando;
// do 5 pra baixo, vultos observando do escuro; do 3 pra baixo, o mapa derrete (o filtro mora aqui).
export default function LoucuraNaTela({ loucura }: { loucura: Loucura }) {
  const i = Math.max(0, Math.min(1, loucura.intensidade))
  const escala = Math.round(8 + 40 * loucura.ondulacao)
  const sombras = Math.round(3 + 9 * i)
  return (
    <div className={`loucura${loucura.coracao ? ' enlouquecendo' : ''}`} aria-hidden>
      {loucura.ondulacao > 0 && (
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
      )}
      <div
        className="loucura-vinheta"
        style={{ background: `radial-gradient(ellipse at center, transparent ${Math.round(55 - 30 * i)}%, rgba(8, 2, 12, ${(0.45 + 0.5 * i).toFixed(2)}) 100%)` }}
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
      {loucura.vultos > 0 && <Vultos quantos={loucura.vultos} />}
    </div>
  )
}

// ---- Machucado: a visão sangra e borra; desmaiado, quase tudo preto ----

type Mancha = { x: number; y: number; tam: number; giro: number; d: string; escorre: number }

// Mancha de sangue: um borrão irregular com respingos em volta.
function desenharMancha(r: () => number): string {
  const pontos = 14
  let d = ''
  for (let k = 0; k <= pontos; k++) {
    const a = (k / pontos) * Math.PI * 2
    const raio = 26 + r() * 14
    const x = 50 + Math.cos(a) * raio
    const y = 50 + Math.sin(a) * raio
    d += k === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : `L${x.toFixed(1)} ${y.toFixed(1)}`
  }
  d += 'Z'
  for (let k = 0; k < 7; k++) {
    const a = r() * Math.PI * 2
    const dist = 42 + r() * 10
    const raio = 1.5 + r() * 4
    const x = 50 + Math.cos(a) * dist
    const y = 50 + Math.sin(a) * dist
    d += `M${(x + raio).toFixed(1)} ${y.toFixed(1)}a${raio.toFixed(1)} ${raio.toFixed(1)} 0 1 0 ${(-2 * raio).toFixed(1)} 0a${raio.toFixed(1)} ${raio.toFixed(1)} 0 1 0 ${(2 * raio).toFixed(1)} 0Z`
  }
  return d
}

// Sempre nas bordas e nos cantos, nunca no meio da visão.
const MANCHAS: Mancha[] = (() => {
  const r = sorteador(29)
  return Array.from({ length: 9 }, () => {
    const canto = r() < 0.5
    const x = canto ? (r() < 0.5 ? r() * 14 : 86 + r() * 14) : 8 + r() * 84
    const y = canto ? 6 + r() * 88 : r() < 0.5 ? r() * 12 : 88 + r() * 12
    return { x, y, tam: 70 + r() * 110, giro: r() * 360, d: desenharMancha(r), escorre: 30 + r() * 80 }
  })
})()

export function FerimentoNaTela({ ferimento }: { ferimento: Ferimento }) {
  const i = Math.max(0, Math.min(1, ferimento.intensidade))
  // Coração mais rápido quanto pior.
  const batida = (1.7 - 0.8 * i).toFixed(2)
  return (
    <div className={`ferida${ferimento.desmaiado ? ' desmaiado' : ''}`} aria-hidden>
      <div
        className="ferida-vinheta"
        style={{
          background: `radial-gradient(ellipse at center, transparent ${Math.round(62 - 32 * i)}%, rgba(110, 0, 0, ${(0.3 + 0.45 * i).toFixed(2)}) 88%, rgba(40, 0, 0, ${(0.55 + 0.4 * i).toFixed(2)}) 100%)`,
          animationDuration: `${batida}s`,
        }}
      />
      {MANCHAS.slice(0, ferimento.pingos).map((m, n) => (
        <span key={n} className="ferida-mancha" style={{ left: `${m.x}%`, top: `${m.y}%`, width: m.tam, height: m.tam, animationDelay: `${n * 0.25}s` }}>
          <svg viewBox="0 0 100 100" style={{ transform: `rotate(${m.giro}deg)` }}>
            <path d={m.d} />
          </svg>
          <i style={{ height: m.escorre, animationDelay: `${n * 0.7}s` }} />
        </span>
      ))}
      {ferimento.desmaiado && <div className="ferida-desmaio" />}
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
