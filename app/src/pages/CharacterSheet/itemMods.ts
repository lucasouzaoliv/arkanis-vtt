import { periciasDoEfeito, textoDoEfeito, type EfeitoEscolhido } from './efeitosEscolhidos'
// Bonus numericos que uma modificacao ou maldicao aplica num item.
//
// O catalogo nao guarda esses bonus em coluna: eles estao escritos no texto do efeito
// ("+2 em margem de ameaca", "+1 no multiplicador de critico"). Entao a gente le do texto.
// Efeitos que nao sao numericos (Calibre Grosso, Compensador e afins) continuam valendo
// so como referencia escrita - nao da pra somar o que nao e numero.
//
// Este arquivo e a unica fonte desse calculo: a ficha e o envio pro combate usam ele, pra
// o numero que aparece no card ser o mesmo que vai rolar na mesa.

// efeitos: escolhidos na mão ao criar uma personalizada (efeitosEscolhidos.ts). Quando existem,
// valem eles e o texto do efeito fica só como descrição (senão contaria duas vezes).
export type AppliedModifier = { kind: 'modificacao' | 'maldicao'; name: string; effect: string; elemento: string | null; efeitos?: EfeitoEscolhido[]; proprio?: boolean }

// Maior "bônus em perícia sobe pra +N" das modificações/maldições do item (Aprimorado).
export function bonusDePericiaQueSobe(mods: AppliedModifier[] | null | undefined): number {
  let n = 0
  for (const m of mods ?? []) {
    const r = /per[ií]cia[^.;]*?(?:sobe|aumenta|passa)\s+(?:pra|para)\s*\+\s*(\d+)/i.exec(m.effect ?? '')
    if (r) n = Math.max(n, Number(r[1]))
  }
  return n
}

// Efeitos escolhidos no próprio item (Editar Item, pedido 11/10: Vestimenta/Utensílio com bônus numa
// perícia escolhida) entram nas contas como uma modificação embutida, marcada como "proprio":
// não aparece na lista de modificações nem sobe a categoria.
export function modsComEfeitosDoItem(stats: Record<string, unknown> | null | undefined, mods: AppliedModifier[] | null | undefined, nome?: string | null): AppliedModifier[] {
  let efeitos = Array.isArray(stats?.efeitos) ? (stats!.efeitos as EfeitoEscolhido[]).filter((e) => e && e.valor) : []
  if (!efeitos.length) return mods ?? []
  // "Aprimorado: Bônus em perícia sobe pra +5" (bug 11/10): não soma, troca. Os bônus de perícia do
  // próprio item passam a valer esse número (o +2 da Vestimenta vira +5).
  const sobe = bonusDePericiaQueSobe(mods)
  if (sobe) efeitos = efeitos.map((e) => (['pericia', 'resistencias', 'todos_testes'].includes(e.alvo) && e.modo === 'valor' && e.valor > 0 && e.valor < sobe ? { ...e, valor: sobe } : e))
  return [...(mods ?? []), { kind: 'modificacao', name: nome || 'item', effect: '', elemento: null, efeitos, proprio: true }]
}

export type ModBonuses = {
  attackTestBonus: number
  threatMarginDelta: number
  damageBonus: number
  multiplierDelta: number
  /** Dados extras de dano, do mesmo tipo (ex.: Calibre Grosso). */
  extraDamageDice: number
  /** Espaco que a modificacao acrescenta ou tira do item (ex.: Blindada, Discreta). */
  spacesDelta: number
  /** Defesa que a modificacao acrescenta a protecao (ex.: Reforcada, Repulsora). */
  defenseBonus: number
  /** Categorias de alcance a mais (ex.: Mira Telescopica, Predadora). */
  rangeSteps: number
  /** Linhas de dano inteiras que a modificacao acrescenta (ex.: "+2d6 de dano"). */
  extraDamageRolls: string[]
}

export function parseNumericMod(effect: string): ModBonuses {
  const result: ModBonuses = {
    attackTestBonus: 0, threatMarginDelta: 0, damageBonus: 0, multiplierDelta: 0,
    extraDamageDice: 0, spacesDelta: 0, defenseBonus: 0, rangeSteps: 0, extraDamageRolls: [],
  }
  // Margem de ameaca conta ao contrario: +2 de margem abaixa o numero de 19 pra 17,
  // porque o critico acontece a partir dele.
  const margem = effect.match(/([+-]?\d+)\s+em margem de ameaça/i)
  if (margem) result.threatMarginDelta -= Number(margem[1])
  const ataque = effect.match(/([+-]?\d+)\s+em testes de ataque/i)
  if (ataque) result.attackTestBonus += Number(ataque[1])
  // "+1 dado de dano" e outro dado da arma, nao um bonus fixo - tem que vir antes do
  // bonus fixo, senao o "+1" dele seria lido como +1 de dano.
  const dadoExtra = effect.match(/([+-]?\d+)\s+dados?\s+de\s+dano/i)
  if (dadoExtra) result.extraDamageDice += Number(dadoExtra[1])
  else {
    // O catalogo escreve "em rolagens de dano", mas modificacao escrita a mao sai como
    // "de dano", "no dano" ou "em dano" - todas valem a mesma coisa.
    const dano = effect.match(/([+-]?\d+)\s+(?:em rolagens de|em|no|de)\s+dano/i)
    if (dano) result.damageBonus += Number(dano[1])
  }
  const mult = effect.match(/([+-]?\d+)\s+no multiplicador de crítico/i)
  if (mult) result.multiplierDelta += Number(mult[1])

  // "espaço +1" / "espaço -1"
  const espaco = effect.match(/espaço\s*([+-]\s*\d+)/i)
  if (espaco) result.spacesDelta += Number(espaco[1].replace(/\s+/g, ''))

  // "Defesa +2" e "+2 Defesa" sao a mesma coisa escrita de dois jeitos
  const defesa = effect.match(/defesa\s*([+-]?\s*\d+)/i) ?? effect.match(/([+-]\s*\d+)\s+defesa/i)
  if (defesa) result.defenseBonus += Number(defesa[1].replace(/\s+/g, ''))

  // "+1 categoria de alcance"
  const alcance = effect.match(/([+-]?\d+)\s+categoria de alcance/i)
  if (alcance) result.rangeSteps += Number(alcance[1])

  // "+2d6 de dano" e uma linha de dano inteira, nao um bonus fixo nem um dado a mais.
  // Antes isso so funcionava pra "Explosiva", pelo nome; agora vale pra qualquer uma.
  for (const m of effect.matchAll(/([+-])\s*(\d+d\d+)\s+(?:de\s+)?dano/gi)) {
    if (m[1] === '+') result.extraDamageRolls.push(m[2])
  }

  return result
}

// Margem de ameaça conta ao contrário (ver parseNumericMod): +2 de margem abaixa o número.
function bonusesEscolhidos(efeitos: EfeitoEscolhido[]): ModBonuses {
  const r: ModBonuses = {
    attackTestBonus: 0, threatMarginDelta: 0, damageBonus: 0, multiplierDelta: 0,
    extraDamageDice: 0, spacesDelta: 0, defenseBonus: 0, rangeSteps: 0, extraDamageRolls: [],
  }
  for (const e of efeitos) {
    if (e.alvo === 'defesa') r.defenseBonus += e.valor
    else if (e.alvo === 'ataque') r.attackTestBonus += e.valor
    else if (e.alvo === 'margem') r.threatMarginDelta -= e.valor
    else if (e.alvo === 'dano') {
      if (e.modo === 'dados') r.extraDamageDice += e.valor
      else r.damageBonus += e.valor
    }
  }
  return r
}

export function somaBonuses(applied: AppliedModifier[]): ModBonuses {
  const total: ModBonuses = {
    attackTestBonus: 0, threatMarginDelta: 0, damageBonus: 0, multiplierDelta: 0,
    extraDamageDice: 0, spacesDelta: 0, defenseBonus: 0, rangeSteps: 0, extraDamageRolls: [],
  }
  for (const m of applied) {
    const b = m.efeitos?.length ? bonusesEscolhidos(m.efeitos) : parseNumericMod(m.effect ?? '')
    total.attackTestBonus += b.attackTestBonus
    total.threatMarginDelta += b.threatMarginDelta
    total.damageBonus += b.damageBonus
    total.multiplierDelta += b.multiplierDelta
    total.extraDamageDice += b.extraDamageDice
    total.spacesDelta += b.spacesDelta
    total.defenseBonus += b.defenseBonus
    total.rangeSteps += b.rangeSteps
    total.extraDamageRolls.push(...b.extraDamageRolls)
  }
  return total
}

// Cada parte é reconhecida pelo formato, não pela posição: "x3" é multiplicador, "19" (ou
// "19-20") é margem. O catálogo escreve "x3", "19", "19/x3"… Vale a primeira de cada (bug
// 08/10: o editor salvava "x3" como "x3/x2", e ler a última fazia a arma perder o x3).
export function partesDoCritico(critico: unknown): { margem: number | null; multiplicador: number | null } {
  let margem: number | null = null
  let multiplicador: number | null = null
  for (const parte of String(critico ?? '').split('/')) {
    const limpo = parte.trim()
    const mult = /^x\s*(\d+)$/i.exec(limpo)
    const marg = /^(\d+)(?:\s*-\s*20)?$/.exec(limpo)
    if (mult) multiplicador ??= Number(mult[1])
    else if (marg) margem ??= Number(marg[1])
  }
  return { margem, multiplicador }
}

// "19/x3" -> { threatMargin: 19, multiplier: 3 }. Sem margem = 20; sem multiplicador = x2.
export function parseCritico(critico: unknown): { threatMargin: number; multiplier: number } {
  const { margem, multiplicador } = partesDoCritico(critico)
  return { threatMargin: margem ?? 20, multiplier: multiplicador ?? 2 }
}

// Soma um bonus fixo numa formula de dano, juntando com o que ja existir:
// "2d8" + 2 -> "2d8+2";  "2d8+1" + 2 -> "2d8+3";  "2d8+2" + (-2) -> "2d8".
export function somaBonusNoDano(formula: string, bonus: number): string {
  if (!formula) return formula
  if (!bonus) return formula
  const m = formula.match(/^(.*?)\s*([+-]\s*\d+)?$/)
  const base = (m?.[1] ?? formula).trim()
  const atual = m?.[2] ? Number(m[2].replace(/\s+/g, '')) : 0
  const total = atual + bonus
  if (total === 0) return base
  return `${base}${total > 0 ? '+' : '-'}${Math.abs(total)}`
}

// Acrescenta dados do mesmo tipo na formula: "1d10" + 1 dado -> "2d10".
// So mexe em formula no formato NdX; o que nao for assim volta como veio.
export function somaDadosNoDano(formula: string, dados: number): string {
  if (!formula || !dados) return formula
  const m = formula.match(/^(\d*)d(\d+)(.*)$/i)
  if (!m) return formula
  const quantidade = Math.max(1, (Number(m[1] || '1')) + dados)
  return `${quantidade}d${m[2]}${m[3]}`
}

export const ORDEM_ALCANCE = ['curto', 'medio', 'longo', 'extremo'] as const

// "+1 categoria de alcance" sobe um degrau; nao passa de extremo.
export function subirAlcance(alcance: unknown, degraus: number): string {
  const atual = String(alcance ?? '')
  if (!degraus) return atual
  const i = ORDEM_ALCANCE.indexOf(atual as (typeof ORDEM_ALCANCE)[number])
  if (i < 0) return atual
  return ORDEM_ALCANCE[Math.min(ORDEM_ALCANCE.length - 1, Math.max(0, i + degraus))]
}

// Espaco do item ja com as modificacoes. Nunca fica negativo: item nao ocupa
// espaco negativo na mochila.
export function espacoComModificadores(spaces: number | null | undefined, applied: AppliedModifier[] | undefined): number {
  const base = spaces ?? 0
  if (!applied?.length) return base
  return Math.max(0, base + somaBonuses(applied).spacesDelta)
}

// Defesa que as modificacoes da protecao acrescentam.
export function defesaDeModificadores(applied: AppliedModifier[] | undefined): number {
  if (!applied?.length) return 0
  return somaBonuses(applied).defenseBonus
}

// Resistencias que um item equipado concede. O catalogo escreve de varios jeitos:
//   "RD sobe pra 5"             -> resistencia a dano 5
//   "resistencia a dano 2"      -> resistencia a dano 2
//   "Resistencia a Energia 10"  -> resistencia ao elemento Energia
//   "Resistencia mental 10"     -> resistencia mental
// Efeito que depende de condicao ("2 (leve/escudo) ou 5 (pesada)") nao e chutado aqui: pego
// o maior valor citado, que e o teto, e a condicao continua escrita no texto do efeito.
export type Resistencia = { tipo: string; valor: number }

const ELEMENTOS = ['Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo']

export function resistenciasDoEfeito(effect: string): Resistencia[] {
  const achadas: Resistencia[] = []
  if (!effect) return achadas

  for (const el of ELEMENTOS) {
    const re = new RegExp(`resist[êe]ncia\\s+(?:a|ao|contra)?\\s*${el}\\s+(\\d+)`, 'i')
    const m = effect.match(re)
    if (m) achadas.push({ tipo: el, valor: Number(m[1]) })
  }

  const mental = effect.match(/resist[êe]ncia\s+mental\s+(\d+)/i)
  if (mental) achadas.push({ tipo: 'Mental', valor: Number(mental[1]) })

  // Tipo qualquer, nao so os elementos: os trajes dao "resistencia a quimico 10".
  // "a dano" fica de fora porque tem tratamento proprio logo abaixo, e "a efeitos
  // ambientais" tambem, que e condicional e nao entra como resistencia fixa.
  for (const m of effect.matchAll(/resist[êe]ncia\s+(?:a|ao|contra)\s+([a-zçãõáéíóúâêô]+)\s+(\d+)/gi)) {
    const tipo = m[1].toLowerCase()
    if (tipo === 'dano' || tipo === 'efeitos') continue
    if (ELEMENTOS.some((e) => e.toLowerCase() === tipo)) continue
    achadas.push({ tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1), valor: Number(m[2]) })
  }

  const rd = effect.match(/\bRD\b[^.;]*/i) ?? effect.match(/resist[êe]ncia\s+a\s+dano[^.;]*/i)
  if (rd) {
    const numeros = (rd[0].match(/\d+/g) ?? []).map(Number)
    if (numeros.length) achadas.push({ tipo: 'Dano', valor: Math.max(...numeros) })
  }

  return achadas
}

// Junta as resistencias de todos os itens equipados. Repetiu o mesmo tipo, vale a maior.
export function resistenciasDeModificadores(applied: AppliedModifier[] | undefined): Resistencia[] {
  if (!applied?.length) return []
  const porTipo = new Map<string, number>()
  for (const m of applied) {
    for (const r of resistenciasDoEfeito(m.effect ?? '')) {
      porTipo.set(r.tipo, Math.max(porTipo.get(r.tipo) ?? 0, r.valor))
    }
  }
  return [...porTipo].map(([tipo, valor]) => ({ tipo, valor }))
}

const NOME_DO_TIPO: Record<string, string> = {
  corte: 'Corte',
  impacto: 'Impacto',
  balistico: 'Balístico',
  perfuracao: 'Perfuração',
}

// A resistencia de verdade nasce no proprio item: a Protecao Pesada ja traz
// { corte: 2, impacto: 2, balistico: 2, perfuracao: 2 } no stats. Quem equipa ela ja tem
// isso, sem modificacao nenhuma.
export function resistenciasDoItem(stats: Record<string, unknown> | undefined): Resistencia[] {
  const tabela = (stats ?? {}).resistencia
  if (!tabela || typeof tabela !== 'object') return []
  return Object.entries(tabela as Record<string, unknown>)
    .map(([tipo, valor]) => ({ tipo: NOME_DO_TIPO[tipo] ?? tipo, valor: Number(valor) || 0 }))
    .filter((r) => r.valor > 0)
}

// Resistencia de um item equipado, ja com as modificacoes dele.
//
// "RD sobe pra 5" (Blindada) nao cria um tipo novo: ela eleva os tipos que o item ja
// resiste. Protecao Pesada com Blindada fica com 5 em corte, impacto, balistico e
// perfuracao - nao com um "Dano 5" solto, que era o que eu estava mostrando.
export function resistenciasDoItemEquipado(
  stats: Record<string, unknown> | undefined,
  applied: AppliedModifier[] | undefined,
): Resistencia[] {
  const doItem = resistenciasDoItem(stats)
  const dasMods = resistenciasDeModificadores(applied)

  const porTipo = new Map<string, number>()
  for (const r of doItem) porTipo.set(r.tipo, r.valor)

  for (const r of dasMods) {
    if (r.tipo === 'Dano') {
      // Piso generico: eleva o que o item ja resiste. Se o item nao resiste a nada,
      // nao ha o que elevar e o valor fica como resistencia geral mesmo.
      if (doItem.length === 0) porTipo.set('Dano', Math.max(porTipo.get('Dano') ?? 0, r.valor))
      else for (const d of doItem) porTipo.set(d.tipo, Math.max(porTipo.get(d.tipo) ?? 0, r.valor))
      continue
    }
    porTipo.set(r.tipo, Math.max(porTipo.get(r.tipo) ?? 0, r.valor))
  }

  return [...porTipo].map(([tipo, valor]) => ({ tipo, valor }))
}

// A Protecao Pesada tira 5 das pericias com penalidade de carga (Acrobacia, Crime e
// Furtividade, que o banco marca com carga_penalty).
export function penalidadeDeCarga(descricao: string | null | undefined): number {
  const m = String(descricao ?? '').match(/-\s*(\d+)\s+em perícias com penalidade de carga/i)
  return m ? -Number(m[1]) : 0
}

// "Dano 5 · Energia 10", ou vazio quando nao ha nenhuma.
export function textoDasResistencias(resistencias: Resistencia[]): string {
  return resistencias.map((r) => `${r.tipo} ${r.valor}`).join(' · ')
}

// Stats do item com as modificacoes ja aplicadas, do jeito que tem que aparecer na ficha.
export function statsComModificadores(
  stats: Record<string, unknown> | undefined,
  applied: AppliedModifier[] | undefined,
): Record<string, unknown> {
  const base = stats ?? {}
  if (!applied?.length) return base

  const b = somaBonuses(applied)
  if (!b.threatMarginDelta && !b.multiplierDelta && !b.damageBonus && !b.extraDamageDice
    && !b.rangeSteps && !b.defenseBonus) return base

  const resultado = { ...base }

  if (b.threatMarginDelta || b.multiplierDelta) {
    const { threatMargin, multiplier } = parseCritico(base.critico)
    // A margem nao pode passar de 20: nao existe critico "a partir de 21".
    const margemFinal = Math.min(20, threatMargin + b.threatMarginDelta)
    resultado.critico = `${margemFinal}/x${Math.max(1, multiplier + b.multiplierDelta)}`
  }

  if ((b.damageBonus || b.extraDamageDice) && base.dano) {
    resultado.dano = somaBonusNoDano(somaDadosNoDano(String(base.dano), b.extraDamageDice), b.damageBonus)
  }

  if (b.rangeSteps && base.alcance) resultado.alcance = subirAlcance(base.alcance, b.rangeSteps)
  if (b.defenseBonus && base.defesa != null) resultado.defesa = Number(base.defesa) + b.defenseBonus

  return resultado
}

export type NumerosDoAtaque = {
  d20Bonus: number
  threatMargin: number
  multiplier: number
  damage: { formula: string; tipo: string }[]
  damageBonusFromMods: number
  /** Alcance ja com "+1 categoria de alcance" aplicado. */
  alcance: string
}

// Numeros de ataque de uma arma do inventario: os do item mais o que as modificacoes da
// arma e da municao acrescentam.
//
// O ataque criado no Combate guarda uma copia desses numeros, mas quem manda e o item:
// tirar uma maldicao da arma tem que mudar o ataque tambem. Entao o Combate recalcula por
// aqui na hora de mostrar e de rolar, em vez de confiar na copia que ficou gravada.
export function numerosDoAtaque(
  stats: Record<string, unknown> | undefined,
  mods: AppliedModifier[],
): NumerosDoAtaque {
  const s = stats ?? {}
  const { threatMargin, multiplier } = parseCritico(s.critico)
  let alcanceFinal = String(s.alcance ?? '')

  const damage: { formula: string; tipo: string }[] = [
    { formula: String(s.dano ?? ''), tipo: String(s.tipo_dano ?? '') },
  ]

  let finalMultiplier = multiplier
  let finalThreatMargin = threatMargin
  let d20Bonus = 0
  let damageBonusFromMods = 0

  for (const mod of mods) {
    // Casos com nome proprio so existem em modificacao; o bonus escrito no texto vale
    // pros dois, senao a ficha e o combate mostrariam numeros diferentes.
    if (mod.kind === 'modificacao' && mod.name === 'Dum Dum') finalMultiplier += 1
    const parsed = parseNumericMod(mod.effect ?? '')
    finalThreatMargin += parsed.threatMarginDelta
    finalMultiplier += parsed.multiplierDelta
    d20Bonus += parsed.attackTestBonus
    damageBonusFromMods += parsed.damageBonus
    // Dado extra entra na primeira linha de dano, que e a da propria arma.
    if (parsed.extraDamageDice) damage[0] = { ...damage[0], formula: somaDadosNoDano(damage[0].formula, parsed.extraDamageDice) }
    // "+2d6 de dano" vira linha propria, lida do texto - nao mais pelo nome da modificacao.
    for (const extra of parsed.extraDamageRolls) damage.push({ formula: extra, tipo: mod.name })
    if (parsed.rangeSteps) alcanceFinal = subirAlcance(alcanceFinal, parsed.rangeSteps)
  }

  return {
    alcance: alcanceFinal,
    d20Bonus,
    // A margem nao passa de 20 e o multiplicador nao desce de 1.
    threatMargin: Math.min(20, finalThreatMargin),
    multiplier: Math.max(1, finalMultiplier),
    damage,
    damageBonusFromMods,
  }
}

// ---- Bonus de pericia escritos na descricao do item ----

export const PERICIAS = [
  'Acrobacia', 'Adestramento', 'Artes', 'Atletismo', 'Atualidades', 'Ciências', 'Crime',
  'Diplomacia', 'Enganação', 'Fortitude', 'Furtividade', 'Iniciativa', 'Intimidação',
  'Intuição', 'Investigação', 'Luta', 'Medicina', 'Ocultismo', 'Percepção', 'Pilotagem',
  'Pontaria', 'Profissão', 'Reflexos', 'Religião', 'Sobrevivência', 'Tecnologia', 'Vontade',
]

export type BonusDePericia = {
  pericias: string[]
  valor: number
  /** O "se" do bonus, como esta escrito. Vazio quando vale sempre. */
  condicao: string
}

// Uma frase so vale sempre se nao tiver um "pra/para/contra/quando/em cena..." depois do
// bonus. "+5 Furtividade" vale sempre; "+5 em Percepção pra observar coisas distantes"
// depende da situacao e nao pode ser somado direto na ficha.
const MARCA_DE_CONDICAO = /\b(pra|para|contra|quando|se\s|ao\s|em cena|enquanto|apenas|somente|no mesmo)\b/i

// "+2 Investigação/Percepção" e "+2 Religião e Vontade" valem pras duas pericias.
function periciasDoTrecho(trecho: string): string[] {
  const achadas = PERICIAS.filter((p) => new RegExp(`\\b${p}\\b`, 'i').test(trecho))
  return achadas
}

export function bonusDePericiaDaDescricao(descricao: string | null | undefined): BonusDePericia[] {
  const texto = String(descricao ?? '')
  if (!texto) return []

  const encontrados: BonusDePericia[] = []
  // Quebro em frases: a condicao pertence a frase do bonus, nao ao item inteiro.
  for (const frase of texto.split(/[.;]/)) {
    const m = frase.match(/([+-]\s*\d+)\s+(?:em\s+)?([A-Za-zÀ-ÿ/\s]+)/)
    if (!m) continue

    const valor = Number(m[1].replace(/\s+/g, ''))
    if (!valor) continue

    // So o pedaco logo depois do numero vira lista de pericias; o resto e a condicao.
    const depois = frase.slice(frase.indexOf(m[1]) + m[1].length)
    const listaBruta = depois.match(/^\s*(?:em\s+)?([A-Za-zÀ-ÿ/\s]+)/)?.[1] ?? ''
    const pericias = periciasDoTrecho(listaBruta)
    if (pericias.length === 0) continue

    const resto = depois.slice(listaBruta.length).trim()
    const condicao = MARCA_DE_CONDICAO.test(resto) || MARCA_DE_CONDICAO.test(listaBruta)
      ? frase.trim()
      : ''

    encontrados.push({ pericias, valor, condicao })
  }
  return encontrados
}

export function bonusIncondicionais(descricao: string | null | undefined): BonusDePericia[] {
  return bonusDePericiaDaDescricao(descricao).filter((b) => !b.condicao)
}

export function bonusCondicionais(descricao: string | null | undefined): BonusDePericia[] {
  return bonusDePericiaDaDescricao(descricao).filter((b) => !!b.condicao)
}

// ---- Bonus de atributo, PV e PE de item equipado ----

export type AlvoDeBonus = 'forca' | 'agilidade' | 'intelecto' | 'vigor' | 'presenca' | 'pv' | 'pe'

export type BonusDeFicha = {
  alvo: AlvoDeBonus
  valor: number
  /** Texto da condicao quando o bonus nao vale de imediato. Vazio quando vale ao equipar. */
  condicao: string
}

const ATRIBUTO_POR_NOME: Record<string, AlvoDeBonus> = {
  'força': 'forca',
  'forca': 'forca',
  'agilidade': 'agilidade',
  'intelecto': 'intelecto',
  'vigor': 'vigor',
  'presença': 'presenca',
  'presenca': 'presenca',
}

// "ativa apos 1 dia de uso" nao e algo que o app saiba medir, entao vira liga/desliga.
const PRECISA_LIGAR = /\b(ativa|ativo)\b|\bap[oó]s\b|\bdepois de\b/i

export function bonusDeFichaDaDescricao(descricao: string | null | undefined): BonusDeFicha[] {
  const texto = String(descricao ?? '')
  if (!texto) return []

  const achados: BonusDeFicha[] = []
  for (const frase of texto.split(/[.;]/)) {
    const condicao = PRECISA_LIGAR.test(frase) ? frase.trim() : ''

    for (const m of frase.matchAll(/([+-]\s*\d+)\s+(PV|PE)\b/gi)) {
      achados.push({ alvo: m[2].toLowerCase() as AlvoDeBonus, valor: Number(m[1].replace(/\s+/g, '')), condicao })
    }

    for (const m of frase.matchAll(/([+-]\s*\d+)\s+([A-Za-zÀ-ÿ]+)/g)) {
      const alvo = ATRIBUTO_POR_NOME[m[2].toLowerCase()]
      if (alvo) achados.push({ alvo, valor: Number(m[1].replace(/\s+/g, '')), condicao })
    }
  }
  return achados
}

// ---- Tudo que um item concede, junto num lugar so ----
//
// Um item pode dar bonus por tres caminhos: a descricao dele, uma modificacao aplicada e
// uma maldicao aplicada. Cada bonus pode valer sempre (ao equipar) ou depender de algo
// que o app nao sabe medir - "pra observar coisas distantes", "ativa apos 1 dia de uso".
// Esses ultimos viram liga/desliga.
//
// A chave e estavel e descreve a origem, entao ligar um bonus nao vira outro se a ordem
// mudar; e ela que fica guardada em active_bonuses.

export type EfeitoDeItem = {
  chave: string
  rotulo: string
  condicao: string
  pericias?: string[]
  alvo?: AlvoDeBonus
  valor: number
  // Modificação/maldição de onde veio (pra mostrar a origem do bônus ao passar o mouse).
  mod?: { kind: AppliedModifier['kind']; name: string }
}

function rotuloDeFicha(alvo: AlvoDeBonus, valor: number) {
  const nomes: Record<AlvoDeBonus, string> = {
    forca: 'Força', agilidade: 'Agilidade', intelecto: 'Intelecto',
    vigor: 'Vigor', presenca: 'Presença', pv: 'PV', pe: 'PE',
  }
  return `${valor > 0 ? '+' : ''}${valor} ${nomes[alvo]}`
}

export function efeitosDoItem(
  descricao: string | null | undefined,
  mods: AppliedModifier[] | undefined,
): EfeitoDeItem[] {
  const lista: EfeitoDeItem[] = []

  bonusDePericiaDaDescricao(descricao).forEach((b, i) => {
    lista.push({
      chave: `desc-pericia-${i}`,
      rotulo: `${b.valor > 0 ? '+' : ''}${b.valor} ${b.pericias.join(' / ')}`,
      condicao: b.condicao,
      pericias: b.pericias,
      valor: b.valor,
    })
  })

  bonusDeFichaDaDescricao(descricao).forEach((b, i) => {
    lista.push({ chave: `desc-ficha-${i}`, rotulo: rotuloDeFicha(b.alvo, b.valor), condicao: b.condicao, alvo: b.alvo, valor: b.valor })
  })

  for (const m of mods ?? []) {
    if (m.efeitos?.length) {
      m.efeitos.forEach((e, i) => {
        if (!e.valor) return
        const base = { chave: m.proprio ? `item-esc-${i}` : `mod-${m.name}-esc-${i}`, condicao: e.ligavel ? 'Só quando ligado' : '', valor: e.valor, mod: m.proprio ? undefined : { kind: m.kind, name: m.name } }
        const pericias = periciasDoEfeito(e, PERICIAS)
        if (pericias.length) {
          lista.push({ ...base, rotulo: m.proprio ? textoDoEfeito({ ...e, ligavel: false }) : `${textoDoEfeito({ ...e, ligavel: false })} (${m.name})`, pericias })
        } else if (e.alvo === 'atributo' && e.qual) {
          lista.push({ ...base, rotulo: `${rotuloDeFicha(e.qual as AlvoDeBonus, e.valor)} (${m.name})`, alvo: e.qual as AlvoDeBonus })
        } else if (e.alvo === 'pv' || e.alvo === 'pe') {
          lista.push({ ...base, rotulo: `${rotuloDeFicha(e.alvo, e.valor)} (${m.name})`, alvo: e.alvo })
        }
      })
      continue
    }
    bonusDeFichaDaDescricao(m.effect).forEach((b, i) => {
      lista.push({
        chave: `mod-${m.name}-ficha-${i}`,
        rotulo: `${rotuloDeFicha(b.alvo, b.valor)} (${m.name})`,
        condicao: b.condicao,
        alvo: b.alvo,
        valor: b.valor,
        mod: { kind: m.kind, name: m.name },
      })
    })
    bonusDePericiaDaDescricao(m.effect).forEach((b, i) => {
      lista.push({
        chave: `mod-${m.name}-pericia-${i}`,
        rotulo: `${b.valor > 0 ? '+' : ''}${b.valor} ${b.pericias.join(' / ')} (${m.name})`,
        condicao: b.condicao,
        pericias: b.pericias,
        valor: b.valor,
        mod: { kind: m.kind, name: m.name },
      })
    })
  }

  return lista
}

export function efeitosSempre(descricao: string | null | undefined, mods: AppliedModifier[] | undefined) {
  return efeitosDoItem(descricao, mods).filter((e) => !e.condicao)
}

export function efeitosLigaveis(descricao: string | null | undefined, mods: AppliedModifier[] | undefined) {
  return efeitosDoItem(descricao, mods).filter((e) => !!e.condicao)
}

// O que de fato vale agora: os de sempre mais os ligados.
export function efeitosValendo(
  descricao: string | null | undefined,
  mods: AppliedModifier[] | undefined,
  ligados: string[] | undefined,
) {
  const ativos = new Set(ligados ?? [])
  return efeitosDoItem(descricao, mods).filter((e) => !e.condicao || ativos.has(e.chave))
}

// Espaços a mais na carga máxima por itens equipados (pedido da Millie, 07/10): Mochila Militar
// +2 (OPRPG, p. 66), ou o que o item disser em stats.carga_bonus.
export function bonusDeCarga(itens: { is_equipped: boolean; item: { name: string; stats?: Record<string, unknown> } | null }[]): number {
  return itens.reduce((s, i) => {
    if (!i.is_equipped || !i.item) return s
    const extra = Number(i.item.stats?.carga_bonus)
    if (Number.isFinite(extra) && extra) return s + extra
    return /mochila militar|mochila t[aá]tica/i.test(i.item.name) ? s + 2 : s
  }, 0)
}

// ---- Categoria sobe com modificações e maldições (OPRPG; pedido da Millie, 08/10) ----
// Cada modificação: +I. A 1ª maldição: +II; as seguintes: +I cada. Iguais não se acumulam
// (mesmo nome conta uma vez). A categoria vai de 0 a IV.

export const CATEGORIAS = ['0', 'I', 'II', 'III', 'IV']

export function degrausDeCategoria(mods: AppliedModifier[] | null | undefined): number {
  const unicos = (kind: AppliedModifier['kind']) => new Set((mods ?? []).filter((m) => m.kind === kind && !m.proprio).map((m) => m.name.trim().toLowerCase())).size
  const maldicoes = unicos('maldicao')
  return unicos('modificacao') + (maldicoes > 0 ? maldicoes + 1 : 0)
}

// Categoria depois de trocar as modificações: aplica só a diferença, então um ajuste feito à mão
// na categoria continua valendo. Categoria desconhecida fica como está.
export function categoriaComMods(categoria: string | null | undefined, antes: AppliedModifier[] | null | undefined, depois: AppliedModifier[] | null | undefined): string | null | undefined {
  const i = CATEGORIAS.indexOf(String(categoria ?? ''))
  if (i < 0) return categoria
  const j = Math.max(0, Math.min(CATEGORIAS.length - 1, i + degrausDeCategoria(depois) - degrausDeCategoria(antes)))
  return CATEGORIAS[j]
}

// ---- RD a mais no Bloqueio (Braçadeira reforçada: "+2 na RD de bloqueio"), bug 08/10 ----
// Só o bônus fixo. O que custa PE ou sacrifica o item ("gasta 2 PE + sacrifica a faca pra +20
// na RD do bloqueio") é escolha na hora e fica na mão.
export function rdDeBloqueio(texto: string | null | undefined): number {
  let total = 0
  for (const frase of String(texto ?? '').split(/[.;]/)) {
    if (/\bPE\b|sacrific/i.test(frase)) continue
    const m = /([+-]\s*\d+)\s+(?:na|em|de)\s+(?:RD|resist[eê]ncia a dano)\s+(?:de|do|no|ao)\s+bloquei/i.exec(frase)
    if (m) total += Number(m[1].replace(/\s+/g, ''))
  }
  return total
}

// ---- Atributo efetivo (bug 11/10): maldição/modificação "+1 Agilidade" aparecia como "+1" verde
// mas não entrava na rolagem. O valor que vale é o da ficha mais o dos itens equipados. ----
export function atributosComBonus<T extends Record<string, number>>(atributos: T, bonus: Partial<Record<string, number>> | undefined): T {
  if (!bonus) return atributos
  const r = { ...atributos } as Record<string, number>
  for (const k of ['forca', 'agilidade', 'intelecto', 'vigor', 'presenca']) if (bonus[k]) r[k] = (r[k] ?? 0) + (bonus[k] ?? 0)
  return r as T
}
