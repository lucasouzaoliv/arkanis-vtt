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

// ---- Olho: abre no escuro da borda, injetado, pupila de fenda, olha pros lados e fecha ----

type Olho = { id: number; x: number; y: number; tam: number; giro: number }

function novoOlho(id: number): Olho {
  const perto = () => (Math.random() < 0.5 ? 6 + Math.random() * 12 : 82 + Math.random() * 12)
  const pos = Math.random() < 0.5 ? { x: perto(), y: 12 + Math.random() * 76 } : { x: 10 + Math.random() * 80, y: perto() }
  return { id, ...pos, tam: 90 + Math.random() * 70, giro: Math.random() * 24 - 12 }
}

// Veias saindo da borda do olho pro meio.
const VEIAS = [
  'M8 40 C22 36 30 42 44 37 C50 35 54 38 58 36',
  'M14 31 C26 30 32 24 46 28',
  'M16 50 C28 50 34 56 48 51 C52 50 55 52 58 50',
  'M152 40 C138 37 130 43 116 38 C110 36 106 39 102 37',
  'M146 30 C134 30 128 24 114 28',
  'M144 51 C132 51 126 57 112 52',
  'M40 22 C46 26 50 26 56 30',
  'M118 60 C112 56 108 57 102 52',
]

function OlhoNoEscuro({ o }: { o: Olho }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <span className="loucura-olho" style={{ left: `${o.x}%`, top: `${o.y}%`, width: o.tam, ['--giro' as string]: `${o.giro}deg` }}>
      <svg viewBox="0 0 160 80">
        <defs>
          <radialGradient id={`esc${id}`} cx="50%" cy="50%" r="60%">
            <stop offset="0" stopColor="#dccba0" />
            <stop offset="0.5" stopColor="#c99a7a" />
            <stop offset="0.8" stopColor="#7a1510" />
            <stop offset="1" stopColor="#2a0303" />
          </radialGradient>
          <radialGradient id={`iris${id}`}>
            <stop offset="0" stopColor="#ff4a1c" />
            <stop offset="0.35" stopColor="#b3120c" />
            <stop offset="0.8" stopColor="#3a0202" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <clipPath id={`corte${id}`}>
            <path d="M4 40C40 2 120 2 156 40C120 78 40 78 4 40Z" />
          </clipPath>
        </defs>
        <g className="loucura-olho-palpebra">
          <path d="M4 40C40 2 120 2 156 40C120 78 40 78 4 40Z" fill={`url(#esc${id})`} />
          <g clipPath={`url(#corte${id})`}>
            {VEIAS.map((d, n) => <path key={n} d={d} className="loucura-olho-veia" />)}
            <g className="loucura-olho-iris">
              <circle cx="80" cy="40" r="23" fill={`url(#iris${id})`} />
              <ellipse cx="80" cy="40" rx="3.6" ry="18" className="loucura-olho-pupila" />
              <circle cx="73" cy="32" r="3" fill="#fff" opacity="0.55" />
            </g>
          </g>
          <path d="M4 40C40 2 120 2 156 40C120 78 40 78 4 40Z" className="loucura-olho-borda" />
        </g>
      </svg>
    </span>
  )
}

function Olhos({ quantos }: { quantos: number }) {
  const olhos = useRodizio(quantos, novoOlho, 3600)
  return <>{olhos.map((o) => <OlhoNoEscuro key={o.id} o={o} />)}</>
}

// ---- Sangue escorrendo do alto da tela ----

const GOTAS = (() => {
  const r = sorteador(13)
  return Array.from({ length: 16 }, (_, n) => ({
    x: Math.round((n / 16) * 100 + r() * 5),
    larg: 4 + Math.round(r() * 9),
    comp: 10 + Math.round(r() * 38),
    dur: 9 + r() * 10,
    atraso: r() * 14,
  }))
})()

// Borda de cima molhada, irregular (esticada na largura da tela).
const BORDA_SANGUE = (() => {
  const r = sorteador(5)
  let d = 'M0 0H1000V10'
  for (let x = 1000; x > 0; x -= 40) d += `C${x - 12} ${8 + r() * 14} ${x - 28} ${4 + r() * 16} ${x - 40} ${8 + r() * 12}`
  return d + 'Z'
})()

function Sangue({ forca }: { forca: number }) {
  const quantas = Math.round(6 + 10 * forca)
  return (
    <div className="loucura-sangue">
      <svg className="loucura-sangue-borda" viewBox="0 0 1000 30" preserveAspectRatio="none">
        <path d={BORDA_SANGUE} />
      </svg>
      {GOTAS.slice(0, quantas).map((g, n) => (
        <span
          key={n}
          className="loucura-gota"
          style={{ left: `${g.x}%`, width: g.larg, ['--comp' as string]: `${g.comp}vh`, animationDuration: `${g.dur}s`, animationDelay: `-${g.atraso}s` }}
        />
      ))}
    </div>
  )
}

// ---- Garras: três arranhões rasgando a tela, de surpresa ----

type Garra = { id: number; x: number; y: number; giro: number; tam: number }
const novaGarra = (id: number): Garra => ({ id, x: 12 + Math.random() * 76, y: 14 + Math.random() * 72, giro: -50 + Math.random() * 100, tam: 160 + Math.random() * 140 })

// Arranhão afinando nas pontas.
const RISCO = 'M0 14C40 6 120 2 200 10C130 9 60 12 0 14Z'

function Garras() {
  const garras = useRodizio(1, novaGarra, 4200)
  return (
    <>
      {garras.map((g) => (
        <span key={g.id} className="loucura-garra" style={{ left: `${g.x}%`, top: `${g.y}%`, width: g.tam, ['--giro' as string]: `${g.giro}deg` }}>
          {[0, 1, 2].map((n) => (
            <svg key={n} viewBox="0 0 200 20" style={{ top: n * 18, left: n * 8, width: `${100 - n * 8}%`, animationDelay: `${n * 0.05}s` }}>
              <path d={RISCO} className="loucura-garra-fundo" />
              <path d={RISCO} className="loucura-garra-carne" transform="translate(6 1) scale(0.94 0.8)" />
            </svg>
          ))}
        </span>
      ))}
    </>
  )
}

// Por cima do mapa (não pega nos painéis). Do 7 pra baixo: bordas escuras e sombras rastejando;
// depois o olho, o sangue escorrendo e, do 3 pra baixo, as garras e o derreter (o filtro mora aqui).
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
      {loucura.sangue && <Sangue forca={i} />}
      {loucura.olhos > 0 && <Olhos quantos={loucura.olhos} />}
      {loucura.garras && <Garras />}
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
