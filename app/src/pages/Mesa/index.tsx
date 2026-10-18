import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import BarraIcones, { BotaoIcone } from './BarraIcones'
import PainelConfig from './PainelConfig'
import PainelSessao from './PainelSessao'
import EscolherPersonagem from '../../components/EscolherPersonagem'
import PalcoCena from './PalcoCena'
import PainelCenas, { CriarPasta } from './PainelCenas'
import EditorCena from './EditorCena'
import { enviarImagemDaCena, useCenas } from './useCenas'
import { useObjetos, type Ping } from './useObjetos'
import { useDesenhos } from './useDesenhos'
import { useSons } from './useSons'
import { usePlaylists } from './usePlaylists'
import PainelPlaylist from './PainelPlaylist'
import PainelPosicionaveis, { JanelaNota } from './PainelPosicionaveis'
import PainelItens, { CriarItem, CriarItemDoObjeto } from './PainelItens'
import Calendario from './Calendario'
import { ConfigurarTempo } from './ConfigurarTempo'
import { useCalendario } from './useCalendario'
import { comAgora, momento, tempoAtivo, tempoCompleto, tomDaHora, type ConfigTempo } from './tempo'
import FichaItem from './FichaItem'
import { ConfiguracoesDoJogo, JanelaChat, JanelaCombate, JanelaControles, JanelaDados, JanelaFontes, JanelaInterface, JanelaMundo, JanelaPermissoes, JanelaSom, JanelaUsuarios, type SecaoConfig } from './JanelasConfig'
import type { JanelaDoPainel } from './PainelConfig'
import { aplicarInterface, combateDa, lerInterface, nomesDasFontes, podeJogador, type ConfigCampanha, type PermissoesCampanha } from './configuracoes'
import type { EstiloDados } from './estiloDados'
import { FONTES } from './ChatEntrada'
import { sistemaDe } from '../../sistemas'
import PainelDiario, { CriarEntrada } from './PainelDiario'
import JanelaDiario from './JanelaDiario'
import { enviarArquivoDoDiario, useDiario } from './useDiario'
import { exportarDiario, importarDiario, nivelNoDiario } from './diario'
import { comandoDeRolagem, rolarFormula } from './rolador'
import { IMAGEM_LUZ, LUZ_PADRAO } from './luz'
import { IMAGEM_EFEITO } from './efeitos'
import JanelaInteracao from './JanelaInteracao'
import DadosNaTela from './DadosNaTela'
import { useItens } from './useItens'
import { nivelNoItem } from './itens'
import { usePosicionaveis } from './usePosicionaveis'
import { caixaNoPonto, CATEGORIAS_POSICIONAVEIS, ehImagem, type CategoriaPosicionavel, type Posicionavel } from './posicionaveis'
import { tamanhoInicial, type Pasta } from './cenas'
import PainelPersonagens from './PainelPersonagens'
import { ConfigurarPropriedadeAtor, ConfigurarToken, ConfirmarExclusao, CriarPersonagem, FichaPortatil, PainelVariacoes } from './JanelasAtor'
import { colocarToken, enviarImagemDeToken, trocarVariacao, useAtores } from './useAtores'
import { imagemDoToken, nivelDoJogador, nivelNaFichaDoJogador, variacoesDoToken, type Ator, type NivelAcesso } from './atores'
import Janela from './Janela'
import PainelCombate, { IndicadorTurno } from './PainelCombate'
import CriarCombate, { type AtorDoCombate } from './CriarCombate'
import EditorAmeaca, { carregarParaEditar, criaturaVazia, type CriaturaEditavel } from './EditorAmeaca'
import { useCombate, type Combate } from './useCombate'
import type { Combatente } from './combate'
import type { Cena, ObjetoCena } from './cenas'
import { useFps, useSessaoMesa } from './useSessaoMesa'
import { autoria, resumoDaMensagem, textoPuro, type Mensagem, type ModoEnvio } from './chat'
import { enviarImagemDoChat, useChat } from './useChat'
import PainelChat from './PainelChat'
import ChatEntrada from './ChatEntrada'
import ModosEnvio from './ModosEnvio'
import ChatMensagem from './ChatMensagem'
import { QuemVeContexto } from './AcaoNoChat'
import { useMira } from './useMira'
import { useAnunciarAlvos } from '../../lib/miraDaMesa'
import { postarAtaque } from './acoesDeMira'
import CelularNaMesa from '../Celular/CelularNaMesa'
import { CentralDeSustos, SustoNaTela } from './CentralDeSustos'
import { useCanalDeSustos, type SustoDisparado } from './dadosDosSustos'
import { ImagensMostradas } from './mostrarImagem'
import type { AcaoAtaque, Alvo, AtaqueDaAcao } from './mira'
import {
  ABAS_DIREITA,
  CATEGORIAS_ESQUERDA,
  FERRAMENTAS,
  ACOES_ESQUERDA,
  AJUDA_FERRAMENTA,
  comFichasDadas,
  conectados as filtrarConectados,
  linkDeConvite,
  type AbaDireita,
  type CategoriaEsquerda,
  type Membro,
} from './mesa'

// Item sem imagem colocado na mesa: uma maleta simples (o mestre pode trocar a imagem na ficha).
const IMAGEM_ITEM_SEM_FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="8" y="26" width="84" height="62" rx="8" fill="#2b2e38" stroke="#b9a46f" stroke-width="4"/><path d="M36 26V18a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v8" fill="none" stroke="#b9a46f" stroke-width="4"/><rect x="8" y="48" width="84" height="6" fill="#b9a46f"/></svg>')

type Campanha = {
  id: string
  name: string
  owner_id: string
  invite_code: string
  accent_color: string | null
  active_scene_id: string | null
  system: string // sistema de jogo (src/sistemas)
  permissoes: PermissoesCampanha // o que os jogadores podem (Configurações → Permissões)
  configuracoes: ConfigCampanha // fontes adicionais, Monitor de Combate
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'sem-acesso' }
  // semFicha: o jogador escolheu Entrar sem ficha (o mestre dá uma depois).
  | { tipo: 'pronta'; campanha: Campanha; membros: Membro[]; meuModo: ModoEnvio; semFicha: boolean }

// A Mesa (KAN-46): palco da cena no centro, abas na barra direita, ferramentas
// de cena na esquerda e o painel de sessão no rodapé esquerdo.
export default function Mesa() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user.id
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  // Como no Foundry, a mesa abre com o chat à mostra.
  const [aba, setAba] = useState<AbaDireita>('chat')
  const [recolhida, setRecolhida] = useState(false)
  // Celular do personagem (jogador) ou a central dos celulares (mestre), 14/10.
  const [celularAberto, setCelularAberto] = useState(false)
  // Jump scare (16/10): a central do mestre e o susto que está na tela agora.
  const [centralSustos, setCentralSustos] = useState(false)
  const [susto, setSusto] = useState<SustoDisparado | null>(null)
  const [categoria, setCategoria] = useState<CategoriaEsquerda>('tokens')
  const [ferramenta, setFerramenta] = useState('selecionar')
  const [copiado, setCopiado] = useState(false)
  // Configurações (KAN-54): o dado de cada um, e as janelas abertas.
  const [estilosDados, setEstilosDados] = useState<Record<string, Partial<EstiloDados> | null>>({})
  const [janelasConfig, setJanelasConfig] = useState<(JanelaDoPainel | SecaoConfig)[]>([])
  const abrirConfig = (j: JanelaDoPainel | SecaoConfig) => setJanelasConfig((l) => (l.includes(j) ? l : [...l, j]))
  const fecharConfig = (j: JanelaDoPainel | SecaoConfig) => setJanelasConfig((l) => l.filter((x) => x !== j))

  // Escala da interface (Configurações → Interface de Usuário), guardada no navegador.
  useEffect(() => {
    aplicarInterface(lerInterface())
  }, [])

  useEffect(() => {
    if (!id || !userId) return
    let cancelado = false
    ;(async () => {
      // RLS só devolve a campanha pra quem é dono ou membro.
      const { data: campanha } = await supabase
        .from('campaigns')
        .select('id, name, owner_id, invite_code, accent_color, active_scene_id, system, permissoes, configuracoes')
        .eq('id', id)
        .maybeSingle()
      if (cancelado) return
      if (!campanha) {
        setEstado({ tipo: 'sem-acesso' })
        return
      }
      const [{ data: linhas }, { data: personagens }] = await Promise.all([
        supabase.from('campaign_members').select('user_id, role, chat_mode, sem_ficha').eq('campaign_id', id),
        supabase.from('characters').select('id, user_id, name, avatar_url, npc').eq('campaign_id', id),
      ])
      const ids = [...new Set([campanha.owner_id, ...(linhas ?? []).map((l) => l.user_id)])]
      const { data: perfis } = await supabase.from('profiles').select('id, display_name, avatar_url, dados3d').in('id', ids)
      if (cancelado) return
      const perfil = new Map((perfis ?? []).map((p) => [p.id, p]))
      const membros: Membro[] = ids.map((uid) => {
        // NPC do mestre não é o personagem dele (fica na aba Personagens).
        const p = (personagens ?? []).find((c) => c.user_id === uid && !c.npc)
        return {
          userId: uid,
          papel: uid === campanha.owner_id ? 'mestre' : 'jogador',
          nomeConta: perfil.get(uid)?.display_name ?? 'Sem nome',
          fotoConta: perfil.get(uid)?.avatar_url ?? null,
          personagem: p?.name ?? null,
          personagemId: p?.id ?? null,
          fotoPersonagem: p?.avatar_url ?? null,
        }
      })
      setEstilosDados(Object.fromEntries((perfis ?? []).map((p) => [p.id, p.dados3d as Partial<EstiloDados> | null])))
      const minha = (linhas ?? []).find((l) => l.user_id === userId)
      const meuModo = minha?.chat_mode as ModoEnvio | undefined
      setEstado({ tipo: 'pronta', campanha, membros, meuModo: meuModo ?? 'publico_personagem', semFicha: !!minha?.sem_ficha })
    })()
    return () => {
      cancelado = true
    }
  }, [id, userId])

  const pronta = estado.tipo === 'pronta' ? estado : null
  const { presencas, latencia } = useSessaoMesa(pronta?.campanha.id, userId)
  const fps = useFps()
  const chat = useChat(pronta?.campanha.id)
  const [modoEscolhido, setModoEscolhido] = useState<ModoEnvio | null>(null)
  const [destaqueFechado, setDestaqueFechado] = useState<string | null>(null)
  const cenas = useCenas(pronta?.campanha.id, pronta?.campanha.active_scene_id ?? null)
  const [editandoCena, setEditandoCena] = useState<string | null>(null)
  const [pings, setPings] = useState<Ping[]>([])
  const [focoPing, setFocoPing] = useState<Ping | null>(null)
  // Ping (12.8): marca o ponto por uns segundos; o de foco leva a câmera de todos até ele.
  const receberPing = useCallback((p: Ping) => {
    setPings((l) => [...l, p])
    if (p.foco) setFocoPing(p)
    setTimeout(() => setPings((l) => l.filter((x) => x.id !== p.id)), 2600)
  }, [])
  const objetos = useObjetos(cenas.atual?.id ?? null, receberPing)
  const desenhos = useDesenhos(cenas.atual?.id ?? null)
  const sons = useSons(cenas.atual?.id ?? null)
  // Lista de Reprodução: toca pra todo mundo mesmo com a aba fechada.
  const playlists = usePlaylists(pronta?.campanha.id, !!pronta && pronta.campanha.owner_id === userId)
  // Itens (12.10): itens interativos da campanha.
  const itens = useItens(pronta?.campanha.id)
  const [criandoItem, setCriandoItem] = useState<{ pasta: string | null } | null>(null)
  const [pastaItem, setPastaItem] = useState<{ pai: string | null; editando?: Pasta } | null>(null)
  const [itensAbertos, setItensAbertos] = useState<string[]>([])
  const [propriedadeItem, setPropriedadeItem] = useState<string | null>(null)
  // Diário (KAN-53, spec 12.11).
  const diario = useDiario(pronta?.campanha.id)
  const [criandoEntrada, setCriandoEntrada] = useState<{ pasta: string | null } | null>(null)
  const [pastaDiario, setPastaDiario] = useState<{ pai: string | null; editando?: Pasta } | null>(null)
  const [diariosAbertos, setDiariosAbertos] = useState<string[]>([])
  const [propriedadeDiario, setPropriedadeDiario] = useState<string | null>(null)
  // Interagindo com um item da mesa: o token dele e o tamanho do quadrado (pro alcance).
  const [interagindo, setInteragindo] = useState<{ tokenId: string; celula: { w: number; h: number }; coletar?: boolean } | null>(null)
  // Objeto do mapa virando item (botão direito → Criar Item).
  const [itemDoObjeto, setItemDoObjeto] = useState<ObjetoCena | null>(null)
  // Posicionáveis (12.6): armazém do mestre.
  const posicionaveis = usePosicionaveis(pronta?.campanha.id, !!pronta && pronta.campanha.owner_id === userId)
  const [categoriaPosicionavel, setCategoriaPosicionavel] = useState<CategoriaPosicionavel>('token')
  const [notaAberta, setNotaAberta] = useState<Posicionavel | { nova: true; pasta: string | null } | null>(null)
  const [pedidoPaletaSom, setPedidoPaletaSom] = useState(0)
  const [pedidoLimparSom, setPedidoLimparSom] = useState(0)
  const [pedidoLimparEscuridao, setPedidoLimparEscuridao] = useState(0)
  // Paleta e Limpar Desenhos são botões de ação: o número muda e o palco abre a janela.
  const [pedidoPaleta, setPedidoPaleta] = useState(0)
  const [pedidoLimpar, setPedidoLimpar] = useState(0)
  const atores = useAtores(pronta?.campanha.id)
  // Tempo e Calendário: anotações por dia.
  const notasCalendario = useCalendario(pronta?.campanha.id, userId)
  // Com as fichas que o mestre deu (Dono) valendo como personagem de quem recebeu.
  const membros = useMemo(
    () => comFichasDadas(pronta?.membros ?? [], atores.atores, (cid) => atores.fichas[cid]?.avatar_url ?? null),
    [pronta?.membros, atores.atores, atores.fichas],
  )
  const online = useMemo(() => (pronta ? filtrarConectados(membros, presencas) : []), [pronta, membros, presencas])
  const [criandoAtor, setCriandoAtor] = useState<{ pasta: string | null } | null>(null)
  const [pastaAtor, setPastaAtor] = useState<{ pai: string | null; editando?: Pasta } | null>(null)
  const [propriedadeAtor, setPropriedadeAtor] = useState<string | null>(null)
  const [tokenAtor, setTokenAtor] = useState<string | null>(null)
  const [excluindoAtor, setExcluindoAtor] = useState<string | null>(null)
  const [fichasAbertas, setFichasAbertas] = useState<string[]>([])
  const [tokenDasVariacoes, setTokenDasVariacoes] = useState<string | null>(null)
  const combate = useCombate(pronta?.campanha.id)
  const [montandoCombate, setMontandoCombate] = useState<{ editando?: Combate; adicionarEm?: Combate } | null>(null)
  const [vdDe, setVdDe] = useState<Record<string, number | null>>({})
  const idsAmeacas = [...new Set(combate.combates.flatMap((c) => c.ameacas))].sort().join(',')
  // VD das ameaças dos combates salvos, pro card mostrar o VD total.
  useEffect(() => {
    const faltam = idsAmeacas.split(',').filter((id) => id && !(id in vdDe))
    if (!faltam.length) return
    supabase.from('creatures').select('id, vd').in('id', faltam).then(({ data }) => {
      setVdDe((m) => ({ ...m, ...Object.fromEntries((data ?? []).map((c) => [c.id, c.vd])) }))
    })
  }, [idsAmeacas, vdDe])
  const [avisoPalco, setAvisoPalco] = useState<string | null>(null)

  // ---- Mensagem nova no chat (pedido da Millie): notificação perto do chat, o ícone pisca e,
  // com a aba do navegador escondida, o título ganha o número de mensagens novas.
  const [notificacoes, setNotificacoes] = useState<Mensagem[]>([])
  const [chatPiscando, setChatPiscando] = useState(false)
  const [foraDaAba, setForaDaAba] = useState(0)
  const vistas = useRef<Set<string> | null>(null)
  const chatVisivel = aba === 'chat' && !recolhida
  useEffect(() => {
    const lista = chat.mensagens
    if (!lista) return
    // Primeira carga: o que já estava lá não é novidade.
    if (!vistas.current) {
      vistas.current = new Set(lista.map((m) => m.id))
      return
    }
    const novas = lista.filter((m) => !vistas.current!.has(m.id))
    novas.forEach((m) => vistas.current!.add(m.id))
    // Ataque/cura que eu mandei da ficha: o chat abre sozinho, com o próximo botão à mostra.
    if (novas.some((m) => m.user_id === userId && m.acao)) {
      setAba('chat')
      setRecolhida(false)
    }
    const deOutros = novas.filter((m) => m.user_id !== userId)
    if (!deOutros.length) return
    if (document.hidden) setForaDaAba((n) => n + deOutros.length)
    if (chatVisivel) return
    setChatPiscando(true)
    setNotificacoes((l) => [...l, ...deOutros].slice(-3))
    for (const m of deOutros) setTimeout(() => setNotificacoes((l) => l.filter((x) => x.id !== m.id)), 7000)
  }, [chat.mensagens, userId, chatVisivel])
  useEffect(() => {
    if (!chatVisivel) return
    setChatPiscando(false)
    setNotificacoes([])
  }, [chatVisivel])
  useEffect(() => {
    const voltou = () => !document.hidden && setForaDaAba(0)
    document.addEventListener('visibilitychange', voltou)
    return () => document.removeEventListener('visibilitychange', voltou)
  }, [])
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = foraDaAba ? `(${foraDaAba}) ${base}` : base
  }, [foraDaAba])
  const [editorAmeaca, setEditorAmeaca] = useState<{ inicial: CriaturaEditavel; depois?: (id: string) => void } | null>(null)

  // ---- Mira (12.9) ----
  const euNaMesa = membros.find((m) => m.userId === userId)
  const mira = useMira(pronta?.campanha.id, userId, euNaMesa?.personagem || euNaMesa?.nomeConta || 'Alguém')
  const alvosComNome: Alvo[] = mira.meus.flatMap((id) => {
    const o = objetos.objetos.find((x) => x.id === id)
    if (!o) return []
    const a = o.actor_id ? atores.atores.find((x) => x.id === o.actor_id) : undefined
    return [{ token_id: id, nome: o.name || a?.name || 'Token' }]
  })
  // A ficha (que abre num iframe) fica sabendo dos alvos pra transformar o ataque em ação no chat.
  useAnunciarAlvos(pronta?.campanha.id, alvosComNome)
  // Trocou de cena: os alvos da outra cena não valem mais.
  const cenaVista = cenas.atual?.id
  const limparAlvos = mira.limpar
  useEffect(() => limparAlvos(), [cenaVista, limparAlvos])

  // Mudanças na campanha (nome, cor, permissões, fontes, combate) e no dado de alguém, na hora.
  useEffect(() => {
    const campanhaId = pronta?.campanha.id
    if (!campanhaId) return
    const ids = (pronta?.membros ?? []).map((m) => m.userId)
    const canal = supabase
      .channel(`config:${pronta?.campanha.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${pronta?.campanha.id}` }, (p) => {
        const n = p.new as Partial<Campanha>
        setEstado((e) => (e.tipo === 'pronta' ? { ...e, campanha: { ...e.campanha, name: n.name ?? e.campanha.name, accent_color: n.accent_color ?? null, permissoes: n.permissoes ?? {}, configuracoes: n.configuracoes ?? {} } } : e))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=in.(${ids.join(',')})` }, (p) => {
        const n = p.new as { id: string; dados3d: Partial<EstiloDados> | null; display_name: string | null }
        setEstilosDados((m) => ({ ...m, [n.id]: n.dados3d }))
        if (n.display_name) setEstado((e) => (e.tipo === 'pronta' ? { ...e, membros: e.membros.map((x) => (x.userId === n.id ? { ...x, nomeConta: n.display_name! } : x)) } : e))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronta?.campanha.id, pronta?.membros.length])

  // Fontes Adicionais: entram no navegador de todo mundo (e no menu de fontes do chat).
  useEffect(() => {
    for (const f of pronta?.campanha.configuracoes?.fontes ?? []) {
      try {
        const face = new FontFace(f.nome, `url(${JSON.stringify(f.url)})`, { weight: f.peso, style: f.estilo })
        face.load().then((x) => document.fonts.add(x)).catch(() => {})
      } catch {
        // fonte inválida: ignora
      }
    }
    for (const n of nomesDasFontes(pronta?.campanha.configuracoes)) if (!FONTES.includes(n)) FONTES.push(n)
  }, [pronta?.campanha.configuracoes])

  // Susto chegando pela mesa (o mestre dispara; quem é alvo vê na hora). Fica antes dos returns
  // de carregando/sem acesso: hook depois deles derrubava a mesa (tela preta, 16/10).
  const dispararSusto = useCanalDeSustos(pronta?.campanha.id ?? null, userId ?? null, (s) => setSusto(s))

  if (estado.tipo === 'carregando') {
    return <main className="mesa mesa-aviso"><p>Carregando a mesa…</p></main>
  }

  if (estado.tipo === 'sem-acesso') {
    return (
      <main className="mesa mesa-aviso">
        <h1>Mesa indisponível</h1>
        <p>Essa campanha não existe ou você não faz parte dela. Peça o link de convite pra quem está mestrando.</p>
        <Link to="/jogar" className="btn-pill">Voltar</Link>
      </main>
    )
  }

  const { campanha } = estado
  const souMestre = campanha.owner_id === userId
  const meu = membros.find((m) => m.userId === userId)

  // Jogador entra com um personagem na campanha, ou sem ficha (o mestre dá uma depois).
  if (!souMestre && !meu?.personagemId && !estado.semFicha) {
    return (
      <main className="mesa mesa-aviso mesa-sem-personagem">
        <EscolherPersonagem
          campanha={campanha}
          voltarPara={`/mesa/${campanha.id}`}
          onFechar={() => navigate('/jogar')}
          onSemFicha={() => setEstado((e) => (e.tipo === 'pronta' ? { ...e, semFicha: true } : e))}
        />
      </main>
    )
  }
  const abaAtual = ABAS_DIREITA.find((a) => a.id === aba)

  async function copiarConvite() {
    await navigator.clipboard.writeText(linkDeConvite(window.location.origin, campanha.invite_code))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function salvarCampanha(campos: Partial<Pick<Campanha, 'name' | 'accent_color' | 'permissoes' | 'configuracoes'>>) {
    const { error } = await supabase.from('campaigns').update(campos).eq('id', campanha.id)
    if (error) {
      avisar('Não deu pra salvar a configuração.', true)
      return false
    }
    setEstado((e) => (e.tipo === 'pronta' ? { ...e, campanha: { ...e.campanha, ...campos } } : e))
    return true
  }

  // Tempo e Calendário: o mestre mexe e a tela anda na hora (salva por trás).
  async function salvarTempo(t: ConfigTempo | null) {
    const configuracoes = { ...(campanha.configuracoes ?? {}) }
    if (t) configuracoes.tempo = t
    else delete configuracoes.tempo
    setEstado((e) => (e.tipo === 'pronta' ? { ...e, campanha: { ...e.campanha, configuracoes } } : e))
    const { error } = await supabase.from('campaigns').update({ configuracoes }).eq('id', campanha.id)
    if (error) avisar('Não deu pra salvar o tempo.', true)
    return !error
  }
  const tempoLigado = tempoAtivo(campanha.configuracoes?.tempo)
  const tempo = tempoCompleto(campanha.configuracoes?.tempo)
  const tom = tempoLigado && tempo.relogio && tempo.tomDaCena ? tomDaHora(tempo, momento(comAgora(tempo))) : null

  const eu = membros.find((m) => m.userId === userId)
  const mestre = membros.find((m) => m.papel === 'mestre')
  const modo = modoEscolhido ?? estado.meuModo
  const chatAberto = !recolhida && aba === 'chat'
  // Mensagem destacada pelo mestre aparece no meio da mesa pra todo mundo.
  const destaque = [...(chat.mensagens ?? [])].reverse().find((m) => m.destacada)

  // O modo fica salvo na campanha porque também decide quem vê as rolagens da ficha.
  async function mudarModo(m: ModoEnvio) {
    setModoEscolhido(m)
    await supabase.from('campaign_members').update({ chat_mode: m }).eq('campaign_id', campanha.id).eq('user_id', userId)
  }

  function enviarMensagem(html: string) {
    if (!userId || !eu) return Promise.resolve(false)
    const autor = autoria(modo, { nome: eu.nomeConta, foto: eu.fotoConta ?? null }, { nome: eu.personagem, foto: eu.fotoPersonagem ?? null })
    // /r 1d20+5 (digitado ou pela bandeja de dados): rola e vai pro chat como rolagem.
    const pedido = comandoDeRolagem(textoPuro(html))
    if (pedido === 'invalida') return Promise.resolve(false)
    if (pedido) {
      const rolagem = rolarFormula(pedido.formula, pedido.rotulo)
      return rolagem ? chat.enviarRolagem({ userId, modo, autor, rolagem }) : Promise.resolve(false)
    }
    return chat.enviar({ userId, modo, autor, personagemId: modo === 'publico_usuario' ? null : eu.personagemId ?? null, html })
  }

  function enviarImagem(arquivo: File) {
    return userId ? enviarImagemDoChat(userId, arquivo) : Promise.resolve(null)
  }

  // Clicar na cena só abre ela pra quem clicou; quem muda a cena de todo mundo é o
  // "Ativar Cena" do botão direito (mestre).
  function abrirCena(c: Cena) {
    cenas.setVendo(c.id === cenas.ativa ? null : c.id)
  }

  async function criarCena(nome: string, pastaId: string | null) {
    const nova = await cenas.criarCena({ name: nome, folder_id: pastaId })
    if (nova) setEditandoCena(nova.id)
  }

  function avisar(texto: string | null, some = false) {
    setAvisoPalco(texto)
    if (some) setTimeout(() => setAvisoPalco((atual) => (atual === texto ? null : atual)), 3000)
  }

  // Imagem de outra aba: tenta guardar uma cópia nossa (não some se o site original tirar
  // do ar ou bloquear); se o site não deixar copiar, usa o endereço dele mesmo.
  async function guardarImagem(origem: File | string): Promise<string | null> {
    if (!userId) return null
    if (typeof origem !== 'string') return enviarImagemDaCena(userId, origem)
    try {
      const resposta = await fetch(origem)
      const blob = await resposta.blob()
      if (resposta.ok && blob.type.startsWith('image/')) {
        const nome = origem.split(/[?#]/)[0].split('/').pop() || 'imagem'
        const copia = await enviarImagemDaCena(userId, new File([blob], nome, { type: blob.type }))
        if (copia) return copia
      }
    } catch {
      // site não deixa baixar: fica o endereço original
    }
    return origem
  }

  function tamanhoDaImagem(url: string): Promise<{ w: number; h: number }> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve({ w: 0, h: 0 })
      img.src = url
    })
  }

  // Imagem muito grande (a planta do manicômio) entrava gigante: limita a 40% do mapa, centrada onde
  // soltou, sem perder qualidade (a imagem é a mesma; só a caixa começa menor). Pedido 14/10.
  async function caixaLimitada(ponto: { x: number; y: number }, w: number, h: number) {
    const atual = cenas.atual
    const mapa = atual?.background_url ? await tamanhoDaImagem(atual.background_url) : { w: 0, h: 0 }
    const t = mapa.w && mapa.h ? tamanhoInicial(w, h, mapa.w, mapa.h) : { width: w, height: h }
    return caixaNoPonto(ponto, t.width, t.height)
  }

  // Imagem arrastada pra mesa (12.2): sem cena, vira uma cena nova; cena sem fundo, vira o
  // fundo; cena com fundo, entra por cima do mapa onde foi solta.
  async function soltarImagem(origem: File | string, ponto: { x: number; y: number }, mapa: { w: number; h: number }) {
    if (!origem) {
      avisar('Isso não é uma imagem. Arraste o arquivo da imagem, ou a própria imagem de outra aba.', true)
      return
    }
    avisar('Enviando imagem…')
    const url = await guardarImagem(origem)
    if (!url) {
      avisar('Não deu pra enviar a imagem.', true)
      return
    }
    const atual = cenas.atual
    if (!atual) {
      const nova = await cenas.criarCena({ name: `Cena (${cenas.cenas.length + 1})`, background_url: url })
      if (nova) await cenas.ativar(nova.id)
    } else if (!atual.background_url) {
      await cenas.salvarCena(atual.id, { background_url: url })
    } else {
      const nat = await tamanhoDaImagem(url)
      const t = tamanhoInicial(nat.w, nat.h, mapa.w, mapa.h)
      const nome = typeof origem === 'string' ? null : origem.name.replace(/.[^.]+$/, '')
      await objetos.criar({
        scene_id: atual.id,
        campaign_id: campanha.id,
        name: nome,
        image_url: url,
        x: Math.round(ponto.x - t.width / 2),
        y: Math.round(ponto.y - t.height / 2),
        width: t.width,
        height: t.height,
        layer: 'mapa',
      })
    }
    avisar(null)
  }

  // ---- Itens na mesa (KAN-53) ----

  // Item arrastado da aba Itens: entra no tamanho da imagem dele (sem imagem, um quadrado da grade).
  async function colocarItem(itemId: string, ponto: { x: number; y: number }) {
    const i = itens.itens.find((x) => x.id === itemId)
    const atual = cenas.atual
    if (!i || !atual) return
    const url = i.image_url ?? IMAGEM_ITEM_SEM_FOTO
    const nat = i.image_url ? await tamanhoDaImagem(i.image_url) : { w: 0, h: 0 }
    await objetos.criar({
      scene_id: atual.id, campaign_id: campanha.id, name: i.name, image_url: url, item_id: i.id, layer: 'mapa',
      ...(await caixaLimitada(ponto, nat.w || atual.grid_size, nat.h || atual.grid_size)),
    })
  }

  // ---- Posicionáveis (12.6) ----

  // Arrastou da aba pra mesa: entra uma cópia onde soltou.
  async function colocarPosicionavel(id: string, ponto: { x: number; y: number }) {
    const p = posicionaveis.itens.find((x) => x.id === id)
    const atual = cenas.atual
    if (!p || !atual || !userId) return
    const base = { scene_id: atual.id, campaign_id: campanha.id }
    if (p.categoria === 'nota') {
      setNotaAberta(p)
      return
    }
    if (p.categoria === 'desenho' && p.dados.desenho) {
      const d = p.dados.desenho
      await desenhos.criar({ ...base, ...d, ...caixaNoPonto(ponto, d.width, d.height), author_id: userId, posicionavel_id: p.id })
      return
    }
    // Luz Ambiente sem imagem: entra a lâmpada (só o mestre vê) com a luz configurada.
    // Efeito sem imagem (fogo, água…): entra a chama (só o mestre vê) com o efeito; com luz, se tiver.
    if (p.categoria === 'luz' && !p.url) {
      const soEfeito = !!p.dados.efeito && !p.dados.luz
      await objetos.criar({
        ...base, name: p.name, image_url: soEfeito ? IMAGEM_EFEITO : IMAGEM_LUZ, ...caixaNoPonto(ponto, atual.grid_size, atual.grid_size),
        layer: 'mapa', luz: !soEfeito, ...(soEfeito ? {} : { luz_ajuste: p.dados.luz ?? { ...LUZ_PADRAO, raio: 4 } }),
        ...(p.dados.efeito ? { efeito: p.dados.efeito } : {}),
      })
      return
    }
    if (!p.url) return
    if (p.categoria === 'desenho' && !ehImagem(p.url)) {
      window.open(p.url, '_blank', 'noopener')
      return
    }
    if (p.categoria === 'som') {
      const lado = atual.grid_size * 3
      const erro = await sons.criar({
        ...base, name: p.name, url: p.url, ...caixaNoPonto(ponto, p.dados.largura ?? lado, p.dados.altura ?? lado),
        volume: p.dados.volume ?? 1, suavizar: p.dados.suavizar ?? true, escondido: false, ligado: true, posicionavel_id: p.id,
      })
      if (erro) avisar(erro, true)
      return
    }
    // Token, Objeto, Luz e desenho em imagem: entra no tamanho original da imagem, sem mexer
    // (pedido da Millie).
    const nat = await tamanhoDaImagem(p.url)
    const largura = nat.w || atual.grid_size
    const altura = nat.h || atual.grid_size
    await objetos.criar({
      ...base, name: p.name, image_url: p.url, ...(await caixaLimitada(ponto, largura, altura)),
      layer: p.categoria === 'token' ? 'token' : 'mapa', luz: p.categoria === 'luz',
      ...(p.categoria === 'luz' && p.dados.luz ? { luz_ajuste: p.dados.luz } : {}),
      ...(p.categoria === 'luz' && p.dados.efeito ? { efeito: p.dados.efeito } : {}),
    })
  }

  // Token arrastado da Biblioteca direto pra mesa: entra como token, no tamanho da imagem.
  async function colocarDaBiblioteca(t: { url: string; nome: string }, ponto: { x: number; y: number }) {
    const atual = cenas.atual
    if (!atual) return
    const nat = await tamanhoDaImagem(t.url)
    await objetos.criar({
      scene_id: atual.id, campaign_id: campanha.id, name: t.nome, image_url: t.url, layer: 'token',
      ...(await caixaLimitada(ponto, nat.w || atual.grid_size, nat.h || atual.grid_size)),
    })
  }

  // Arrastou da mesa pra aba: guarda uma cópia (e mostra a aba onde ficou).
  async function guardarPosicionaveis(itens: Pick<Posicionavel, 'categoria' | 'name' | 'url' | 'dados'>[]) {
    if (!itens.length) return
    for (const i of itens) await posicionaveis.criar(i)
    const cat = itens[itens.length - 1].categoria
    setCategoriaPosicionavel(cat)
    avisar(`Guardado em ${CATEGORIAS_POSICIONAVEIS.find((c) => c.id === cat)?.rotulo}.`, true)
  }

  // ---- Personagens (12.7) ----

  function nivelNoAtor(a: Ator): NivelAcesso {
    if (souMestre) return 'dono'
    const ficha = a.character_id ? atores.fichas[a.character_id] : undefined
    if (a.tipo === 'jogador') return ficha ? nivelNaFichaDoJogador(ficha.user_id === userId, ficha) : 'limitado'
    return nivelDoJogador(a, userId ?? '')
  }

  function abrirFicha(atorId: string) {
    setFichasAbertas((l) => (l.includes(atorId) ? l : [...l, atorId]))
  }

  // O token entra com o formato da imagem: largura de um quadrado da grade, altura proporcional.
  async function colocarAtor(atorId: string, ponto: { x: number; y: number }) {
    if (!cenas.atual) return
    const a = atores.atores.find((x) => x.id === atorId)
    // Ficha só entra com o token configurado; a foto redonda da ficha não é token (08/10).
    const url = a && imagemDoToken(a, (a.creature_id && atores.criaturas[a.creature_id]?.image_url) || null)
    const largura = cenas.atual.grid_size
    const nat = url ? await tamanhoDaImagem(url) : { w: 0, h: 0 }
    const altura = nat.w > 0 ? Math.round((largura * nat.h) / nat.w) : largura
    const erro = await colocarToken(atorId, cenas.atual.id, ponto.x, ponto.y, largura, altura)
    if (erro) avisar(erro, true)
  }

  async function criarNPC(nome: string, pasta: string | null) {
    setCriandoAtor(null)
    if (!userId) return
    const novo = await atores.criarNPC(userId, nome, pasta)
    if (novo) abrirFicha(novo.id)
  }

  // ---- Combate (12.4) ----

  const meusPersonagensIds = eu?.personagemId ? [eu.personagemId] : []

  // Clicar em alguém do combate abre a ficha do personagem dele (a mesma da aba Personagens).
  function abrirCombatente(c: Combatente) {
    const a = c.actor_id ? atores.atores.find((x) => x.id === c.actor_id) : atores.atores.find((x) => x.character_id === c.character_id)
    if (a) abrirFicha(a.id)
  }

  // Vida da ameaça = a do personagem dela (começa no máximo do bestiário).
  function vidaDoCombatente(c: Combatente): [number, number | null] | null {
    const a = c.actor_id ? atores.atores.find((x) => x.id === c.actor_id) : undefined
    if (!a?.creature_id) return null
    const max = atores.criaturas[a.creature_id]?.pv_maximo ?? null
    return [a.pv_atual ?? max ?? 0, max]
  }

  function vdDoCombate(c: Combate) {
    const doBestiario = c.ameacas.reduce((s, id) => s + (vdDe[id] ?? 0), 0)
    const daMesa = c.atores.reduce((s, id) => {
      const a = atores.atores.find((x) => x.id === id)
      return s + ((a?.creature_id && atores.criaturas[a.creature_id]?.vd) || 0)
    }, 0)
    return doBestiario + daMesa
  }

  const atoresParaCombate: AtorDoCombate[] = atores.atores
    .filter((a): a is typeof a & { tipo: 'npc' | 'ameaca' } => a.tipo !== 'jogador')
    .map((a) => ({ id: a.id, name: a.name, tipo: a.tipo, token_url: a.token_url, creature_id: a.creature_id }))

  function rolarNoChat(rolagem: Parameters<typeof chat.enviarRolagem>[0]['rolagem'], autor: { nome: string; foto: string | null }) {
    if (userId) chat.enviarRolagem({ userId, modo, autor, rolagem })
  }

  // Ação/poder de uma ameaça mostrado no chat, com o nome e a foto dela.
  function mostrarNoChat(html: string, autor: { nome: string; foto: string | null }) {
    if (userId) chat.enviar({ userId, modo, autor, personagemId: null, html })
  }

  // Ameaça atacando os alvos marcados (mestre).
  function atacarComAmeaca(ataque: AtaqueDaAcao, autor: { nome: string; foto: string | null }, atorId?: string) {
    postarAtaque({ campanhaId: campanha.id, characterId: null, autor, ataque, alvos: alvosComNome, atorId }).then((e) => e && avisar(e, true))
  }

  // Contra-atacar (12.9): quem errou vira o alvo de quem contra-ataca; a ficha dele abre pra atacar (13/10).
  function contraAtacar(acao: AcaoAtaque, tokenId: string): string | null {
    const o = objetos.objetos.find((x) => {
      if (acao.origem?.actor_id && x.actor_id === acao.origem.actor_id) return true
      if (!acao.origem?.character_id) return false
      if (x.character_id === acao.origem.character_id) return true
      const a = x.actor_id ? atores.atores.find((y) => y.id === x.actor_id) : undefined
      return a?.character_id === acao.origem.character_id
    })
    if (!o) return `O token de ${acao.atacante} não está nesta cena — marque ele com M e ataque pela ficha.`
    mira.setMeus([o.id])
    const meu = objetos.objetos.find((x) => x.id === tokenId)
    const ator = meu && (meu.actor_id ? atores.atores.find((y) => y.id === meu.actor_id) : atores.atores.find((y) => y.character_id === meu.character_id))
    if (ator) abrirFicha(ator.id)
    avisar(`Contra-ataque: ${acao.atacante} é o seu alvo. Escolha o ataque na aba Combate da sua ficha.`, true)
    return null
  }

  // Bloquear (12.9): quem pode mexer na ficha do alvo.
  function controlaAlvo(tokenId: string) {
    const o = objetos.objetos.find((x) => x.id === tokenId)
    if (!o) return false
    const a = o.actor_id ? atores.atores.find((x) => x.id === o.actor_id) : undefined
    if (a) return !!a.character_id && nivelNoAtor(a) === 'dono'
    return !!o.character_id && (souMestre || meusPersonagensIds.includes(o.character_id))
  }

  // Homebrew (KAN-50): criar do zero, duplicar do bestiário ou editar uma do mestre.
  async function editarAmeaca(origem: { criar: true } | { id: string; duplicar: boolean }, depois?: (id: string) => void) {
    const inicial = 'criar' in origem ? criaturaVazia() : await carregarParaEditar(origem.id, origem.duplicar)
    if (inicial) setEditorAmeaca({ inicial, depois })
  }

  // Ameaça Homebrew criada pelo Criar Personagem já vira personagem na aba.
  function criarHomebrewNaAba(pasta: string | null) {
    setCriandoAtor(null)
    editarAmeaca({ criar: true }, async (id) => {
      const { data } = await supabase.from('creatures').select('id, name, vd, image_url, tipo_criatura, tamanho, pv_maximo').eq('id', id).single()
      if (!data) return
      const novo = await atores.criarAmeaca(data, pasta)
      if (novo) abrirFicha(novo.id)
    })
  }

  const cenaEditada = cenas.cenas.find((c) => c.id === editandoCena)
  const jogadoresParaCena = membros
    .filter((m) => m.papel === 'jogador')
    .map((m) => ({ userId: m.userId, rotulo: m.personagem ? `${m.personagem} (${m.nomeConta})` : m.nomeConta }))

  function escolherAba(a: AbaDireita) {
    // Clicar na aba aberta recolhe o painel, como o Foundry faz.
    if (a === aba && !recolhida) setRecolhida(true)
    else {
      setAba(a)
      setRecolhida(false)
    }
  }

  return (
    <QuemVeContexto.Provider value={{ userId: userId ?? '', souMestre, controlaAlvo, contraAtacar }}>
    <ImagensMostradas campanhaId={campanha.id} nome={eu?.personagem || eu?.nomeConta || 'Alguém'}>
    <main className="mesa" style={campanha.accent_color ? ({ '--mesa-destaque': campanha.accent_color } as React.CSSProperties) : undefined}>
      <PalcoCena
        cena={cenas.atual}
        souMestre={souMestre}
        userId={userId ?? ''}
        nomeUsuario={eu?.personagem || eu?.nomeConta || 'Alguém'}
        meusPersonagens={eu?.personagemId ? [eu.personagemId] : []}
        jogadores={jogadoresParaCena}
        obj={objetos}
        aviso={avisoPalco}
        pings={pings}
        focoPing={focoPing}
        onSoltarImagem={soltarImagem}
        onColocarAtor={colocarAtor}
        onColocarPosicionavel={colocarPosicionavel}
        onColocarDaBiblioteca={colocarDaBiblioteca}
        onGuardarPosicionaveis={guardarPosicionaveis}
        onAbrirFicha={abrirFicha}
        variacoesDe={(id) => {
          const a = atores.atores.find((x) => x.id === id)
          return a ? variacoesDoToken(a) : []
        }}
        onAbrirVariacoes={setTokenDasVariacoes}
        ferramenta={ferramenta}
        meusAlvos={alvosComNome.map((a) => a.token_id)}
        outrosAlvos={mira.outros}
        onAlternarAlvo={mira.alternar}
        onLimparAlvos={mira.limpar}
        des={desenhos}
        sons={sons}
        pedidoPaletaSom={pedidoPaletaSom}
        pedidoLimparSom={pedidoLimparSom}
        pedidoLimparEscuridao={pedidoLimparEscuridao}
        onInteragir={(o, celula, coletar) => setInteragindo({ tokenId: o.id, celula, coletar })}
        onCriarItemDoObjeto={setItemDoObjeto}
        onColocarItem={colocarItem}
        itensDaCampanha={itens.itens}
        onEditarItem={(id) => setItensAbertos((l) => (l.includes(id) ? l : [...l, id]))}
        podeEditarItem={(id) => {
          const i = itens.itens.find((x) => x.id === id)
          return !!i && nivelNoItem(i, userId ?? '', souMestre) === 'dono'
        }}
        podePingar={podeJogador(campanha.permissoes, 'pingar', souMestre)}
        ehMeuToken={(o) => {
          if (o.character_id && o.character_id === eu?.personagemId) return true
          const a = o.actor_id ? atores.atores.find((x) => x.id === o.actor_id) : undefined
          return !!a && nivelNoAtor(a) === 'dono'
        }}
        pedidoPaleta={pedidoPaleta}
        pedidoLimpar={pedidoLimpar}
        combates={combate.combates}
        entraEmCombate={(id) => atoresParaCombate.some((a) => a.id === id)}
        onAdicionarAoCombate={(combateId, atorId) => {
          const c = combate.combates.find((x) => x.id === combateId)
          if (c) combate.adicionarAtor(c, atorId)
        }}
      />

      {/* Tom da cena pela hora (Tempo e Calendário). */}
      {tom && tom.opacidade > 0 && <div className="mesa-tom-hora" style={{ background: tom.cor, opacity: tom.opacidade }} aria-hidden />}

      {/* Tempo e Calendário: o mestre sempre vê; os jogadores, se ele deixar. */}
      {tempoLigado && userId && (souMestre || tempo.jogadoresVeem) && (
        <Calendario
          tempo={tempo}
          souMestre={souMestre}
          corDaMesa={campanha.accent_color || '#3a3a40'}
          userId={userId}
          notas={notasCalendario}
          onMudar={(t) => salvarTempo(t)}
          onConfigurar={() => abrirConfig('tempo')}
        />
      )}

      {/* Dados 3D caindo na tela a cada rolagem nova do chat, pra todo mundo. */}
      <DadosNaTela mensagens={chat.mensagens} estilos={estilosDados} />

      {destaque && destaque.id !== destaqueFechado && (
        <div className="mesa-destaque" role="status">
          <ChatMensagem
            mensagem={destaque}
            souMestre={souMestre}
            nomeMestre={mestre?.nomeConta ?? 'Mestre'}
            agora={new Date()}
            onDestacar={() => chat.alterar(destaque.id, { destacada: false })}
            onRevelar={() => chat.alterar(destaque.id, { revelada: true })}
            onExcluir={() => chat.excluir(destaque.id)}
          />
          <button type="button" className="mesa-destaque-fechar" aria-label="Fechar destaque" onClick={() => setDestaqueFechado(destaque.id)}>×</button>
        </div>
      )}

      <nav className="mesa-controles" aria-label="Ferramentas de cena">
        <div className="mesa-coluna">
          <BarraIcones lado="esquerda" itens={souMestre ? CATEGORIAS_ESQUERDA : CATEGORIAS_ESQUERDA.filter((c) => c.id !== 'som' && c.id !== 'escuridao')} ativo={categoria} onEscolher={(c) => { setCategoria(c); const primeira = FERRAMENTAS[c][0]; if (primeira) setFerramenta(primeira.id) }} />
        </div>
        <div className="mesa-coluna">
          {FERRAMENTAS[categoria].filter((f) => f.id !== 'medir' || podeJogador(campanha.permissoes, 'medir', souMestre)).map((f) => (
            <BotaoIcone
              key={f.id}
              id={f.id}
              rotulo={f.rotulo}
              lado="esquerda"
              ajuda={AJUDA_FERRAMENTA[f.id]}
              perigo={f.id === 'limpar-desenhos' || f.id === 'som-limpar' || f.id === 'escuridao-limpar'}
              ativo={ferramenta === f.id}
              onClick={() => {
                if (f.id === 'paleta') setPedidoPaleta((n) => n + 1)
                else if (f.id === 'som-paleta') setPedidoPaletaSom((n) => n + 1)
                else if (f.id === 'som-limpar') setPedidoLimparSom((n) => n + 1)
                else if (f.id === 'escuridao-limpar') setPedidoLimparEscuridao((n) => n + 1)
                else if (f.id === 'limpar-desenhos') setPedidoLimpar((n) => n + 1)
                else if (!ACOES_ESQUERDA.includes(f.id)) setFerramenta(f.id)
              }}
            />
          ))}
        </div>
      </nav>

      <div className={`mesa-lateral${recolhida ? ' recolhida' : ''}`}>
        <nav className="mesa-barra" aria-label="Abas da mesa">
          <BarraIcones lado="direita" itens={ABAS_DIREITA.filter((a) => a.id !== 'config')} ativo={recolhida ? null : aba} piscando={chatPiscando ? ['chat'] : []} onEscolher={escolherAba} />
          {/* Celular antes de Configurações e Recolher (pedido da Millie, 14/10). */}
          <BotaoIcone id="celular" rotulo={souMestre ? 'Central dos celulares' : 'Celular'} lado="direita" ativo={celularAberto} onClick={() => setCelularAberto((v) => !v)} />
          {souMestre && <BotaoIcone id="sustos" rotulo="Central dos sustos" lado="direita" ativo={centralSustos} onClick={() => setCentralSustos((v) => !v)} />}
          <BarraIcones lado="direita" itens={ABAS_DIREITA.filter((a) => a.id === 'config')} ativo={recolhida ? null : aba} onEscolher={escolherAba} />
          <BotaoIcone id="recolher" rotulo={recolhida ? 'Expandir' : 'Recolher'} lado="direita" onClick={() => setRecolhida((v) => !v)} />
          {!chatAberto && <ModosEnvio vertical modo={modo} onMudar={mudarModo} />}
        </nav>

        {notificacoes.length > 0 && (
          <div className="mesa-notificacoes" aria-live="polite">
            {notificacoes.map((m) => (
              <button
                key={m.id}
                type="button"
                className="chat-msg mesa-notificacao"
                title="Abrir o chat"
                onClick={() => { setAba('chat'); setRecolhida(false) }}
              >
                <span className="chat-msg-foto">{m.autor_foto ? <img src={m.autor_foto} alt="" /> : null}</span>
                <span className="mesa-notificacao-texto">
                  <strong>{m.autor_nome}</strong>
                  <span>{resumoDaMensagem(m)}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {!chatAberto && (
          <div className="mesa-chat-flutuante">
            <ChatEntrada compacto onEnviar={enviarMensagem} onImagem={enviarImagem} />
          </div>
        )}

        {!recolhida && abaAtual && (
          <aside className="mesa-painel" aria-label={abaAtual.rotulo}>
            {aba === 'chat' ? (
              <PainelChat
                mensagens={chat.mensagens}
                souMestre={souMestre}
                nomeMestre={mestre?.nomeConta ?? 'Mestre'}
                nomeCampanha={campanha.name}
                modo={modo}
                onMudarModo={mudarModo}
                onEnviar={enviarMensagem}
                onImagem={enviarImagem}
                onAlterar={chat.alterar}
                onExcluir={chat.excluir}
                onLimpar={chat.limpar}
              />
            ) : aba === 'cenas' ? (
              <PainelCenas
                souMestre={souMestre}
                cenas={cenas.cenas}
                pastas={cenas.pastas}
                ativa={cenas.ativa}
                vendo={cenas.vendo}
                onAbrir={abrirCena}
                onEditar={(c) => setEditandoCena(c.id)}
                onAtivar={(c) => cenas.ativar(c.id)}
                onTrazerTodos={(c) => cenas.ativar(c.id)}
                onExcluir={(c) => cenas.excluirCena(c.id)}
                onDuplicar={cenas.duplicarCena}
                onCriarCena={criarCena}
                onCriarPasta={cenas.criarPasta}
                onSalvarPasta={cenas.salvarPasta}
                onMoverCena={(c, pastaId) => cenas.salvarCena(c.id, { folder_id: pastaId })}
                onExcluirPasta={(p, comCenas) => cenas.excluirPasta(p.id, comCenas)}
                jogadores={jogadoresParaCena}
                onVisibilidade={(c, v) => cenas.salvarCena(c.id, v)}
              />
            ) : aba === 'combate' ? (
              <PainelCombate
                souMestre={souMestre}
                combates={combate.combates}
                vdDoCombate={vdDoCombate}
                ativo={combate.ativo}
                ordem={combate.ordem}
                vidaDe={vidaDoCombatente}
                barras={(c) => (combateDa(campanha.configuracoes).vidaNoCarrossel ? combate.barras(c) : null)}
                meusPersonagens={meusPersonagensIds}
                onCriar={() => setMontandoCombate({})}
                onEditar={(c) => setMontandoCombate({ editando: c })}
                onExcluir={(c) => combate.excluir(c.id)}
                onIniciar={(c) => combate.iniciar(c)}
                onEncerrar={(c) => combate.encerrar(c)}
                onAdicionar={(c) => setMontandoCombate({ adicionarEm: c })}
                onPassar={(c, voltar) => combate.passar(c, voltar)}
                onRemover={(c, id) => combate.remover(c, id)}
                onAbrir={abrirCombatente}
                onSoltarAtor={(c, id) => combate.adicionarAtor(c, id)}
                condicoesDe={(c) => {
                  const a = c.actor_id ? atores.atores.find((x) => x.id === c.actor_id) : undefined
                  return a?.creature_id ? { condicoes: a.condicoes ?? [], personalizadas: a.condicoes_personalizadas } : null
                }}
                onMudarCondicoes={(c, condicoes, condicoes_personalizadas) => c.actor_id && atores.salvar(c.actor_id, { condicoes, condicoes_personalizadas })}
              />
            ) : aba === 'personagens' ? (
              <PainelPersonagens
                souMestre={souMestre}
                userId={userId ?? ''}
                atores={atores.atores}
                pastas={atores.pastas}
                fichas={atores.fichas}
                criaturas={atores.criaturas}
                acoes={{
                  onAbrir: (a) => abrirFicha(a.id),
                  onPropriedade: (a) => setPropriedadeAtor(a.id),
                  onToken: (a) => setTokenAtor(a.id),
                  onExcluir: (a) => setExcluindoAtor(a.id),
                  onDuplicar: (a) => userId && atores.duplicar(a, userId),
                  onCriar: (pasta) => setCriandoAtor({ pasta }),
                  onCriarPasta: (pai) => setPastaAtor({ pai }),
                  onEditarPasta: (p) => setPastaAtor({ pai: p.parent_id, editando: p }),
                  onExcluirPasta: (p) => window.confirm(`Remover a pasta "${p.name}"? Os personagens dela ficam soltos.`) && atores.excluirPasta(p.id),
                }}
              />
            ) : aba === 'itens' ? (
              <PainelItens
                souMestre={souMestre}
                userId={userId ?? ''}
                itens={itens.itens}
                pastas={itens.pastas}
                acoes={{
                  onAbrir: (i) => setItensAbertos((l) => (l.includes(i.id) ? l : [...l, i.id])),
                  onPropriedade: (i) => setPropriedadeItem(i.id),
                  onDuplicar: (i) => itens.duplicar(i),
                  onExcluir: (i) => window.confirm(`Excluir o item "${i.name}"?`) && itens.excluir(i.id),
                  onCriar: (pasta) => setCriandoItem({ pasta }),
                  onCriarPasta: (pai) => setPastaItem({ pai }),
                  onEditarPasta: (p) => setPastaItem({ pai: p.parent_id, editando: p }),
                  onExcluirPasta: (p) => window.confirm(`Remover a pasta "${p.name}"? Os itens dela ficam soltos.`) && itens.excluirPasta(p.id),
                }}
              />
            ) : aba === 'posicionaveis' ? (
              <PainelPosicionaveis
                souMestre={souMestre}
                userId={userId ?? ''}
                api={posicionaveis}
                categoria={categoriaPosicionavel}
                onCategoria={setCategoriaPosicionavel}
                onAbrirNota={setNotaAberta}
                avisar={(t, erro) => avisar(t, erro)}
              />
            ) : aba === 'diario' ? (
              <PainelDiario
                souMestre={souMestre}
                userId={userId ?? ''}
                podeCriar={podeJogador(campanha.permissoes, 'criarDiario', souMestre)}
                entradas={diario.entradas}
                pastas={diario.pastas}
                acoes={{
                  onAbrir: (e) => setDiariosAbertos((l) => (l.includes(e.id) ? l : [...l, e.id])),
                  onPropriedade: (e) => setPropriedadeDiario(e.id),
                  onDuplicar: (e) => userId && diario.duplicar(e, userId),
                  onExcluir: (e) => window.confirm(`Excluir o registro "${e.name}"?`) && diario.excluir(e.id),
                  onExportar: (e) => {
                    const blob = new Blob([exportarDiario(e)], { type: 'application/json' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `${e.name.replace(/[^\w\- ]+/g, '_') || 'diario'}.json`
                    a.click()
                    URL.revokeObjectURL(a.href)
                  },
                  onImportar: async (e, arquivo) => {
                    const dados = importarDiario(await arquivo.text())
                    if (!dados) return avisar('Esse arquivo não é um registro de diário.', true)
                    if (!window.confirm(`Trocar as páginas de "${e.name}" pelas do arquivo (${dados.paginas.length})?`)) return
                    diario.salvar(e.id, { paginas: dados.paginas })
                  },
                  onCriar: (pasta) => setCriandoEntrada({ pasta }),
                  onCriarPasta: (pai) => setPastaDiario({ pai }),
                  onEditarPasta: (p) => setPastaDiario({ pai: p.parent_id, editando: p }),
                  onExcluirPasta: (p) => window.confirm(`Remover a pasta "${p.name}"? Os registros dela ficam soltos.`) && diario.excluirPasta(p.id),
                }}
              />
            ) : aba === 'playlist' ? (
              <PainelPlaylist souMestre={souMestre} userId={userId ?? ''} pl={playlists} />
            ) : aba === 'config' ? (
              <PainelConfig
                souMestre={souMestre}
                sistema={sistemaDe(campanha.system).nome}
                copiado={copiado}
                onCopiarConvite={copiarConvite}
                onAbrir={abrirConfig}
                onSair={async () => {
                  await supabase.auth.signOut()
                  navigate('/')
                }}
                onVoltar={() => navigate('/jogar')}
              />
            ) : (
              <p className="mesa-painel-vazio">{abaAtual.rotulo}: em construção ({abaAtual.card}).</p>
            )}
          </aside>
        )}
      </div>

      {souMestre && notaAberta && (
        <JanelaNota
          key={'id' in notaAberta ? notaAberta.id : 'nova'}
          nota={'id' in notaAberta ? notaAberta : null}
          onSalvar={({ name, texto }) => {
            if ('id' in notaAberta) posicionaveis.salvar(notaAberta.id, { name, dados: { ...notaAberta.dados, texto } })
            else posicionaveis.criar({ categoria: 'nota', name, url: null, dados: { texto }, folder_id: notaAberta.pasta })
            setNotaAberta(null)
          }}
          onFechar={() => setNotaAberta(null)}
        />
      )}

      {souMestre && cenaEditada && (
        <EditorCena
          key={cenaEditada.id}
          cena={cenaEditada}
          jogadores={jogadoresParaCena}
          onSalvar={(campos) => cenas.salvarCena(cenaEditada.id, campos)}
          onImagem={(arquivo) => (userId ? enviarImagemDaCena(userId, arquivo) : Promise.resolve(null))}
          onFechar={() => setEditandoCena(null)}
        />
      )}

      {combate.ativo && (
        <IndicadorTurno
          ativo={combate.ativo}
          ordem={combate.ordem}
          barras={(c) => (combateDa(campanha.configuracoes).vidaNoCarrossel ? combate.barras(c) : null)}
          meusPersonagens={meusPersonagensIds}
          souMestre={souMestre}
          onPassar={() => combate.ativo && combate.passar(combate.ativo)}
        />
      )}

      {montandoCombate && (
        <CriarCombate
          inicial={montandoCombate.editando ?? montandoCombate.adicionarEm}
          modo={montandoCombate.adicionarEm ? 'adicionar' : 'criar'}
          atores={atoresParaCombate}
          meuId={userId ?? ''}
          onEditarAmeaca={editarAmeaca}
          onSalvar={(nome, ameacas, escolhidos) => {
            if (montandoCombate.adicionarEm) combate.entrarAmeacas(montandoCombate.adicionarEm, ameacas, escolhidos)
            else if (montandoCombate.editando) combate.salvar(montandoCombate.editando, { name: nome, ameacas, atores: escolhidos })
            else combate.criar(nome, ameacas, escolhidos)
            setMontandoCombate(null)
          }}
          onFechar={() => setMontandoCombate(null)}
        />
      )}

      {criandoAtor && (
        <CriarPersonagem
          pastas={atores.pastas}
          pastaInicial={criandoAtor.pasta}
          onCriarNPC={criarNPC}
          onCriarHomebrew={criarHomebrewNaAba}
          onCriarAmeaca={async (c, pasta) => { setCriandoAtor(null); const novo = await atores.criarAmeaca(c, pasta); if (novo) abrirFicha(novo.id) }}
          onFechar={() => setCriandoAtor(null)}
        />
      )}

      {(() => {
        const t = interagindo && objetos.objetos.find((o) => o.id === interagindo.tokenId)
        if (!interagindo || !t || !cenas.atual) return null
        // Quem interage: o token do personagem do jogador mais perto do item (o mestre não precisa).
        const meus = objetos.objetos.filter((o) => o.character_id && o.character_id === eu?.personagemId)
        const centro = (o: { x: number; y: number; width: number; height: number }) => [o.x + o.width / 2, o.y + o.height / 2]
        const [ix, iy] = centro(t)
        const meuToken = meus.sort((a, b) => Math.hypot(centro(a)[0] - ix, centro(a)[1] - iy) - Math.hypot(centro(b)[0] - ix, centro(b)[1] - iy))[0] ?? null
        return (
          <JanelaInteracao
            key={t.id}
            token={t}
            objetos={objetos.objetos}
            meuToken={meuToken}
            characterId={souMestre ? null : eu?.personagemId ?? null}
            souMestre={souMestre}
            sistemaId={campanha.system}
            celula={interagindo.celula}
            metrosPorQuadrado={cenas.atual.grid_distance || 1.5}
            meusAlvos={alvosComNome.map((a) => a.token_id)}
            coletarAoAbrir={!!interagindo.coletar}
            onFechar={() => setInteragindo(null)}
          />
        )
      })()}

      {itemDoObjeto && (
        <CriarItemDoObjeto
          nomeInicial={itemDoObjeto.name?.trim() || 'Documento'}
          imagem={itemDoObjeto.image_url}
          onCriar={async (nome, categoria, extra) => {
            const o = itemDoObjeto
            setItemDoObjeto(null)
            const novo = await itens.criar(nome, categoria, null, extra)
            if (!novo) {
              avisar('Não deu pra criar o item.', true)
              return
            }
            // O objeto do mapa passa a ser o item (dá pra coletar), e a ficha abre pra completar.
            await objetos.alterarVarios({ [o.id]: { item_id: novo.id, name: nome } })
            setItensAbertos((l) => [...l, novo.id])
          }}
          onFechar={() => setItemDoObjeto(null)}
        />
      )}

      {criandoItem && (
        <CriarItem
          sistemaId={campanha.system}
          onCriar={async (nome, categoria, extra) => {
            const pasta = criandoItem.pasta
            setCriandoItem(null)
            const novo = await itens.criar(nome, categoria, pasta, extra)
            if (novo) setItensAbertos((l) => [...l, novo.id])
          }}
          onFechar={() => setCriandoItem(null)}
        />
      )}

      {pastaItem && (
        <CriarPasta
          inicial={pastaItem.editando}
          onCriar={(campos) => {
            if (pastaItem.editando) itens.salvarPasta(pastaItem.editando.id, campos)
            else itens.criarPasta({ ...campos, parent_id: pastaItem.pai })
            setPastaItem(null)
          }}
          onFechar={() => setPastaItem(null)}
        />
      )}

      {janelasConfig.map((j) => {
        const fechar = () => fecharConfig(j)
        if (j === 'jogo') return <ConfiguracoesDoJogo key={j} souMestre={souMestre} onAbrir={abrirConfig} onFechar={fechar} />
        if (j === 'controles') return <JanelaControles key={j} souMestre={souMestre} onFechar={fechar} />
        if (j === 'interface') return <JanelaInterface key={j} onFechar={fechar} />
        if (j === 'som') return <JanelaSom key={j} onFechar={fechar} />
        if (j === 'dados') {
          return (
            <JanelaDados
              key={j}
              estiloAtual={userId ? estilosDados[userId] : null}
              onSalvarEstilo={async (e) => {
                if (!userId) return false
                const { error } = await supabase.from('profiles').update({ dados3d: e }).eq('id', userId)
                if (!error) setEstilosDados((m) => ({ ...m, [userId]: e }))
                return !error
              }}
              onFechar={fechar}
            />
          )
        }
        if (j === 'chat') {
          return (
            <JanelaChat
              key={j}
              nomeAtual={eu?.nomeConta ?? ''}
              onSalvar={async (nome) => {
                if (!userId) return false
                const { error } = await supabase.from('profiles').update({ display_name: nome }).eq('id', userId)
                if (!error) setEstado((e) => (e.tipo === 'pronta' ? { ...e, membros: e.membros.map((x) => (x.userId === userId ? { ...x, nomeConta: nome } : x)) } : e))
                return !error
              }}
              onFechar={fechar}
            />
          )
        }
        if (!souMestre) return null
        if (j === 'permissoes') return <JanelaPermissoes key={j} atuais={campanha.permissoes ?? {}} onSalvar={(p) => salvarCampanha({ permissoes: p })} onFechar={fechar} />
        if (j === 'fontes') {
          return (
            <JanelaFontes
              key={j}
              config={campanha.configuracoes ?? {}}
              onEnviarArquivo={async (f) => {
                if (!userId) return null
                const caminho = `${userId}/${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`
                const { error } = await supabase.storage.from('fontes').upload(caminho, f)
                return error ? null : supabase.storage.from('fontes').getPublicUrl(caminho).data.publicUrl
              }}
              onSalvar={(c) => salvarCampanha({ configuracoes: c })}
              onFechar={fechar}
            />
          )
        }
        if (j === 'tempo') return <ConfigurarTempo key={j} tempo={tempo} ativo={tempoLigado} onSalvar={(t) => salvarTempo(t)} onDesligar={() => salvarTempo(null)} onFechar={fechar} />
        if (j === 'combate') return <JanelaCombate key={j} config={campanha.configuracoes ?? {}} onSalvar={(c) => salvarCampanha({ configuracoes: c })} onFechar={fechar} />
        if (j === 'mundo') return <JanelaMundo key={j} nome={campanha.name} cor={campanha.accent_color} onSalvar={(c) => salvarCampanha(c)} onFechar={fechar} />
        if (j === 'usuarios') {
          return (
            <JanelaUsuarios
              key={j}
              membros={membros}
              onRemover={async (uid) => {
                const { error } = await supabase.from('campaign_members').delete().eq('campaign_id', campanha.id).eq('user_id', uid)
                if (error) return avisar('Não deu pra tirar da campanha.', true)
                setEstado((e) => (e.tipo === 'pronta' ? { ...e, membros: e.membros.filter((x) => x.userId !== uid) } : e))
              }}
              onFechar={fechar}
            />
          )
        }
        return null
      })}

      {criandoEntrada && (
        <CriarEntrada
          onCriar={async (nome) => {
            const nova = await diario.criar(nome, souMestre ? criandoEntrada.pasta : null)
            setCriandoEntrada(null)
            if (nova) setDiariosAbertos((l) => [...l, nova.id])
            else avisar('Não deu pra criar o registro.', true)
          }}
          onFechar={() => setCriandoEntrada(null)}
        />
      )}

      {pastaDiario && (
        <CriarPasta
          inicial={pastaDiario.editando}
          onCriar={(campos) => {
            if (pastaDiario.editando) diario.salvarPasta(pastaDiario.editando.id, campos)
            else diario.criarPasta({ ...campos, parent_id: pastaDiario.pai })
            setPastaDiario(null)
          }}
          onFechar={() => setPastaDiario(null)}
        />
      )}

      {diariosAbertos.map((id) => {
        const e = diario.entradas.find((x) => x.id === id)
        if (!e) return null
        return (
          <JanelaDiario
            key={id}
            entrada={e}
            podeEditar={nivelNoDiario(e, userId ?? '', souMestre) === 'dono'}
            onSalvar={(campos) => diario.salvar(id, campos).then((erro) => erro && avisar('Não deu pra salvar o diário.', true))}
            onEnviarArquivo={(f) => (userId ? enviarArquivoDoDiario(userId, f) : Promise.resolve(null))}
            onFechar={() => setDiariosAbertos((l) => l.filter((x) => x !== id))}
          />
        )
      })}

      {(() => {
        const e = diario.entradas.find((x) => x.id === propriedadeDiario)
        return e ? (
          <ConfigurarPropriedadeAtor
            ator={e}
            jogadores={jogadoresParaCena}
            onSalvar={(campos) => { diario.salvar(e.id, campos); setPropriedadeDiario(null) }}
            onFechar={() => setPropriedadeDiario(null)}
          />
        ) : null
      })()}

      {itensAbertos.map((id) => {
        const i = itens.itens.find((x) => x.id === id)
        if (!i) return null
        return (
          <FichaItem
            key={id}
            item={i}
            podeEditar={nivelNoItem(i, userId ?? '', souMestre) === 'dono'}
            userId={userId ?? ''}
            jogadores={jogadoresParaCena}
            sistemaId={campanha.system}
            outrosItens={itens.itens}
            onSalvar={(campos) => itens.salvar(id, campos)}
            onFechar={() => setItensAbertos((l) => l.filter((x) => x !== id))}
          />
        )
      })}

      {(() => {
        const i = itens.itens.find((x) => x.id === propriedadeItem)
        return i ? (
          <ConfigurarPropriedadeAtor
            ator={i}
            jogadores={jogadoresParaCena}
            onSalvar={(campos) => { itens.salvar(i.id, campos); setPropriedadeItem(null) }}
            onFechar={() => setPropriedadeItem(null)}
          />
        ) : null
      })()}

      {pastaAtor && (
        <CriarPasta
          inicial={pastaAtor.editando}
          onCriar={(campos) => {
            if (pastaAtor.editando) atores.salvarPasta(pastaAtor.editando.id, campos)
            else atores.criarPasta({ ...campos, parent_id: pastaAtor.pai })
            setPastaAtor(null)
          }}
          onFechar={() => setPastaAtor(null)}
        />
      )}

      {(() => {
        const a = atores.atores.find((x) => x.id === propriedadeAtor)
        return a ? (
          <ConfigurarPropriedadeAtor
            ator={a}
            jogadores={jogadoresParaCena}
            onSalvar={(campos) => { atores.salvar(a.id, campos); setPropriedadeAtor(null) }}
            onFechar={() => setPropriedadeAtor(null)}
          />
        ) : null
      })()}

      {(() => {
        const a = atores.atores.find((x) => x.id === tokenAtor)
        return a ? (
          <ConfigurarToken
            ator={a}
            onEnviar={(f) => (userId ? enviarImagemDeToken(userId, f) : Promise.resolve(null))}
            onSalvar={(campos) => { atores.salvar(a.id, campos); setTokenAtor(null) }}
            onFechar={() => setTokenAtor(null)}
          />
        ) : null
      })()}

      {(() => {
        const a = atores.atores.find((x) => x.id === excluindoAtor)
        return a ? (
          <ConfirmarExclusao ator={a} onSim={() => { atores.excluir(a); setExcluindoAtor(null) }} onNao={() => setExcluindoAtor(null)} />
        ) : null
      })()}

      {(() => {
        const token = objetos.objetos.find((o) => o.id === tokenDasVariacoes)
        const a = token?.actor_id ? atores.atores.find((x) => x.id === token.actor_id) : undefined
        if (!token || !a) return null
        return (
          <PainelVariacoes
            ator={a}
            atual={token.image_url}
            onEscolher={async (url) => {
              // Mantém a largura do token e acompanha o formato da nova imagem.
              const nat = await tamanhoDaImagem(url)
              const altura = nat.w > 0 ? Math.round((token.width * nat.h) / nat.w) : null
              if (!(await trocarVariacao(token.id, url, altura))) avisar('Não deu pra trocar a imagem do token.', true)
            }}
            onFechar={() => setTokenDasVariacoes(null)}
          />
        )
      })()}

      {fichasAbertas.map((id) => {
        const a = atores.atores.find((x) => x.id === id)
        if (!a) return null
        const nivel = nivelNoAtor(a)
        const fechar = () => setFichasAbertas((l) => l.filter((x) => x !== id))
        // Limitado: só o card de prévia (5.8), sem abrir a ficha inteira.
        if (nivel === 'limitado' || nivel === 'nenhum') {
          const img = imagemDoToken(a, (a.character_id && atores.fichas[a.character_id]?.avatar_url) || null)
          return (
            <Janela key={id} titulo={a.name} largura={300} onFechar={fechar}>
              <div className="ator-previa">
                {img && <img src={img} alt="" />}
                <strong>{a.name}</strong>
                <p className="janela-dica">A ficha deste personagem está oculta pra você.</p>
              </div>
            </Janela>
          )
        }
        return (
          <FichaPortatil
            key={id}
            ator={a}
            podeEditar={nivel === 'dono'}
            onMudarPv={(pv) => atores.salvar(a.id, { pv_atual: pv })}
            onMudarCondicoes={(condicoes, condicoes_personalizadas) => atores.salvar(a.id, { condicoes, condicoes_personalizadas })}
            onRolar={rolarNoChat}
            onMostrar={mostrarNoChat}
            alvos={alvosComNome}
            onAtacar={(ataque, autor) => atacarComAmeaca(ataque, autor, a.id)}
            meuId={userId}
            onEditarAmeaca={(id) => editarAmeaca({ id, duplicar: false })}
            onFechar={fechar}
          />
        )
      })}

      {editorAmeaca && userId && (
        <EditorAmeaca
          userId={userId}
          inicial={editorAmeaca.inicial}
          onEnviarImagem={(f) => enviarImagemDeToken(userId, f)}
          onSalvo={(id) => {
            window.dispatchEvent(new CustomEvent('arkanis-ameaca-salva', { detail: id }))
            editorAmeaca.depois?.(id)
            setEditorAmeaca(null)
          }}
          onFechar={() => setEditorAmeaca(null)}
        />
      )}

      {souMestre && centralSustos && (
        <CentralDeSustos
          campanhaId={campanha.id}
          jogadores={membros.filter((m) => m.papel !== 'mestre')}
          onDisparar={dispararSusto}
          onTestar={(s) => setSusto(s)}
          onFechar={() => setCentralSustos(false)}
        />
      )}
      {susto && <SustoNaTela key={susto.id} susto={susto} onAcabou={() => setSusto(null)} />}

      <CelularNaMesa
        campanhaId={campanha.id}
        souMestre={souMestre}
        tempo={campanha.configuracoes?.tempo ?? null}
        meuPersonagemId={eu?.personagemId ?? null}
        fichas={atores.atores.filter((a) => a.tipo === 'jogador' && a.character_id).map((a) => ({ id: a.character_id!, nome: a.name, foto: atores.fichas[a.character_id!]?.avatar_url ?? null }))}
        aberto={celularAberto}
        setAberto={setCelularAberto}
      />

      {/* Celular (17/10): a mesa não cabe numa tela pequena, então o jogador ganha um atalho pra
          ficha em tela cheia. As rolagens de lá caem no chat da mesa do mesmo jeito. */}
      {!souMestre && eu?.personagemId && (
        <Link className="mesa-ficha-celular" to={`/personagem/${eu.personagemId}`}>Abrir minha ficha</Link>
      )}

      <PainelSessao conectados={online} latencia={latencia} fps={fps} />
    </main>
    </ImagensMostradas>
    </QuemVeContexto.Provider>
  )
}
