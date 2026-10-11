import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronRight, faEllipsisVertical, faEye, faThumbtack, faTrash, faUser } from '@fortawesome/free-solid-svg-icons'
import AcaoNoChat from './AcaoNoChat'
import PartesDoDano from './PartesDoDano'
import { SimboloDoRitual, fundoDoRitual } from './RitualNoChat'
import { destinatario, ehPrivada, formulaDaRolagem, sanitizarHtml, tempoRelativo, type Mensagem } from './chat'

// Um card do chat (12.3): foto, nome, "Para:" nas privadas, tempo relativo e o ⋮ do mestre.
export default function ChatMensagem({ mensagem, souMestre, nomeMestre, agora, onDestacar, onRevelar, onExcluir }: {
  mensagem: Mensagem
  souMestre: boolean
  nomeMestre: string
  agora: Date
  onDestacar: () => void
  onRevelar: () => void
  onExcluir: () => void
}) {
  const [menu, setMenu] = useState(false)
  const [detalhe, setDetalhe] = useState(false)
  const privada = ehPrivada(mensagem)
  const para = destinatario(mensagem, nomeMestre, mensagem.autor_nome)
  const r = mensagem.rolagem

  function acao(fn: () => void) {
    setMenu(false)
    fn()
  }

  return (
    <article className={`chat-msg${privada ? ' chat-msg-privada' : ''}${mensagem.destacada ? ' chat-msg-destacada' : ''}`}>
      <header className="chat-msg-topo">
        <div className="chat-msg-foto">
          {mensagem.autor_foto ? <img src={mensagem.autor_foto} alt="" /> : <FontAwesomeIcon icon={faUser} />}
        </div>
        <div className="chat-msg-quem">
          <strong>{mensagem.autor_nome}</strong>
          {para && <span>Para: {para}</span>}
        </div>
        <time className="chat-msg-tempo" dateTime={mensagem.created_at} title={new Date(mensagem.created_at).toLocaleString('pt-BR')}>
          {tempoRelativo(mensagem.created_at, agora)}
        </time>
        {souMestre && (
          <div className="chat-msg-menu">
            <button type="button" className="chat-msg-menu-botao" aria-label="Opções da mensagem" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </button>
            {menu && (
              <>
                <div className="dropdown-backdrop" onClick={() => setMenu(false)} />
                <ul className="chat-msg-opcoes">
                  <li>
                    <button type="button" onClick={() => acao(onDestacar)}>
                      <FontAwesomeIcon icon={faThumbtack} /> {mensagem.destacada ? 'Remover Destaque' : 'Destacar Mensagem'}
                    </button>
                  </li>
                  {privada && (
                    <li>
                      <button type="button" onClick={() => acao(onRevelar)}>
                        <FontAwesomeIcon icon={faEye} /> Revelar para Todos
                      </button>
                    </li>
                  )}
                  <li>
                    <button type="button" onClick={() => acao(onExcluir)}>
                      <FontAwesomeIcon icon={faTrash} /> Excluir
                    </button>
                  </li>
                </ul>
              </>
            )}
          </div>
        )}
      </header>

      {r && (
        <div className={`chat-rolagem${r.ritual ? ' chat-rolagem-ritual' : ''}`} style={r.ritual ? fundoDoRitual(r.ritual.elemento) : undefined}>
          {r.ritual ? (
            <div className="chat-ritual-cabeca">
              <SimboloDoRitual ritual={r.ritual} />
              <p className="chat-rolagem-rotulo">{r.label}</p>
            </div>
          ) : (
            <p className="chat-rolagem-rotulo">{r.label}</p>
          )}
          {!r.sem_rolagem && (
            <>
              <div className="chat-rolagem-formula">{formulaDaRolagem(r)}</div>
              <button type="button" className="chat-rolagem-total" aria-expanded={detalhe} onClick={() => setDetalhe((v) => !v)}>
                <span>{r.total}</span>
                <FontAwesomeIcon icon={detalhe ? faChevronDown : faChevronRight} />
              </button>
            </>
          )}
          {detalhe && (
            <div className="chat-rolagem-dados">
              {r.dice?.length
                ? r.dice.map((d, i) => (
                    <span key={i} className={`chat-dado${d.discarded ? ' descartado' : ''}`} title={`d${d.sides}`}>
                      {d.value}
                    </span>
                  ))
                : r.detail}
              {r.bonus ? <span className="chat-rolagem-bonus">{r.bonus > 0 ? `+${r.bonus}` : r.bonus}</span> : null}
            </div>
          )}
          {r.partes && r.partes.length > 0 && <PartesDoDano partes={r.partes} />}
          {r.nota && <p className="chat-rolagem-nota">{r.nota}</p>}
        </div>
      )}

      {mensagem.acao && <AcaoNoChat mensagem={mensagem} />}

      {mensagem.conteudo && (
        <div className="chat-msg-texto" dangerouslySetInnerHTML={{ __html: sanitizarHtml(mensagem.conteudo) }} />
      )}
    </article>
  )
}
