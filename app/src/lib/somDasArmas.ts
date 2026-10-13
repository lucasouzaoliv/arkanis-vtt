// Som de cada arma no ataque (pedido da Millie, 06/10; arquivos dela, em public/sons/armas).
// Pelo nome do ataque/arma; arma com nome próprio ("Minha Glock") cai pelo tipo de dano.

export const SONS_DE_ARMA = {
  katana: 'armas/katana.mp3',
  espada: 'armas/espada.mp3',
  // Adagas, facas e punhais (áudio do Kevin, 13/10).
  faca: 'armas/faca.mp3',
  machado: 'armas/machado.mp3',
  arco: 'armas/arco.mp3',
  pistola: 'armas/pistola.mp3',
  revolver: 'armas/revolver.mp3',
  escopeta: 'armas/escopeta.mp3',
  'escopeta-estrondosa': 'armas/escopeta-estrondosa.mp3',
  fuzil: 'armas/fuzil.mp3',
  submetralhadora: 'armas/submetralhadora.mp3',
  metralhadora: 'armas/metralhadora.mp3',
  sniper: 'armas/sniper.mp3',
  'lanca-chamas': 'armas/lanca-chamas.mp3',
} as const

export type SomDeArma = keyof typeof SONS_DE_ARMA

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Ordem importa: o mais específico primeiro ("espingarda de cano duplo" antes de "espingarda").
const POR_NOME: [RegExp, SomDeArma | null][] = [
  [/desarmad|soco|chute/, null],
  [/lanca-?\s?(chamas|nitrogenio)/, 'lanca-chamas'],
  [/bazuca|granada|cano duplo/, 'escopeta-estrondosa'],
  [/espingarda|escopeta|shotgun/, 'escopeta'],
  [/submetralhadora|\bsmg\b|\buzi\b/, 'submetralhadora'],
  [/metralhadora/, 'metralhadora'],
  [/fuzil de precisao|sniper|\bdmr\b|marksman|fuzil de caca/, 'sniper'],
  [/fuzil|rifle|\bm4\b|\bak\b/, 'fuzil'],
  [/revolver/, 'revolver'],
  [/pistola|pregador|taser|glock/, 'pistola'],
  [/arco|besta|balestra|estilingue/, 'arco'],
  [/katana|montante/, 'katana'],
  [/machad|acha|picareta|marreta|martelo|maca\b|bastao|cajado|corrente|nunchaku|motosserra|coronhada|improvisad/, 'machado'],
  [/faca|facao|punhal|adaga|canivete|estilete|navalha|bisturi|baioneta|kunai|shuriken|sai\b|tanto\b/, 'faca'],
  [/espada|florete|machete|gadanho|lanca|garra|gancho/, 'espada'],
]

// Pelo tipo de dano (sigla ou nome): balístico → pistola, corte/perfuração → espada, impacto →
// machado, fogo → lança-chamas.
const POR_DANO: [RegExp, SomDeArma][] = [
  [/^b$|balistic/, 'pistola'],
  [/^c$|^p$|corte|perfura/, 'espada'],
  [/^i$|impacto/, 'machado'],
  [/fogo/, 'lanca-chamas'],
]

export function somDaArma(nome: string | null | undefined, tipoDano?: string | null): SomDeArma | null {
  const n = sem(nome ?? '')
  for (const [re, som] of POR_NOME) if (re.test(n)) return som
  const d = sem(tipoDano ?? '').trim()
  for (const [re, som] of POR_DANO) if (re.test(d)) return som
  return null
}

// Ataque com nome próprio ("Slash 💔") vindo do inventário: tenta o nome do ataque, depois o da
// arma de onde veio (Punhal X), e só então o tipo de dano.
export function somDoAtaque(nomeDoAtaque: string | null | undefined, nomeDaArma: string | null | undefined, tipoDano?: string | null): SomDeArma | null {
  return somDaArma(nomeDoAtaque) ?? somDaArma(nomeDaArma, tipoDano)
}

export function ehSomDeArma(som: string | null | undefined): som is SomDeArma {
  return !!som && som in SONS_DE_ARMA
}

// "Ataque: Pistola (crítico!) — Caído" → "Pistola"
export function armaDoRotulo(label: string): string | null {
  const m = /^ataque:\s*(.+)$/i.exec(label.trim())
  return m ? m[1].replace(/\s*\(.*$/, '').replace(/\s+[—-].*$/, '').trim() : null
}
