import { recortarImagem } from '../../components/RecortarImagem'
import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare, faBookmark, faBookOpen, faCubes, faFile, faFloppyDisk, faFolder, faFolderOpen, faFolderPlus, faFont, faLightbulb, faFire, faMusic,
  faPenToSquare, faPencil, faPlus, faTrash, faUser,
} from '@fortawesome/free-solid-svg-icons'
import Janela, { Campo } from './Janela'
import MenuContexto, { type ItemMenu } from './MenuContexto'
import { itensDeImagem, useMostrarImagem } from './mostrarImagem'
import { CriarPasta } from './PainelCenas'
import { EditorTexto } from './PainelPlaylist'
import { montarArvore, type NoPasta, type Pasta } from './cenas'
import { aceitaArquivo, CATEGORIAS_POSICIONAVEIS, ehImagem, nomeDoArquivo, vaiProMapa, type CategoriaPosicionavel, type Posicionavel } from './posicionaveis'
import { LUZ_PADRAO } from './luz'
import { efeitoPadrao } from './efeitos'
import JanelaBiblioteca from './JanelaBiblioteca'
import { enviarArquivoPosicionavel, type usePosicionaveis } from './usePosicionaveis'

export const TIPO_ARRASTO_POSICIONAVEL = 'application/x-arkanis-posicionavel'
// O painel marca onde dá pra soltar coisas arrastadas da mesa (pra guardar).
export const ALVO_GUARDAR = 'data-guardar-posicionavel'

// Soltou o arraste da mesa em cima dos Posicionáveis?
export function soltouNosPosicionaveis(e?: { clientX: number; clientY: number }): boolean {
  if (!e) return false
  return document.elementsFromPoint(e.clientX, e.clientY).some((el) => el.closest(`[${ALVO_GUARDAR}]`))
}

type Api = ReturnType<typeof usePosicionaveis>

const ICONE: Record<CategoriaPosicionavel, typeof faUser> = {
  token: faUser, objeto: faCubes, desenho: faPencil, luz: faLightbulb, som: faMusic, nota: faBookmark,
}

const ACEITA: Partial<Record<CategoriaPosicionavel, string>> = {
  token: 'image/*', objeto: 'image/*', luz: 'image/*', som: 'audio/*',
  desenho: 'image/*,application/pdf,.pdf,.doc,.docx,.odt,.txt,.rtf,.md',
}

const DICA_IMPORTAR: Record<CategoriaPosicionavel, string> = {
  token: 'Importar Token (imagem)', objeto: 'Importar Objeto (imagem)', desenho: 'Importar Desenho (imagem, PDF ou documento)',
  luz: 'Importar Luz Ambiente (imagem ou GIF)', som: 'Importar Som Ambiente (áudio)', nota: 'Criar Nota',
}

// Aba Posicionáveis (KAN-53, spec 12.6 + prints do Foundry da Millie): armazém do mestre.
// Guarda importando (botão ou arrastando o arquivo pra cá) ou arrastando da mesa pra cá;
// usa arrastando daqui pra mesa.
export default function PainelPosicionaveis({ souMestre, userId, api, categoria, onCategoria, onAbrirNota, avisar }: {
  souMestre: boolean
  userId: string
  api: Api
  categoria: CategoriaPosicionavel
  onCategoria: (c: CategoriaPosicionavel) => void
  onAbrirNota: (p: Posicionavel | { nova: true; pasta: string | null }) => void
  avisar: (texto: string | null, erro?: boolean) => void
}) {
  const [busca, setBusca] = useState('')
  const [fechadas, setFechadas] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ x: number; y: number; itens: ItemMenu[] } | null>(null)
  const imagem = useMostrarImagem()
  const [pasta, setPasta] = useState<{ pai: string | null; editando?: Pasta } | null>(null)
  const [renomeando, setRenomeando] = useState<Posicionavel | null>(null)
  const [soltando, setSoltando] = useState<string | null>(null) // id da pasta (ou '' = raiz)
  const [biblioteca, setBiblioteca] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)
  const pastaDoImport = useRef<string | null>(null)

  if (!souMestre) return <p className="mesa-painel-vazio">Os Posicionáveis são o armazém do mestre.</p>

  const cat = CATEGORIAS_POSICIONAVEIS.find((c) => c.id === categoria)!
  const daAba = api.itens.filter((x) => x.categoria === categoria)
  const pastasDaAba = api.pastas.filter((p) => p.categoria === categoria)
  const arvore = montarArvore<Posicionavel>(pastasDaAba, daAba, busca)

  async function importar(arquivos: File[], pastaId: string | null) {
    let bons = arquivos.filter((a) => aceitaArquivo(categoria, a))
    if (!bons.length) {
      avisar(`${cat.rotulo} não aceita esse arquivo.`, true)
      return
    }
    // Recorte (08/10): uma imagem por vez abre o recorte; várias de uma vez sobem direto.
    if (bons.length === 1) {
      const r = await recortarImagem(bons[0], { proporcao: 'original', titulo: 'Ajustar imagem' })
      if (!r) return
      bons = [r]
    }
    avisar('Enviando…')
    for (const a of bons) {
      const url = await enviarArquivoPosicionavel(userId, a)
      if (!url) {
        avisar(`Não deu pra enviar "${a.name}".`, true)
        return
      }
      await api.criar({ categoria, name: nomeDoArquivo(a.name), url, dados: {}, folder_id: pastaId })
    }
    avisar(null)
  }

  // Link arrastado de outra aba do navegador (imagem ou áudio).
  async function importarLink(url: string, pastaId: string | null) {
    const nome = nomeDoArquivo(decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || ''))
    const ok = categoria === 'som' ? !ehImagem(url) : ehImagem(url)
    if (!ok) {
      avisar('Essa aba não aceita esse link.', true)
      return
    }
    await api.criar({ categoria, name: nome, url, dados: {}, folder_id: pastaId })
  }

  // Luz Ambiente sem imagem: só a luz (raio, cor, animação se acertam na mesa, no duplo clique).
  function criarLuz(pastaId: string | null) {
    api.criar({ categoria: 'luz', name: 'Luz', url: null, dados: { luz: { ...LUZ_PADRAO, raio: 4 } }, folder_id: pastaId })
  }

  // Efeito animado sem imagem (fogo; o tipo e a cor se trocam na mesa, no duplo clique).
  function criarEfeito(pastaId: string | null) {
    api.criar({ categoria: 'luz', name: 'Fogo', url: null, dados: { efeito: efeitoPadrao('fogo') }, folder_id: pastaId })
  }

  function botaoMais(pastaId: string | null) {
    if (categoria === 'nota') onAbrirNota({ nova: true, pasta: pastaId })
    else {
      pastaDoImport.current = pastaId
      arquivo.current?.click()
    }
  }

  function soltar(e: React.DragEvent, pastaId: string | null) {
    e.preventDefault()
    e.stopPropagation()
    setSoltando(null)
    // Item daqui mesmo arrastado pra uma pasta: muda de pasta.
    const id = e.dataTransfer.getData(TIPO_ARRASTO_POSICIONAVEL)
    if (id) {
      const item = api.itens.find((x) => x.id === id)
      if (item && item.folder_id !== pastaId) api.salvar(id, { folder_id: pastaId })
      return
    }
    const arquivos = Array.from(e.dataTransfer.files)
    if (arquivos.length) {
      importar(arquivos, pastaId)
      return
    }
    const html = e.dataTransfer.getData('text/html')
    const src = /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1]?.replace(/&amp;/g, '&')
    const uri = e.dataTransfer.getData('text/uri-list').split(/\r?\n/).find((l) => /^https?:\/\//i.test(l.trim()))?.trim()
    const url = (src && /^https?:/i.test(src) ? src : null) ?? uri
    if (url) importarLink(url, pastaId)
  }

  const arrastando = (e: React.DragEvent, pastaId: string) => {
    if (!e.dataTransfer.types.includes(TIPO_ARRASTO_POSICIONAVEL) && !e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('text/uri-list')) return
    e.preventDefault()
    e.stopPropagation()
    setSoltando(pastaId)
  }

  function abrir(p: Posicionavel) {
    if (p.categoria === 'nota') onAbrirNota(p)
    else if (p.url && !vaiProMapa(p)) window.open(p.url, '_blank', 'noopener')
  }

  function menuDoItem(e: React.MouseEvent, p: Posicionavel) {
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      itens: [
        ...(p.categoria === 'nota' ? [{ rotulo: 'Abrir Nota', icone: faPenToSquare, onClick: () => onAbrirNota(p) } as ItemMenu] : []),
        ...(p.url && !vaiProMapa(p) ? [{ rotulo: 'Abrir', icone: faArrowUpRightFromSquare, onClick: () => abrir(p) } as ItemMenu] : []),
        { rotulo: 'Renomear', icone: faFont, onClick: () => setRenomeando(p) },
        ...(p.url && p.categoria !== 'som' && ehImagem(p.url) ? itensDeImagem(imagem, p.url, p.name) : []),
        { tipo: 'linha' },
        { rotulo: 'Excluir', icone: faTrash, perigo: true, onClick: () => window.confirm(`Excluir "${p.name}" dos Posicionáveis?`) && api.excluir(p.id) },
      ],
    })
  }

  function menuDaPasta(e: React.MouseEvent, p: Pasta) {
    e.preventDefault()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      itens: [
        { rotulo: 'Editar Pasta', icone: faPenToSquare, onClick: () => setPasta({ pai: p.parent_id, editando: p }) },
        { rotulo: 'Remover Pasta', icone: faTrash, perigo: true, onClick: () => window.confirm(`Remover a pasta "${p.name}"? O que está nela fica solto.`) && api.excluirPasta(p.id) },
      ],
    })
  }

  const miniatura = (p: Posicionavel) => {
    if (p.url && ehImagem(p.url)) return <img src={p.url} alt="" draggable={false} />
    if (p.categoria === 'desenho' && p.url) return <FontAwesomeIcon icon={faFile} />
    return <FontAwesomeIcon icon={ICONE[p.categoria]} />
  }

  const linha = (p: Posicionavel) => {
    const mapa = vaiProMapa(p)
    return (
      <li key={p.id}>
        <button
          type="button"
          className="ator-linha posicionavel-linha"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(TIPO_ARRASTO_POSICIONAVEL, p.id)
            e.dataTransfer.effectAllowed = 'copyMove'
          }}
          onClick={() => abrir(p)}
          onContextMenu={(e) => menuDoItem(e, p)}
          title={mapa ? 'Arraste pra mesa pra usar' : p.categoria === 'nota' ? 'Abrir Nota' : 'Abrir'}
        >
          <span className="ator-token">{miniatura(p)}</span>
          <span className="ator-nome">{p.name}</span>
        </button>
      </li>
    )
  }

  const no = (n: NoPasta<Posicionavel>) => {
    const aberta = !fechadas.has(n.pasta.id) || !!busca
    return (
      <li key={n.pasta.id} className="cena-pasta">
        <div
          className={`cena-pasta-topo${soltando === n.pasta.id ? ' soltando' : ''}`}
          style={n.pasta.color ? { background: n.pasta.color } : undefined}
          onContextMenu={(e) => menuDaPasta(e, n.pasta)}
          onDragOver={(e) => arrastando(e, n.pasta.id)}
          onDragLeave={() => setSoltando(null)}
          onDrop={(e) => soltar(e, n.pasta.id)}
        >
          <button
            type="button"
            className="cena-pasta-nome"
            aria-expanded={aberta}
            onClick={() => setFechadas((s) => { const x = new Set(s); if (x.has(n.pasta.id)) x.delete(n.pasta.id); else x.add(n.pasta.id); return x })}
          >
            <FontAwesomeIcon icon={aberta ? faFolderOpen : faFolder} /> {n.pasta.name}
          </button>
          <button type="button" className="cena-pasta-acao" aria-label="Criar outra pasta" title="Criar Pasta" onClick={() => setPasta({ pai: n.pasta.id })}>
            <FontAwesomeIcon icon={faFolderPlus} />
          </button>
          <button type="button" className="cena-pasta-acao" aria-label={DICA_IMPORTAR[categoria]} title={DICA_IMPORTAR[categoria]} onClick={() => botaoMais(n.pasta.id)}>
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>
        {aberta && (
          <ul className="cena-lista">
            {n.pastas.map(no)}
            {n.cenas.map(linha)}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div
      className={`cenas-painel posicionaveis-painel${soltando === '' ? ' soltando' : ''}`}
      {...{ [ALVO_GUARDAR]: '' }}
      onDragOver={(e) => arrastando(e, '')}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSoltando(null) }}
      onDrop={(e) => soltar(e, null)}
    >
      <div className="posicionaveis-abas" role="tablist" aria-label="Posicionáveis">
        {CATEGORIAS_POSICIONAVEIS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === categoria}
            aria-label={c.rotulo}
            className={`posicionaveis-aba${c.id === categoria ? ' ativo' : ''}`}
            onClick={() => { onCategoria(c.id); setBusca('') }}
          >
            <FontAwesomeIcon icon={ICONE[c.id]} />
            <span className="posicionaveis-dica" role="tooltip">{c.rotulo}</span>
          </button>
        ))}
      </div>

      <div className="posicionaveis-filtro">
        <input value={busca} placeholder={cat.filtro} aria-label={cat.filtro} onChange={(e) => setBusca(e.target.value)} />
        <button type="button" className="posicionaveis-botao" aria-label="Criar Pasta" onClick={() => setPasta({ pai: null })}>
          <FontAwesomeIcon icon={faFolderPlus} />
          <span className="posicionaveis-dica" role="tooltip">Criar Pasta</span>
        </button>
        <button type="button" className="posicionaveis-botao" aria-label={DICA_IMPORTAR[categoria]} onClick={() => botaoMais(null)}>
          <FontAwesomeIcon icon={faPlus} />
          <span className="posicionaveis-dica" role="tooltip">{DICA_IMPORTAR[categoria]}</span>
        </button>
        {(categoria === 'token' || categoria === 'objeto') && (
          <button type="button" className="posicionaveis-botao" aria-label="Biblioteca de Tokens" onClick={() => setBiblioteca(true)}>
            <FontAwesomeIcon icon={faBookOpen} />
            <span className="posicionaveis-dica" role="tooltip">Biblioteca de Tokens</span>
          </button>
        )}
        {categoria === 'luz' && (
          <button type="button" className="posicionaveis-botao" aria-label="Criar Luz (sem imagem)" onClick={() => criarLuz(null)}>
            <FontAwesomeIcon icon={faLightbulb} />
            <span className="posicionaveis-dica" role="tooltip">Criar Luz (sem imagem)</span>
          </button>
        )}
        {categoria === 'luz' && (
          <button type="button" className="posicionaveis-botao" aria-label="Criar Efeito (fogo, água, nuvem…)" onClick={() => criarEfeito(null)}>
            <FontAwesomeIcon icon={faFire} />
            <span className="posicionaveis-dica" role="tooltip">Criar Efeito (fogo, água, nuvem…)</span>
          </button>
        )}
      </div>

      <input
        ref={arquivo}
        type="file"
        multiple
        hidden
        accept={ACEITA[categoria]}
        onChange={(e) => {
          const lista = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (lista.length) importar(lista, pastaDoImport.current)
        }}
      />

      {!daAba.length && !pastasDaAba.length && (
        <p className="mesa-painel-vazio">
          {categoria === 'nota'
            ? 'Nenhuma nota ainda. Clique no + pra criar.'
            : categoria === 'desenho'
              ? 'Nada ainda. Tudo que for feito com as Ferramentas de Desenho aparece aqui sozinho; imagem, PDF ou documento entra pelo + ou arrastando o arquivo.'
              : categoria === 'som'
                ? 'Nada ainda. Todo Som Ambiente criado na mesa aparece aqui sozinho; áudio entra pelo + ou arrastando o arquivo.'
                : 'Nada guardado ainda. Importe pelo +, arraste o arquivo pra cá, ou arraste da mesa pra cá.'}
        </p>
      )}

      <ul className="cena-lista cena-raiz">
        {arvore.pastas.map(no)}
        {arvore.cenas.map(linha)}
      </ul>

      {menu && (
        <div onPointerDown={(e) => e.stopPropagation()}>
          <MenuContexto x={menu.x} y={menu.y} itens={menu.itens} onFechar={() => setMenu(null)} />
        </div>
      )}

      {pasta && (
        <CriarPasta
          inicial={pasta.editando}
          onCriar={(c) => {
            if (pasta.editando) api.salvarPasta(pasta.editando.id, c)
            else api.criarPasta({ ...c, parent_id: pasta.pai, categoria })
            setPasta(null)
          }}
          onFechar={() => setPasta(null)}
        />
      )}

      {biblioteca && (
        <JanelaBiblioteca
          dica={`Clique pra guardar em ${cat.rotulo}, ou arraste direto pra mesa.`}
          escolhidos={daAba.map((p) => p.url ?? '')}
          onEscolher={(t, url) => {
            if (daAba.some((p) => p.url === url)) return
            api.criar({ categoria, name: t.nome, url, dados: {}, folder_id: null })
            avisar(`${t.nome} guardado em ${cat.rotulo}.`, true)
          }}
          onFechar={() => setBiblioteca(false)}
        />
      )}

      {renomeando && (
        <Renomear
          nome={renomeando.name}
          onSalvar={(nome) => {
            api.salvar(renomeando.id, { name: nome })
            setRenomeando(null)
          }}
          onFechar={() => setRenomeando(null)}
        />
      )}
    </div>
  )
}

function Renomear({ nome, onSalvar, onFechar }: { nome: string; onSalvar: (n: string) => void; onFechar: () => void }) {
  const [valor, setValor] = useState(nome)
  return (
    <Janela titulo={`Renomear: ${nome}`} icone={faFont} largura={380} onFechar={onFechar}>
      <form className="janela-form" onSubmit={(e) => { e.preventDefault(); onSalvar(valor.trim() || nome) }}>
        <Campo rotulo="Nome">
          <input autoFocus value={valor} aria-label="Nome" onChange={(e) => setValor(e.target.value)} onFocus={(e) => e.currentTarget.select()} />
        </Campo>
        <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faFloppyDisk} /> Salvar</button>
      </form>
    </Janela>
  )
}

// Nota solta (spec 12.6): nome e texto, salvos no armazém.
export function JanelaNota({ nota, onSalvar, onFechar }: {
  nota: Posicionavel | null
  onSalvar: (campos: { name: string; texto: string }) => void
  onFechar: () => void
}) {
  const [nome, setNome] = useState(nota?.name ?? '')
  const [texto, setTexto] = useState(nota?.dados.texto ?? '')
  return (
    <Janela titulo={`Nota: ${nome.trim() || 'Nova Nota'}`} icone={faBookmark} largura={480} onFechar={onFechar}>
      <form className="janela-form" onSubmit={(e) => { e.preventDefault(); onSalvar({ name: nome.trim() || 'Nota', texto }) }}>
        <Campo rotulo="Nome">
          <input autoFocus={!nota} value={nome} placeholder="Nota" aria-label="Nome da Nota" onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <EditorTexto valor={texto} rotulo="Texto da Nota" onMudar={setTexto} />
        <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faFloppyDisk} /> Salvar Nota</button>
      </form>
    </Janela>
  )
}
