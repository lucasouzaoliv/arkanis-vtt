import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAnglesLeft, faAnglesRight, faChevronLeft, faChevronRight, faComment, faDiceD20, faPenToSquare, faPlus, faSkull } from '@fortawesome/free-solid-svg-icons'
import { supabase } from '../../lib/supabase'
import { lerPericias, lerTeste, rolarDano, rolarTeste } from './combate'
import type { Rolagem } from './chat'
import { ataqueDaCriatura, textoDosAlvos, type Alvo, type AtaqueDaAcao } from './mira'
import CondicoesDaAmeaca from './CondicoesDaAmeaca'
import { defesaDeCondicoes, penalidadeDeCondicoes, rotuloComCondicoes, type ContextoDoTeste } from '../CharacterSheet/condicoes'
import { lerCondicoesPersonalizadas, type CondicaoPersonalizada } from '../CharacterSheet/efeitosEscolhidos'

type Acao = { nome: string; tipo?: string; teste?: string; dano?: string; descricao?: string }

type Criatura = {
  id: string
  name: string
  vd: number | null
  image_url: string | null
  tipo_criatura: string | null
  tamanho: string | null
  pv_maximo: number | null
  defesa: number | null
  deslocamento: string | null
  atributos: Record<string, number> | null
  percepcao: string | null
  iniciativa: string | null
  fortitude: string | null
  reflexos: string | null
  vontade: string | null
  pericias: string | null
  resistencias: string | null
  vulnerabilidades: string | null
  descritores: string[] | null
  presenca_dt: number | null
  presenca_dano: string | null
  presenca_nex_imune: number | null
  acoes: Acao[] | null
  habilidades: Acao[] | null
  enigma_medo: string | null
  owner_id: string | null
  flavor_text: string | null
  description: string | null
}

type Aba = 'status' | 'combate' | 'descricao'

const ATRIBUTOS = ['agi', 'for', 'int', 'pre', 'vig']
const ATRIBUTO_DA_SIGLA: Record<string, string> = { agi: 'agilidade', for: 'forca', int: 'intelecto', pre: 'presenca', vig: 'vigor' }
// Atributo de cada perícia (livro), pra condição que pesa em atributo (Fraco, Frustrado…) valer no teste da ameaça.
const ATRIBUTO_DA_PERICIA: Record<string, string> = {
  acrobacia: 'agilidade', crime: 'agilidade', furtividade: 'agilidade', iniciativa: 'agilidade', pilotagem: 'agilidade', pontaria: 'agilidade', reflexos: 'agilidade',
  atletismo: 'forca', luta: 'forca',
  atualidades: 'intelecto', ciencias: 'intelecto', investigacao: 'intelecto', medicina: 'intelecto', ocultismo: 'intelecto', profissao: 'intelecto', sobrevivencia: 'intelecto', tatica: 'intelecto', tecnologia: 'intelecto',
  adestramento: 'presenca', artes: 'presenca', diplomacia: 'presenca', enganacao: 'presenca', intimidacao: 'presenca', intuicao: 'presenca', percepcao: 'presenca', religiao: 'presenca', vontade: 'presenca',
  fortitude: 'vigor',
}
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const contextoDaPericia = (nome: string): ContextoDoTeste => ({ atributo: ATRIBUTO_DA_PERICIA[semAcento(nome)] ?? null, pericia: nome })

// Ficha de Ameaça (12.4): cabeçalho, Vida com as setas e as abas Status / Combate / Descrição.
// O mestre rola atributos, perícias, testes e danos e manda ações/poderes pro chat
// (podeRolar); na escolha de ameaças ela é só pra ver, com o botão Adicionar no rodapé.
export default function FichaAmeaca({ criaturaId, pvAtual, pvMax, condicoes = [], condicoesPersonalizadas, onMudarCondicoes, podeEditar, podeRolar = false, nome, onMudarPv, onRolar, onMostrar, onAdicionar, alvos = [], onAtacar, meuId, onEditar }: {
  criaturaId: string
  pvAtual: number | null
  pvMax?: number | null
  // Condições e efeitos desta ameaça na mesa (18/10); sem onMudarCondicoes é só pra ver.
  condicoes?: string[]
  condicoesPersonalizadas?: unknown
  onMudarCondicoes?: (condicoes: string[], personalizadas: CondicaoPersonalizada[]) => void
  podeEditar: boolean
  podeRolar?: boolean
  nome?: string
  onMudarPv?: (pv: number) => void
  onRolar?: (rolagem: Rolagem, autor: { nome: string; foto: string | null }) => void
  // Manda uma ação/poder pro chat (nome, tipo, teste, dano e descrição).
  onMostrar?: (html: string, autor: { nome: string; foto: string | null }) => void
  onAdicionar?: () => void
  // Mira (12.9): com alvos marcados, o teste de uma ação com dano vira ataque no chat.
  alvos?: Alvo[]
  onAtacar?: (ataque: AtaqueDaAcao, autor: { nome: string; foto: string | null }) => void
  // Homebrew do próprio mestre: Editar abre o editor.
  meuId?: string
  onEditar?: (criaturaId: string) => void
}) {
  const [c, setC] = useState<Criatura | null>(null)
  const [aba, setAba] = useState<Aba>('status')
  const [subaba, setSubaba] = useState<'acoes' | 'poderes'>('acoes')

  useEffect(() => {
    const carregar = () => supabase.from('creatures').select('*').eq('id', criaturaId).single().then(({ data }) => setC(data as Criatura | null))
    carregar()
    // Homebrew editada: a ficha aberta acompanha.
    const editada = (e: Event) => (e as CustomEvent<string>).detail === criaturaId && carregar()
    window.addEventListener('arkanis-ameaca-salva', editada)
    return () => window.removeEventListener('arkanis-ameaca-salva', editada)
  }, [criaturaId])

  if (!c) return <p className="mesa-painel-vazio">Carregando…</p>

  const maximo = pvMax ?? c.pv_maximo ?? 0
  const pv = pvAtual ?? maximo
  const mudar = (d: number) => onMudarPv?.(Math.max(0, Math.min(maximo || Infinity, pv + d)))
  const autor = { nome: nome ?? c.name, foto: c.image_url }

  const proprias = lerCondicoesPersonalizadas(condicoesPersonalizadas)
  // Condição que tira (ou dá) dado no teste: vale sozinha e a rolagem diz por quê.
  function comCondicoes(t: { dados: number; bonus: number }, contexto: ContextoDoTeste) {
    const p = penalidadeDeCondicoes(condicoes, contexto, proprias)
    return { teste: { dados: t.dados + p.dados, bonus: t.bonus + p.valor }, motivos: p.motivos }
  }

  function rolarPericia(rotulo: string, texto: string, contexto: ContextoDoTeste = { atributo: null }) {
    if (!podeRolar || !onRolar) return
    const { teste: t, motivos } = comCondicoes(lerTeste(texto), contexto)
    const r = rolarTeste(t)
    onRolar({
      label: `${rotuloComCondicoes(rotulo, motivos)} (${nome ?? c!.name})`, total: r.total, bonus: r.bonus,
      detail: `d20 mantido: ${r.kept} (rolados: ${r.rolls.join(', ')}) + ${r.bonus}`,
      dice: r.rolls.map((v) => ({ sides: 20, value: v, discarded: v !== r.kept })),
    }, autor)
  }

  // Ação com teste e dano, com alvo marcado: manda "[Ameaça] está atacando [Alvo]" pro chat.
  function testarAcao(a: Acao) {
    const ataque = alvos.length && a.dano && onAtacar ? ataqueDaCriatura(a.nome, a.teste ?? '', a.dano) : null
    if (ataque && podeRolar) {
      const { teste, motivos } = comCondicoes(ataque, { atributo: null, ataque: ataque.corpo === false ? 'distancia' : 'corpo' })
      onAtacar!({ ...ataque, ...teste, nome: rotuloComCondicoes(ataque.nome, motivos) }, autor)
    } else rolarPericia(`Teste: ${a.nome}`, a.teste ?? '', a.dano ? { atributo: null, ataque: /bal[ií]stic|disparo|dist[âa]ncia|arremess|tiro/i.test(`${a.nome} ${a.teste ?? ''} ${a.dano}`) ? 'distancia' : 'corpo' } : { atributo: null })
  }

  function rolarDanoDaAcao(a: Acao) {
    if (!a.dano) return
    rolarDanoTexto(`Dano: ${a.nome}`, a.dano)
  }

  function rolarDanoTexto(rotulo: string, texto: string) {
    if (!podeRolar || !onRolar) return
    const d = rolarDano(texto)
    if (!d) return
    onRolar({ label: `${rotulo}${d.tipo ? ` (${d.tipo})` : ''}`, total: d.total, bonus: 0, detail: d.detalhe, dice: null }, autor)
  }

  // Teste de atributo: d20 igual ao valor do atributo, fica com o maior (igual à ficha).
  function rolarAtributo(sigla: string, valor: number) {
    rolarPericia(`Teste de ${sigla.toUpperCase()}`, `+0 (${valor}d20)`, { atributo: ATRIBUTO_DA_SIGLA[sigla] ?? null })
  }

  function mostrar(a: Acao) {
    if (!onMostrar) return
    const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)
    const linhas = [
      `<b>${esc(a.tipo ? `${a.tipo.toUpperCase()} - ${a.nome}` : a.nome)}</b>`,
      a.teste ? `<b>Teste:</b> ${esc(a.teste)}` : '',
      a.dano ? `<b>Dano:</b> ${esc(a.dano)}` : '',
      a.descricao ? esc(a.descricao) : '',
    ].filter(Boolean)
    onMostrar(linhas.join('<br>'), autor)
  }

  const dado = (onClick: () => void, rotulo: string) => (
    <button type="button" className="ficha-ameaca-dado" disabled={!podeRolar} aria-label={rotulo} title={podeRolar ? rotulo : undefined} onClick={onClick}>
      <FontAwesomeIcon icon={faDiceD20} />
    </button>
  )

  const testes: [string, string | null][] = [
    ['Percepção', c.percepcao], ['Iniciativa', c.iniciativa], ['Fortitude', c.fortitude], ['Reflexos', c.reflexos], ['Vontade', c.vontade],
  ]
  const lista = subaba === 'acoes' ? c.acoes ?? [] : c.habilidades ?? []

  return (
    <div className="ficha-ameaca">
      <header className="ficha-ameaca-topo">
        <div className="ficha-ameaca-foto">{c.image_url ? <img src={c.image_url} alt="" /> : <FontAwesomeIcon icon={faSkull} />}</div>
        <div>
          <h3>{nome ?? c.name}</h3>
          <p>VD: {c.vd ?? '—'}</p>
          <p>{[c.tipo_criatura, c.tamanho].filter(Boolean).join(' - ')}</p>
        </div>
        {onEditar && meuId && c.owner_id === meuId && (
          <button type="button" className="combate-icone ficha-ameaca-editar" aria-label="Editar ameaça" title="Editar (Homebrew)" onClick={() => onEditar(c.id)}>
            <FontAwesomeIcon icon={faPenToSquare} />
          </button>
        )}
      </header>

      {maximo > 0 && (
        <div className="ficha-ameaca-vida">
          {podeEditar && onMudarPv && (
            <>
              <button type="button" aria-label="Menos 5" onClick={() => mudar(-5)}><FontAwesomeIcon icon={faAnglesLeft} /></button>
              <button type="button" aria-label="Menos 1" onClick={() => mudar(-1)}><FontAwesomeIcon icon={faChevronLeft} /></button>
            </>
          )}
          <div className="ficha-ameaca-barra">
            <span style={{ width: `${Math.min(100, (pv / maximo) * 100)}%` }} />
            <strong>{pv}/{maximo}</strong>
          </div>
          {podeEditar && onMudarPv && (
            <>
              <button type="button" aria-label="Mais 1" onClick={() => mudar(1)}><FontAwesomeIcon icon={faChevronRight} /></button>
              <button type="button" aria-label="Mais 5" onClick={() => mudar(5)}><FontAwesomeIcon icon={faAnglesRight} /></button>
            </>
          )}
        </div>
      )}

      <CondicoesDaAmeaca condicoes={condicoes} personalizadas={condicoesPersonalizadas} podeEditar={podeEditar && !!onMudarCondicoes} onMudar={onMudarCondicoes} />

      <nav className="janela-abas ficha-ameaca-abas" role="tablist">
        {(['status', 'combate', 'descricao'] as Aba[]).map((a) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} className={aba === a ? 'ativa' : undefined} onClick={() => setAba(a)}>
            {a === 'status' ? 'Status' : a === 'combate' ? 'Combate' : 'Descrição'}
          </button>
        ))}
      </nav>

      <div className="ficha-ameaca-corpo">
        {aba === 'status' && (
          <>
            {c.atributos && (
              <div className="ficha-ameaca-atributos">
                {ATRIBUTOS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="ficha-ameaca-atributo"
                    disabled={!podeRolar}
                    title={podeRolar ? `Rolar teste de ${k.toUpperCase()}` : undefined}
                    onClick={() => rolarAtributo(k, c.atributos?.[k] ?? 0)}
                  >
                    <span>{k.toUpperCase()}</span><strong>{c.atributos?.[k] ?? 0}</strong>
                  </button>
                ))}
              </div>
            )}
            <dl className="ficha-ameaca-lista">
              {c.defesa !== null && (() => {
                const d = defesaDeCondicoes(condicoes, proprias)
                return <><dt>Defesa</dt><dd title={d.motivos.join(', ') || undefined}>{c.defesa + d.valor}{d.valor ? <small className="ficha-ameaca-motivo"> ({c.defesa} {d.motivos.join(', ')})</small> : null}</dd></>
              })()}
              {c.deslocamento && <><dt>Deslocamento</dt><dd>{c.deslocamento}</dd></>}
            </dl>
            <h4 className="ficha-ameaca-titulo">Perícias</h4>
            <ul className="ficha-ameaca-pericias">
              {[...testes.filter(([, t]) => t), ...lerPericias(c.pericias).map((p) => [p.nome, p.teste] as [string, string])].map(([n, t]) => (
                <li key={n}>
                  <span>{n.toUpperCase()}</span>
                  <strong>{t}</strong>
                  {dado(() => rolarPericia(n, t ?? '', contextoDaPericia(n)), `Rolar ${n}`)}
                </li>
              ))}
            </ul>
            <dl className="ficha-ameaca-lista">
              {!!c.descritores?.length && <><dt>Elementos</dt><dd>{c.descritores.join(', ')}</dd></>}
              {c.resistencias && <><dt>Resistências</dt><dd>{c.resistencias}</dd></>}
              {c.vulnerabilidades && <><dt>Vulnerabilidades</dt><dd>{c.vulnerabilidades}</dd></>}
            </dl>
          </>
        )}

        {aba === 'combate' && (
          <>
            {c.presenca_dt && (
              <p className="ficha-ameaca-presenca">
                <strong>Presença Perturbadora:</strong> DT {c.presenca_dt}{c.presenca_dano ? ` - ${c.presenca_dano}` : ''}
                {c.presenca_nex_imune ? ` (NEX ${c.presenca_nex_imune}% imune)` : ''}
                {c.presenca_dano && rolarDano(c.presenca_dano) !== null && dado(() => rolarDanoTexto('Presença Perturbadora', c.presenca_dano!), 'Rolar dano da Presença Perturbadora')}
              </p>
            )}
            {podeRolar && onAtacar && alvos.length > 0 && (
              <p className="ficha-mira-aviso">Mirando: <strong>{textoDosAlvos(alvos)}</strong>. O teste das ações com dano vai pro chat como ataque.</p>
            )}
            <nav className="ficha-ameaca-subabas">
              <button type="button" className={subaba === 'acoes' ? 'ativa' : undefined} onClick={() => setSubaba('acoes')}>Ações</button>
              <button type="button" className={subaba === 'poderes' ? 'ativa' : undefined} onClick={() => setSubaba('poderes')}>Poderes</button>
            </nav>
            {lista.map((a, i) => (
              <details key={i} className="ficha-ameaca-acao">
                <summary>{a.tipo ? <span>{a.tipo.toUpperCase()} - </span> : null}{a.nome}</summary>
                {a.teste && (
                  <p className="ficha-ameaca-linha"><strong>Teste:</strong> {a.teste} {dado(() => testarAcao(a), alvos.length && a.dano && onAtacar ? `Atacar ${textoDosAlvos(alvos)} com ${a.nome}` : `Rolar teste de ${a.nome}`)}</p>
                )}
                {a.dano && (
                  <p className="ficha-ameaca-linha"><strong>Dano:</strong> {a.dano} {rolarDano(a.dano) !== null && dado(() => rolarDanoDaAcao(a), `Rolar dano de ${a.nome}`)}</p>
                )}
                {a.descricao && <p>{a.descricao}</p>}
                {podeRolar && onMostrar && (
                  <button type="button" className="mesa-botao ficha-ameaca-mostrar" onClick={() => mostrar(a)}>
                    <FontAwesomeIcon icon={faComment} /> Mostrar no chat
                  </button>
                )}
              </details>
            ))}
            {!lista.length && <p className="janela-dica">Nada cadastrado.</p>}
          </>
        )}

        {aba === 'descricao' && (
          <>
            <p className="ficha-ameaca-texto">{c.description || c.flavor_text || 'Sem descrição.'}</p>
            {c.enigma_medo && (
              <>
                <h4 className="ficha-ameaca-titulo">Enigma do Medo</h4>
                <p className="ficha-ameaca-texto">{c.enigma_medo}</p>
              </>
            )}
          </>
        )}
      </div>

      {onAdicionar && (
        <button type="button" className="janela-botao ficha-ameaca-adicionar" onClick={onAdicionar}>
          <FontAwesomeIcon icon={faPlus} /> Adicionar
        </button>
      )}
    </div>
  )
}
