// Ordem Paranormal 2 (playtest): o motor de dados. Nada aqui vem do OP1 — não existe d20 no teste.
// Regras do Playtest Alpha v1.1 e do Playtest Beta (onde divergem, vale o Beta). Como o playtest
// muda, os números ficam nas constantes do topo.

export type Dado = 4 | 6 | 8 | 10 | 12 | 20

// A escada de passos. O d20 só aparece em efeito paranormal raro (fora dos playtests).
export const PASSOS: Dado[] = [4, 6, 8, 10, 12]
export const DT_PADRAO = 7
export const MAX_ROLADOS = 4
export const MAX_SOMADOS = 3
export const VALOR_MINIMO_DO_CRITICO = 6

// Sobe (n > 0) ou desce (n < 0) o dado n passos, sem passar do d12 nem do d4.
export function passo(d: Dado, n: number): Dado {
  if (d === 20) return n < 0 ? PASSOS[Math.max(0, PASSOS.length + n)] : 20
  const i = PASSOS.indexOf(d)
  return PASSOS[Math.min(PASSOS.length - 1, Math.max(0, i + n))]
}

// Quantos passos acima (ou abaixo) de um dado de referência. Ex.: d10 contra o d6 base = 2.
export function passosAte(base: Dado, d: Dado): number {
  return PASSOS.indexOf(d) - PASSOS.indexOf(base)
}

export function ehDado(n: unknown): n is Dado {
  return n === 4 || n === 6 || n === 8 || n === 10 || n === 12 || n === 20
}

export type DadoRolado = {
  lados: Dado
  valor: number
  origem: 'atributo' | 'pericia' | 'bonus' | 'pavor'
  // Anulado pelo dado de pavor (resultado menor que o do pavor).
  anulado?: boolean
  // Entrou na soma (no máximo 3).
  somado?: boolean
}

export type Teste = {
  atributo: Dado
  pericia?: Dado
  bonus?: Dado[]
  // Dado de pavor: não soma, anula os resultados menores que ele.
  pavor?: Dado | null
  // "Abraçando o pavor": o dado de pavor vira dado bônus.
  pavorComoBonus?: boolean
  dt?: number
}

export type ResultadoDoTeste = {
  dados: DadoRolado[]
  pavor: DadoRolado | null
  total: number
  // Rolagem alta e baixa: o maior e o menor valor que saiu (entre os que valem).
  ra: number
  rb: number
  // Soma das duas maiores (o que o crítico usa no ataque e no teste estendido, no Beta).
  duasMaiores: number
  sucessoCritico: boolean
  falhaCritica: boolean
  // Saiu 1 no dado de pavor: o efeito de medo termina.
  venceuOPavor: boolean
  dt: number
  sucesso: boolean
}

const rolarUm = (lados: Dado, rnd: () => number) => 1 + Math.floor(rnd() * lados)

// Rola um teste: atributo + perícia (+ bônus), no máximo 4 dados rolados e 3 somados (os maiores).
export function rolarTeste(t: Teste, rnd: () => number = Math.random): ResultadoDoTeste {
  const pedidos: { lados: Dado; origem: DadoRolado['origem'] }[] = [
    { lados: t.atributo, origem: 'atributo' as const },
    ...(t.pericia ? [{ lados: t.pericia, origem: 'pericia' as const }] : []),
    ...(t.bonus ?? []).map((lados) => ({ lados, origem: 'bonus' as const })),
    ...(t.pavor && t.pavorComoBonus ? [{ lados: t.pavor, origem: 'bonus' as const }] : []),
  ].slice(0, MAX_ROLADOS)
  const dados: DadoRolado[] = pedidos.map((p) => ({ ...p, valor: rolarUm(p.lados, rnd) }))
  const pavor: DadoRolado | null = t.pavor && !t.pavorComoBonus ? { lados: t.pavor, origem: 'pavor', valor: rolarUm(t.pavor, rnd) } : null
  return avaliarTeste(dados, pavor, t.dt ?? DT_PADRAO)
}

// A conta, separada da sorte (pra testar e pra refazer com dados já rolados).
export function avaliarTeste(dadosRolados: DadoRolado[], pavor: DadoRolado | null, dt = DT_PADRAO): ResultadoDoTeste {
  const dados = dadosRolados.map((d) => ({ ...d, anulado: !!pavor && d.valor < pavor.valor, somado: false }))
  const validos = dados.filter((d) => !d.anulado)
  const ordenados = [...validos].sort((a, b) => b.valor - a.valor)
  for (const d of ordenados.slice(0, MAX_SOMADOS)) d.somado = true
  const total = ordenados.slice(0, MAX_SOMADOS).reduce((s, d) => s + d.valor, 0)
  const valores = validos.map((d) => d.valor)
  const ra = valores.length ? Math.max(...valores) : 0
  const rb = valores.length ? Math.min(...valores) : 0
  const duasMaiores = ordenados.slice(0, 2).reduce((s, d) => s + d.valor, 0)
  // Crítico: dois ou mais dados com o mesmo valor, de 6 pra cima.
  const repetidos = valores.filter((v, i) => v >= VALOR_MINIMO_DO_CRITICO && valores.indexOf(v) !== i)
  // Falha crítica: todos os dados deram 1, ou o pavor anulou todos.
  const falhaCritica = !validos.length || dados.every((d) => d.valor === 1)
  const sucessoCritico = !falhaCritica && repetidos.length > 0
  return {
    dados,
    pavor,
    total,
    ra,
    rb,
    duasMaiores,
    sucessoCritico,
    falhaCritica,
    venceuOPavor: pavor?.valor === 1,
    dt,
    sucesso: sucessoCritico || (!falhaCritica && total >= dt),
  }
}

// Dano de um ataque: RA + modificador da arma; no crítico, as duas maiores (Beta).
export function danoDoAtaque(r: Pick<ResultadoDoTeste, 'ra' | 'duasMaiores' | 'sucessoCritico'>, modificador: number): number {
  return Math.max(0, (r.sucessoCritico ? r.duasMaiores : r.ra) + modificador)
}

// Teste de lesão/trauma e de morte: DT 7, +3 por teste do mesmo tipo já feito na cena.
export function dtCrescente(jaFeitos: number, base = DT_PADRAO, passoDaDt = 3): number {
  return base + Math.max(0, jaFeitos) * passoDaDt
}

// Tabela de falha crítica (o mestre escolhe ou rola 1d8).
export const FALHA_CRITICA_1D8 = [
  { rolagem: 1, nome: 'Vexame', efeito: 'Descreve a ação de forma vergonhosa; sem efeito em regras.' },
  { rolagem: 2, nome: 'Machucado', efeito: 'Físico cai um passo até o fim da cena.' },
  { rolagem: 3, nome: 'Desatenção', efeito: 'Mente cai um passo até o fim da cena.' },
  { rolagem: 4, nome: 'Irritação', efeito: 'Emoção cai um passo até o fim da cena.' },
  { rolagem: 5, nome: 'Acidente', efeito: 'Perde 1d4 PV.' },
  { rolagem: 6, nome: 'Frustração', efeito: 'Perde 1d4 PD.' },
  { rolagem: 7, nome: 'Perda', efeito: 'Um item carregado ou espaço de compra disponível se perde.' },
  { rolagem: 8, nome: 'Nada', efeito: 'Nenhum efeito adicional.' },
]
