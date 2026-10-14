// Instagram: posts de quem está na mesa e dos NPCs (o mestre posta como NPC, pelo celular dele).
// "A vítima postou uma foto 2h antes de sumir…"
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInstagram } from '@fortawesome/free-brands-svg-icons'
import { faHeart, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { pessoa, useCelular } from '../estado'
import { apagarPost, curtir, postar, postsDa, useAoVivo, type Curtida, type Post } from '../dadosDosApps'
import { horaDaMensagem } from '../dados'
import { escolherImagem } from '../arquivos'
import { Avatar } from './Mensagens'
import { Topo, minutoAgora } from './comum'
import { useMostrarImagem } from '../../Mesa/mostrarImagem'

export default function AppInstagram() {
  const e = useCelular()
  const campanha = e.celular.campaign_id
  const meu = 'celular' in e.eu ? e.eu.celular : null
  const [posts, setPosts] = useState<Post[]>([])
  const [curtidas, setCurtidas] = useState<Curtida[]>([])
  const [novo, setNovo] = useState<{ imagem: string; legenda: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ver = useMostrarImagem()
  const recarregar = () => { void postsDa(campanha).then((r) => { setPosts(r.posts); setCurtidas(r.curtidas) }) }
  useAoVivo('celular_posts', `campaign_id=eq.${campanha}`, recarregar)
  useAoVivo('celular_curtidas', null, recarregar)

  async function escolher() {
    const f = await escolherImagem('quadrado', 'Foto do post')
    if (!f) return
    const r = await e.acoes.enviarArquivo(f, f.name)
    if (r.url) setNovo({ imagem: r.url, legenda: '' })
    else setErro(r.erro)
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

  return (
    <div className="cel-insta">
      <header className="cel-insta-topo">
        <strong><FontAwesomeIcon icon={faInstagram} /> Instagram</strong>
        <button type="button" className="cel-link" aria-label="Novo post" onClick={escolher}><FontAwesomeIcon icon={faPlus} /></button>
      </header>
      <div className="cel-insta-feed">
        {posts.map((p) => {
          const autor = pessoa(e, { celular: p.de_celular_id, npc: p.de_npc_id })
          const doPost = curtidas.filter((c) => c.post_id === p.id)
          const curti = !!meu && doPost.some((c) => c.celular_id === meu)
          const meuPost = (meu && p.de_celular_id === meu) || ('npc' in e.eu && p.de_npc_id === e.eu.npc)
          return (
            <article key={p.id} className="cel-insta-post">
              <header>
                <Avatar foto={autor.foto} tamanho={30} />
                <strong>{autor.nome}</strong>
                {(meuPost || e.souMestre) && <button type="button" className="cel-link perigo" aria-label="Apagar post" onClick={async () => { await apagarPost(p.id); recarregar() }}><FontAwesomeIcon icon={faTrash} /></button>}
              </header>
              <img className="cel-insta-foto" src={p.imagem} alt="" onClick={() => ver?.ver(p.imagem, autor.nome)} onDoubleClick={() => meu && !curti && curtir(p.id, meu, false).then(recarregar)} />
              <div className="cel-insta-acoes">
                <button type="button" className={`cel-link${curti ? ' curtido' : ''}`} disabled={!meu} aria-label="Curtir" onClick={() => meu && curtir(p.id, meu, curti).then(recarregar)}><FontAwesomeIcon icon={faHeart} /></button>
                <span>{doPost.length} {doPost.length === 1 ? 'curtida' : 'curtidas'}</span>
              </div>
              {p.legenda && <p className="cel-insta-legenda"><strong>{autor.nome}</strong> {p.legenda}</p>}
              <small className="cel-insta-hora">{horaDaMensagem(e.tempo, p.minuto_no_jogo, p.created_at)}</small>
            </article>
          )
        })}
        {posts.length === 0 && <p className="cel-vazio">Ninguém postou nada ainda.</p>}
        {erro && <p className="cel-erro">{erro}</p>}
      </div>
    </div>
  )
}
