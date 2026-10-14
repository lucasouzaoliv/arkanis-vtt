// Primeira vez que o celular liga (pedido da Millie, 13/10): "Olá" em vários idiomas, escolher o
// idioma, o aparelho (iPhone ou Samsung) e o perfil. Ele vem só com Telefone, Mensagens,
// Configurações, Mapas e a loja; o resto se baixa depois.
import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faApple, faAndroid } from '@fortawesome/free-brands-svg-icons'
import { faCircleUser, faCheck } from '@fortawesome/free-solid-svg-icons'
import { useCelular } from './estado'
import { IDIOMAS, texto } from './textos'
import { escolherImagem } from './arquivos'
import type { Modelo } from './dados'

const OLAS = ['Olá', 'Hello', 'Hola', 'Bonjour', 'Ciao', 'Hallo', 'こんにちは', 'Привет']

export default function ConfiguracaoInicial() {
  const e = useCelular()
  const [passo, setPasso] = useState(0)
  const [idioma, setIdioma] = useState(e.celular.idioma || 'pt-BR')
  const [modelo, setModelo] = useState<Modelo>(e.celular.modelo)
  const [nome, setNome] = useState(e.celular.nome_no_perfil ?? '')
  const [foto, setFoto] = useState<string | null>(e.celular.foto_perfil)
  const [ola, setOla] = useState(0)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (passo !== 0) return
    const t = window.setInterval(() => setOla((i) => (i + 1) % OLAS.length), 1400)
    return () => window.clearInterval(t)
  }, [passo])

  async function trocarFoto() {
    const f = await escolherImagem('quadrado', 'Foto do perfil')
    if (!f) return
    setEnviando(true)
    const r = await e.acoes.enviarArquivo(f, f.name)
    setEnviando(false)
    if (r.url) setFoto(r.url)
  }

  async function terminar() {
    await e.acoes.mudarCelular({ idioma, modelo, nome_no_perfil: nome.trim() || e.celular.nome_no_perfil, foto_perfil: foto, configurado: true })
  }

  return (
    <div className={`cel-config cel-config-${modelo}`}>
      {passo === 0 && (
        <button type="button" className="cel-config-ola" onClick={() => setPasso(1)}>
          <span key={ola} className="cel-ola-palavra">{OLAS[ola]}</span>
          <small>{texto(idioma, 'comecar')} ›</small>
        </button>
      )}

      {passo === 1 && (
        <div className="cel-config-passo">
          <h2>{texto(idioma, 'idioma')}</h2>
          <div className="cel-lista">
            {IDIOMAS.map((i) => (
              <button key={i.id} type="button" className="cel-lista-item" onClick={() => setIdioma(i.id)}>
                <span>{i.nome}</span>
                {idioma === i.id && <FontAwesomeIcon icon={faCheck} />}
              </button>
            ))}
          </div>
          <button type="button" className="cel-botao-principal" onClick={() => setPasso(2)}>{texto(idioma, 'continuar')}</button>
        </div>
      )}

      {passo === 2 && (
        <div className="cel-config-passo">
          <h2>{texto(idioma, 'escolhaAparelho')}</h2>
          <div className="cel-config-aparelhos">
            {(['iphone', 'android'] as const).map((m) => (
              <button key={m} type="button" className={`cel-config-aparelho${modelo === m ? ' ativo' : ''}`} onClick={() => setModelo(m)}>
                <FontAwesomeIcon icon={m === 'iphone' ? faApple : faAndroid} />
                <span>{m === 'iphone' ? 'iPhone' : 'Samsung'}</span>
              </button>
            ))}
          </div>
          <button type="button" className="cel-botao-principal" onClick={() => setPasso(3)}>{texto(idioma, 'continuar')}</button>
        </div>
      )}

      {passo === 3 && (
        <div className="cel-config-passo">
          <h2>{texto(idioma, 'seuPerfil')}</h2>
          <button type="button" className="cel-config-foto" onClick={trocarFoto} disabled={enviando}>
            {foto ? <img src={foto} alt="" /> : <FontAwesomeIcon icon={faCircleUser} />}
            <small>{enviando ? '…' : texto(idioma, 'trocar')}</small>
          </button>
          <label className="cel-campo">
            <span>{texto(idioma, 'nome')}</span>
            <input value={nome} maxLength={80} onChange={(ev) => setNome(ev.target.value)} />
          </label>
          <button type="button" className="cel-botao-principal" onClick={() => setPasso(4)}>{texto(idioma, 'continuar')}</button>
        </div>
      )}

      {passo === 4 && (
        <div className="cel-config-passo cel-config-fim">
          <FontAwesomeIcon icon={faCheck} className="cel-config-ok" />
          <h2>{texto(idioma, 'pronto')}</h2>
          <button type="button" className="cel-botao-principal" onClick={terminar}>{texto(idioma, 'comecar')}</button>
        </div>
      )}

      {passo > 0 && passo < 4 && (
        <div className="cel-pontos cel-config-pontos">{[1, 2, 3].map((i) => <span key={i} className={i === passo ? 'ativo' : ''} />)}</div>
      )}
    </div>
  )
}
