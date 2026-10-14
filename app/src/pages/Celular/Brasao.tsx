import brasao from '../../assets/criacao/brasao-ordo-realitas.png'

// Brasão da Ordo Realitas pintado de verde (a imagem do projeto é escura; o app da Ordem é verde,
// como o logo que a Millie mandou em 14/10).
export function Brasao({ tamanho, className }: { tamanho: number; className?: string }) {
  return (
    <span
      className={`cel-brasao${className ? ` ${className}` : ''}`}
      style={{ width: tamanho, height: tamanho * 1.24, WebkitMaskImage: `url(${brasao})`, maskImage: `url(${brasao})` }}
      aria-hidden
    />
  )
}
