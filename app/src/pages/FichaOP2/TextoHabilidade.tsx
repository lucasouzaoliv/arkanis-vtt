import { Fragment, type ReactNode } from 'react'
import DadoIcone from './DadoIcone'
import { ehDado } from '../../sistemas/op2/dados'

// Texto das habilidades do OP2 (sempre no mesmo padrão, pedido da Millie): **negrito** sai na cor do
// tema, {d4} vira o ícone do dado e as linhas "- " viram lista.

function trecho(texto: string, chave: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*|\{d\d+\})/g).filter(Boolean).map((t, i) => {
    if (t.startsWith('**')) return <strong key={`${chave}-${i}`} className="op2-destaque">{t.slice(2, -2)}</strong>
    const d = /^\{d(\d+)\}$/.exec(t)
    if (d && ehDado(Number(d[1]))) return <DadoIcone key={`${chave}-${i}`} lados={Number(d[1]) as 4} tamanho={18} className="op2-dado-inline" />
    return <Fragment key={`${chave}-${i}`}>{t}</Fragment>
  })
}

export default function TextoHabilidade({ texto }: { texto: string }) {
  const blocos: ReactNode[] = []
  let lista: string[] = []
  const fecharLista = () => {
    if (lista.length) blocos.push(<ul key={`l${blocos.length}`}>{lista.map((l, i) => <li key={i}>{trecho(l, `li${blocos.length}-${i}`)}</li>)}</ul>)
    lista = []
  }
  for (const linha of texto.split('\n')) {
    if (linha.startsWith('- ')) lista.push(linha.slice(2))
    else {
      fecharLista()
      if (linha.trim()) blocos.push(<p key={`p${blocos.length}`}>{trecho(linha, `p${blocos.length}`)}</p>)
    }
  }
  fecharLista()
  return <div className="op2-texto">{blocos}</div>
}
