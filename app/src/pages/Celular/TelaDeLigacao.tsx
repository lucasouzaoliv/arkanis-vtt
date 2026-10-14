// Ligação (pedido da Millie, 13/10): quem recebe ouve o toque (o do contato, o padrão do celular ou
// um toque de telefone) e vê Atender/Recusar; em chamada, o cronômetro. A voz é no Discord.
import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleUser, faPhone, faPhoneSlash } from '@fortawesome/free-solid-svg-icons'
import { ehEu, pessoa, useCelular } from './estado'
import { texto } from './textos'
import { tocarToque } from './sons'
import type { Ligacao } from './dados'

function cronometro(desde: string | null): string {
  if (!desde) return '00:00'
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(desde)) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function TelaDeLigacao({ ligacao }: { ligacao: Ligacao }) {
  const e = useCelular()
  const idioma = e.celular.idioma
  const recebendo = ehEu(e.eu, { celular: ligacao.para_celular_id, npc: ligacao.para_npc_id })
  const outro = recebendo
    ? pessoa(e, { celular: ligacao.de_celular_id, npc: ligacao.de_npc_id })
    : pessoa(e, { celular: ligacao.para_celular_id, npc: ligacao.para_npc_id })
  const [, setTique] = useState(0)
  const [ocupado, setOcupado] = useState(false)

  // O toque: só pra quem recebe, enquanto está chamando.
  useEffect(() => {
    if (!recebendo || ligacao.estado !== 'chamando') return
    const contato = e.contatos.find((k) => (ligacao.de_celular_id ? k.contato_celular_id === ligacao.de_celular_id : k.npc_id === ligacao.de_npc_id))
    const npc = ligacao.de_npc_id ? e.npcs.find((n) => n.id === ligacao.de_npc_id) : null
    return tocarToque(contato?.toque || npc?.toque || e.celular.toque_padrao)
  }, [recebendo, ligacao.estado, ligacao.id, ligacao.de_celular_id, ligacao.de_npc_id, e.contatos, e.npcs, e.celular.toque_padrao])

  useEffect(() => {
    if (ligacao.estado !== 'em_curso') return
    const t = window.setInterval(() => setTique((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [ligacao.estado])

  async function responder(acao: 'atender' | 'recusar' | 'encerrar') {
    setOcupado(true)
    await e.acoes.responderLigacao(ligacao.id, acao)
    setOcupado(false)
  }

  const situacao = ligacao.estado === 'em_curso'
    ? cronometro(ligacao.atendida_em)
    : recebendo ? texto(idioma, 'recebendo') : texto(idioma, 'chamando')

  return (
    <div className={`cel-ligacao${ligacao.estado === 'chamando' && recebendo ? ' tocando' : ''}`} style={outro.foto ? { ['--cel-ligacao-foto' as string]: `url(${outro.foto})` } : undefined}>
      <div className="cel-ligacao-quem">
        <span className="cel-ligacao-foto">{outro.foto ? <img src={outro.foto} alt="" /> : <FontAwesomeIcon icon={faCircleUser} />}</span>
        <h2>{outro.nome}</h2>
        <p>{situacao}</p>
      </div>
      <div className="cel-ligacao-botoes">
        {recebendo && ligacao.estado === 'chamando' ? (
          <>
            <button type="button" className="cel-ligacao-botao recusar" disabled={ocupado} onClick={() => responder('recusar')}>
              <FontAwesomeIcon icon={faPhoneSlash} /><span>{texto(idioma, 'recusar')}</span>
            </button>
            <button type="button" className="cel-ligacao-botao atender" disabled={ocupado} onClick={() => responder('atender')}>
              <FontAwesomeIcon icon={faPhone} /><span>{texto(idioma, 'atender')}</span>
            </button>
          </>
        ) : (
          <button type="button" className="cel-ligacao-botao recusar" disabled={ocupado} onClick={() => responder('encerrar')}>
            <FontAwesomeIcon icon={faPhoneSlash} /><span>{texto(idioma, 'encerrar')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
