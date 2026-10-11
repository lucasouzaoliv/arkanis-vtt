import { Fragment, useRef, type ReactNode, type TextareaHTMLAttributes } from 'react'

// Formatação de texto nas descrições (sugestão 11/10): **negrito**, *itálico*, __sublinhado__ e
// ~~riscado~~. O texto continua guardado como texto simples com essas marcas; aqui só se mostra
// formatado (sem HTML solto, então nada do texto vira código na página).

const MARCAS: { abre: string; tag: 'strong' | 'em' | 'u' | 's' }[] = [
  { abre: '**', tag: 'strong' },
  { abre: '__', tag: 'u' },
  { abre: '~~', tag: 's' },
  { abre: '*', tag: 'em' },
]

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// A primeira marca que fecha na mesma linha; a ordem acima faz "**" vencer "*".
const PADRAO = new RegExp(MARCAS.map((m) => `${escapar(m.abre)}(?=\\S)([^\\n]*?\\S)${escapar(m.abre)}`).join('|'))

export function partesFormatadas(texto: string, chave = 'f'): ReactNode[] {
  const saida: ReactNode[] = []
  let resto = texto
  let n = 0
  while (resto) {
    const m = PADRAO.exec(resto)
    if (!m) { saida.push(resto); break }
    if (m.index > 0) saida.push(resto.slice(0, m.index))
    const qual = m.slice(1).findIndex((g) => g !== undefined)
    const Tag = MARCAS[qual].tag
    saida.push(<Tag key={`${chave}-${n++}`}>{partesFormatadas(m[qual + 1], `${chave}-${n}`)}</Tag>)
    resto = resto.slice(m.index + m[0].length)
  }
  return saida
}

export function TextoRico({ texto }: { texto: string | null | undefined }) {
  const linhas = String(texto ?? '').split('\n')
  return (
    <>
      {linhas.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {partesFormatadas(l, `l${i}`)}
        </Fragment>
      ))}
    </>
  )
}

const BOTOES: { marca: string; rotulo: ReactNode; titulo: string }[] = [
  { marca: '**', rotulo: <strong>B</strong>, titulo: 'Negrito' },
  { marca: '*', rotulo: <em>I</em>, titulo: 'Itálico' },
  { marca: '__', rotulo: <u>U</u>, titulo: 'Sublinhado' },
  { marca: '~~', rotulo: <s>S</s>, titulo: 'Riscado' },
]

// <textarea> com a barra de formatação em cima: marca o trecho selecionado (ou o cursor).
export function TextareaFormatada(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function marcar(marca: string) {
    const el = ref.current
    if (!el) return
    const { selectionStart: ini, selectionEnd: fim, value } = el
    const novo = value.slice(0, ini) + marca + value.slice(ini, fim) + marca + value.slice(fim)
    // Passa pelo onChange de quem usa (o React só escuta o evento de input nativo).
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, novo)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.focus()
    el.setSelectionRange(ini + marca.length, fim + marca.length)
  }

  return (
    <div className="texto-formatado">
      <div className="texto-formatado-barra" role="toolbar" aria-label="Formatação">
        {BOTOES.map((b) => (
          <button key={b.marca} type="button" title={b.titulo} aria-label={b.titulo} onMouseDown={(e) => e.preventDefault()} onClick={() => marcar(b.marca)}>
            {b.rotulo}
          </button>
        ))}
      </div>
      <textarea ref={ref} {...props} />
    </div>
  )
}
