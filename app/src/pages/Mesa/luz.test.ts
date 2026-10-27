import { describe, expect, it } from 'vitest'
import { ajusteDaSeta, setaNoAlcance, caminhoDaLuzUv, coneDaLanterna, conesDosTokens, lanternaNoMapa, luzDoObjeto, luzesDoAmbiente, temLuzAmbiente } from './luz'

const token = { id: 't', x: 0, y: 0, width: 100, height: 100, rotation: 0, layer: 'token' as const }
const celula = { w: 100, h: 100 }

describe('lanterna', () => {
  it('sai do peito do token pra frente (direita da imagem)', () => {
    const c = coneDaLanterna(token, 'comum', celula, 2)
    expect(c.pontos[0]).toEqual({ x: 50, y: 35 })
    expect(c.raio).toBe(500)
    // ponto do meio do arco: reto pra direita
    expect(c.pontos[2]).toEqual({ x: 550, y: 35 })
  })
  it('virar na horizontal vira a lanterna', () => {
    const c = coneDaLanterna({ ...token, flip_h: true }, 'comum', celula, 2)
    expect(c.pontos[2]).toEqual({ x: -450, y: 35 })
  })
  it('gira junto com o token', () => {
    const c = coneDaLanterna({ ...token, rotation: 90 }, 'comum', celula, 2)
    // girado 90° no sentido horário: a frente aponta pra baixo e o peito fica à direita do centro
    expect(c.pontos[0]).toEqual({ x: 65, y: 50 })
    expect(c.pontos[2]).toEqual({ x: 65, y: 550 })
  })
  it('a UV alcança menos', () => {
    expect(coneDaLanterna(token, 'uv', celula).raio).toBeLessThan(coneDaLanterna(token, 'comum', celula).raio)
  })
  it('só tokens com lanterna; token escondido não ilumina pros jogadores', () => {
    const lista = [
      { ...token, id: 'a', lanterna: 'comum' as const },
      { ...token, id: 'b', lanterna: null },
      { ...token, id: 'c', lanterna: 'uv' as const, layer: 'mestre' as const },
      { ...token, id: 'd', lanterna: 'uv' as const, layer: 'mapa' as const },
    ]
    expect(conesDosTokens(lista, celula, false).map((c) => c.id)).toEqual(['a'])
    expect(conesDosTokens(lista, celula, true).map((c) => c.id)).toEqual(['a', 'c'])
  })
  it('revelação só com luz UV', () => {
    const comum = conesDosTokens([{ ...token, lanterna: 'comum' as const }], celula, false)
    expect(caminhoDaLuzUv(comum)).toBeNull()
    const uv = conesDosTokens([{ ...token, lanterna: 'uv' as const }], celula, false)
    expect(caminhoDaLuzUv(uv)).toMatch(/^M50 35L/)
  })
  it('Configurar Lanterna: a seta vira o ajuste e volta pro mesmo lugar', () => {
    const o = { ...token, x: 200, y: 100, rotation: 30, flip_h: true }
    const a = ajusteDaSeta(o, { x: 230, y: 120 }, { x: 330, y: 220 })
    const l = lanternaNoMapa({ ...o, lanterna_ajuste: a })
    expect(l.x).toBeCloseTo(230, 0)
    expect(l.y).toBeCloseTo(120, 0)
    expect(((l.angulo * 180) / Math.PI + 360) % 360).toBeCloseTo(45, 0)
  })
  it('o comprimento da seta é o tamanho da luz (acompanha o tamanho do token)', () => {
    const a = ajusteDaSeta(token, { x: 50, y: 50 }, { x: 350, y: 50 })
    expect(a.alcance).toBe(3)
    expect(coneDaLanterna({ ...token, lanterna_ajuste: a }, 'comum', celula).raio).toBe(300)
    expect(coneDaLanterna({ ...token, height: 200, lanterna_ajuste: a }, 'comum', celula).raio).toBe(600)
    expect(coneDaLanterna({ ...token, lanterna_ajuste: a }, 'uv', celula).raio).toBe(240)
  })
  it('o ajuste acompanha quando o token vira na horizontal', () => {
    // lanterna na mão da direita, apontando pra direita
    const a = ajusteDaSeta(token, { x: 80, y: 50 }, { x: 180, y: 50 })
    expect(a).toEqual({ ox: 0.8, oy: 0.5, angulo: 0, alcance: 1 })
    const virado = lanternaNoMapa({ ...token, flip_h: true, lanterna_ajuste: a })
    expect(virado.x).toBeCloseTo(20)
    expect(Math.cos(virado.angulo)).toBeCloseTo(-1)
  })
})

describe('Luz Ambiente', () => {
  const objeto = { id: 'l', x: 0, y: 0, width: 100, height: 100, rotation: 0, layer: 'mapa' as const }
  it('a da aba Luzes acende sozinha; as outras só se o mestre acendeu', () => {
    expect(temLuzAmbiente({ ...objeto, luz: true })).toBe(true)
    expect(temLuzAmbiente(objeto)).toBe(false)
    expect(temLuzAmbiente({ ...objeto, luz_ajuste: { ligada: true } })).toBe(true)
    expect(temLuzAmbiente({ ...objeto, luz: true, luz_ajuste: { ligada: false } })).toBe(false)
  })
  it('raio em quadrados, ou metade do objeto; círculo em volta toda', () => {
    const sem = luzDoObjeto({ ...objeto, luz: true }, celula)
    expect(sem.raio).toBe(50)
    expect(sem.cx).toBe(50)
    const com = luzDoObjeto({ ...objeto, luz_ajuste: { raio: 3, intensidade: 0.5, cor: '#ff0000' } }, celula)
    expect(com.raio).toBe(300)
    expect(com.forca).toBe(0.5)
    expect(com.cor).toBe('#ff0000')
    expect(com.pontos.every((p) => Math.abs(Math.hypot(p.x - 50, p.y - 50) - 300) < 0.2)).toBe(true)
  })
  it('cone parado aponta pra direção e gira com o objeto', () => {
    const c = luzDoObjeto({ ...objeto, rotation: 90, luz_ajuste: { raio: 1, angulo: 10, direcao: 0 } }, celula)
    expect(c.pontos[0]).toEqual({ x: 50, y: 50 })
    const meio = c.pontos[Math.floor(c.pontos.length / 2)]
    expect(meio.y).toBeGreaterThan(140) // virou pra baixo
  })
  it('a da camada do mestre os jogadores não veem', () => {
    const l = { ...objeto, layer: 'mestre' as const, luz: true }
    expect(luzesDoAmbiente([l], celula, false)).toHaveLength(0)
    expect(luzesDoAmbiente([l], celula, true)).toHaveLength(1)
  })
})

describe('medir a lanterna (27/10)', () => {
  it('a luz anda de quadrado em quadrado e mostra os metros', () => {
    const r = setaNoAlcance({ x: 0, y: 0 }, { x: 580, y: 0 }, 'comum', celula, 1.5)
    expect(r).toEqual({ b: { x: 600, y: 0 }, quadrados: 6, metros: 9 })
    const o = { ...token, x: -50, y: -50 }
    const c = coneDaLanterna({ ...o, lanterna_ajuste: ajusteDaSeta(o, { x: 0, y: 0 }, r.b) }, 'comum', celula)
    expect(c.raio).toBeCloseTo(600)
  })
  it('a UV conta a luz dela (vai menos que a seta) e no mínimo 1 quadrado', () => {
    const r = setaNoAlcance({ x: 0, y: 0 }, { x: 0, y: 500 }, 'uv', celula, 1.5)
    expect(r.quadrados).toBe(4)
    expect(r.b.y).toBeCloseTo(500)
    expect(setaNoAlcance({ x: 0, y: 0 }, { x: 10, y: 0 }, 'comum', celula, 1.5).quadrados).toBe(1)
  })
})
