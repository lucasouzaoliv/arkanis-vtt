import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { usePastasFechadas } from './pastasFechadas'
import {
  faBold, faCheck, faChevronDown, faChevronRight, faCircleArrowRight, faFileAudio, faFloppyDisk, faFolder, faFolderOpen, faItalic,
  faListOl, faListUl, faMagnifyingGlass, faMusic, faPenToSquare, faPlay, faPlus, faRepeat, faShuffle, faStop, faTrash, faUnderline, faVolumeHigh,
} from '@fortawesome/free-solid-svg-icons'
import Janela, { Campo, Deslizante } from './Janela'
import MenuContexto, { type ItemMenu } from './MenuContexto'
import { CriarPasta } from './PainelCenas'
import { montarArvore, type NoPasta, type Pasta } from './cenas'
import { sanitizarHtml } from './chat'
import { CANAIS, MODOS, proximoModo, type Canal, type ModoPlayback, type Playlist, type SomPlaylist } from './playlists'
import type { usePlaylists } from './usePlaylists'
import { enviarSom } from './useSons'
import { salvarVolume, useVolumesDoUsuario } from './volumesDoUsuario'

type Api = ReturnType<typeof usePlaylists>

const ICONE_MODO: Record<ModoPlayback, typeof faShuffle> = { sequencial: faCircleArrowRight, embaralhar: faShuffle, repetir: faRepeat }

// Aba Lista de Reprodução (KAN-53, spec 12.12 + prints do Foundry da Millie). O mestre vê e
// controla as playlists; o jogador só ajusta o próprio volume (e ouve).
export default function PainelPlaylist({ souMestre, userId, pl }: { souMestre: boolean; userId: string; pl: Api }) {
  const [busca, setBusca] = useState('')
  const [fechadas, setFechadas] = usePastasFechadas('playlist')
  const [volumesAbertos, setVolumesAbertos] = useState(true)
  const [criando, setCriando] = useState<{ pasta: string | null } | null>(null)
  const [editando, setEditando] = useState<Playlist | null>(null)
  const [som, setSom] = useState<{ playlist: Playlist; som?: SomPlaylist } | null>(null)
  const [pasta, setPasta] = useState<{ pai: string | null; editando?: Pasta } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; itens: ItemMenu[] } | null>(null)
  const volumes = useVolumesDoUsuario()

  const arvore = montarArvore<Playlist>(pl.pastas, pl.playlists, busca)
  const alternar = (id: string) => setFechadas((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })
  const aberta = (id: string) => !fechadas.has(id)

  const abrirMenu = (e: React.MouseEvent, itens: ItemMenu[]) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, itens })
  }

  const controlesDeVolume = (
    <section className="playlist-volumes">
      <button type="button" className="playlist-secao" aria-expanded={volumesAbertos} onClick={() => setVolumesAbertos((v) => !v)}>
        <FontAwesomeIcon icon={volumesAbertos ? faChevronDown : faChevronRight} /> Controles de Volume de Usuário
      </button>
      {volumesAbertos && CANAIS.map((c) => (
        <label key={c.id} className="playlist-volume">
          <span>{c.rotulo}</span>
          <FontAwesomeIcon icon={faVolumeHigh} />
          <input type="range" min={0} max={100} step={1} value={Math.round(volumes[c.id] * 100)} aria-label={`Volume: ${c.rotulo}`} onChange={(e) => salvarVolume(c.id, Number(e.target.value) / 100)} />
          <output>{Math.round(volumes[c.id] * 100)}</output>
        </label>
      ))}
    </section>
  )

  if (!souMestre) {
    return (
      <div className="cenas-painel playlist-painel">
        {controlesDeVolume}
        <p className="mesa-painel-vazio">O mestre escolhe a música; aqui você ajusta o seu volume.</p>
      </div>
    )
  }

  const linhaDaPlaylist = (p: Playlist) => {
    const lista = pl.sonsDa(p.id)
    const tocandoAlgum = lista.some((s) => s.tocando)
    const modo = MODOS.find((m) => m.id === p.modo)!
    return (
      <li key={p.id} className={`playlist${tocandoAlgum ? ' tocando' : ''}`}>
        <div
          className="playlist-topo"
          onDoubleClick={() => setEditando(p)}
          onContextMenu={(e) => abrirMenu(e, [
            { rotulo: 'Editar Playlist', icone: faPenToSquare, onClick: () => setEditando(p) },
            { rotulo: 'Adicionar Som', icone: faPlus, onClick: () => setSom({ playlist: p }) },
            { tipo: 'linha' },
            { rotulo: 'Excluir', icone: faTrash, perigo: true, onClick: () => window.confirm(`Excluir a playlist "${p.name}" e os sons dela?`) && pl.excluirPlaylist(p.id) },
          ])}
        >
          <button type="button" className="playlist-nome" aria-expanded={aberta(p.id)} onClick={() => alternar(p.id)}>
            <FontAwesomeIcon icon={aberta(p.id) ? faChevronDown : faChevronRight} /> {p.name}
          </button>
          <button type="button" className="playlist-acao" title="Adicionar Som" aria-label="Adicionar Som" onClick={() => setSom({ playlist: p })}>
            <FontAwesomeIcon icon={faPlus} />
          </button>
          <button type="button" className="playlist-acao" title={modo.rotulo} aria-label={`Modo: ${modo.rotulo}`} onClick={() => pl.salvarPlaylist(p.id, { modo: proximoModo(p.modo) })}>
            <FontAwesomeIcon icon={ICONE_MODO[p.modo]} />
          </button>
          <button
            type="button"
            className={`playlist-acao${tocandoAlgum ? ' ligado' : ''}`}
            title={tocandoAlgum ? 'Parar Playlist' : 'Tocar Playlist'}
            aria-label={tocandoAlgum ? 'Parar Playlist' : 'Tocar Playlist'}
            disabled={!lista.length}
            onClick={() => (tocandoAlgum ? pl.pararPlaylist(p) : pl.tocarPlaylist(p))}
          >
            <FontAwesomeIcon icon={tocandoAlgum ? faStop : faPlay} />
          </button>
        </div>
        {aberta(p.id) && (
          <ul className="playlist-sons">
            {lista.map((s) => {
              const erro = Object.entries(pl.erros).find(([k]) => k.startsWith(`pl-${s.id}`))?.[1]
              return (
                <li
                  key={s.id}
                  className={`playlist-som${s.tocando ? ' tocando' : ''}`}
                  onDoubleClick={() => setSom({ playlist: p, som: s })}
                  onContextMenu={(e) => abrirMenu(e, [
                    { rotulo: 'Editar Som', icone: faPenToSquare, onClick: () => setSom({ playlist: p, som: s }) },
                    { tipo: 'linha' },
                    { rotulo: 'Excluir', icone: faTrash, perigo: true, onClick: () => pl.excluirSom(s.id) },
                  ])}
                >
                  <FontAwesomeIcon icon={faMusic} />
                  <span className="playlist-som-nome" title={erro ? `Não toca: ${erro}` : s.name}>{s.name}{erro ? ' ⚠' : ''}</span>
                  <button type="button" className={`playlist-acao${s.repetir ? ' ligado' : ''}`} title="Repetir Som" aria-label="Repetir Som" aria-pressed={s.repetir} onClick={() => pl.salvarSom({ playlist_id: p.id, repetir: !s.repetir }, s.id)}>
                    <FontAwesomeIcon icon={faRepeat} />
                  </button>
                  <button type="button" className={`playlist-acao${s.tocando ? ' ligado' : ''}`} title={s.tocando ? 'Parar Som' : 'Tocar Som'} aria-label={s.tocando ? 'Parar Som' : 'Tocar Som'} onClick={() => (s.tocando ? pl.pararSom(s) : pl.tocarSom(s))}>
                    <FontAwesomeIcon icon={s.tocando ? faStop : faPlay} />
                  </button>
                </li>
              )
            })}
            {!lista.length && <li className="playlist-vazia">Sem sons. Use o + pra adicionar.</li>}
          </ul>
        )}
      </li>
    )
  }

  const noDaPasta = (n: NoPasta<Playlist>) => (
    <li key={n.pasta.id} className="cena-pasta playlist-pasta">
      <div
        className="cena-pasta-topo"
        style={n.pasta.color ? { borderLeft: `3px solid ${n.pasta.color}` } : undefined}
        onContextMenu={(e) => abrirMenu(e, [
          { rotulo: 'Criar Playlist', icone: faMusic, onClick: () => setCriando({ pasta: n.pasta.id }) },
          { rotulo: 'Criar Subpasta', icone: faFolder, onClick: () => setPasta({ pai: n.pasta.id }) },
          { rotulo: 'Editar Pasta', icone: faPenToSquare, onClick: () => setPasta({ pai: n.pasta.parent_id, editando: n.pasta }) },
          { tipo: 'linha' },
          { rotulo: 'Excluir Pasta', icone: faTrash, perigo: true, onClick: () => window.confirm(`Remover a pasta "${n.pasta.name}"? As playlists dela ficam soltas.`) && pl.excluirPasta(n.pasta.id) },
        ])}
      >
        <button type="button" className="cena-pasta-nome" onClick={() => alternar(n.pasta.id)}>
          <FontAwesomeIcon icon={aberta(n.pasta.id) ? faFolderOpen : faFolder} /> {n.pasta.name}
        </button>
        <button type="button" className="cena-pasta-acao" title="Criar Playlist" aria-label="Criar Playlist na pasta" onClick={() => setCriando({ pasta: n.pasta.id })}>
          <FontAwesomeIcon icon={faMusic} /><span className="cena-pasta-mais">+</span>
        </button>
      </div>
      {aberta(n.pasta.id) && (
        <ul className="cena-lista">
          {n.pastas.map(noDaPasta)}
          {n.cenas.map(linhaDaPlaylist)}
        </ul>
      )}
    </li>
  )

  return (
    <div className="cenas-painel playlist-painel">
      <div className="cenas-botoes">
        <button type="button" className="mesa-botao" onClick={() => setCriando({ pasta: null })}><FontAwesomeIcon icon={faMusic} /> Criar Playlist</button>
        <button type="button" className="mesa-botao" onClick={() => setPasta({ pai: null })}><FontAwesomeIcon icon={faFolder} /> Criar Pasta</button>
      </div>
      <label className="playlist-busca">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <input value={busca} placeholder="Procurar Listas de Reprodução" aria-label="Procurar Listas de Reprodução" onChange={(e) => setBusca(e.target.value)} />
      </label>
      {controlesDeVolume}
      <ul className="cena-lista cena-raiz playlist-lista">
        {arvore.pastas.map(noDaPasta)}
        {arvore.cenas.map(linhaDaPlaylist)}
        {!pl.playlists.length && <li className="mesa-painel-vazio">Nenhuma playlist ainda.</li>}
      </ul>

      {menu && <MenuContexto x={menu.x} y={menu.y} itens={menu.itens} onFechar={() => setMenu(null)} />}

      {criando && (
        <Janela titulo="Criar Playlist" icone={faMusic} largura={360} onFechar={() => setCriando(null)}>
          <form
            className="janela-form"
            onSubmit={async (e) => {
              e.preventDefault()
              const nome = (new FormData(e.currentTarget).get('nome') as string).trim() || 'Playlist'
              const nova = await pl.criarPlaylist(nome, criando.pasta)
              setCriando(null)
              if (nova) setEditando(nova)
            }}
          >
            <Campo rotulo="Nome"><input name="nome" autoFocus placeholder="Playlist" aria-label="Nome" /></Campo>
            <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faCheck} /> Criar Playlist</button>
          </form>
        </Janela>
      )}

      {editando && <EditarPlaylist playlist={editando} onSalvar={(c) => { pl.salvarPlaylist(editando.id, c); setEditando(null) }} onFechar={() => setEditando(null)} />}

      {som && (
        <SomDaPlaylist
          playlist={som.playlist}
          som={som.som}
          userId={userId}
          onSalvar={async (c) => {
            const erro = await pl.salvarSom({ ...c, playlist_id: som.playlist.id }, som.som?.id)
            if (!erro) setSom(null)
            return erro
          }}
          onFechar={() => setSom(null)}
        />
      )}

      {pasta && (
        <CriarPasta
          inicial={pasta.editando}
          onCriar={(c) => {
            if (pasta.editando) pl.salvarPasta(pasta.editando.id, c)
            else pl.criarPasta({ ...c, parent_id: pasta.pai })
            setPasta(null)
          }}
          onFechar={() => setPasta(null)}
        />
      )}
    </div>
  )
}

// Descrição em texto rico (negrito, itálico, sublinhado, listas), igual ao jeito do chat.
export function EditorTexto({ valor, rotulo, onMudar }: { valor: string; rotulo: string; onMudar: (html: string) => void }) {
  const caixa = useRef<HTMLDivElement>(null)
  // O texto inicial entra uma vez só: o React 19 regrava o innerHTML sempre que o objeto do
  // dangerouslySetInnerHTML muda, e isso apagava o que a pessoa digitava (cursor voltava pro começo).
  const inicial = useRef({ __html: sanitizarHtml(valor) })
  const formatar = (comando: string) => {
    caixa.current?.focus()
    document.execCommand(comando)
    onMudar(sanitizarHtml(caixa.current?.innerHTML ?? ''))
  }
  const botoes: [string, typeof faBold, string][] = [
    ['bold', faBold, 'Negrito'], ['italic', faItalic, 'Itálico'], ['underline', faUnderline, 'Sublinhado'],
    ['insertUnorderedList', faListUl, 'Lista'], ['insertOrderedList', faListOl, 'Lista numerada'],
  ]
  return (
    <div className="editor-texto">
      <div className="editor-texto-barra">
        {botoes.map(([c, icone, nome]) => (
          <button key={c} type="button" title={nome} aria-label={nome} onMouseDown={(e) => e.preventDefault()} onClick={() => formatar(c)}>
            <FontAwesomeIcon icon={icone} />
          </button>
        ))}
      </div>
      <div
        ref={caixa}
        className="editor-texto-area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={rotulo}
        aria-multiline
        dangerouslySetInnerHTML={inicial.current}
        onInput={(e) => onMudar(sanitizarHtml((e.currentTarget as HTMLDivElement).innerHTML))}
      />
    </div>
  )
}

function EditarPlaylist({ playlist, onSalvar, onFechar }: { playlist: Playlist; onSalvar: (c: Partial<Playlist>) => void; onFechar: () => void }) {
  const [c, setC] = useState({ name: playlist.name, modo: playlist.modo, canal: playlist.canal, descricao: playlist.descricao ?? '' })
  return (
    <Janela titulo={`Playlist: ${c.name || playlist.name}`} icone={faMusic} largura={480} onFechar={onFechar}>
      <form className="janela-form" onSubmit={(e) => { e.preventDefault(); onSalvar({ ...c, name: c.name.trim() || playlist.name, descricao: c.descricao || null }) }}>
        <Campo rotulo="Nome da Playlist"><input value={c.name} aria-label="Nome da Playlist" onChange={(e) => setC({ ...c, name: e.target.value })} /></Campo>
        <Campo rotulo="Modo Playback">
          <select value={c.modo} aria-label="Modo Playback" onChange={(e) => setC({ ...c, modo: e.target.value as ModoPlayback })}>
            {MODOS.map((m) => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Canal de Áudio">
          <select value={c.canal} aria-label="Canal de Áudio" onChange={(e) => setC({ ...c, canal: e.target.value as Canal })}>
            {CANAIS.map((x) => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Descrição da Playlist"><span /></Campo>
        <EditorTexto valor={c.descricao} rotulo="Descrição da Playlist" onMudar={(h) => setC((x) => ({ ...x, descricao: h }))} />
        <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faFloppyDisk} /> Atualizar Playlist</button>
      </form>
    </Janela>
  )
}

function SomDaPlaylist({ playlist, som, userId, onSalvar, onFechar }: {
  playlist: Playlist
  som?: SomPlaylist
  userId: string
  onSalvar: (c: Partial<SomPlaylist>) => Promise<string | null>
  onFechar: () => void
}) {
  const [c, setC] = useState({ name: som?.name ?? 'Novo Som', url: som?.url ?? '', canal: som?.canal ?? null, volume: som?.volume ?? 0.5, repetir: som?.repetir ?? false, descricao: som?.descricao ?? '' })
  const [aviso, setAviso] = useState<string | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  return (
    <Janela titulo={`Som da Playlist: ${c.name || 'Novo Som'}`} icone={faMusic} largura={500} onFechar={onFechar}>
      <form
        className="janela-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!c.url.trim()) {
            setAviso('Escolha o arquivo de áudio ou cole o link (do áudio ou do YouTube).')
            return
          }
          const erro = await onSalvar({ ...c, name: c.name.trim() || 'Som', url: c.url.trim(), descricao: c.descricao || null })
          if (erro) setAviso(erro)
        }}
      >
        <Campo rotulo="Nome da Faixa"><input value={c.name} aria-label="Nome da Faixa" onChange={(e) => setC({ ...c, name: e.target.value })} /></Campo>
        <Campo rotulo="Origem do Áudio" dica="Arquivo de áudio, link direto dele ou link do YouTube.">
          <div className="janela-cor">
            <input value={c.url} placeholder="Link do YouTube ou do áudio, ou escolha o arquivo" aria-label="Origem do Áudio" onChange={(e) => setC({ ...c, url: e.target.value })} />
            <button type="button" className="combate-icone" title="Escolher arquivo" aria-label="Escolher arquivo de áudio" onClick={() => arquivo.current?.click()}>
              <FontAwesomeIcon icon={faFileAudio} />
            </button>
            <input
              ref={arquivo}
              type="file"
              accept="audio/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setAviso('Enviando áudio…')
                const url = await enviarSom(userId, f)
                setAviso(url ? null : 'Não deu pra enviar o áudio.')
                if (url) setC((x) => ({ ...x, url, name: x.name === 'Novo Som' ? f.name.replace(/\.[^.]+$/, '') : x.name }))
              }}
            />
          </div>
        </Campo>
        <Campo rotulo="Canal do Áudio">
          <select value={c.canal ?? ''} aria-label="Canal do Áudio" onChange={(e) => setC({ ...c, canal: (e.target.value || null) as Canal | null })}>
            <option value="">Canal de Áudio da Playlist ({CANAIS.find((x) => x.id === playlist.canal)?.rotulo})</option>
            {CANAIS.map((x) => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Volume do Som"><Deslizante rotulo="Volume do Som" min={0} max={1} valor={c.volume} onMudar={(v) => setC({ ...c, volume: v })} /></Campo>
        <Campo rotulo="Repetir"><input type="checkbox" checked={c.repetir} aria-label="Repetir" onChange={(e) => setC({ ...c, repetir: e.target.checked })} /></Campo>
        <Campo rotulo="Descrição do Som"><span /></Campo>
        <EditorTexto valor={c.descricao} rotulo="Descrição do Som" onMudar={(h) => setC((x) => ({ ...x, descricao: h }))} />
        {aviso && <p className="janela-aviso">{aviso}</p>}
        <button type="submit" className="janela-botao"><FontAwesomeIcon icon={faFloppyDisk} /> {som ? 'Atualizar Som' : 'Criar Som'}</button>
      </form>
    </Janela>
  )
}
