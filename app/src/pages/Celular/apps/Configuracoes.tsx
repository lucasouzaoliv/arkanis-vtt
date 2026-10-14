// Configurações: perfil, papel de parede (tela inicial e bloqueio), capinha, aparelho, toques e idioma.
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faApple, faAndroid } from '@fortawesome/free-brands-svg-icons'
import { faArrowLeft, faBell, faChevronRight, faCircleUser, faGlobe, faImage, faMobileScreen, faPalette, faPlay, faCheck } from '@fortawesome/free-solid-svg-icons'
import { useCelular } from '../estado'
import { IDIOMAS, texto } from '../textos'
import { escolherArquivo, escolherImagem } from '../arquivos'
import { tocarNotificacao, tocarToque } from '../sons'

const PAPEIS = ['padrao', 'conhecimento', 'energia', 'medo', 'morte', 'sangue'].map((n) => `/celular/papeis/${n}.webp`)
const CAPINHAS = ['#1d1f24', '#2b2b30', '#e8e3d9', '#c9a227', '#7a1e2b', '#1f4b8f', '#2f6b3a', '#6a3fa0', '#e58fb8', '#ff7a1a']

type Tela = 'menu' | 'perfil' | 'papel' | 'capinha' | 'aparelho' | 'toques' | 'idioma'

export default function AppConfiguracoes() {
  const e = useCelular()
  const c = e.celular
  const idioma = c.idioma
  const [tela, setTela] = useState<Tela>('menu')
  const [ocupado, setOcupado] = useState(false)
  const [tocando, setTocando] = useState<(() => void) | null>(null)
  const ehNpc = 'npc' in e.eu

  async function subirImagem(proporcao: 'quadrado' | 'retrato', titulo: string): Promise<string | null> {
    const f = await escolherImagem(proporcao, titulo)
    if (!f) return null
    setOcupado(true)
    const r = await e.acoes.enviarArquivo(f, f.name)
    setOcupado(false)
    return r.url
  }

  async function subirSom(campo: 'toque_padrao' | 'toque_mensagem') {
    const f = await escolherArquivo('audio/*')
    if (!f) return
    setOcupado(true)
    const r = await e.acoes.enviarArquivo(f, f.name)
    setOcupado(false)
    if (r.url) await e.acoes.mudarCelular({ [campo]: r.url })
  }

  function ouvir(campo: 'toque_padrao' | 'toque_mensagem') {
    tocando?.()
    if (campo === 'toque_mensagem') { tocarNotificacao(c.toque_mensagem); setTocando(null); return }
    const parar = tocarToque(c.toque_padrao)
    setTocando(() => parar)
    window.setTimeout(() => { parar(); setTocando(null) }, 4000)
  }

  const Topo = ({ titulo }: { titulo: string }) => (
    <header className="cel-topo-simples">
      <button type="button" className="cel-link" onClick={() => setTela('menu')} aria-label="Voltar"><FontAwesomeIcon icon={faArrowLeft} /></button>
      <strong>{titulo}</strong><span />
    </header>
  )

  if (ehNpc) {
    return <div className="cel-ajustes"><p className="cel-vazio">Este é o celular de um NPC: o perfil dele muda pela lista de NPCs do mestre.</p></div>
  }

  return (
    <div className="cel-ajustes">
      {tela === 'menu' && (
        <>
          <h1 className="cel-titulo-grande">{texto(idioma, 'configuracoes')}</h1>
          <button type="button" className="cel-ajustes-perfil" onClick={() => setTela('perfil')}>
            <span className="cel-avatar" style={{ width: 54, height: 54, fontSize: 50 }}>{c.foto_perfil ? <img src={c.foto_perfil} alt="" /> : <FontAwesomeIcon icon={faCircleUser} />}</span>
            <span><strong>{c.nome_no_perfil || 'Sem nome'}</strong><small>{c.numero}</small></span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <div className="cel-ajustes-grupo">
            {([
              ['papel', faImage, texto(idioma, 'papelDeParede'), '#3a82f7'],
              ['capinha', faPalette, texto(idioma, 'capinha'), '#ff9500'],
              ['aparelho', faMobileScreen, texto(idioma, 'aparelho'), '#8e8e93'],
              ['toques', faBell, texto(idioma, 'toques'), '#ff2d55'],
              ['idioma', faGlobe, texto(idioma, 'idioma'), '#34c759'],
            ] as const).map(([id, icone, nome, cor]) => (
              <button key={id} type="button" className="cel-ajustes-item" onClick={() => setTela(id)}>
                <span className="cel-ajustes-icone" style={{ background: cor }}><FontAwesomeIcon icon={icone} /></span>
                <span>{nome}</span>
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            ))}
          </div>
          <p className="cel-dica">Bateria: {c.bateria}%</p>
        </>
      )}

      {tela === 'perfil' && (
        <>
          <Topo titulo={texto(idioma, 'perfil')} />
          <div className="cel-form">
            <button type="button" className="cel-config-foto" disabled={ocupado} onClick={async () => { const u = await subirImagem('quadrado', 'Foto do perfil'); if (u) await e.acoes.mudarCelular({ foto_perfil: u }) }}>
              {c.foto_perfil ? <img src={c.foto_perfil} alt="" /> : <FontAwesomeIcon icon={faCircleUser} />}
              <small>{ocupado ? '…' : texto(idioma, 'trocar')}</small>
            </button>
            <label className="cel-campo"><span>{texto(idioma, 'nome')}</span>
              <input defaultValue={c.nome_no_perfil ?? ''} maxLength={80} onBlur={(ev) => void e.acoes.mudarCelular({ nome_no_perfil: ev.target.value.trim() || null })} />
            </label>
            <label className="cel-campo"><span>{texto(idioma, 'recado')}</span>
              <input defaultValue={c.recado ?? ''} maxLength={200} placeholder="Disponível" onBlur={(ev) => void e.acoes.mudarCelular({ recado: ev.target.value.trim() || null })} />
            </label>
            <label className="cel-campo"><span>{texto(idioma, 'numero')}</span>
              <input defaultValue={c.numero ?? ''} maxLength={30} onBlur={(ev) => void e.acoes.mudarCelular({ numero: ev.target.value.trim() || null })} />
            </label>
          </div>
        </>
      )}

      {tela === 'papel' && (
        <>
          <Topo titulo={texto(idioma, 'papelDeParede')} />
          {(['papel_de_parede', 'papel_de_bloqueio'] as const).map((campo) => (
            <div key={campo} className="cel-form">
              <strong className="cel-subtitulo">{texto(idioma, campo === 'papel_de_parede' ? 'telaInicial' : 'telaDeBloqueio')}</strong>
              <div className="cel-papeis">
                <button type="button" className="cel-papel cel-papel-novo" disabled={ocupado} onClick={async () => { const u = await subirImagem('retrato', 'Papel de parede'); if (u) await e.acoes.mudarCelular({ [campo]: u }) }}>+</button>
                {PAPEIS.map((p) => (
                  <button key={p} type="button" className={`cel-papel${c[campo] === p ? ' ativo' : ''}`} style={{ backgroundImage: `url(${p})` }} onClick={() => void e.acoes.mudarCelular({ [campo]: p })} />
                ))}
                {c[campo] && !PAPEIS.includes(c[campo]!) && <span className="cel-papel ativo" style={{ backgroundImage: `url(${c[campo]})` }} />}
              </div>
              {campo === 'papel_de_bloqueio' && c.papel_de_bloqueio && (
                <button type="button" className="cel-link" onClick={() => void e.acoes.mudarCelular({ papel_de_bloqueio: null })}>Usar o mesmo da tela inicial</button>
              )}
            </div>
          ))}
        </>
      )}

      {tela === 'capinha' && (
        <>
          <Topo titulo={texto(idioma, 'capinha')} />
          <div className="cel-form">
            <div className="cel-capinhas">
              {CAPINHAS.map((cor) => (
                <button key={cor} type="button" className={`cel-capinha${c.capinha.cor === cor ? ' ativo' : ''}`} style={{ background: cor }} onClick={() => void e.acoes.mudarCelular({ capinha: { ...c.capinha, cor } })} aria-label={cor} />
              ))}
              <label className="cel-capinha cel-capinha-livre" title="Outra cor">
                <input type="color" value={c.capinha.cor ?? '#1d1f24'} onChange={(ev) => void e.acoes.mudarCelular({ capinha: { ...c.capinha, cor: ev.target.value } })} />
              </label>
            </div>
            <strong className="cel-subtitulo">Textura</strong>
            <div className="cel-capinhas">
              {['lisa', 'fosca', 'couro', 'glitter'].map((t) => (
                <button key={t} type="button" className={`cel-textura cel-textura-${t}${(c.capinha.textura ?? 'lisa') === t ? ' ativo' : ''}`} onClick={() => void e.acoes.mudarCelular({ capinha: { ...c.capinha, textura: t } })}>{t}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {tela === 'aparelho' && (
        <>
          <Topo titulo={texto(idioma, 'aparelho')} />
          <div className="cel-config-aparelhos">
            {(['iphone', 'android'] as const).map((m) => (
              <button key={m} type="button" className={`cel-config-aparelho${c.modelo === m ? ' ativo' : ''}`} onClick={() => void e.acoes.mudarCelular({ modelo: m })}>
                <FontAwesomeIcon icon={m === 'iphone' ? faApple : faAndroid} />
                <span>{m === 'iphone' ? 'iPhone' : 'Samsung'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tela === 'toques' && (
        <>
          <Topo titulo={texto(idioma, 'toques')} />
          <div className="cel-form">
            {(['toque_padrao', 'toque_mensagem'] as const).map((campo) => (
              <div key={campo} className="cel-toque">
                <span><strong>{texto(idioma, campo === 'toque_padrao' ? 'toqueLigacao' : 'toqueMensagem')}</strong><small>{c[campo] ? 'mp3 escolhido' : 'padrão'}</small></span>
                <button type="button" className="cel-link" onClick={() => ouvir(campo)} aria-label="Ouvir"><FontAwesomeIcon icon={faPlay} /></button>
                <button type="button" className="cel-botao-secundario" disabled={ocupado} onClick={() => subirSom(campo)}>{texto(idioma, 'trocar')}</button>
                {c[campo] && <button type="button" className="cel-link" onClick={() => void e.acoes.mudarCelular({ [campo]: null })}>{texto(idioma, 'tirar')}</button>}
              </div>
            ))}
            <p className="cel-dica">Dá pra pôr um toque diferente pra cada contato no app Telefone.</p>
          </div>
        </>
      )}

      {tela === 'idioma' && (
        <>
          <Topo titulo={texto(idioma, 'idioma')} />
          <div className="cel-lista">
            {IDIOMAS.map((i) => (
              <button key={i.id} type="button" className="cel-lista-item" onClick={() => void e.acoes.mudarCelular({ idioma: i.id })}>
                <span>{i.nome}</span>{c.idioma === i.id && <FontAwesomeIcon icon={faCheck} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
