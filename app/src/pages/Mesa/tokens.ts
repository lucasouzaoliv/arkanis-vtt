// Regras puras dos tokens/objetos no mapa (KAN-49, spec 12.8 e 12.13).
import type { ObjetoCena } from './cenas'

export type Caixa = Pick<ObjetoCena, 'x' | 'y' | 'width' | 'height'>

// Uma das 8 alças: hx/hy = -1 (esquerda/cima), 0 (meio) ou 1 (direita/baixo).
export type Alca = { hx: -1 | 0 | 1; hy: -1 | 0 | 1 }

export const ALCAS: Alca[] = [
  { hx: -1, hy: -1 }, { hx: 0, hy: -1 }, { hx: 1, hy: -1 },
  { hx: -1, hy: 0 }, { hx: 1, hy: 0 },
  { hx: -1, hy: 1 }, { hx: 0, hy: 1 }, { hx: 1, hy: 1 },
]

// Redimensiona pela alça sempre proporcional (12.8: não estica nem distorce), com o lado
// oposto parado no lugar.
export function redimensionarPorAlca(o: Caixa, a: Alca, dx: number, dy: number, minimo = 10): Caixa {
  const razao = o.width / o.height
  const pelaLargura = a.hx !== 0 ? o.width + a.hx * dx : null
  const pelaAltura = a.hy !== 0 ? (o.height + a.hy * dy) * razao : null
  let largura: number
  if (pelaLargura !== null && pelaAltura !== null) largura = Math.abs(pelaLargura - o.width) >= Math.abs(pelaAltura - o.width) ? pelaLargura : pelaAltura
  else largura = (pelaLargura ?? pelaAltura) as number
  largura = Math.max(minimo, largura)
  const altura = largura / razao
  const x = a.hx === -1 ? o.x + o.width - largura : a.hx === 0 ? o.x + (o.width - largura) / 2 : o.x
  const y = a.hy === -1 ? o.y + o.height - altura : a.hy === 0 ? o.y + (o.height - altura) / 2 : o.y
  return { x: Math.round(x), y: Math.round(y), width: Math.round(largura), height: Math.round(altura) }
}

// Ângulo (graus, 0 = pra cima, sentido horário) do centro do objeto até o ponto.
// Com Shift, encaixa de 15 em 15 graus.
export function anguloAte(o: Caixa, px: number, py: number, encaixar = false): number {
  const cx = o.x + o.width / 2
  const cy = o.y + o.height / 2
  let graus = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90
  graus = ((graus % 360) + 360) % 360
  if (encaixar) graus = (Math.round(graus / 15) * 15) % 360
  return Math.round(graus * 10) / 10
}

// ---- Vários selecionados de uma vez (pedido 18/10): mudar tamanho e girar o grupo ----

// Caixa que cobre todos (sem contar o giro de cada um).
export function caixaDoGrupo(os: Caixa[]): Caixa {
  const x0 = Math.min(...os.map((o) => o.x))
  const y0 = Math.min(...os.map((o) => o.y))
  const x1 = Math.max(...os.map((o) => o.x + o.width))
  const y1 = Math.max(...os.map((o) => o.y + o.height))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

// A caixa do grupo mudou de tamanho (proporcional): cada um cresce/encolhe junto e mantém o
// lugar dentro do grupo.
export function escalarGrupo<T extends Caixa & { id: string }>(os: T[], antes: Caixa, depois: Caixa): Record<string, Caixa> {
  const s = antes.width ? depois.width / antes.width : 1
  return Object.fromEntries(os.map((o) => [o.id, {
    x: Math.round(depois.x + (o.x - antes.x) * s),
    y: Math.round(depois.y + (o.y - antes.y) * s),
    width: Math.max(5, Math.round(o.width * s)),
    height: Math.max(5, Math.round(o.height * s)),
  }]))
}

// Gira o grupo em volta do centro: cada um anda em volta do centro e gira o mesmo tanto.
export function girarGrupo<T extends Caixa & { id: string; rotation: number }>(os: T[], centro: { x: number; y: number }, graus: number): Record<string, Caixa & { rotation: number }> {
  const r = (graus * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return Object.fromEntries(os.map((o) => {
    const cx = o.x + o.width / 2 - centro.x
    const cy = o.y + o.height / 2 - centro.y
    const nx = centro.x + cx * cos - cy * sin
    const ny = centro.y + cx * sin + cy * cos
    const rotation = Math.round(((((o.rotation + graus) % 360) + 360) % 360) * 10) / 10
    return [o.id, { x: Math.round(nx - o.width / 2) + 0, y: Math.round(ny - o.height / 2) + 0, width: o.width, height: o.height, rotation }]
  }))
}

// Setas do teclado andam um quadrado da grade.
export function deslocamentoDaTecla(tecla: string, passo: number): { dx: number; dy: number } | null {
  switch (tecla) {
    case 'ArrowUp': return { dx: 0, dy: -passo }
    case 'ArrowDown': return { dx: 0, dy: passo }
    case 'ArrowLeft': return { dx: -passo, dy: 0 }
    case 'ArrowRight': return { dx: passo, dy: 0 }
    default: return null
  }
}

// Trazer para a Frente / Enviar para Trás: passa de todos os outros da mesma camada.
export function ordemParaFrente(objetos: Pick<ObjetoCena, 'id' | 'sort'>[], ids: string[]): Record<string, number> {
  const outros = objetos.filter((o) => !ids.includes(o.id)).map((o) => o.sort)
  const base = outros.length ? Math.max(...outros) + 1 : 0
  return Object.fromEntries(ids.map((id, i) => [id, base + i]))
}

export function ordemParaTras(objetos: Pick<ObjetoCena, 'id' | 'sort'>[], ids: string[]): Record<string, number> {
  const outros = objetos.filter((o) => !ids.includes(o.id)).map((o) => o.sort)
  const base = outros.length ? Math.min(...outros) - ids.length : 0
  return Object.fromEntries(ids.map((id, i) => [id, base + i]))
}

// Ids que se movem juntos: os escolhidos e quem estiver no mesmo grupo deles.
export function comGrupo(objetos: Pick<ObjetoCena, 'id'>[] & { group_id?: string | null }[], ids: string[]): string[] {
  const lista = objetos as { id: string; group_id?: string | null }[]
  const grupos = new Set(lista.filter((o) => ids.includes(o.id) && o.group_id).map((o) => o.group_id as string))
  return lista.filter((o) => ids.includes(o.id) || (o.group_id && grupos.has(o.group_id))).map((o) => o.id)
}

// ---- Desfazer / Refazer (12.8) ----

export type CamposObjeto = Partial<Omit<ObjetoCena, 'id' | 'scene_id' | 'campaign_id' | 'created_at'>> & { group_id?: string | null }

export type Passo =
  | { tipo: 'alterar'; antes: Record<string, CamposObjeto>; depois: Record<string, CamposObjeto> }
  | { tipo: 'criar'; objetos: ObjetoCena[] }
  | { tipo: 'excluir'; objetos: ObjetoCena[] }

export type Historico = { passos: Passo[]; posicao: number }

export const HISTORICO_VAZIO: Historico = { passos: [], posicao: 0 }

const LIMITE = 50

export function registrar(h: Historico, passo: Passo): Historico {
  const passos = [...h.passos.slice(0, h.posicao), passo].slice(-LIMITE)
  return { passos, posicao: passos.length }
}

// O que fazer pra desfazer o último passo (o inverso dele).
export function desfazer(h: Historico): { historico: Historico; aplicar: Passo } | null {
  if (h.posicao === 0) return null
  const p = h.passos[h.posicao - 1]
  const inverso: Passo =
    p.tipo === 'alterar' ? { tipo: 'alterar', antes: p.depois, depois: p.antes }
    : p.tipo === 'criar' ? { tipo: 'excluir', objetos: p.objetos }
    : { tipo: 'criar', objetos: p.objetos }
  return { historico: { ...h, posicao: h.posicao - 1 }, aplicar: inverso }
}

export function refazer(h: Historico): { historico: Historico; aplicar: Passo } | null {
  if (h.posicao >= h.passos.length) return null
  return { historico: { ...h, posicao: h.posicao + 1 }, aplicar: h.passos[h.posicao] }
}

// Pega só os campos que vão mudar, pro "antes" do desfazer.
export function camposAtuais(o: ObjetoCena & { group_id?: string | null }, campos: CamposObjeto): CamposObjeto {
  return Object.fromEntries(Object.keys(campos).map((k) => [k, (o as Record<string, unknown>)[k]])) as CamposObjeto
}

// Caixa de seleção (12.13: clique+arraste seleciona): pega o que encosta na caixa.
export function tocaNaCaixa(o: Caixa, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y, b.y)
  return o.x < x1 && o.x + o.width > x0 && o.y < y1 && o.y + o.height > y0
}
