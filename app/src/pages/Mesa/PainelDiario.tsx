import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowDownAZ, faArrowDown19, faBookOpen, faClone, faFileExport, faFileImport, faFloppyDisk, faFolder, faFolderOpen, faFolderPlus, faFolderTree,
  faMagnifyingGlass, faPenToSquare, faPlus, faTrash, faUserGear,
} from '@fortawesome/free-solid-svg-icons'
import Janela, { Campo } from './Janela'
import MenuContexto, { type ItemMenu } from './MenuContexto'
import { itensDeImagem, useMostrarImagem } from './mostrarImagem'
import { montarArvore, type NoPasta, type Pasta } from './cenas'
import { ordenarItens } from './itens'
import { nivelNoDiario, type EntradaDiario } from './diario'

type Acoes = {
  onAbrir: (e: EntradaDiario) => void
  onPropriedade: (e: EntradaDiario) => void
  onDuplicar: (e: EntradaDiario) => void
  onExcluir: (e: EntradaDiario) => void
  onExportar: (e: EntradaDiario) => void
  onImportar: (e: EntradaDiario, arquivo: File) => void
  onCriar: (pasta: string | null) => void
  onCriarPasta: (pai: string | null) => void
  onEditarPasta: (p: Pasta) => void
  onExcluirPasta: (p: Pasta) => void
}

// Aba Diário (KAN-53, spec 12.11 + prints do Foundry da Millie): Criar Entrada / Criar Pasta,
// "Procurar Registros de Diário", ordem alfabética ou de criação, e a lista dos registros.
export default function PainelDiario({ souMestre, userId, podeCriar = true, entradas, pastas, acoes }: {
  souMestre: boolean
  podeCriar?: boolean // Permissões: o jogador pode criar registros?
  userId: string
  entradas: EntradaDiario[]
  pastas: Pasta[]
  acoes: Acoes
}) {
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<'alfabetica' | 'criacao'>('alfabetica')
  const [fechadas, setFechadas] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ x: number; y: number; itens: ItemMenu[] } | null>(null)
  const imagem = useMostrarImagem()
  const arquivo = useRef<HTMLInputElement>(null)
  const importando = useRef<EntradaDiario | null>(null)

  const ordenadas = ordenarItens(entradas, ordem).map((e, n) => ({ ...e, sort: n }))
  const arvore = montarArvore<EntradaDiario>(pastas, ordenadas, busca, ordem === 'alfabetica' ? 'alfabetica' : 'manual')

  function menuDaEntrada(ev: React.MouseEvent, e: EntradaDiario) {
    ev.preventDefault()
    const nivel = nivelNoDiario(e, userId, souMestre)
    if (nivel === 'limitado') return
    const dono = nivel === 'dono'
    const podeExcluir = souMestre || e.author_id === userId
    setMenu({
      x: ev.clientX,
      y: ev.clientY,
      itens: [
        { rotulo: dono ? 'Editar' : 'Ver', icone: faPenToSquare, onClick: () => acoes.onAbrir(e) },
        ...(souMestre ? [{ rotulo: 'Configurar Propriedade', icone: faUserGear, onClick: () => acoes.onPropriedade(e) } as ItemMenu] : []),
        // Documento com imagem: a primeira página de imagem.
        ...itensDeImagem(imagem, e.paginas.find((p) => p.tipo === 'imagem' && p.url)?.url, e.name),
        { tipo: 'linha' },
        { rotulo: 'Exportar Dados', icone: faFileExport, onClick: () => acoes.onExportar(e) },
        ...(dono
          ? [{ rotulo: 'Importar Dados', icone: faFileImport, onClick: () => { importando.current = e; arquivo.current?.click() } } as ItemMenu]
          : []),
        { tipo: 'linha' },
        { rotulo: 'Duplicar', icone: faClone, onClick: () => acoes.onDuplicar(e) },
        ...(podeExcluir ? [{ rotulo: 'Excluir', icone: faTrash, perigo: true, onClick: () => acoes.onExcluir(e) } as ItemMenu] : []),
      ],
    })
  }

  function menuDaPasta(e: React.MouseEvent, p: Pasta) {
    e.preventDefault()
    if (!souMestre) return
    setMenu({
      x: e.clientX,
      y: e.clientY,
      itens: [
        { rotulo: 'Editar Pasta', icone: faPenToSquare, onClick: () => acoes.onEditarPasta(p) },
        { rotulo: 'Remover Pasta', icone: faTrash, perigo: true, onClick: () => acoes.onExcluirPasta(p) },
      ],
    })
  }

  const linha = (e: EntradaDiario) => {
    const limitado = nivelNoDiario(e, userId, souMestre) === 'limitado'
    return (
      <li key={e.id}>
        <button type="button" className="ator-linha diario-linha" onClick={() => !limitado && acoes.onAbrir(e)} onContextMenu={(ev) => menuDaEntrada(ev, e)}>
          <span className="ator-nome">{e.name}</span>
        </button>
      </li>
    )
  }

  const pasta = (n: NoPasta<EntradaDiario>) => {
    const aberta = !fechadas.has(n.pasta.id) || !!busca
    return (
      <li key={n.pasta.id} className="cena-pasta">
        <div className="cena-pasta-topo" style={n.pasta.color ? { background: n.pasta.color } : undefined} onContextMenu={(e) => menuDaPasta(e, n.pasta)}>
          <button
            type="button"
            className="cena-pasta-nome"
            aria-expanded={aberta}
            onClick={() => setFechadas((s) => { const x = new Set(s); if (x.has(n.pasta.id)) x.delete(n.pasta.id); else x.add(n.pasta.id); return x })}
          >
            <FontAwesomeIcon icon={aberta ? faFolderOpen : faFolder} /> {n.pasta.name}
          </button>
          {souMestre && (
            <>
              <button type="button" className="cena-pasta-acao" aria-label="Criar outra pasta" title="Criar Pasta" onClick={() => acoes.onCriarPasta(n.pasta.id)}>
                <FontAwesomeIcon icon={faFolderPlus} />
              </button>
              <button type="button" className="cena-pasta-acao" aria-label="Criar registro nesta pasta" title="Criar Entrada" onClick={() => acoes.onCriar(n.pasta.id)}>
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </>
          )}
        </div>
        {aberta && (
          <ul className="cena-lista">
            {n.pastas.map(pasta)}
            {n.cenas.map(linha)}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="cenas-painel">
      <div className="cenas-botoes">
        {podeCriar && (
          <button type="button" className="mesa-botao" onClick={() => acoes.onCriar(null)}>
            <FontAwesomeIcon icon={faBookOpen} /> Criar Entrada
          </button>
        )}
        {souMestre && (
          <button type="button" className="mesa-botao" onClick={() => acoes.onCriarPasta(null)}>
            <FontAwesomeIcon icon={faFolder} /> Criar Pasta
          </button>
        )}
      </div>

      <div className="itens-busca">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <input value={busca} placeholder="Procurar Registros de Diário" aria-label="Procurar Registros de Diário" onChange={(e) => setBusca(e.target.value)} />
        <button
          type="button"
          className="itens-busca-acao"
          title={ordem === 'alfabetica' ? 'Ordem: Alfabética' : 'Ordem: de Criação'}
          aria-label={ordem === 'alfabetica' ? 'Ordem alfabética (mudar pra ordem de criação)' : 'Ordem de criação (mudar pra alfabética)'}
          onClick={() => setOrdem((o) => (o === 'alfabetica' ? 'criacao' : 'alfabetica'))}
        >
          <FontAwesomeIcon icon={ordem === 'alfabetica' ? faArrowDownAZ : faArrowDown19} />
        </button>
        <button type="button" className="itens-busca-acao" title="Recolher Pastas" aria-label="Recolher Pastas" onClick={() => setFechadas(new Set(pastas.map((p) => p.id)))}>
          <FontAwesomeIcon icon={faFolderTree} />
        </button>
      </div>

      {!entradas.length && <p className="mesa-painel-vazio">Nenhum registro ainda.</p>}

      <ul className="cena-lista cena-raiz">
        {arvore.pastas.map(pasta)}
        {arvore.cenas.map(linha)}
      </ul>

      <input
        ref={arquivo}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f && importando.current) acoes.onImportar(importando.current, f)
        }}
      />

      {menu && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <MenuContexto x={menu.x} y={menu.y} itens={menu.itens} onFechar={() => setMenu(null)} />
        </div>
      )}
    </div>
  )
}

// Criar Entrada: só o nome ("Registro de Diário").
export function CriarEntrada({ onCriar, onFechar }: { onCriar: (nome: string) => void; onFechar: () => void }) {
  const [nome, setNome] = useState('')
  return (
    <Janela titulo="Criar Entrada" icone={faBookOpen} largura={420} onFechar={onFechar}>
      <form className="janela-form" onSubmit={(e) => { e.preventDefault(); onCriar(nome.trim() || 'Registro de Diário') }}>
        <Campo rotulo="Nome">
          <input autoFocus value={nome} placeholder="Registro de Diário" aria-label="Nome" onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faFloppyDisk} /> Criar Entrada</button>
      </form>
    </Janela>
  )
}
