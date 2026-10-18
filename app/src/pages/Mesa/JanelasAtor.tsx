import { recortarImagem } from '../../components/RecortarImagem'
import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen, faCheck, faFloppyDisk, faFolder, faFolderOpen, faFolderPlus, faImage, faImages, faPlus, faSkull, faUser, faUserGear, faXmark } from '@fortawesome/free-solid-svg-icons'
import MenuContexto, { type ItemMenu } from './MenuContexto'
import { supabase } from '../../lib/supabase'
import Janela, { Campo } from './Janela'
import FichaAmeaca from './FichaAmeaca'
import JanelaBiblioteca from './JanelaBiblioteca'
import { agruparVariacoes, NIVEIS, nomeDoArquivo, ROTULO_TIPO, type Ator, type NivelAcesso, type PastaDeVariacao, type Variacao } from './atores'
import { pastasEmLista, type Pasta } from './cenas'
import type { CriaturaResumo } from './useAtores'
import type { Rolagem } from './chat'
import type { Alvo, AtaqueDaAcao } from './mira'

// Criar Personagem (12.7): pra Ordem Paranormal só NPC e Ameaça/Monstro.
export function CriarPersonagem({ pastas, pastaInicial, onCriarNPC, onCriarAmeaca, onCriarHomebrew, onFechar }: {
  pastas: Pasta[]
  pastaInicial: string | null
  onCriarNPC: (nome: string, pasta: string | null) => void
  onCriarAmeaca: (c: CriaturaResumo & { pv_maximo: number | null }, pasta: string | null) => void
  // Ameaça que não está no bestiário: abre o editor de Homebrew.
  onCriarHomebrew: (pasta: string | null) => void
  onFechar: () => void
}) {
  const [tipo, setTipo] = useState<'npc' | 'ameaca'>('npc')
  const [nome, setNome] = useState('')
  const [pasta, setPasta] = useState(pastaInicial ?? '')
  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState<(CriaturaResumo & { pv_maximo: number | null })[]>([])
  const [escolhida, setEscolhida] = useState<string | null>(null)

  // Ameaça vem do bestiário.
  useEffect(() => {
    if (tipo !== 'ameaca') return
    const t = setTimeout(() => {
      let q = supabase.from('creatures').select('id, name, vd, image_url, tipo_criatura, tamanho, pv_maximo').order('name').limit(60)
      if (busca.trim()) q = q.ilike('name', `%${busca.trim()}%`)
      q.then(({ data }) => setLista((data ?? []) as (CriaturaResumo & { pv_maximo: number | null })[]))
    }, 200)
    return () => clearTimeout(t)
  }, [tipo, busca])

  function criar() {
    if (tipo === 'npc') onCriarNPC(nome.trim() || 'Novo NPC', pasta || null)
    else {
      const c = lista.find((x) => x.id === escolhida)
      if (c) onCriarAmeaca(c, pasta || null)
    }
  }

  return (
    <Janela titulo="Criar Personagem" icone={faUser} largura={440} onFechar={onFechar}>
      <div className="janela-form">
        <div className="criar-personagem-tipos" role="radiogroup" aria-label="Tipo">
          {(['npc', 'ameaca'] as const).map((t) => (
            <label key={t} className={`criar-personagem-tipo${tipo === t ? ' ativo' : ''}`}>
              <input type="radio" checked={tipo === t} onChange={() => setTipo(t)} />
              <FontAwesomeIcon icon={t === 'npc' ? faUser : faSkull} /> {ROTULO_TIPO[t]}
            </label>
          ))}
        </div>

        {tipo === 'npc' ? (
          <Campo rotulo="Nome">
            <input autoFocus value={nome} placeholder="Novo NPC" aria-label="Nome" onChange={(e) => setNome(e.target.value)} />
          </Campo>
        ) : (
          <>
            <div className="criar-combate-titulo">
              <input value={busca} placeholder="Procurar no bestiário" aria-label="Procurar no bestiário" onChange={(e) => setBusca(e.target.value)} />
              <button type="button" className="mesa-botao" onClick={() => onCriarHomebrew(pasta || null)}><FontAwesomeIcon icon={faPlus} /> Criar Ameaça</button>
            </div>
            <ul className="criar-personagem-bestiario">
              {lista.map((c) => (
                <li key={c.id}>
                  <button type="button" className={escolhida === c.id ? 'ativo' : undefined} onClick={() => setEscolhida(c.id)}>
                    <span className="ator-token">{c.image_url ? <img src={c.image_url} alt="" /> : <FontAwesomeIcon icon={faSkull} />}</span>
                    <span className="criar-personagem-nome">
                      <strong>{c.name}</strong>
                      <small>VD: {c.vd ?? '—'} · {[c.tipo_criatura, c.tamanho].filter(Boolean).join(' - ')}</small>
                    </span>
                  </button>
                </li>
              ))}
              {!lista.length && <li className="janela-dica">Nada encontrado.</li>}
            </ul>
          </>
        )}

        <Campo rotulo="Pasta">
          <select value={pasta} aria-label="Pasta" onChange={(e) => setPasta(e.target.value)}>
            <option value="">Sem pasta</option>
            {pastasEmLista(pastas).map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </Campo>

        <button type="button" className="janela-botao" disabled={tipo === 'ameaca' && !escolhida} onClick={criar}>
          <FontAwesomeIcon icon={faCheck} /> Criar Personagem
        </button>
      </div>
    </Janela>
  )
}

// Configuração de Propriedade (12.7): quem acessa a ficha deste NPC/Ameaça.
export function ConfigurarPropriedadeAtor({ ator, jogadores, onSalvar, onFechar }: {
  // Personagem da mesa ou Item (os dois têm o mesmo controle de acesso).
  ator: Pick<Ator, 'name' | 'acesso_padrao' | 'acesso_jogadores' | 'mostrar_mestres'>
  jogadores: { userId: string; rotulo: string }[]
  onSalvar: (campos: Pick<Ator, 'acesso_padrao' | 'acesso_jogadores' | 'mostrar_mestres'>) => void
  onFechar: () => void
}) {
  const [padrao, setPadrao] = useState<NivelAcesso>(ator.acesso_padrao)
  const [porJogador, setPorJogador] = useState<Record<string, NivelAcesso>>(ator.acesso_jogadores)
  const [mestres, setMestres] = useState(ator.mostrar_mestres)

  return (
    <Janela titulo={`Configuração de Propriedade: ${ator.name}`} icone={faUserGear} largura={460} onFechar={onFechar}>
      <form
        className="janela-form"
        onSubmit={(e) => {
          e.preventDefault()
          onSalvar({ acesso_padrao: padrao, acesso_jogadores: porJogador, mostrar_mestres: mestres })
        }}
      >
        <label className="janela-check">
          <input type="checkbox" checked={mestres} onChange={(e) => setMestres(e.target.checked)} /> Mostrar Usuários Mestres
        </label>
        <Campo rotulo="Todos os Jogadores">
          <select value={padrao} aria-label="Todos os Jogadores" onChange={(e) => setPadrao(e.target.value as NivelAcesso)}>
            {NIVEIS.map((n) => <option key={n.id} value={n.id}>{n.rotulo}</option>)}
          </select>
        </Campo>
        {jogadores.map((j) => (
          <Campo key={j.userId} rotulo={j.rotulo}>
            <select
              value={porJogador[j.userId] ?? ''}
              aria-label={j.rotulo}
              onChange={(e) => {
                const v = e.target.value as NivelAcesso | ''
                setPorJogador((p) => {
                  const n = { ...p }
                  if (v) n[j.userId] = v
                  else delete n[j.userId]
                  return n
                })
              }}
            >
              <option value="">Padrão</option>
              {NIVEIS.map((n) => <option key={n.id} value={n.id}>{n.rotulo}</option>)}
            </select>
          </Campo>
        ))}
        <p className="janela-dica">Nenhum: o jogador nem vê. Limitado: vê o card. Observador: só olha a ficha. Dono: edita tudo.</p>
        <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faFloppyDisk} /> Salvar Alterações</button>
      </form>
    </Janela>
  )
}

// Configurar Token (12.7): Token Principal + Tokens Variáveis, organizados em pastas
// ("Roupas pretas", "Emoções"…). Arrastar uma variação pra outra pasta muda ela de pasta;
// o botão direito renomeia, move ou tira; o botão direito na pasta renomeia ou exclui.
export function ConfigurarToken({ ator, onEnviar, onSalvar, onFechar }: {
  ator: Ator
  onEnviar: (arquivo: File) => Promise<string | null>
  onSalvar: (campos: Pick<Ator, 'token_url' | 'token_variacoes' | 'token_pastas'>) => void
  onFechar: () => void
}) {
  const [principal, setPrincipal] = useState(ator.token_url)
  const [variacoes, setVariacoes] = useState<Variacao[]>(ator.token_variacoes)
  const [pastas, setPastas] = useState<PastaDeVariacao[]>(ator.token_pastas ?? [])
  const [aviso, setAviso] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; itens: ItemMenu[] } | null>(null)
  const [fechadas, setFechadas] = useState<Set<string>>(new Set())
  const [sobre, setSobre] = useState<string | null>(null)
  // Biblioteca de Tokens aberta pra escolher o principal ou pra somar variações.
  const [biblioteca, setBiblioteca] = useState<'principal' | 'variacao' | null>(null)
  const principalRef = useRef<HTMLInputElement>(null)
  const variacaoRef = useRef<HTMLInputElement>(null)
  // Pasta em que entram as próximas imagens enviadas pelo "+".
  const destinoRef = useRef<string | null>(null)

  async function enviar(arquivos: File[], comoPrincipal: boolean) {
    let imagens = arquivos.filter((f) => f.type.startsWith('image/'))
    // Recorte (08/10): uma imagem por vez abre o recorte; várias de uma vez sobem direto.
    if (imagens.length === 1) {
      const r = await recortarImagem(imagens[0], { proporcao: 'quadrado', titulo: comoPrincipal ? 'Imagem do token' : 'Variação do token' })
      imagens = r ? [r] : []
    }
    if (!imagens.length) return
    setAviso('Enviando…')
    for (const f of imagens) {
      const url = await onEnviar(f)
      if (!url) {
        setAviso('Não deu pra enviar a imagem.')
        return
      }
      if (comoPrincipal) setPrincipal(url)
      else setVariacoes((v) => [...v, { id: crypto.randomUUID(), nome: nomeDoArquivo(f.name), url, pasta: destinoRef.current }])
    }
    setAviso(null)
  }

  function criarPasta() {
    const nome = window.prompt('Nome da pasta:', 'Nova pasta')
    if (nome?.trim()) setPastas((l) => [...l, { id: crypto.randomUUID(), nome: nome.trim() }])
  }

  const mover = (id: string, pasta: string | null) => setVariacoes((l) => l.map((x) => (x.id === id ? { ...x, pasta } : x)))

  function menuDaVariacao(e: React.MouseEvent, v: Variacao) {
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      itens: [
        {
          rotulo: 'Renomear', onClick: () => {
            const nome = window.prompt('Nome da variação:', v.nome)
            if (nome?.trim()) setVariacoes((l) => l.map((x) => (x.id === v.id ? { ...x, nome: nome.trim() } : x)))
          },
        },
        {
          tipo: 'sub', rotulo: 'Mover para a pasta',
          itens: [
            ...pastas.map((p) => ({ rotulo: `${v.pasta === p.id ? '✓ ' : ''}${p.nome}`, onClick: () => mover(v.id, p.id) })),
            { rotulo: `${!v.pasta ? '✓ ' : ''}Sem pasta`, onClick: () => mover(v.id, null) },
          ],
        },
        { rotulo: 'Usar como Token Principal', onClick: () => setPrincipal(v.url) },
        { tipo: 'linha' },
        { rotulo: 'Tirar', perigo: true, onClick: () => setVariacoes((l) => l.filter((x) => x.id !== v.id)) },
      ],
    })
  }

  function menuDaPasta(e: React.MouseEvent, p: PastaDeVariacao) {
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      itens: [
        {
          rotulo: 'Renomear Pasta', onClick: () => {
            const nome = window.prompt('Nome da pasta:', p.nome)
            if (nome?.trim()) setPastas((l) => l.map((x) => (x.id === p.id ? { ...x, nome: nome.trim() } : x)))
          },
        },
        {
          rotulo: 'Excluir Pasta', perigo: true, onClick: () => {
            setPastas((l) => l.filter((x) => x.id !== p.id))
            setVariacoes((l) => l.map((x) => (x.pasta === p.id ? { ...x, pasta: null } : x)))
          },
        },
      ],
    })
  }

  const grupos = agruparVariacoes(variacoes, pastas)

  return (
    <>
    <Janela titulo={`Configurar Token: ${ator.name}`} icone={faImage} largura={560} onFechar={onFechar}>
      <div className="janela-form janela-rolagem token-config">
        <fieldset className="janela-grupo">
          <legend>Token Principal</legend>
          <p className="janela-dica">A imagem que vai pro mapa quando o personagem é arrastado, e a miniatura da lista.</p>
          <div className="token-principal">
            <button type="button" className="token-quadro" onClick={() => principalRef.current?.click()} aria-label="Escolher token principal">
              {principal ? <img src={principal} alt="" /> : <FontAwesomeIcon icon={faPlus} />}
            </button>
            <button type="button" className="mesa-botao" onClick={() => setBiblioteca('principal')}><FontAwesomeIcon icon={faBookOpen} /> Da Biblioteca</button>
            {principal && <button type="button" className="janela-link" onClick={() => setPrincipal(null)}>Tirar</button>}
          </div>
          <input ref={principalRef} type="file" accept="image/*" hidden onChange={(e) => { enviar(Array.from(e.target.files ?? []), true); e.target.value = '' }} />
        </fieldset>

        <fieldset className="janela-grupo">
          <legend>Tokens Variáveis</legend>
          <div className="token-variacoes-topo">
            <p className="janela-dica">Arraste uma variação pra outra pasta pra mudar ela de lugar. Botão direito renomeia, move ou tira.</p>
            <button type="button" className="mesa-botao" onClick={() => { destinoRef.current = null; setBiblioteca('variacao') }}><FontAwesomeIcon icon={faBookOpen} /> Da Biblioteca</button>
            <button type="button" className="mesa-botao" onClick={criarPasta}><FontAwesomeIcon icon={faFolderPlus} /> Criar Pasta</button>
          </div>

          {grupos.map(({ pasta, itens }) => {
            const chave = pasta?.id ?? 'sem'
            if (!pasta && !itens.length && pastas.length) return null
            const aberta = !fechadas.has(chave)
            return (
              <section
                key={chave}
                className={`token-pasta${sobre === chave ? ' sobre' : ''}`}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-arkanis-variacao')) { e.preventDefault(); setSobre(chave) } }}
                onDragLeave={() => setSobre((s) => (s === chave ? null : s))}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('application/x-arkanis-variacao')
                  setSobre(null)
                  if (id) mover(id, pasta?.id ?? null)
                }}
              >
                {(pasta || pastas.length > 0) && (
                  <button
                    type="button"
                    className="token-pasta-nome"
                    aria-expanded={aberta}
                    onClick={() => setFechadas((s) => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n })}
                    onContextMenu={(e) => pasta && menuDaPasta(e, pasta)}
                  >
                    <FontAwesomeIcon icon={aberta ? faFolderOpen : faFolder} /> {pasta?.nome ?? 'Sem pasta'} <small>({itens.length})</small>
                  </button>
                )}
                {aberta && (
                  <div className="token-variacoes">
                    {itens.map((v) => (
                      <figure
                        key={v.id}
                        className="token-variacao"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('application/x-arkanis-variacao', v.id)}
                        onContextMenu={(e) => menuDaVariacao(e, v)}
                      >
                        <div className="token-quadro"><img src={v.url} alt="" draggable={false} /></div>
                        <figcaption>{v.nome}</figcaption>
                        <button type="button" className="token-tirar" aria-label={`Tirar ${v.nome}`} onClick={() => setVariacoes((l) => l.filter((x) => x.id !== v.id))}>
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      </figure>
                    ))}
                    <button
                      type="button"
                      className="token-quadro token-mais"
                      aria-label={`Adicionar variação${pasta ? ` em ${pasta.nome}` : ''}`}
                      onClick={() => { destinoRef.current = pasta?.id ?? null; variacaoRef.current?.click() }}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                )}
              </section>
            )
          })}
          <input ref={variacaoRef} type="file" accept="image/*" multiple hidden onChange={(e) => { enviar(Array.from(e.target.files ?? []), false); e.target.value = '' }} />
        </fieldset>

        {aviso && <p className="janela-aviso">{aviso}</p>}
      </div>
      <button type="button" className="janela-botao" onClick={() => onSalvar({ token_url: principal, token_variacoes: variacoes, token_pastas: pastas })}>
        <FontAwesomeIcon icon={faFloppyDisk} /> Salvar Alterações
      </button>

      {menu && <MenuContexto x={menu.x} y={menu.y} itens={menu.itens} onFechar={() => setMenu(null)} />}
    </Janela>
    {biblioteca && (
      <JanelaBiblioteca
        titulo={biblioteca === 'principal' ? 'Biblioteca: Token Principal' : 'Biblioteca: Tokens Variáveis'}
        dica={biblioteca === 'principal' ? 'Clique no token pra ser o principal.' : 'Clique nos tokens pra somar às variações.'}
        escolhidos={biblioteca === 'principal' ? (principal ? [principal] : []) : variacoes.map((v) => v.url)}
        onEscolher={(t, url) => {
          if (biblioteca === 'principal') {
            setPrincipal(url)
            setBiblioteca(null)
          } else if (!variacoes.some((v) => v.url === url)) {
            setVariacoes((l) => [...l, { id: crypto.randomUUID(), nome: t.nome, url, pasta: destinoRef.current }])
          }
        }}
        onFechar={() => setBiblioteca(null)}
      />
    )}
    </>
  )
}

// Variação de Token (12.8): painel lateral com as imagens do personagem, separadas por pasta.
// Fica aberto pra trocar rápido; clicar numa imagem troca o token no mapa.
export function PainelVariacoes({ ator, atual, onEscolher, onFechar }: {
  ator: Ator
  atual: string
  onEscolher: (url: string) => void
  onFechar: () => void
}) {
  const principal = ator.token_url ? [{ id: 'principal', nome: 'Token Principal', url: ator.token_url }] : []
  const grupos = agruparVariacoes(ator.token_variacoes.filter((v) => v.url !== ator.token_url), ator.token_pastas ?? [])
  const [fechadas, setFechadas] = useState<Set<string>>(new Set())

  const miniatura = (v: Variacao) => (
    <button key={v.id} type="button" className={`variacao-escolha${v.url === atual ? ' ativa' : ''}`} onClick={() => onEscolher(v.url)} title={v.nome}>
      <span className="token-quadro"><img src={v.url} alt="" draggable={false} /></span>
      <span>{v.nome}</span>
    </button>
  )

  return (
    <Janela titulo={`Variação de Token: ${ator.name}`} icone={faImages} largura={340} altura={620} inicial={{ x: Math.max(16, window.innerWidth - 740), y: 60 }} onFechar={onFechar}>
      <div className="janela-rolagem variacoes-painel">
        {principal.length > 0 && <div className="variacoes-grade">{principal.map(miniatura)}</div>}
        {grupos.map(({ pasta, itens }) => {
          if (!itens.length) return null
          const chave = pasta?.id ?? 'sem'
          const aberta = !fechadas.has(chave)
          return (
            <section key={chave} className="token-pasta">
              {(pasta || (ator.token_pastas ?? []).length > 0) && (
                <button
                  type="button"
                  className="token-pasta-nome"
                  aria-expanded={aberta}
                  onClick={() => setFechadas((s) => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n })}
                >
                  <FontAwesomeIcon icon={aberta ? faFolderOpen : faFolder} /> {pasta?.nome ?? 'Sem pasta'} <small>({itens.length})</small>
                </button>
              )}
              {aberta && <div className="variacoes-grade">{itens.map(miniatura)}</div>}
            </section>
          )
        })}
      </div>
    </Janela>
  )
}

// Excluir (12.7), com o texto da referência adaptado ("Personagem" no lugar de "Ator").
export function ConfirmarExclusao({ ator, onSim, onNao }: { ator: Ator; onSim: () => void; onNao: () => void }) {
  return (
    <Janela titulo={`Excluir ${ator.name}`} largura={380} onFechar={onNao}>
      <div className="janela-form">
        <p><strong>Você Tem Certeza?</strong> Este Personagem será excluído permanentemente e não poderá ser recuperado.</p>
        <div className="janela-linha">
          <button type="button" className="janela-botao" style={{ flex: 1 }} onClick={onSim}><FontAwesomeIcon icon={faCheck} /> Sim</button>
          <button type="button" className="janela-botao" style={{ flex: 1 }} onClick={onNao}><FontAwesomeIcon icon={faXmark} /> Não</button>
        </div>
      </div>
    </Janela>
  )
}

// Ficha portátil (12.7): janela flutuante, redimensionável. NPC e jogador abrem a ficha de
// Ordem Paranormal inteira (a mesma da seção 5, salvando sozinha); Ameaça abre a ficha dela.
// A ficha cabe inteira com 1240px; tela menor, ela ocupa quase tudo (e encolhe por dentro).
function larguraDaFicha(): number {
  return Math.max(320, Math.min(1240, window.innerWidth - 32))
}

export function FichaPortatil({ ator, podeEditar, onMudarPv, onMudarCondicoes, onRolar, onMostrar, onFechar, alvos, onAtacar, meuId, onEditarAmeaca }: {
  ator: Ator
  podeEditar: boolean
  onMudarPv: (pv: number) => void
  onMudarCondicoes?: (condicoes: string[], personalizadas: unknown) => void
  onRolar?: (rolagem: Rolagem, autor: { nome: string; foto: string | null }) => void
  onMostrar?: (html: string, autor: { nome: string; foto: string | null }) => void
  onFechar: () => void
  alvos?: Alvo[]
  onAtacar?: (ataque: AtaqueDaAcao, autor: { nome: string; foto: string | null }) => void
  meuId?: string
  onEditarAmeaca?: (criaturaId: string) => void
}) {
  const ameaca = ator.tipo === 'ameaca' && ator.creature_id
  return (
    // Ficha de personagem abre larga o bastante pras três colunas (Agente, perícias e Combate/Habilidades…)
    // aparecerem sem precisar esticar a janela (pedido 16/10), centralizada.
    <Janela titulo={ator.name} icone={ameaca ? faSkull : faUser} largura={ameaca ? 440 : larguraDaFicha()} altura={ameaca ? 620 : Math.min(820, window.innerHeight - 40)} inicial={ameaca ? { x: 40, y: 30 } : { x: Math.max(8, (window.innerWidth - larguraDaFicha()) / 2), y: 20 }} onFechar={onFechar}>
      {ameaca ? (
        <FichaAmeaca criaturaId={ator.creature_id!} nome={ator.name} pvAtual={ator.pv_atual} condicoes={ator.condicoes ?? []} condicoesPersonalizadas={ator.condicoes_personalizadas} onMudarCondicoes={onMudarCondicoes} podeEditar={podeEditar} podeRolar={podeEditar} onMudarPv={onMudarPv} onRolar={onRolar} onMostrar={onMostrar} alvos={alvos} onAtacar={onAtacar} meuId={meuId} onEditar={onEditarAmeaca} />
      ) : (
        <iframe className="ficha-portatil" title={`Ficha de ${ator.name}`} src={`/personagem/${ator.character_id}?mesa=${ator.campaign_id}`} />
      )}
    </Janela>
  )
}
