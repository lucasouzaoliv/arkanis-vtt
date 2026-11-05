import { useState } from 'react'
import DadoIcone from './DadoIcone'
import { passo, type Dado } from '../../sistemas/op2/dados'
import type { FichaOP2 } from '../../sistemas/op2/ficha'

// Aba Investigação do OP2 (prints de 05/11): pontos de interesse com até três elementos, anotações
// em 4 abas e a ferramenta de fechaduras do desafio Destrancar (o mestre compara com a senha dele).

export type Elemento = '' | 'sangue' | 'morte' | 'conhecimento' | 'energia' | 'medo'
export type NotaDeInteresse = { id: string; titulo: string; elementos: [Elemento, Elemento, Elemento]; texto: string }
export type Tentativa = { valores: number[]; marcas: ('alto' | 'baixo' | null)[] }
export type Investigacao = {
  pontos: NotaDeInteresse[][]
  anotacoes: { nome: string; texto: string }[]
  fechadura: { complexidade: number; passo: Dado; tentativas: Tentativa[] }
}

const ABAS = 4
export const ELEMENTOS: { id: Elemento; nome: string }[] = [
  { id: '', nome: '—' },
  { id: 'sangue', nome: 'Sangue' },
  { id: 'morte', nome: 'Morte' },
  { id: 'conhecimento', nome: 'Conhecimento' },
  { id: 'energia', nome: 'Energia' },
  { id: 'medo', nome: 'Medo' },
]

const novaNota = (): NotaDeInteresse => ({ id: crypto.randomUUID(), titulo: '', elementos: ['', '', ''], texto: '' })

export function investigacaoDa(f: FichaOP2): Investigacao {
  const i = (f as FichaOP2 & { investigacao?: Partial<Investigacao> }).investigacao ?? {}
  return {
    pontos: Array.from({ length: ABAS }, (_, n) => i.pontos?.[n] ?? (n === 0 ? [novaNota()] : [])),
    anotacoes: Array.from({ length: ABAS }, (_, n) => i.anotacoes?.[n] ?? { nome: `Anotação ${n + 1}`, texto: '' }),
    fechadura: i.fechadura ?? { complexidade: 6, passo: 6, tentativas: [] },
  }
}

function SeletorDeElemento({ valor, onMudar }: { valor: Elemento; onMudar: (e: Elemento) => void }) {
  const [aberto, setAberto] = useState(false)
  return (
    <span className="op2-elemento-wrap">
      <button type="button" className={`op2-elemento op2-elemento-${valor || 'nenhum'}`} onClick={() => setAberto((v) => !v)}>{ELEMENTOS.find((e) => e.id === valor)?.nome}</button>
      {aberto && (
        <span className="op2-elemento-lista" onMouseLeave={() => setAberto(false)}>
          {ELEMENTOS.map((e) => (
            <button key={e.id || 'nenhum'} type="button" className={`op2-elemento op2-elemento-${e.id || 'nenhum'}`} onClick={() => { onMudar(e.id); setAberto(false) }}>{e.nome}</button>
          ))}
        </span>
      )}
    </span>
  )
}

function Abas({ ativa, onEscolher }: { ativa: number; onEscolher: (n: number) => void }) {
  return (
    <div className="op2-inv-abas">
      {Array.from({ length: ABAS }, (_, n) => (
        <button key={n} type="button" className={ativa === n ? 'ativa' : undefined} onClick={() => onEscolher(n)}>Aba {n + 1}</button>
      ))}
    </div>
  )
}

function Contador({ valor, rotulo, onMudar, min, max }: { valor: number | string; rotulo: string; onMudar: (n: number) => void; min: boolean; max: boolean }) {
  return (
    <div className="op2-contador op2-contador-pequeno">
      <button type="button" aria-label={`Diminuir ${rotulo}`} disabled={min} onClick={() => onMudar(-1)}>−</button>
      <span>{valor}</span>
      <button type="button" aria-label={`Aumentar ${rotulo}`} disabled={max} onClick={() => onMudar(1)}>+</button>
    </div>
  )
}

export default function AbaInvestigacao({ op2, mudar }: { op2: FichaOP2; mudar: (fn: (f: FichaOP2) => FichaOP2) => void }) {
  const inv = investigacaoDa(op2)
  const [abaPontos, setAbaPontos] = useState(0)
  const [abaAnot, setAbaAnot] = useState(0)
  const salvar = (fn: (i: Investigacao) => Investigacao) => mudar((f) => ({ ...f, investigacao: fn(investigacaoDa(f)) }) as FichaOP2)
  const notas = inv.pontos[abaPontos]
  const mudarNota = (id: string, campos: Partial<NotaDeInteresse>) =>
    salvar((i) => ({ ...i, pontos: i.pontos.map((l, n) => (n === abaPontos ? l.map((x) => (x.id === id ? { ...x, ...campos } : x)) : l)) }))
  const anot = inv.anotacoes[abaAnot]
  const fech = inv.fechadura
  const mudarFech = (campos: Partial<Investigacao['fechadura']>) => salvar((i) => ({ ...i, fechadura: { ...i.fechadura, ...campos } }))
  const mudarTentativa = (n: number, t: Tentativa) => mudarFech({ tentativas: fech.tentativas.map((x, i) => (i === n ? t : x)) })

  return (
    <div className="op2-inv">
      <h1 className="op2-inv-titulo">Investigação</h1>
      <div className="op2-inv-colunas">
        <section>
          <header className="op2-inv-cab">
            <h2>Pontos de Interesse</h2>
            <button type="button" className="op2-inv-botao" onClick={() => salvar((i) => ({ ...i, pontos: i.pontos.map((l, n) => (n === abaPontos ? [...l, novaNota()] : l)) }))}>Adicionar Nota</button>
          </header>
          <Abas ativa={abaPontos} onEscolher={setAbaPontos} />
          <div className="op2-inv-notas">
            {notas.map((nota) => (
              <div key={nota.id} className="op2-inv-nota">
                <div className="op2-inv-nota-topo">
                  <input value={nota.titulo} placeholder="Nova nota" aria-label="Título da nota" onChange={(e) => mudarNota(nota.id, { titulo: e.target.value })} />
                  <button type="button" aria-label="Remover nota" onClick={() => salvar((i) => ({ ...i, pontos: i.pontos.map((l, n) => (n === abaPontos ? l.filter((x) => x.id !== nota.id) : l)) }))}>✕</button>
                </div>
                <div className="op2-inv-elementos">
                  {([0, 1, 2] as const).map((k) => (
                    <SeletorDeElemento key={k} valor={nota.elementos[k]} onMudar={(e) => { const el = [...nota.elementos] as NotaDeInteresse['elementos']; el[k] = e; mudarNota(nota.id, { elementos: el }) }} />
                  ))}
                </div>
                <textarea value={nota.texto} placeholder="Anote os pontos de interesse aqui." aria-label="Pontos de interesse" onChange={(e) => mudarNota(nota.id, { texto: e.target.value })} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <header className="op2-inv-cab"><h2>Anotações</h2></header>
          <Abas ativa={abaAnot} onEscolher={setAbaAnot} />
          <div className="op2-inv-anotacao">
            <input value={anot.nome} aria-label="Nome da anotação" onChange={(e) => salvar((i) => ({ ...i, anotacoes: i.anotacoes.map((a, n) => (n === abaAnot ? { ...a, nome: e.target.value } : a)) }))} />
            <textarea value={anot.texto} placeholder="Anote o necessário aqui." aria-label="Anotação" onChange={(e) => salvar((i) => ({ ...i, anotacoes: i.anotacoes.map((a, n) => (n === abaAnot ? { ...a, texto: e.target.value } : a)) }))} />
          </div>
        </section>

        <section>
          <header className="op2-inv-cab"><h2>Fechaduras</h2></header>
          <div className="op2-fech-config">
            <div className="op2-fech-linhas">
              <label>Complexidade da Tranca:<Contador valor={fech.complexidade} rotulo="complexidade" min={fech.complexidade <= 1} max={fech.complexidade >= 8} onMudar={(n) => mudarFech({ complexidade: fech.complexidade + n })} /></label>
              <label>Passo dos Dados:<Contador valor={fech.passo} rotulo="passo dos dados" min={fech.passo <= 4} max={fech.passo >= 12} onMudar={(n) => mudarFech({ passo: passo(fech.passo, n) })} /></label>
            </div>
            <button type="button" className="op2-inv-botao op2-fech-gerar" onClick={() => mudarFech({ tentativas: [{ valores: Array(fech.complexidade).fill(1), marcas: Array(fech.complexidade).fill(null) }] })}>
              Gerar nova fechadura
            </button>
          </div>
          <div className="op2-fech-area">
            {!fech.tentativas.length ? (
              <p className="op2-fech-vazio">Gere uma fechadura para começar o desafio.</p>
            ) : (
              <>
                {fech.tentativas.map((t, n) => (
                  <div key={n} className="op2-fech-tentativa">
                    <div className="op2-fech-topo">
                      <strong>Tentativa {n + 1}</strong>
                      <button type="button" aria-label={`Tirar a tentativa ${n + 1}`} onClick={() => mudarFech({ tentativas: fech.tentativas.filter((_, i) => i !== n) })}>✕</button>
                    </div>
                    <div className="op2-fech-dados">
                      {t.valores.map((v, k) => {
                        const marcar = (m: 'alto' | 'baixo') => { const marcas = [...t.marcas]; marcas[k] = marcas[k] === m ? null : m; mudarTentativa(n, { ...t, marcas }) }
                        return (
                          <div key={k} className="op2-fech-dado">
                            <button type="button" className={`op2-fech-seta alto${t.marcas[k] === 'alto' ? ' marcada' : ''}`} aria-label="Ficou alto" onClick={() => marcar('alto')}>︿</button>
                            <span className="op2-fech-valor">
                              <DadoIcone lados={fech.passo} tamanho={44} numero="" pavor />
                              <input
                                type="number"
                                min={1}
                                max={fech.passo}
                                value={v}
                                aria-label={`Dígito ${k + 1}`}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => { const valores = [...t.valores]; valores[k] = Math.min(fech.passo, Math.max(1, Math.round(Number(e.target.value)) || 1)); mudarTentativa(n, { ...t, valores }) }}
                              />
                            </span>
                            <button type="button" className={`op2-fech-seta baixo${t.marcas[k] === 'baixo' ? ' marcada' : ''}`} aria-label="Ficou baixo" onClick={() => marcar('baixo')}>﹀</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="op2-inv-botao op2-fech-nova"
                  onClick={() => { const ult = fech.tentativas[fech.tentativas.length - 1]; mudarFech({ tentativas: [...fech.tentativas, { valores: [...ult.valores], marcas: ult.valores.map(() => null) }] }) }}
                >
                  Nova tentativa
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

