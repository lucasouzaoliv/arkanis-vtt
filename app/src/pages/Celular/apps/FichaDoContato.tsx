// Ficha do contato (pedido 14/10: editar o contato depois de criado). Abre pelo Telefone (tocando no
// contato) e pelas Mensagens (tocando no nome no topo da conversa). Nome e foto são como o contato
// fica salvo neste celular; o número dá pra mudar no contato inventado pelo próprio personagem.
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faCommentDots, faPhone, faStar, faTrash, faUserPlus, faCheck } from '@fortawesome/free-solid-svg-icons'
import { pessoa, useCelular } from '../estado'
import { mudarNpc, type Lado } from '../dados'
import { texto } from '../textos'
import { escolherArquivo, escolherImagem } from '../arquivos'
import { Avatar } from './Mensagens'
import { Topo } from './comum'

export default function FichaDoContato({ quem, voltar, onMensagem }: { quem: Lado; voltar: () => void; onMensagem?: () => void }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const contato = e.contatos.find((k) => ('celular' in quem ? k.contato_celular_id === quem.celular : k.npc_id === quem.npc))
  const p = pessoa(e, 'celular' in quem ? { celular: quem.celular } : { npc: quem.npc })
  const npc = 'npc' in quem ? e.npcs.find((n) => n.id === quem.npc) : null
  // Contato inventado por este personagem (o pai da Nina): o número é dele, então dá pra mudar.
  const podeMudarNumero = !!npc && (e.souMestre || npc.dono_character_id === e.celular.character_id)
  const [nome, setNome] = useState(contato?.apelido ?? '')
  const [numero, setNumero] = useState(npc?.numero ?? '')
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function salvar() {
    if (!contato) return
    setOcupado(true)
    let r = await e.acoes.mudarContato(contato.id, { apelido: nome.trim() || null })
    if (!r && podeMudarNumero && npc && numero.trim() !== (npc.numero ?? '')) r = await mudarNpc(npc.id, { numero: numero.trim() || null })
    setOcupado(false)
    setErro(r)
    if (!r) { setSalvo(true); window.setTimeout(() => setSalvo(false), 1500) }
  }

  async function trocarFoto() {
    if (!contato) return
    const f = await escolherImagem('quadrado', 'Foto do contato')
    if (!f) return
    setOcupado(true)
    const r = await e.acoes.enviarArquivo(f, f.name)
    setOcupado(false)
    if (r.url) setErro(await e.acoes.mudarContato(contato.id, { foto: r.url }))
    else setErro(r.erro)
  }

  return (
    <div className="cel-msg-tela cel-ficha-contato">
      <Topo titulo={texto(idioma, 'contatos')} voltar={voltar} />
      <div className="cel-grupo-info">
        <button type="button" className="cel-config-foto" disabled={!contato || ocupado} onClick={trocarFoto} title={contato ? 'Trocar foto' : undefined}>
          <Avatar foto={p.foto} tamanho={84} />
          {contato && <small><FontAwesomeIcon icon={faCamera} /> {texto(idioma, 'trocar')}</small>}
        </button>
        <strong>{p.nome}</strong>
        {p.numero && <small>{p.numero}</small>}
        {p.recado && <small className="cel-ficha-recado">{p.recado}</small>}
      </div>

      <div className="cel-ficha-botoes">
        {onMensagem && <button type="button" onClick={onMensagem}><FontAwesomeIcon icon={faCommentDots} /><span>{texto(idioma, 'mensagem')}</span></button>}
        <button type="button" onClick={async () => { const r = await e.acoes.ligar(quem); setErro(r.erro) }}><FontAwesomeIcon icon={faPhone} /><span>Ligar</span></button>
        {contato && (
          <button type="button" onClick={() => void e.acoes.mudarContato(contato.id, { favorito: !contato.favorito })}>
            <FontAwesomeIcon icon={faStar} className={contato.favorito ? 'cel-favorito' : 'cel-nao-favorito'} /><span>{texto(idioma, 'favoritos')}</span>
          </button>
        )}
      </div>

      {contato ? (
        <div className="cel-form">
          <label className="cel-campo"><span>{texto(idioma, 'nome')}</span>
            <input value={nome} maxLength={80} placeholder={npc?.nome ?? e.celulares.find((c) => 'celular' in quem && c.id === quem.celular)?.nome_no_perfil ?? ''} onChange={(ev) => setNome(ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') void salvar() }} />
          </label>
          {podeMudarNumero && (
            <label className="cel-campo"><span>{texto(idioma, 'numero')}</span>
              <input value={numero} maxLength={30} placeholder="(11) 9…" onChange={(ev) => setNumero(ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') void salvar() }} />
            </label>
          )}
          <button type="button" className="cel-botao-principal" disabled={ocupado} onClick={salvar}>
            {salvo ? <><FontAwesomeIcon icon={faCheck} /> Salvo</> : texto(idioma, 'salvar')}
          </button>
          <div className="cel-linha-acoes">
            <button type="button" className="cel-botao-secundario" onClick={async () => {
              const f = await escolherArquivo('audio/*')
              if (!f) return
              const r = await e.acoes.enviarArquivo(f, f.name)
              if (r.url) await e.acoes.mudarContato(contato.id, { toque: r.url })
            }}>{texto(idioma, 'toqueLigacao')}: {contato.toque ? '♪' : 'padrão'}</button>
            {contato.toque && <button type="button" className="cel-link" onClick={() => void e.acoes.mudarContato(contato.id, { toque: null })}>{texto(idioma, 'tirar')}</button>}
          </div>
          <button type="button" className="cel-botao-perigo" onClick={async () => { const r = await e.acoes.apagarContato(contato.id); if (r) setErro(r); else voltar() }}>
            <FontAwesomeIcon icon={faTrash} /> {texto(idioma, 'remover')}
          </button>
        </div>
      ) : 'celular' in e.eu ? (
        <button type="button" className="cel-botao-principal" onClick={async () => setErro(await e.acoes.adicionarContato(quem))}>
          <FontAwesomeIcon icon={faUserPlus} /> Adicionar aos contatos
        </button>
      ) : null}
      {erro && <p className="cel-erro" onClick={() => setErro(null)}>{erro}</p>}
    </div>
  )
}
