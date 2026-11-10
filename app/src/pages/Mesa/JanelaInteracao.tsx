import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBriefcase, faCoins, faDiceD20, faHandHolding, faLock, faStore, faWeightHanging, faXmark } from '@fortawesome/free-solid-svg-icons'
import { patenteOf } from '../CharacterSheet/InventarioTopBox'
import Janela from './Janela'
import { supabase } from '../../lib/supabase'
import { sistemaDe } from '../../sistemas'
import type { TesteDoPersonagem } from '../../sistemas/tipos'
import { sanitizarHtml } from './chat'
import type { ObjetoCena } from './cenas'
import { ICONE_ATIVIDADE } from './FichaItem'
import { atividadeCompleta, formatarDinheiro, temTeste, type Atividade, type ItemMesa } from './itens'
import { botoesDaInteracao, dentroDoAlcance, distanciaEmMetros, passouNoTeste, proximas, rotuloDoTeste, semUsos, testeDe } from './interacao'
import { dadosDoAlvo, maximoDoAlvo } from './acoesDeMira'
import { danoNoAlvo, defesaDoAlvo, perfilDoAlvo, rolarAtaque, rolarCura, rolarDanoDoAtaque, type AcaoInteracao, type Recurso } from './mira'

type EntradaDetalhada = { item_id: string | null; compendio_id: string | null; quantidade: number; ilimitado?: boolean; name: string; image_url: string | null; carga: number; preco?: number | null; categoria?: string }
type ItemDoToken = ItemMesa & { conteudo_detalhado: EntradaDetalhada[] }
type Situacao = { dinheiro: number; patente: string | null; carga?: number; carga_maxima?: number; categorias: Record<string, { atual: number; limite: number }> }
type Registro = Omit<AcaoInteracao, 'tipo' | 'estado' | 'item' | 'imagem'>

const motivo = (e: { message?: string } | null) => (e ? e.message || 'Não deu certo.' : null)

// Janela de interação (KAN-53, parte 2): clicou num item da mesa (baú, porta, armadilha…),
// abre esta janelinha com a imagem, a descrição e as ações. Roda a atividade escolhida e o que
// vem depois (Se passar / Se falhar / Em seguida); cada passo vai pro chat.
export default function JanelaInteracao({ token, objetos, meuToken, characterId, souMestre, sistemaId, celula, metrosPorQuadrado, meusAlvos, coletarAoAbrir = false, onFechar }: {
  token: ObjetoCena // o item na mesa
  objetos: ObjetoCena[] // tokens da cena (pros alvos)
  meuToken: ObjetoCena | null // de quem interage
  characterId: string | null // a ficha de quem interage (pros testes e o inventário)
  souMestre: boolean
  sistemaId: string | null | undefined
  celula: { w: number; h: number }
  metrosPorQuadrado: number
  meusAlvos: string[]
  // Botão direito → Coletar Item: já tenta pegar assim que abrir.
  coletarAoAbrir?: boolean
  onFechar: () => void
}) {
  const sistema = sistemaDe(sistemaId)
  const [item, setItem] = useState<ItemDoToken | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [conteudoAberto, setConteudoAberto] = useState(false)
  const [documento, setDocumento] = useState(false)
  // Loja: a vitrine aberta e a situação de quem compra (dinheiro, limites da patente).
  const [lojaAberta, setLojaAberta] = useState(false)
  const [situacao, setSituacao] = useState<Situacao | null>(null)
  // Atividade com teste: antes de rolar, a janela avisa qual teste é e a pessoa decide.
  const [pedido, setPedido] = useState<{ atividade: Atividade; rotulo: string; dt: number | null; resolver: (ok: boolean) => void } | null>(null)
  const pedidoRef = useRef(pedido)
  pedidoRef.current = pedido
  const vivo = useRef(true)
  useEffect(() => () => {
    vivo.current = false
    pedidoRef.current?.resolver(false)
  }, [])

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('item_do_token', { p_token_id: token.id })
    if (!vivo.current) return null
    if (error) {
      setErro(motivo(error))
      return null
    }
    const i = data as ItemDoToken
    const completo = { ...i, atividades: (i.atividades ?? []).map(atividadeCompleta), conteudo_detalhado: i.conteudo_detalhado ?? [] }
    setItem(completo)
    return completo
  }, [token.id])

  useEffect(() => { carregar() }, [carregar])

  // Com o contêiner (ou a loja) aberto, o conteúdo se atualiza sozinho: se outra pessoa pegar algo, some aqui.
  useEffect(() => {
    if (!conteudoAberto && !lojaAberta) return
    const t = window.setInterval(() => { carregar() }, 3000)
    return () => window.clearInterval(t)
  }, [conteudoAberto, lojaAberta, carregar])

  const distancia = meuToken ? distanciaEmMetros(meuToken, token, celula, metrosPorQuadrado) : null
  const metrosDoAlcance = (a: Atividade) => sistema.alcances.find((x) => x.id === a.ativacao.alcance)?.metros ?? null
  const alcanceOk = (a: Atividade) => souMestre || dentroDoAlcance(distancia, metrosDoAlcance(a))

  // A DT nunca vai pro chat (pedido da Millie): só o nome do teste, o resultado e passou/falhou.
  async function postar(r: Registro) {
    if (!item) return
    const acao = { item: item.name, imagem: item.image_url, ...r }
    await supabase.rpc('postar_interacao', { p_token_id: token.id, p_character_id: characterId, p_acao: acao })
  }

  // Quem a atividade atinge.
  function alvosDe(a: Atividade): ObjetoCena[] {
    const tokens = objetos.filter((o) => o.layer !== 'mapa' && (souMestre || o.layer !== 'mestre'))
    switch (a.ativacao.alvos) {
      case 'quem_tocou': return meuToken ? [meuToken] : []
      case 'jogadores': return tokens.filter((o) => o.character_id)
      case 'todos': return tokens
      case 'mira': return tokens.filter((o) => meusAlvos.includes(o.id))
      default: return []
    }
  }

  // O jogador nem recebe a DT: quem diz se passou é o banco (passou_no_teste). O mestre confere aqui.
  async function testar(nome: string, t: { pericia: string; atributo: string; dt?: number | null }, atividadeId: string) {
    const base = characterId ? await sistema.testeDoPersonagem(characterId, t.pericia, t.atributo) : null
    const teste: TesteDoPersonagem = base ?? { nome: t.pericia || nome, dados: 1, bonus: 0 }
    const r = teste.rolar ? teste.rolar() : sistema.rolarTeste(teste)
    let passou = passouNoTeste(r.total, t.dt)
    if (!souMestre) {
      const { data, error } = await supabase.rpc('passou_no_teste', { p_token_id: token.id, p_atividade_id: atividadeId, p_total: r.total })
      passou = !error && !!data
    }
    return { nome: teste.nome, ...r, dt: null, passou }
  }

  // Dano/cura num alvo, com as resistências dele (dano) ou até o máximo (cura).
  async function aplicar(a: Atividade, alvo: ObjetoCena, valor: number, tipoOuRecurso: string, cura: boolean): Promise<string> {
    const d = await dadosDoAlvo(alvo.id)
    if (!d) return 'sem ficha'
    if (cura) {
      const recurso = tipoOuRecurso as Recurso
      const max = await maximoDoAlvo(d, recurso)
      const { error } = await supabase.rpc('aplicar_por_item', { p_token_id: token.id, p_atividade_id: a.id, p_alvo_token: alvo.id, p_recurso: recurso, p_valor: -valor, p_maximo: max })
      return error ? motivo(error)! : `+${valor} ${recurso.toUpperCase()}`
    }
    const r = danoNoAlvo([{ valor, tipo: tipoOuRecurso }], perfilDoAlvo(d))
    for (const [recurso, v] of [['pv', r.pv], ['san', r.san]] as const) {
      if (!v) continue
      const { error } = await supabase.rpc('aplicar_por_item', { p_token_id: token.id, p_atividade_id: a.id, p_alvo_token: alvo.id, p_recurso: recurso, p_valor: v, p_maximo: null })
      if (error) return motivo(error)!
    }
    const partes = [r.pv ? `−${r.pv} PV` : '', r.san ? `−${r.san} ${sistema.recursos.find((x) => x.id === 'san')?.rotulo === 'PD' ? 'PD' : 'SAN'}` : ''].filter(Boolean).join(' ')
    return partes || (r.motivos.length ? r.motivos.join(', ') : 'sem dano')
  }

  // Roda uma atividade e o que vem depois dela.
  async function rodar(a: Atividade, lista: Atividade[], jaRodaram: Set<string>) {
    jaRodaram.add(a.id)
    // Tem teste: pergunta antes (a pessoa pode não querer). Desistir não gasta nada.
    const teste = testeDe(a)
    if (teste) {
      const ok = await new Promise<boolean>((resolver) => setPedido({ atividade: a, rotulo: rotuloDoTeste(teste, sistema.atributos), dt: teste.dt, resolver }))
      if (vivo.current) setPedido(null)
      if (!ok) {
        if (jaRodaram.size === 1) setLog((l) => [...l, `${a.nome}: desistiu`])
        return
      }
    }
    const { error } = await supabase.rpc('usar_atividade', { p_token_id: token.id, p_atividade_id: a.id })
    if (error) {
      setErro(motivo(error))
      return
    }
    let passou: boolean | null = null
    const nome = a.nome
    const extra = a.textoChat ? ` ${a.textoChat}` : ''

    // "Ao Passar no Teste": rola o teste primeiro; falhou, a atividade não acontece.
    if (a.ativacao.quando === 'teste' && teste) {
      const t = await testar(nome, teste, a.id)
      await postar({ atividade: nome, texto: `tentou ${nome} (${item?.name ?? 'item'}).${extra}`, teste: t })
      setLog((l) => [...l, `${nome}: ${t.total} → ${t.passou ? 'passou' : 'falhou'}`])
      if (!t.passou) {
        for (const p of proximas(a, false, lista, jaRodaram)) {
          if (!vivo.current) return
          await rodar(p, lista, jaRodaram)
        }
        return
      }
      passou = true
    }

    switch (a.tipo) {
      case 'checar': {
        if (passou) break // o teste já foi o de "Ao Passar no Teste"
        const t = await testar(nome, a.checar!, a.id)
        passou = t.passou
        await postar({ atividade: nome, texto: `tentou ${nome} (${item?.name ?? 'item'}).${extra}`, teste: t })
        setLog((l) => [...l, `${nome}: ${t.total} → ${t.passou ? 'passou' : 'falhou'}`])
        break
      }
      case 'ritual': {
        const r = a.ritual!
        const t = await testar(nome, r.evitar, a.id)
        passou = t.passou
        await postar({ atividade: nome, texto: `ativou ${sistema.magia.nome.toLowerCase()} ${r.ritual || nome} (${item?.name ?? 'item'}); teste pra evitar.${extra}`, teste: t })
        setLog((l) => [...l, `${r.ritual || nome}: ${t.passou ? 'evitou' : 'não evitou'}`])
        break
      }
      case 'ataque': {
        const x = a.ataque!
        const ataque = { nome, dados: 1, bonus: x.bonus, margem: 20, multiplicador: 2, partes: x.dano ? [{ formula: x.dano, tipo: x.tipoDano }] : [], bonus_dano: 0, corpo: x.alcance === 'corpo' }
        const rol = rolarAtaque(ataque)
        const alvos = alvosDe(a)
        const linhas: { nome: string; texto: string }[] = []
        let acertou = false
        const dano = ataque.partes.length ? rolarDanoDoAtaque(ataque, rol.critico) : null
        for (const alvo of alvos) {
          const d = await dadosDoAlvo(alvo.id)
          const def = d ? defesaDoAlvo(d) : null
          const acerto = def === null || rol.total >= def
          acertou ||= acerto
          linhas.push({ nome: alvo.name ?? 'Alvo', texto: acerto ? (dano ? await aplicar(a, alvo, dano.total, x.tipoDano, false) : 'acertou') : 'errou' })
        }
        passou = acertou
        await postar({ atividade: nome, texto: `${nome} (${item?.name ?? 'item'}) atacou${alvos.length ? '' : ' (sem alvo)'}.${extra}`, rolagem: { rotulo: `Ataque${rol.critico ? ' (crítico!)' : ''}`, total: rol.total, dados: rol.rolls.map((v) => ({ sides: 20, value: v })) }, alvos: linhas })
        setLog((l) => [...l, `${nome}: ${rol.total} → ${acertou ? 'acertou' : 'errou'}`])
        break
      }
      case 'dano':
      case 'cura': {
        const cura = a.tipo === 'cura'
        const formula = cura ? a.cura!.formula : a.dano!.formula
        const r = rolarCura(formula)
        if (!r) {
          setErro(`Não deu pra rolar "${formula}".`)
          return
        }
        const linhas: { nome: string; texto: string }[] = []
        for (const alvo of alvosDe(a)) linhas.push({ nome: alvo.name ?? 'Alvo', texto: await aplicar(a, alvo, r.total, cura ? a.cura!.recurso : a.dano!.tipoDano, cura) })
        await postar({ atividade: nome, texto: `${nome} (${item?.name ?? 'item'}) ${cura ? 'curou' : 'causou dano'}.${extra}`, rolagem: { rotulo: `${cura ? 'Cura' : 'Dano'}: ${formula}`, total: r.total, dados: r.dados }, alvos: linhas })
        setLog((l) => [...l, `${nome}: ${r.total}`])
        break
      }
      case 'conteiner':
        await carregar()
        setConteudoAberto(true)
        await postar({ atividade: nome, texto: `abriu ${item?.name ?? 'o item'}.${extra}` })
        setLog((l) => [...l, `${nome}: aberto`])
        break
      case 'documento':
        setDocumento(true)
        await postar({ atividade: nome, texto: `leu ${item?.name ?? 'o item'}.${extra}` })
        break
      case 'sumonar': {
        const s = a.sumonar!
        await postar({ atividade: nome, texto: `${item?.name ?? 'O item'} fez surgir ${s.quantidade}× ${s.ameaca || 'ameaça'}! (o mestre coloca na mesa)${extra}` })
        setLog((l) => [...l, `${nome}: ${s.quantidade}× ${s.ameaca}`])
        break
      }
      case 'transformar': {
        const t = a.transformar!
        if (meuToken && t.imagem) {
          const { error: e2 } = await supabase.rpc('trocar_variacao', { p_token_id: meuToken.id, p_url: t.imagem, p_altura: null })
          if (e2) setErro(motivo(e2))
        }
        await postar({ atividade: nome, texto: `foi transformado por ${item?.name ?? 'um item'}${t.duracao ? ` (${t.duracao})` : ''}.${extra}` })
        break
      }
    }

    for (const p of proximas(a, temTeste(a) ? passou : null, lista, jaRodaram)) {
      if (!vivo.current) return
      await rodar(p, lista, jaRodaram)
    }
  }

  async function clicar(a: Atividade) {
    if (!item) return
    setErro(null)
    setOcupado(true)
    try {
      await rodar(a, item.atividades, new Set())
      await carregar()
    } finally {
      if (vivo.current) setOcupado(false)
    }
  }

  async function pegar(c: ItemDoToken['conteudo_detalhado'][number], quantos = 1) {
    if (!characterId) {
      setErro('Pra pegar itens, você precisa de um personagem com ficha.')
      return
    }
    setOcupado(true)
    const { error } = await supabase.rpc('pegar_do_conteiner', { p_token_id: token.id, p_ref: c.item_id ?? c.compendio_id, p_character_id: characterId, p_quantidade: quantos })
    if (error) setErro(motivo(error))
    else {
      const qual = quantos > 1 ? `${quantos}× ${c.name}` : c.name
      await postar({ atividade: 'Pegar', texto: `pegou ${qual}.` })
      setLog((l) => [...l, `Pegou ${qual} (foi pro inventário)`])
      await carregar()
    }
    if (vivo.current) setOcupado(false)
  }

  const botoes = item ? botoesDaInteracao(item.atividades) : []
  // Item lootável (ou artefato, ou marcado "vai pro inventário") no mapa: dá pra pegar direto,
  // encostado no item (alcance Toque), sem precisar criar atividade.
  const pegavel = !!item && (item.categoria === 'lootavel' || item.categoria === 'amaldicoado' || !!item.efeitos?.inventario)
  const loja = item?.categoria === 'loja'
  const modoLoja = item?.detalhes?.loja?.modo ?? 'ambos'
  const curto = sistema.alcances.find((x) => x.id === 'curto')?.metros ?? 9
  const pertoDaLoja = souMestre || dentroDoAlcance(distancia, curto)

  async function carregarSituacao() {
    if (!characterId) return
    const { data } = await supabase.rpc('situacao_de_compra', { p_character_id: characterId })
    if (vivo.current && data) setSituacao(data as Situacao)
  }

  async function abrirLoja() {
    setLojaAberta(true)
    await carregarSituacao()
  }

  // Comprar (dinheiro) ou requisitar (patente); o banco confere tudo e desconta.
  async function comprar(c: EntradaDetalhada, forma: 'requisicao' | 'dinheiro') {
    if (!characterId) {
      setErro(souMestre ? 'O mestre não tem ficha: teste com o personagem de um jogador.' : 'Pra comprar, você precisa de um personagem com ficha.')
      return
    }
    setOcupado(true)
    setErro(null)
    const { error } = await supabase.rpc('comprar_da_loja', { p_token_id: token.id, p_ref: c.item_id ?? c.compendio_id, p_character_id: characterId, p_quantidade: 1, p_forma: forma })
    if (error) setErro(motivo(error))
    else {
      const texto = forma === 'dinheiro' && c.preco != null ? `comprou ${c.name} por ${formatarDinheiro(c.preco, sistema.moeda.simbolo)} (${item?.name ?? 'loja'}).` : `requisitou ${c.name} (${item?.name ?? 'loja'}).`
      await postar({ atividade: forma === 'dinheiro' ? 'Comprar' : 'Requisitar', texto })
      setLog((l) => [...l, forma === 'dinheiro' ? `Comprou ${c.name}` : `Requisitou ${c.name}`])
      await Promise.all([carregar(), carregarSituacao()])
    }
    if (vivo.current) setOcupado(false)
  }
  const toque = sistema.alcances.find((x) => x.id === 'toque')?.metros ?? 1.5
  const pertoPraPegar = souMestre || dentroDoAlcance(distancia, toque)

  // Coletar Item (botão direito): pega assim que o item carregar, se der.
  const jaColetou = useRef(false)
  useEffect(() => {
    if (!coletarAoAbrir || !item || jaColetou.current) return
    jaColetou.current = true
    if (!pegavel) setErro('Isso não dá pra pegar.')
    else if (!pertoPraPegar) setErro('Chegue mais perto pra pegar (Toque).')
    else pegarDoChao()
  })

  async function pegarDoChao() {
    if (!item) return
    if (!characterId) {
      setErro(souMestre ? 'O mestre não tem ficha: teste com o personagem de um jogador.' : 'Pra pegar itens, você precisa de um personagem com ficha.')
      return
    }
    setOcupado(true)
    setErro(null)
    const coleta = item.efeitos?.coleta
    // Criado do objeto (por pessoa / infinito): cada um pega um. Sem isso, pega tudo de uma vez.
    const qual = !coleta && item.quantidade > 1 ? `${item.quantidade}× ${item.name}` : item.name
    // Registra antes quando o item sai do mapa ao ser pego; senão, só depois de dar certo.
    const saiDoMapa = !coleta || (coleta === 'porPessoa' && item.quantidade <= 1)
    if (saiDoMapa) await postar({ atividade: 'Pegar', texto: `pegou ${qual}.` })
    const { error } = await supabase.rpc('pegar_item_do_chao', { p_token_id: token.id, p_character_id: characterId })
    if (!error && !saiDoMapa) await postar({ atividade: 'Pegar', texto: `pegou ${qual}.` })
    if (error) {
      setErro(motivo(error))
      if (vivo.current) setOcupado(false)
      return
    }
    onFechar()
  }

  return (
    <Janela titulo={item?.name ?? token.name ?? 'Item'} icone={faBriefcase} largura={420} inicial={{ x: Math.max(16, window.innerWidth / 2 - 210), y: 90 }} className="janela-interacao" onFechar={onFechar}>
      {!item && !erro && <p className="item-vazio">Abrindo…</p>}
      {item && (
        <div className="interacao">
          <div className="interacao-topo">
            <span className="interacao-imagem">{item.image_url ? <img src={item.image_url} alt="" /> : <FontAwesomeIcon icon={faBriefcase} />}</span>
            {item.descricao && <div className="interacao-descricao" dangerouslySetInnerHTML={{ __html: sanitizarHtml(item.descricao) }} />}
          </div>

          {pedido && (
            <section className="interacao-pedido" role="alertdialog" aria-label={pedido.rotulo}>
              <p>Pra <strong>{pedido.atividade.nome}</strong>, você precisa fazer um <strong>{pedido.rotulo}</strong>{souMestre && pedido.dt !== null ? ` (DT ${pedido.dt})` : ''}.</p>
              <div className="interacao-pedido-botoes">
                <button type="button" className="janela-botao janela-botao-destaque" onClick={() => pedido.resolver(true)}>
                  <FontAwesomeIcon icon={faDiceD20} /> Rolar {pedido.rotulo}
                </button>
                <button type="button" className="janela-botao" onClick={() => pedido.resolver(false)}>
                  <FontAwesomeIcon icon={faXmark} /> Cancelar
                </button>
              </div>
            </section>
          )}
          {!pedido && loja && !lojaAberta && (
            <div className="interacao-acoes">
              <button type="button" className="interacao-acao" disabled={ocupado || !pertoDaLoja} title={pertoDaLoja ? 'Abrir Loja' : 'Chegue mais perto (Curto)'} onClick={abrirLoja}>
                <FontAwesomeIcon icon={faStore} />
                <span>Abrir Loja</span>
                {!pertoDaLoja && <small><FontAwesomeIcon icon={faLock} /> Chegue mais perto (Curto)</small>}
              </button>
            </div>
          )}
          {!pedido && pegavel && (
            <div className="interacao-acoes">
              <button
                type="button"
                className="interacao-acao"
                disabled={ocupado || !pertoPraPegar}
                title={pertoPraPegar ? 'Pegar (vai pro inventário)' : 'Chegue mais perto (Toque)'}
                onClick={pegarDoChao}
              >
                <FontAwesomeIcon icon={faHandHolding} />
                <span>Pegar{item.efeitos?.coleta === 'infinito' ? ' (∞)' : item.efeitos?.coleta === 'porPessoa' ? ` (restam ${item.quantidade})` : item.quantidade > 1 ? ` (${item.quantidade})` : ''}</span>
                {!pertoPraPegar && <small><FontAwesomeIcon icon={faLock} /> Chegue mais perto (Toque)</small>}
              </button>
            </div>
          )}
          {!pedido && botoes.length > 0 && (
            <div className="interacao-acoes">
              {botoes.map((a) => {
                const longe = !alcanceOk(a)
                const acabou = semUsos(a)
                const rotuloAlcance = sistema.alcances.find((x) => x.id === a.ativacao.alcance)?.rotulo
                return (
                  <button
                    key={a.id}
                    type="button"
                    className="interacao-acao"
                    disabled={ocupado || longe || acabou}
                    title={acabou ? 'Sem usos' : longe ? `Chegue mais perto (alcance: ${rotuloAlcance})` : a.nome}
                    onClick={() => clicar(a)}
                  >
                    {a.icone ? <img src={a.icone} alt="" /> : <FontAwesomeIcon icon={ICONE_ATIVIDADE[a.tipo]} />}
                    <span>{a.nome}{testeDe(a) ? <em className="interacao-acao-teste"> · {rotuloDoTeste(testeDe(a)!, sistema.atributos)}</em> : null}</span>
                    {(longe || acabou) && <small><FontAwesomeIcon icon={faLock} /> {acabou ? 'Sem usos' : `Chegue mais perto (${rotuloAlcance})`}</small>}
                  </button>
                )
              })}
            </div>
          )}
          {!botoes.length && !pegavel && !loja && !conteudoAberto && <p className="item-vazio">Nada pra fazer aqui.</p>}
          {!meuToken && !souMestre && <p className="item-dica">Você precisa de um token seu nesta cena pra interagir.</p>}

          {log.length > 0 && (
            <ul className="interacao-log">
              {log.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          )}

          {lojaAberta && (
            <section className="interacao-conteudo vitrine">
              <h3>{item.name}</h3>
              {situacao && (
                <div className="vitrine-situacao">
                  {/* Patente (ícone da ficha) e os itens por categoria: carrega / limite. */}
                  {modoLoja !== 'dinheiro' && (() => {
                    const pat = patenteOf(situacao.patente)
                    return (
                      <div className="vitrine-patente" title={`Patente: ${pat.label}`}>
                        <img src={pat.icon} alt="" />
                        <span>{pat.label}</span>
                      </div>
                    )
                  })()}
                  {modoLoja !== 'dinheiro' && (
                    <div className="vitrine-categorias" title="Itens que você carrega / limite da patente, por categoria">
                      {['I', 'II', 'III', 'IV'].map((k) => {
                        const c = situacao.categorias[k] ?? { atual: 0, limite: 0 }
                        const estado = c.atual > c.limite ? ' passou' : c.atual === c.limite ? ' cheio' : ''
                        return (
                          <span key={k} className={`vitrine-categoria${estado}${!c.limite && !c.atual ? ' vazia' : ''}`}>
                            <b>{k}</b>
                            <small>{c.atual}/{c.limite}</small>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <div className="vitrine-numeros">
                    {situacao.carga_maxima != null && (() => {
                      const carga = Number(situacao.carga ?? 0)
                      const max = Number(situacao.carga_maxima)
                      return (
                        <span className={`vitrine-carga${carga > max ? ' passou' : ''}`} title={`Carga: ${carga} de ${max} (sobra ${Math.max(0, max - carga)})`}>
                          <FontAwesomeIcon icon={faWeightHanging} /> {carga}/{max}
                        </span>
                      )
                    })()}
                    {modoLoja !== 'requisicao' && (
                      <span className="vitrine-dinheiro" title={sistema.moeda.nome}><FontAwesomeIcon icon={faCoins} /> {formatarDinheiro(Number(situacao.dinheiro), sistema.moeda.simbolo)}</span>
                    )}
                  </div>
                </div>
              )}
              {item.conteudo_detalhado.length ? (
                <ul>
                  {item.conteudo_detalhado.map((c) => {
                    const cat = c.categoria ?? '0'
                    const lim = situacao?.categorias[cat]
                    const semVaga = !!lim && lim.atual >= lim.limite
                    const caro = c.preco != null && !!situacao && Number(situacao.dinheiro) < c.preco
                    return (
                      <li key={c.item_id ?? c.compendio_id}>
                        <span className="interacao-conteudo-imagem">{c.image_url ? <img src={c.image_url} alt="" /> : <FontAwesomeIcon icon={faBriefcase} />}</span>
                        <span className="interacao-conteudo-nome">
                          {c.name}
                          <small>{[sistema.categoriasDeItem.length ? `Categoria ${cat}` : '', c.ilimitado ? '∞' : `×${c.quantidade}`].filter(Boolean).join(' · ')}</small>
                        </span>
                        <span className="interacao-conteudo-botoes">
                          {modoLoja !== 'dinheiro' && (
                            <button type="button" className="janela-botao" disabled={ocupado || semVaga} title={semVaga ? `Sua patente não libera mais itens de categoria ${cat}` : 'Requisitar'} onClick={() => comprar(c, 'requisicao')}>Requisitar</button>
                          )}
                          {modoLoja !== 'requisicao' && c.preco != null && (
                            <button type="button" className="janela-botao" disabled={ocupado || caro} title={caro ? 'Dinheiro insuficiente' : 'Comprar'} onClick={() => comprar(c, 'dinheiro')}>{formatarDinheiro(c.preco, sistema.moeda.simbolo)}</button>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : <p className="item-vazio">Nada à venda.</p>}
            </section>
          )}

          {conteudoAberto && (
            <section className="interacao-conteudo">
              <h3>Conteúdo</h3>
              {item.conteudo_detalhado.length ? (
                <ul>
                  {item.conteudo_detalhado.map((c) => (
                    <li key={c.item_id ?? c.compendio_id}>
                      <span className="interacao-conteudo-imagem">{c.image_url ? <img src={c.image_url} alt="" /> : <FontAwesomeIcon icon={faBriefcase} />}</span>
                      <span className="interacao-conteudo-nome">{c.name}{c.quantidade > 1 ? ` ×${c.quantidade}` : ''}</span>
                      <span className="interacao-conteudo-botoes">
                        <button type="button" className="janela-botao" disabled={ocupado} onClick={() => pegar(c)}><FontAwesomeIcon icon={faHandHolding} /> Pegar</button>
                        {c.quantidade > 1 && <button type="button" className="janela-botao" disabled={ocupado} onClick={() => pegar(c, c.quantidade)}>Pegar Tudo</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="item-vazio">Vazio.</p>}
            </section>
          )}

          {documento && (
            <section className="interacao-documento">
              {item.efeitos?.imagem && <img src={item.efeitos.imagem} alt="" />}
              {item.efeitos?.documento && <div dangerouslySetInnerHTML={{ __html: sanitizarHtml(item.efeitos.documento) }} />}
              {!item.efeitos?.imagem && !item.efeitos?.documento && <p className="item-vazio">Não tem nada escrito.</p>}
            </section>
          )}
        </div>
      )}
      {erro && <p className="chat-acao-erro" role="alert">{erro}</p>}
    </Janela>
  )
}
