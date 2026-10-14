// Instagram: posts de quem está na mesa e dos NPCs (o mestre posta como NPC, pelo celular dele).
// "A vítima postou uma foto 2h antes de sumir…" Curtir (botão ou dois cliques na foto) e comentar
// valem pros dois: celular e NPC (pedido 14/10).
import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInstagram } from '@fortawesome/free-brands-svg-icons'
import { faComment, faHeart, faPaperPlane, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { ehEu, pessoa, useCelular } from '../estado'
import { apagarComentario, apagarPost, comentar, curtir, postar, postsDa, useAoVivo, type Comentario, type Curtida, type Post } from '../dadosDosApps'
import { horaDaMensagem } from '../dados'
import { escolherImagem } from '../arquivos'
import { Avatar } from './Mensagens'
import { Topo, minutoAgora } from './comum'
import { useMostrarImagem } from '../../Mesa/mostrarImagem'

export default function AppInstagram() {
  const e = useCelular()
  const campanha = e.celular.campaign_id
  const [posts, setPosts] = useState<Post[]>([])
  const [curtidas, setCurtidas] = useState<Curtida[]>([])
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [novo, setNovo] = useState<{ imagem: string; legenda: string } | null>(null)
  const [comentando, setComentando] = useState<string | null>(null)
  const [escrito, setEscrito] = useState('')
  const [coracao, setCoracao] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ver = useMostrarImagem()
  // Um clique abre a foto grande; o segundo clique (curtir) cancela a abertura.
  const abrirFoto = useRef<number | undefined>(undefined)
  const recarregar = () => { void postsDa(campanha).then((r) => { setPosts(r.posts); setCurtidas(r.curtidas); setComentarios(r.comentarios) }) }
  useAoVivo('celular_posts', `campaign_id=eq.${campanha}`, recarregar)
  useAoVivo('celular_curtidas', null, recarregar)
  useAoVivo('celular_comentarios', null, recarregar)

  const curtiu = (postId: string) => curtidas.some((c) => c.post_id === postId && ehEu(e.eu, { celular: c.celular_id, npc: c.npc_id }))

  async function alternarCurtida(postId: string, forcarCurtir = false) {
    const ja = curtiu(postId)
    if (ja && forcarCurtir) return
    // Na hora, antes do banco responder (como no app de verdade).
    setCurtidas((l) => (ja
      ? l.filter((c) => !(c.post_id === postId && ehEu(e.eu, { celular: c.celular_id, npc: c.npc_id })))
      : [...l, { post_id: postId, celular_id: 'celular' in e.eu ? e.eu.celular : null, npc_id: 'npc' in e.eu ? e.eu.npc : null }]))
    const r = await curtir(postId, e.eu, ja)
    if (r) { setErro(r); recarregar() }
  }

  async function escolher() {
    const f = await escolherImagem('quadrado', 'Foto do post')
    if (!f) return
    const r = await e.acoes.enviarArquivo(f, f.name)
    if (r.url) setNovo({ imagem: r.url, legenda: '' })
    else setErro(r.erro)
  }

  async function mandarComentario(postId: string) {
    const t = escrito.trim()
    if (!t) return
    setEscrito('')
    const r = await comentar(postId, e.eu, t, minutoAgora(e.tempo))
    if (r) setErro(r)
    recarregar()
  }

  if (novo) {
    return (
      <div className="cel-insta">
        <Topo titulo="Novo post" voltar={() => setNovo(null)} />
        <img className="cel-insta-foto" src={novo.imagem} alt="" />
        <div className="cel-form">
          <label className="cel-campo"><span>Legenda</span><textarea className="cel-notas-texto pequeno" value={novo.legenda} maxLength={2200} onChange={(ev) => setNovo({ ...novo, legenda: ev.target.value })} /></label>
          <button type="button" className="cel-botao-principal" onClick={async () => {
            const r = await postar({ campanhaId: campanha, de: e.eu, imagem: novo.imagem, legenda: novo.legenda, minutoNoJogo: minutoAgora(e.tempo) })
            if (r) setErro(r)
            else { setNovo(null); recarregar() }
          }}>Compartilhar</button>
          {erro && <p className="cel-erro">{erro}</p>}
        </div>
      </div>
    )
  }

  // Tela de comentários de um post.
  const post = comentando ? posts.find((p) => p.id === comentando) : null
  if (post) {
    const autor = pessoa(e, { celular: post.de_celular_id, npc: post.de_npc_id })
    const doPost = comentarios.filter((c) => c.post_id === post.id)
    return (
      <div className="cel-insta">
        <Topo titulo="Comentários" voltar={() => setComentando(null)} />
        <div className="cel-insta-comentarios">
          {post.legenda && (
            <div className="cel-insta-comentario legenda">
              <Avatar foto={autor.foto} tamanho={30} />
              <p><strong>{autor.nome}</strong> {post.legenda}</p>
            </div>
          )}
          {doPost.map((c) => {
            const quem = pessoa(e, { celular: c.de_celular_id, npc: c.de_npc_id })
            const meu = ehEu(e.eu, { celular: c.de_celular_id, npc: c.de_npc_id })
            return (
              <div key={c.id} className="cel-insta-comentario">
                <Avatar foto={quem.foto} tamanho={30} />
                <p><strong>{quem.nome}</strong> {c.texto}<small>{horaDaMensagem(e.tempo, c.minuto_no_jogo, c.created_at)}</small></p>
                {(meu || e.souMestre) && <button type="button" className="cel-link perigo" aria-label="Apagar comentário" onClick={async () => { await apagarComentario(c.id); recarregar() }}><FontAwesomeIcon icon={faTrash} /></button>}
              </div>
            )
          })}
          {doPost.length === 0 && <p className="cel-vazio">Ainda não há comentários.</p>}
        </div>
        {erro && <p className="cel-erro" onClick={() => setErro(null)}>{erro}</p>}
        <footer className="cel-insta-escrever">
          <Avatar foto={e.celular.foto_perfil} tamanho={30} />
          <input
            placeholder="Adicione um comentário…"
            value={escrito}
            maxLength={1000}
            onChange={(ev) => setEscrito(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); void mandarComentario(post.id) } }}
          />
          <button type="button" className="cel-link" disabled={!escrito.trim()} aria-label="Publicar comentário" onClick={() => mandarComentario(post.id)}><FontAwesomeIcon icon={faPaperPlane} /></button>
        </footer>
      </div>
    )
  }

  return (
    <div className="cel-insta">
      <header className="cel-insta-topo">
        <strong><FontAwesomeIcon icon={faInstagram} /> Instagram</strong>
        <button type="button" className="cel-link" aria-label="Novo post" onClick={escolher}><FontAwesomeIcon icon={faPlus} /></button>
      </header>
      <div className="cel-insta-feed">
        {posts.map((p) => {
          const autor = pessoa(e, { celular: p.de_celular_id, npc: p.de_npc_id })
          const nCurtidas = curtidas.filter((c) => c.post_id === p.id).length
          const doPost = comentarios.filter((c) => c.post_id === p.id)
          const curti = curtiu(p.id)
          const meuPost = ehEu(e.eu, { celular: p.de_celular_id, npc: p.de_npc_id })
          return (
            <article key={p.id} className="cel-insta-post">
              <header>
                <Avatar foto={autor.foto} tamanho={30} />
                <strong>{autor.nome}</strong>
                {(meuPost || e.souMestre) && <button type="button" className="cel-link perigo" aria-label="Apagar post" onClick={async () => { await apagarPost(p.id); recarregar() }}><FontAwesomeIcon icon={faTrash} /></button>}
              </header>
              {/* Dois cliques curtem (com o coração pulando), um clique abre a foto grande. */}
              <div className="cel-insta-foto-caixa">
                <img
                  className="cel-insta-foto"
                  src={p.imagem}
                  alt=""
                  onClick={(ev) => { if (ev.detail === 1) abrirFoto.current = window.setTimeout(() => ver?.ver(p.imagem, autor.nome), 280) }}
                  onDoubleClick={() => { window.clearTimeout(abrirFoto.current); setCoracao(p.id); window.setTimeout(() => setCoracao(null), 800); void alternarCurtida(p.id, true) }}
                />
                {coracao === p.id && <FontAwesomeIcon icon={faHeart} className="cel-insta-coracao" />}
              </div>
              <div className="cel-insta-acoes">
                <button type="button" className={`cel-link${curti ? ' curtido' : ''}`} aria-label={curti ? 'Descurtir' : 'Curtir'} onClick={() => alternarCurtida(p.id)}><FontAwesomeIcon icon={faHeart} /></button>
                <button type="button" className="cel-link" aria-label="Comentar" onClick={() => setComentando(p.id)}><FontAwesomeIcon icon={faComment} /></button>
              </div>
              <p className="cel-insta-curtidas">{nCurtidas} {nCurtidas === 1 ? 'curtida' : 'curtidas'}</p>
              {p.legenda && <p className="cel-insta-legenda"><strong>{autor.nome}</strong> {p.legenda}</p>}
              {doPost.length > 2 && <button type="button" className="cel-insta-ver" onClick={() => setComentando(p.id)}>Ver todos os {doPost.length} comentários</button>}
              {doPost.slice(-2).map((c) => (
                <p key={c.id} className="cel-insta-legenda"><strong>{pessoa(e, { celular: c.de_celular_id, npc: c.de_npc_id }).nome}</strong> {c.texto}</p>
              ))}
              <button type="button" className="cel-insta-ver" onClick={() => setComentando(p.id)}>Adicione um comentário…</button>
              <small className="cel-insta-hora">{horaDaMensagem(e.tempo, p.minuto_no_jogo, p.created_at)}</small>
            </article>
          )
        })}
        {posts.length === 0 && <p className="cel-vazio">Ninguém postou nada ainda.</p>}
        {erro && <p className="cel-erro" onClick={() => setErro(null)}>{erro}</p>}
      </div>
    </div>
  )
}
