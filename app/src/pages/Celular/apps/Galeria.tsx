// Galeria (fotos de recordação e as salvas das conversas) e Câmera (que guarda direto na galeria).
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCamera, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { useCelular } from '../estado'
import { texto } from '../textos'
import { escolherArquivo } from '../arquivos'
import { horaDaMensagem, type FotoDaGaleria } from '../dados'
import { useMostrarImagem } from '../../Mesa/mostrarImagem'

export default function AppGaleria({ camera }: { camera?: boolean }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const [aberta, setAberta] = useState<FotoDaGaleria | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const verImagem = useMostrarImagem()

  async function adicionar() {
    const f = await escolherArquivo(camera ? 'image/*' : 'image/*,video/*')
    if (!f) return
    setOcupado(true)
    const r = await e.acoes.enviarArquivo(f, f.name)
    if (r.url) setErro(await e.acoes.guardarNaGaleria({ url: r.url, tipo: f.type.startsWith('video/') ? 'video' : 'foto' }))
    else setErro(r.erro)
    setOcupado(false)
  }

  if ('npc' in e.eu) return <div className="cel-galeria"><p className="cel-vazio">O NPC não tem galeria.</p></div>

  if (aberta) {
    return (
      <div className="cel-galeria-foto">
        <header className="cel-topo-simples escuro">
          <button type="button" className="cel-link" onClick={() => setAberta(null)} aria-label="Voltar"><FontAwesomeIcon icon={faArrowLeft} /></button>
          <strong>{horaDaMensagem(e.tempo, aberta.minuto_no_jogo, aberta.created_at)}</strong>
          <button type="button" className="cel-link perigo" aria-label="Apagar" onClick={async () => { await e.acoes.apagarDaGaleria(aberta.id); setAberta(null) }}><FontAwesomeIcon icon={faTrash} /></button>
        </header>
        {aberta.tipo === 'video' ? <video src={aberta.url} controls autoPlay /> : <img src={aberta.url} alt="" className={verImagem ? 'clicavel' : undefined} onClick={() => verImagem?.ver(aberta.url, 'Foto da galeria')} />}
        {aberta.legenda && <p>{aberta.legenda}</p>}
      </div>
    )
  }

  if (camera) {
    return (
      <div className="cel-camera">
        <div className="cel-camera-visor"><FontAwesomeIcon icon={faCamera} /></div>
        <button type="button" className="cel-camera-disparo" disabled={ocupado} onClick={adicionar} aria-label={texto(idioma, 'tirarFoto')} />
        <p className="cel-dica">{ocupado ? '…' : texto(idioma, 'tirarFoto')}</p>
        {erro && <p className="cel-erro">{erro}</p>}
      </div>
    )
  }

  return (
    <div className="cel-galeria">
      <header className="cel-galeria-topo">
        <h1 className="cel-titulo-grande">{texto(idioma, 'galeria')}</h1>
        <button type="button" className="cel-link" disabled={ocupado} onClick={adicionar} aria-label={texto(idioma, 'adicionarFoto')}><FontAwesomeIcon icon={faPlus} /></button>
      </header>
      <div className="cel-galeria-grade">
        {e.galeria.map((f) => (
          <button key={f.id} type="button" className="cel-galeria-miniatura" onClick={() => setAberta(f)}>
            {f.tipo === 'video' ? <video src={f.url} muted /> : <img src={f.url} alt="" />}
          </button>
        ))}
      </div>
      {e.galeria.length === 0 && <p className="cel-vazio">{texto(idioma, 'semFotos')}</p>}
      {erro && <p className="cel-erro">{erro}</p>}
    </div>
  )
}
