import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  faArrowDownWideShort, faArrowUpWideShort, faBullseye, faCopy, faCrosshairs, faLayerGroup, faLock, faLockOpen, faObjectGroup,
  faObjectUngroup, faPaste, faLightbulb, faEye, faBriefcase, faHandPointer, faHandHolding, faSquarePlus, faIdCard, faImages, faRotateLeft, faRotateRight, faShieldHalved, faSlidersH, faTowerBroadcast, faTrash, faUpDown, faLeftRight, faUserGear, faPenToSquare, faSun, faFire,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import EfeitoClimatico from './EfeitoClimatico'
import MenuContexto, { type ItemMenu } from './MenuContexto'
import { itensDeImagem, useMostrarImagem } from './mostrarImagem'
import Janela, { Campo } from './Janela'
import {
  ajustarVista, celulaDaGrade, filtroAmbiente, imagemDoArrasto, ladrilhoHex, telaParaMapa, tracoDaGrade, zoomEm,
  type Camada, type Cena, type ObjetoCena, type Vista,
} from './cenas'
import {
  ALCAS, anguloAte, caixaDoGrupo, camposAtuais, escalarGrupo, girarGrupo, comGrupo, deslocamentoDaTecla, desfazer as passoDesfazer, HISTORICO_VAZIO, ordemParaFrente,
  ordemParaTras, redimensionarPorAlca, refazer as passoRefazer, registrar, tocaNaCaixa, type Alca, type Caixa, type CamposObjeto, type Historico, type Passo,
} from './tokens'
import type { Ping, useObjetos } from './useObjetos'
import { TIPO_ARRASTO_ATOR } from './PainelPersonagens'
import { soltouNosPosicionaveis, TIPO_ARRASTO_POSICIONAVEL } from './PainelPosicionaveis'
import { TIPO_ARRASTO_BIBLIOTECA } from './biblioteca'
import { TIPO_ARRASTO_ITEM } from './PainelItens'
import { guardarObjeto, type Posicionavel } from './posicionaveis'
import type { Variacao } from './atores'
import type { MiraDeAlguem } from './useMira'
import { medir, noCentro, textoDaDistancia, type Ponto } from './regua'
import { useDesenhoNoPalco } from './DesenhosNoPalco'
import { useSomNoPalco } from './SonsNoPalco'
import { BrilhoDasLanternas, LuzesNoPalco, useEscuridaoNoPalco } from './EscuridaoNoPalco'
import { useEscuridao } from './useEscuridao'
import { ajusteDaSeta, caminhoDaLuzUv, caminhoDoCone, coneDaLanterna, conesDosTokens, IMAGEM_LUZ, LANTERNAS, luzCompleta, luzesDoAmbiente, temLuzAmbiente, type AjusteLanterna, type Lanterna, type LuzAmbiente } from './luz'
import ConfigurarLuz from './ConfigurarLuz'
import ConfigurarEfeito from './ConfigurarEfeito'
import EfeitosNoPalco from './EfeitosNoPalco'
import { efeitoPadrao, IMAGEM_EFEITO, type Efeito } from './efeitos'
import type { useSons } from './useSons'
import type { useDesenhos } from './useDesenhos'

const MAPA_PADRAO = { w: 4000, h: 3000 }
const ORDEM_CAMADA: Record<Camada, number> = { mapa: 0, token: 1, mestre: 2 }
const CAMADAS: { id: Camada; rotulo: string }[] = [
  { id: 'token', rotulo: 'Tokens' },
  { id: 'mestre', rotulo: 'Mestre (DM)' },
  { id: 'mapa', rotulo: 'Mapa' },
]

type Objetos = ReturnType<typeof useObjetos>

type Gesto =
  | { tipo: 'mapa'; x: number; y: number; vx: number; vy: number; botao: number; andou: boolean }
  | { tipo: 'mover'; x: number; y: number; ids: string[]; inicio: Record<string, { x: number; y: number }>; dx: number; dy: number }
  | { tipo: 'tamanho'; x: number; y: number; alca: Alca; o: ObjetoCena; ultimo?: CamposObjeto }
  | { tipo: 'girar'; o: ObjetoCena; ultimo?: number }
  // Vários selecionados (18/10): a caixa do grupo muda de tamanho ou gira, e todos vão juntos.
  | { tipo: 'tamanhoGrupo'; x: number; y: number; alca: Alca; caixa: Caixa; os: ObjetoCena[]; ultimo?: Record<string, CamposObjeto> }
  | { tipo: 'girarGrupo'; os: ObjetoCena[]; centro: { x: number; y: number }; inicio: number; ultimo?: Record<string, CamposObjeto> }
  | { tipo: 'caixa'; inicio: { x: number; y: number }; somar: boolean }
  | { tipo: 'regua' }

// Centro da mesa: a cena com imagem, grade, objetos/tokens, escuridão, ambiente e clima.
// Arrastar com o botão direito move o mapa (o esquerdo faz a caixa de seleção), a rodinha dá zoom.
export default function PalcoCena({ cena, souMestre, userId, nomeUsuario, meusPersonagens, jogadores, obj, aviso, pings, focoPing, onSoltarImagem, onColocarAtor, onAbrirFicha, variacoesDe, onAbrirVariacoes, ferramenta, meusAlvos, outrosAlvos, onAlternarAlvo, onLimparAlvos, combates = [], onAdicionarAoCombate, entraEmCombate, des, pedidoPaleta = 0, pedidoLimpar = 0, sons, pedidoPaletaSom = 0, pedidoLimparSom = 0, pedidoLimparEscuridao = 0, ehMeuToken, podePingar = true, onInteragir, onColocarItem, itensDaCampanha = [], onEditarItem, podeEditarItem, onColocarPosicionavel, onColocarDaBiblioteca, onGuardarPosicionaveis, onCriarItemDoObjeto, camadaAtiva }: {
  cena: Cena | null
  souMestre: boolean
  userId: string
  nomeUsuario: string
  meusPersonagens: string[]
  jogadores: { userId: string; rotulo: string }[]
  obj: Objetos
  aviso: string | null
  pings: Ping[]
  focoPing: Ping | null
  onSoltarImagem: (origem: File | string, ponto: { x: number; y: number }, mapa: { w: number; h: number }) => void
  onColocarAtor: (atorId: string, ponto: { x: number; y: number }) => void
  onAbrirFicha: (atorId: string) => void
  variacoesDe: (atorId: string) => Variacao[]
  onAbrirVariacoes: (tokenId: string) => void
  // Mira (12.9 e 12.13): ferramenta escolhida na barra esquerda e os alvos marcados.
  ferramenta: string
  meusAlvos: string[]
  outrosAlvos: Record<string, MiraDeAlguem>
  onAlternarAlvo: (ids: string[]) => void
  onLimparAlvos: () => void
  // Adicionar ao Combate (mestre): o personagem do token entra no combate escolhido.
  combates?: { id: string; name: string; ativo: boolean; atores: string[] }[]
  onAdicionarAoCombate?: (combateId: string, atorId: string) => void
  entraEmCombate?: (atorId: string) => boolean
  // Ferramentas de Desenho (KAN-52).
  des: ReturnType<typeof useDesenhos>
  pedidoPaleta?: number
  pedidoLimpar?: number
  // Som Ambiente (KAN-52).
  sons: ReturnType<typeof useSons>
  pedidoPaletaSom?: number
  pedidoLimparSom?: number
  // Áreas de Escuridão (pedido da Millie, 05/10).
  pedidoLimparEscuridao?: number
  // O jogador exclui o próprio token (o do personagem dele, ou de um personagem de que é dono).
  ehMeuToken?: (o: ObjetoCena) => boolean
  // Permissões (Configurações): o jogador pode usar o Ping Todos?
  podePingar?: boolean
  // Itens interativos (KAN-53): clicar abre a interação; arrastar da aba Itens coloca na mesa;
  // o mestre liga um item a qualquer token (Vincular Item).
  // coletar: já tenta pegar o item pro inventário (botão direito → Coletar Item).
  onInteragir?: (o: ObjetoCena, celula: { w: number; h: number }, coletar?: boolean) => void
  // Mestre: objeto do mapa (documento, papel…) vira item que os jogadores coletam.
  onCriarItemDoObjeto?: (o: ObjetoCena) => void
  onColocarItem?: (itemId: string, ponto: { x: number; y: number }) => void
  itensDaCampanha?: { id: string; name: string; categoria?: string }[]
  // Duplo clique / botão direito "Editar" abre a ficha do item (loja, documento, baú…) pra quem é dono dele.
  onEditarItem?: (itemId: string) => void
  podeEditarItem?: (itemId: string) => boolean
  // Posicionáveis (12.6): arrastar da aba pra mesa usa; da mesa pra aba guarda.
  onColocarPosicionavel?: (id: string, ponto: { x: number; y: number }) => void
  // Token arrastado da Biblioteca de Tokens.
  onColocarDaBiblioteca?: (token: { url: string; nome: string }, ponto: { x: number; y: number }) => void
  onGuardarPosicionaveis?: (itens: Pick<Posicionavel, 'categoria' | 'name' | 'url' | 'dados'>[]) => void
  // Camada em que o mestre está trabalhando (painel da sessão, 27/10): só ela seleciona e mexe.
  camadaAtiva?: Camada
}) {
  const palcoRef = useRef<HTMLDivElement>(null)
  const [mapa, setMapa] = useState(MAPA_PADRAO)
  const [vista, setVista] = useState<Vista>({ x: 0, y: 0, escala: 1 })
  const [soltando, setSoltando] = useState(false)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [menu, setMenu] = useState<{ x: number; y: number; mapa: { x: number; y: number }; objeto: ObjetoCena | null } | null>(null)
  const imagem = useMostrarImagem()
  const [propriedade, setPropriedade] = useState<ObjetoCena | null>(null)
  const gesto = useRef<Gesto | null>(null)
  // Token embaixo do mouse: o M mira nele (qualquer um mira tokens alheios).
  const sobre = useRef<string | null>(null)
  // Token de outra pessoa clicado: fica "focado" (contorno leve), pra saber em quem o M vai mirar.
  const [focado, setFocado] = useState<string | null>(null)
  // Medir Distância (12.13): pontos fixos + onde o mouse está. "aberta" = ainda medindo
  // (Ctrl ao soltar deixa um ponto no caminho e continua).
  const [regua, setRegua] = useState<{ pontos: Ponto[]; atual: Ponto; aberta: boolean } | null>(null)
  const apagarRegua = useRef<number | undefined>(undefined)
  // A régua mede pela célula da grade (que cobre a imagem inteira).
  const gradeDaRegua = () => {
    const cel = cena ? celulaDaGrade(cena, mapa) : { w: 100, h: 100 }
    return { ...cena!, grid_size: cel.w, grid_altura: cel.h }
  }
  const ultimoEnvio = useRef(0)
  // Arrastar com o botão direito move o mapa; aí o menu não abre.
  const panouComDireito = useRef(false)
  const [caixa, setCaixa] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null)
  // Arrasto que começou dentro da própria página (texto, imagem do chat…) não é imagem nova.
  const arrastoInterno = useRef(false)

  useEffect(() => {
    // Arrasto cancelado (o palco cancela o dragstart das imagens do mapa) não termina com dragend,
    // e a marca ficava presa: arquivo vindo do computador abria numa aba nova (bug 18/10).
    const comeca = (e: DragEvent) => { if (!e.defaultPrevented) arrastoInterno.current = true }
    // Arquivo solto fora de onde a mesa aceita não vira uma aba nova do navegador.
    const ehArquivo = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const segura = (e: DragEvent) => { if (ehArquivo(e)) e.preventDefault() }
    const acaba = (e: DragEvent) => { arrastoInterno.current = false; segura(e) }
    window.addEventListener('dragstart', comeca)
    window.addEventListener('dragend', acaba)
    window.addEventListener('dragover', segura)
    window.addEventListener('drop', acaba)
    return () => {
      window.removeEventListener('dragstart', comeca)
      window.removeEventListener('dragend', acaba)
      window.removeEventListener('dragover', segura)
      window.removeEventListener('drop', acaba)
    }
  }, [])
  const historico = useRef<Historico>(HISTORICO_VAZIO)
  const [, setVersaoHistorico] = useState(0)
  const copiados = useRef<ObjetoCena[]>([])
  const objetos = obj.objetos
  // Objeto "só na luz UV": o jogador só vê dentro da luz UV (vai numa camada à parte).
  // A lâmpada de uma Luz Ambiente sem imagem só o mestre vê (os jogadores só veem a luz).
  // Ver como jogador (pedido 26/10): o mestre vê a mesa como um jogador vê (escuridão por cima dos
  // tokens, camada do mestre escondida); com o token de um personagem selecionado, como aquele personagem.
  const [comoJogador, setComoJogador] = useState<{ personagens: string[]; nome: string | null } | null>(null)
  const veTudo = souMestre && !comoJogador
  const personagensDaVisao = comoJogador ? comoJogador.personagens : meusPersonagens
  const visiveis = objetos.filter((o) => veTudo || (o.layer !== 'mestre' && !o.so_uv && o.image_url !== IMAGEM_LUZ && o.image_url !== IMAGEM_EFEITO))

  // Quem pode mexer em cada objeto: o mestre sempre; o jogador no próprio personagem ou
  // quando o mestre liberou (Configurar Propriedade). O banco confere de novo.
  const podeMover = useCallback(
    (o: ObjetoCena) =>
      (souMestre && (!camadaAtiva || o.layer === camadaAtiva)) ||
      (!o.locked && o.layer !== 'mestre' &&
        ((o.character_id !== null && meusPersonagens.includes(o.character_id)) ||
          o.move_permission === 'todos' ||
          (o.move_permission === 'jogadores' && o.movable_by.includes(userId)))),
    [souMestre, meusPersonagens, userId, camadaAtiva],
  )
  // Trocou de camada: a seleção da outra some.
  useEffect(() => setSelecionados([]), [camadaAtiva])

  // Tamanho real da imagem de fundo.
  useEffect(() => {
    if (!cena?.background_url) {
      setMapa(MAPA_PADRAO)
      return
    }
    const img = new Image()
    img.onload = () => setMapa({ w: img.naturalWidth || MAPA_PADRAO.w, h: img.naturalHeight || MAPA_PADRAO.h })
    img.src = cena.background_url
  }, [cena?.background_url])

  // Trocou de cena ou de imagem: o mapa se ajusta à tela e a seleção some.
  useLayoutEffect(() => {
    const palco = palcoRef.current
    if (palco) setVista(ajustarVista(mapa.w, mapa.h, palco.clientWidth, palco.clientHeight))
    setSelecionados([])
    historico.current = HISTORICO_VAZIO
  }, [cena?.id, mapa])

  // Ping de Foco (12.8): a câmera de todo mundo vai pro ponto.
  useEffect(() => {
    const palco = palcoRef.current
    if (!focoPing || !palco) return
    setVista((v) => ({ ...v, x: palco.clientWidth / 2 - focoPing.x * v.escala, y: palco.clientHeight / 2 - focoPing.y * v.escala }))
  }, [focoPing])

  const pontoNoMapa = useCallback(
    (clientX: number, clientY: number) => {
      const r = palcoRef.current?.getBoundingClientRect()
      return r ? telaParaMapa(clientX - r.left, clientY - r.top, vista) : { x: 0, y: 0 }
    },
    [vista],
  )

  const desenho = useDesenhoNoPalco({ cena, ferramenta, userId, souMestre, des, pontoNoMapa, escala: vista.escala, pedidoPaleta, pedidoLimpar })
  // Quem ouve o Som Ambiente: os tokens do jogador; no mestre, os tokens selecionados.
  const ouvintes = objetos
    .filter((o) => (souMestre ? selecionados.includes(o.id) : o.character_id !== null && meusPersonagens.includes(o.character_id)))
    .map((o) => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 }))
  const esc = useEscuridao(cena?.id ?? null)
  // Configurar Lanterna: token sendo configurado e a seta que a pessoa está desenhando.
  const [configLanterna, setConfigLanterna] = useState<string | null>(null)
  // Configurar Luz / Efeito: o objeto e como estava ao abrir (fechar sem salvar volta pra isso).
  const [configLuz, setConfigLuzBruto] = useState<{ id: string; original: ObjetoCena['luz_ajuste'] } | null>(null)
  const [configEfeito, setConfigEfeitoBruto] = useState<{ id: string; original: ObjetoCena['efeito'] } | null>(null)
  const setConfigLuz = (id: string | null) => setConfigLuzBruto(id ? { id, original: objetos.find((x) => x.id === id)?.luz_ajuste ?? null } : null)
  const setConfigEfeito = (id: string | null) => setConfigEfeitoBruto(id ? { id, original: objetos.find((x) => x.id === id)?.efeito ?? null } : null)
  const [seta, setSeta] = useState<{ a: Ponto; b: Ponto } | null>(null)
  useEffect(() => {
    if (!configLanterna) return
    const cancelar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setConfigLanterna(null)
      setSeta(null)
    }
    window.addEventListener('keydown', cancelar)
    return () => window.removeEventListener('keydown', cancelar)
  }, [configLanterna])
  const escuro = useEscuridaoNoPalco({ cena, ferramenta, souMestre, esc, pontoNoMapa, escala: vista.escala, pedidoLimpar: pedidoLimparEscuridao })
  const som = useSomNoPalco({ cena, ferramenta, userId, souMestre, sons, pontoNoMapa, escala: vista.escala, ouvintes, pedidoPaleta: pedidoPaletaSom, pedidoLimpar: pedidoLimparSom })

  // ---- Aplicar mudanças (com desfazer) ----

  const aplicar = useCallback(
    async (passo: Passo) => {
      if (passo.tipo === 'alterar') await obj.alterarVarios(passo.depois)
      else if (passo.tipo === 'criar') await obj.criarVarios(passo.objetos)
      else await obj.excluirVarios(passo.objetos.map((o) => o.id))
    },
    [obj],
  )

  const fazer = useCallback(
    async (passo: Passo) => {
      historico.current = registrar(historico.current, passo)
      setVersaoHistorico((v) => v + 1)
      await aplicar(passo)
    },
    [aplicar],
  )

  const alterar = useCallback(
    (mudancas: Record<string, CamposObjeto>) => {
      const antes = Object.fromEntries(
        Object.entries(mudancas).flatMap(([id, c]) => {
          const o = objetos.find((x) => x.id === id)
          return o ? [[id, camposAtuais(o, c)]] : []
        }),
      )
      return fazer({ tipo: 'alterar', antes, depois: mudancas })
    },
    [objetos, fazer],
  )

  const desfazer = useCallback(() => {
    const r = passoDesfazer(historico.current)
    if (!r) return
    historico.current = r.historico
    setVersaoHistorico((v) => v + 1)
    aplicar(r.aplicar)
  }, [aplicar])

  const refazer = useCallback(() => {
    const r = passoRefazer(historico.current)
    if (!r) return
    historico.current = r.historico
    setVersaoHistorico((v) => v + 1)
    aplicar(r.aplicar)
  }, [aplicar])

  const eliminar = useCallback(
    (ids: string[]) => {
      const lista = objetos.filter((o) => ids.includes(o.id))
      if (!lista.length) return
      setSelecionados([])
      fazer({ tipo: 'excluir', objetos: lista })
    },
    [objetos, fazer],
  )

  // Jogador: exclui só os tokens que são dele (sem desfazer, então pergunta antes).
  const excluirComoDono = useCallback(
    (ids: string[]) => {
      const meus = objetos.filter((o) => ids.includes(o.id) && ehMeuToken?.(o))
      if (!meus.length) return
      if (!window.confirm(meus.length === 1 ? `Excluir o token "${meus[0].name ?? 'Token'}" da cena?` : `Excluir ${meus.length} tokens seus da cena?`)) return
      setSelecionados([])
      obj.excluirComoJogador(meus.map((o) => o.id))
    },
    [objetos, ehMeuToken, obj],
  )

  const copiar = useCallback((ids: string[]) => {
    copiados.current = objetos.filter((o) => ids.includes(o.id))
  }, [objetos])

  // Colar: as cópias entram em volta do ponto, mantendo a posição de uma em relação à outra.
  const colar = useCallback(
    (ponto: { x: number; y: number } | null) => {
      if (!cena || !copiados.current.length) return
      const base = copiados.current
      const minX = Math.min(...base.map((o) => o.x))
      const minY = Math.min(...base.map((o) => o.y))
      const destino = ponto ?? { x: minX + cena.grid_size, y: minY + cena.grid_size }
      const grupos = new Map<string, string>()
      const novos = base.map((o) => ({
        ...o,
        id: crypto.randomUUID(),
        scene_id: cena.id,
        x: Math.round(destino.x + (o.x - minX)),
        y: Math.round(destino.y + (o.y - minY)),
        group_id: o.group_id ? grupos.get(o.group_id) ?? grupos.set(o.group_id, crypto.randomUUID()).get(o.group_id)! : null,
        created_at: new Date().toISOString(),
      }))
      setSelecionados(novos.map((o) => o.id))
      fazer({ tipo: 'criar', objetos: novos })
    },
    [cena, fazer],
  )

  const moverPor = useCallback(
    async (ids: string[], dx: number, dy: number) => {
      const todos = comGrupo(objetos, ids)
      if (souMestre) {
        await alterar(Object.fromEntries(todos.map((id) => {
          const o = objetos.find((x) => x.id === id)!
          return [id, { x: Math.round(o.x + dx), y: Math.round(o.y + dy) }]
        })))
      } else {
        obj.alterarVarios(Object.fromEntries(todos.map((id) => {
          const o = objetos.find((x) => x.id === id)!
          return [id, { x: o.x + dx, y: o.y + dy }]
        })), false)
        await obj.moverComoJogador(ids, dx, dy)
      }
    },
    [objetos, souMestre, alterar, obj],
  )

  // ---- Teclado (12.8 e 12.13) ----

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (desenho.aoTeclar(e) || som.aoTeclar(e) || escuro.aoTeclar(e)) {
        e.preventDefault()
        return
      }
      const ctrl = e.ctrlKey || e.metaKey
      if (souMestre && ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) refazer()
        else desfazer()
        return
      }
      if (souMestre && ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        refazer()
        return
      }
      if (souMestre && ctrl && e.key.toLowerCase() === 'v') {
        colar(null)
        return
      }
      // M marca/desmarca o alvo: o token embaixo do mouse, ou os selecionados.
      if (!ctrl && !e.altKey && e.key.toLowerCase() === 'm') {
        const ids = sobre.current && visiveis.some((o) => o.id === sobre.current) ? [sobre.current] : selecionados.length ? selecionados : focado ? [focado] : []
        if (ids.length) onAlternarAlvo(ids)
        return
      }
      if (e.key === 'Escape' && regua) {
        setRegua(null)
        obj.transmitirRegua({ userId, nome: nomeUsuario, pontos: null })
        return
      }
      if (e.key === 'Escape' && !selecionados.length) {
        onLimparAlvos()
        return
      }
      if (!selecionados.length) return
      if (e.key === 'Escape') setSelecionados([])
      if (souMestre && ctrl && e.key.toLowerCase() === 'c') copiar(selecionados)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (souMestre) eliminar(selecionados)
        else excluirComoDono(selecionados)
      }
      const d = deslocamentoDaTecla(e.key, cena?.grid_size ?? 100)
      if (d) {
        e.preventDefault()
        const ids = selecionados.filter((id) => {
          const o = objetos.find((x) => x.id === id)
          return o && podeMover(o) && !o.locked
        })
        if (ids.length) moverPor(ids, d.dx, d.dy)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [desenho, som, focado, regua, obj, userId, nomeUsuario, selecionados, souMestre, objetos, visiveis, cena?.grid_size, podeMover, moverPor, eliminar, excluirComoDono, copiar, colar, desfazer, refazer, onAlternarAlvo, onLimparAlvos])

  // Rodinha: zoom no ponto do mouse; com Shift ou Ctrl em cima de algo selecionado, gira (12.13).
  useEffect(() => {
    const palco = palcoRef.current
    if (!palco) return
    const roda = (e: WheelEvent) => {
      e.preventDefault()
      if (desenho.aoRodar(e)) return
      if ((e.shiftKey || e.ctrlKey) && selecionados.length) {
        const passo = e.deltaY < 0 ? -15 : 15
        if (!souMestre) {
          for (const id of selecionados) {
            const o = objetos.find((x) => x.id === id)
            if (o && podeMover(o)) {
              const rotation = (((o.rotation + passo) % 360) + 360) % 360
              obj.alterarVarios({ [id]: { rotation } }, false)
              obj.transformarComoJogador({ ...o, rotation })
            }
          }
          return
        }
        alterar(Object.fromEntries(selecionados.map((id) => {
          const o = objetos.find((x) => x.id === id)
          return [id, { rotation: (((o?.rotation ?? 0) + passo) % 360 + 360) % 360 }]
        })))
        return
      }
      const r = palco.getBoundingClientRect()
      setVista((v) => zoomEm(v, e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top))
    }
    palco.addEventListener('wheel', roda, { passive: false })
    return () => palco.removeEventListener('wheel', roda)
  }, [souMestre, selecionados, objetos, alterar, desenho])

  // ---- Mouse ----

  function comecarNoMapa(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.button !== 2) return
    panouComDireito.current = false
    // Configurar Lanterna: o arraste desenha a seta (da lanterna na direção da luz).
    if (configLanterna && e.button === 0) {
      const p = pontoNoMapa(e.clientX, e.clientY)
      setSeta({ a: p, b: p })
      palcoRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (desenho.aoApertar(e) || som.aoApertar(e) || escuro.aoApertar(e)) return
    if (e.button === 0 && ferramenta === 'medir') {
      if (!cena) return
      const p = noCentro(pontoNoMapa(e.clientX, e.clientY), gradeDaRegua())
      window.clearTimeout(apagarRegua.current)
      // Medindo com ponto no meio: o clique continua a mesma régua.
      setRegua((r) => (r?.aberta ? r : { pontos: [p], atual: p, aberta: true }))
      gesto.current = { tipo: 'regua' }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (e.button === 0) {
      // Esquerdo no vazio: caixa de seleção (o fundo não se mexe).
      if (!e.shiftKey) setSelecionados([])
      setFocado(null)
      if (!cena) return
      gesto.current = { tipo: 'caixa', inicio: pontoNoMapa(e.clientX, e.clientY), somar: e.shiftKey }
    } else {
      gesto.current = { tipo: 'mapa', x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, botao: e.button, andou: false }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function pegarObjeto(e: React.PointerEvent, o: ObjetoCena) {
    // Botão direito: segurar e arrastar move a câmera (mesmo em cima de imagem travada); clicar e
    // soltar abre o menu do objeto (pedido 27/10). Por isso o clique segue pro palco.
    if (e.button === 2) return
    // Configurando a lanterna: o clique vai pro palco (começa a seta em cima do token).
    if (configLanterna) return
    // Item interativo: o jogador clica e abre a interação (o mestre usa o duplo clique ou o menu).
    if (e.button === 0 && o.item_id && !souMestre && ferramenta !== 'alvos' && ferramenta !== 'medir') {
      e.stopPropagation()
      onInteragir?.(o, celula)
      return
    }
    // Medindo: o token não pega o clique, a régua começa ali.
    if (e.button === 0 && (ferramenta === 'medir' || desenho.ativo || som.ativo)) return
    // Ferramenta Selecionar Alvos: clicar no token mira nele (12.13).
    if (e.button === 0 && ferramenta === 'alvos') {
      e.stopPropagation()
      if (o.layer !== 'mapa') onAlternarAlvo([o.id])
      return
    }
    if (e.button === 0 && !podeMover(o)) {
      // Não dá pra mexer, mas dá pra focar (e mirar com M).
      if (o.layer === 'mapa') return
      e.stopPropagation()
      setFocado(o.id)
      setSelecionados([])
      return
    }
    if (e.button !== 0) return
    e.stopPropagation()
    setFocado(null)
    let sel = selecionados
    if (e.shiftKey) sel = sel.includes(o.id) ? sel.filter((id) => id !== o.id) : [...sel, o.id]
    else if (!sel.includes(o.id)) sel = [o.id]
    setSelecionados(sel)
    const ids = comGrupo(objetos, sel).filter((id) => {
      const x = objetos.find((y) => y.id === id)
      return x && podeMover(x) && !x.locked
    })
    if (!ids.length) return
    gesto.current = {
      tipo: 'mover', x: e.clientX, y: e.clientY, ids, dx: 0, dy: 0,
      inicio: Object.fromEntries(ids.map((id) => {
        const x = objetos.find((y) => y.id === id)!
        return [id, { x: x.x, y: x.y }]
      })),
    }
    palcoRef.current?.setPointerCapture(e.pointerId)
  }

  function pegarAlca(e: React.PointerEvent, o: ObjetoCena, alca: Alca) {
    if (e.button !== 0) return
    e.stopPropagation()
    gesto.current = { tipo: 'tamanho', x: e.clientX, y: e.clientY, alca, o }
    palcoRef.current?.setPointerCapture(e.pointerId)
  }

  function pegarGiro(e: React.PointerEvent, o: ObjetoCena) {
    if (e.button !== 0) return
    e.stopPropagation()
    gesto.current = { tipo: 'girar', o }
    palcoRef.current?.setPointerCapture(e.pointerId)
  }

  function pegarAlcaDoGrupo(e: React.PointerEvent, os: ObjetoCena[], alca: Alca) {
    if (e.button !== 0) return
    e.stopPropagation()
    gesto.current = { tipo: 'tamanhoGrupo', x: e.clientX, y: e.clientY, alca, caixa: caixaDoGrupo(os), os }
    palcoRef.current?.setPointerCapture(e.pointerId)
  }

  function pegarGiroDoGrupo(e: React.PointerEvent, os: ObjetoCena[]) {
    if (e.button !== 0) return
    e.stopPropagation()
    const c = caixaDoGrupo(os)
    const p = pontoNoMapa(e.clientX, e.clientY)
    gesto.current = { tipo: 'girarGrupo', os, centro: { x: c.x + c.width / 2, y: c.y + c.height / 2 }, inicio: anguloAte(c, p.x, p.y) }
    palcoRef.current?.setPointerCapture(e.pointerId)
  }

  function mover(e: React.PointerEvent<HTMLDivElement>) {
    if (seta) setSeta({ ...seta, b: pontoNoMapa(e.clientX, e.clientY) })
    desenho.aoMover(e)
    som.aoMover(e)
    escuro.aoMover(e)
    if (regua?.aberta && cena) {
      const atual = noCentro(pontoNoMapa(e.clientX, e.clientY), gradeDaRegua())
      if (atual.x !== regua.atual.x || atual.y !== regua.atual.y) {
        setRegua({ ...regua, atual })
        obj.transmitirRegua({ userId, nome: nomeUsuario, pontos: [...regua.pontos, atual] })
      }
    }
    const g = gesto.current
    if (!g || g.tipo === 'regua') return
    if (g.tipo === 'caixa') {
      setCaixa({ a: g.inicio, b: pontoNoMapa(e.clientX, e.clientY) })
      return
    }
    if (g.tipo === 'mapa') {
      if (Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y) > 4) {
        g.andou = true
        if (g.botao === 2) panouComDireito.current = true
      }
      setVista((v) => ({ ...v, x: g.vx + e.clientX - g.x, y: g.vy + e.clientY - g.y }))
    } else if (g.tipo === 'mover') {
      g.dx = Math.round((e.clientX - g.x) / vista.escala)
      g.dy = Math.round((e.clientY - g.y) / vista.escala)
      const posicoes = Object.fromEntries(g.ids.map((id) => [id, { x: g.inicio[id].x + g.dx, y: g.inicio[id].y + g.dy }]))
      obj.alterarVarios(posicoes, false)
      // Todo mundo vê o arrasto ao vivo, uns 20 quadros por segundo.
      if (performance.now() - ultimoEnvio.current > 50) {
        ultimoEnvio.current = performance.now()
        obj.transmitirArrasto(posicoes)
      }
    } else if (g.tipo === 'tamanhoGrupo') {
      const depois = redimensionarPorAlca(g.caixa, g.alca, (e.clientX - g.x) / vista.escala, (e.clientY - g.y) / vista.escala)
      g.ultimo = escalarGrupo(g.os, g.caixa, depois)
      obj.alterarVarios(g.ultimo, false)
    } else if (g.tipo === 'girarGrupo') {
      const p = pontoNoMapa(e.clientX, e.clientY)
      const c = { x: g.centro.x - 1, y: g.centro.y - 1, width: 2, height: 2 }
      let graus = anguloAte(c, p.x, p.y) - g.inicio
      if (e.shiftKey) graus = Math.round(graus / 15) * 15
      g.ultimo = girarGrupo(g.os, g.centro, graus)
      obj.alterarVarios(g.ultimo, false)
    } else if (g.tipo === 'tamanho') {
      const dx = (e.clientX - g.x) / vista.escala
      const dy = (e.clientY - g.y) / vista.escala
      g.ultimo = redimensionarPorAlca(g.o, g.alca, dx, dy)
      obj.alterarVarios({ [g.o.id]: g.ultimo }, false)
    } else {
      const p = pontoNoMapa(e.clientX, e.clientY)
      g.ultimo = anguloAte(g.o, p.x, p.y, e.shiftKey)
      obj.alterarVarios({ [g.o.id]: { rotation: g.ultimo } }, false)
    }
  }

  async function terminar(e?: React.PointerEvent) {
    if (seta && configLanterna) {
      const o = objetos.find((x) => x.id === configLanterna)
      setSeta(null)
      const fim = e ? pontoNoMapa(e.clientX, e.clientY) : seta.b
      if (o && Math.hypot(fim.x - seta.a.x, fim.y - seta.a.y) > 5) {
        salvarAjusteDaLanterna(o, ajusteDaSeta(o, seta.a, fim))
        setConfigLanterna(null)
      }
      return
    }
    if (desenho.aoSoltar(e) || som.aoSoltar(e) || escuro.aoSoltar(e)) return
    const g = gesto.current
    gesto.current = null
    if (!g) return
    if (g.tipo === 'regua') {
      if (!regua) return
      // Ctrl ao soltar: fica um ponto no caminho e a régua continua seguindo o mouse.
      if (e?.ctrlKey || e?.metaKey) {
        setRegua({ ...regua, pontos: [...regua.pontos, regua.atual] })
        return
      }
      setRegua({ ...regua, aberta: false })
      apagarRegua.current = window.setTimeout(() => {
        setRegua(null)
        obj.transmitirRegua({ userId, nome: nomeUsuario, pontos: null })
      }, 3000)
      return
    }
    if (g.tipo === 'mapa') return
    if (g.tipo === 'caixa') {
      const c = caixa
      setCaixa(null)
      if (!c) return
      const pegos = visiveis.filter((o) => podeMover(o) && tocaNaCaixa(o, c.a, c.b)).map((o) => o.id)
      setSelecionados((atual) => (g.somar ? [...new Set([...atual, ...pegos])] : pegos))
      return
    }
    if (g.tipo === 'mover') {
      // Arrastou pra aba Posicionáveis (12.6): guarda uma cópia lá e o objeto volta pro lugar.
      if (souMestre && onGuardarPosicionaveis && soltouNosPosicionaveis(e)) {
        obj.alterarVarios(Object.fromEntries(g.ids.map((id) => [id, g.inicio[id]])), false)
        onGuardarPosicionaveis(objetos.filter((o) => g.ids.includes(o.id)).map(guardarObjeto))
        return
      }
      if (!g.dx && !g.dy) return
      if (souMestre) {
        // volta pro início e grava pelo histórico (desfazer devolve pra cá)
        historico.current = registrar(historico.current, {
          tipo: 'alterar',
          antes: Object.fromEntries(g.ids.map((id) => [id, g.inicio[id]])),
          depois: Object.fromEntries(g.ids.map((id) => [id, { x: g.inicio[id].x + g.dx, y: g.inicio[id].y + g.dy }])),
        })
        setVersaoHistorico((v) => v + 1)
        await obj.alterarVarios(Object.fromEntries(g.ids.map((id) => [id, { x: g.inicio[id].x + g.dx, y: g.inicio[id].y + g.dy }])))
      } else {
        const ok = await obj.moverComoJogador(g.ids, g.dx, g.dy)
        if (!ok) obj.alterarVarios(Object.fromEntries(g.ids.map((id) => [id, g.inicio[id]])), false)
      }
      return
    }
    if (g.tipo === 'tamanhoGrupo' || g.tipo === 'girarGrupo') {
      if (!g.ultimo) return
      const depois = g.ultimo
      if (!souMestre) {
        // Jogador: cada token dele passa pela função do banco (só caixa e giro).
        for (const o of g.os) {
          const ok = await obj.transformarComoJogador({ ...o, ...depois[o.id] } as ObjetoCena)
          if (!ok) obj.alterarVarios({ [o.id]: { x: o.x, y: o.y, width: o.width, height: o.height, rotation: o.rotation } }, false)
        }
        return
      }
      historico.current = registrar(historico.current, { tipo: 'alterar', antes: Object.fromEntries(g.os.map((o) => [o.id, camposAtuais(o, depois[o.id])])), depois })
      setVersaoHistorico((v) => v + 1)
      await obj.alterarVarios(depois)
      return
    }
    // Jogador (dono do token): grava pela função do banco, que só mexe na caixa e no giro.
    if (!souMestre && (g.tipo === 'tamanho' || g.tipo === 'girar')) {
      const atual = objetos.find((x) => x.id === g.o.id)
      if (atual && !(await obj.transformarComoJogador(atual))) obj.alterarVarios({ [g.o.id]: { x: g.o.x, y: g.o.y, width: g.o.width, height: g.o.height, rotation: g.o.rotation } }, false)
      return
    }
    if (g.tipo === 'tamanho' && g.ultimo) {
      historico.current = registrar(historico.current, { tipo: 'alterar', antes: { [g.o.id]: camposAtuais(g.o, g.ultimo) }, depois: { [g.o.id]: g.ultimo } })
      setVersaoHistorico((v) => v + 1)
      await obj.alterarVarios({ [g.o.id]: g.ultimo })
    }
    if (g.tipo === 'girar' && g.ultimo !== undefined) {
      historico.current = registrar(historico.current, { tipo: 'alterar', antes: { [g.o.id]: { rotation: g.o.rotation } }, depois: { [g.o.id]: { rotation: g.ultimo } } })
      setVersaoHistorico((v) => v + 1)
      await obj.alterarVarios({ [g.o.id]: { rotation: g.ultimo } })
    }
  }

  // Lanterna (pedido da Millie, 05/10): desligada, comum ou UV.
  // Antes de configurar, só "Configurar Lanterna"; depois, editar e escolher a luz.
  function menuLanterna(o: ObjetoCena, aplicar: (l: Lanterna | null) => void): ItemMenu {
    const configurar = () => {
      setSelecionados([])
      setConfigLanterna(o.id)
    }
    const escolher: ItemMenu[] = [
      { rotulo: `${!o.lanterna ? '✓ ' : ''}Desligada`, onClick: () => aplicar(null) },
      ...LANTERNAS.map((l) => ({ rotulo: `${o.lanterna === l.id ? '✓ ' : ''}${l.rotulo}`, onClick: () => aplicar(l.id) })),
    ]
    return {
      tipo: 'sub', rotulo: 'Lanterna', icone: faLightbulb,
      itens: o.lanterna_ajuste
        ? [{ rotulo: 'Editar Lanterna', onClick: configurar }, { tipo: 'linha' }, ...escolher]
        : [{ rotulo: 'Configurar Lanterna', onClick: configurar }, ...(o.lanterna ? [{ tipo: 'linha' } as ItemMenu, escolher[0]] : [])],
    }
  }

  // Guarda a seta; se a lanterna estava desligada, já liga a comum.
  async function salvarAjusteDaLanterna(o: ObjetoCena, ajuste: AjusteLanterna) {
    const lanterna = o.lanterna ?? 'comum'
    obj.alterarVarios({ [o.id]: { lanterna_ajuste: ajuste, lanterna } }, souMestre)
    if (souMestre) return
    if (!(await obj.ajustarLanternaComoJogador(o.id, ajuste, lanterna))) {
      obj.alterarVarios({ [o.id]: { lanterna_ajuste: o.lanterna_ajuste ?? null, lanterna: o.lanterna ?? null } }, false)
    }
  }

  async function lanternaComoDono(o: ObjetoCena, l: Lanterna | null) {
    obj.alterarVarios({ [o.id]: { lanterna: l } }, false)
    if (!(await obj.lanternaComoJogador(o.id, l))) obj.alterarVarios({ [o.id]: { lanterna: o.lanterna ?? null } }, false)
  }

  async function virarComoDono(o: ObjetoCena, flipH: boolean, flipV: boolean) {
    obj.alterarVarios({ [o.id]: { flip_h: flipH, flip_v: flipV } }, false)
    if (!(await obj.virarComoJogador(o.id, flipH, flipV))) obj.alterarVarios({ [o.id]: { flip_h: o.flip_h, flip_v: o.flip_v } }, false)
  }

  function abrirMenu(clientX: number, clientY: number, objeto: ObjetoCena | null) {
    setMenu({ x: clientX, y: clientY, mapa: pontoNoMapa(clientX, clientY), objeto })
  }

  function menuDoObjeto(e: React.MouseEvent, o: ObjetoCena) {
    e.preventDefault()
    e.stopPropagation()
    if (panouComDireito.current) return
    if (!selecionados.includes(o.id) && podeMover(o)) setSelecionados([o.id])
    abrirMenu(e.clientX, e.clientY, o)
  }

  function soltar(e: React.DragEvent<HTMLDivElement>) {
    setSoltando(false)
    // Personagem arrastado da aba Personagens (12.8).
    // Item arrastado da aba Itens (KAN-53): entra na mesa como item interativo.
    const itemArrastado = e.dataTransfer.getData(TIPO_ARRASTO_ITEM)
    if (itemArrastado) {
      e.preventDefault()
      if (cena && souMestre) onColocarItem?.(itemArrastado, pontoNoMapa(e.clientX, e.clientY))
      return
    }
    // Coisa arrastada dos Posicionáveis (12.6): entra uma cópia onde soltou.
    const posicionavel = e.dataTransfer.getData(TIPO_ARRASTO_POSICIONAVEL)
    if (posicionavel) {
      e.preventDefault()
      if (cena && souMestre) onColocarPosicionavel?.(posicionavel, pontoNoMapa(e.clientX, e.clientY))
      return
    }
    const daBiblioteca = e.dataTransfer.getData(TIPO_ARRASTO_BIBLIOTECA)
    if (daBiblioteca) {
      e.preventDefault()
      if (cena && souMestre) onColocarDaBiblioteca?.(JSON.parse(daBiblioteca), pontoNoMapa(e.clientX, e.clientY))
      return
    }
    const ator = e.dataTransfer.getData(TIPO_ARRASTO_ATOR)
    if (ator) {
      e.preventDefault()
      if (cena) onColocarAtor(ator, pontoNoMapa(e.clientX, e.clientY))
      return
    }
    if (!souMestre || (arrastoInterno.current && !e.dataTransfer.types.includes('Files'))) return
    e.preventDefault()
    const origem = imagemDoArrasto({
      arquivos: Array.from(e.dataTransfer.files),
      html: e.dataTransfer.getData('text/html'),
      uris: e.dataTransfer.getData('text/uri-list'),
    })
    onSoltarImagem(origem ?? '', pontoNoMapa(e.clientX, e.clientY), mapa)
  }

  // ---- Menu do botão direito (12.8) ----

  const podeEditar = (o: ObjetoCena | null) => !!o?.item_id && !!onEditarItem && (souMestre || !!podeEditarItem?.(o.item_id))
  function editarItem(o: ObjetoCena): ItemMenu {
    const cat = itensDaCampanha.find((i) => i.id === o.item_id)?.categoria
    const rotulo = cat === 'loja' ? 'Editar Loja' : cat === 'conteiner' ? 'Editar Contêiner' : cat === 'documento' ? 'Editar Documento' : 'Editar Item'
    return { rotulo, icone: faPenToSquare, onClick: () => onEditarItem?.(o.item_id!) }
  }

  // Duplo clique abre a configuração do que é: item (loja, documento…) → ficha do item; personagem →
  // ficha; o resto (mestre) → Configurar Propriedade. Jogador sem ser dono do item: interage.
  function duploClique(o: ObjetoCena) {
    if (o.item_id && podeEditar(o)) onEditarItem?.(o.item_id)
    else if (o.item_id) onInteragir?.(o, celula)
    else if (o.actor_id) onAbrirFicha(o.actor_id)
    else if (souMestre && o.efeito && (o.image_url === IMAGEM_EFEITO || !(o.luz || o.luz_ajuste))) setConfigEfeito(o.id)
    else if (souMestre && (o.luz || o.luz_ajuste)) setConfigLuz(o.id)
    else if (souMestre) setPropriedade(o)
  }

  function itensDoMenu(): ItemMenu[] {
    if (!menu) return []
    const ping = (foco: boolean) => obj.pingar({ id: crypto.randomUUID(), x: menu.mapa.x, y: menu.mapa.y, foco, nome: nomeUsuario })
    const pingItens: ItemMenu[] = [
      ...(podePingar ? [{ rotulo: 'Ping Todos', icone: faTowerBroadcast, onClick: () => ping(false) } as ItemMenu] : []),
      ...(souMestre ? [{ rotulo: 'Ping de Foco', icone: faCrosshairs, onClick: () => ping(true) } as ItemMenu] : []),
    ]
    const historicoItens: ItemMenu[] = souMestre
      ? [
          { rotulo: 'Desfazer', icone: faRotateLeft, desativado: historico.current.posicao === 0, onClick: desfazer },
          { rotulo: 'Refazer', icone: faRotateRight, desativado: historico.current.posicao >= historico.current.passos.length, onClick: refazer },
        ]
      : []
    const o = menu.objeto
    // Token de personagem: abrir a ficha e trocar a aparência (12.8).
    const doPersonagem: ItemMenu[] = o?.actor_id
      ? [
          { tipo: 'linha' },
          { rotulo: 'Ficha de Personagem', icone: faIdCard, onClick: () => onAbrirFicha(o.actor_id!) },
          // Abre o painel lateral com as imagens (12.8), que rola e fica aberto pra trocar rápido.
          ...(podeMover(o) && variacoesDe(o.actor_id).length > 1
            ? [{ rotulo: 'Variação de Token', icone: faImages, onClick: () => onAbrirVariacoes(o.id) } as ItemMenu]
            : []),
          // Ameaça/NPC que já está na cena entra no combate (o de jogador entra sozinho).
          ...(souMestre && onAdicionarAoCombate && combates.length && entraEmCombate?.(o.actor_id)
            ? [{
                tipo: 'sub', rotulo: 'Adicionar ao Combate', icone: faShieldHalved,
                itens: combates.map((c) => ({
                  rotulo: `${c.atores.includes(o.actor_id!) ? '✓ ' : ''}${c.name}${c.ativo ? ' (rodando)' : ''}`,
                  desativado: c.atores.includes(o.actor_id!),
                  onClick: () => onAdicionarAoCombate(c.id, o.actor_id!),
                })),
              } as ItemMenu]
            : []),
        ]
      : []
    if (!o || !souMestre) {
      return [
        ...pingItens,
        ...(o?.item_id
          ? [
              { rotulo: 'Interagir', icone: faHandPointer, onClick: () => onInteragir?.(o, celula) } as ItemMenu,
              { rotulo: 'Coletar Item', icone: faHandHolding, onClick: () => onInteragir?.(o, celula, true) } as ItemMenu,
            ]
          : []),
        ...(o && podeEditar(o) ? [editarItem(o)] : []),
        ...doPersonagem,
        ...(o ? itensDeImagem(imagem, o.image_url, o.name) : []),
        // Dono do token (jogador): também vira na horizontal/vertical (12.8).
        ...(o && !souMestre && podeMover(o)
          ? [
              { tipo: 'linha' } as ItemMenu,
              {
                tipo: 'sub', rotulo: 'Transformação Avançada', icone: faSlidersH,
                itens: [
                  { rotulo: 'Virar Horizontalmente', icone: faLeftRight, onClick: () => virarComoDono(o, !o.flip_h, o.flip_v) },
                  { rotulo: 'Virar Verticalmente', icone: faUpDown, onClick: () => virarComoDono(o, o.flip_h, !o.flip_v) },
                ],
              } as ItemMenu,
              ...(o.layer !== 'mapa' ? [menuLanterna(o, (l) => lanternaComoDono(o, l))] : []),
            ]
          : []),
        ...(o && !souMestre && ehMeuToken?.(o)
          ? [
              { tipo: 'linha' } as ItemMenu,
              { rotulo: 'Excluir Token', icone: faTrash, perigo: true, onClick: () => excluirComoDono([o.id]) } as ItemMenu,
            ]
          : []),
        ...(souMestre
          ? [
              { tipo: 'linha' } as ItemMenu,
              { rotulo: 'Colar', icone: faPaste, desativado: !copiados.current.length, onClick: () => colar(menu.mapa) } as ItemMenu,
              ...historicoItens,
            ]
          : []),
      ]
    }
    const ids = selecionados.includes(o.id) ? selecionados : [o.id]
    const todosTravados = ids.every((id) => objetos.find((x) => x.id === id)?.locked)
    const agrupados = ids.some((id) => objetos.find((x) => x.id === id)?.group_id)
    const cada = (f: (x: ObjetoCena) => CamposObjeto) =>
      Object.fromEntries(ids.flatMap((id) => {
        const x = objetos.find((y) => y.id === id)
        return x ? [[id, f(x)]] : []
      }))
    return [
      ...pingItens,
      { tipo: 'linha' },
      { rotulo: 'Copiar', icone: faCopy, onClick: () => copiar(ids) },
      { rotulo: 'Colar', icone: faPaste, desativado: !copiados.current.length, onClick: () => colar(menu.mapa) },
      ...historicoItens,
      ...doPersonagem,
      ...itensDeImagem(imagem, o.image_url, o.name),
      { tipo: 'linha' },
      ...(o.item_id ? [editarItem(o), { rotulo: 'Interagir', icone: faHandPointer, onClick: () => onInteragir?.(o, celula) } as ItemMenu] : []),
      { rotulo: 'Configurar Propriedade', icone: faUserGear, onClick: () => setPropriedade(o) },
      ...(!o.item_id && !o.actor_id && !o.character_id && onCriarItemDoObjeto
        ? [{ rotulo: 'Criar Item', icone: faSquarePlus, onClick: () => onCriarItemDoObjeto(o) } as ItemMenu]
        : []),
      {
        tipo: 'sub', rotulo: 'Vincular Item', icone: faBriefcase,
        itens: [
          { rotulo: `${!o.item_id ? '✓ ' : ''}Nenhum`, onClick: () => alterar(cada(() => ({ item_id: null }))) },
          ...itensDaCampanha.map((i) => ({ rotulo: `${o.item_id === i.id ? '✓ ' : ''}${i.name}`, onClick: () => alterar(cada(() => ({ item_id: i.id }))) })),
        ],
      },
      ...(o.layer !== 'mapa' ? [menuLanterna(o, (l) => alterar(cada(() => ({ lanterna: l }))))] : []),
      {
        tipo: 'sub', rotulo: 'Luz Ambiente', icone: faSun,
        itens: [
          { rotulo: 'Configurar Luz', onClick: () => setConfigLuz(o.id) },
          { tipo: 'linha' },
          {
            rotulo: temLuzAmbiente(o) ? 'Apagar Luz' : 'Acender Luz',
            onClick: () => alterar(cada((x) => {
              const atual = luzCompleta(x.luz_ajuste ?? (x.luz ? null : { raio: 4 }))
              return { luz_ajuste: { ...atual, ligada: !temLuzAmbiente(o) } }
            })),
          },
        ],
      },
      {
        tipo: 'sub', rotulo: 'Efeito Animado', icone: faFire,
        itens: [
          { rotulo: o.efeito ? 'Configurar Efeito' : 'Criar Efeito', onClick: () => setConfigEfeito(o.id) },
          ...(o.efeito ? [{ tipo: 'linha' } as ItemMenu, { rotulo: 'Tirar Efeito', onClick: () => alterar(cada(() => ({ efeito: null }))) } as ItemMenu] : []),
        ],
      },
      { rotulo: `${o.so_uv ? '✓ ' : ''}Só Aparece na Luz UV`, icone: faEye, onClick: () => alterar(cada(() => ({ so_uv: !o.so_uv }))) },
      {
        tipo: 'sub', rotulo: 'Alterar Camada', icone: faLayerGroup,
        itens: CAMADAS.map((c) => ({ rotulo: `${o.layer === c.id ? '✓ ' : ''}${c.rotulo}`, onClick: () => alterar(cada(() => ({ layer: c.id }))) })),
      },
      { tipo: 'linha' },
      { rotulo: 'Trazer para a Frente', icone: faArrowUpWideShort, onClick: () => alterar(Object.fromEntries(Object.entries(ordemParaFrente(objetos, ids)).map(([id, sort]) => [id, { sort }]))) },
      { rotulo: 'Enviar para Trás', icone: faArrowDownWideShort, onClick: () => alterar(Object.fromEntries(Object.entries(ordemParaTras(objetos, ids)).map(([id, sort]) => [id, { sort }]))) },
      {
        rotulo: todosTravados ? 'Desbloquear Posição' : 'Travar Posição', icone: todosTravados ? faLockOpen : faLock,
        onClick: () => alterar(cada(() => ({ locked: !todosTravados }))),
      },
      { tipo: 'linha' },
      {
        tipo: 'sub', rotulo: 'Transformação Avançada', icone: faSlidersH,
        itens: [
          { rotulo: 'Agrupar', icone: faObjectGroup, desativado: ids.length < 2, onClick: () => { const g = crypto.randomUUID(); alterar(cada(() => ({ group_id: g }))) } },
          { rotulo: 'Desagrupar', icone: faObjectUngroup, desativado: !agrupados, onClick: () => alterar(cada(() => ({ group_id: null }))) },
          { tipo: 'linha' },
          { rotulo: 'Virar Horizontalmente', icone: faLeftRight, onClick: () => alterar(cada((x) => ({ flip_h: !x.flip_h }))) },
          { rotulo: 'Virar Verticalmente', icone: faUpDown, onClick: () => alterar(cada((x) => ({ flip_v: !x.flip_v }))) },
        ],
      },
      { tipo: 'linha' },
      { rotulo: 'Eliminar', icone: faTrash, perigo: true, onClick: () => eliminar(ids) },
    ]
  }

  const grade = cena && cena.grid_type !== 'sem' ? cena : null
  const celula = cena ? celulaDaGrade(cena, mapa) : { w: 100, h: 100 }
  const hex = grade?.grid_type === 'hexagono' ? ladrilhoHex(celula.w) : null
  // Lanternas ligadas dos tokens que essa pessoa vê.
  const cones = [...luzesDoAmbiente(objetos, celula, veTudo), ...conesDosTokens(objetos, celula, veTudo)]
  const caminhoUv = caminhoDaLuzUv(cones)
  const traco = grade ? tracoDaGrade(grade.grid_style, grade.grid_thickness) : undefined
  // Alças e giro: o mestre e o dono do token (12.8).
  const selecionadoUnico = selecionados.length === 1 ? objetos.find((o) => o.id === selecionados[0]) ?? null : null
  const unico = selecionadoUnico && podeMover(selecionadoUnico) ? selecionadoUnico : null
  const alcaPx = 7 / vista.escala
  // Vários selecionados: alças e giro em volta do grupo inteiro (só os que essa pessoa pode mexer).
  const grupoSelecionado = selecionados.length > 1 ? objetos.filter((o) => selecionados.includes(o.id) && podeMover(o) && !o.locked) : []
  const caixaGrupo = grupoSelecionado.length > 1 ? caixaDoGrupo(grupoSelecionado) : null

  return (
    <div
      ref={palcoRef}
      className={`mesa-palco${soltando ? ' soltando' : ''}${configLanterna ? ' configurando-lanterna' : ''}`}
      aria-label="Cena"
      style={{ background: cena?.background_color ?? undefined }}
      onPointerDown={comecarNoMapa}
      onPointerMove={mover}
      onPointerUp={(e) => terminar(e)}
      onDoubleClick={() => desenho.aoDuploClique() || som.aoDuploClique()}
      onPointerCancel={() => (gesto.current = null)}
      // Perdeu o mouse no meio de arrastar o mapa (janela, menu…): o arraste acaba, não fica preso.
      onLostPointerCapture={() => {
        if (gesto.current?.tipo === 'mapa') gesto.current = null
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (desenho.aoMenu(e) || som.aoMenu(e)) return
        if (!panouComDireito.current) abrirMenu(e.clientX, e.clientY, null)
      }}
      onDragStart={(e) => e.preventDefault()}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(TIPO_ARRASTO_ATOR) || e.dataTransfer.types.includes(TIPO_ARRASTO_POSICIONAVEL) || e.dataTransfer.types.includes(TIPO_ARRASTO_ITEM) || e.dataTransfer.types.includes(TIPO_ARRASTO_BIBLIOTECA)) {
          e.preventDefault()
          return
        }
        if (!souMestre || (arrastoInterno.current && !e.dataTransfer.types.includes('Files'))) return
        e.preventDefault()
        setSoltando(true)
      }}
      onDragLeave={() => setSoltando(false)}
      onDrop={soltar}
    >
      {cena ? (
        <div
          className="mesa-mundo"
          style={{
            width: mapa.w,
            height: mapa.h,
            transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`,
            filter: filtroAmbiente(cena.luminosity, cena.saturation, cena.shadows),
          }}
        >
          {cena.background_url && <img className="mesa-mundo-fundo" src={cena.background_url} alt="" draggable={false} />}
          {grade && (
            <svg className="mesa-grade" width={mapa.w} height={mapa.h} aria-hidden>
              <defs>
                <pattern id={`grade-${grade.id}`} width={hex ? hex.largura : celula.w} height={hex ? hex.altura : celula.h} patternUnits="userSpaceOnUse">
                  <path d={hex ? hex.caminho : `M${celula.w} 0H0V${celula.h}`} fill="none" stroke={grade.grid_color} strokeWidth={grade.grid_thickness} strokeDasharray={traco} />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#grade-${grade.id})`} opacity={grade.grid_opacity} />
              {/* A borda de fora fecha a última coluna e a última linha (o padrão só desenha em cima e à esquerda). */}
              {!hex && (
                <rect
                  x={grade.grid_thickness / 2} y={grade.grid_thickness / 2}
                  width={Math.max(0, mapa.w - grade.grid_thickness)} height={Math.max(0, mapa.h - grade.grid_thickness)}
                  fill="none" stroke={grade.grid_color} strokeWidth={grade.grid_thickness} strokeDasharray={traco} opacity={grade.grid_opacity}
                />
              )}
            </svg>
          )}

          {/* Escuridão (a da cena + as áreas pintadas) recortada pelas lanternas. O mestre vê os tokens
              por cima dela; o jogador não (vai depois dos tokens, mais abaixo). */}
          {veTudo && <LuzesNoPalco mapa={mapa} souMestre nivel={cena.darkness} areas={esc.areas} cones={cones} celula={celula} />}

          {/* Só na luz UV: pros jogadores, aparece só onde a luz UV bate. */}
          {!veTudo && caminhoUv && (
            <div className="mesa-uv" style={{ width: mapa.w, height: mapa.h, clipPath: `path('${caminhoUv}')` }} aria-hidden>
              {objetos.filter((o) => o.so_uv && o.layer !== 'mestre').map((o) => (
                <div key={o.id} className="mesa-objeto" style={{ left: o.x, top: o.y, width: o.width, height: o.height, transform: `rotate(${o.rotation}deg)` }}>
                  <img src={o.image_url} alt="" draggable={false} style={{ transform: `scale(${o.flip_h ? -1 : 1}, ${o.flip_v ? -1 : 1})` }} />
                </div>
              ))}
            </div>
          )}

          {[...visiveis]
            .sort((a, b) => ORDEM_CAMADA[a.layer] - ORDEM_CAMADA[b.layer] || a.sort - b.sort)
            .map((o) => (
              <div
                key={o.id}
                className={`mesa-objeto${selecionados.includes(o.id) ? ' selecionado' : ''}${focado === o.id ? ' focado' : ''}${o.layer !== 'mapa' ? ' token' : ''}${o.layer === 'mestre' ? ' camada-mestre' : ''}${!veTudo && o.layer !== 'mapa' && o.character_id !== null && personagensDaVisao.includes(o.character_id) ? ' meu' : ''}${podeMover(o) && !o.locked ? ' mexivel' : ''}${o.luz ? ' luz' : ''}${o.so_uv ? ' so-uv' : ''}${o.item_id ? ' interativo' : ''}`}
                style={{ left: o.x, top: o.y, width: o.width, height: o.height, transform: `rotate(${o.rotation}deg)`, ['--borda' as string]: `${2 / vista.escala}px`, ['--px' as string]: `${1 / vista.escala}px` }}
                onPointerDown={(e) => pegarObjeto(e, o)}
                onPointerEnter={() => (sobre.current = o.id)}
                onPointerLeave={() => sobre.current === o.id && (sobre.current = null)}
                onContextMenu={(e) => menuDoObjeto(e, o)}
                onDoubleClick={(e) => {
                  // Com Desenho/Som ligados, o duplo clique é da ferramenta (fechar polígono, editar).
                  if (desenho.ativo || som.ativo || configLanterna) return
                  e.stopPropagation()
                  duploClique(o)
                }}
              >
                <img src={o.image_url} alt={o.name ?? ''} draggable={false} style={{ transform: `scale(${o.flip_h ? -1 : 1}, ${o.flip_v ? -1 : 1})` }} />
                {o.locked && selecionados.includes(o.id) && <FontAwesomeIcon icon={faLock} className="mesa-objeto-trava" style={{ fontSize: 16 / vista.escala }} />}
                {(() => {
                  // Mira em cima do token marcado: a minha mais forte; a dos outros mais apagada, com o nome.
                  const meu = meusAlvos.includes(o.id)
                  const deQuem = Object.values(outrosAlvos).filter((m) => m.alvos.includes(o.id)).map((m) => m.nome)
                  if (!meu && !deQuem.length) return null
                  return (
                    <span className={`mesa-mira${meu ? ' minha' : ''}`} title={[meu ? 'Seu alvo' : '', ...deQuem.map((n) => `Alvo de ${n}`)].filter(Boolean).join(' · ')}>
                      <FontAwesomeIcon icon={faCrosshairs} />
                    </span>
                  )
                })()}
              </div>
            ))}

          {/* Jogador (ou o mestre vendo como jogador): a escuridão cobre também os tokens, então só
              aparece o que a luz pega; os tokens do próprio jogador ficam por cima (bug 26/10). */}
          {!veTudo && <LuzesNoPalco mapa={mapa} souMestre={false} nivel={cena.darkness} areas={esc.areas} cones={cones} celula={celula} sobreTokens />}

          {/* Alças de tamanho e a bolinha de girar, por cima de tudo (12.8) */}
          {unico && !unico.locked && (
            <div
              className="mesa-selecao"
              style={{ left: unico.x, top: unico.y, width: unico.width, height: unico.height, transform: `rotate(${unico.rotation}deg)`, ['--borda' as string]: `${2 / vista.escala}px` }}
            >
              {ALCAS.map((a) => (
                <span
                  key={`${a.hx}${a.hy}`}
                  className="mesa-alca"
                  style={{ width: alcaPx, height: alcaPx, left: `${(a.hx + 1) * 50}%`, top: `${(a.hy + 1) * 50}%`, cursor: a.hx === 0 ? 'ns-resize' : a.hy === 0 ? 'ew-resize' : a.hx === a.hy ? 'nwse-resize' : 'nesw-resize' }}
                  onPointerDown={(e) => pegarAlca(e, unico, a)}
                />
              ))}
              <span className="mesa-giro" style={{ width: alcaPx * 1.4, height: alcaPx * 1.4, top: -alcaPx * 2.6, right: -alcaPx * 2.6 }} onPointerDown={(e) => pegarGiro(e, unico)} title="Girar" />
            </div>
          )}

          {caixaGrupo && (
            <div
              className="mesa-selecao mesa-selecao-grupo"
              style={{ left: caixaGrupo.x, top: caixaGrupo.y, width: caixaGrupo.width, height: caixaGrupo.height, ['--borda' as string]: `${2 / vista.escala}px` }}
            >
              {ALCAS.map((a) => (
                <span
                  key={`${a.hx}${a.hy}`}
                  className="mesa-alca"
                  style={{ width: alcaPx, height: alcaPx, left: `${(a.hx + 1) * 50}%`, top: `${(a.hy + 1) * 50}%`, cursor: a.hx === 0 ? 'ns-resize' : a.hy === 0 ? 'ew-resize' : a.hx === a.hy ? 'nwse-resize' : 'nesw-resize' }}
                  onPointerDown={(e) => pegarAlcaDoGrupo(e, grupoSelecionado, a)}
                />
              ))}
              <span className="mesa-giro" style={{ width: alcaPx * 1.4, height: alcaPx * 1.4, top: -alcaPx * 2.6, right: -alcaPx * 2.6 }} onPointerDown={(e) => pegarGiroDoGrupo(e, grupoSelecionado)} title="Girar todos" />
            </div>
          )}

          {caixa && (
            <div
              className="mesa-caixa-selecao"
              style={{
                left: Math.min(caixa.a.x, caixa.b.x),
                top: Math.min(caixa.a.y, caixa.b.y),
                width: Math.abs(caixa.b.x - caixa.a.x),
                height: Math.abs(caixa.b.y - caixa.a.y),
                ['--borda' as string]: `${1.5 / vista.escala}px`,
              }}
            />
          )}

          {/* Desenhos (12.13): por cima do mapa e da grade, embaixo dos tokens só quando não se está desenhando. */}
          {desenho.camada}
          {/* Brilho das lanternas por cima dos tokens e desenhos (a UV pinta de roxo). */}
          <BrilhoDasLanternas mapa={mapa} cones={cones} celula={celula} />
          {/* Efeitos animados (fogo, água, nuvem…), por cima da escuridão. */}
          <EfeitosNoPalco objetos={visiveis.filter((o) => o.efeito)} celula={celula} />
          {som.camada}
          {escuro.camada}

          {/* Réguas: a minha e a de quem mais estiver medindo (12.13). */}
          {cena && (() => {
            const todas = [
              ...(regua ? [{ chave: 'eu', nome: '', pontos: [...regua.pontos, regua.atual] }] : []),
              ...Object.values(obj.reguas).filter((r) => r.userId !== userId && r.pontos).map((r) => ({ chave: r.userId, nome: r.nome, pontos: r.pontos! })),
            ].filter((r) => r.pontos.length > 1)
            if (!todas.length) return null
            const px = 1 / vista.escala
            return (
              <svg className="mesa-regua" width={mapa.w} height={mapa.h} aria-hidden>
                {todas.map((r) => {
                  const m = medir(r.pontos, gradeDaRegua())
                  const fim = r.pontos[r.pontos.length - 1]
                  return (
                    <g key={r.chave}>
                      <polyline points={r.pontos.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#000" strokeWidth={7 * px} strokeLinejoin="round" opacity={0.55} />
                      <polyline points={r.pontos.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#e8e8ec" strokeWidth={3 * px} strokeLinejoin="round" />
                      {r.pontos.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5 * px} fill="#e8e8ec" stroke="#000" strokeWidth={1.5 * px} />)}
                      {r.pontos.length > 2 && m.trechos.map((t, i) => (
                        <text key={i} x={(r.pontos[i].x + r.pontos[i + 1].x) / 2} y={(r.pontos[i].y + r.pontos[i + 1].y) / 2 - 8 * px} fontSize={13 * px} className="mesa-regua-trecho">
                          {textoDaDistancia(t, cena)}
                        </text>
                      ))}
                      <text x={fim.x + 12 * px} y={fim.y - 12 * px} fontSize={17 * px} className="mesa-regua-total">
                        {textoDaDistancia(m.total, cena)}{r.nome ? ` · ${r.nome}` : ''}
                      </text>
                    </g>
                  )
                })}
              </svg>
            )
          })()}

          {/* Configurar Lanterna: a seta que está sendo desenhada. */}
          {seta && (
            <svg className="mesa-seta-lanterna" width={mapa.w} height={mapa.h} aria-hidden>
              <defs>
                <marker id="seta-lanterna-ponta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10z" fill="#ffe9b8" />
                </marker>
              </defs>
              {/* Prévia da luz: a seta decide a direção e até onde ela vai. */}
              {(() => {
                const o = objetos.find((x) => x.id === configLanterna)
                if (!o || Math.hypot(seta.b.x - seta.a.x, seta.b.y - seta.a.y) < 5) return null
                const c = coneDaLanterna({ ...o, lanterna_ajuste: ajusteDaSeta(o, seta.a, seta.b) }, o.lanterna ?? 'comum', celula)
                return <path d={caminhoDoCone(c)} fill="rgba(255,233,184,0.12)" stroke="#ffe9b8" strokeWidth={1.5 / vista.escala} strokeDasharray={`${6 / vista.escala} ${4 / vista.escala}`} />
              })()}
              <line x1={seta.a.x} y1={seta.a.y} x2={seta.b.x} y2={seta.b.y} stroke="#ffe9b8" strokeWidth={3 / vista.escala} markerEnd="url(#seta-lanterna-ponta)" />
              <circle cx={seta.a.x} cy={seta.a.y} r={5 / vista.escala} fill="#ffe9b8" />
            </svg>
          )}

          {pings.map((p) => (
            <span key={p.id} className="mesa-ping" style={{ left: p.x, top: p.y, ['--escala' as string]: String(1 / vista.escala) }}>
              <span className="mesa-ping-nome">{p.nome}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mesa-palco-vazio">{souMestre ? 'Nenhuma cena ativa. Crie uma na aba Cenas ou arraste uma imagem pra cá.' : 'Nenhuma cena ativa'}</p>
      )}
      {/* Filtro de iluminação: uma luz colorida por cima do mapa inteiro (lua de sangue, luz verde…). */}
      {cena?.filtro_cor && <div className="mesa-filtro-luz" style={{ background: cena.filtro_cor, opacity: cena.filtro_intensidade }} aria-hidden />}
      {cena?.weather && <EfeitoClimatico key={cena.weather} clima={cena.weather} cor={cena.weather_cor} />}
      {soltando && <div className="mesa-soltar">{cena?.background_url ? 'Solte pra colocar a imagem na cena' : 'Solte pra usar como fundo da cena'}</div>}
      {aviso && !soltando && <div className="mesa-soltar" role="status">{aviso}</div>}
      {souMestre && cena && (
        comoJogador ? (
          <div className="mesa-visao-jogador" role="status" onPointerDown={(e) => e.stopPropagation()}>
            <FontAwesomeIcon icon={faEye} /> Vendo como {comoJogador.nome ?? 'jogador'}
            <button type="button" onClick={() => setComoJogador(null)}>Voltar à visão do mestre</button>
          </div>
        ) : (
          <button
            type="button"
            className="mesa-visao-botao"
            onPointerDown={(e) => e.stopPropagation()}
            title="Ver a mesa como um jogador vê. Com o token de um personagem selecionado, como aquele personagem."
            onClick={() => {
              const o = objetos.find((x) => selecionados.includes(x.id) && x.character_id)
              setComoJogador(o ? { personagens: [o.character_id!], nome: o.name || null } : { personagens: [], nome: null })
            }}
          >
            <FontAwesomeIcon icon={faEye} /> Ver como jogador
          </button>
        )
      )}
      {configLanterna && (
        <p className="mesa-desenho-aviso" role="status">
          Configurar Lanterna: <kbd>Clique + Arraste</kbd> partindo da lanterna do token, na direção da luz; o tamanho da seta é até onde a luz vai · <kbd>Esc</kbd> cancela
        </p>
      )}

      {/* O menu não pode deixar o clique cair no mapa (o palco captura o ponteiro). */}
      {menu && (
        <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
          <MenuContexto x={menu.x} y={menu.y} itens={itensDoMenu()} onFechar={() => setMenu(null)} />
        </div>
      )}

      <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        {desenho.janelas}
        {som.janelas}
        {escuro.janelas}
      </div>

      {(() => {
        const o = configLuz ? objetos.find((x) => x.id === configLuz.id) : null
        if (!o || !configLuz) return null
        const original = configLuz.original ?? null
        return (
          <ConfigurarLuz
            key={o.id}
            objeto={o}
            onPrevia={(l: LuzAmbiente) => obj.alterarVarios({ [o.id]: { luz_ajuste: l } }, false)}
            onSalvar={(l) => {
              // Desfazer volta pra como estava antes de abrir a janela (não pra última prévia).
              fazer({ tipo: 'alterar', antes: { [o.id]: { luz_ajuste: original } }, depois: { [o.id]: { luz_ajuste: l } } })
              setConfigLuz(null)
            }}
            onFechar={() => {
              obj.alterarVarios({ [o.id]: { luz_ajuste: original } }, false)
              setConfigLuz(null)
            }}
          />
        )
      })()}

      {(() => {
        const o = configEfeito ? objetos.find((x) => x.id === configEfeito.id) : null
        if (!o || !configEfeito) return null
        const original = configEfeito.original ?? null
        return (
          <ConfigurarEfeito
            key={o.id}
            objeto={o.efeito ? o : { ...o, efeito: efeitoPadrao('fogo') }}
            onPrevia={(e: Efeito) => obj.alterarVarios({ [o.id]: { efeito: e } }, false)}
            onSalvar={(e) => {
              fazer({ tipo: 'alterar', antes: { [o.id]: { efeito: original } }, depois: { [o.id]: { efeito: e } } })
              setConfigEfeito(null)
            }}
            onFechar={() => {
              obj.alterarVarios({ [o.id]: { efeito: original } }, false)
              setConfigEfeito(null)
            }}
          />
        )
      })()}

      {propriedade && (
        <ConfigurarPropriedade
          objeto={propriedade}
          jogadores={jogadores}
          onSalvar={(campos) => { alterar({ [propriedade.id]: campos }); setPropriedade(null) }}
          onFechar={() => setPropriedade(null)}
        />
      )}
    </div>
  )
}

// Configurar Propriedade do token (12.8): quem, além do dono e do mestre, pode movê-lo.
function ConfigurarPropriedade({ objeto, jogadores, onSalvar, onFechar }: {
  objeto: ObjetoCena
  jogadores: { userId: string; rotulo: string }[]
  onSalvar: (campos: CamposObjeto) => void
  onFechar: () => void
}) {
  const inicial = objeto.move_permission === 'jogadores' ? objeto.movable_by[0] ?? 'dono' : objeto.move_permission
  const [quem, setQuem] = useState(inicial)
  return (
    <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <Janela titulo={`Configurar Propriedade: ${objeto.name || 'Token'}`} icone={faBullseye} largura={420} onFechar={onFechar}>
        <form
          className="janela-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (quem === 'dono' || quem === 'todos') onSalvar({ move_permission: quem, movable_by: [] })
            else onSalvar({ move_permission: 'jogadores', movable_by: [quem] })
          }}
        >
          <Campo rotulo="Quem pode mover" dica="O mestre sempre pode mover. O dono do personagem também.">
            <select value={quem} aria-label="Quem pode mover" onChange={(e) => setQuem(e.target.value)}>
              <option value="dono">Somente Eu</option>
              <option value="todos">Todos os Jogadores</option>
              {jogadores.map((j) => <option key={j.userId} value={j.userId}>{j.rotulo}</option>)}
            </select>
          </Campo>
          <button type="submit" className="janela-botao">Salvar Alterações</button>
        </form>
      </Janela>
    </div>
  )
}
