import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { usePastasFechadas } from './pastasFechadas'
import {
  faCheck, faClone, faEye, faEyeSlash, faFloppyDisk, faFolder, faFolderOpen, faFolderPlus, faMap, faPenToSquare, faPeopleArrows, faTrash,
} from '@fortawesome/free-solid-svg-icons'
import Janela, { Campo, CampoCor } from './Janela'
import { montarArvore, pastasEmLista, type Cena, type NoPasta, type Pasta } from './cenas'

type Alvo = { tipo: 'cena'; cena: Cena } | { tipo: 'pasta'; pasta: Pasta }
type Menu = { x: number; y: number } & Alvo

// Arrastar na lista (pedido da Millie, 08/10): cena ou pasta pra dentro de uma pasta, ou pra fora (raiz).
const TIPO_CENA = 'application/x-vtt-cena'
const TIPO_PASTA = 'application/x-vtt-pasta-cena'

// Aba Cenas (12.5): Criar Cena / Criar Pasta, pastas com subpastas e as miniaturas.
// Clicar abre a cena só pra quem clicou; o mestre muda a de todo mundo com "Ativar Cena".
export default function PainelCenas({ souMestre, cenas, pastas, ativa, vendo, onAbrir, onEditar, onAtivar, onTrazerTodos, onExcluir, onDuplicar, onCriarCena, onCriarPasta, onSalvarPasta, onExcluirPasta, onMoverCena, jogadores = [], onVisibilidade }: {
  souMestre: boolean
  cenas: Cena[]
  pastas: Pasta[]
  ativa: string | null
  vendo: string | null
  onAbrir: (c: Cena) => void
  onEditar: (c: Cena) => void
  onAtivar: (c: Cena) => void
  onTrazerTodos: (c: Cena) => void
  onExcluir: (c: Cena) => void
  onDuplicar: (c: Cena) => void
  onCriarCena: (nome: string, pastaId: string | null) => void
  onCriarPasta: (p: Pick<Pasta, 'name' | 'color' | 'sort_mode' | 'parent_id'>) => void
  onSalvarPasta: (id: string, p: Partial<Pick<Pasta, 'name' | 'color' | 'sort_mode' | 'parent_id'>>) => void
  onMoverCena?: (c: Cena, pastaId: string | null) => void
  onExcluirPasta: (p: Pasta, comCenas: boolean) => void
  // Quem pode ver o mapa (pedido da Millie, 07/10): só o mestre, todos ou jogadores escolhidos.
  jogadores?: { userId: string; rotulo: string }[]
  onVisibilidade?: (c: Cena, v: Pick<Cena, 'visibility' | 'visible_to'>) => void
}) {
  const [menu, setMenu] = useState<Menu | null>(null)
  const [criandoCena, setCriandoCena] = useState<{ pasta: string | null } | null>(null)
  const [criandoPasta, setCriandoPasta] = useState<{ pai: string | null } | null>(null)
  const [editandoPasta, setEditandoPasta] = useState<Pasta | null>(null)
  const [vendoQuem, setVendoQuem] = useState<Cena | null>(null)
  const [fechadas, setFechadas] = usePastasFechadas('cenas')
  const [alvoSoltar, setAlvoSoltar] = useState<string | null>(null) // id da pasta, ou 'raiz'
  const arvore = montarArvore(pastas, cenas)

  // Pasta não pode ir pra dentro dela mesma nem de uma subpasta dela.
  function dentroDe(id: string | null, pastaId: string): boolean {
    for (let p = id; p; p = pastas.find((x) => x.id === p)?.parent_id ?? null) if (p === pastaId) return true
    return false
  }

  const arrastando = (e: React.DragEvent) => e.dataTransfer.types.includes(TIPO_CENA) || e.dataTransfer.types.includes(TIPO_PASTA)

  function soltavel(destino: string | null) {
    if (!souMestre) return {}
    const chave = destino ?? 'raiz'
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!arrastando(e)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        if (alvoSoltar !== chave) setAlvoSoltar(chave)
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAlvoSoltar((a) => (a === chave ? null : a))
      },
      onDrop: (e: React.DragEvent) => {
        if (!arrastando(e)) return
        e.preventDefault()
        e.stopPropagation()
        setAlvoSoltar(null)
        const cenaId = e.dataTransfer.getData(TIPO_CENA)
        const pastaId = e.dataTransfer.getData(TIPO_PASTA)
        if (cenaId) {
          const c = cenas.find((x) => x.id === cenaId)
          if (c && c.folder_id !== destino) onMoverCena?.(c, destino)
        } else if (pastaId) {
          const p = pastas.find((x) => x.id === pastaId)
          if (p && p.parent_id !== destino && !dentroDe(destino, pastaId)) onSalvarPasta(pastaId, { parent_id: destino })
        }
      },
    }
  }

  useEffect(() => {
    if (!menu) return
    const fechar = () => setMenu(null)
    window.addEventListener('scroll', fechar, true)
    return () => window.removeEventListener('scroll', fechar, true)
  }, [menu])

  function abrirMenu(e: React.MouseEvent, m: Alvo) {
    if (!souMestre) return
    e.preventDefault()
    setMenu({ ...m, x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 200) })
  }

  function alternar(id: string) {
    setFechadas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const cartao = (c: Cena) => (
    <li key={c.id}>
      <button
        type="button"
        className={`cena-cartao${c.id === ativa ? ' ativa' : ''}${c.id === vendo ? ' vendo' : ''}`}
        style={c.background_url ? { backgroundImage: `url(${c.background_url})` } : undefined}
        onClick={() => onAbrir(c)}
        onContextMenu={(e) => abrirMenu(e, { tipo: 'cena', cena: c })}
        draggable={souMestre}
        onDragStart={(e) => { e.dataTransfer.setData(TIPO_CENA, c.id); e.dataTransfer.effectAllowed = 'move' }}
        onDragEnd={() => setAlvoSoltar(null)}
        aria-label={c.name}
        title={souMestre ? 'Clique pra olhar; botão direito › Ativar Cena pra mostrar pra todos' : undefined}
      >
        <span>{c.name}</span>
        {souMestre && c.id !== ativa && c.visibility === 'mestre' && <FontAwesomeIcon icon={faEyeSlash} className="cena-cartao-oculta" aria-label="Só o mestre vê" title="Só o mestre vê" />}
        {c.id === ativa && <FontAwesomeIcon icon={faCheck} className="cena-cartao-ativa" aria-label="Cena ativa" />}
      </button>
    </li>
  )

  const pasta = (n: NoPasta) => {
    const aberta = !fechadas.has(n.pasta.id)
    return (
      <li key={n.pasta.id} className={`cena-pasta${alvoSoltar === n.pasta.id ? ' soltar-aqui' : ''}`} {...soltavel(n.pasta.id)}>
        <div
          className="cena-pasta-topo"
          draggable={souMestre}
          onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData(TIPO_PASTA, n.pasta.id); e.dataTransfer.effectAllowed = 'move' }}
          onDragEnd={() => setAlvoSoltar(null)}
          style={n.pasta.color ? { background: n.pasta.color } : undefined} onContextMenu={(e) => abrirMenu(e, { tipo: 'pasta', pasta: n.pasta })}>
          <button type="button" className="cena-pasta-nome" aria-expanded={aberta} onClick={() => alternar(n.pasta.id)}>
            <FontAwesomeIcon icon={aberta ? faFolderOpen : faFolder} /> {n.pasta.name}
          </button>
          {souMestre && (
            <>
              <button type="button" className="cena-pasta-acao" aria-label="Criar outra pasta" title="Criar Pasta" onClick={() => setCriandoPasta({ pai: n.pasta.id })}>
                <FontAwesomeIcon icon={faFolderPlus} />
              </button>
              <button type="button" className="cena-pasta-acao" aria-label="Criar uma cena nesta pasta" title="Criar Cena" onClick={() => setCriandoCena({ pasta: n.pasta.id })}>
                <FontAwesomeIcon icon={faMap} />
                <span className="cena-pasta-mais">+</span>
              </button>
            </>
          )}
        </div>
        {aberta && (
          <ul className="cena-lista">
            {n.pastas.map(pasta)}
            {n.cenas.map(cartao)}
          </ul>
        )}
      </li>
    )
  }

  const vazio = !arvore.pastas.length && !arvore.cenas.length

  return (
    <div className={`cenas-painel${alvoSoltar === 'raiz' ? ' soltar-aqui' : ''}`} {...soltavel(null)}>
      {souMestre && (
        <div className="cenas-botoes">
          <button type="button" className="mesa-botao" onClick={() => setCriandoCena({ pasta: null })}>
            <FontAwesomeIcon icon={faMap} /> Criar Cena
          </button>
          <button type="button" className="mesa-botao" onClick={() => setCriandoPasta({ pai: null })}>
            <FontAwesomeIcon icon={faFolder} /> Criar Pasta
          </button>
        </div>
      )}

      {vazio && (
        <p className="mesa-painel-vazio">
          {souMestre ? 'Nenhuma cena ainda. Crie uma, ou arraste uma imagem pra mesa.' : 'Nenhuma cena disponível pra você ainda.'}
        </p>
      )}

      <ul className="cena-lista cena-raiz">
        {arvore.pastas.map(pasta)}
        {arvore.cenas.map(cartao)}
      </ul>

      {menu && (
        <>
          <div className="dropdown-backdrop" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
          <ul className="mesa-menu" style={{ left: menu.x, top: menu.y }}>
            {menu.tipo === 'cena' ? (
              <>
                <li><button type="button" disabled={menu.cena.id === ativa} onClick={() => { onAtivar(menu.cena); setMenu(null) }}><FontAwesomeIcon icon={faCheck} /> {menu.cena.id === ativa ? 'Cena Ativa' : 'Ativar Cena'}</button></li>
                <li><button type="button" onClick={() => { onEditar(menu.cena); setMenu(null) }}><FontAwesomeIcon icon={faPenToSquare} /> Editar</button></li>
                {onVisibilidade && <li><button type="button" onClick={() => { setVendoQuem(menu.cena); setMenu(null) }}><FontAwesomeIcon icon={faEye} /> Quem pode ver</button></li>}
                <li><button type="button" onClick={() => { onTrazerTodos(menu.cena); setMenu(null) }}><FontAwesomeIcon icon={faPeopleArrows} /> Trazer todos pra cá</button></li>
                <li>
                  <button type="button" onClick={() => {
                    if (window.confirm(`Excluir a cena "${menu.cena.name}"?`)) onExcluir(menu.cena)
                    setMenu(null)
                  }}><FontAwesomeIcon icon={faTrash} /> Excluir</button>
                </li>
                <li><button type="button" onClick={() => { onDuplicar(menu.cena); setMenu(null) }}><FontAwesomeIcon icon={faClone} /> Duplicar</button></li>
              </>
            ) : (
              <>
                <li><button type="button" onClick={() => { setEditandoPasta(menu.pasta); setMenu(null) }}><FontAwesomeIcon icon={faPenToSquare} /> Editar Pasta</button></li>
                <li>
                  <button type="button" onClick={() => {
                    if (window.confirm(`Remover a pasta "${menu.pasta.name}"? As cenas dela ficam soltas na lista.`)) onExcluirPasta(menu.pasta, false)
                    setMenu(null)
                  }}><FontAwesomeIcon icon={faFolder} /> Remover Pasta</button>
                </li>
                <li>
                  <button type="button" onClick={() => {
                    if (window.confirm(`Excluir a pasta "${menu.pasta.name}" e todas as cenas dentro dela?`)) onExcluirPasta(menu.pasta, true)
                    setMenu(null)
                  }}><FontAwesomeIcon icon={faTrash} /> Excluir Todas</button>
                </li>
              </>
            )}
          </ul>
        </>
      )}

      {criandoCena && (
        <CriarCena
          pastas={pastas}
          pastaInicial={criandoCena.pasta}
          sugestao={`Cena (${cenas.length + 1})`}
          onCriar={(nome, pastaId) => { onCriarCena(nome, pastaId); setCriandoCena(null) }}
          onFechar={() => setCriandoCena(null)}
        />
      )}

      {criandoPasta && (
        <CriarPasta
          onCriar={(p) => { onCriarPasta({ ...p, parent_id: criandoPasta.pai }); setCriandoPasta(null) }}
          onFechar={() => setCriandoPasta(null)}
        />
      )}

      {vendoQuem && onVisibilidade && (
        <QuemPodeVer
          cena={vendoQuem}
          ativa={vendoQuem.id === ativa}
          jogadores={jogadores}
          onSalvar={(v) => { onVisibilidade(vendoQuem, v); setVendoQuem(null) }}
          onFechar={() => setVendoQuem(null)}
        />
      )}

      {editandoPasta && (
        <CriarPasta
          inicial={editandoPasta}
          onCriar={(campos) => { onSalvarPasta(editandoPasta.id, campos); setEditandoPasta(null) }}
          onFechar={() => setEditandoPasta(null)}
        />
      )}
    </div>
  )
}

function CriarCena({ pastas, pastaInicial, sugestao, onCriar, onFechar }: {
  pastas: Pasta[]
  pastaInicial: string | null
  sugestao: string
  onCriar: (nome: string, pastaId: string | null) => void
  onFechar: () => void
}) {
  const [nome, setNome] = useState('')
  const [pasta, setPasta] = useState(pastaInicial ?? '')
  return (
    <Janela titulo="Criar Cena" largura={340} onFechar={onFechar}>
      <form className="janela-form" onSubmit={(e) => { e.preventDefault(); onCriar(nome.trim() || sugestao, pasta || null) }}>
        <Campo rotulo="Nome">
          <input autoFocus value={nome} placeholder={sugestao} aria-label="Nome" onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo rotulo="Pasta">
          <select value={pasta} aria-label="Pasta" onChange={(e) => setPasta(e.target.value)}>
            <option value="">Sem pasta</option>
            {pastasEmLista(pastas).map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </Campo>
        <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faCheck} /> Criar Cena</button>
      </form>
    </Janela>
  )
}

export function CriarPasta({ inicial, onCriar, onFechar }: {
  inicial?: Pasta
  onCriar: (p: Pick<Pasta, 'name' | 'color' | 'sort_mode'>) => void
  onFechar: () => void
}) {
  const [nome, setNome] = useState(inicial?.name ?? '')
  const [cor, setCor] = useState(inicial?.color ?? '#000000')
  const [modo, setModo] = useState<Pasta['sort_mode']>(inicial?.sort_mode ?? 'alfabetica')
  return (
    <Janela titulo={`Pasta: ${nome.trim() || 'Pasta'}`} icone={faFolder} largura={460} onFechar={onFechar}>
      <form className="janela-form" onSubmit={(e) => { e.preventDefault(); onCriar({ name: nome.trim() || 'Pasta', color: cor === '#000000' ? null : cor, sort_mode: modo }) }}>
        <Campo rotulo="Nome da Pasta">
          <input autoFocus value={nome} placeholder="Pasta" aria-label="Nome da Pasta" onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo rotulo="Cor da Pasta">
          <CampoCor rotulo="Cor da Pasta" valor={cor} onMudar={setCor} />
        </Campo>
        <Campo rotulo="Modo de Organização">
          <div className="janela-linha janela-linha-direita" role="radiogroup" aria-label="Modo de Organização">
            <label className="janela-radio"><input type="radio" checked={modo === 'alfabetica'} onChange={() => setModo('alfabetica')} /> Alfabética</label>
            <label className="janela-radio"><input type="radio" checked={modo === 'manual'} onChange={() => setModo('manual')} /> Manual</label>
          </div>
        </Campo>
        <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faFloppyDisk} /> {inicial ? 'Salvar Alterações' : 'Criar Pasta'}</button>
      </form>
    </Janela>
  )
}

// Quem pode ver o mapa: só o mestre (padrão de mapa novo), todos os jogadores ou só os marcados.
// A cena ativa todo mundo vê, de qualquer jeito.
function QuemPodeVer({ cena, ativa, jogadores, onSalvar, onFechar }: {
  cena: Cena
  ativa: boolean
  jogadores: { userId: string; rotulo: string }[]
  onSalvar: (v: Pick<Cena, 'visibility' | 'visible_to'>) => void
  onFechar: () => void
}) {
  const [modo, setModo] = useState(cena.visibility)
  const [marcados, setMarcados] = useState<string[]>(cena.visible_to)
  return (
    <Janela titulo={`Quem pode ver: ${cena.name}`} icone={faEye} largura={400} onFechar={onFechar}>
      <form className="janela-form" onSubmit={(e) => { e.preventDefault(); onSalvar({ visibility: modo, visible_to: modo === 'jogadores' ? marcados : [] }) }}>
        {([['mestre', 'Só o mestre'], ['todos', 'Todos os jogadores'], ['jogadores', 'Só os jogadores marcados']] as const).map(([v, rotulo]) => (
          <label key={v} className="janela-check">
            <input type="radio" checked={modo === v} onChange={() => setModo(v)} /> {rotulo}
          </label>
        ))}
        {modo === 'jogadores' && (
          <div className="cena-quem-lista">
            {jogadores.length === 0 && <p className="janela-dica">Nenhum jogador na campanha ainda.</p>}
            {jogadores.map((j) => (
              <label key={j.userId} className="janela-check">
                <input type="checkbox" checked={marcados.includes(j.userId)} onChange={(e) => setMarcados((l) => (e.target.checked ? [...l, j.userId] : l.filter((x) => x !== j.userId)))} /> {j.rotulo}
              </label>
            ))}
          </div>
        )}
        <p className="janela-dica">{ativa ? 'Esta é a cena ativa: todo mundo está vendo ela agora.' : 'A cena ativa todo mundo vê; esta regra vale pra aba Mapas.'}</p>
        <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faFloppyDisk} /> Salvar</button>
      </form>
    </Janela>
  )
}
