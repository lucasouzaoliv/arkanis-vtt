// Lanterna e escuridão (pedido da Millie, 05/10): regras puras, testadas.
import type { ObjetoCena } from './cenas'

export type Lanterna = 'comum' | 'uv'

export const LANTERNAS: { id: Lanterna; rotulo: string }[] = [
  { id: 'comum', rotulo: 'Lanterna Comum' },
  { id: 'uv', rotulo: 'Lanterna UV' },
]

// Alcance (em quadrados da grade) e abertura (graus) do cone. Não precisa ser grande.
// força = quanto ela clareia a escuridão (a UV, luz negra, clareia menos).
export const FORMA_DA_LANTERNA: Record<Lanterna, { alcance: number; abertura: number; forca: number }> = {
  comum: { alcance: 5, abertura: 60, forca: 1 },
  uv: { alcance: 4, abertura: 50, forca: 0.6 },
}

// Um foco de luz já no mapa: lanterna (cone) ou Luz Ambiente (círculo ou cone parado).
//   forca: quanto apaga a escuridão (0..1); forte: parte do raio com luz cheia; cor: do brilho.
export type Cone = {
  id: string
  tipo: Lanterna | 'ambiente'
  cx: number
  cy: number
  raio: number
  pontos: { x: number; y: number }[]
  forca: number
  forte: number
  cor: string
  brilho: number // opacidade do brilho por cima
  animacao?: AnimacaoLuz
}

export const COR_DA_LANTERNA: Record<Lanterna, string> = { comum: '#ffe9b8', uv: '#9b4dff' }

// Onde a lanterna está no desenho do token e pra onde aponta (Configurar Lanterna: a pessoa
// desenha uma seta). Guardado no desenho, antes de virar e girar, então acompanha o token.
//   ox/oy: fração da largura/altura a partir do canto de cima à esquerda
//   angulo: graus, 0 = pra direita da imagem, sentido horário
//   alcance: comprimento da seta = até onde a luz vai, em alturas do token (acompanha se o token
//   for redimensionado; cada mapa tem uma escala, então quem decide o tamanho é a pessoa)
export type AjusteLanterna = { ox: number; oy: number; angulo: number; alcance?: number }

// A UV vai um pouco menos longe que a comum, com a mesma seta.
const ALCANCE_RELATIVO: Record<Lanterna, number> = { comum: 1, uv: 0.8 }

// Sem configurar: os tokens são de corpo inteiro, de lado, olhando pra direita; a luz sai da
// altura do peito/mão, pra frente.
export const AJUSTE_PADRAO: AjusteLanterna = { ox: 0.5, oy: 0.35, angulo: 0 }

type TokenDaLanterna = Pick<ObjetoCena, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation'> & {
  flip_h?: boolean
  flip_v?: boolean
  lanterna_ajuste?: AjusteLanterna | null
}

const RAD = Math.PI / 180

// Ajuste (no desenho do token) → ponto e ângulo no mapa.
export function lanternaNoMapa(o: TokenDaLanterna): { x: number; y: number; angulo: number } {
  const a = o.lanterna_ajuste ?? AJUSTE_PADRAO
  const giro = o.rotation * RAD
  let lx = (a.ox - 0.5) * o.width
  let ly = (a.oy - 0.5) * o.height
  let ang = a.angulo * RAD
  if (o.flip_h) { lx = -lx; ang = Math.PI - ang }
  if (o.flip_v) { ly = -ly; ang = -ang }
  return {
    x: o.x + o.width / 2 + lx * Math.cos(giro) - ly * Math.sin(giro),
    y: o.y + o.height / 2 + lx * Math.sin(giro) + ly * Math.cos(giro),
    angulo: ang + giro,
  }
}

// Seta desenhada no mapa (de → para) → ajuste no desenho do token.
export function ajusteDaSeta(o: TokenDaLanterna, de: { x: number; y: number }, para: { x: number; y: number }): AjusteLanterna {
  const giro = o.rotation * RAD
  const vx = de.x - (o.x + o.width / 2)
  const vy = de.y - (o.y + o.height / 2)
  let lx = vx * Math.cos(giro) + vy * Math.sin(giro)
  let ly = -vx * Math.sin(giro) + vy * Math.cos(giro)
  let ang = Math.atan2(para.y - de.y, para.x - de.x) - giro
  if (o.flip_h) { lx = -lx; ang = Math.PI - ang }
  if (o.flip_v) { ly = -ly; ang = -ang }
  const graus = ((((ang / RAD) % 360) + 360) % 360)
  const r3 = (n: number) => Math.round(n * 1000) / 1000
  const comprimento = Math.hypot(para.x - de.x, para.y - de.y)
  return { ox: r3(lx / o.width + 0.5), oy: r3(ly / o.height + 0.5), angulo: Math.round(graus * 10) / 10, alcance: r3(comprimento / o.height) }
}

export function coneDaLanterna(o: TokenDaLanterna, tipo: Lanterna, celula: { w: number; h: number }, passos = 16): Cone {
  const { alcance, abertura } = FORMA_DA_LANTERNA[tipo]
  const l = lanternaNoMapa(o)
  const cx = arred(l.x)
  const cy = arred(l.y)
  const ajustado = o.lanterna_ajuste?.alcance
  const raio = ajustado ? ajustado * o.height * ALCANCE_RELATIVO[tipo] : alcance * Math.max(celula.w, celula.h)
  const meia = (abertura / 2) * RAD
  const pontos = [{ x: cx, y: cy }]
  for (let i = 0; i <= passos; i++) {
    const a = l.angulo - meia + (2 * meia * i) / passos
    pontos.push({ x: arred(cx + Math.cos(a) * raio), y: arred(cy + Math.sin(a) * raio) })
  }
  return { id: o.id, tipo, cx, cy, raio, pontos, forca: FORMA_DA_LANTERNA[tipo].forca, forte: 0.6, cor: COR_DA_LANTERNA[tipo], brilho: 0.3 }
}

const arred = (n: number) => Math.round(n * 10) / 10

export function caminhoDoCone(c: Pick<Cone, 'pontos'>): string {
  return `M${c.pontos.map((p) => `${p.x} ${p.y}`).join('L')}Z`
}

// Os cones que valem: dos tokens com lanterna ligada que essa pessoa vê.
export function conesDosTokens(
  objetos: (TokenDaLanterna & Pick<ObjetoCena, 'layer'> & { lanterna?: Lanterna | null })[],
  celula: { w: number; h: number },
  souMestre: boolean,
): Cone[] {
  return objetos
    .filter((o) => o.lanterna && o.layer !== 'mapa' && (souMestre || o.layer !== 'mestre'))
    .map((o) => coneDaLanterna(o, o.lanterna as Lanterna, celula))
}

// O que o jogador vê de um objeto "só na luz UV": nada fora da luz UV.
export function caminhoDaLuzUv(cones: Cone[]): string | null {
  const uv = cones.filter((c) => c.tipo === 'uv')
  return uv.length ? uv.map(caminhoDoCone).join(' ') : null
}

// ---- Luz Ambiente (pedido da Millie, 06/10) ----
// Luz parada no mapa (lâmpada, poste, fogueira, vela): clareia a escuridão em volta, no mesmo
// sistema da lanterna. Guardada no objeto da cena (luz_ajuste).

export type AnimacaoLuz = 'nenhuma' | 'tremular' | 'pulsar'

export const ANIMACOES_LUZ: { id: AnimacaoLuz; rotulo: string }[] = [
  { id: 'nenhuma', rotulo: 'Nenhuma' },
  { id: 'tremular', rotulo: 'Tremular (fogo, vela)' },
  { id: 'pulsar', rotulo: 'Pulsar' },
]

export type LuzAmbiente = {
  ligada: boolean
  raio: number | null // em quadrados da grade; null = metade do tamanho do objeto
  forte: number // 0..1: parte do raio com luz cheia (o resto vai apagando)
  cor: string
  intensidade: number // 0..1
  angulo: number // abertura em graus (360 = em volta toda)
  direcao: number // graus, 0 = pra direita, sentido horário
  animacao: AnimacaoLuz
}

export const LUZ_PADRAO: LuzAmbiente = { ligada: true, raio: null, forte: 0.5, cor: '#ffd9a0', intensidade: 0.8, angulo: 360, direcao: 0, animacao: 'nenhuma' }

export function luzCompleta(l: Partial<LuzAmbiente> | null | undefined): LuzAmbiente {
  return { ...LUZ_PADRAO, ...(l ?? {}) }
}

type ObjetoComLuz = Pick<ObjetoCena, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'layer'> & {
  luz?: boolean
  luz_ajuste?: Partial<LuzAmbiente> | null
}

// O objeto acende? O da aba Luzes Ambientes já nasce aceso; os outros, só se o mestre acendeu.
export function temLuzAmbiente(o: ObjetoComLuz): boolean {
  return o.luz_ajuste ? luzCompleta(o.luz_ajuste).ligada : !!o.luz
}

export function luzDoObjeto(o: ObjetoComLuz, celula: { w: number; h: number }, passos = 48): Cone {
  const l = luzCompleta(o.luz_ajuste)
  const cx = arred(o.x + o.width / 2)
  const cy = arred(o.y + o.height / 2)
  const raio = l.raio != null && l.raio > 0 ? l.raio * Math.max(celula.w, celula.h) : Math.max(o.width, o.height) / 2
  const abertura = Math.min(360, Math.max(1, l.angulo))
  const pontos: { x: number; y: number }[] = []
  if (abertura >= 360) {
    for (let i = 0; i < passos; i++) {
      const a = (2 * Math.PI * i) / passos
      pontos.push({ x: arred(cx + Math.cos(a) * raio), y: arred(cy + Math.sin(a) * raio) })
    }
  } else {
    // Cone parado: gira junto com o objeto.
    const dir = (l.direcao + o.rotation) * RAD
    const meia = (abertura / 2) * RAD
    const n = Math.max(4, Math.round((passos * abertura) / 360))
    pontos.push({ x: cx, y: cy })
    for (let i = 0; i <= n; i++) {
      const a = dir - meia + (2 * meia * i) / n
      pontos.push({ x: arred(cx + Math.cos(a) * raio), y: arred(cy + Math.sin(a) * raio) })
    }
  }
  const k = Math.min(1, Math.max(0, l.intensidade))
  return {
    id: o.id, tipo: 'ambiente', cx, cy, raio: arred(raio), pontos,
    forca: k, forte: Math.min(0.95, Math.max(0, l.forte)), cor: l.cor, brilho: 0.35 * k, animacao: l.animacao,
  }
}

// As Luzes Ambientes acesas que essa pessoa vê (a da camada do mestre só o mestre).
export function luzesDoAmbiente(objetos: ObjetoComLuz[], celula: { w: number; h: number }, souMestre: boolean): Cone[] {
  return objetos.filter((o) => temLuzAmbiente(o) && (souMestre || o.layer !== 'mestre')).map((o) => luzDoObjeto(o, celula))
}

// Lâmpada que marca uma Luz Ambiente sem imagem (só o mestre vê; os jogadores só veem a luz).
export const IMAGEM_LUZ = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#1c1d24" fill-opacity="0.85" stroke="#ffd9a0" stroke-width="4"/><path d="M50 20a20 20 0 0 0-12 36c3 2.5 4 5 4 8h16c0-3 1-5.5 4-8a20 20 0 0 0-12-36z" fill="#ffd9a0"/><rect x="42" y="68" width="16" height="5" rx="2" fill="#ffd9a0"/><rect x="44" y="76" width="12" height="5" rx="2" fill="#ffd9a0"/></svg>')

// Medir a lanterna enquanto desenha a seta (pedido da Millie, 27/10): a luz anda de quadrado em
// quadrado da grade e mostra quantos metros alcança (no Ordem, a lanterna ilumina 9 m).
// Devolve a ponta da seta já encaixada e o alcance da luz em quadrados e em metros.
export function setaNoAlcance(a: { x: number; y: number }, b: { x: number; y: number }, tipo: Lanterna, celula: { w: number; h: number }, metrosPorQuadrado: number): { b: { x: number; y: number }; quadrados: number; metros: number } {
  const lado = Math.max(celula.w, celula.h)
  const comprimento = Math.hypot(b.x - a.x, b.y - a.y)
  const rel = ALCANCE_RELATIVO[tipo]
  const quadrados = Math.max(1, Math.round((comprimento * rel) / lado))
  const novo = (quadrados * lado) / rel
  const k = comprimento ? novo / comprimento : 0
  return {
    b: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k },
    quadrados,
    metros: Math.round(quadrados * metrosPorQuadrado * 10) / 10,
  }
}
