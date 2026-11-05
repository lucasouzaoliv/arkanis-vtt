import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { recordRoll } from '../../lib/rollHistory'
import { nomeSeguro } from '../../lib/nomeDeArquivo'
import { recortarImagem } from '../../components/RecortarImagem'
import StatBar from '../CharacterSheet/StatBar'
import DadoIcone from './DadoIcone'
import Habilidades from './Habilidades'
import { ATRIBUTOS, CENARIOS, DADO_BASE_DO_ATRIBUTO, chaveDaLinha, nomeDaLinha, type Atributo, type LinhaDePericia } from '../../sistemas/op2/cenarios'
import { PASSOS, passo, passosAte, rolarTeste, type Dado, type ResultadoDoTeste } from '../../sistemas/op2/dados'
import { MODIFICADORES_PADRAO, type Modificadores } from '../../sistemas/op2/ficha'
import { FICHAS_PRONTAS, type Perfil } from '../../sistemas/op2/fichasProntas'
import type { useFichaOP2, PersonagemOP2 } from './useFichaOP2'
import pvEmpty from '../../assets/pv-empty.svg'
import pvLow from '../../assets/pv-low.svg'
import pvHalf from '../../assets/pv-half.svg'
import pvFull from '../../assets/pv-full.svg'
import pdEmpty from '../../assets/determination-empty.svg'
import pdLow from '../../assets/determination-low.svg'
import pdHalf from '../../assets/determination-half.svg'
import pdFull from '../../assets/determination-full.svg'

const CARDS = import.meta.glob('../../assets/op2/fichas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const PERFIS: { id: Perfil; nome: string }[] = [
  { id: 'executor', nome: 'Executor' },
  { id: 'analista', nome: 'Analista' },
  { id: 'vigilante', nome: 'Vigilante' },
]

const Lapis = () => (
  <svg viewBox="0 0 16 16" aria-hidden><path d="M11.3 2.2l2.5 2.5-8.4 8.4-3.2.7.7-3.2z M9.8 3.7l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
)

const pct = (a: number, m: number) => (m > 0 ? (a / m) * 100 : 0)
const iconeDe = (p: number, [vazio, baixo, meio, cheio]: string[]) => (p <= 0 ? vazio : p <= 33 ? baixo : p <= 66 ? meio : cheio)

// Seta do atributo: ↑ acima do valor com que a ficha nasceu, ↓ abaixo, com o número de passos
// quando for mais de um (no print, o Alan com Mente d8 de fábrica não tem seta).
function SetaDoAtributo({ dado, base }: { dado: Dado; base: Dado }) {
  const n = passosAte(base, dado)
  if (!n) return null
  return (
    <span className="op2-seta" aria-label={`${n > 0 ? '+' : ''}${n} passo${Math.abs(n) > 1 ? 's' : ''}`}>
      {n > 0 ? '↑' : '↓'}{Math.abs(n) > 1 && <sub>{Math.abs(n)}</sub>}
    </span>
  )
}

// Lista de dados pra escolher (perícia, dado bônus): mesma tabelinha do site.
function EscolherDado({ atual, comNenhum, onEscolher, onFechar }: { atual: Dado | null; comNenhum?: boolean; onEscolher: (d: Dado | null) => void; onFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fora = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onFechar() }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [onFechar])
  return (
    <div ref={ref} className="op2-escolher-dado" role="listbox">
      {comNenhum && <button type="button" className={atual === null ? 'atual' : undefined} onClick={() => onEscolher(null)} aria-label="Nenhum"><span className="op2-x">✕</span></button>}
      {PASSOS.map((d) => (
        <button key={d} type="button" className={atual === d ? 'atual' : undefined} onClick={() => onEscolher(d)} aria-label={`d${d}`}>
          <DadoIcone lados={d} tamanho={26} />
        </button>
      ))}
    </div>
  )
}

function Menu({ itens, onFechar }: { itens: { rotulo: string; classe?: string; onClick: () => void }[]; onFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fora = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onFechar() }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [onFechar])
  return (
    <div ref={ref} className="op2-menu" role="menu">
      {itens.map((i) => <button key={i.rotulo} type="button" role="menuitem" className={i.classe} onClick={() => { i.onClick(); onFechar() }}>{i.rotulo}</button>)}
    </div>
  )
}

// Campo do cabeçalho com lápis: clica e escreve.
function CampoEditavel({ valor, rotulo, numero, onSalvar, children }: { valor: string; rotulo: string; numero?: boolean; onSalvar: (v: string) => void; children?: React.ReactNode }) {
  const [editando, setEditando] = useState(false)
  return (
    <div className="op2-cab-linha">
      {editando ? (
        <input
          autoFocus
          aria-label={rotulo}
          type={numero ? 'number' : 'text'}
          defaultValue={valor}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => { setEditando(false); onSalvar(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditando(false) }}
        />
      ) : (
        children ?? <span className={valor ? undefined : 'op2-vazio'}>{valor || rotulo}</span>
      )}
      <button type="button" className="op2-lapis" aria-label={`Editar ${rotulo}`} onClick={() => setEditando(true)}><Lapis /></button>
    </div>
  )
}

function ResultadoDaRolagem({ titulo, r, onFechar }: { titulo: string; r: ResultadoDoTeste; onFechar: () => void }) {
  return (
    <div className="op2-resultado" role="status">
      <button type="button" className="op2-resultado-fechar" aria-label="Fechar" onClick={onFechar}>✕</button>
      <p className="op2-resultado-titulo">{titulo}</p>
      <div className="op2-resultado-dados">
        {r.dados.map((d, i) => (
          <span key={i} className={`op2-resultado-dado${d.anulado ? ' anulado' : ''}${d.somado ? '' : ' fora'}`} title={`d${d.lados}${d.anulado ? ' (anulado pelo pavor)' : ''}`}>
            <DadoIcone lados={d.lados} tamanho={38} numero={d.valor} />
          </span>
        ))}
        {r.pavor && (
          <span className="op2-resultado-dado pavor" title="Dado de pavor: anula os menores">
            <DadoIcone lados={r.pavor.lados} tamanho={38} numero={r.pavor.valor} pavor />
          </span>
        )}
      </div>
      <p className="op2-resultado-total">{r.total}</p>
      <p className="op2-resultado-info">
        RA {r.ra} · RB {r.rb}
        {r.sucessoCritico && <strong className="critico"> · Sucesso crítico</strong>}
        {r.falhaCritica && <strong className="falha"> · Falha crítica</strong>}
        {r.venceuOPavor && <strong> · Venceu o pavor</strong>}
      </p>
    </div>
  )
}

export default function AbaAgente({ personagem, ficha }: { personagem: PersonagemOP2; ficha: ReturnType<typeof useFichaOP2> }) {
  const { session } = useAuth()
  const { op2, cols, mudar, mudarColunas } = ficha
  const mods: Modificadores = { ...MODIFICADORES_PADRAO, ...op2.modificadores }
  const [menuPerfil, setMenuPerfil] = useState(false)
  const [escolhendo, setEscolhendo] = useState<{ tipo: 'pericia'; chave: string } | { tipo: 'bonus'; i: 0 | 1 } | { tipo: 'atributo'; chave: string } | null>(null)
  const [ordem, setOrdem] = useState<'nome' | 'passo'>('nome')
  const [rolagem, setRolagem] = useState<{ titulo: string; r: ResultadoDoTeste } | null>(null)
  const foto = useRef<HTMLInputElement>(null)

  const pvMax = cols.max_pv_override ?? 10
  const pv = cols.current_pv ?? pvMax
  const pdMax = op2.pdMaximo
  const pd = cols.current_pd ?? pdMax
  const pronta = op2.pronta ? FICHAS_PRONTAS.find((f) => f.id === op2.pronta) : undefined
  const retrato = cols.avatar_url ?? (pronta ? CARDS[`../../assets/op2/fichas/${pronta.card}`] : null)

  const mudarMods = (m: Partial<Modificadores>) => mudar((f) => ({ ...f, modificadores: { ...MODIFICADORES_PADRAO, ...f.modificadores, ...m } }))
  const mudarLinha = (chave: string, campos: Partial<LinhaDePericia>) =>
    mudar((f) => ({ ...f, pericias: f.pericias.map((l) => (chaveDaLinha(l) === chave ? { ...l, ...campos } : l)) }))

  const dadoDaPericia = (l: LinhaDePericia) => passo(l.dado, mods.passos)
  const dadoDoAtributo = (l: LinhaDePericia) => l.dadoDoAtributo ?? op2.atributos[l.atributo]

  async function trocarFoto(e: ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    const file = escolhido ? await recortarImagem(escolhido, { proporcao: 'quadrado', titulo: 'Foto do personagem' }) : null
    if (!file || !session) return
    const caminho = `${session.user.id}/${Date.now()}-${nomeSeguro(file.name)}`
    const { error } = await supabase.storage.from('character_photos').upload(caminho, file, { upsert: true })
    if (!error) mudarColunas({ avatar_url: supabase.storage.from('character_photos').getPublicUrl(caminho).data.publicUrl })
  }

  function rolar(l: LinhaDePericia) {
    const bonus = mods.bonus.filter((d): d is Dado => d !== null)
    const r = rolarTeste({
      atributo: dadoDoAtributo(l),
      pericia: dadoDaPericia(l),
      bonus,
      pavor: mods.pavorAtivo || mods.pavorComoBonus ? mods.pavor : null,
      pavorComoBonus: mods.pavorComoBonus,
    })
    const titulo = nomeDaLinha(op2.cenario, l)
    setRolagem({ titulo, r })
    if (session) {
      const detalhe = [
        ...r.dados.map((d) => `d${d.lados}: ${d.valor}${d.anulado ? ' (anulado)' : ''}`),
        ...(r.pavor ? [`pavor d${r.pavor.lados}: ${r.pavor.valor}`] : []),
      ].join(' · ')
      const nota = [`RA ${r.ra} · RB ${r.rb}`, r.sucessoCritico ? 'Sucesso crítico' : '', r.falhaCritica ? 'Falha crítica' : ''].filter(Boolean).join(' · ')
      void recordRoll({
        characterId: personagem.id, userId: session.user.id, campaignId: personagem.campaign_id, characterName: cols.name || 'Agente',
        label: `Teste de ${titulo}`, total: r.total, detail: detalhe, nota,
        dice: [...r.dados.map((d) => ({ sides: d.lados, value: d.valor, discarded: d.anulado || !d.somado })), ...(r.pavor ? [{ sides: r.pavor.lados, value: r.pavor.valor, discarded: true }] : [])],
      })
    }
  }

  const linhas = [...op2.pericias].sort((a, b) =>
    ordem === 'passo' ? PASSOS.indexOf(b.dado) - PASSOS.indexOf(a.dado) || nomeDaLinha(op2.cenario, a).localeCompare(nomeDaLinha(op2.cenario, b)) : 0,
  )

  return (
    <div className="op2-agente">
      {/* ---- Coluna esquerda: personagem, atributos e barras ---- */}
      <section className="op2-col-esq">
        <div className="op2-cabecalho">
          <button type="button" className="op2-retrato" onClick={() => foto.current?.click()} aria-label="Trocar foto">
            {retrato ? <span style={{ backgroundImage: `url(${retrato})` }} className={cols.avatar_url ? undefined : 'do-card'} /> : <span className="op2-retrato-vazio" />}
          </button>
          <input ref={foto} type="file" accept="image/*" hidden onChange={trocarFoto} />
          <div className="op2-cab-campos">
            <CampoEditavel valor={cols.name ?? ''} rotulo="Nome" onSalvar={(v) => mudarColunas({ name: v.trim() || 'Novo Agente' })}>
              <strong className="op2-nome">{cols.name || 'Novo Agente'}</strong>
            </CampoEditavel>
            <div className="op2-cab-linha op2-cab-perfil">
              <button type="button" className="op2-chip-perfil" onClick={() => setMenuPerfil((v) => !v)}>{PERFIS.find((p) => p.id === op2.perfil)?.nome}</button>
              {menuPerfil && (
                <Menu
                  itens={PERFIS.map((p) => ({ rotulo: p.nome, classe: `op2-menu-perfil op2-cor-${p.id}`, onClick: () => mudar((f) => ({ ...f, perfil: p.id })) }))}
                  onFechar={() => setMenuPerfil(false)}
                />
              )}
              <button type="button" className="op2-lapis" aria-label="Trocar perfil" onClick={() => setMenuPerfil((v) => !v)}><Lapis /></button>
            </div>
            <CampoEditavel valor={op2.vocacao} rotulo={CENARIOS[op2.cenario].rotuloDaVocacao} onSalvar={(v) => mudar((f) => ({ ...f, vocacao: v.trim() }))} />
            <CampoEditavel valor={String(op2.nivel)} rotulo="Nível" numero onSalvar={(v) => mudar((f) => ({ ...f, nivel: Math.min(10, Math.max(1, Math.round(Number(v)) || 1)) }))}>
              <span>Nível <span className="op2-nivel">{op2.nivel}</span></span>
            </CampoEditavel>
          </div>
        </div>

        <h2 className="op2-faixa op2-faixa-centro"><span>Atributos</span></h2>
        <div className="op2-atributos">
          {ATRIBUTOS.map((a) => {
            const d = op2.atributos[a.id]
            const i = PASSOS.indexOf(d)
            const trocar = (n: number) => mudar((f) => ({ ...f, atributos: { ...f.atributos, [a.id]: passo(d, n) } as Record<Atributo, Dado> }))
            return (
              <div key={a.id} className="op2-atributo">
                <div className="op2-atributo-caixa">
                  <span className="op2-atributo-nome">{a.nome}<SetaDoAtributo dado={d} base={op2.atributosBase?.[a.id] ?? DADO_BASE_DO_ATRIBUTO} /></span>
                  <DadoIcone lados={d} tamanho={58} />
                </div>
                <div className="op2-mais-menos">
                  <button type="button" aria-label={`Diminuir ${a.nome}`} disabled={i <= 0} onClick={() => trocar(-1)}>−</button>
                  <button type="button" aria-label={`Aumentar ${a.nome}`} disabled={i >= PASSOS.length - 1} onClick={() => trocar(1)}>+</button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="op2-barras">
          {[
            { id: 'pv' as const, rotulo: 'PV', atual: pv, max: pvMax, dt: op2.dtPv ?? 7, icone: iconeDe(pct(pv, pvMax), [pvEmpty, pvLow, pvHalf, pvFull]) },
            { id: 'pd' as const, rotulo: 'PD', atual: pd, max: pdMax, dt: op2.dtPd ?? 7, icone: iconeDe(pct(pd, pdMax), [pdEmpty, pdLow, pdHalf, pdFull]) },
          ].map((b) => {
            const mudarAtual = (v: number) => mudarColunas(b.id === 'pv' ? { current_pv: v } : { current_pd: v })
            const mudarDt = (n: number) => mudar((f) => ({ ...f, [b.id === 'pv' ? 'dtPv' : 'dtPd']: Math.max(1, b.dt + n) }))
            return (
              <div key={b.id} className="op2-barra">
                <div className="op2-dt">
                  <button type="button" aria-label={`Diminuir DT de ${b.rotulo}`} onClick={() => mudarDt(-3)}>−</button>
                  <span>DT {String(b.dt).padStart(2, '0')}</span>
                  <button type="button" aria-label={`Aumentar DT de ${b.rotulo}`} onClick={() => mudarDt(3)}>+</button>
                </div>
                <StatBar
                  label={b.rotulo}
                  icon={b.icone}
                  current={b.atual}
                  max={b.max}
                  colorClass={b.id === 'pv' ? 'op2pv' : 'op2pd'}
                  onDecrement={() => mudarAtual(b.atual - 1)}
                  onIncrement={() => mudarAtual(b.atual + 1)}
                  onCurrentChange={mudarAtual}
                  onMaxChange={(v) => (b.id === 'pv' ? mudarColunas({ max_pv_override: Math.max(1, v) }) : mudar((f) => ({ ...f, pdMaximo: Math.max(1, v) })))}
                />
              </div>
            )
          })}
        </div>
      </section>

      {/* ---- Coluna do meio: modificadores e perícias ---- */}
      <section className="op2-col-meio">
        <h2 className="op2-faixa">
          <span>Modificadores de Perícias</span>
          <button type="button" className="op2-olho" aria-label={mods.escondido ? 'Mostrar modificadores' : 'Esconder modificadores'} aria-pressed={!mods.escondido} onClick={() => mudarMods({ escondido: !mods.escondido })}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" fill="currentColor" />{mods.escondido && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" />}</svg>
          </button>
        </h2>
        {!mods.escondido && (
          <div className="op2-mods">
            <div className="op2-mods-bloco">
              <span className="op2-mods-rotulo">Dados Bônus</span>
              <div className="op2-bonus">
                {([0, 1] as const).map((i) => (
                  <span key={i} className="op2-bonus-slot">
                    {i === 1 && <span className="op2-mais">+</span>}
                    <button type="button" className="op2-bonus-botao" aria-label={`Dado bônus ${i + 1}`} onClick={() => setEscolhendo({ tipo: 'bonus', i })}>
                      {mods.bonus[i] ? <DadoIcone lados={mods.bonus[i]!} tamanho={30} /> : <span className="op2-x">✕</span>}
                    </button>
                    {escolhendo?.tipo === 'bonus' && escolhendo.i === i && (
                      <EscolherDado
                        atual={mods.bonus[i]}
                        comNenhum
                        onEscolher={(d) => { const b: Modificadores['bonus'] = [...mods.bonus]; b[i] = d; mudarMods({ bonus: b }); setEscolhendo(null) }}
                        onFechar={() => setEscolhendo(null)}
                      />
                    )}
                  </span>
                ))}
              </div>
            </div>
            <div className="op2-mods-bloco">
              <span className="op2-mods-rotulo">Passos das Perícias</span>
              <div className="op2-contador">
                <button type="button" aria-label="Menos um passo" disabled={mods.passos <= 0} onClick={() => mudarMods({ passos: mods.passos - 1 })}>−</button>
                <span>{mods.passos > 0 ? `+${mods.passos}` : mods.passos}</span>
                <button type="button" aria-label="Mais um passo" disabled={mods.passos >= PASSOS.length - 1} onClick={() => mudarMods({ passos: mods.passos + 1 })}>+</button>
              </div>
            </div>
            <div className="op2-mods-bloco">
              <span className="op2-mods-rotulo">Dado de Pavor</span>
              <div className="op2-contador op2-pavor">
                <button type="button" aria-label="Diminuir o dado de pavor" disabled={mods.pavor <= 4} onClick={() => mudarMods({ pavor: passo(mods.pavor, -1) })}>−</button>
                <DadoIcone lados={mods.pavor} tamanho={30} pavor />
                <button type="button" aria-label="Aumentar o dado de pavor" disabled={mods.pavor >= 12} onClick={() => mudarMods({ pavor: passo(mods.pavor, 1) })}>+</button>
              </div>
            </div>
            <div className="op2-mods-bloco op2-mods-checks">
              <label><input type="checkbox" checked={mods.pavorAtivo} onChange={(e) => mudarMods({ pavorAtivo: e.target.checked })} /> Ativar Dado de Pavor</label>
              <label><input type="checkbox" checked={mods.pavorComoBonus} onChange={(e) => mudarMods({ pavorComoBonus: e.target.checked })} /> Usar como Bônus</label>
            </div>
          </div>
        )}

        <h2 className="op2-faixa op2-faixa-pericias">
          <span>Perícias</span>
          <button type="button" className={`op2-ordem${ordem === 'nome' ? ' ativa' : ''}`} onClick={() => setOrdem('nome')}>Nome{ordem === 'nome' && ' ↑'}</button>
          <button type="button" className={`op2-ordem${ordem === 'passo' ? ' ativa' : ''}`} onClick={() => setOrdem('passo')}>Passo{ordem === 'passo' && ' ↓'}</button>
        </h2>
        <ul className="op2-pericias">
          {linhas.map((l) => {
            const chave = chaveDaLinha(l)
            const nome = nomeDaLinha(op2.cenario, l)
            return (
              <li key={chave} className="op2-pericia">
                <button type="button" className="op2-pericia-nome" title={`Rolar ${nome}`} onClick={() => rolar(l)}>{nome}</button>
                <span className="op2-pericia-dados">
                  <button type="button" className="op2-pericia-dado" aria-label={`Dado de ${nome}`} onClick={() => setEscolhendo({ tipo: 'pericia', chave })}>
                    <DadoIcone lados={dadoDaPericia(l)} tamanho={22} />
                  </button>
                  {escolhendo?.tipo === 'pericia' && escolhendo.chave === chave && (
                    <EscolherDado atual={l.dado} onEscolher={(d) => { if (d) mudarLinha(chave, { dado: d }); setEscolhendo(null) }} onFechar={() => setEscolhendo(null)} />
                  )}
                  <span className="op2-mais">+</span>
                  <DadoIcone lados={dadoDoAtributo(l)} tamanho={22} />
                </span>
                <span className="op2-pericia-atr">
                  <button type="button" className="op2-etiqueta" onClick={() => setEscolhendo({ tipo: 'atributo', chave })}>{ATRIBUTOS.find((a) => a.id === l.atributo)?.nome}</button>
                  {escolhendo?.tipo === 'atributo' && escolhendo.chave === chave && (
                    <Menu
                      itens={ATRIBUTOS.map((a) => ({ rotulo: a.nome, onClick: () => mudarLinha(chave, { atributo: a.id, dadoDoAtributo: undefined }) }))}
                      onFechar={() => setEscolhendo(null)}
                    />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ---- Coluna direita: habilidades e equipamentos ---- */}
      <section className="op2-col-dir">
        <Habilidades op2={op2} mudar={mudar} />
      </section>

      {rolagem && <ResultadoDaRolagem titulo={rolagem.titulo} r={rolagem.r} onFechar={() => setRolagem(null)} />}
    </div>
  )
}
