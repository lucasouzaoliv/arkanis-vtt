// Regras puras de Cenas / Mapas (KAN-48, spec 12.5).

export type TipoGrade = 'quadrado' | 'sem' | 'hexagono'
export type EstiloGrade = 'solida' | 'tracejada' | 'pontilhada'
export type Clima = 'folhas' | 'chuva' | 'tempestade' | 'nevoa' | 'neve' | 'nebulosa' | 'fumaca'
export type Visibilidade = 'mestre' | 'todos' | 'jogadores'

export type Cena = {
  id: string
  campaign_id: string
  folder_id: string | null
  name: string
  sort: number
  show_in_nav: boolean
  visibility: Visibilidade
  visible_to: string[]
  background_url: string | null
  background_color: string
  grid_type: TipoGrade
  grid_size: number
  // Quantos quadrados na largura e na altura (a grade cobre a imagem inteira). Sem eles, vale grid_size.
  grid_colunas: number | null
  grid_linhas: number | null
  grid_distance: number
  grid_units: string
  grid_style: EstiloGrade
  grid_thickness: number
  grid_color: string
  grid_opacity: number
  darkness: number
  weather: Clima | null
  // Cor do efeito climático (chuva de sangue…); vazio = a cor normal dele.
  weather_cor: string | null
  // Filtro de iluminação: uma cor por cima do mapa inteiro (vazio = sem filtro).
  filtro_cor: string | null
  filtro_intensidade: number
  luminosity: number
  saturation: number
  shadows: number
  created_at: string
}

export type Pasta = {
  id: string
  campaign_id: string
  parent_id: string | null
  name: string
  color: string | null
  sort_mode: 'alfabetica' | 'manual'
  sort: number
  created_at: string
}

export const CLIMAS: { id: Clima; rotulo: string }[] = [
  { id: 'folhas', rotulo: 'Folhas de Outono' },
  { id: 'chuva', rotulo: 'Chuva' },
  { id: 'tempestade', rotulo: 'Tempestade' },
  { id: 'nevoa', rotulo: 'Névoa' },
  { id: 'neve', rotulo: 'Neve' },
  { id: 'nebulosa', rotulo: 'Nebulosa' },
  { id: 'fumaca', rotulo: 'Fumaça (lua de sangue)' },
]

// Cor de partida de cada efeito (o mestre troca).
export const COR_PADRAO_CLIMA: Record<Clima, string | null> = {
  folhas: null, chuva: '#c8d2e1', tempestade: '#c8d2e1', nevoa: '#d7dae1', neve: '#ffffff', nebulosa: '#d7dae1', fumaca: '#a3121c',
}

// #rrggbb → 'r, g, b' (o canvas usa assim).
export function rgbDe(hex: string | null | undefined): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '')
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : null
}

// Campos que o editor da cena altera (o resto é identidade da linha).
export const CAMPOS_EDITAVEIS = [
  'name', 'folder_id', 'show_in_nav', 'visibility', 'visible_to', 'background_url', 'background_color',
  'grid_type', 'grid_size', 'grid_colunas', 'grid_linhas', 'grid_distance', 'grid_units', 'grid_style', 'grid_thickness', 'grid_color', 'grid_opacity',
  'darkness', 'weather', 'weather_cor', 'filtro_cor', 'filtro_intensidade', 'luminosity', 'saturation', 'shadows',
] as const

export type CamposCena = Pick<Cena, (typeof CAMPOS_EDITAVEIS)[number]>

export function camposDaCena(c: Cena): CamposCena {
  return Object.fromEntries(CAMPOS_EDITAVEIS.map((k) => [k, c[k]])) as CamposCena
}

// Cópia pro "Duplicar": mesmos campos, nome com "(cópia)".
export function copiaDaCena(c: Cena): CamposCena & { campaign_id: string } {
  return { ...camposDaCena(c), campaign_id: c.campaign_id, name: `${c.name} (cópia)` }
}

// Itens que moram em pastas (cenas, personagens…).
export type ItemDePasta = { id: string; folder_id: string | null; name: string; sort: number; created_at: string }

export type NoPasta<T extends ItemDePasta = Cena> = { pasta: Pasta; pastas: NoPasta<T>[]; cenas: T[] }
export type Arvore<T extends ItemDePasta = Cena> = { pastas: NoPasta<T>[]; cenas: T[] }

const porNome = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
const porOrdem = (a: { sort: number; created_at: string }, b: { sort: number; created_at: string }) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)

function normalizar(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Pastas e subpastas com as cenas dentro, na ordem de cada pasta (alfabética ou manual).
// Com busca, só ficam as cenas que batem e as pastas que levam até elas.
export function montarArvore<T extends ItemDePasta = Cena>(pastas: Pasta[], cenas: T[], busca = '', ordemRaiz: 'alfabetica' | 'manual' = 'alfabetica'): Arvore<T> {
  const termo = normalizar(busca.trim())
  const bate = (c: T) => !termo || normalizar(c.name).includes(termo)
  const ids = new Set(pastas.map((p) => p.id))

  function no(p: Pasta, visitadas: Set<string>): NoPasta<T> | null {
    if (visitadas.has(p.id)) return null
    const dentro = new Set(visitadas).add(p.id)
    const ordem = p.sort_mode === 'manual' ? porOrdem : porNome
    const filhas = pastas.filter((f) => f.parent_id === p.id).sort(ordem).map((f) => no(f, dentro)).filter((n): n is NoPasta<T> => n !== null)
    const suas = cenas.filter((c) => c.folder_id === p.id && bate(c)).sort(ordem)
    if (termo && !suas.length && !filhas.length) return null
    return { pasta: p, pastas: filhas, cenas: suas }
  }

  const ordem = ordemRaiz === 'manual' ? porOrdem : porNome
  return {
    // Pasta cuja mãe sumiu sobe pra raiz.
    pastas: pastas.filter((p) => !p.parent_id || !ids.has(p.parent_id)).sort(ordem).map((p) => no(p, new Set())).filter((n): n is NoPasta<T> => n !== null),
    cenas: cenas.filter((c) => (!c.folder_id || !ids.has(c.folder_id)) && bate(c)).sort(ordem),
  }
}

// Pastas em lista achatada com recuo, pro seletor "Pasta" do Criar Cena.
export function pastasEmLista(pastas: Pasta[]): { id: string; rotulo: string }[] {
  const saida: { id: string; rotulo: string }[] = []
  const visitar = (pai: string | null, nivel: number, vistas: Set<string>) => {
    for (const p of pastas.filter((x) => x.parent_id === pai).sort(porNome)) {
      if (vistas.has(p.id)) continue
      saida.push({ id: p.id, rotulo: `${'— '.repeat(nivel)}${p.name}` })
      visitar(p.id, nivel + 1, new Set(vistas).add(p.id))
    }
  }
  visitar(null, 0, new Set())
  return saida
}

// ---- Vista do mapa: deslocamento e zoom ----

export type Vista = { x: number; y: number; escala: number }

export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 5

// A imagem se ajusta à tela inteira, centralizada (12.5: "se ajusta ao tamanho geral da tela").
export function ajustarVista(larguraMapa: number, alturaMapa: number, larguraTela: number, alturaTela: number): Vista {
  if (larguraMapa <= 0 || alturaMapa <= 0 || larguraTela <= 0 || alturaTela <= 0) return { x: 0, y: 0, escala: 1 }
  const escala = Math.min(larguraTela / larguraMapa, alturaTela / alturaMapa)
  return { x: (larguraTela - larguraMapa * escala) / 2, y: (alturaTela - alturaMapa * escala) / 2, escala }
}

// Zoom mantendo parado o ponto debaixo do mouse.
export function zoomEm(v: Vista, fator: number, px: number, py: number): Vista {
  const escala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.escala * fator))
  const real = escala / v.escala
  return { escala, x: px - (px - v.x) * real, y: py - (py - v.y) * real }
}

// ---- Ambiente (12.5): luminosidade e saturação de -1 a 1, sombras de 0 a 1 ----

export function filtroAmbiente(luminosidade: number, saturacao: number, sombras: number): string {
  const partes: string[] = []
  if (luminosidade) partes.push(`brightness(${round(1 + luminosidade * 0.8)})`)
  if (saturacao) partes.push(`saturate(${round(1 + saturacao)})`)
  // Sombras: escurece mais o que já é escuro (contraste pra cima, um pouco menos de brilho).
  if (sombras) partes.push(`contrast(${round(1 + sombras * 0.7)})`, `brightness(${round(1 - sombras * 0.25)})`)
  return partes.join(' ') || 'none'
}

function round(n: number) {
  return Math.round(n * 1000) / 1000
}

// ---- Grade ----

export function tracoDaGrade(estilo: EstiloGrade, espessura: number): string | undefined {
  if (estilo === 'tracejada') return `${espessura * 6} ${espessura * 4}`
  if (estilo === 'pontilhada') return `${espessura} ${espessura * 3}`
  return undefined
}

// Hexágonos "de ponta pra cima" com largura = tamanho da grade. Devolve o tamanho do
// ladrilho que se repete e o desenho de um ladrilho (que encaixa sem buracos).
export function ladrilhoHex(tamanho: number): { largura: number; altura: number; caminho: string } {
  const w = tamanho
  const r = w / Math.sqrt(3) // raio (centro até a ponta)
  const h = r * 2
  const altura = h * 1.5 // duas fileiras, a segunda deslocada meia largura
  const p = (x: number, y: number) => `${round(x)},${round(y)}`
  const hex = (cx: number, cy: number) => {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2
      return p(cx + r * Math.cos(a), cy + r * Math.sin(a))
    })
    return `M${pts.join('L')}Z`
  }
  return { largura: w, altura: round(altura), caminho: [hex(w / 2, r), hex(0, r * 2.5), hex(w, r * 2.5)].join(' ') }
}

// Distância em quadrados → texto na unidade da cena (12.5, Medidas).
export function distanciaEmUnidades(quadrados: number, c: Pick<Cena, 'grid_distance' | 'grid_units'>): string {
  const valor = Math.round(quadrados * c.grid_distance * 10) / 10
  return `${valor.toLocaleString('pt-BR')} ${c.grid_units}`
}

// ---- Imagem arrastada pra mesa (12.2: drag-and-drop universal) ----

const EXTENSAO_IMAGEM = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i

// O que veio no arrasto: um arquivo do computador, ou o endereço da imagem de outra aba.
// Imagem dentro de link (Google Imagens, Pinterest…) manda o link da página no
// text/uri-list; o endereço da imagem de verdade vem no <img> do text/html.
export function imagemDoArrasto(dados: { arquivos: File[]; html: string; uris: string }): File | string | null {
  const arquivo = dados.arquivos.find((f) => f.type.startsWith('image/'))
  if (arquivo) return arquivo
  const src = /<img[^>]+src=["']([^"']+)["']/i.exec(dados.html)?.[1]?.replace(/&amp;/g, '&')
  if (src && /^(https?:|data:image\/)/i.test(src)) return src
  const uri = dados.uris.split(/\r?\n/).map((l) => l.trim()).find((l) => /^https?:\/\//i.test(l) && !l.startsWith('#'))
  return uri && EXTENSAO_IMAGEM.test(uri) ? uri : null
}

// ---- Objetos por cima do mapa ----

export type Camada = 'mapa' | 'token' | 'mestre'

export type ObjetoCena = {
  id: string
  scene_id: string
  campaign_id: string
  name: string | null
  image_url: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  layer: Camada
  sort: number
  locked: boolean
  flip_h: boolean
  flip_v: boolean
  character_id: string | null
  group_id: string | null
  actor_id: string | null
  move_permission: 'dono' | 'todos' | 'jogadores'
  movable_by: string[]
  luz?: boolean // Luz Ambiente (12.6): clareia o que está embaixo
  lanterna?: 'comum' | 'uv' | null // lanterna do token, ligada (pedido da Millie, 05/10)
  lanterna_estado?: 'falhando' | 'sem_bateria' | null // bateria: pisca ou apagou (KAN-114, 27/10)
  nota?: string | null // anotação do mestre presa no mapa (KAN-123): mostra o bilhete no lugar da imagem
  so_uv?: boolean // pros jogadores, só aparece na luz UV
  lanterna_ajuste?: { ox: number; oy: number; angulo: number } | null // Configurar Lanterna (seta)
  item_id?: string | null // item interativo que este token/objeto representa (KAN-53)
  luz_ajuste?: Partial<import('./luz').LuzAmbiente> | null // Luz Ambiente: raio, cor, intensidade, animação
  efeito?: Partial<import('./efeitos').Efeito> | null // efeito animado: fogo, água, nuvem, veneno…
  created_at: string
}

// Ponto da tela (relativo ao palco) → ponto do mapa.
export function telaParaMapa(px: number, py: number, v: Vista): { x: number; y: number } {
  return { x: (px - v.x) / v.escala, y: (py - v.y) / v.escala }
}

// Tamanho com que a imagem solta entra: o natural, mas no máximo 40% do mapa.
export function tamanhoInicial(largura: number, altura: number, mapaW: number, mapaH: number): { width: number; height: number } {
  if (largura <= 0 || altura <= 0) return { width: 200, height: 200 }
  const k = Math.min(1, (mapaW * 0.4) / largura, (mapaH * 0.4) / altura)
  return { width: Math.round(largura * k), height: Math.round(altura * k) }
}

// Redimensionar pelo canto mantendo a proporção (12.8: não estica nem distorce).
export function redimensionarProporcional(o: Pick<ObjetoCena, 'width' | 'height'>, dx: number, dy: number, minimo = 10): { width: number; height: number } {
  const razao = o.width / o.height
  const largura = Math.max(minimo, Math.abs(dx) > Math.abs(dy * razao) ? o.width + dx : o.width + dy * razao)
  return { width: Math.round(largura), height: Math.round(largura / razao) }
}

// Tamanho de um quadrado da grade no mapa. Com colunas e linhas, a grade cobre a imagem inteira
// (o quadrado pode ficar um tiquinho retangular se a imagem não bater certinho); sem, é o
// tamanho em pixels de antes.
export function celulaDaGrade(c: Pick<Cena, 'grid_size' | 'grid_colunas' | 'grid_linhas'>, mapa: { w: number; h: number }): { w: number; h: number } {
  if (c.grid_colunas && c.grid_linhas) return { w: mapa.w / c.grid_colunas, h: mapa.h / c.grid_linhas }
  return { w: c.grid_size, h: c.grid_size }
}

// Quantas linhas pra os quadrados ficarem o mais quadrados possível com essas colunas.
export function linhasSugeridas(colunas: number, mapa: { w: number; h: number }): number {
  if (colunas <= 0 || mapa.w <= 0) return 1
  return Math.max(1, Math.round(mapa.h / (mapa.w / colunas)))
}

// Colunas que dão o tamanho de quadrado antigo (pra abrir uma cena antiga já com números certos).
export function colunasDoTamanho(tamanho: number, mapa: { w: number }): number {
  return Math.max(1, Math.round(mapa.w / Math.max(1, tamanho)))
}
