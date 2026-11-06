import type { Dado } from '../../sistemas/op2/dados'

// Ícone do dado do OP2 (prints do site oficial): a forma diz o tipo — d4 triângulo, d6 quadrado,
// d8 losango, d10 e d12 polígonos — e a cor escurece conforme o dado cresce, na cor do tema.
// pavor: o dado de pavor é cinza.

const poligono = (lados: number, r: number, giro = -90) =>
  Array.from({ length: lados }, (_, i) => {
    const a = ((giro + (360 / lados) * i) * Math.PI) / 180
    return `${(20 + r * Math.cos(a)).toFixed(2)},${(20 + r * Math.sin(a)).toFixed(2)}`
  }).join(' ')

const FORMA: Record<Dado, { tipo: 'polygon' | 'rect'; pontos?: string; textoY: number }> = {
  4: { tipo: 'polygon', pontos: '20,3 37.5,35 2.5,35', textoY: 25.5 },
  6: { tipo: 'rect', textoY: 21 },
  8: { tipo: 'polygon', pontos: '20,1.5 38.5,20 20,38.5 1.5,20', textoY: 21 },
  10: { tipo: 'polygon', pontos: poligono(10, 18.5), textoY: 21 },
  12: { tipo: 'polygon', pontos: poligono(12, 18.5, -75), textoY: 21 },
  20: { tipo: 'polygon', pontos: poligono(6, 18.5), textoY: 21 },
}

export default function DadoIcone({ lados, tamanho = 22, pavor = false, numero, className, titulo }: {
  lados: Dado
  tamanho?: number
  pavor?: boolean
  // O que vai escrito dentro (padrão: o número de lados).
  numero?: number | string
  className?: string
  titulo?: string
}) {
  const f = FORMA[lados]
  const classe = `op2-dado op2-dado-${lados}${pavor ? ' op2-dado-pavor' : ''}${className ? ` ${className}` : ''}`
  return (
    <svg className={classe} width={tamanho} height={tamanho} viewBox="0 0 40 40" role="img" aria-label={titulo ?? `d${lados}`}>
      {titulo && <title>{titulo}</title>}
      {f.tipo === 'rect' ? <rect x="4" y="4" width="32" height="32" rx="5" /> : <polygon points={f.pontos} strokeLinejoin="round" />}
      <text x="20" y={f.textoY} dominantBaseline="middle" textAnchor="middle" fontSize={String(numero ?? lados).length > 1 ? (lados === 4 ? 12 : 15) : lados === 4 ? 15 : 19}>
        {numero ?? lados}
      </text>
    </svg>
  )
}
