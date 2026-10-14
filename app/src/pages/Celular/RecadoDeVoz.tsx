// Correio de voz (14/10): ligou e ninguém atendeu (ou recusaram) → "Deixar recado". O recado vai
// como áudio na conversa com a pessoa e aparece na aba Correio de voz do Telefone dela.
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMicrophone, faStop, faXmark } from '@fortawesome/free-solid-svg-icons'
import { pessoa, useCelular } from './estado'
import { useGravador } from './gravador'
import type { Lado, Ligacao } from './dados'

export default function RecadoDeVoz({ ligacao, onFechar }: { ligacao: Ligacao; onFechar: () => void }) {
  const e = useCelular()
  const g = useGravador()
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const para: Lado = ligacao.para_celular_id ? { celular: ligacao.para_celular_id } : { npc: ligacao.para_npc_id! }
  const quem = pessoa(e, { celular: ligacao.para_celular_id, npc: ligacao.para_npc_id })

  async function enviar() {
    const audio = await g.parar()
    if (!audio) return
    setEnviando(true)
    const conv = await e.acoes.criarConversa({ tipo: 'direta', ...('celular' in para ? { celulares: [para.celular] } : { npcs: [para.npc] }) })
    if (!conv.id) { setErro(conv.erro); setEnviando(false); return }
    const up = await e.acoes.enviarArquivo(audio.blob, 'recado.webm')
    if (!up.url) { setErro(up.erro); setEnviando(false); return }
    const r = await e.acoes.enviar({ conversaId: conv.id, tipo: 'audio', arquivoUrl: up.url, arquivo: { nome: 'Correio de voz', duracao: audio.duracao, correio: true } })
    setEnviando(false)
    if (r) setErro(r)
    else onFechar()
  }

  return (
    <div className="cel-recado">
      <div className="cel-recado-caixa">
        <button type="button" className="cel-link cel-recado-fechar" onClick={() => { g.cancelar(); onFechar() }} aria-label="Fechar"><FontAwesomeIcon icon={faXmark} /></button>
        <strong>{quem.nome} não atendeu</strong>
        <p>{g.gravando ? `Gravando recado… ${g.segundos}s` : 'Deixar um recado de voz?'}</p>
        {g.gravando ? (
          <button type="button" className="cel-ligacao-botao recusar" disabled={enviando} onClick={enviar}><FontAwesomeIcon icon={faStop} /><span>Parar e enviar</span></button>
        ) : (
          <button type="button" className="cel-ligacao-botao atender" disabled={enviando} onClick={async () => setErro(await g.comecar())}><FontAwesomeIcon icon={faMicrophone} /><span>Gravar recado</span></button>
        )}
        {erro && <p className="cel-erro">{erro}</p>}
      </div>
    </div>
  )
}
