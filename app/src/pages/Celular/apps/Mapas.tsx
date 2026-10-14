// Mapas: o mapa da cidade que o mestre escolhe, com os pontos que ele marca (pra todos ou só pra
// alguns celulares) e o "Você está aqui" de cada um. Sem sinal, o GPS some.
import { useRef, useState } from 'react'
import { escalaDe } from '../tamanho'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationCrosshairs, faLocationDot, faMagnifyingGlass, faMinus, faPlus, faImage, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useCelular } from '../estado'
import { texto } from '../textos'
import { apagarPonto, criarPonto, mapaDa, salvarMapa, useAoVivo, type Mapa, type PontoNoMapa } from '../dadosDosApps'
import { escolherImagem } from '../arquivos'

type Novo = { x: number; y: number; nome: string; descricao: string; cor: string; quem: string }

const CORES = ['#ff3b30', '#007aff', '#34c759', '#ff9500', '#af52de', '#e0b13a']

export default function AppMapas() {
  const e = useCelular()
  const idioma = e.celular.idioma
  const campanha = e.celular.campaign_id
  const meu = 'celular' in e.eu ? e.eu.celular : null
  const [mapa, setMapa] = useState<Mapa | null>(null)
  const [pontos, setPontos] = useState<PontoNoMapa[]>([])
  const [zoom, setZoom] = useState(1)
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<PontoNoMapa | null>(null)
  const [novo, setNovo] = useState<Novo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const area = useRef<HTMLDivElement>(null)
  // Arrastar o mapa (pedido 14/10): clica e arrasta pra andar por ele; arrastou, não marca ponto.
  const arrasto = useRef<{ x: number; y: number; sl: number; st: number; moveu: boolean } | null>(null)
  const arrastou = useRef(false)

  // Zoom mantendo o meio da tela no mesmo lugar do mapa.
  function mudarZoom(novo: number) {
    const el = area.current
    const z = Math.min(4, Math.max(1, novo))
    if (!el || z === zoom) { setZoom(z); return }
    const cx = (el.scrollLeft + el.clientWidth / 2) / zoom
    const cy = (el.scrollTop + el.clientHeight / 2) / zoom
    setZoom(z)
    requestAnimationFrame(() => { el.scrollLeft = cx * z - el.clientWidth / 2; el.scrollTop = cy * z - el.clientHeight / 2 })
  }
  useAoVivo('celular_mapa_pontos', `campaign_id=eq.${campanha}`, () => { void mapaDa(campanha).then((r) => { setMapa(r.mapa); setPontos(r.pontos) }) })
  useAoVivo('celular_mapas', `campaign_id=eq.${campanha}`, () => { void mapaDa(campanha).then((r) => setMapa(r.mapa)) })

  const semSinal = !!e.celular.efeitos.sem_sinal
  const visiveis = pontos.filter((p) => !busca.trim() || p.nome.toLowerCase().includes(busca.toLowerCase()))

  async function trocarMapa() {
    const f = await escolherImagem('original', 'Mapa da cidade')
    if (!f) return
    const r = await e.acoes.enviarArquivo(f, f.name)
    if (r.url) setErro(await salvarMapa(campanha, r.url))
  }

  function clicouNoMapa(ev: React.MouseEvent<HTMLImageElement>) {
    if (!e.souMestre || arrastou.current) return
    const r = ev.currentTarget.getBoundingClientRect()
    setNovo({ x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height, nome: '', descricao: '', cor: CORES[0], quem: 'todos' })
  }

  async function salvarNovo() {
    if (!novo?.nome.trim()) { setErro('Dê um nome pro ponto.'); return }
    const local = novo.quem.startsWith('local:') ? novo.quem.slice(6) : null
    const so = novo.quem.startsWith('so:') ? [novo.quem.slice(3)] : null
    setErro(await criarPonto({ campaign_id: campanha, nome: novo.nome.trim(), descricao: novo.descricao.trim() || null, x: novo.x, y: novo.y, cor: novo.cor, celular_id: local, visivel_para: so }))
    setNovo(null)
  }

  if (!mapa?.imagem) {
    return (
      <div className="cel-mapas">
        <div className="cel-mapas-fundo" />
        <div className="cel-mapas-aviso">
          <FontAwesomeIcon icon={faLocationCrosshairs} />
          <p>{semSinal ? texto(idioma, 'semServico') : texto(idioma, 'semLocalizacao')}</p>
        </div>
        {e.souMestre && <button type="button" className="cel-botao-principal cel-mapas-escolher" onClick={trocarMapa}><FontAwesomeIcon icon={faImage} /> Escolher o mapa da cidade</button>}
        {erro && <p className="cel-erro">{erro}</p>}
      </div>
    )
  }

  return (
    <div className="cel-mapas cel-mapas-com-mapa">
      <label className="cel-busca cel-mapas-busca">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <input placeholder={texto(idioma, 'buscar')} value={busca} onChange={(ev) => setBusca(ev.target.value)} />
      </label>
      <div
        className="cel-mapas-area"
        ref={area}
        onPointerDown={(ev) => {
          if ((ev.target as HTMLElement).closest('button')) return
          const el = ev.currentTarget
          arrasto.current = { x: ev.clientX, y: ev.clientY, sl: el.scrollLeft, st: el.scrollTop, moveu: false }
          arrastou.current = false
        }}
        onPointerMove={(ev) => {
          const a = arrasto.current
          if (!a) return
          const k = escalaDe(ev.currentTarget)
          const dx = (ev.clientX - a.x) / k
          const dy = (ev.clientY - a.y) / k
          if (!a.moveu && Math.hypot(dx, dy) > 5) { a.moveu = true; arrastou.current = true; ev.currentTarget.setPointerCapture(ev.pointerId) }
          if (a.moveu) { ev.currentTarget.scrollLeft = a.sl - dx; ev.currentTarget.scrollTop = a.st - dy }
        }}
        onPointerUp={() => { arrasto.current = null; window.setTimeout(() => { arrastou.current = false }, 0) }}
        onPointerCancel={() => { arrasto.current = null; arrastou.current = false }}
        onWheel={(ev) => { if (ev.deltaY) mudarZoom(zoom + (ev.deltaY < 0 ? 0.25 : -0.25)) }}
      >
        <div className="cel-mapas-tela" style={{ width: `${zoom * 100}%` }}>
          <img src={mapa.imagem} alt="" draggable={false} onClick={clicouNoMapa} className={`${semSinal ? 'sem-sinal' : ''}${e.souMestre ? ' mestre' : ''}`} />
          {!semSinal && visiveis.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`cel-pino${p.celular_id ? ' voce' : ''}`}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, color: p.cor ?? '#ff3b30' }}
              onClick={() => setEscolhido(p)}
              aria-label={p.nome}
            >
              {p.celular_id ? <span className="cel-pino-voce" /> : <FontAwesomeIcon icon={faLocationDot} />}
            </button>
          ))}
        </div>
      </div>
      <div className="cel-mapas-zoom">
        <button type="button" onClick={() => mudarZoom(zoom + 0.5)} aria-label="Aproximar"><FontAwesomeIcon icon={faPlus} /></button>
        <button type="button" onClick={() => mudarZoom(zoom - 0.5)} aria-label="Afastar"><FontAwesomeIcon icon={faMinus} /></button>
        {e.souMestre && <button type="button" onClick={trocarMapa} aria-label="Trocar o mapa"><FontAwesomeIcon icon={faImage} /></button>}
      </div>
      {semSinal && <div className="cel-mapas-aviso"><FontAwesomeIcon icon={faLocationCrosshairs} /><p>{texto(idioma, 'semServico')}</p></div>}

      {escolhido && (
        <div className="cel-mapas-ficha">
          <button type="button" className="cel-link cel-mapas-fechar" onClick={() => setEscolhido(null)} aria-label="Fechar"><FontAwesomeIcon icon={faXmark} /></button>
          <strong>{escolhido.celular_id ? (escolhido.celular_id === meu ? 'Você está aqui' : `${e.celulares.find((c) => c.id === escolhido.celular_id)?.nome_no_perfil ?? 'Alguém'} está aqui`) : escolhido.nome}</strong>
          {escolhido.celular_id && <small>{escolhido.nome}</small>}
          {escolhido.descricao && <p>{escolhido.descricao}</p>}
          {e.souMestre && <button type="button" className="cel-link perigo" onClick={async () => { await apagarPonto(escolhido.id); setEscolhido(null) }}><FontAwesomeIcon icon={faTrash} /> Tirar ponto</button>}
        </div>
      )}

      {novo && (
        <div className="cel-mapas-ficha">
          <strong>Novo ponto</strong>
          <input className="cel-input" placeholder="Nome (Manicômio)" value={novo.nome} maxLength={80} onChange={(ev) => setNovo({ ...novo, nome: ev.target.value })} autoFocus />
          <input className="cel-input" placeholder="Descrição (opcional)" value={novo.descricao} maxLength={1000} onChange={(ev) => setNovo({ ...novo, descricao: ev.target.value })} />
          <select className="cel-input" value={novo.quem} onChange={(ev) => setNovo({ ...novo, quem: ev.target.value })}>
            <option value="todos">Todo mundo vê</option>
            {e.celulares.map((c) => <option key={`so:${c.id}`} value={`so:${c.id}`}>Só {c.nome_no_perfil || c.numero} vê</option>)}
            {e.celulares.map((c) => <option key={`local:${c.id}`} value={`local:${c.id}`}>{c.nome_no_perfil || c.numero} está aqui</option>)}
          </select>
          <div className="cel-capinhas">
            {CORES.map((c) => <button key={c} type="button" className={`cel-capinha${novo.cor === c ? ' ativo' : ''}`} style={{ background: c, width: 26, height: 26 }} onClick={() => setNovo({ ...novo, cor: c })} aria-label={c} />)}
          </div>
          <div className="cel-linha-acoes">
            <button type="button" className="cel-botao-secundario" onClick={() => setNovo(null)}>{texto(idioma, 'cancelar')}</button>
            <button type="button" className="cel-botao-secundario" onClick={salvarNovo}>{texto(idioma, 'salvar')}</button>
          </div>
        </div>
      )}
      {e.souMestre && !novo && !escolhido && <p className="cel-mapas-dica">Toque no mapa pra marcar um ponto.</p>}
      {erro && <p className="cel-erro" onClick={() => setErro(null)}>{erro}</p>}
    </div>
  )
}
