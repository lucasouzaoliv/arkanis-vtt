// Regras puras do Sistema de Mira (KAN-51, spec 12.9): o ataque que vai pro chat, a Defesa e
// as resistências do alvo e quanto do dano passa.
import { rollAttributeTest, rollDiceFormula } from '../../lib/rules'
import { resistenciasDoItemEquipado, type AppliedModifier } from '../CharacterSheet/itemMods'
import { defesaTotal } from '../CharacterSheet/defesa'
import { defesaDeCondicoes } from '../CharacterSheet/condicoes'
import { lerCondicoesPersonalizadas } from '../CharacterSheet/efeitosEscolhidos'
import { lerTeste } from './combate'

export type Alvo = { token_id: string; nome: string }

// Uma parte do dano ("1d8+2" de corte, "1d6" de Sangue…).
export type ParteDano = { formula: string; tipo: string; origem?: string; elemento?: string }

// O ataque já calculado na hora em que saiu da ficha: os botões do chat só rolam.
export type AtaqueDaAcao = {
  nome: string
  dados: number // d20 do teste (0 ou menos: rola 2 e fica com o menor)
  bonus: number
  margem: number // margem de ameaça (crítico a partir deste número no d20)
  multiplicador: number
  partes: ParteDano[]
  bonus_dano: number // somado uma vez, fora do crítico
  corpo?: boolean // corpo a corpo (dá pra contra-atacar quando erra)
  som?: string | null // som de arma escolhido pela ficha (13/10)
}

export type RolagemAtaque = { rolls: number[]; kept: number; bonus: number; total: number; critico: boolean; acertos: Record<string, boolean> }
export type RolagemDano = {
  total: number
  partes: { valor: number; tipo: string; formula?: string; origem?: string; elemento?: string; lados?: number }[]
  dados: { sides: number; value: number }[]
  critico: boolean
  // Quanto passou em cada alvo e por quê (null: alvo sem ficha).
  efeitos?: Record<string, { pv: number; san: number; motivos: string[] } | null>
}

export type Reacao = { tipo: 'esquiva' | 'bloqueio' | 'contra'; valor: number }

export type AcaoAtaque = {
  tipo: 'ataque'
  atacante: string
  // De quem é o ataque, pra achar o token na hora do contra-ataque.
  origem?: { character_id?: string | null; actor_id?: string | null }
  ataque: AtaqueDaAcao
  alvos: Alvo[]
  estado: {
    ataque?: RolagemAtaque
    bloqueios?: Record<string, number> // (ataques antigos)
    reacoes?: Record<string, Reacao>
    dano?: RolagemDano
    aplicado?: Record<string, { pv: number; san: number }>
  }
}

// Cura com alvo (12.9): ritual (Cicatrização…) ou item (Cicatrizante…). O ritual tem o teste
// antes; o item cura direto.
export type Recurso = 'pv' | 'san' | 'pe'

export type AcaoCura = {
  tipo: 'cura'
  curador: string
  fonte: string // "o ritual Cicatrização (Discente)", "o item Cicatrizante"
  imagem?: string | null // a arte do item/ritual (a que a pessoa escolheu na ficha)
  elemento?: string | null // ritual: o cartão ganha a textura do elemento e o símbolo (11/10)
  formula: string
  recurso: Recurso
  teste: { nome: string; dados: number; bonus: number } | null
  alvos: Alvo[]
  estado: {
    teste?: { rolls: number[]; kept: number; bonus: number; total: number }
    cura?: { total: number; dados: { sides: number; value: number }[] }
    aplicado?: Record<string, { valor: number }>
  }
}

// Alguém interagiu com um item da mesa (KAN-53): um passo por mensagem.
export type AcaoInteracao = {
  tipo: 'interacao'
  item: string
  imagem: string | null
  atividade: string
  texto: string // "tentou Arrombar", "abriu o Baú Velho"
  teste?: { nome: string; rolls: number[]; kept: number; bonus: number; total: number; dt: number | null; passou: boolean }
  rolagem?: { rotulo: string; total: number; dados: { sides: number; value: number }[] }
  alvos?: { nome: string; texto: string }[] // "−7 PV", "+5 PV", "errou"
  estado: Record<string, never>
}

export type Acao = AcaoAtaque | AcaoCura | AcaoInteracao

// O que o banco devolve sobre o alvo (dados_do_alvo).
export type DadosDoAlvo =
  | {
      tipo: 'ficha'
      nome: string
      agilidade: number
      condicoes: string[]
      condicoes_personalizadas?: unknown
      defesa_outros: number
      bloqueio: number
      itens: { tipo: string | null; nome?: string | null; stats: Record<string, unknown>; mods: AppliedModifier[] }[]
      poderes?: string[]
      atributos?: Record<string, number>
      nex?: number
      class_id?: string | null
      custom_class?: Record<string, number | string | null> | null
      max_pv_override?: number | null
      max_sanity_override?: number | null
      max_pe_override?: number | null
      pv?: number | null
      san?: number | null
      pe?: number | null
      // Treino em Luta (nenhum/treinado/veterano/expert): contra-atacar exige treino (13/10).
      luta?: string | null
    }
  | { tipo: 'criatura'; nome: string; defesa: number; resistencias: string | null; vulnerabilidades: string | null; pv_maximo?: number | null; condicoes?: string[]; condicoes_personalizadas?: unknown }
  | { tipo: 'nenhum'; nome: string }

export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Tipos de dano escritos de vários jeitos ("P", "perfuração", "Balístico") viram uma chave só.
const SIGLAS: Record<string, string> = { c: 'corte', p: 'perfuracao', b: 'balistico', i: 'impacto', f: 'fogo', e: 'eletricidade', q: 'quimico', m: 'mental', contundente: 'impacto', cortante: 'corte', perfurante: 'perfuracao', eletrico: 'eletricidade', acido: 'quimico' }

export function tipoDeDano(t: string | null | undefined): string {
  const n = normalizar(t ?? '').replace(/[.()]/g, '')
  if (!n) return ''
  if (SIGLAS[n]) return SIGLAS[n]
  const conhecidos = ['corte', 'perfuracao', 'balistico', 'impacto', 'fogo', 'frio', 'quimico', 'eletricidade', 'mental', 'sangue', 'morte', 'conhecimento', 'energia', 'medo']
  return conhecidos.find((k) => n.startsWith(k)) ?? n.split(/\s+/)[0]
}

const NOMES: Record<string, string> = {
  corte: 'Corte', perfuracao: 'Perfuração', balistico: 'Balístico', impacto: 'Impacto', fogo: 'Fogo', frio: 'Frio', quimico: 'Químico',
  eletricidade: 'Eletricidade', mental: 'Mental', sangue: 'Sangue', morte: 'Morte', conhecimento: 'Conhecimento', energia: 'Energia', medo: 'Medo',
}

// "P" → "Perfuração", pra mostrar no chat.
export function nomeDoTipo(t: string): string {
  const k = tipoDeDano(t)
  return NOMES[k] ?? t.trim()
}

// Resistências do alvo: valor por tipo ("dano" vale pra tudo), imunidades e vulnerabilidades.
export type Perfil = { resist: Record<string, number>; imune: string[]; imuneExceto: string[] | null; vulneravel: string[] }

const PERFIL_VAZIO: Perfil = { resist: {}, imune: [], imuneExceto: null, vulneravel: [] }

function nomesDaLista(texto: string): string[] {
  return texto
    .split(/,|\/|\be\b|;/i)
    .map((n) => tipoDeDano(n))
    .filter(Boolean)
}

// "Balístico, impacto e perfuração 10, Sangue 20; imune a fogo" → cada tipo com o número
// que vem depois dele. "Dano 50" vale pra tudo. Sem número (ex.: "Dano (exceto Conhecimento)")
// não dá pra saber quanto; fica de fora.
export function lerResistenciasDaCriatura(resistencias: string | null, vulnerabilidades: string | null): Perfil {
  const perfil: Perfil = { resist: {}, imune: [], imuneExceto: null, vulneravel: vulnerabilidades ? nomesDaLista(vulnerabilidades) : [] }
  for (const trecho of (resistencias ?? '').split(';')) {
    const t = trecho.trim()
    if (!t) continue
    const imune = /^imunes?\s+a\s+(.*)$/i.exec(t)
    if (imune) {
      const exceto = /dano\s*\(exceto\s+([^)]+)\)/i.exec(imune[1])
      if (exceto) perfil.imuneExceto = nomesDaLista(exceto[1])
      else if (/^dano\b/i.test(imune[1].trim())) perfil.imuneExceto = []
      else perfil.imune.push(...nomesDaLista(imune[1].replace(/\b(todas as )?condi[çc][õo]es\b/gi, '')))
      continue
    }
    let pendentes: string[] = []
    for (const pedaco of t.replace(/\([^)]*\)/g, '').split(/,/)) {
      const m = /^(.*?)(\d+)\s*$/.exec(pedaco.trim())
      if (m) {
        const valor = Number(m[2])
        for (const n of [...pendentes, ...nomesDaLista(m[1])]) perfil.resist[n === 'dano' ? 'dano' : n] = Math.max(perfil.resist[n] ?? 0, valor)
        pendentes = []
      } else pendentes.push(...nomesDaLista(pedaco))
    }
  }
  return perfil
}

export function perfilDoAlvo(d: DadosDoAlvo): Perfil {
  if (d.tipo === 'criatura') return lerResistenciasDaCriatura(d.resistencias, d.vulnerabilidades)
  if (d.tipo !== 'ficha') return PERFIL_VAZIO
  const resist: Record<string, number> = {}
  for (const item of d.itens) {
    for (const r of resistenciasDoItemEquipado(item.stats, item.mods)) {
      const k = tipoDeDano(r.tipo)
      resist[k] = Math.max(resist[k] ?? 0, r.valor)
    }
  }
  return { resist, imune: [], imuneExceto: null, vulneravel: [] }
}

// Mesma conta da ficha (defesa.ts): 10 + Agilidade + itens + poderes fixos + outros + condições.
export function defesaDoAlvo(d: DadosDoAlvo): number | null {
  // Ameaça com condição (Caído, Vulnerável…) perde Defesa igual a ficha (18/10).
  if (d.tipo === 'criatura') return d.defesa + defesaDeCondicoes(d.condicoes, lerCondicoesPersonalizadas(d.condicoes_personalizadas)).valor
  if (d.tipo !== 'ficha') return null
  return defesaTotal({ agilidade: d.agilidade, outros: d.defesa_outros, condicoes: d.condicoes, itens: d.itens, poderes: d.poderes ?? [], condicoesPersonalizadas: lerCondicoesPersonalizadas(d.condicoes_personalizadas) }).total
}

// Quanto do dano passa: imune zera, vulnerável dobra, resistência do tipo (ou a geral, a maior
// das duas) tira de cada parte; o Bloqueio tira do total. Dano mental vai pra Sanidade.
export function danoNoAlvo(partes: { valor: number; tipo: string }[], perfil: Perfil, bloqueio = 0): { pv: number; san: number; motivos: string[] } {
  let pv = 0
  let san = 0
  const motivos: string[] = []
  for (const p of partes) {
    const tipo = tipoDeDano(p.tipo)
    let v = Math.max(0, p.valor)
    const imuneATudo = perfil.imuneExceto !== null && !perfil.imuneExceto.includes(tipo)
    if (imuneATudo || (tipo && perfil.imune.includes(tipo))) {
      if (v) motivos.push(`imune${tipo ? ` a ${tipo}` : ''}`)
      continue
    }
    if (tipo && perfil.vulneravel.includes(tipo)) {
      v *= 2
      motivos.push(`vulnerável a ${tipo}`)
    }
    const r = Math.max(perfil.resist[tipo] ?? 0, perfil.resist.dano ?? 0)
    if (r && v) motivos.push(`resistência ${r}`)
    v = Math.max(0, v - r)
    if (tipo === 'mental') san += v
    else pv += v
  }
  if (bloqueio > 0) {
    const tira = Math.min(bloqueio, pv)
    pv -= tira
    motivos.push(`bloqueio ${bloqueio}`)
  }
  return { pv, san, motivos: [...new Set(motivos)] }
}

// Ataque da ficha de ameaça: "+10 (2d20), crítico 19/x3" e "1d6+9 corte".
export function ataqueDaCriatura(nome: string, teste: string, dano: string): AtaqueDaAcao | null {
  const t = lerTeste(teste)
  const critico = /cr[ií]tico\s*(\d+)?\s*(?:\/?\s*x\s*(\d+))?/i.exec(teste)
  const partes = partesDoDanoEmTexto(dano)
  if (!partes.length) return null
  return {
    nome,
    dados: t.dados,
    bonus: t.bonus,
    margem: critico?.[1] ? Number(critico[1]) : 20,
    multiplicador: critico?.[2] ? Number(critico[2]) : 2,
    partes,
    bonus_dano: 0,
    corpo: !/bal[ií]stic|disparo|dist[âa]ncia|arremess|tiro/i.test(`${nome} ${teste} ${dano}`),
  }
}

// "1d6+9 corte mais 2d6 Sangue (Reflexos DT 19 reduz à metade)" → [{1d6+9, corte}, {2d6, Sangue}]
export function partesDoDanoEmTexto(texto: string): ParteDano[] {
  return texto
    .replace(/\([^)]*\)/g, '')
    .split(/\s+(?:mais|\+)\s+(?=\d)/i)
    .flatMap((p) => {
      const m = /^\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([a-zà-ú]+)?/i.exec(p)
      return m ? [{ formula: m[1].replace(/\s/g, ''), tipo: m[2] ?? '' }] : []
    })
}

export function rolarAtaque(a: AtaqueDaAcao): Omit<RolagemAtaque, 'acertos'> {
  const { rolls, kept } = rollAttributeTest(a.dados)
  return { rolls, kept, bonus: a.bonus, total: kept + a.bonus, critico: kept >= a.margem }
}

// Crítico: só o dano base da arma multiplica, e são os dados (não os números fixos); dano extra
// de encanto (Amaldiçoar Arma…) entra uma vez só.
export function rolarDanoDoAtaque(a: AtaqueDaAcao, critico: boolean): RolagemDano {
  const mult = critico ? Math.max(1, a.multiplicador) : 1
  const partes: RolagemDano['partes'] = []
  const dados: { sides: number; value: number }[] = []
  for (const p of a.partes) {
    const r = rollDiceFormula(p.formula, p.origem ? 1 : mult)
    if (!r) continue
    const lados = Number(/d(\d+)/i.exec(p.formula)?.[1] ?? 6)
    r.rolls.forEach((v) => dados.push({ sides: lados, value: v }))
    partes.push({ valor: r.total, tipo: p.tipo, formula: p.formula, origem: p.origem, elemento: p.elemento, lados })
  }
  if (a.bonus_dano && partes.length) partes[0] = { ...partes[0], valor: partes[0].valor + a.bonus_dano }
  return { total: partes.reduce((s, p) => s + p.valor, 0), partes, dados, critico }
}

export function textoDosAlvos(alvos: Alvo[]): string {
  const nomes = alvos.map((a) => a.nome)
  if (nomes.length <= 1) return nomes[0] ?? ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

// "O alvo recupera 3d8+3 PV", "curar 2d8+2 PV", "recupera 1d4 PE", "recupera 2d6 de Sanidade".
// Sem fórmula de dados (ex.: "recupera metade do dano") não dá pra automatizar.
export function curaDoTexto(texto: string | null | undefined): { formula: string; recurso: Recurso } | null {
  if (!texto || !/(cur[ao]|curar|recupera)/i.test(texto)) return null
  const m = /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*(?:pontos?\s+de\s+|de\s+)?(PV|PE|SAN\b|Sanidade|vida|esfor[çc]o)/i.exec(texto)
  if (!m) return null
  const r = normalizar(m[2])
  const recurso: Recurso = r === 'pe' || r.startsWith('esforc') ? 'pe' : r === 'san' || r.startsWith('sanidade') ? 'san' : 'pv'
  return { formula: m[1].replace(/\s/g, ''), recurso }
}

export function rolarCura(formula: string): { total: number; dados: { sides: number; value: number }[] } | null {
  const r = rollDiceFormula(formula)
  if (!r) return null
  const lados = Number(/d(\d+)/i.exec(formula)?.[1] ?? 6)
  return { total: r.total, dados: r.rolls.map((v) => ({ sides: lados, value: v })) }
}

export const SIGLA_RECURSO: Record<Recurso, string> = { pv: 'PV', san: 'SAN', pe: 'PE' }
