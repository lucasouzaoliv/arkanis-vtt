// Telefone: contatos, recentes (ligações feitas, recebidas e perdidas) e teclado. Ligar abre a tela
// de ligação no celular de quem recebe (o mestre atende pelos NPCs).
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAddressBook, faClock, faDeleteLeft, faPhone, faStar, faTableCells, faVoicemail } from '@fortawesome/free-solid-svg-icons'
import { ehEu, pessoa, useCelular, type Pessoa } from '../estado'
import { horaDaMensagem, type Lado } from '../dados'
import { texto } from '../textos'
import { Avatar } from './Mensagens'
import FichaDoContato from './FichaDoContato'

type Aba = 'favoritos' | 'recentes' | 'contatos' | 'teclado' | 'correio'

export default function AppTelefone() {
  const e = useCelular()
  const idioma = e.celular.idioma
  const [aba, setAba] = useState<Aba>('contatos')
  const [digitado, setDigitado] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<string | null>(null)

  async function ligar(para: Lado) {
    const r = await e.acoes.ligar(para)
    if (r.erro) setErro(r.erro)
  }

  const agenda: (Pessoa & { contatoId?: string; favorito?: boolean })[] = 'npc' in e.eu
    ? e.celulares.map((c) => pessoa(e, { celular: c.id }))
    : e.contatos.map((k) => ({ ...pessoa(e, { celular: k.contato_celular_id, npc: k.npc_id }), contatoId: k.id, favorito: k.favorito }))
  agenda.sort((a, b) => a.nome.localeCompare(b.nome))

  // Recados de voz que me deixaram (áudios marcados como correio, nas conversas comigo).
  const recados = Object.values(e.mensagens).flat()
    .filter((m) => m.tipo === 'audio' && m.arquivo?.correio && !m.apagada && m.estado === 'enviada' && !ehEu(e.eu, { celular: m.de_celular_id, npc: m.de_npc_id })
      && e.participantes.some((p) => p.conversa_id === m.conversa_id && !p.saiu_em && ehEu(e.eu, { celular: p.celular_id, npc: p.npc_id })))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))

  const minhas = e.ligacoes.filter((l) => ehEu(e.eu, { celular: l.de_celular_id, npc: l.de_npc_id }) || ehEu(e.eu, { celular: l.para_celular_id, npc: l.para_npc_id }))

  // Teclado: o número digitado liga pra quem tem esse número (na mesa ou na agenda).
  function ligarDigitado() {
    const so = (t: string | null) => (t ?? '').replace(/\D/g, '')
    const alvo = so(digitado)
    const c = e.celulares.find((x) => so(x.numero) === alvo)
    if (c) return void ligar({ celular: c.id })
    const n = e.npcs.find((x) => so(x.numero) === alvo)
    if (n) return void ligar({ npc: n.id })
    setErro('Número não encontrado.')
  }

  const contato = detalhe ? e.contatos.find((k) => k.id === detalhe) : null

  if (contato) {
    // Editar nome, foto e número do contato (14/10).
    return <FichaDoContato quem={contato.contato_celular_id ? { celular: contato.contato_celular_id } : { npc: contato.npc_id! }} voltar={() => setDetalhe(null)} />
  }

  return (
    <div className="cel-telefone">
      <div className="cel-telefone-corpo">
        {aba === 'correio' ? (
          <>
            <h1 className="cel-titulo-grande">Correio de voz</h1>
            <div className="cel-lista">
              {recados.map((m) => {
                const de = pessoa(e, { celular: m.de_celular_id, npc: m.de_npc_id })
                return (
                  <div key={m.id} className="cel-lista-item cel-pessoa cel-recado-item">
                    <Avatar foto={de.foto} tamanho={32} />
                    <span><strong>{de.nome}</strong><small>{horaDaMensagem(e.tempo, m.minuto_no_jogo, m.created_at)}{m.arquivo?.duracao ? ` · ${m.arquivo.duracao}s` : ''}</small>
                      {m.arquivo_url && <audio src={m.arquivo_url} controls className="cel-balao-audio" />}
                    </span>
                  </div>
                )
              })}
              {recados.length === 0 && <p className="cel-vazio">Nenhum recado.</p>}
            </div>
          </>
        ) : aba === 'teclado' ? (
          <div className="cel-teclado">
            <div className="cel-teclado-visor">{digitado || ' '}</div>
            <div className="cel-teclado-grade">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                <button key={d} type="button" onClick={() => setDigitado((v) => (v + d).slice(0, 20))}>{d}</button>
              ))}
            </div>
            <div className="cel-teclado-fim">
              <span />
              <button type="button" className="cel-ligacao-botao atender" onClick={ligarDigitado} aria-label="Ligar"><FontAwesomeIcon icon={faPhone} /></button>
              <button type="button" className="cel-link" onClick={() => setDigitado((v) => v.slice(0, -1))} aria-label="Apagar"><FontAwesomeIcon icon={faDeleteLeft} /></button>
            </div>
          </div>
        ) : aba === 'recentes' ? (
          <>
            <h1 className="cel-titulo-grande">{texto(idioma, 'recentes')}</h1>
            <div className="cel-lista">
              {minhas.map((l) => {
                const saiu = ehEu(e.eu, { celular: l.de_celular_id, npc: l.de_npc_id })
                const p = saiu ? pessoa(e, { celular: l.para_celular_id, npc: l.para_npc_id }) : pessoa(e, { celular: l.de_celular_id, npc: l.de_npc_id })
                const perdida = !saiu && (l.estado === 'perdida' || l.estado === 'recusada')
                return (
                  <button key={l.id} type="button" className={`cel-lista-item cel-pessoa${perdida ? ' perdida' : ''}`} onClick={() => void ligar(p.lado)}>
                    <Avatar foto={p.foto} tamanho={32} />
                    <span><strong>{p.nome}</strong><small>{saiu ? '↗' : '↙'} {l.estado === 'sem_sinal' ? texto(idioma, 'semServico') : l.estado === 'perdida' ? texto(idioma, 'perdida') : l.estado === 'recusada' ? texto(idioma, 'recusada') : ''}</small></span>
                    <small>{horaDaMensagem(e.tempo, l.minuto_no_jogo, l.iniciada_em)}</small>
                  </button>
                )
              })}
              {minhas.length === 0 && <p className="cel-vazio">—</p>}
            </div>
          </>
        ) : (
          <>
            <h1 className="cel-titulo-grande">{aba === 'favoritos' ? texto(idioma, 'favoritos') : texto(idioma, 'contatos')}</h1>
            <div className="cel-lista">
              {agenda.filter((p) => aba !== 'favoritos' || p.favorito).map((p) => (
                <div key={'celular' in p.lado ? p.lado.celular : p.lado.npc} className="cel-lista-item cel-pessoa">
                  <button type="button" className="cel-pessoa-botao" onClick={() => p.contatoId && setDetalhe(p.contatoId)}>
                    <Avatar foto={p.foto} tamanho={32} /><span><strong>{p.nome}</strong><small>{p.numero}</small></span>
                  </button>
                  <button type="button" className="cel-link cel-ligar" aria-label="Ligar" onClick={() => void ligar(p.lado)}><FontAwesomeIcon icon={faPhone} /></button>
                </div>
              ))}
              {agenda.length === 0 && <p className="cel-vazio">Adicione contatos pelo app de Mensagens.</p>}
            </div>
          </>
        )}
        {erro && <p className="cel-erro" onClick={() => setErro(null)}>{erro}</p>}
      </div>
      <nav className="cel-abas-baixo">
        {([['favoritos', faStar], ['recentes', faClock], ['contatos', faAddressBook], ['teclado', faTableCells], ['correio', faVoicemail]] as const).map(([id, icone]) => (
          <button key={id} type="button" className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>
            <FontAwesomeIcon icon={icone} /><span>{id === 'correio' ? 'Recados' : texto(idioma, id)}</span>{id === 'correio' && recados.length > 0 && <b className="cel-bolinha cel-bolinha-aba">{recados.length}</b>}
          </button>
        ))}
      </nav>
    </div>
  )
}
