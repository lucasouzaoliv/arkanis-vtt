// Loja (App Store no iPhone, Play Store no Android): baixar e remover apps. Os de fábrica não saem;
// os que ainda não abrem ficam só com o ícone na tela inicial.
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { APPS, desinstalarApp, instalarApp, nomeDaLoja } from '../dados'
import { useCelular } from '../estado'
import { IconeDoApp } from '../IconeDoApp'
import { texto } from '../textos'

export default function AppLoja() {
  const e = useCelular()
  const c = e.celular
  const idioma = c.idioma
  const [busca, setBusca] = useState('')
  const [baixando, setBaixando] = useState<string | null>(null)
  const lista = APPS.filter((a) => a.id !== 'loja' && a.nome.toLowerCase().includes(busca.toLowerCase()))

  async function baixar(id: string) {
    setBaixando(id)
    // Um tempinho de "baixando", pra parecer celular.
    await new Promise((r) => setTimeout(r, 900))
    await e.acoes.mudarCelular({ apps: instalarApp(c.apps, id) })
    setBaixando(null)
  }

  return (
    <div className={`cel-loja cel-loja-${c.modelo}`}>
      <h1 className="cel-titulo-grande">{nomeDaLoja(c.modelo)}</h1>
      <label className="cel-busca">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <input placeholder={texto(idioma, 'buscar')} value={busca} onChange={(ev) => setBusca(ev.target.value)} />
      </label>
      <div className="cel-lista">
        {lista.map((a) => {
          const tem = c.apps.instalados.includes(a.id)
          return (
            <div key={a.id} className="cel-loja-item">
              <IconeDoApp id={a.id} modelo={c.modelo} tamanho={46} />
              <span><strong>{a.nome}</strong><small>{a.descricao ?? (a.funciona ? 'Aplicativo' : 'Só o ícone, por enquanto')}</small></span>
              {baixando === a.id ? (
                <span className="cel-baixando" role="progressbar" aria-label="Baixando">
                  <svg viewBox="0 0 36 36"><circle className="cel-baixando-fundo" cx="18" cy="18" r="15" /><circle className="cel-baixando-anel" cx="18" cy="18" r="15" /></svg>
                  <i />
                </span>
              ) : tem ? (
                a.deFabrica ? <small className="cel-instalado">{texto(idioma, 'instalado')}</small> : (
                  <button type="button" className="cel-botao-loja secundario" onClick={() => void e.acoes.mudarCelular({ apps: desinstalarApp(c.apps, a.id) })}>{texto(idioma, 'remover')}</button>
                )
              ) : (
                <button type="button" className="cel-botao-loja" onClick={() => baixar(a.id)}>
                  {c.modelo === 'iphone' ? texto(idioma, 'obter') : <><FontAwesomeIcon icon={faDownload} /> {texto(idioma, 'instalar')}</>}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
