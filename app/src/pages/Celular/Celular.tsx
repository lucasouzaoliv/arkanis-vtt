// O celular (pedido da Millie, 13/10; referências: iPhone e Samsung "estilo FiveM"). Tela de
// bloqueio que abre deslizando pra cima, tela inicial com páginas que deslizam pros lados e dock,
// apps que abrem expandindo do ícone e fecham pela barrinha de baixo. A hora é a do relógio do jogo.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBatteryEmpty, faBatteryFull, faBatteryHalf, faBatteryQuarter, faBatteryThreeQuarters, faLock, faSignal, faWifi } from '@fortawesome/free-solid-svg-icons'
import { comAgora, momento, nomeDoMes, diasDaSemana, textoHora, tempoAtivo, tempoCompleto } from '../Mesa/tempo'
import { corDoElemento } from '../CharacterSheet/danoDaArma'
import { APPS, type Modelo } from './dados'
import { CelularContexto, useCelular, minhasConversas, type EstadoDoCelular } from './estado'
import { IconeDoApp } from './IconeDoApp'
import { texto } from './textos'
import { naoLidas } from './dados'
import ConfiguracaoInicial from './ConfiguracaoInicial'
import TelaDeLigacao from './TelaDeLigacao'
import AppMensagens from './apps/Mensagens'
import AppTelefone from './apps/Telefone'
import AppConfiguracoes from './apps/Configuracoes'
import AppLoja from './apps/Loja'
import AppGaleria from './apps/Galeria'
import AppMapas from './apps/Mapas'
import AppOrdem from './apps/Ordem'
import AppNotas from './apps/Notas'
import AppNoticias from './apps/Noticias'
import AppInstagram from './apps/Instagram'
import AppEmail from './apps/Email'
import AppCalculadora from './apps/Calculadora'
import AppClima from './apps/Clima'
import RecadoDeVoz from './RecadoDeVoz'
import { ehEu } from './estado'
import './celular.css'
import { escalaDe } from './tamanho'

// ---- Hora do jogo, andando ----

export function useAgoraNoJogo(tempo: EstadoDoCelular['tempo']): { hora: string; horas: string; minutos: string; data: string } {
  const [, setTique] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setTique((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [])
  if (tempo && tempoAtivo(tempo)) {
    const t = comAgora(tempoCompleto(tempo))
    const m = momento(t)
    const hora = textoHora(m, { formato: t.formato })
    const [hh, mm] = textoHora(m).split(':')
    const data = t.calendario ? `${diasDaSemana(t)[m.semana]}, ${m.data.dia} de ${nomeDoMes(t, m.data.mes)}` : `Dia ${m.dia + 1}`
    return { hora, horas: hh, minutos: mm, data }
  }
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return { hora: `${hh}:${mm}`, horas: hh, minutos: mm, data: d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }
}

// ---- Barra de status ----

function IconeDaBateria({ nivel }: { nivel: number }) {
  const icone = nivel <= 5 ? faBatteryEmpty : nivel <= 30 ? faBatteryQuarter : nivel <= 60 ? faBatteryHalf : nivel <= 85 ? faBatteryThreeQuarters : faBatteryFull
  return <FontAwesomeIcon icon={icone} className={nivel <= 15 ? 'cel-bateria-baixa' : undefined} />
}

function BarraDeStatus({ escura }: { escura?: boolean }) {
  const e = useCelular()
  const { hora } = useAgoraNoJogo(e.tempo)
  const semSinal = !!e.celular.efeitos.sem_sinal
  return (
    <div className={`cel-status cel-status-${e.celular.modelo}${escura ? ' escura' : ''}`}>
      <span className="cel-status-hora">{hora}</span>
      <span className="cel-status-direita">
        {semSinal ? <span className="cel-sem-servico">{texto(e.celular.idioma, 'semServico')}</span> : <><FontAwesomeIcon icon={faSignal} /><FontAwesomeIcon icon={faWifi} /></>}
        <span className="cel-bateria-texto">{e.celular.bateria}%</span>
        <IconeDaBateria nivel={e.celular.bateria} />
      </span>
    </div>
  )
}

// ---- Tela de bloqueio: arrasta pra cima e solta (ou clica na barrinha) ----

function TelaDeBloqueio({ onAbrir }: { onAbrir: () => void }) {
  const e = useCelular()
  const agora = useAgoraNoJogo(e.tempo)
  const [puxado, setPuxado] = useState(0)
  const inicio = useRef<number | null>(null)
  const idioma = e.celular.idioma
  const notificacoes = useMemo(() => {
    if (!('celular' in e.eu)) return []
    const meu = e.eu.celular
    return minhasConversas(e, 'mensagens').concat(minhasConversas(e, 'ordem')).flatMap((c) => {
      const p = e.participantes.find((x) => x.conversa_id === c.id && x.celular_id === meu)
      const lista = e.mensagens[c.id] ?? []
      const n = naoLidas(lista, meu, p?.lida_ate ?? null)
      const ultima = lista[lista.length - 1]
      return n && ultima ? [{ id: c.id, n, texto: ultima.apagada ? texto(idioma, 'apagada') : ultima.texto ?? `📎 ${ultima.tipo}` }] : []
    }).slice(0, 3)
  }, [e, idioma])

  function soltar() {
    if (puxado > 110) onAbrir()
    setPuxado(0)
    inicio.current = null
  }

  return (
    <div
      className={`cel-bloqueio cel-bloqueio-${e.celular.modelo}`}
      style={{ transform: `translateY(${-puxado}px)`, opacity: 1 - puxado / 400, transition: inicio.current === null ? 'transform .3s, opacity .3s' : 'none' }}
      onPointerDown={(ev) => { inicio.current = ev.clientY; ev.currentTarget.setPointerCapture(ev.pointerId) }}
      onPointerMove={(ev) => { if (inicio.current !== null) setPuxado(Math.max(0, (inicio.current - ev.clientY) / escalaDe(ev.currentTarget))) }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      <FontAwesomeIcon icon={faLock} className="cel-cadeado" />
      {e.celular.modelo === 'android' ? (
        <div className="cel-relogio-samsung">
          <span>{agora.horas}</span>
          <span>{agora.minutos}</span>
          <small>{agora.data}</small>
        </div>
      ) : (
        <div className="cel-relogio-iphone">
          <small>{agora.data}</small>
          <span>{agora.horas}:{agora.minutos}</span>
        </div>
      )}
      <div className="cel-notificacoes">
        {notificacoes.map((n) => (
          <div className="cel-notificacao" key={n.id}>
            <IconeDoApp id="mensagens" modelo={e.celular.modelo} tamanho={26} />
            <span>{n.texto}</span>
            {n.n > 1 && <b>{n.n}</b>}
          </div>
        ))}
      </div>
      <p className="cel-deslize">{texto(idioma, 'deslize')}</p>
    </div>
  )
}

// ---- Tela inicial: páginas de 4 colunas, dock embaixo ----

const POR_PAGINA = 20

function TelaInicial({ onAbrir }: { onAbrir: (id: string, origem: DOMRect) => void }) {
  const e = useCelular()
  const instalados = e.celular.apps.instalados.filter((id) => APPS.some((a) => a.id === id))
  const dock = (e.celular.apps.dock ?? ['telefone', 'mensagens', 'camera', 'configuracoes']).filter((id) => instalados.includes(id)).slice(0, 4)
  const naGrade = instalados.filter((id) => !dock.includes(id))
  const paginas: string[][] = []
  for (let i = 0; i < Math.max(1, naGrade.length); i += POR_PAGINA) paginas.push(naGrade.slice(i, i + POR_PAGINA))
  const [pagina, setPagina] = useState(0)
  const [arrasto, setArrasto] = useState(0)
  const inicio = useRef<number | null>(null)
  const arrastou = useRef(false)
  const largura = useRef(300)

  // Bolinha de não lidas no ícone de Mensagens / Ordem.
  const contagem = (app: 'mensagens' | 'ordem') => {
    if (!('celular' in e.eu)) return 0
    const meu = e.eu.celular
    return minhasConversas(e, app).reduce((s, c) => {
      const p = e.participantes.find((x) => x.conversa_id === c.id && x.celular_id === meu)
      return s + naoLidas(e.mensagens[c.id] ?? [], meu, p?.lida_ate ?? null)
    }, 0)
  }
  const bolinha: Record<string, number> = { mensagens: contagem('mensagens'), ordem: contagem('ordem') }

  function soltar() {
    if (Math.abs(arrasto) > largura.current / 5) setPagina((p) => Math.min(paginas.length - 1, Math.max(0, p + (arrasto < 0 ? 1 : -1))))
    setArrasto(0)
    inicio.current = null
  }

  const icone = (id: string, comNome = true) => {
    const app = APPS.find((a) => a.id === id)!
    return (
      <button
        key={id}
        type="button"
        className="cel-app"
        onClick={(ev) => { if (!arrastou.current) onAbrir(id, (ev.currentTarget.querySelector('.cel-icone') as HTMLElement).getBoundingClientRect()) }}
      >
        <span className="cel-app-icone">
          <IconeDoApp id={id} modelo={e.celular.modelo} />
          {bolinha[id] ? <b className="cel-bolinha">{bolinha[id] > 99 ? '99+' : bolinha[id]}</b> : null}
        </span>
        {comNome && <span className="cel-app-nome">{id === 'loja' ? (e.celular.modelo === 'iphone' ? 'App Store' : 'Play Store') : app.nome}</span>}
      </button>
    )
  }

  return (
    <div className={`cel-inicio cel-inicio-${e.celular.modelo}`}>
      <div
        className="cel-paginas"
        ref={(el) => { if (el) largura.current = el.clientWidth }}
        onPointerDown={(ev) => { inicio.current = ev.clientX; arrastou.current = false }}
        onPointerMove={(ev) => {
          if (inicio.current === null) return
          const d = (ev.clientX - inicio.current) / escalaDe(ev.currentTarget)
          if (Math.abs(d) > 6) { arrastou.current = true; ev.currentTarget.setPointerCapture(ev.pointerId) }
          setArrasto(d)
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      >
        <div className="cel-paginas-trilho" style={{ transform: `translateX(calc(${-pagina * 100}% + ${arrasto}px))`, transition: inicio.current === null ? 'transform .35s cubic-bezier(.2,.8,.2,1)' : 'none' }}>
          {paginas.map((p, i) => (
            <div className="cel-pagina" key={i}>{p.map((id) => icone(id))}</div>
          ))}
        </div>
      </div>
      {paginas.length > 1 && (
        <div className="cel-pontos">{paginas.map((_, i) => <span key={i} className={i === pagina ? 'ativo' : ''} />)}</div>
      )}
      <div className={`cel-dock cel-dock-${e.celular.modelo}`}>{dock.map((id) => icone(id, false))}</div>
    </div>
  )
}

// ---- O app aberto: cresce a partir do ícone e volta pra ele ao fechar ----

function JanelaDoApp({ origem, tela, fechando, onFechado, children }: { origem: DOMRect | null; tela: HTMLElement | null; fechando: boolean; onFechado: () => void; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAberto(true)))
    return () => cancelAnimationFrame(r)
  }, [])
  const caixa = tela?.getBoundingClientRect()
  let deIcone: CSSProperties = { opacity: 0, transform: 'scale(.6)' }
  if (origem && caixa && caixa.width) {
    const sx = origem.width / caixa.width
    const sy = origem.height / caixa.height
    // Com o celular encolhido (tamanho na tela), o deslocamento vai em pixels de dentro dele.
    const k = escalaDe(tela)
    const dx = (origem.left - caixa.left) / k
    const dy = (origem.top - caixa.top) / k
    deIcone = { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.2, borderRadius: 120 }
  }
  const visivel = aberto && !fechando
  return (
    <div
      className="cel-janela-app"
      style={visivel ? { transform: 'none', opacity: 1 } : deIcone}
      onTransitionEnd={(ev) => { if (fechando && ev.propertyName === 'transform') onFechado() }}
    >
      {children}
    </div>
  )
}

function ConteudoDoApp({ id, onFechar }: { id: string; onFechar: () => void }) {
  const e = useCelular()
  switch (id) {
    case 'mensagens': return <AppMensagens app="mensagens" />
    case 'ordem': return <AppOrdem />
    case 'telefone': return <AppTelefone />
    case 'configuracoes': return <AppConfiguracoes />
    case 'loja': return <AppLoja />
    case 'galeria': return <AppGaleria />
    case 'camera': return <AppGaleria camera />
    case 'mapas': return <AppMapas />
    case 'notas': return <AppNotas />
    case 'noticias': return <AppNoticias />
    case 'rede_social': return <AppInstagram />
    case 'email': return <AppEmail />
    case 'calculadora': return <AppCalculadora />
    case 'clima': return <AppClima />
    default:
      return (
        <div className="cel-app-vazio" onClick={onFechar}>
          <IconeDoApp id={id} modelo={e.celular.modelo} tamanho={72} />
          <p>{texto(e.celular.idioma, 'emBreve')}</p>
        </div>
      )
  }
}

// ---- O aparelho ----

export function TelaDoCelular() {
  const e = useCelular()
  const [bloqueado, setBloqueado] = useState(true)
  const [app, setApp] = useState<{ id: string; origem: DOMRect | null } | null>(null)
  const [fechando, setFechando] = useState(false)
  const tela = useRef<HTMLDivElement>(null)
  const homeInicio = useRef<number | null>(null)
  const efeitos = e.celular.efeitos
  const desligado = !!efeitos.desligado || e.celular.bateria <= 0
  const corDoBrilho = efeitos.brilho ? corDoElemento(efeitos.brilho) ?? '#e0b13a' : null

  // Ligação tocando pra este celular (ou em andamento com ele): a tela de ligação fica por cima.
  const ligacao = e.ligacoes.find((l) => (l.estado === 'chamando' || l.estado === 'em_curso')
    && ('celular' in e.eu ? l.para_celular_id === e.eu.celular || l.de_celular_id === e.eu.celular : l.para_npc_id === e.eu.npc || l.de_npc_id === e.eu.npc))

  // Correio de voz: liguei, ninguém atendeu (ou recusou) há pouco → oferece deixar recado.
  const [recadoFeito, setRecadoFeito] = useState<string | null>(null)
  const naoAtendida = e.ligacoes.find((l) => (l.estado === 'perdida' || l.estado === 'recusada') && ehEu(e.eu, { celular: l.de_celular_id, npc: l.de_npc_id })
    && l.encerrada_em && Date.now() - Date.parse(l.encerrada_em) < 45000)

  function abrir(id: string, origem: DOMRect) {
    setFechando(false)
    setApp({ id, origem })
  }
  function irPraInicio() {
    if (bloqueado) { setBloqueado(false); return }
    if (app) setFechando(true)
  }

  const papel = bloqueado ? e.celular.papel_de_bloqueio || e.celular.papel_de_parede : e.celular.papel_de_parede
  const estiloDaTela: CSSProperties = {
    backgroundImage: papel ? `url(${papel})` : undefined,
  }

  return (
    <div
      className={`cel-aparelho cel-${e.celular.modelo} cel-textura-${e.celular.capinha.textura ?? 'lisa'}${efeitos.interferencia ? ' cel-interferencia' : ''}${corDoBrilho ? ' cel-brilhando' : ''}`}
      style={{ ['--cel-capinha' as string]: e.celular.capinha.cor || (e.celular.modelo === 'iphone' ? '#2b2b30' : '#1d1f24'), ...(corDoBrilho ? { ['--cel-brilho' as string]: corDoBrilho } : {}) }}
    >
      <span className="cel-botao cel-botao-volume" aria-hidden />
      <span className="cel-botao cel-botao-energia" aria-hidden />
      <div className={`cel-tela${papel ? '' : ' cel-tela-padrao'}`} ref={tela} style={estiloDaTela}>
        {e.celular.modelo === 'iphone' ? <span className="cel-ilha" aria-hidden /> : <span className="cel-camera-furo" aria-hidden />}
        {desligado ? (
          <div className="cel-desligado" title={texto(e.celular.idioma, 'desligado')} />
        ) : !e.celular.configurado ? (
          <ConfiguracaoInicial />
        ) : (
          <>
            <BarraDeStatus escura={!!app && !fechando && app.id !== 'ordem'} />
            {bloqueado ? (
              <TelaDeBloqueio onAbrir={() => setBloqueado(false)} />
            ) : (
              <TelaInicial onAbrir={abrir} />
            )}
            {app && !bloqueado && (
              <JanelaDoApp key={app.id} origem={app.origem} tela={tela.current} fechando={fechando} onFechado={() => { setApp(null); setFechando(false) }}>
                <ConteudoDoApp id={app.id} onFechar={() => setFechando(true)} />
              </JanelaDoApp>
            )}
            {ligacao && <TelaDeLigacao ligacao={ligacao} />}
            {!ligacao && naoAtendida && recadoFeito !== naoAtendida.id && <RecadoDeVoz ligacao={naoAtendida} onFechar={() => setRecadoFeito(naoAtendida.id)} />}
          </>
        )}
        {!desligado && e.celular.configurado && (
          <button
            type="button"
            className={`cel-barra-home${app && !fechando && app.id !== 'ordem' ? ' escura' : ''}`}
            aria-label={bloqueado ? 'Desbloquear' : 'Ir pra tela inicial'}
            onClick={irPraInicio}
            onPointerDown={(ev) => { homeInicio.current = ev.clientY }}
            onPointerUp={(ev) => { if (homeInicio.current !== null && homeInicio.current - ev.clientY > 30) irPraInicio(); homeInicio.current = null }}
          />
        )}
        {efeitos.interferencia && <div className="cel-chiado" aria-hidden />}
      </div>
    </div>
  )
}

export default function Celular({ estado }: { estado: EstadoDoCelular }) {
  return (
    <CelularContexto.Provider value={estado}>
      <TelaDoCelular />
    </CelularContexto.Provider>
  )
}

export type { Modelo }
