import { useEffect, useState } from 'react'
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

// Por cima do mapa (não pega nos painéis). Do 7 pra baixo: bordas escuras e sombras rastejando;
// do 3 pra baixo, o mapa derrete (o filtro mora aqui).
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
    </div>
  )
}

// ---- Machucado: a visão sangra e borra; desmaiado, quase tudo preto ----

// Sem borda vermelha (Millie 28/10, "ficou feio"): só a lente escurecendo as beiradas, batendo de leve
// com o coração, e a visão borrando (o borrão vai pelo filtro do mapa).
export function FerimentoNaTela({ ferimento }: { ferimento: Ferimento }) {
  const i = Math.max(0, Math.min(1, ferimento.intensidade))
  // Vai fechando aos poucos: na metade da vida mal aparece, só perto do zero chega no máximo.
  const forca = Math.pow(i, 1.3)
  // Coração mais rápido quanto pior.
  const batida = (1.7 - 0.8 * i).toFixed(2)
  return (
    <div className={`ferida${ferimento.desmaiado ? ' desmaiado' : ''}`} aria-hidden>
      <div
        className="ferida-lente"
        style={{
          background: `radial-gradient(ellipse at center, transparent ${Math.round(60 - 25 * forca)}%, rgba(6, 2, 3, ${(0.35 + 0.55 * forca).toFixed(2)}) 100%)`,
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
