// E-mail: caixa de entrada e enviados. O mestre manda como um NPC ou com um remetente escrito
// ("Ordo Realitas <missoes@ordo.org>") — o dossiê da missão, com anexos.
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperclip, faPenToSquare, faTrash, faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { pessoa, useCelular } from '../estado'
import { apagarEmail, emailsDo, emailsDoNpc, mandarEmail, marcarEmailLido, useAoVivo, type Email } from '../dadosDosApps'
import { horaDaMensagem } from '../dados'
import { escolherArquivo } from '../arquivos'
import { Avatar } from './Mensagens'
import { Topo, minutoAgora } from './comum'
import { useMostrarImagem } from '../../Mesa/mostrarImagem'

type Rascunho = { para: string; remetente: string; assunto: string; corpo: string; anexos: { nome: string; url: string }[] }

export default function AppEmail() {
  const e = useCelular()
  const campanha = e.celular.campaign_id
  const meu = 'celular' in e.eu ? e.eu.celular : null
  const npc = 'npc' in e.eu ? e.eu.npc : null
  const [emails, setEmails] = useState<Email[]>([])
  const [caixa, setCaixa] = useState<'entrada' | 'enviados'>('entrada')
  const [aberto, setAberto] = useState<Email | null>(null)
  const [escrevendo, setEscrevendo] = useState<Rascunho | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ver = useMostrarImagem()
  const recarregar = () => { void (meu ? emailsDo(meu) : npc ? emailsDoNpc(npc) : Promise.resolve([])).then(setEmails) }
  useAoVivo('celular_emails', `campaign_id=eq.${campanha}`, recarregar)

  const remetenteDe = (m: Email) => (m.remetente ? { nome: m.remetente, foto: null } : pessoa(e, { celular: m.de_celular_id, npc: m.de_npc_id }))
  const lista = emails.filter((m) => (npc ? true : caixa === 'entrada' ? m.para_celular_id === meu : m.de_celular_id === meu))
  const naoLidos = emails.filter((m) => m.para_celular_id === meu && !m.lido).length

  if (escrevendo) {
    return (
      <div className="cel-email">
        <Topo titulo="Escrever" voltar={() => setEscrevendo(null)} />
        <div className="cel-form">
          <label className="cel-campo"><span>Para</span>
            <select className="cel-input" value={escrevendo.para} onChange={(ev) => setEscrevendo({ ...escrevendo, para: ev.target.value })}>
              <option value="">Escolha…</option>
              {e.celulares.filter((c) => c.id !== meu).map((c) => <option key={c.id} value={c.id}>{c.nome_no_perfil || c.numero}</option>)}
            </select>
          </label>
          {e.souMestre && !npc && (
            <label className="cel-campo"><span>De (deixe vazio pra mandar deste celular)</span>
              <input value={escrevendo.remetente} placeholder="Ordo Realitas <missoes@ordo.org>" onChange={(ev) => setEscrevendo({ ...escrevendo, remetente: ev.target.value })} />
            </label>
          )}
          <label className="cel-campo"><span>Assunto</span><input value={escrevendo.assunto} maxLength={200} onChange={(ev) => setEscrevendo({ ...escrevendo, assunto: ev.target.value })} /></label>
          <textarea className="cel-notas-texto" placeholder="Escreva o e-mail…" value={escrevendo.corpo} maxLength={20000} onChange={(ev) => setEscrevendo({ ...escrevendo, corpo: ev.target.value })} />
          <div className="cel-email-anexos">
            {escrevendo.anexos.map((a, i) => (
              <span key={a.url} className="cel-email-anexo">
                <FontAwesomeIcon icon={faPaperclip} /> {a.nome}
                <button type="button" className="cel-link perigo" onClick={() => setEscrevendo({ ...escrevendo, anexos: escrevendo.anexos.filter((_, j) => j !== i) })}>×</button>
              </span>
            ))}
            <button type="button" className="cel-botao-secundario" onClick={async () => {
              const f = await escolherArquivo('*/*')
              if (!f) return
              const r = await e.acoes.enviarArquivo(f, f.name)
              if (r.url) setEscrevendo((x) => (x ? { ...x, anexos: [...x.anexos, { nome: f.name, url: r.url! }] } : x))
              else setErro(r.erro)
            }}><FontAwesomeIcon icon={faPaperclip} /> Anexar</button>
          </div>
          <button type="button" className="cel-botao-principal" onClick={async () => {
            if (!escrevendo.para || !escrevendo.assunto.trim()) { setErro('Escolha pra quem e escreva o assunto.'); return }
            const r = await mandarEmail({
              campanhaId: campanha, para: escrevendo.para, assunto: escrevendo.assunto, corpo: escrevendo.corpo, anexos: escrevendo.anexos,
              ...(escrevendo.remetente.trim() ? { remetente: escrevendo.remetente } : { de: e.eu }), minutoNoJogo: minutoAgora(e.tempo),
            })
            if (r) setErro(r)
            else { setEscrevendo(null); recarregar() }
          }}><FontAwesomeIcon icon={faPaperPlane} /> Enviar</button>
          {erro && <p className="cel-erro">{erro}</p>}
        </div>
      </div>
    )
  }

  if (aberto) {
    const de = remetenteDe(aberto)
    const para = pessoa(e, { celular: aberto.para_celular_id })
    return (
      <div className="cel-email">
        <Topo titulo="" voltar={() => setAberto(null)} direita={
          <button type="button" className="cel-link perigo" aria-label="Apagar" onClick={async () => { await apagarEmail(aberto.id); setAberto(null); recarregar() }}><FontAwesomeIcon icon={faTrash} /></button>
        } />
        <article className="cel-email-ler">
          <h2>{aberto.assunto}</h2>
          <div className="cel-email-de">
            <Avatar foto={de.foto} tamanho={36} />
            <span><strong>{de.nome}</strong><small>para {para.nome} · {horaDaMensagem(e.tempo, aberto.minuto_no_jogo, aberto.created_at)}</small></span>
          </div>
          {(aberto.corpo ?? '').split('\n').map((p, i) => <p key={i}>{p}</p>)}
          {aberto.anexos.length > 0 && (
            <div className="cel-email-anexos">
              {aberto.anexos.map((a) => (/\.(png|jpe?g|webp|gif)$/i.test(a.nome) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(a.url)
                ? <button key={a.url} type="button" className="cel-email-anexo" onClick={() => ver ? ver.ver(a.url, a.nome) : window.open(a.url, '_blank', 'noopener')}><FontAwesomeIcon icon={faPaperclip} /> {a.nome}</button>
                : <a key={a.url} className="cel-email-anexo" href={a.url} target="_blank" rel="noreferrer"><FontAwesomeIcon icon={faPaperclip} /> {a.nome}</a>))}
            </div>
          )}
        </article>
      </div>
    )
  }

  return (
    <div className="cel-email">
      <div className="cel-galeria-topo">
        <h1 className="cel-titulo-grande">{npc ? 'Enviados' : caixa === 'entrada' ? 'Entrada' : 'Enviados'}</h1>
        <button type="button" className="cel-link" aria-label="Escrever" onClick={() => setEscrevendo({ para: '', remetente: '', assunto: '', corpo: '', anexos: [] })}><FontAwesomeIcon icon={faPenToSquare} /></button>
      </div>
      {!npc && (
        <div className="cel-abas">
          <button type="button" className={caixa === 'entrada' ? 'ativo' : ''} onClick={() => setCaixa('entrada')}>Entrada{naoLidos ? ` (${naoLidos})` : ''}</button>
          <button type="button" className={caixa === 'enviados' ? 'ativo' : ''} onClick={() => setCaixa('enviados')}>Enviados</button>
        </div>
      )}
      <div className="cel-lista">
        {lista.map((m) => {
          const de = caixa === 'entrada' && !npc ? remetenteDe(m) : pessoa(e, { celular: m.para_celular_id })
          const novo = m.para_celular_id === meu && !m.lido
          return (
            <button key={m.id} type="button" className={`cel-lista-item cel-pessoa cel-email-item${novo ? ' novo' : ''}`} onClick={() => { setAberto(m); if (novo) void marcarEmailLido(m.id).then(recarregar) }}>
              <Avatar foto={de.foto} tamanho={34} />
              <span><strong>{de.nome}</strong><b>{m.assunto}</b><small>{(m.corpo ?? '').replace(/\s+/g, ' ').slice(0, 70)}</small></span>
              <small>{horaDaMensagem(e.tempo, m.minuto_no_jogo, m.created_at)}{m.anexos.length ? ' 📎' : ''}</small>
            </button>
          )
        })}
        {lista.length === 0 && <p className="cel-vazio">Nenhum e-mail.</p>}
      </div>
    </div>
  )
}
