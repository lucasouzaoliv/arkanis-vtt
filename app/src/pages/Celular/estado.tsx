// Estado de um celular aberto: o que as telas leem e as ações que elas chamam. Vem do banco
// (useCelularDoBanco) ou, nas páginas de teste, de dados de mentira com a mesma forma.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ConfigTempo } from '../Mesa/tempo'
import * as db from './dados'
import type { Celular, Contato, Conversa, FotoDaGaleria, Lado, Ligacao, Mensagem, NpcDoCelular, Participante } from './dados'

export type Acoes = {
  mudarCelular: (m: Parameters<typeof db.mudarCelular>[1]) => Promise<string | null>
  abrirConversa: (conversaId: string) => Promise<void>
  /** Manda pelo celular aberto; o mestre pode mandar como um NPC da conversa (`de`). */
  enviar: (p: Omit<Parameters<typeof db.enviarMensagem>[0], 'de'> & { de?: Lado }) => Promise<string | null>
  apagarMensagem: (id: string) => Promise<string | null>
  marcarLida: (conversaId: string) => Promise<void>
  criarConversa: (p: Omit<Parameters<typeof db.criarConversa>[0], 'deCelular'>) => Promise<{ id: string | null; erro: string | null }>
  adicionarNaConversa: (conversaId: string, quem: Lado) => Promise<string | null>
  sairDaConversa: (conversaId: string, quem: Lado) => Promise<string | null>
  mudarConversa: (conversaId: string, m: Partial<Pick<Conversa, 'nome' | 'foto' | 'descricao'>>) => Promise<string | null>
  criarNpc: (p: { nome: string; foto?: string | null; numero?: string | null; recado?: string | null }) => Promise<{ npc: NpcDoCelular | null; erro: string | null }>
  adicionarContato: (quem: Lado, extra?: Parameters<typeof db.adicionarContato>[2]) => Promise<string | null>
  mudarContato: (id: string, m: Parameters<typeof db.mudarContato>[1]) => Promise<string | null>
  apagarContato: (id: string) => Promise<string | null>
  enviarArquivo: (arquivo: File | Blob, nome: string) => Promise<{ url: string | null; erro: string | null }>
  guardarNaGaleria: (p: Omit<Parameters<typeof db.guardarNaGaleria>[0], 'celularId'>) => Promise<string | null>
  apagarDaGaleria: (id: string) => Promise<string | null>
  ligar: (para: Lado) => Promise<{ id: string | null; erro: string | null }>
  responderLigacao: (id: string, acao: 'atender' | 'recusar' | 'encerrar') => Promise<string | null>
}

export type EstadoDoCelular = {
  /** De quem é o celular aberto: um personagem (celular) ou um NPC (o mestre respondendo por ele). */
  eu: Lado
  celular: Celular
  souMestre: boolean
  tempo: Partial<ConfigTempo> | null
  celulares: Celular[]
  npcs: NpcDoCelular[]
  contatos: Contato[]
  conversas: Conversa[]
  participantes: Participante[]
  mensagens: Record<string, Mensagem[]>
  galeria: FotoDaGaleria[]
  ligacoes: Ligacao[]
  carregando: boolean
  acoes: Acoes
}

export const CelularContexto = createContext<EstadoDoCelular | null>(null)

export function useCelular(): EstadoDoCelular {
  const c = useContext(CelularContexto)
  if (!c) throw new Error('useCelular fora do celular')
  return c
}

// ---- Leituras que as telas usam ----

export function ehEu(eu: Lado, de: { celular?: string | null; npc?: string | null }): boolean {
  return 'celular' in eu ? de.celular === eu.celular : de.npc === eu.npc
}

export function minhasConversas(e: Pick<EstadoDoCelular, 'eu' | 'conversas' | 'participantes'>, app: Conversa['app']): Conversa[] {
  const minhas = new Set(
    e.participantes.filter((p) => !p.saiu_em && ('celular' in e.eu ? p.celular_id === e.eu.celular : p.npc_id === e.eu.npc)).map((p) => p.conversa_id),
  )
  return e.conversas.filter((c) => c.app === app && minhas.has(c.id)).sort((a, b) => Date.parse(b.ultima_em) - Date.parse(a.ultima_em))
}

export type Pessoa = { nome: string; foto: string | null; numero: string | null; recado: string | null; lado: Lado; naAgenda?: boolean }

// Como alguém aparece pra este celular: com o nome salvo na agenda, senão o do perfil.
export function pessoa(e: Pick<EstadoDoCelular, 'celulares' | 'npcs' | 'contatos'>, quem: { celular?: string | null; npc?: string | null }): Pessoa {
  const contato = e.contatos.find((k) => (quem.celular ? k.contato_celular_id === quem.celular : k.npc_id === quem.npc))
  if (contato?.desconhecido) return { nome: 'Número desconhecido', foto: null, numero: null, recado: null, lado: quem.celular ? { celular: quem.celular } : { npc: quem.npc! } }
  if (quem.celular) {
    const c = e.celulares.find((x) => x.id === quem.celular)
    return { nome: contato?.apelido || c?.nome_no_perfil || c?.numero || 'Sem nome', foto: contato?.foto || c?.foto_perfil || null, numero: c?.numero ?? null, recado: c?.recado ?? null, lado: { celular: quem.celular }, naAgenda: !!contato }
  }
  const n = e.npcs.find((x) => x.id === quem.npc)
  return { nome: contato?.apelido || n?.nome || 'Sem nome', foto: contato?.foto || n?.foto || null, numero: n?.numero ?? null, recado: n?.recado ?? null, lado: { npc: quem.npc! }, naAgenda: !!contato }
}

// O título de uma conversa: o nome do grupo, ou a outra pessoa da conversa direta.
export function tituloDaConversa(e: Pick<EstadoDoCelular, 'eu' | 'celulares' | 'npcs' | 'contatos' | 'participantes'>, c: Conversa): { nome: string; foto: string | null; outro: Pessoa | null } {
  if (c.tipo === 'grupo') return { nome: c.nome || 'Grupo', foto: c.foto, outro: null }
  const outro = e.participantes.find((p) => p.conversa_id === c.id && !ehEu(e.eu, { celular: p.celular_id, npc: p.npc_id }))
  if (!outro) return { nome: 'Conversa', foto: null, outro: null }
  const p = pessoa(e, { celular: outro.celular_id, npc: outro.npc_id })
  return { nome: p.nome, foto: p.foto, outro: p }
}

export function membrosDaConversa(e: Pick<EstadoDoCelular, 'participantes'>, conversaId: string): Participante[] {
  return e.participantes.filter((p) => p.conversa_id === conversaId && !p.saiu_em)
}

// ---- Do banco ----

function porConversa(lista: Mensagem[]): Record<string, Mensagem[]> {
  const r: Record<string, Mensagem[]> = {}
  for (const m of lista) (r[m.conversa_id] ??= []).push(m)
  return r
}

function juntarMensagem(atual: Record<string, Mensagem[]>, m: Mensagem): Record<string, Mensagem[]> {
  const lista = atual[m.conversa_id] ?? []
  const i = lista.findIndex((x) => x.id === m.id)
  const nova = i >= 0 ? lista.map((x) => (x.id === m.id ? m : x)) : [...lista, m]
  nova.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  return { ...atual, [m.conversa_id]: nova }
}

// O celular de um personagem (characterId) ou de um NPC (npcId, só o mestre). Recarrega sozinho com
// o tempo real; mensagem nova entra direto na conversa.
export function useCelularDoBanco(p: {
  campanhaId: string
  characterId?: string | null
  npcId?: string | null
  souMestre: boolean
  tempo: Partial<ConfigTempo> | null
  aoChegar?: (tipo: 'mensagem' | 'ligacao', linha: Record<string, unknown>) => void
}): { estado: EstadoDoCelular | null; erro: string | null } {
  const [celular, setCelular] = useState<Celular | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [celulares, setCelulares] = useState<Celular[]>([])
  const [npcs, setNpcs] = useState<NpcDoCelular[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [mensagens, setMensagens] = useState<Record<string, Mensagem[]>>({})
  const [galeria, setGaleria] = useState<FotoDaGaleria[]>([])
  const [ligacoes, setLigacoes] = useState<Ligacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const aoChegar = useRef(p.aoChegar)
  aoChegar.current = p.aoChegar

  // NPC aberto pelo mestre: um "celular" de mentira, só pra moldura e o perfil.
  const npcAberto = p.npcId ? npcs.find((n) => n.id === p.npcId) ?? null : null
  const celularDoNpc: Celular | null = useMemo(() => (p.npcId ? {
    id: `npc:${p.npcId}`, campaign_id: p.campanhaId, character_id: '', modelo: 'android', capinha: {}, papel_de_parede: null, papel_de_bloqueio: null,
    nome_no_perfil: npcAberto?.nome ?? 'NPC', foto_perfil: npcAberto?.foto ?? null, recado: npcAberto?.recado ?? null, toque_padrao: npcAberto?.toque ?? null,
    toque_mensagem: null, numero: npcAberto?.numero ?? null, configurado: true, idioma: 'pt-BR',
    apps: { instalados: ['telefone', 'mensagens', 'configuracoes', 'mapas', 'loja', 'ordem', 'galeria', 'camera'] }, efeitos: {}, bateria: 100,
    created_at: '', updated_at: '',
  } : null), [p.npcId, p.campanhaId, npcAberto])

  const eu: Lado | null = p.npcId ? { npc: p.npcId } : celular ? { celular: celular.id } : null

  const carregarConversas = useCallback(async () => {
    const r = await db.conversasDaCampanha(p.campanhaId)
    setConversas(r.conversas)
    setParticipantes(r.participantes)
    const recentes = await db.ultimasMensagens(r.conversas.map((c) => c.id))
    setMensagens((atual) => {
      const novas = porConversa(recentes)
      // Conversa já aberta (com mais histórico) não perde o que carregou.
      for (const [id, lista] of Object.entries(atual)) if ((novas[id]?.length ?? 0) < lista.length) novas[id] = lista
      return novas
    })
  }, [p.campanhaId])

  const carregarTudo = useCallback(async () => {
    setCarregando(true)
    if (p.characterId) {
      const r = await db.abrirCelular(p.characterId)
      if (r.erro) setErro(r.erro)
      setCelular(r.celular)
      if (r.celular) {
        setContatos(await db.contatosDo(r.celular.id))
        setGaleria(await db.galeriaDo(r.celular.id))
      }
    }
    setCelulares(await db.celularesDaMesa(p.campanhaId))
    setNpcs(await db.npcsVisiveis(p.campanhaId))
    await carregarConversas()
    setLigacoes(await db.ligacoesDaCampanha(p.campanhaId))
    setCarregando(false)
  }, [p.characterId, p.campanhaId, carregarConversas])

  useEffect(() => { void carregarTudo() }, [carregarTudo])

  // Tempo real: o que mudou recarrega só o pedaço dele.
  const meuCelularId = celular?.id ?? null
  useEffect(() => {
    let espera: number | undefined
    const pendentes = new Set<string>()
    const recarregar = () => {
      const t = new Set(pendentes)
      pendentes.clear()
      if (t.has('celulares')) {
        void db.celularesDaMesa(p.campanhaId).then((l) => {
          setCelulares(l)
          if (meuCelularId) { const meu = l.find((c) => c.id === meuCelularId); if (meu) setCelular(meu) }
        })
      }
      if (t.has('celular_conversas') || t.has('celular_participantes')) void carregarConversas()
      if (t.has('celular_npcs')) void db.npcsVisiveis(p.campanhaId).then(setNpcs)
      if (t.has('celular_contatos') && meuCelularId) void db.contatosDo(meuCelularId).then(setContatos)
      if (t.has('celular_galeria') && meuCelularId) void db.galeriaDo(meuCelularId).then(setGaleria)
      if (t.has('celular_ligacoes')) void db.ligacoesDaCampanha(p.campanhaId).then(setLigacoes)
    }
    const parar = db.ouvirCelulares(p.campanhaId, (tabela, linha) => {
      if (tabela === 'celular_mensagens' && linha.id) {
        setMensagens((atual) => juntarMensagem(atual, linha as unknown as Mensagem))
        aoChegar.current?.('mensagem', linha)
        pendentes.add('celular_conversas')
      } else {
        if (tabela === 'celular_ligacoes') aoChegar.current?.('ligacao', linha)
        pendentes.add(tabela)
      }
      window.clearTimeout(espera)
      espera = window.setTimeout(recarregar, 250)
    })
    return () => { window.clearTimeout(espera); parar() }
  }, [p.campanhaId, meuCelularId, carregarConversas])

  const celularAberto = p.npcId ? celularDoNpc : celular
  const acoes: Acoes | null = useMemo(() => {
    if (!eu || !celularAberto) return null
    const id = 'celular' in eu ? eu.celular : null
    return {
      mudarCelular: async (m) => {
        if (!id) return 'O celular do NPC não muda por aqui.'
        setCelular((c) => (c ? { ...c, ...m } : c))
        return db.mudarCelular(id, m)
      },
      abrirConversa: async (conversaId) => {
        const lista = await db.mensagensDa(conversaId)
        setMensagens((atual) => ({ ...atual, [conversaId]: lista }))
      },
      enviar: async (m) => db.enviarMensagem({ ...m, de: m.de ?? eu }),
      apagarMensagem: db.apagarMensagem,
      marcarLida: async (conversaId) => {
        if (!id) return
        setParticipantes((l) => l.map((x) => (x.conversa_id === conversaId && x.celular_id === id ? { ...x, lida_ate: new Date().toISOString() } : x)))
        await db.marcarLida(conversaId, id)
      },
      criarConversa: async (c) => {
        // O mestre como NPC cria a conversa a partir do celular do outro lado.
        const de = id ?? c.celulares?.[0]
        if (!de) return { id: null, erro: 'Escolha um personagem da mesa pra conversar.' }
        const r = await db.criarConversa({ ...c, deCelular: de, celulares: id ? c.celulares : c.celulares?.slice(1), npcs: id ? c.npcs : [...(c.npcs ?? []), ...('npc' in eu ? [eu.npc] : [])] })
        await carregarConversas()
        return r
      },
      adicionarNaConversa: async (conversaId, quem) => { const e = await db.adicionarNaConversa(conversaId, quem); await carregarConversas(); return e },
      sairDaConversa: async (conversaId, quem) => { const e = await db.sairDaConversa(conversaId, quem); await carregarConversas(); return e },
      mudarConversa: async (conversaId, m) => {
        const { supabase } = await import('../../lib/supabase')
        const { error } = await supabase.from('celular_conversas').update(m).eq('id', conversaId)
        await carregarConversas()
        return error ? error.message : null
      },
      criarNpc: async (n) => {
        const r = await db.criarNpc({ ...n, campanhaId: p.campanhaId, donoCharacterId: p.characterId ?? null })
        setNpcs(await db.npcsVisiveis(p.campanhaId))
        return r
      },
      adicionarContato: async (quem, extra) => {
        if (!id) return 'O NPC não tem agenda.'
        const e = await db.adicionarContato(id, quem, extra)
        setContatos(await db.contatosDo(id))
        return e
      },
      mudarContato: async (cid, m) => { const e = await db.mudarContato(cid, m); if (id) setContatos(await db.contatosDo(id)); return e },
      apagarContato: async (cid) => { const e = await db.apagarContato(cid); if (id) setContatos(await db.contatosDo(id)); return e },
      enviarArquivo: db.enviarArquivo,
      guardarNaGaleria: async (g) => {
        if (!id) return 'O NPC não tem galeria.'
        const e = await db.guardarNaGaleria({ ...g, celularId: id })
        setGaleria(await db.galeriaDo(id))
        return e
      },
      apagarDaGaleria: async (gid) => { const e = await db.apagarDaGaleria(gid); if (id) setGaleria(await db.galeriaDo(id)); return e },
      ligar: async (para) => { const r = await db.ligar(eu, para); setLigacoes(await db.ligacoesDaCampanha(p.campanhaId)); return r },
      responderLigacao: async (lid, acao) => { const e = await db.responderLigacao(lid, acao); setLigacoes(await db.ligacoesDaCampanha(p.campanhaId)); return e },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eu && ('celular' in eu ? eu.celular : eu.npc), celularAberto, p.campanhaId, p.characterId, carregarConversas])

  if (!eu || !celularAberto || !acoes) return { estado: null, erro }
  return {
    estado: { eu, celular: celularAberto, souMestre: p.souMestre, tempo: p.tempo, celulares, npcs, contatos, conversas, participantes, mensagens, galeria, ligacoes, carregando, acoes },
    erro,
  }
}
