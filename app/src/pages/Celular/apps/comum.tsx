// Peças em comum dos apps do celular.
import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { comAgora, dataDoDia, diaDaCampanha, irPara, momento, tempoAtivo, tempoCompleto } from '../../Mesa/tempo'
import type { EstadoDoCelular } from '../estado'

export function Topo({ titulo, voltar, direita, escuro }: { titulo: string; voltar: () => void; direita?: ReactNode; escuro?: boolean }) {
  return (
    <header className={`cel-topo-simples${escuro ? ' escuro' : ''}`}>
      <button type="button" className="cel-link" onClick={voltar} aria-label="Voltar"><FontAwesomeIcon icon={faArrowLeft} /></button>
      <strong>{titulo}</strong>
      <span>{direita}</span>
    </header>
  )
}

// Minuto do jogo agora (pra carimbar nota, post, notícia e e-mail).
export function minutoAgora(tempo: EstadoDoCelular['tempo']): number | null {
  return tempo && tempoAtivo(tempo) ? comAgora(tempoCompleto(tempo)).minutos : null
}

// "Daqui a N dias, às HH:MM" no relógio do jogo → minuto do jogo (mensagem agendada).
export function minutoDoJogo(tempo: EstadoDoCelular['tempo'], diasAFrente: number, hora: number, minuto: number): number | null {
  if (!tempo || !tempoAtivo(tempo)) return null
  const t = comAgora(tempoCompleto(tempo))
  const hoje = diaDaCampanha(t, momento(t).data)
  return irPara(t, dataDoDia(t, hoje + diasAFrente), hora, minuto).minutos
}
