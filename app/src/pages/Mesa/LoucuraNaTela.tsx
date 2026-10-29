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

// ---- Vulto: aparição de manto e capuz parada no escuro da borda, observando ----
// Estilo da referência da Millie (28/10): pano escuro meio transparente, rosto oco no capuz,
// a barra se desfazendo em fumaça.

type Vulto = { id: number; x: number; alt: number; lado: 'esquerda' | 'direita' | 'fundo'; vira: number }

function novoVulto(id: number): Vulto {
  const sorteio = Math.random()
  const lado = sorteio < 0.4 ? 'esquerda' : sorteio < 0.8 ? 'direita' : 'fundo'
  const x = lado === 'esquerda' ? 4 + Math.random() * 10 : lado === 'direita' ? 86 + Math.random() * 10 : 25 + Math.random() * 50
  return { id, x, lado, alt: lado === 'fundo' ? 28 + Math.random() * 10 : 44 + Math.random() * 18, vira: Math.random() < 0.5 ? 1 : -1 }
}

// Manto: capuz em cima, ombros caídos e o pano abrindo até embaixo.
const MANTO = 'M100 10C84 10 74 22 71 42C69 58 66 70 58 82C46 98 36 118 30 150C24 186 18 230 12 280C8 312 4 340 2 360L14 346L22 366L34 344L46 370L58 348L72 372L86 350L100 374L114 350L128 372L142 348L154 370L166 344L178 366L186 346L198 360C196 340 192 312 188 280C182 230 176 186 170 150C164 118 154 98 142 82C134 70 131 58 129 42C126 22 116 10 100 10Z'
// Abertura do capuz (o rosto que não tem nada dentro).
const CAPUZ = 'M100 26C88 26 81 38 81 54C81 72 89 88 100 92C111 88 119 72 119 54C119 38 112 26 100 26Z'
// Dobras do pano, de cima pra baixo.
const DOBRAS = [
  'M88 92C70 170 48 260 26 350',
  'M93 96C82 180 70 270 56 356',
  'M97 98C94 190 88 280 84 360',
  'M103 98C106 190 112 280 116 360',
  'M107 96C118 180 130 270 144 356',
  'M112 92C130 170 152 260 174 350',
  'M76 86C58 150 38 230 16 320',
  'M124 86C142 150 162 230 184 320',
]

function VultoNoEscuro({ v }: { v: Vulto }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <span className={`loucura-vulto ${v.lado}`} style={{ left: `${v.x}%`, height: `${v.alt}vh` }}>
      <svg viewBox="0 0 200 380" preserveAspectRatio="xMidYMax meet" style={{ transform: `scaleX(${v.vira})` }}>
        <defs>
          {/* Pano rasgado: o ruído entorta as bordas e mexe devagar, como se tivesse vento. */}
          <filter id={`pano${id}`} x="-20%" y="-10%" width="140%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03 0.07" numOctaves="3" seed="3" result="ruido">
              <animate attributeName="baseFrequency" dur="9s" values="0.03 0.07;0.036 0.08;0.03 0.07" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="ruido" scale="18" xChannelSelector="R" yChannelSelector="G" result="torto" />
            <feGaussianBlur in="torto" stdDeviation="1.2" />
          </filter>
          <filter id={`fumaca${id}`} x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="9" result="ruido">
              <animate attributeName="baseFrequency" dur="7s" values="0.035;0.045;0.035" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="ruido" scale="40" xChannelSelector="R" yChannelSelector="G" result="torto" />
            <feGaussianBlur in="torto" stdDeviation="5" />
          </filter>
          <clipPath id={`dentro${id}`}>
            <path d={MANTO} />
          </clipPath>
          <filter id={`macio${id}`}>
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <linearGradient id={`tecido${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d0d10" stopOpacity="0.96" />
            <stop offset="0.3" stopColor="#1c1c22" stopOpacity="0.88" />
            <stop offset="0.65" stopColor="#2b2b33" stopOpacity="0.62" />
            <stop offset="1" stopColor="#3a3a43" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id={`rosto${id}`} cx="50%" cy="45%" r="55%">
            <stop offset="0" stopColor="#000" />
            <stop offset="0.7" stopColor="#020103" />
            <stop offset="1" stopColor="#0b0a10" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`some${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.6" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <mask id={`mascara${id}`}>
            <rect x="-40" y="-20" width="280" height="420" fill={`url(#some${id})`} />
          </mask>
        </defs>
        <g mask={`url(#mascara${id})`}>
          {/* Fumaça escura na barra do manto. */}
          <g filter={`url(#fumaca${id})`} className="loucura-vulto-fumaca">
            <ellipse cx="60" cy="335" rx="50" ry="26" />
            <ellipse cx="140" cy="338" rx="52" ry="24" />
            <ellipse cx="100" cy="320" rx="70" ry="30" />
          </g>
          <g filter={`url(#pano${id})`}>
            <path d={MANTO} fill={`url(#tecido${id})`} />
          </g>
          {/* Dobras retas do pano (fora do filtro que rasga, senão tremem). */}
          <g clipPath={`url(#dentro${id})`} filter={`url(#macio${id})`}>
            {DOBRAS.map((d, n) => <path key={n} d={d} className={n % 2 ? 'loucura-vulto-dobra' : 'loucura-vulto-dobra clara'} />)}
          </g>
          <g filter={`url(#pano${id})`}>
            <path d={CAPUZ} className="loucura-vulto-beirada" />
            <path d={CAPUZ} fill={`url(#rosto${id})`} />
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

// Moldura de sangue da referência da Millie (28/10): o meio é transparente. Com pouca ferida ela fica
// grande (só a beirada aparece) e meio apagada; perto do zero fecha na tela inteira, igual à imagem.
const MOLDURA_SANGUE = '/efeitos/visao-ferida.webp'

export function FerimentoNaTela({ ferimento }: { ferimento: Ferimento }) {
  const i = Math.max(0, Math.min(1, ferimento.intensidade))
  // Vai fechando aos poucos (Millie 28/10: "tem que ir ficando gradualmente"): na metade da vida mal
  // aparece, só perto do zero chega no máximo.
  const forca = Math.pow(i, 1.3)
  // Coração mais rápido quanto pior.
  const batida = (1.7 - 0.8 * i).toFixed(2)
  return (
    <div className={`ferida${ferimento.desmaiado ? ' desmaiado' : ''}`} aria-hidden>
      <div className="ferida-lente" style={{ opacity: (0.1 + 0.6 * forca).toFixed(2) }} />
      <div
        className="ferida-moldura"
        style={{
          backgroundImage: `url(${MOLDURA_SANGUE})`,
          opacity: (0.15 + 0.85 * forca).toFixed(2),
          ['--zoom' as string]: (1.5 - 0.5 * forca).toFixed(3),
          animationDuration: `${batida}s`,
        }}
      />
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
