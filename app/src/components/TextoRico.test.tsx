import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { TextoRico } from './TextoRico'

const html = (t: string) => render(<p><TextoRico texto={t} /></p>).container.innerHTML

describe('texto formatado', () => {
  it('negrito, itálico, sublinhado e riscado', () => {
    expect(html('**forte** e *leve* e __linha__ e ~~fora~~')).toBe('<p><strong>forte</strong> e <em>leve</em> e <u>linha</u> e <s>fora</s></p>')
  })
  it('aninhado e quebra de linha', () => {
    expect(html('**muito *forte* mesmo**\nfim')).toBe('<p><strong>muito <em>forte</em> mesmo</strong><br>fim</p>')
  })
  it('texto comum e HTML ficam como texto', () => {
    expect(html('2 * 3 = 6 <b>x</b>')).toBe('<p>2 * 3 = 6 &lt;b&gt;x&lt;/b&gt;</p>')
  })
})
