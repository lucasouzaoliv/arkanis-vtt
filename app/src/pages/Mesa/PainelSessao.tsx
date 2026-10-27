import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEyeSlash, faMap, faUser } from '@fortawesome/free-solid-svg-icons'
import { rotuloJogador, type Membro } from './mesa'
import type { Camada } from './cenas'

const CAMADAS: { id: Camada; rotulo: string; icone: typeof faMap }[] = [
  { id: 'token', rotulo: 'Camada de Tokens', icone: faUser },
  { id: 'mestre', rotulo: 'Camada do Mestre', icone: faEyeSlash },
  { id: 'mapa', rotulo: 'Camada de Mapa', icone: faMap },
]

// Rodapé esquerdo da mesa (12.14): mestre com latência e FPS, e um item por jogador conectado.
export default function PainelSessao({ conectados, latencia, fps, camada, onCamada }: {
  conectados: Membro[]
  latencia: number | null
  fps: number
  // Mestre: em que camada está mexendo (só os objetos dela selecionam e se movem).
  camada?: Camada
  onCamada?: (c: Camada) => void
}) {
  const mestre = conectados.find((m) => m.papel === 'mestre')
  const jogadores = conectados.filter((m) => m.papel !== 'mestre')

  return (
    <section className="mesa-sessao" aria-label="Painel de sessão">
      <div className="mesa-sessao-pessoa">
        <span className="mesa-sessao-ponto mesa-sessao-ponto-mestre" aria-hidden />
        <strong>{mestre ? mestre.nomeConta : 'Mestre ausente'} [Mestre]</strong>
      </div>
      <div className="mesa-sessao-metricas">
        Latência <b>{latencia === null ? '—' : `${latencia}ms`}</b> FPS <b>{fps}</b>
      </div>
      {camada && onCamada && (
        <div className="mesa-sessao-camadas" role="radiogroup" aria-label="Camada em que você mexe">
          {CAMADAS.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={camada === c.id} className={camada === c.id ? 'ativa' : undefined} title={`${c.rotulo}: só ela seleciona e se move`} aria-label={c.rotulo} onClick={() => onCamada(c.id)}>
              <FontAwesomeIcon icon={c.icone} />
            </button>
          ))}
        </div>
      )}
      {jogadores.map((j) => (
        <div key={j.userId} className="mesa-sessao-pessoa">
          <span className="mesa-sessao-ponto" aria-hidden />
          {rotuloJogador(j)}
        </div>
      ))}
    </section>
  )
}
