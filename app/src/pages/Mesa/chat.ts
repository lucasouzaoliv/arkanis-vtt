// Regras puras do chat da mesa (KAN-47, spec 12.3).
import type { Acao } from './mira'
import type { ParteRolada } from '../CharacterSheet/danoDaArma'

export type ModoEnvio = 'publico_usuario' | 'privado_mestres' | 'cego_mestres' | 'somente_si' | 'publico_personagem'

export const MODOS_ENVIO: { id: ModoEnvio; rotulo: string }[] = [
  { id: 'publico_usuario', rotulo: 'Público como Usuário' },
  { id: 'privado_mestres', rotulo: 'Privado para Mestres' },
  { id: 'cego_mestres', rotulo: 'Cego para Mestres' },
  { id: 'somente_si', rotulo: 'Somente para Si' },
  { id: 'publico_personagem', rotulo: 'Público como Personagem' },
]

export type Rolagem = {
  label: string
  total: number
  detail: string
  dice: { sides: number; value: number; discarded?: boolean }[] | null
  bonus: number
  // Gasto embaixo da rolagem (ex.: "Gastou 3 PE (12 → 9)").
  nota?: string | null
  // Registro sem dados (ritual sem dano): só o nome e a nota.
  sem_rolagem?: boolean
  // Dano com cada parte separada, cada uma com o seu tipo e de onde veio.
  partes?: ParteRolada[] | null
  // Ritual conjurado: textura do elemento e símbolo no cartão (11/10).
  ritual?: { nome?: string | null; elemento?: string | null; imagem?: string | null } | null
  // Rolagem digitada (/r): a fórmula como a pessoa pediu (2d20kh1 + 1d6 - 3).
  formula?: string
}

export type Mensagem = {
  id: string
  campaign_id: string
  user_id: string
  character_id: string | null
  modo: ModoEnvio
  autor_nome: string
  autor_foto: string | null
  conteudo: string | null
  rolagem: Rolagem | null
  // Ataque com mira (12.9): os botões Ataque e Dano e o que já saiu deles.
  acao?: Acao | null
  destacada: boolean
  revelada: boolean
  created_at: string
}

export function ehPrivada(m: Pick<Mensagem, 'modo' | 'revelada'>): boolean {
  return !m.revelada && (m.modo === 'privado_mestres' || m.modo === 'cego_mestres' || m.modo === 'somente_si')
}

// "Para: [destinatário]" que aparece abaixo do nome das mensagens privadas.
export function destinatario(m: Pick<Mensagem, 'modo' | 'revelada'>, nomeMestre: string, nomeAutor: string): string | null {
  if (!ehPrivada(m)) return null
  if (m.modo === 'privado_mestres') return nomeMestre
  if (m.modo === 'cego_mestres') return 'Jogadores'
  return nomeAutor
}

// Quem fala: a conta (fora de personagem) ou o personagem. Sem personagem, cai na conta.
export function autoria(
  modo: ModoEnvio,
  conta: { nome: string; foto: string | null },
  personagem: { nome: string | null; foto: string | null } | null,
): { nome: string; foto: string | null } {
  if (modo !== 'publico_usuario' && personagem?.nome?.trim()) return { nome: personagem.nome.trim(), foto: personagem.foto }
  return { nome: conta.nome, foto: conta.foto }
}

// "agora", "5 min atrás", "3h 12min atrás", "4 dias 18h atrás", "2 meses 3 dias atrás".
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const min = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return min % 60 ? `${h}h ${min % 60}min atrás` : `${h}h atrás`
  const dias = Math.floor(h / 24)
  if (dias < 30) {
    const rotulo = dias === 1 ? '1 dia' : `${dias} dias`
    return h % 24 ? `${rotulo} ${h % 24}h atrás` : `${rotulo} atrás`
  }
  const meses = Math.floor(dias / 30)
  const resto = dias % 30
  const rotulo = meses === 1 ? '1 mês' : `${meses} meses`
  return resto ? `${rotulo} ${resto} ${resto === 1 ? 'dia' : 'dias'} atrás` : `${rotulo} atrás`
}

// Formatação permitida no chat (12.3). Tudo fora disso é descartado ao enviar e ao exibir.
const TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUP', 'SUB', 'CODE', 'HR', 'BR', 'SPAN', 'FONT', 'DIV', 'P', 'A', 'IMG'])
const DESCARTAR = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE'])
const ESTILOS = new Set(['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line'])
const URL_SEGURA = /^https?:\/\//i

function limparEstilo(estilo: string): string {
  return estilo
    .split(';')
    .map((d) => {
      const i = d.indexOf(':')
      return i < 0 ? ['', ''] : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]
    })
    .filter(([k, v]) => k && v && ESTILOS.has(k) && !/url\(|expression|javascript:|[<>]/i.test(v))
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
}

function limparNo(no: Node, doc: Document): Node | null {
  if (no.nodeType === Node.TEXT_NODE) return doc.createTextNode(no.textContent ?? '')
  if (no.nodeType !== Node.ELEMENT_NODE) return null
  const el = no as Element
  if (DESCARTAR.has(el.tagName)) return null
  const filhos = Array.from(el.childNodes).map((f) => limparNo(f, doc)).filter((f): f is Node => f !== null)
  const soOsFilhos = () => {
    const frag = doc.createDocumentFragment()
    filhos.forEach((f) => frag.appendChild(f))
    return frag
  }
  if (!TAGS.has(el.tagName)) return soOsFilhos()

  const novo = doc.createElement(el.tagName.toLowerCase())
  const estilo = el.getAttribute('style')
  if (estilo) {
    const limpo = limparEstilo(estilo)
    if (limpo) novo.setAttribute('style', limpo)
  }
  if (el.tagName === 'FONT') {
    for (const a of ['color', 'face', 'size']) {
      const v = el.getAttribute(a)
      if (v && !/[<>"']/.test(v)) novo.setAttribute(a, v)
    }
  }
  if (el.tagName === 'A') {
    const href = el.getAttribute('href') ?? ''
    if (!URL_SEGURA.test(href)) return soOsFilhos()
    novo.setAttribute('href', href)
    novo.setAttribute('target', '_blank')
    novo.setAttribute('rel', 'noopener noreferrer')
  }
  if (el.tagName === 'IMG') {
    const src = el.getAttribute('src') ?? ''
    if (!URL_SEGURA.test(src)) return null
    novo.setAttribute('src', src)
    novo.setAttribute('alt', '')
  }
  filhos.forEach((f) => novo.appendChild(f))
  return novo
}

export function sanitizarHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const saida = document.implementation.createHTMLDocument('')
  const raiz = saida.createElement('div')
  Array.from(doc.body.childNodes).forEach((n) => {
    const limpo = limparNo(n, saida)
    if (limpo) raiz.appendChild(limpo)
  })
  return raiz.innerHTML
}

// URL colada no texto vira link clicável ao enviar (sem botão de link).
export function linkificar(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textos: Text[] = []
  while (walker.nextNode()) {
    const t = walker.currentNode as Text
    if (!t.parentElement?.closest('a, code')) textos.push(t)
  }
  for (const t of textos) {
    const partes = (t.textContent ?? '').split(/(https?:\/\/[^\s<]+)/g)
    if (partes.length === 1) continue
    const frag = doc.createDocumentFragment()
    partes.forEach((p, i) => {
      if (i % 2 === 1) {
        const a = doc.createElement('a')
        a.href = p
        a.textContent = p
        frag.appendChild(a)
      } else if (p) frag.appendChild(doc.createTextNode(p))
    })
    t.replaceWith(frag)
  }
  return doc.body.innerHTML
}

// Conteúdo vazio (só espaços, <br>, divs vazias) não é enviado.
export function vazio(html: string): boolean {
  if (/<(img|hr)\b/i.test(html)) return false
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}

export function textoPuro(html: string): string {
  const preparado = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '\n')
  const doc = new DOMParser().parseFromString(`<body>${preparado}</body>`, 'text/html')
  doc.querySelectorAll('img').forEach((i) => i.replaceWith(`[imagem: ${i.getAttribute('src')}]`))
  doc.querySelectorAll('hr').forEach((h) => h.replaceWith('\n———\n'))
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

// Exportar Registro de Chat: um .txt com tudo, em ordem.
export function exportarRegistro(mensagens: Mensagem[], nomeCampanha: string): string {
  const linhas = [`Registro de chat — ${nomeCampanha}`, '']
  for (const m of mensagens) {
    const quando = new Date(m.created_at).toLocaleString('pt-BR')
    linhas.push(`[${quando}] ${m.autor_nome}`)
    if (m.rolagem) linhas.push(`${m.rolagem.label}: ${m.rolagem.total} (${m.rolagem.detail})`)
    if (m.conteudo) linhas.push(textoPuro(m.conteudo))
    linhas.push('')
  }
  return linhas.join('\n')
}

// Mensagem nova ou alterada (realtime) entra na lista na ordem certa, sem duplicar.
export function juntarMensagem(lista: Mensagem[], m: Mensagem): Mensagem[] {
  const sem = lista.filter((x) => x.id !== m.id)
  sem.push(m)
  return sem.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

// "2d20 + 1d6 + 3" a partir dos dados da rolagem; sem dados estruturados, usa o detalhe.
export function formulaDaRolagem(r: Rolagem): string {
  if (r.formula) return r.formula
  if (!r.dice?.length) return r.detail
  const contagem = new Map<number, number>()
  for (const d of r.dice) contagem.set(d.sides, (contagem.get(d.sides) ?? 0) + 1)
  const partes = [...contagem.entries()].sort((a, b) => b[0] - a[0]).map(([lados, n]) => `${n}d${lados}`)
  if (r.bonus) partes.push(String(Math.abs(r.bonus)))
  return partes.join(' + ').replace(/ \+ (\d+)$/, r.bonus < 0 ? ' − $1' : ' + $1')
}

// Formato do menu "Formato" (12.3): o que for marcado fica valendo pras próximas mensagens
// até a pessoa desmarcar.
export type EmLinha = 'negrito' | 'italico' | 'codigo' | 'sublinhado' | 'tachado' | 'sobrescrito' | 'subscrito'

export type FormatoAtivo = {
  emLinha: EmLinha[]
  fonte: string | null
  tamanho: number | null
  cor: string | null
}

export const FORMATO_PADRAO: FormatoAtivo = { emLinha: [], fonte: null, tamanho: null, cor: null }

export function alternarEmLinha(f: FormatoAtivo, chave: EmLinha): FormatoAtivo {
  if (f.emLinha.includes(chave)) return { ...f, emLinha: f.emLinha.filter((c) => c !== chave) }
  // Sobrescrito e subscrito não andam juntos.
  const oposto: EmLinha | null = chave === 'sobrescrito' ? 'subscrito' : chave === 'subscrito' ? 'sobrescrito' : null
  return { ...f, emLinha: [...f.emLinha.filter((c) => c !== oposto), chave] }
}

export function formatoVazio(f: FormatoAtivo): boolean {
  return !f.emLinha.length && !f.fonte && !f.tamanho && !f.cor
}

const TAG_EM_LINHA: Record<EmLinha, string> = {
  negrito: 'b', italico: 'i', codigo: 'code', sublinhado: 'u', tachado: 's', sobrescrito: 'sup', subscrito: 'sub',
}

const ORDEM_EM_LINHA: EmLinha[] = ['negrito', 'italico', 'sublinhado', 'tachado', 'codigo', 'sobrescrito', 'subscrito']

// Envolve a mensagem inteira no formato marcado, na hora de enviar.
export function aplicarFormato(html: string, f: FormatoAtivo): string {
  let saida = html
  for (const chave of ORDEM_EM_LINHA.filter((c) => f.emLinha.includes(c)).reverse()) {
    const tag = TAG_EM_LINHA[chave]
    saida = `<${tag}>${saida}</${tag}>`
  }
  const estilo = [
    f.fonte && `font-family: '${f.fonte.replace(/['"<>;]/g, '')}'`,
    f.tamanho && `font-size: ${Math.round(f.tamanho)}px`,
    f.cor && /^#[0-9a-f]{6}$/i.test(f.cor) && `color: ${f.cor}`,
  ].filter(Boolean)
  return estilo.length ? `<span style="${estilo.join('; ')}">${saida}</span>` : saida
}

// Estilo do campo de digitação, pra pessoa já ver como a mensagem vai sair.
export function estiloDoCampo(f: FormatoAtivo): Record<string, string> {
  const e: Record<string, string> = {}
  if (f.emLinha.includes('negrito')) e.fontWeight = '700'
  if (f.emLinha.includes('italico')) e.fontStyle = 'italic'
  const linhas = [f.emLinha.includes('sublinhado') && 'underline', f.emLinha.includes('tachado') && 'line-through'].filter(Boolean)
  if (linhas.length) e.textDecoration = linhas.join(' ')
  if (f.emLinha.includes('codigo')) e.fontFamily = 'ui-monospace, Consolas, monospace'
  if (f.fonte) e.fontFamily = `'${f.fonte}'`
  if (f.tamanho) e.fontSize = `${f.tamanho}px`
  if (f.cor) e.color = f.cor
  return e
}

// Texto curto da mensagem pra notificação (12.3): sem formatação, e as rolagens/ações resumidas.
export function resumoDaMensagem(m: Pick<Mensagem, 'conteudo' | 'rolagem' | 'acao'>, limite = 140): string {
  let texto = ''
  if (m.acao?.tipo === 'ataque') texto = `está atacando ${m.acao.alvos.map((a) => a.nome).join(', ')}`
  else if (m.acao?.tipo === 'cura') texto = `está usando ${m.acao.fonte} em ${m.acao.alvos.map((a) => a.nome).join(', ')}`
  else if (m.acao?.tipo === 'interacao') texto = m.acao.texto
  else if (m.rolagem) texto = m.rolagem.sem_rolagem ? m.rolagem.label : `${m.rolagem.label}: ${m.rolagem.total}`
  else if (m.conteudo) {
    texto = m.conteudo
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<img[^>]*>/gi, '[imagem]')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto
}
