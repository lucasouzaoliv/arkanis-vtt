import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBullhorn, faEye, faFileLines, faPen, faPlus, faThumbtack, faTrash, faUpload, faXmark } from '@fortawesome/free-solid-svg-icons'
import Janela from './Janela'
import { ESTILOS_DOCUMENTO, paragrafos, podeLer, type Documento, type EstiloDocumento } from './documentos'

// Lista dos documentos (KAN-118). Mestre: cria, edita, mostra pra todos e vê quem achou.
// Jogador: os que ele achou (ou o mestre mostrou).
export function JanelaDocumentos({ documentos, souMestre, userId, onAbrir, onNovo, onEditar, onExcluir, onRevelar, onFechar }: {
  documentos: Documento[]
  souMestre: boolean
  userId: string
  onAbrir: (d: Documento) => void
  onNovo?: () => void
  onEditar?: (d: Documento) => void
  onExcluir?: (d: Documento) => void
  onRevelar?: (d: Documento, revelar: boolean) => void
  onFechar: () => void
}) {
  const lista = documentos.filter((d) => podeLer(d, userId, souMestre))
  const [apagando, setApagando] = useState<string | null>(null)
  return (
    <Janela titulo="Documentos" icone={faFileLines} largura={420} onFechar={onFechar}>
      <div className="janela-form documentos">
        {souMestre && (
          <p className="janela-dica documentos-dica">
            Pra esconder um documento no mapa: botão direito no mapa vazio → <b>Esconder Documento</b>. O jogador que clicar no papel acha e lê.
          </p>
        )}
        {!lista.length && <p className="documentos-vazio">{souMestre ? 'Nenhum documento ainda.' : 'Você ainda não achou nenhum documento.'}</p>}
        <ul className="documentos-lista">
          {lista.map((d) => (
            <li key={d.id} className={`documentos-item estilo-${d.estilo}`}>
              <button type="button" className="documentos-abrir" onClick={() => onAbrir(d)}>
                <span className="documentos-titulo">{d.titulo || 'Sem título'}</span>
                <span className="documentos-sub">
                  {ESTILOS_DOCUMENTO.find((e) => e.id === d.estilo)?.rotulo}
                  {souMestre && (d.revelado_todos ? ' · mostrado pra todos' : d.encontrado_por.length ? ` · achado por ${d.encontrado_por.length}` : ' · ninguém achou')}
                </span>
              </button>
              {souMestre && (
                <span className="documentos-acoes">
                  <button type="button" title={d.revelado_todos ? 'Esconder de novo (só quem achou lê)' : 'Mostrar pra todos agora (abre na tela deles)'} className={d.revelado_todos ? 'ativo' : ''} onClick={() => onRevelar?.(d, !d.revelado_todos)}>
                    <FontAwesomeIcon icon={faBullhorn} />
                  </button>
                  <button type="button" title="Editar" onClick={() => onEditar?.(d)}><FontAwesomeIcon icon={faPen} /></button>
                  {apagando === d.id ? (
                    <button type="button" className="perigo" title="Confirmar: excluir de vez" onClick={() => { setApagando(null); onExcluir?.(d) }}>Excluir?</button>
                  ) : (
                    <button type="button" title="Excluir" onClick={() => setApagando(d.id)}><FontAwesomeIcon icon={faTrash} /></button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
        {souMestre && (
          <button type="button" className="janela-botao janela-botao-destaque" onClick={onNovo}>
            <FontAwesomeIcon icon={faPlus} /> Novo documento
          </button>
        )}
      </div>
    </Janela>
  )
}

// Abre do lado da lista de Documentos (no mesmo lugar, uma tampava a outra e parecia que não fechava).
function posicaoDoEditor() {
  const lista = Math.max(16, (window.innerWidth - 420) / 2 - 160)
  return { x: Math.max(16, Math.min(window.innerWidth - 540, lista + 436)), y: 80 }
}

// Editor do mestre: salva sozinho um instante depois de parar de digitar.
export function EditorDeDocumento({ documento, onSalvar, onVer, onEnviarImagem, onFechar }: {
  documento: Documento
  onSalvar: (campos: Partial<Documento>) => void
  onVer: () => void
  onEnviarImagem: (f: File) => Promise<string | null>
  onFechar: () => void
}) {
  const [d, setD] = useState(documento)
  const pendente = useRef<Partial<Documento>>({})
  const timer = useRef<number | undefined>(undefined)
  const [enviando, setEnviando] = useState(false)
  const mudar = (c: Partial<Documento>) => {
    setD((x) => ({ ...x, ...c }))
    pendente.current = { ...pendente.current, ...c }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      onSalvar(pendente.current)
      pendente.current = {}
    }, 500)
  }
  // Fechou com coisa por salvar: salva já.
  useEffect(() => () => {
    window.clearTimeout(timer.current)
    if (Object.keys(pendente.current).length) onSalvar(pendente.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Janela titulo="Editar Documento" icone={faPen} largura={520} inicial={posicaoDoEditor()} onFechar={onFechar}>
      <div className="janela-form documento-editor">
        <label className="janela-campo">
          <span className="janela-rotulo">Título</span>
          <input value={d.titulo} onChange={(e) => mudar({ titulo: e.target.value })} placeholder="Ex.: Carta da Irmã Lúcia" />
        </label>
        <label className="janela-campo">
          <span className="janela-rotulo">Estilo</span>
          <select value={d.estilo} onChange={(e) => mudar({ estilo: e.target.value as EstiloDocumento })}>
            {ESTILOS_DOCUMENTO.map((e) => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
          </select>
          <p className="janela-dica">{ESTILOS_DOCUMENTO.find((e) => e.id === d.estilo)?.dica}</p>
        </label>
        <label className="documento-editor-texto">
          <span className="janela-rotulo">Texto</span>
          <textarea rows={10} value={d.texto} onChange={(e) => mudar({ texto: e.target.value })} placeholder="Uma linha em branco separa os parágrafos." />
        </label>
        <label className="janela-campo">
          <span className="janela-rotulo">Assinatura</span>
          <input value={d.assinatura ?? ''} onChange={(e) => mudar({ assinatura: e.target.value || null })} placeholder="(opcional)" />
        </label>
        <div className="janela-campo">
          <span className="janela-rotulo">Imagem</span>
          <div className="documento-editor-imagem">
            <input value={d.imagem_url ?? ''} onChange={(e) => mudar({ imagem_url: e.target.value || null })} placeholder="Link da imagem (opcional)" />
            <label className="janela-botao" title="Enviar uma imagem do computador">
              <FontAwesomeIcon icon={faUpload} /> {enviando ? '…' : 'Enviar'}
              <input
                type="file" accept="image/*" hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  setEnviando(true)
                  const url = await onEnviarImagem(f)
                  setEnviando(false)
                  if (url) mudar({ imagem_url: url })
                }}
              />
            </label>
          </div>
        </div>
        <button type="button" className="janela-botao janela-botao-destaque" onClick={() => { if (Object.keys(pendente.current).length) { onSalvar(pendente.current); pendente.current = {} } onVer() }}>
          <FontAwesomeIcon icon={faEye} /> Ver como os jogadores veem
        </button>
      </div>
    </Janela>
  )
}

// O documento aberto na tela, como papel de verdade (cada estilo é um papel).
export function LeitorDeDocumento({ documento, onPrender, onFechar }: { documento: Documento; onPrender?: () => void; onFechar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onFechar])
  const d = documento
  const ps = paragrafos(d.texto)
  return (
    <div className="documento-fundo" role="dialog" aria-label={d.titulo} onPointerDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <article className={`documento-papel estilo-${d.estilo}`}>
        {d.estilo === 'jornal' && <header className="documento-jornal-cabeca"><span>Gazeta de São Paulo</span></header>}
        {d.estilo === 'relatorio' && (
          <header className="documento-relatorio-cabeca">
            <span>Ordo Realitas</span>
            <span>Relatório de campo</span>
            <i className="documento-carimbo">Confidencial</i>
          </header>
        )}
        {d.titulo && <h2 className="documento-titulo">{d.titulo}</h2>}
        {d.imagem_url && (
          <figure className="documento-imagem">
            <img src={d.imagem_url} alt="" />
          </figure>
        )}
        <div className="documento-texto">
          {ps.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        {d.assinatura && <p className="documento-assinatura">{d.assinatura}</p>}
      </article>
      <div className="documento-botoes">
        {onPrender && (
          <button type="button" className="janela-botao" onClick={onPrender}>
            <FontAwesomeIcon icon={faThumbtack} /> Prender no quadro de pistas
          </button>
        )}
        <button type="button" className="janela-botao" onClick={onFechar}>
          <FontAwesomeIcon icon={faXmark} /> Fechar
        </button>
      </div>
    </div>
  )
}
