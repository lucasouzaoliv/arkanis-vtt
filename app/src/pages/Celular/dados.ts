// Celular dos personagens (pedido da Millie, 13/10): a camada de dados. As telas vêm depois, com as
// referências visuais dela (iPhone e Samsung, telas que abrem e fecham com animação, loja de apps).
// Banco: migration 0165 (celulares, contatos, NPCs, conversas, mensagens, galeria, ligações).
import { supabase } from '../../lib/supabase'
import { momento, textoHora, tempoAtivo, tempoCompleto, type ConfigTempo } from '../Mesa/tempo'

export type Modelo = 'iphone' | 'android'

export type EfeitosDoCelular = {
  sem_sinal?: boolean
  interferencia?: boolean
  /** Brilho de ritual: o elemento ("conhecimento" = dourado). */
  brilho?: string | null
  desligado?: boolean
}

export type AppsDoCelular = {
  instalados: string[]
  dock?: string[]
  paginas?: string[][]
}

export type Celular = {
  id: string
  campaign_id: string
  character_id: string
  modelo: Modelo
  capinha: { cor?: string; textura?: string }
  papel_de_parede: string | null
  papel_de_bloqueio: string | null
  nome_no_perfil: string | null
  foto_perfil: string | null
  recado: string | null
  toque_padrao: string | null
  toque_mensagem: string | null
  numero: string | null
  configurado: boolean
  idioma: string
  apps: AppsDoCelular
  efeitos: EfeitosDoCelular
  bateria: number
  created_at: string
  updated_at: string
}

export type NpcDoCelular = {
  id: string
  campaign_id: string
  nome: string
  foto: string | null
  numero: string | null
  recado: string | null
  toque: string | null
  criado_por: string
  dono_character_id: string | null
}

export type Contato = {
  id: string
  celular_id: string
  contato_celular_id: string | null
  npc_id: string | null
  apelido: string | null
  foto: string | null
  toque: string | null
  favorito: boolean
  bloqueado: boolean
  desconhecido: boolean
}

export type Conversa = {
  id: string
  campaign_id: string
  tipo: 'direta' | 'grupo'
  nome: string | null
  foto: string | null
  descricao: string | null
  criada_por_celular: string | null
  ultima_em: string
  /** Em qual app a conversa vive: Mensagens (tipo WhatsApp) ou o canal da Ordem (0166). */
  app: 'mensagens' | 'ordem'
}

export type Participante = {
  id: string
  conversa_id: string
  celular_id: string | null
  npc_id: string | null
  papel: 'admin' | 'membro'
  entrou_em: string
  saiu_em: string | null
  lida_ate: string | null
  silenciada: boolean
}

export type TipoDeMensagem = 'texto' | 'foto' | 'video' | 'audio' | 'arquivo' | 'sistema'

export type Mensagem = {
  id: string
  conversa_id: string
  campaign_id: string
  de_celular_id: string | null
  de_npc_id: string | null
  enviado_por: string
  tipo: TipoDeMensagem
  texto: string | null
  arquivo_url: string | null
  arquivo: { nome?: string; duracao?: number; largura?: number; altura?: number } | null
  minuto_no_jogo: number | null
  estado: 'pendente' | 'enviada'
  efeito: { corrompida?: boolean; some_apos_ler?: boolean; elemento?: string } | null
  responde_a: string | null
  apagada: boolean
  created_at: string
}

export type FotoDaGaleria = {
  id: string
  celular_id: string
  url: string
  tipo: 'foto' | 'video'
  legenda: string | null
  minuto_no_jogo: number | null
  mensagem_id: string | null
  created_at: string
}

export type EstadoDaLigacao = 'chamando' | 'em_curso' | 'recusada' | 'perdida' | 'encerrada' | 'sem_sinal'

export type Ligacao = {
  id: string
  campaign_id: string
  de_celular_id: string | null
  de_npc_id: string | null
  para_celular_id: string | null
  para_npc_id: string | null
  estado: EstadoDaLigacao
  iniciada_por: string
  minuto_no_jogo: number | null
  iniciada_em: string
  atendida_em: string | null
  encerrada_em: string | null
}

/** Quem fala: um celular da mesa ou um NPC. */
export type Lado = { celular: string } | { npc: string }

const erroDe = (e: { message?: string } | null) => (e ? e.message || 'Não deu certo.' : null)
const ladoDe = (l: Lado) => ('celular' in l ? { celular: l.celular, npc: null } : { celular: null, npc: l.npc })

// ---- Apps ----

// Cada app: o que já vem no aparelho, o que se baixa na loja, e os que são só enfeite (ficam com o
// ícone na tela, sem abrir nada). Os nomes e ícones finais vêm com o visual.
export type App = { id: string; nome: string; funciona: boolean; deFabrica?: boolean; descricao?: string }

export const APPS: App[] = [
  { id: 'telefone', nome: 'Telefone', funciona: true, deFabrica: true },
  { id: 'mensagens', nome: 'Mensagens', funciona: true, deFabrica: true },
  { id: 'configuracoes', nome: 'Configurações', funciona: true, deFabrica: true },
  { id: 'mapas', nome: 'Mapas', funciona: true, deFabrica: true },
  { id: 'loja', nome: 'Loja', funciona: true, deFabrica: true },
  { id: 'ordem', nome: 'Ordo Realitas', funciona: true, descricao: 'Canal seguro dos agentes da Ordem.' },
  { id: 'galeria', nome: 'Galeria', funciona: true },
  { id: 'camera', nome: 'Câmera', funciona: true },
  // Os de baixo ainda são só o ícone (Notas, Notícias, rede social e e-mail entram nas próximas partes).
  { id: 'notas', nome: 'Notas', funciona: false },
  { id: 'noticias', nome: 'Notícias', funciona: false },
  { id: 'rede_social', nome: 'Instagram', funciona: false },
  { id: 'email', nome: 'E-mail', funciona: false },
  { id: 'spotify', nome: 'Spotify', funciona: false },
  { id: 'uber', nome: 'Uber', funciona: false },
  { id: 'twitter', nome: 'X', funciona: false },
  { id: 'tiktok', nome: 'TikTok', funciona: false },
  { id: 'youtube', nome: 'YouTube', funciona: false },
  { id: 'discord', nome: 'Discord', funciona: false },
  { id: 'calculadora', nome: 'Calculadora', funciona: false },
  { id: 'banco', nome: 'Banco', funciona: false },
  { id: 'musica', nome: 'Música', funciona: false },
  { id: 'clima', nome: 'Clima', funciona: false },
  { id: 'jogo', nome: 'Jogo', funciona: false },
]

// Loja: App Store no iPhone, Play Store no Android.
export function nomeDaLoja(modelo: Modelo): string {
  return modelo === 'iphone' ? 'App Store' : 'Play Store'
}

export function instalarApp(apps: AppsDoCelular, id: string): AppsDoCelular {
  if (apps.instalados.includes(id) || !APPS.some((a) => a.id === id)) return apps
  return { ...apps, instalados: [...apps.instalados, id] }
}

// Os de fábrica não saem (como no celular de verdade).
export function desinstalarApp(apps: AppsDoCelular, id: string): AppsDoCelular {
  if (APPS.find((a) => a.id === id)?.deFabrica) return apps
  return {
    instalados: apps.instalados.filter((x) => x !== id),
    ...(apps.dock ? { dock: apps.dock.filter((x) => x !== id) } : {}),
    ...(apps.paginas ? { paginas: apps.paginas.map((p) => p.filter((x) => x !== id)) } : {}),
  }
}

// ---- Hora do jogo ----

// "23:47" da mensagem, no relógio do jogo (sem relógio na campanha, a hora real de quando foi enviada).
export function horaDaMensagem(tempo: Partial<ConfigTempo> | null | undefined, minutoNoJogo: number | null, criadaEm: string): string {
  if (minutoNoJogo != null && tempoAtivo(tempo)) {
    const t = tempoCompleto(tempo)
    return textoHora(momento({ ...t, minutos: minutoNoJogo }), { formato: t.formato })
  }
  const d = new Date(criadaEm)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Não lidas: mensagens enviadas depois do "lido até", que não são do próprio celular.
export function naoLidas(mensagens: Pick<Mensagem, 'created_at' | 'de_celular_id' | 'estado' | 'apagada'>[], meuCelular: string, lidaAte: string | null): number {
  const desde = lidaAte ? Date.parse(lidaAte) : 0
  return mensagens.filter((m) => m.estado === 'enviada' && !m.apagada && m.de_celular_id !== meuCelular && Date.parse(m.created_at) > desde).length
}

// ---- Celular ----

export async function abrirCelular(characterId: string): Promise<{ celular: Celular | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('abrir_celular', { p_character_id: characterId })
  return { celular: (data as Celular | null) ?? null, erro: erroDe(error) }
}

type MudancasDoCelular = Partial<Pick<Celular, 'modelo' | 'capinha' | 'papel_de_parede' | 'papel_de_bloqueio' | 'nome_no_perfil' | 'foto_perfil' | 'recado' | 'toque_padrao' | 'toque_mensagem' | 'numero' | 'configurado' | 'idioma' | 'apps'>>

export async function mudarCelular(id: string, mudancas: MudancasDoCelular): Promise<string | null> {
  const { error } = await supabase.from('celulares').update({ ...mudancas, updated_at: new Date().toISOString() }).eq('id', id)
  return erroDe(error)
}

// Os celulares da mesa (pra escolher contato da mesa e mostrar nome/foto nos grupos).
export async function celularesDaMesa(campanhaId: string): Promise<Celular[]> {
  const { data } = await supabase.from('celulares').select('*').eq('campaign_id', campanhaId)
  return (data ?? []) as Celular[]
}

// ---- NPCs e contatos ----

export async function criarNpc(p: { campanhaId: string; nome: string; foto?: string | null; numero?: string | null; recado?: string | null; donoCharacterId?: string | null }): Promise<{ npc: NpcDoCelular | null; erro: string | null }> {
  const { data: u } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('celular_npcs').insert({
    campaign_id: p.campanhaId, nome: p.nome.trim(), foto: p.foto ?? null, numero: p.numero ?? null, recado: p.recado ?? null,
    dono_character_id: p.donoCharacterId ?? null, criado_por: u.user?.id,
  }).select('*').single()
  return { npc: (data as NpcDoCelular | null) ?? null, erro: erroDe(error) }
}

export async function npcsVisiveis(campanhaId: string): Promise<NpcDoCelular[]> {
  const { data } = await supabase.from('celular_npcs').select('*').eq('campaign_id', campanhaId).order('nome')
  return (data ?? []) as NpcDoCelular[]
}

export async function contatosDo(celularId: string): Promise<Contato[]> {
  const { data } = await supabase.from('celular_contatos').select('*').eq('celular_id', celularId)
  return (data ?? []) as Contato[]
}

export async function adicionarContato(celularId: string, quem: Lado, extra: Partial<Pick<Contato, 'apelido' | 'foto' | 'toque' | 'desconhecido'>> = {}): Promise<string | null> {
  const l = ladoDe(quem)
  const { error } = await supabase.from('celular_contatos').insert({ celular_id: celularId, contato_celular_id: l.celular, npc_id: l.npc, ...extra })
  return erroDe(error)
}

export async function mudarContato(id: string, mudancas: Partial<Pick<Contato, 'apelido' | 'foto' | 'toque' | 'favorito' | 'bloqueado' | 'desconhecido'>>): Promise<string | null> {
  const { error } = await supabase.from('celular_contatos').update(mudancas).eq('id', id)
  return erroDe(error)
}

export async function apagarContato(id: string): Promise<string | null> {
  const { error } = await supabase.from('celular_contatos').delete().eq('id', id)
  return erroDe(error)
}

// ---- Conversas e mensagens ----

export async function criarConversa(p: { deCelular: string; tipo: 'direta' | 'grupo'; celulares?: string[]; npcs?: string[]; nome?: string; foto?: string | null; app?: Conversa['app'] }): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('criar_conversa', {
    p_de_celular: p.deCelular, p_tipo: p.tipo, p_celulares: p.celulares ?? [], p_npcs: p.npcs ?? [], p_nome: p.nome ?? null, p_foto: p.foto ?? null, p_app: p.app ?? 'mensagens',
  })
  return { id: (data as string | null) ?? null, erro: erroDe(error) }
}

// As conversas que este celular vê (o mestre vê todas da campanha), da mais recente pra mais antiga.
export async function conversasDaCampanha(campanhaId: string): Promise<{ conversas: Conversa[]; participantes: Participante[] }> {
  const { data: conversas } = await supabase.from('celular_conversas').select('*').eq('campaign_id', campanhaId).order('ultima_em', { ascending: false })
  const ids = (conversas ?? []).map((c) => c.id)
  const { data: participantes } = ids.length ? await supabase.from('celular_participantes').select('*').in('conversa_id', ids) : { data: [] }
  return { conversas: (conversas ?? []) as Conversa[], participantes: (participantes ?? []) as Participante[] }
}

// As últimas mensagens de várias conversas de uma vez (prévia na lista e contador de não lidas).
export async function ultimasMensagens(conversaIds: string[], limite = 400): Promise<Mensagem[]> {
  if (!conversaIds.length) return []
  const { data } = await supabase.from('celular_mensagens').select('*').in('conversa_id', conversaIds).order('created_at', { ascending: false }).limit(limite)
  return ((data ?? []) as Mensagem[]).reverse()
}

export async function mensagensDa(conversaId: string, limite = 200): Promise<Mensagem[]> {
  const { data } = await supabase.from('celular_mensagens').select('*').eq('conversa_id', conversaId).order('created_at', { ascending: false }).limit(limite)
  return ((data ?? []) as Mensagem[]).reverse()
}

export async function enviarMensagem(p: {
  conversaId: string
  de: Lado
  tipo: TipoDeMensagem
  texto?: string | null
  arquivoUrl?: string | null
  arquivo?: Mensagem['arquivo']
  efeito?: Mensagem['efeito']
  respondeA?: string | null
}): Promise<string | null> {
  const l = ladoDe(p.de)
  const { error } = await supabase.rpc('enviar_no_celular', {
    p_conversa_id: p.conversaId, p_tipo: p.tipo, p_texto: p.texto ?? null, p_arquivo_url: p.arquivoUrl ?? null, p_arquivo: p.arquivo ?? null,
    p_de_celular: l.celular, p_de_npc: l.npc, p_efeito: p.efeito ?? null, p_responde_a: p.respondeA ?? null,
  })
  return erroDe(error)
}

export async function apagarMensagem(id: string): Promise<string | null> {
  const { error } = await supabase.rpc('apagar_mensagem_do_celular', { p_mensagem_id: id })
  return erroDe(error)
}

export async function marcarLida(conversaId: string, celularId: string): Promise<void> {
  await supabase.from('celular_participantes').update({ lida_ate: new Date().toISOString() }).eq('conversa_id', conversaId).eq('celular_id', celularId)
}

export async function adicionarNaConversa(conversaId: string, quem: Lado): Promise<string | null> {
  const l = ladoDe(quem)
  const { error } = await supabase.rpc('adicionar_na_conversa', { p_conversa_id: conversaId, p_celular: l.celular, p_npc: l.npc })
  return erroDe(error)
}

export async function sairDaConversa(conversaId: string, quem: Lado): Promise<string | null> {
  const l = ladoDe(quem)
  const { error } = await supabase.rpc('sair_da_conversa', { p_conversa_id: conversaId, p_celular: l.celular, p_npc: l.npc })
  return erroDe(error)
}

export async function mudarPapel(conversaId: string, participanteId: string, papel: 'admin' | 'membro'): Promise<string | null> {
  const { error } = await supabase.rpc('papel_na_conversa', { p_conversa_id: conversaId, p_participante: participanteId, p_papel: papel })
  return erroDe(error)
}

// ---- Galeria ----

export async function galeriaDo(celularId: string): Promise<FotoDaGaleria[]> {
  const { data } = await supabase.from('celular_galeria').select('*').eq('celular_id', celularId).order('created_at', { ascending: false })
  return (data ?? []) as FotoDaGaleria[]
}

export async function guardarNaGaleria(p: { celularId: string; url: string; tipo?: 'foto' | 'video'; legenda?: string | null; minutoNoJogo?: number | null; mensagemId?: string | null }): Promise<string | null> {
  const { error } = await supabase.from('celular_galeria').insert({
    celular_id: p.celularId, url: p.url, tipo: p.tipo ?? 'foto', legenda: p.legenda ?? null, minuto_no_jogo: p.minutoNoJogo ?? null, mensagem_id: p.mensagemId ?? null,
  })
  return erroDe(error)
}

export async function apagarDaGaleria(id: string): Promise<string | null> {
  const { error } = await supabase.from('celular_galeria').delete().eq('id', id)
  return erroDe(error)
}

// ---- Arquivos (fotos, vídeos, áudios, papéis de parede, toques) ----

export async function enviarArquivo(arquivo: File | Blob, nome: string): Promise<{ url: string | null; erro: string | null }> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return { url: null, erro: 'Entre na sua conta.' }
  const caminho = `${u.user.id}/${Date.now()}-${nome.replace(/[^\w.-]/g, '_')}`
  const { error } = await supabase.storage.from('celular_arquivos').upload(caminho, arquivo, { upsert: false })
  if (error) return { url: null, erro: erroDe(error) }
  return { url: supabase.storage.from('celular_arquivos').getPublicUrl(caminho).data.publicUrl, erro: null }
}

// ---- Ligações ----

export async function ligar(de: Lado, para: Lado): Promise<{ id: string | null; erro: string | null }> {
  const a = ladoDe(de)
  const b = ladoDe(para)
  const { data, error } = await supabase.rpc('ligar_no_celular', { p_de_celular: a.celular, p_de_npc: a.npc, p_para_celular: b.celular, p_para_npc: b.npc })
  return { id: (data as string | null) ?? null, erro: erroDe(error) }
}

export async function responderLigacao(id: string, acao: 'atender' | 'recusar' | 'encerrar'): Promise<string | null> {
  const { error } = await supabase.rpc('responder_ligacao', { p_ligacao_id: id, p_acao: acao })
  return erroDe(error)
}

export async function ligacoesDaCampanha(campanhaId: string, limite = 50): Promise<Ligacao[]> {
  const { data } = await supabase.from('celular_ligacoes').select('*').eq('campaign_id', campanhaId).order('iniciada_em', { ascending: false }).limit(limite)
  return (data ?? []) as Ligacao[]
}

// ---- Mestre ----

// Efeitos num celular ou em todos (celulares nulo). Mandar null numa chave tira o efeito.
export async function efeitoNoCelular(campanhaId: string, efeitos: { [K in keyof EfeitosDoCelular]?: EfeitosDoCelular[K] | null }, opcoes: { celulares?: string[]; bateria?: number } = {}): Promise<string | null> {
  const { error } = await supabase.rpc('efeito_no_celular', {
    p_campaign_id: campanhaId, p_celulares: opcoes.celulares ?? null, p_efeitos: efeitos, p_bateria: opcoes.bateria ?? null,
  })
  return erroDe(error)
}

// ---- Tempo real ----

// Avisa quando algo do celular muda na campanha (mensagem nova, ligação tocando, efeito do mestre).
// As regras do banco já filtram o que cada um pode ver.
export function ouvirCelulares(campanhaId: string, aoMudar: (tabela: string, linha: Record<string, unknown>) => void): () => void {
  const canal = supabase.channel(`celular-${campanhaId}-${Math.random().toString(36).slice(2)}`)
  for (const tabela of ['celulares', 'celular_npcs', 'celular_conversas', 'celular_mensagens', 'celular_ligacoes']) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela, filter: `campaign_id=eq.${campanhaId}` }, (p) => {
      aoMudar(tabela, (p.new && Object.keys(p.new).length ? p.new : p.old) as Record<string, unknown>)
    })
  }
  for (const tabela of ['celular_participantes', 'celular_contatos', 'celular_galeria']) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, (p) => {
      aoMudar(tabela, (p.new && Object.keys(p.new).length ? p.new : p.old) as Record<string, unknown>)
    })
  }
  canal.subscribe()
  return () => { supabase.removeChannel(canal) }
}
