import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBriefcase, faBurst, faChevronDown, faChevronRight, faCopy, faDiceD20, faEllipsisVertical, faFeatherPointed, faHandSparkles, faHeartPulse, faKey,
  faBoxOpen, faFileLines, faMasksTheater, faPenToSquare, faPlus, faSkull, faTrash, faWandSparkles, faWeightHanging, type IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import Janela from './Janela'
import MenuContexto, { type ItemMenu } from './MenuContexto'
import { useMostrarImagem } from './mostrarImagem'
import { EditorTexto } from './PainelPlaylist'
import { sanitizarHtml } from './chat'
import {
  ALVOS_ATIVIDADE, CATEGORIAS_ITEM, MODOS_LOJA, temTeste, CONSUMOS, DURACOES, FORMAS_AREA, QUANDO_DISPARA, QUEM_USA, RARIDADES, TIPOS_ATIVIDADE, TIPOS_ITEM,
  duplicarAtividade, etiquetasDoItem, novaAtividade, rotuloDaAtivacao, semAtividade, textoDeUsos,
  type Atividade, type DetalhesItem, type ItemMesa, type Teste, type TipoAtividade,
} from './itens'
import { enviarImagemDoItem } from './useItens'
import { BuscaCompendio, ICONE_COMPENDIO } from './EscolherDoCompendio'
import { supabase } from '../../lib/supabase'
import { sistemaDe, type Sistema } from '../../sistemas'

// O sistema da campanha (perícias, atributos, alcances…): os itens servem pra qualquer jogo.
const SistemaContexto = createContext<Sistema>(sistemaDe(null))

export const ICONE_ATIVIDADE: Record<TipoAtividade, IconDefinition> = {
  ataque: faBurst, ritual: faWandSparkles, checar: faDiceD20, dano: faBurst, cura: faHeartPulse, sumonar: faSkull, transformar: faMasksTheater,
  conteiner: faBoxOpen, documento: faFileLines,
}

type Aba = 'descricao' | 'detalhes' | 'atividades' | 'efeitos'
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'descricao', rotulo: 'Descrição' },
  { id: 'detalhes', rotulo: 'Detalhes' },
  { id: 'atividades', rotulo: 'Atividades' },
  { id: 'efeitos', rotulo: 'Efeitos' },
]

// Guarda as mudanças e grava juntas depois de um instante (digitar não manda uma por letra).
function useRascunho<T extends object>(original: T, salvar: (campos: Partial<T>) => void, espera = 500) {
  const [atual, setAtual] = useState(original)
  const pendente = useRef<Partial<T>>({})
  const timer = useRef<number | undefined>(undefined)
  const salvarRef = useRef(salvar)
  salvarRef.current = salvar
  const gravar = () => {
    window.clearTimeout(timer.current)
    if (Object.keys(pendente.current).length) salvarRef.current(pendente.current)
    pendente.current = {}
  }
  useEffect(() => gravar, []) // fecha a janela: grava o que faltou
  // Mudou lá fora (outra pessoa editando): pega o novo, menos o que ainda está pendente aqui.
  useEffect(() => setAtual((a) => ({ ...original, ...pendente.current, ...(a === original ? {} : {}) })), [original])
  const mudar = (campos: Partial<T>) => {
    setAtual((a) => ({ ...a, ...campos }))
    pendente.current = { ...pendente.current, ...campos }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(gravar, espera)
  }
  return [atual, mudar] as const
}

const numeroOuNulo = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v) || 0))

function SelectTeste({ teste, onMudar, rotuloDt = 'DT' }: { teste: Teste; onMudar: (t: Teste) => void; rotuloDt?: string }) {
  const sistema = useContext(SistemaContexto)
  return (
    <div className="item-teste">
      <label>
        <span>Perícia</span>
        <select value={teste.pericia} onChange={(e) => onMudar({ ...teste, pericia: e.target.value })}>
          <option value="">—</option>
          {sistema.pericias.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label>
        <span>Atributo</span>
        <select value={teste.atributo} onChange={(e) => onMudar({ ...teste, atributo: e.target.value })}>
          <option value="">—</option>
          {sistema.atributos.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
        </select>
      </label>
      <label>
        <span>{rotuloDt}</span>
        <input type="number" min={0} value={teste.dt ?? ''} onChange={(e) => onMudar({ ...teste, dt: numeroOuNulo(e.target.value) })} />
      </label>
    </div>
  )
}

function Grupo({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <fieldset className="item-grupo">
      <legend>{titulo}{acao}</legend>
      {children}
    </fieldset>
  )
}

function Linha({ rotulo, dica, children, larga }: { rotulo: string; dica?: string; children: React.ReactNode; larga?: boolean }) {
  return (
    <div className={`item-linha-campo${larga ? ' larga' : ''}`}>
      <div className="item-linha-rotulo">
        <strong>{rotulo}</strong>
        {dica && <small>{dica}</small>}
      </div>
      <div className="item-linha-valor">{children}</div>
    </div>
  )
}

// Ficha do item (KAN-53, spec 12.10 + prints do Foundry da Millie): cabeçalho com imagem, nome,
// raridade, quantidade e carga; abas Descrição, Detalhes, Atividades e Efeitos. A chave em
// cima alterna entre ver e editar (só pra quem é dono do item).
export default function FichaItem({ item, podeEditar, userId, jogadores, sistemaId, outrosItens, onSalvar, onFechar }: {
  item: ItemMesa
  sistemaId: string | null | undefined
  // Itens da campanha que podem ir dentro do Contêiner.
  outrosItens: Pick<ItemMesa, 'id' | 'name'>[]
  podeEditar: boolean
  userId: string
  jogadores: { userId: string; rotulo: string }[]
  onSalvar: (campos: Partial<ItemMesa>) => void
  onFechar: () => void
}) {
  const [i, mudar] = useRascunho(item, onSalvar)
  const [editando, setEditando] = useState(false)
  const [aba, setAba] = useState<Aba>('descricao')
  const [descricaoAberta, setDescricaoAberta] = useState(true)
  const [editandoTexto, setEditandoTexto] = useState(false)
  const [atividade, setAtividade] = useState<Atividade | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; itens: ItemMenu[] } | null>(null)
  const [buscandoCompendio, setBuscandoCompendio] = useState(false)
  const imagem = useRef<HTMLInputElement>(null)
  const ed = podeEditar && editando
  const verImagem = useMostrarImagem()
  const det = i.detalhes
  const mudarDetalhes = (c: Partial<DetalhesItem>) => mudar({ detalhes: { ...det, ...c } })
  const usos = det.usos ?? { gastos: 0, max: null, quem: 'todos' as const }
  const categoria = CATEGORIAS_ITEM.find((c) => c.id === i.categoria)?.rotulo
  const raridade = RARIDADES.find((r) => r.id === i.raridade)?.rotulo

  async function trocarImagem(arquivo: File) {
    const url = await enviarImagemDoItem(userId, arquivo)
    if (url) mudar({ image_url: url })
  }

  const salvarAtividade = (a: Atividade) => mudar({ atividades: i.atividades.some((x) => x.id === a.id) ? i.atividades.map((x) => (x.id === a.id ? a : x)) : [...i.atividades, a] })
  const excluirAtividade = (id: string) => mudar({ atividades: semAtividade(i.atividades, id) })
  const sistema = sistemaDe(sistemaId)

  function menuNovaAtividade(e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({
      x: r.left, y: r.bottom + 4,
      itens: TIPOS_ATIVIDADE.map((t) => ({
        rotulo: t.rotulo,
        icone: ICONE_ATIVIDADE[t.id],
        onClick: () => {
          const nova = novaAtividade(t.id)
          salvarAtividade(nova)
          setAtividade(nova)
        },
      })),
    })
  }

  function menuDaAtividade(e: React.MouseEvent, a: Atividade) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({
      x: r.right, y: r.bottom,
      itens: [
        { rotulo: 'Editar', icone: faPenToSquare, onClick: () => setAtividade(a) },
        { rotulo: 'Duplicar', icone: faCopy, onClick: () => salvarAtividade(duplicarAtividade(a)) },
        { rotulo: 'Deletar', icone: faTrash, perigo: true, onClick: () => excluirAtividade(a.id) },
      ],
    })
  }

  const chave = podeEditar ? (
    <button
      type="button"
      className={`item-chave${editando ? ' ligada' : ''}`}
      role="switch"
      aria-checked={editando}
      title={editando ? 'Parar de Editar' : 'Editar'}
      aria-label="Modo de Edição"
      onClick={() => setEditando((v) => !v)}
    >
      <span><FontAwesomeIcon icon={faKey} /></span>
    </button>
  ) : null

  return (
    <SistemaContexto.Provider value={sistema}>
    <Janela titulo={i.name} largura={560} altura={620} topo={chave} semTitulo className="ficha-item" onFechar={onFechar}>
      <div className="ficha-item-corpo">
        <header className="ficha-item-topo">
          {/* Quem não edita clica na imagem e ela abre ampliada (pedido 14/10). */}
          <button type="button" className="ficha-item-imagem" disabled={!ed && !i.image_url} title={ed ? 'Trocar Imagem' : 'Ver imagem'} onClick={() => (ed ? imagem.current?.click() : i.image_url && verImagem?.ver(i.image_url, i.name))}>
            {i.image_url ? <img src={i.image_url} alt="" /> : <FontAwesomeIcon icon={faBriefcase} />}
          </button>
          <input ref={imagem} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) trocarImagem(f) }} />
          <div className="ficha-item-nome">
            {ed ? (
              <>
                <input className="ficha-item-nome-campo" value={i.name} aria-label="Nome" onChange={(e) => mudar({ name: e.target.value })} />
                <select value={i.raridade ?? ''} aria-label="Raridade" onChange={(e) => mudar({ raridade: (e.target.value || null) as ItemMesa['raridade'] })}>
                  <option value="">Raridade</option>
                  {RARIDADES.map((r) => <option key={r.id} value={r.id}>{r.rotulo}</option>)}
                </select>
              </>
            ) : (
              <>
                <h3>{i.name}</h3>
                <p>{[categoria, raridade].filter(Boolean).join(' · ')}</p>
              </>
            )}
          </div>
          <div className="ficha-item-numeros">
            <label title="Quantidade">
              <span>×</span>
              {ed ? <input type="number" min={0} value={i.quantidade} aria-label="Quantidade" onChange={(e) => mudar({ quantidade: Math.max(0, Number(e.target.value) || 0) })} /> : <b>{i.quantidade}</b>}
            </label>
            <label title="Carga">
              {ed ? <input type="number" min={0} step={0.5} value={i.carga} aria-label="Carga" onChange={(e) => mudar({ carga: Math.max(0, Number(e.target.value) || 0) })} /> : <b>{i.carga}</b>}
              <FontAwesomeIcon icon={faWeightHanging} />
            </label>
          </div>
        </header>

        <nav className="ficha-item-abas" role="tablist">
          {ABAS.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'ativa' : undefined} onClick={() => setAba(a.id)}>
              {a.rotulo}
            </button>
          ))}
        </nav>

        <div className="ficha-item-conteudo">
          {aba === 'descricao' && (
            <>
              <section className="item-secao">
                <header>
                  <button type="button" className="item-secao-titulo" aria-expanded={descricaoAberta} onClick={() => setDescricaoAberta((v) => !v)}>
                    <FontAwesomeIcon icon={descricaoAberta ? faChevronDown : faChevronRight} />
                    <span>Descrição</span>
                  </button>
                  {podeEditar && (
                    <button type="button" className="item-secao-editar" title={editandoTexto ? 'Pronto' : 'Editar Descrição'} aria-label="Editar Descrição" onClick={() => { setEditandoTexto((v) => !v); setDescricaoAberta(true) }}>
                      <FontAwesomeIcon icon={faFeatherPointed} />
                    </button>
                  )}
                </header>
                {descricaoAberta && (editandoTexto
                  ? <EditorTexto valor={i.descricao ?? ''} rotulo="Descrição" onMudar={(html) => mudar({ descricao: html })} />
                  : <div className="item-secao-texto" dangerouslySetInnerHTML={{ __html: sanitizarHtml(i.descricao ?? '') || '<p class="item-vazio">Sem descrição.</p>' }} />)}
              </section>
              <ul className="item-etiquetas">
                {etiquetasDoItem(i).map((t) => <li key={t}>{t}</li>)}
                {i.compendio_id && <li title="Ligado ao equipamento do livro: ao ser pego, entra no inventário com as estatísticas dele">Compêndio</li>}
              </ul>
            </>
          )}

          {aba === 'detalhes' && (
            <fieldset className="item-campos" disabled={!ed}>
              <Grupo titulo="Propriedades do Item">
                <Linha rotulo="Categoria">
                  <select value={i.categoria} onChange={(e) => mudar({ categoria: e.target.value as ItemMesa['categoria'] })}>
                    {CATEGORIAS_ITEM.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                  </select>
                </Linha>
                {i.categoria === 'lootavel' && (
                  <Linha rotulo="Tipo">
                    <select value={det.tipo ?? ''} onChange={(e) => mudarDetalhes({ tipo: (e.target.value || undefined) as DetalhesItem['tipo'] })}>
                      <option value="" />
                      {TIPOS_ITEM.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
                    </select>
                  </Linha>
                )}
                <Linha larga rotulo="Teste de Interação" dica="Teste pra interagir com o item.">
                  <SelectTeste teste={det.teste ?? { pericia: '', atributo: '', dt: null }} onMudar={(t) => mudarDetalhes({ teste: t })} />
                </Linha>
              </Grupo>
              {(
                <Grupo titulo="Requisição">
                  {sistema.categoriasDeItem.length > 0 && (
                    <Linha rotulo="Categoria" dica="Pra requisição: a patente limita quantos itens de cada categoria o agente carrega.">
                      <select value={det.categoriaSistema ?? ''} onChange={(e) => mudarDetalhes({ categoriaSistema: e.target.value || undefined })}>
                        <option value="">—</option>
                        {sistema.categoriasDeItem.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Linha>
                  )}
                  <Linha rotulo="Preço" dica="Opcional: vender por dinheiro na loja.">
                    <input type="number" min={0} placeholder="—" value={det.preco ?? ''} onChange={(e) => mudarDetalhes({ preco: numeroOuNulo(e.target.value) })} />
                  </Linha>
                </Grupo>
              )}
              {i.categoria === 'loja' && (
                <Grupo titulo="Loja">
                  <Linha rotulo="Cobra Por" dica="Requisição: a patente do agente limita os itens de categoria I a IV (a 0 é livre). Dinheiro: paga com o dinheiro da ficha. Os Dois: quem compra escolhe.">
                    <div className="item-modo-loja" role="radiogroup" aria-label="Cobra por">
                      {MODOS_LOJA.map((m) => (
                        <button key={m.id} type="button" role="radio" aria-checked={(det.loja?.modo ?? 'ambos') === m.id} className={(det.loja?.modo ?? 'ambos') === m.id ? 'ativo' : undefined} onClick={() => mudarDetalhes({ loja: { modo: m.id } })}>
                          {m.rotulo}
                        </button>
                      ))}
                    </div>
                  </Linha>
                </Grupo>
              )}
              {(i.categoria === 'conteiner' || i.categoria === 'loja') && (
                <Grupo titulo={i.categoria === 'loja' ? 'Estoque' : 'Conteúdo'}>
                  <p className="item-dica">{i.categoria === 'loja' ? `O que a loja vende. ∞ = nunca acaba. Preço em ${sistema.moeda.nome.toLowerCase()} (vazio: usa o do item).` : 'O que tem dentro. Quem abrir pode pegar e vai pro inventário.'}</p>
                  <ul className={`item-conteudo${i.categoria === 'loja' ? ' loja' : ''}`}>
                    {i.conteudo.map((c, n) => (
                      <li key={n}>
                        {c.compendio_id ? (
                          <span className="item-conteudo-compendio" title="Equipamento do compêndio: entra no inventário com as estatísticas do livro">
                            <FontAwesomeIcon icon={ICONE_COMPENDIO} /> {c.nome ?? 'Equipamento'}
                          </span>
                        ) : (
                          <select value={c.item_id} aria-label="Item" onChange={(e) => mudar({ conteudo: i.conteudo.map((x, k) => (k === n ? { ...x, item_id: e.target.value } : x)) })}>
                            {outrosItens.filter((o) => o.id !== i.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        )}
                        {i.categoria === 'loja' && c.ilimitado
                          ? <span className="item-ilimitado" title="Estoque ilimitado">∞</span>
                          : <input type="number" min={1} value={c.quantidade} aria-label="Quantidade" onChange={(e) => mudar({ conteudo: i.conteudo.map((x, k) => (k === n ? { ...x, quantidade: Math.max(1, Number(e.target.value) || 1) } : x)) })} />}
                        {i.categoria === 'loja' && (
                          <>
                            <label className="item-check-ilimitado" title="Estoque ilimitado"><input type="checkbox" checked={!!c.ilimitado} onChange={(e) => mudar({ conteudo: i.conteudo.map((x, k) => (k === n ? { ...x, ilimitado: e.target.checked } : x)) })} /> ∞</label>
                            <input type="number" min={0} placeholder={sistema.moeda.simbolo} value={c.preco ?? ''} aria-label="Preço" onChange={(e) => mudar({ conteudo: i.conteudo.map((x, k) => (k === n ? { ...x, preco: numeroOuNulo(e.target.value) } : x)) })} />
                          </>
                        )}
                        <button type="button" aria-label="Tirar do contêiner" onClick={() => mudar({ conteudo: i.conteudo.filter((_, k) => k !== n) })}><FontAwesomeIcon icon={faTrash} /></button>
                      </li>
                    ))}
                  </ul>
                  {ed && (
                    <div className="item-dois">
                      {outrosItens.some((o) => o.id !== i.id) && (
                        <button type="button" className="janela-botao" onClick={() => mudar({ conteudo: [...i.conteudo, { item_id: outrosItens.find((o) => o.id !== i.id)!.id, quantidade: 1 }] })}>
                          <FontAwesomeIcon icon={faPlus} /> Item da Campanha
                        </button>
                      )}
                      {sistema.compendio && (
                        <button type="button" className="janela-botao" onClick={() => setBuscandoCompendio(true)}>
                          <FontAwesomeIcon icon={ICONE_COMPENDIO} /> Do Compêndio
                        </button>
                      )}
                    </div>
                  )}
                  {!i.conteudo.length && <p className="item-vazio">Vazio.</p>}
                </Grupo>
              )}
              <Grupo titulo="Usos">
                <Linha rotulo="Usos Limitados">
                  <div className="item-dois">
                    <label><span>Gastos</span><input type="number" min={0} value={usos.gastos} onChange={(e) => mudarDetalhes({ usos: { ...usos, gastos: Math.max(0, Number(e.target.value) || 0) } })} /></label>
                    <label><span>Máximo</span><input type="number" min={1} placeholder="∞" value={usos.max ?? ''} onChange={(e) => mudarDetalhes({ usos: { ...usos, max: numeroOuNulo(e.target.value) } })} /></label>
                  </div>
                </Linha>
                <Linha rotulo="Quem Pode Usar">
                  <div className="item-dois">
                    <select value={usos.quem} onChange={(e) => mudarDetalhes({ usos: { ...usos, quem: e.target.value as typeof usos.quem } })}>
                      {QUEM_USA.map((q) => <option key={q.id} value={q.id}>{q.rotulo}</option>)}
                    </select>
                    {usos.quem === 'pessoa' && (
                      <select value={usos.pessoa ?? ''} aria-label="Pessoa" onChange={(e) => mudarDetalhes({ usos: { ...usos, pessoa: e.target.value || null } })}>
                        <option value="">Escolha…</option>
                        {jogadores.map((j) => <option key={j.userId} value={j.userId}>{j.rotulo}</option>)}
                      </select>
                    )}
                  </div>
                </Linha>
              </Grupo>
            </fieldset>
          )}

          {aba === 'atividades' && (
            <>
              <table className="item-atividades">
                <thead>
                  <tr><th>Atividades</th><th>Usos</th><th aria-label="Ações" /></tr>
                </thead>
                <tbody>
                  {i.atividades.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <button type="button" className="item-atividade-nome" onClick={() => setAtividade(a)}>
                          {a.icone ? <img src={a.icone} alt="" /> : <FontAwesomeIcon icon={ICONE_ATIVIDADE[a.tipo]} />}
                          <span><strong>{a.nome}</strong><small>{rotuloDaAtivacao(a)}{a.ativacao.quando === 'teste' && !a.ativacao.teste?.pericia && !a.ativacao.teste?.atributo ? <em className="item-aviso-curto"> · ⚠ falta escolher o teste</em> : null}</small></span>
                        </button>
                      </td>
                      <td className="item-atividade-usos">{textoDeUsos(a.ativacao.usos)}</td>
                      <td className="item-atividade-acoes">
                        {podeEditar && (
                          <>
                            <button type="button" title="Editar Atividade" aria-label="Editar Atividade" onClick={() => setAtividade(a)}><FontAwesomeIcon icon={faPenToSquare} /></button>
                            <button type="button" title="Deletar Atividade" aria-label="Deletar Atividade" onClick={() => excluirAtividade(a.id)}><FontAwesomeIcon icon={faTrash} /></button>
                            <button type="button" aria-label="Mais" onClick={(e) => menuDaAtividade(e, a)}><FontAwesomeIcon icon={faEllipsisVertical} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!i.atividades.length && (
                    <tr><td colSpan={3} className="item-vazio">Nenhuma atividade.{podeEditar ? ' O + adiciona.' : ''}</td></tr>
                  )}
                </tbody>
              </table>
              {podeEditar && (
                <button type="button" className="item-mais" title="Criar Atividade" aria-label="Criar Atividade" onClick={menuNovaAtividade}>
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              )}
            </>
          )}

          {aba === 'efeitos' && (
            <fieldset className="item-campos" disabled={!ed}>
              <Grupo titulo="Item">
                <Linha rotulo="Vai pro Inventário" dica="Ao pegar, entra no inventário de quem pegou e soma a Carga.">
                  <input type="checkbox" checked={!!i.efeitos.inventario} onChange={(e) => mudar({ efeitos: { ...i.efeitos, inventario: e.target.checked } })} />
                </Linha>
              </Grupo>
              <Grupo titulo="Documento">
                <p className="item-dica">Página de texto que abre quando alguém interage com o item.</p>
                {ed
                  ? <EditorTexto valor={i.efeitos.documento ?? ''} rotulo="Documento" onMudar={(html) => mudar({ efeitos: { ...i.efeitos, documento: html } })} />
                  : <div className="item-secao-texto" dangerouslySetInnerHTML={{ __html: sanitizarHtml(i.efeitos.documento ?? '') || '<p class="item-vazio">Nenhum documento.</p>' }} />}
              </Grupo>
              <Grupo titulo="Imagem">
                <p className="item-dica">Imagem mostrada quando alguém interage com o item.</p>
                <ImagemDoEfeito url={i.efeitos.imagem ?? null} editando={ed} userId={userId} onMudar={(url) => mudar({ efeitos: { ...i.efeitos, imagem: url } })} />
              </Grupo>
            </fieldset>
          )}
        </div>
      </div>

      {menu && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <MenuContexto x={menu.x} y={menu.y} itens={menu.itens} onFechar={() => setMenu(null)} />
        </div>
      )}

      {buscandoCompendio && (
        <Janela titulo={`Adicionar do Compêndio: ${i.name}`} icone={ICONE_COMPENDIO} largura={460} onFechar={() => setBuscandoCompendio(false)}>
          <BuscaCompendio
            sistema={sistema}
            multiplo
            jaTem={new Set(i.conteudo.map((c) => c.compendio_id).filter((x): x is string => !!x))}
            onEscolherVarios={(lista) => {
              mudar({ conteudo: [...i.conteudo, ...lista.map((e) => ({ compendio_id: e.id, nome: e.nome, quantidade: 1 }))] })
              setBuscandoCompendio(false)
            }}
          />
        </Janela>
      )}

      {atividade && (
        <EditorAtividade
          key={atividade.id}
          atividade={i.atividades.find((a) => a.id === atividade.id) ?? atividade}
          podeEditar={podeEditar}
          userId={userId}
          irmas={i.atividades}
          onSalvar={salvarAtividade}
          onFechar={() => setAtividade(null)}
        />
      )}
    </Janela>
    </SistemaContexto.Provider>
  )
}

function ImagemDoEfeito({ url, editando, userId, onMudar }: { url: string | null; editando: boolean; userId: string; onMudar: (url: string | null) => void }) {
  const campo = useRef<HTMLInputElement>(null)
  return (
    <div className="item-efeito-imagem">
      {url ? <img src={url} alt="" /> : <p className="item-vazio">Nenhuma imagem.</p>}
      {editando && (
        <div className="item-dois">
          <button type="button" className="janela-botao" onClick={() => campo.current?.click()}>{url ? 'Trocar Imagem' : 'Escolher Imagem'}</button>
          {url && <button type="button" className="janela-botao" onClick={() => onMudar(null)}>Tirar</button>}
          <input ref={campo} type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) { const u = await enviarImagemDoItem(userId, f); if (u) onMudar(u) }
          }} />
        </div>
      )}
    </div>
  )
}

function OpcoesAgrupadas({ grupos }: { grupos: { grupo: string | null; itens: { id: string; rotulo: string }[] }[] }) {
  return (
    <>
      {grupos.map((g, n) => (g.grupo
        ? <optgroup key={n} label={g.grupo}>{g.itens.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}</optgroup>
        : g.itens.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)))}
    </>
  )
}

type AbaAtividade = 'identidade' | 'ativacao' | 'efeito'
type SubAtivacao = 'tempo' | 'consumo' | 'alvos'

// Editar Atividade (print do Foundry): Identidade, Ativação (Tempo, Consumo, Alvos) e Efeito.
function EditorAtividade({ atividade, podeEditar, userId, irmas, onSalvar, onFechar }: {
  atividade: Atividade
  irmas: Atividade[] // as outras atividades do item (pro Se passar / Se falhar)
  podeEditar: boolean
  userId: string
  onSalvar: (a: Atividade) => void
  onFechar: () => void
}) {
  const sistema = useContext(SistemaContexto)
  const [a, setA] = useState(atividade)
  const [aba, setAba] = useState<AbaAtividade>('identidade')
  const [sub, setSub] = useState<SubAtivacao>('tempo')
  const [rituais, setRituais] = useState<string[]>([])
  const [ameacas, setAmeacas] = useState<string[]>([])
  const icone = useRef<HTMLInputElement>(null)
  const timer = useRef<number | undefined>(undefined)

  const mudar = (c: Partial<Atividade>) => {
    const nova = { ...a, ...c }
    setA(nova)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSalvar(nova), 400)
  }
  const at = a.ativacao
  const mudarAt = (c: Partial<Atividade['ativacao']>) => mudar({ ativacao: { ...at, ...c } })

  useEffect(() => {
    if (a.tipo === 'ritual') supabase.from(sistema.magia.tabela).select('name').order('name').then(({ data }) => setRituais(((data ?? []) as { name: string }[]).map((r) => r.name)))
    if (a.tipo === 'sumonar') supabase.from('creatures').select('name').order('name').limit(500).then(({ data }) => setAmeacas(((data ?? []) as { name: string }[]).map((r) => r.name)))
  }, [a.tipo, sistema])

  const abas: { id: AbaAtividade; rotulo: string; icone: IconDefinition }[] = [
    { id: 'identidade', rotulo: 'Identidade', icone: faFeatherPointed },
    { id: 'ativacao', rotulo: 'Ativação', icone: faHandSparkles },
    { id: 'efeito', rotulo: 'Efeito', icone: ICONE_ATIVIDADE[a.tipo] },
  ]
  const subs: { id: SubAtivacao; rotulo: string }[] = [
    { id: 'tempo', rotulo: 'Tempo' },
    { id: 'consumo', rotulo: 'Consumo' },
    { id: 'alvos', rotulo: 'Alvos' },
  ]
  const rotuloTipo = TIPOS_ATIVIDADE.find((t) => t.id === a.tipo)?.rotulo

  return (
    <Janela titulo={a.nome || rotuloTipo || 'Atividade'} icone={ICONE_ATIVIDADE[a.tipo]} largura={560} inicial={{ x: Math.max(16, window.innerWidth / 2 - 200), y: 110 }} className="ficha-item editor-atividade" onFechar={() => { window.clearTimeout(timer.current); onSalvar(a); onFechar() }}>
      <nav className="ficha-item-abas" role="tablist">
        {abas.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={aba === x.id} className={aba === x.id ? 'ativa' : undefined} onClick={() => setAba(x.id)}>
            <FontAwesomeIcon icon={x.icone} /> {x.rotulo}
          </button>
        ))}
      </nav>
      {aba === 'ativacao' && (
        <nav className="ficha-item-abas sub" role="tablist">
          {subs.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={sub === x.id} className={sub === x.id ? 'ativa' : undefined} onClick={() => setSub(x.id)}>{x.rotulo}</button>
          ))}
        </nav>
      )}

      <fieldset className="item-campos ficha-item-conteudo" disabled={!podeEditar}>
        {aba === 'identidade' && (
          <Grupo titulo="Atividade">
            <Linha rotulo="Nome"><input value={a.nome} placeholder={rotuloTipo} onChange={(e) => mudar({ nome: e.target.value })} /></Linha>
            <Linha rotulo="Ícone">
              <div className="item-dois">
                <button type="button" className="item-icone-atividade" onClick={() => icone.current?.click()} title="Escolher imagem">
                  {a.icone ? <img src={a.icone} alt="" /> : <FontAwesomeIcon icon={ICONE_ATIVIDADE[a.tipo]} />}
                </button>
                {a.icone && <button type="button" className="janela-botao" onClick={() => mudar({ icone: null })}>Usar o padrão</button>}
                <input ref={icone} type="file" accept="image/*" hidden onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) { const u = await enviarImagemDoItem(userId, f); if (u) mudar({ icone: u }) }
                }} />
              </div>
            </Linha>
            <Linha rotulo="Texto no Chat" dica="Texto a mais que aparece na mensagem do chat quando a atividade é usada.">
              <input value={a.textoChat} onChange={(e) => mudar({ textoChat: e.target.value })} />
            </Linha>
          </Grupo>
        )}

        {aba === 'ativacao' && sub === 'tempo' && (
          <>
            <Grupo titulo="Ativação">
              <Linha rotulo="Quando Dispara">
                <select value={at.quando} onChange={(e) => mudarAt({ quando: e.target.value })}><OpcoesAgrupadas grupos={QUANDO_DISPARA} /></select>
              </Linha>
              {at.quando === 'teste' && (
                <Linha larga rotulo="Teste" dica="A pessoa faz este teste antes. Passou: a atividade acontece. Falhou: roda o que estiver em Efeito → Depois → Se Falhar.">
                  <SelectTeste teste={at.teste ?? { pericia: '', atributo: '', dt: null }} onMudar={(t) => mudarAt({ teste: t })} />
                  {!at.teste?.pericia && !at.teste?.atributo && (
                    <p className="item-aviso" role="alert">Escolha a perícia (ou o atributo) do teste. Sem isso, a atividade acontece direto, sem teste.</p>
                  )}
                </Linha>
              )}
              <input className="item-largo" value={at.condicao} placeholder="Observação (opcional, ex.: só à noite)" onChange={(e) => mudarAt({ condicao: e.target.value })} />
            </Grupo>
            <Grupo titulo="Duração">
              <Linha rotulo="Duração">
                <div className="item-dois">
                  {['turno', 'rodada', 'cena', 'minuto', 'hora', 'dia'].includes(at.duracao) && (
                    <input type="number" min={1} value={at.duracaoValor ?? ''} placeholder="1" aria-label="Quantidade" onChange={(e) => mudarAt({ duracaoValor: numeroOuNulo(e.target.value) })} />
                  )}
                  <select value={at.duracao} onChange={(e) => mudarAt({ duracao: e.target.value })}><OpcoesAgrupadas grupos={DURACOES} /></select>
                </div>
              </Linha>
            </Grupo>
          </>
        )}

        {aba === 'ativacao' && sub === 'consumo' && (
          <>
            <Grupo titulo="Consumo">
              <Linha rotulo="Consome">
                <div className="item-dois">
                  <select value={at.consumo.tipo} onChange={(e) => mudarAt({ consumo: { ...at.consumo, tipo: e.target.value } })}>
                    {CONSUMOS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                  </select>
                  {at.consumo.tipo !== 'nada' && (
                    <input type="number" min={1} value={at.consumo.quanto} aria-label="Quanto" onChange={(e) => mudarAt({ consumo: { ...at.consumo, quanto: Math.max(1, Number(e.target.value) || 1) } })} />
                  )}
                </div>
              </Linha>
            </Grupo>
            <Grupo titulo="Usos">
              <Linha rotulo="Usos Limitados">
                <div className="item-dois">
                  <label><span>Gastos</span><input type="number" min={0} value={at.usos.gastos} onChange={(e) => mudarAt({ usos: { ...at.usos, gastos: Math.max(0, Number(e.target.value) || 0) } })} /></label>
                  <label><span>Máximo</span><input type="number" min={1} placeholder="∞" value={at.usos.max ?? ''} onChange={(e) => mudarAt({ usos: { ...at.usos, max: numeroOuNulo(e.target.value) } })} /></label>
                </div>
              </Linha>
            </Grupo>
          </>
        )}

        {aba === 'ativacao' && sub === 'alvos' && (
          <>
            <Grupo titulo="Alcance">
              <Linha rotulo="Alcance">
                <select value={at.alcance} onChange={(e) => mudarAt({ alcance: e.target.value })}>{sistema.alcances.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}</select>
              </Linha>
            </Grupo>
            <Grupo titulo="Alvos">
              <Linha rotulo="Alvos">
                <select value={at.alvos} onChange={(e) => mudarAt({ alvos: e.target.value })}>{ALVOS_ATIVIDADE.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}</select>
              </Linha>
            </Grupo>
            <Grupo titulo="Área">
              <Linha rotulo="Forma" dica="O tamanho em metros vira quadrados pela grade da cena.">
                <div className="item-dois">
                  <select value={at.area.forma} onChange={(e) => mudarAt({ area: { ...at.area, forma: e.target.value } })}>{FORMAS_AREA.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}</select>
                  {at.area.forma && <input type="number" min={1} value={at.area.tamanho ?? ''} placeholder="metros" aria-label="Tamanho em metros" onChange={(e) => mudarAt({ area: { ...at.area, tamanho: numeroOuNulo(e.target.value) } })} />}
                </div>
              </Linha>
            </Grupo>
          </>
        )}

        {aba === 'efeito' && <EfeitoDaAtividade a={a} mudar={mudar} rituais={rituais} ameacas={ameacas} userId={userId} />}
        {aba === 'efeito' && (
          <Grupo titulo="Depois">
            <p className="item-dica">{temTeste(a) ? 'O que acontece se passar ou falhar no teste.' : 'O que acontece em seguida.'} Marque outras atividades deste item; pra elas não aparecerem como botão, deixe "Quando Dispara" em Nenhuma.</p>
            {(temTeste(a) ? (['seSim', 'seNao'] as const) : (['seSim'] as const)).map((lado) => (
              <Linha key={lado} rotulo={!temTeste(a) ? 'Em Seguida' : lado === 'seSim' ? 'Se Passar' : 'Se Falhar'}>
                <div className="item-encadear">
                  {irmas.filter((x) => x.id !== a.id).map((x) => (
                    <label key={x.id} className="janela-check">
                      <input type="checkbox" checked={a[lado].includes(x.id)} onChange={(e) => mudar({ [lado]: e.target.checked ? [...a[lado], x.id] : a[lado].filter((y) => y !== x.id) })} />
                      <FontAwesomeIcon icon={ICONE_ATIVIDADE[x.tipo]} /> {x.nome}
                    </label>
                  ))}
                  {irmas.length < 2 && <p className="item-vazio">Crie outras atividades no item pra encadear.</p>}
                </div>
              </Linha>
            ))}
          </Grupo>
        )}
      </fieldset>
    </Janela>
  )
}

function SelectDano({ valor, onMudar }: { valor: string; onMudar: (v: string) => void }) {
  const sistema = useContext(SistemaContexto)
  return (
    <select value={valor} aria-label="Tipo de Dano" onChange={(e) => onMudar(e.target.value)}>
      {sistema.tiposDeDano.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
    </select>
  )
}

function SelectRecurso({ valor, onMudar }: { valor: string; onMudar: (v: string) => void }) {
  const sistema = useContext(SistemaContexto)
  return (
    <select value={valor} aria-label="Recupera" onChange={(e) => onMudar(e.target.value)}>
      {sistema.recursos.map((r) => <option key={r.id} value={r.id}>{r.rotulo}</option>)}
    </select>
  )
}

function EfeitoDaAtividade({ a, mudar, rituais, ameacas, userId }: { a: Atividade; mudar: (c: Partial<Atividade>) => void; rituais: string[]; ameacas: string[]; userId: string }) {
  const sistema = useContext(SistemaContexto)
  const imagem = useRef<HTMLInputElement>(null)
  switch (a.tipo) {
    case 'ataque': {
      const x = a.ataque!
      const m = (c: Partial<typeof x>) => mudar({ ataque: { ...x, ...c } })
      return (
        <Grupo titulo="Detalhes do Ataque">
          <Linha rotulo="Alcance">
            <select value={x.alcance} onChange={(e) => m({ alcance: e.target.value as typeof x.alcance })}>
              <option value="corpo">Corpo a Corpo</option>
              <option value="distancia">À Distância</option>
            </select>
          </Linha>
          <Linha rotulo="Classificação">
            <select value={x.classe} onChange={(e) => m({ classe: e.target.value as typeof x.classe })}>
              <option value="fisica">Arma Física</option>
              <option value="alcance_longo">Arma de Alcance Longo</option>
              <option value="desarmado">Ataque Desarmado</option>
            </select>
          </Linha>
          <Linha rotulo="Bônus de Ataque"><input type="number" value={x.bonus} onChange={(e) => m({ bonus: Number(e.target.value) || 0 })} /></Linha>
          <Linha rotulo="Dano">
            <div className="item-dois">
              <input value={x.dano} placeholder="1d8+2" aria-label="Fórmula do Dano" onChange={(e) => m({ dano: e.target.value })} />
              <SelectDano valor={x.tipoDano} onMudar={(v) => m({ tipoDano: v })} />
            </div>
          </Linha>
        </Grupo>
      )
    }
    case 'ritual': {
      const x = a.ritual!
      const m = (c: Partial<typeof x>) => mudar({ ritual: { ...x, ...c } })
      return (
        <Grupo titulo={sistema.magia.nome}>
          <Linha rotulo={sistema.magia.nome} dica="Do catálogo do sistema.">
            <input list="item-rituais" value={x.ritual} placeholder="Escolha um ritual" onChange={(e) => m({ ritual: e.target.value })} />
            <datalist id="item-rituais">{rituais.map((r) => <option key={r} value={r} />)}</datalist>
          </Linha>
          <Linha rotulo="Alvo">
            <select value={x.alvo} onChange={(e) => m({ alvo: e.target.value as typeof x.alvo })}>
              <option value="pessoa">Pessoa</option>
              <option value="area">Área</option>
              <option value="local">Local</option>
            </select>
          </Linha>
          <Linha larga rotulo="Teste pra Evitar"><SelectTeste teste={x.evitar} onMudar={(t) => m({ evitar: t })} /></Linha>
        </Grupo>
      )
    }
    case 'checar':
      return (
        <Grupo titulo="Detalhes do Teste">
          <Linha larga rotulo="Teste" dica="Testa contra o Valor Testado (DT)."><SelectTeste teste={a.checar!} onMudar={(t) => mudar({ checar: t })} /></Linha>
        </Grupo>
      )
    case 'dano':
      return (
        <Grupo titulo="Dano">
          <Linha rotulo="Dano" dica="Sem teste: aplica direto.">
            <div className="item-dois">
              <input value={a.dano!.formula} placeholder="2d6" aria-label="Fórmula do Dano" onChange={(e) => mudar({ dano: { ...a.dano!, formula: e.target.value } })} />
              <SelectDano valor={a.dano!.tipoDano} onMudar={(v) => mudar({ dano: { ...a.dano!, tipoDano: v } })} />
            </div>
          </Linha>
        </Grupo>
      )
    case 'cura':
      return (
        <Grupo titulo="Cura">
          <Linha rotulo="Cura">
            <div className="item-dois">
              <input value={a.cura!.formula} placeholder="2d8+2" aria-label="Fórmula da Cura" onChange={(e) => mudar({ cura: { ...a.cura!, formula: e.target.value } })} />
              <SelectRecurso valor={a.cura!.recurso} onMudar={(v) => mudar({ cura: { ...a.cura!, recurso: v as 'pv' | 'san' | 'pe' } })} />
            </div>
          </Linha>
        </Grupo>
      )
    case 'sumonar':
      return (
        <Grupo titulo="Sumonar">
          <Linha rotulo="Ameaça" dica="Do bestiário.">
            <input list="item-ameacas" value={a.sumonar!.ameaca} placeholder="Escolha uma ameaça" onChange={(e) => mudar({ sumonar: { ...a.sumonar!, ameaca: e.target.value } })} />
            <datalist id="item-ameacas">{ameacas.map((r) => <option key={r} value={r} />)}</datalist>
          </Linha>
          <Linha rotulo="Quantidade"><input type="number" min={1} value={a.sumonar!.quantidade} onChange={(e) => mudar({ sumonar: { ...a.sumonar!, quantidade: Math.max(1, Number(e.target.value) || 1) } })} /></Linha>
        </Grupo>
      )
    case 'conteiner':
      return <p className="item-dica">Mostra o que tem dentro do item (Detalhes → Conteúdo) pra pessoa pegar.</p>
    case 'documento':
      return <p className="item-dica">Mostra o documento e a imagem da aba Efeitos do item.</p>
    case 'transformar':
      return (
        <Grupo titulo="Transformar">
          <Linha rotulo="Nova Aparência" dica="Troca a imagem do token.">
            <div className="item-dois">
              <button type="button" className="item-icone-atividade grande" onClick={() => imagem.current?.click()}>
                {a.transformar!.imagem ? <img src={a.transformar!.imagem} alt="" /> : <FontAwesomeIcon icon={faMasksTheater} />}
              </button>
              <input ref={imagem} type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) { const u = await enviarImagemDoItem(userId, f); if (u) mudar({ transformar: { ...a.transformar!, imagem: u } }) }
              }} />
            </div>
          </Linha>
          <Linha rotulo="Por Quanto Tempo" dica="Tempo ou condição (ex.: 1 cena, até dormir).">
            <input value={a.transformar!.duracao} onChange={(e) => mudar({ transformar: { ...a.transformar!, duracao: e.target.value } })} />
          </Linha>
        </Grupo>
      )
  }
}
