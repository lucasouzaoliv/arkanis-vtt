// Notícias: manchetes que o mestre publica pra mesa ("Desaparecimento em Santo Berço"), com foto.
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { useCelular } from '../estado'
import { apagarNoticia, noticiasDa, publicarNoticia, useAoVivo, type Noticia } from '../dadosDosApps'
import { horaDaMensagem } from '../dados'
import { escolherImagem } from '../arquivos'
import { Topo, minutoAgora } from './comum'

export default function AppNoticias() {
  const e = useCelular()
  const campanha = e.celular.campaign_id
  const [lista, setLista] = useState<Noticia[]>([])
  const [aberta, setAberta] = useState<Noticia | null>(null)
  const [nova, setNova] = useState<{ titulo: string; texto: string; fonte: string; imagem: string | null } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useAoVivo('celular_noticias', `campaign_id=eq.${campanha}`, () => { void noticiasDa(campanha).then(setLista) })

  if (nova) {
    return (
      <div className="cel-noticias">
        <Topo titulo="Nova notícia" voltar={() => setNova(null)} />
        <div className="cel-form">
          <label className="cel-campo"><span>Manchete</span><input value={nova.titulo} maxLength={200} onChange={(ev) => setNova({ ...nova, titulo: ev.target.value })} /></label>
          <label className="cel-campo"><span>Jornal</span><input value={nova.fonte} maxLength={80} placeholder="Gazeta de Santo Berço" onChange={(ev) => setNova({ ...nova, fonte: ev.target.value })} /></label>
          <button type="button" className="cel-botao-secundario" onClick={async () => {
            const f = await escolherImagem('original', 'Foto da notícia')
            if (!f) return
            const r = await e.acoes.enviarArquivo(f, f.name)
            if (r.url) setNova((n) => (n ? { ...n, imagem: r.url } : n))
          }}><FontAwesomeIcon icon={faImage} /> {nova.imagem ? 'Trocar foto' : 'Foto'}</button>
          {nova.imagem && <img className="cel-noticia-foto" src={nova.imagem} alt="" />}
          <label className="cel-campo"><span>Texto</span><textarea className="cel-notas-texto" value={nova.texto} maxLength={20000} onChange={(ev) => setNova({ ...nova, texto: ev.target.value })} /></label>
          <button type="button" className="cel-botao-principal" onClick={async () => {
            if (!nova.titulo.trim()) { setErro('Escreva a manchete.'); return }
            const r = await publicarNoticia({ campanhaId: campanha, ...nova, minutoNoJogo: minutoAgora(e.tempo) })
            if (r) setErro(r)
            else { setNova(null); setLista(await noticiasDa(campanha)) }
          }}>Publicar</button>
          {erro && <p className="cel-erro">{erro}</p>}
        </div>
      </div>
    )
  }

  if (aberta) {
    return (
      <div className="cel-noticias">
        <Topo titulo={aberta.fonte || 'Notícias'} voltar={() => setAberta(null)} direita={e.souMestre && (
          <button type="button" className="cel-link perigo" aria-label="Apagar" onClick={async () => { await apagarNoticia(aberta.id); setAberta(null) }}><FontAwesomeIcon icon={faTrash} /></button>
        )} />
        <article className="cel-noticia">
          <h2>{aberta.titulo}</h2>
          <small>{aberta.fonte ? `${aberta.fonte} · ` : ''}{horaDaMensagem(e.tempo, aberta.minuto_no_jogo, aberta.created_at)}</small>
          {aberta.imagem && <img className="cel-noticia-foto" src={aberta.imagem} alt="" />}
          {(aberta.texto ?? '').split('\n').map((p, i) => <p key={i}>{p}</p>)}
        </article>
      </div>
    )
  }

  return (
    <div className="cel-noticias">
      <div className="cel-galeria-topo">
        <h1 className="cel-titulo-grande">Notícias</h1>
        {e.souMestre && <button type="button" className="cel-link" aria-label="Publicar notícia" onClick={() => setNova({ titulo: '', texto: '', fonte: '', imagem: null })}><FontAwesomeIcon icon={faPlus} /></button>}
      </div>
      <div className="cel-noticias-lista">
        {lista.map((n, i) => (
          <button key={n.id} type="button" className={`cel-noticia-cartao${i === 0 && n.imagem ? ' destaque' : ''}`} onClick={() => setAberta(n)}>
            {n.imagem && <img src={n.imagem} alt="" />}
            <span><small>{n.fonte || 'Notícias'}</small><strong>{n.titulo}</strong><small>{horaDaMensagem(e.tempo, n.minuto_no_jogo, n.created_at)}</small></span>
          </button>
        ))}
        {lista.length === 0 && <p className="cel-vazio">Nenhuma notícia por enquanto.</p>}
      </div>
    </div>
  )
}
