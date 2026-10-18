import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBackwardStep, faForwardStep, faPenToSquare, faPlay, faPlus, faSkull, faStop, faTrash, faUser, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useRef } from 'react'
import caveiraVazia from '../../assets/empty-skull-icon.svg'
import caveiraMarcada from '../../assets/marked-skull-icon.svg'
import { corDaVida, desmaiado, posicaoNoCarrossel, type Combatente } from './combate'
import type { Barras, Combate } from './useCombate'
import { TIPO_ARRASTO_ATOR } from './PainelPersonagens'
import CondicoesDaAmeaca from './CondicoesDaAmeaca'
import type { CondicaoPersonalizada } from '../CharacterSheet/efeitosEscolhidos'

// Aba Encontros de Combate (12.4). Sem combate rodando: a lista dos combates salvos
// (Nome + VD + Iniciar). Rodando: a ordem de iniciativa, os turnos e a rodada.
export default function PainelCombate({ souMestre, combates, vdDoCombate, ativo, ordem, vidaDe, barras, meusPersonagens, onCriar, onEditar, onExcluir, onIniciar, onEncerrar, onAdicionar, onPassar, onRemover, onAbrir, onSoltarAtor, condicoesDe, onMudarCondicoes }: {
  souMestre: boolean
  combates: Combate[]
  vdDoCombate: (c: Combate) => number
  ativo: Combate | null
  ordem: Combatente[]
  // Vida das ameaças: a do personagem delas na aba Personagens.
  vidaDe: (c: Combatente) => [number, number | null] | null
  barras: (c: Combatente) => Barras | null
  meusPersonagens: string[]
  onCriar: () => void
  onEditar: (c: Combate) => void
  onExcluir: (c: Combate) => void
  onIniciar: (c: Combate) => void
  onEncerrar: (c: Combate) => void
  onAdicionar: (c: Combate) => void
  onPassar: (c: Combate, voltar: boolean) => void
  onRemover: (c: Combate, combatenteId: string) => void
  onAbrir: (c: Combatente) => void
  // Personagem arrastado da aba Personagens pra um combate.
  onSoltarAtor: (c: Combate, atorId: string) => void
  // Condições das ameaças (18/10): o mestre põe e tira direto na ordem de iniciativa.
  condicoesDe?: (c: Combatente) => { condicoes: string[]; personalizadas: unknown } | null
  onMudarCondicoes?: (c: Combatente, condicoes: string[], personalizadas: CondicaoPersonalizada[]) => void
}) {
  // Soltar um personagem da aba Personagens em cima do combate coloca ele no combate (mestre).
  const soltavel = (c: Combate) =>
    souMestre
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (e.dataTransfer.types.includes(TIPO_ARRASTO_ATOR)) e.preventDefault()
          },
          onDrop: (e: React.DragEvent) => {
            const id = e.dataTransfer.getData(TIPO_ARRASTO_ATOR)
            if (!id) return
            e.preventDefault()
            onSoltarAtor(c, id)
          },
        }
      : {}

  if (!ativo) {
    return (
      <div className="cenas-painel combate-painel">
        {!combates.length ? (
          <div className="combate-vazio">
            <p>Sem Combates</p>
            {souMestre && <button type="button" className="mesa-botao" onClick={onCriar}><FontAwesomeIcon icon={faPlus} /> Criar Combate</button>}
          </div>
        ) : (
          <>
            {souMestre && (
              <div className="cenas-botoes combate-botoes">
                <button type="button" className="mesa-botao" onClick={onCriar}><FontAwesomeIcon icon={faPlus} /> Criar Combate</button>
              </div>
            )}
            <ul className="combate-lista">
              {combates.map((c) => (
                <li key={c.id} className="combate-card" {...soltavel(c)}>
                  <div>
                    <strong>{c.name}</strong>
                    <span>VD: {vdDoCombate(c)}</span>
                  </div>
                  {souMestre && (
                    <div className="combate-card-acoes">
                      <button type="button" className="combate-icone" aria-label={`Editar ${c.name}`} onClick={() => onEditar(c)}><FontAwesomeIcon icon={faPenToSquare} /></button>
                      <button type="button" className="combate-icone" aria-label={`Excluir ${c.name}`} onClick={() => window.confirm(`Excluir o combate "${c.name}"?`) && onExcluir(c)}><FontAwesomeIcon icon={faTrash} /></button>
                      <button type="button" className="mesa-botao" onClick={() => onIniciar(c)}><FontAwesomeIcon icon={faPlay} /> Iniciar</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!souMestre && <p className="mesa-painel-vazio">Nenhum combate em andamento.</p>}
          </>
        )}
      </div>
    )
  }

  // A vida vai de verde a vermelho conforme cai.
  const barra = (valor: [number, number | null], classe: string) => (
    <span className={`combate-barra ${classe}`}>
      {valor[1] ? <span style={{ width: `${Math.max(0, Math.min(100, (valor[0] / valor[1]) * 100))}%`, ...(classe === 'vida' ? { background: corDaVida(valor[0], valor[1]) } : {}) }} /> : null}
      <small>{valor[0]}{valor[1] !== null ? `/${valor[1]}` : ''}</small>
    </span>
  )

  return (
    <div className="cenas-painel combate-painel" {...soltavel(ativo)}>
      <header className="combate-topo">
        <strong>{ativo.name}</strong>
        {souMestre && (
          <div className="combate-topo-acoes">
            <button type="button" className="combate-icone" aria-label="Adicionar ameaças" title="Adicionar" onClick={() => onAdicionar(ativo)}><FontAwesomeIcon icon={faPlus} /></button>
            <button type="button" className="combate-icone" aria-label="Encerrar combate" title="Encerrar" onClick={() => window.confirm('Encerrar o combate?') && onEncerrar(ativo)}><FontAwesomeIcon icon={faStop} /></button>
          </div>
        )}
      </header>

      <ol className="combate-ordem">
        {ordem.map((c) => {
          const vez = c.id === ativo.turno_atual
          const meu = c.character_id !== null && meusPersonagens.includes(c.character_id)
          const b = barras(c)
          const vida = c.tipo === 'jogador' ? null : vidaDe(c)
          // Jogador não vê a vida nem a ficha dos monstros (12.4).
          const verDetalhes = c.tipo === 'jogador' || souMestre
          return (
            <li key={c.id} className={`combate-linha${vez ? ' vez' : ''}${meu ? ' meu' : ''}`}>
              <button type="button" className="combate-quem" disabled={!verDetalhes} onClick={() => onAbrir(c)}>
                <span className="ator-token">
                  {c.image_url ? <img src={c.image_url} alt="" /> : <FontAwesomeIcon icon={c.tipo === 'ameaca' ? faSkull : faUser} />}
                </span>
                <span className="combate-nome">
                  <strong>{c.name}</strong>
                  {b && (c.tipo === 'jogador' || souMestre) && (
                    <span className="combate-barras">
                      {barra(b.pv, 'vida')}
                      {barra(b.pe, 'esforco')}
                      {barra(b.san, 'sanidade')}
                    </span>
                  )}
                  {souMestre && !b && vida && <span className="combate-barras">{barra(vida, 'vida')}</span>}
                  {c.tipo === 'jogador' && b && desmaiado(b.pv) && <Caveiras marcas={b.mortes ?? 0} className="combate-caveiras" />}
                </span>
              </button>
              {souMestre && c.tipo !== 'jogador' && (() => {
                const cond = condicoesDe?.(c)
                return cond ? <CondicoesDaAmeaca compacto condicoes={cond.condicoes} personalizadas={cond.personalizadas} podeEditar={!!onMudarCondicoes} onMudar={(l, p) => onMudarCondicoes?.(c, l, p)} /> : null
              })()}
              <span className="combate-iniciativa" title="Iniciativa">{c.iniciativa}</span>
              {souMestre && c.tipo !== 'jogador' && ((vida && vida[0] <= 0) || (b && b.pv[0] <= 0)) && (
                <button type="button" className="combate-icone" aria-label={`Tirar ${c.name} do combate`} title="Tirar do combate" onClick={() => onRemover(ativo, c.id)}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              )}
            </li>
          )
        })}
      </ol>

      <footer className="combate-rodape">
        {souMestre && (
          <div className="combate-turnos">
            <button type="button" className="mesa-botao" onClick={() => onPassar(ativo, true)}><FontAwesomeIcon icon={faBackwardStep} /> Voltar Turno</button>
            <button type="button" className="mesa-botao" onClick={() => onPassar(ativo, false)}>Próximo turno <FontAwesomeIcon icon={faForwardStep} /></button>
          </div>
        )}
        <p>Rodada Atual: <strong>{ativo.rodada}</strong></p>
      </footer>
    </div>
  )
}

// As 3 caveiras de morte (as mesmas da barra de vida da ficha): vão marcando a cada turno
// em que a pessoa começa morrendo.
function Caveiras({ marcas, className }: { marcas: number; className: string }) {
  return (
    <span className={className} title={`Morrendo: ${[0, 1, 2].filter((i) => (marcas >> i) & 1).length} de 3`}>
      {[0, 1, 2].map((i) => <img key={i} src={(marcas >> i) & 1 ? caveiraMarcada : caveiraVazia} alt="" draggable={false} />)}
    </span>
  )
}

// Indicador de turno no topo do mapa (12.4), em carrossel: quem está na vez fica sempre no
// centro, aceso; os próximos à direita e os que já foram à esquerda, apagados. Ao passar o
// turno a fila desliza pro lado e o próximo chega ao centro. Quem está na vez clica no
// próprio card pra passar.
const VISIVEIS_DE_CADA_LADO = 3
const LARGURA_CENTRO = 100
const LARGURA_LADO = 78
const ESPACO = 6

function deslocamento(pos: number): number {
  if (pos === 0) return 0
  const passo = LARGURA_LADO + ESPACO
  const primeiro = LARGURA_CENTRO / 2 + ESPACO + LARGURA_LADO / 2
  return Math.sign(pos) * (primeiro + (Math.abs(pos) - 1) * passo)
}

export function IndicadorTurno({ ativo, ordem, barras, meusPersonagens, souMestre, onPassar }: {
  ativo: Combate
  ordem: Combatente[]
  // Vida dos jogadores (o tracinho embaixo do card; ameaças não mostram).
  barras: (c: Combatente) => Barras | null
  meusPersonagens: string[]
  souMestre: boolean
  onPassar: () => void
}) {
  const indiceAtual = Math.max(0, ordem.findIndex((c) => c.id === ativo.turno_atual))
  const atual = ordem[indiceAtual]
  // Posição anterior de cada um: quem dá a volta (sai de uma ponta e entra na outra) muda de
  // lado sem atravessar a fila.
  const anteriores = useRef<Record<string, number>>({})
  const posicoes = Object.fromEntries(ordem.map((c, i) => [c.id, posicaoNoCarrossel(i, indiceAtual, ordem.length)]))
  useEffect(() => {
    anteriores.current = posicoes
  })
  if (!ordem.length || !atual) return null
  const minhaVez = atual.character_id != null && meusPersonagens.includes(atual.character_id)

  return (
    <div className="indicador-turno" role="status" aria-live="polite" aria-label={`Vez de ${atual.name}`}>
      <div className="indicador-turno-trilho">
        {ordem.map((c) => {
          const pos = posicoes[c.id]
          const antes = anteriores.current[c.id]
          const deuVolta = antes !== undefined && Math.abs(pos - antes) > 1
          const vez = pos === 0
          const pode = vez && (minhaVez || souMestre)
          const distancia = Math.abs(pos)
          const bc = c.tipo === 'jogador' ? barras(c) : null
          const pv = bc?.pv ?? null
          return (
            <button
              key={c.id}
              type="button"
              className={`indicador-turno-card${vez ? ' vez' : ''}${pode ? ' pode' : ''}`}
              disabled={!pode}
              aria-hidden={distancia > VISIVEIS_DE_CADA_LADO}
              tabIndex={pode ? 0 : -1}
              title={pode ? (minhaVez ? 'Clique pra passar o turno' : 'Passar o turno') : undefined}
              style={{
                transform: `translateX(calc(-50% + ${deslocamento(pos)}px))`,
                opacity: distancia > VISIVEIS_DE_CADA_LADO ? 0 : vez ? 1 : Math.max(0.35, 0.9 - (distancia - 1) * 0.18),
                transition: deuVolta ? 'none' : undefined,
                zIndex: 10 - distancia,
              }}
              onClick={onPassar}
            >
              <span className="indicador-turno-imagem">
                {c.image_url ? <img src={c.image_url} alt="" draggable={false} /> : <FontAwesomeIcon icon={c.tipo === 'ameaca' ? faSkull : faUser} />}
              </span>
              {pv && (
                <span className="indicador-turno-vida">
                  <span style={{ width: `${pv[1] ? Math.max(0, Math.min(100, (pv[0] / pv[1]) * 100)) : 100}%`, background: corDaVida(pv[0], pv[1]) }} />
                </span>
              )}
              {desmaiado(pv) && <Caveiras marcas={bc?.mortes ?? 0} className="indicador-turno-caveiras" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
