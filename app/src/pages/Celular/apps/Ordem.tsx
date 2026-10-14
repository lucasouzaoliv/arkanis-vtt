// App da Ordo Realitas (pedido da Millie, 14/10): um canal seguro com cara de terminal verde
// (Share Tech Mono, o brasão da Ordem). Por dentro são as mesmas conversas das Mensagens, mas só as
// que vivem neste app.
import { useEffect, useState } from 'react'
import { Brasao } from '../Brasao'
import AppMensagens from './Mensagens'

const LINHAS = ['> estabelecendo conexão segura…', '> verificando credenciais do agente…', '> membrana: estável', '> acesso concedido.']

export default function AppOrdem() {
  const [linha, setLinha] = useState(0)
  const pronto = linha >= LINHAS.length
  useEffect(() => {
    if (pronto) return
    const t = window.setTimeout(() => setLinha((n) => n + 1), linha === 0 ? 350 : 420)
    return () => window.clearTimeout(t)
  }, [linha, pronto])

  if (!pronto) {
    return (
      <div className="cel-ordem-abertura" onClick={() => setLinha(LINHAS.length)}>
        <Brasao tamanho={110} className="cel-brasao-pulsa" />
        <div className="cel-ordem-terminal">
          {LINHAS.slice(0, linha + 1).map((l) => <p key={l}>{l}</p>)}
          <span className="cel-cursor">_</span>
        </div>
      </div>
    )
  }
  return <AppMensagens app="ordem" />
}
