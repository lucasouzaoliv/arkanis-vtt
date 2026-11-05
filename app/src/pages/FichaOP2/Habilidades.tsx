import { useState } from 'react'
import TextoHabilidade from './TextoHabilidade'
import { CENARIOS, type IdCenario } from '../../sistemas/op2/cenarios'
import { HABILIDADES, type Habilidade } from '../../sistemas/op2/habilidades'
import type { EquipamentoNaFicha, FichaOP2, HabilidadeNaFicha } from '../../sistemas/op2/ficha'

// Coluna direita da ficha do OP2 (prints de 05/11): abas Habilidades e Equipamentos com o botão +,
// Pontos de Armadura entre dois escudos, cartões recolhíveis e as janelas de seleção e criação.

type Mudar = (fn: (f: FichaOP2) => FichaOP2) => void

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Escudo de nós entrelaçados (desenhado em código: a imagem do site não sai).
function Escudo() {
  return (
    <svg className="op2-escudo" viewBox="0 0 48 52" aria-hidden>
      <path d="M24 2 44 9v16c0 13-9 21-20 25C13 46 4 38 4 25V9z" fill="currentColor" opacity="0.9" />
      <path d="M24 5 41 11v14c0 11-7.5 18-17 21.6C14.5 43 7 36 7 25V11z" fill="none" stroke="#1a1a1e" strokeWidth="1.6" />
      <g fill="none" stroke="#1a1a1e" strokeWidth="1.5">
        <path d="M17 18c4-4 10-4 14 0s4 10 0 14-10 4-14 0" />
        <path d="M21 22c2-2 5-2 7 0s2 5 0 7-5 2-7 0-2-5 0-7z" />
        <path d="M12 24c0-6 5-11 12-11M36 28c0 6-5 11-12 11M14 33c2 3 5 5 9 6M34 19c-2-3-5-5-9-6" />
      </g>
    </svg>
  )
}

// Barra de espaços (Ímpeto) ou marcadores (Análise): clica no espaço pra marcar até ele.
function Contador({ c, onMudar }: { c: NonNullable<HabilidadeNaFicha['contador']>; onMudar?: (v: number) => void }) {
  return (
    <div className={`op2-contador-hab op2-contador-${c.tipo}`} role="group" aria-label={`${c.valor} de ${c.maximo}`}>
      {Array.from({ length: c.maximo }, (_, i) => (
        <button
          key={i}
          type="button"
          className={i < c.valor ? 'cheio' : undefined}
          aria-label={`${i + 1}`}
          disabled={!onMudar}
          onClick={() => onMudar?.(c.valor === i + 1 ? i : i + 1)}
        />
      ))}
    </div>
  )
}

function CartaoHabilidade({ h, aberto, onAlternar, onMudar, onEditar, onRemover }: {
  h: HabilidadeNaFicha
  aberto: boolean
  onAlternar: () => void
  onMudar: (h: HabilidadeNaFicha) => void
  onEditar: () => void
  onRemover: () => void
}) {
  return (
    <div className={`op2-cartao${aberto ? ' aberto' : ''}`}>
      <button type="button" className="op2-cartao-topo" onClick={onAlternar} aria-expanded={aberto}>
        <span className="op2-cartao-titulo">{h.nome}</span>
        <span className="op2-chevron" aria-hidden>{aberto ? '︿' : '﹀'}</span>
      </button>
      {h.contador && <Contador c={h.contador} onMudar={(valor) => onMudar({ ...h, contador: { ...h.contador!, valor } })} />}
      {aberto && (
        <>
          <TextoHabilidade texto={h.texto} />
          <div className="op2-cartao-acoes">
            <button type="button" onClick={onEditar}>Editar</button>
            <button type="button" onClick={onRemover}>Remover</button>
          </div>
        </>
      )}
    </div>
  )
}

function CartaoEquipamento({ e, aberto, onAlternar, onMudar, onEditar, onRemover }: {
  e: EquipamentoNaFicha
  aberto: boolean
  onAlternar: () => void
  onMudar: (e: EquipamentoNaFicha) => void
  onEditar: () => void
  onRemover: () => void
}) {
  return (
    <div className={`op2-cartao${aberto ? ' aberto' : ''}`}>
      <button type="button" className="op2-cartao-topo" onClick={onAlternar} aria-expanded={aberto}>
        <span className="op2-cartao-titulo">{e.nome}</span>
        <span className="op2-chevron" aria-hidden>{aberto ? '︿' : '﹀'}</span>
      </button>
      {e.usos && (
        <Contador c={{ tipo: 'marcadores', maximo: e.usos.maximo, valor: e.usos.gastos }} onMudar={(gastos) => onMudar({ ...e, usos: { ...e.usos!, gastos } })} />
      )}
      {aberto && (
        <>
          {e.descricao && <TextoHabilidade texto={e.descricao} />}
          <div className="op2-cartao-acoes">
            <button type="button" onClick={onEditar}>Editar</button>
            <button type="button" onClick={onRemover}>Remover</button>
          </div>
        </>
      )}
    </div>
  )
}

const OPCOES_DE_BARRA = [0, 1, 2, 3, 4, 5, 6, 7]

// Janela de habilidades: Seleção (catálogo por cenário) e Criação (a própria).
function JanelaHabilidades({ cenarioInicial, editando, onAdicionar, onSalvar, onFechar }: {
  cenarioInicial: IdCenario
  editando: HabilidadeNaFicha | null
  onAdicionar: (h: Habilidade) => void
  onSalvar: (h: HabilidadeNaFicha) => void
  onFechar: () => void
}) {
  const [aba, setAba] = useState<'selecao' | 'criacao'>(editando ? 'criacao' : 'selecao')
  const [cenario, setCenario] = useState<IdCenario>(cenarioInicial)
  const [busca, setBusca] = useState('')
  const [lendo, setLendo] = useState<string | null>(null)
  const [nome, setNome] = useState(editando?.nome ?? '')
  const [texto, setTexto] = useState(editando?.texto ?? '')
  const [barra, setBarra] = useState(editando?.contador?.maximo ?? 0)
  const lista = HABILIDADES.filter((h) => h.cenario === cenario && sem(h.nome).includes(sem(busca.trim()))).sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <div className="op2-janela-fundo" onPointerDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="op2-janela-pilha">
        <div className="op2-janela-abas">
          {!editando && <button type="button" className={aba === 'selecao' ? 'ativa' : undefined} onClick={() => setAba('selecao')}>Seleção de Habilidades</button>}
          <button type="button" className={aba === 'criacao' ? 'ativa' : undefined} onClick={() => setAba('criacao')}>{editando ? 'Editar Habilidade' : 'Criação de Habilidade'}</button>
        </div>
        <div className="op2-janela" role="dialog" aria-label={aba === 'selecao' ? 'Seleção de Habilidades' : 'Criação de Habilidade'}>
          <header className="op2-janela-topo">
            <h3>{aba === 'selecao' ? 'Seleção de Habilidades' : editando ? 'Editar Habilidade' : 'Criação de Habilidade'}</h3>
            <button type="button" aria-label="Fechar" onClick={onFechar}>✕</button>
          </header>
          {aba === 'selecao' ? (
            <>
              <label className="op2-busca"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar Habilidades" /><span aria-hidden>⌕</span></label>
              <div className="op2-janela-cenarios">
                {(Object.keys(CENARIOS) as IdCenario[]).map((id) => (
                  <button key={id} type="button" className={`op2-janela-cenario op2-janela-cenario-${id}${cenario === id ? ' ativa' : ''}`} onClick={() => setCenario(id)}>{CENARIOS[id].nome}</button>
                ))}
              </div>
              <div className="op2-janela-lista">
                {lista.map((h) => (
                  <div key={h.id} className={`op2-cartao${lendo === h.id ? ' aberto' : ''}`}>
                    <div className="op2-cartao-topo">
                      <button type="button" className="op2-cartao-titulo" onClick={() => setLendo(lendo === h.id ? null : h.id)}>{h.nome}</button>
                      <button type="button" className="op2-cartao-mais" aria-label={`Adicionar ${h.nome}`} onClick={() => onAdicionar(h)}>+</button>
                    </div>
                    {h.contador && <Contador c={{ ...h.contador, valor: 0 }} />}
                    {lendo === h.id && <TextoHabilidade texto={h.texto} />}
                  </div>
                ))}
                {!lista.length && <p className="op2-vazio-lista">Nenhuma habilidade encontrada.</p>}
              </div>
            </>
          ) : (
            <form
              className="op2-criacao"
              onSubmit={(e) => {
                e.preventDefault()
                if (!nome.trim() || !texto.trim()) return
                onSalvar({
                  id: editando?.id ?? `propria-${crypto.randomUUID()}`,
                  nome: nome.trim(),
                  texto: texto.trim(),
                  ...(barra ? { contador: { tipo: 'espacos' as const, maximo: barra, valor: Math.min(barra, editando?.contador?.valor ?? 0) } } : {}),
                })
              }}
            >
              <div className="op2-criacao-linha">
                <label className="op2-campo">Nome*<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da Habilidade" required /></label>
                <label className="op2-campo op2-campo-curto">Barra de Ímpeto
                  <select value={barra} onChange={(e) => setBarra(Number(e.target.value))}>
                    {OPCOES_DE_BARRA.map((n) => <option key={n} value={n}>{n ? `${n} espaço${n > 1 ? 's' : ''}` : 'Não'}</option>)}
                  </select>
                </label>
              </div>
              <label className="op2-campo">Descrição*<textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Descrição da Habilidade" rows={9} required /></label>
              <p className="op2-dica">**negrito** fica na cor do tema · {'{d4}'} vira o ícone do dado · linhas começando com "- " viram lista.</p>
              <button type="submit" className="op2-botao-adicionar">{editando ? 'Salvar' : 'Adicionar'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const OPCOES_DE_USOS = [0, 1, 2, 3, 4, 5, 6, 8, 10]

function JanelaEquipamento({ editando, onSalvar, onFechar }: { editando: EquipamentoNaFicha | null; onSalvar: (e: EquipamentoNaFicha) => void; onFechar: () => void }) {
  const [nome, setNome] = useState(editando?.nome ?? '')
  const [usos, setUsos] = useState(editando?.usos?.maximo ?? 0)
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  return (
    <div className="op2-janela-fundo" onPointerDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="op2-janela" role="dialog" aria-label="Criação de Equipamentos">
        <header className="op2-janela-topo">
          <h3>{editando ? 'Editar Equipamento' : 'Criação de Equipamentos'}</h3>
          <button type="button" aria-label="Fechar" onClick={onFechar}>✕</button>
        </header>
        <form
          className="op2-criacao"
          onSubmit={(e) => {
            e.preventDefault()
            if (!nome.trim() || !descricao.trim()) return
            onSalvar({
              id: editando?.id ?? crypto.randomUUID(),
              nome: nome.trim(),
              descricao: descricao.trim(),
              usos: usos ? { maximo: usos, gastos: Math.min(usos, editando?.usos?.gastos ?? 0) } : null,
            })
          }}
        >
          <div className="op2-criacao-linha">
            <label className="op2-campo">Nome*<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do Equipamento" required /></label>
            <label className="op2-campo op2-campo-curto">Limite de usos
              <select value={usos} onChange={(e) => setUsos(Number(e.target.value))}>
                {OPCOES_DE_USOS.map((n) => <option key={n} value={n}>{n || 'Não'}</option>)}
              </select>
            </label>
          </div>
          <label className="op2-campo">Descrição*<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do Equipamento" rows={7} required /></label>
          <button type="submit" className="op2-botao-adicionar">{editando ? 'Salvar' : 'Adicionar'}</button>
        </form>
      </div>
    </div>
  )
}

export default function Habilidades({ op2, mudar }: { op2: FichaOP2; mudar: Mudar }) {
  const [aba, setAba] = useState<'habilidades' | 'equipamentos'>('habilidades')
  const [busca, setBusca] = useState('')
  const [abertos, setAbertos] = useState<string[]>([])
  const [janela, setJanela] = useState<{ tipo: 'habilidade'; editando: HabilidadeNaFicha | null } | { tipo: 'equipamento'; editando: EquipamentoNaFicha | null } | null>(null)
  const alternar = (id: string) => setAbertos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const habilidades = op2.habilidades.filter((h) => sem(h.nome).includes(sem(busca.trim())))

  const salvarHabilidade = (h: HabilidadeNaFicha) =>
    mudar((f) => ({ ...f, habilidades: f.habilidades.some((x) => x.id === h.id) ? f.habilidades.map((x) => (x.id === h.id ? h : x)) : [...f.habilidades, h] }))
  const salvarEquipamento = (e: EquipamentoNaFicha) =>
    mudar((f) => ({ ...f, equipamentos: f.equipamentos.some((x) => x.id === e.id) ? f.equipamentos.map((x) => (x.id === e.id ? e : x)) : [...f.equipamentos, e] }))

  return (
    <div className="op2-hab">
      <div className="op2-hab-abas">
        <button type="button" className={`op2-hab-aba${aba === 'habilidades' ? ' ativa' : ''}`} onClick={() => setAba('habilidades')}>Habilidades</button>
        <button type="button" className={`op2-hab-aba${aba === 'equipamentos' ? ' ativa' : ''}`} onClick={() => setAba('equipamentos')}>Equipamentos</button>
        <button type="button" className="op2-hab-mais" aria-label={aba === 'habilidades' ? 'Adicionar habilidade' : 'Adicionar equipamento'} onClick={() => setJanela(aba === 'habilidades' ? { tipo: 'habilidade', editando: null } : { tipo: 'equipamento', editando: null })}>+</button>
      </div>

      {aba === 'habilidades' ? (
        <>
          <label className="op2-busca"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar Habilidades" /><span aria-hidden>⌕</span></label>
          <div className="op2-armadura">
            <Escudo />
            <div>
              <span>Pontos de Armadura</span>
              <div className="op2-contador">
                <button type="button" aria-label="Menos um ponto de armadura" disabled={op2.pontosDeArmadura <= 0} onClick={() => mudar((f) => ({ ...f, pontosDeArmadura: f.pontosDeArmadura - 1 }))}>−</button>
                <span>{op2.pontosDeArmadura}</span>
                <button type="button" aria-label="Mais um ponto de armadura" onClick={() => mudar((f) => ({ ...f, pontosDeArmadura: f.pontosDeArmadura + 1 }))}>+</button>
              </div>
            </div>
            <Escudo />
          </div>
          {habilidades.map((h) => (
            <CartaoHabilidade
              key={h.id}
              h={h}
              aberto={abertos.includes(h.id)}
              onAlternar={() => alternar(h.id)}
              onMudar={salvarHabilidade}
              onEditar={() => setJanela({ tipo: 'habilidade', editando: h })}
              onRemover={() => window.confirm(`Remover ${h.nome}?`) && mudar((f) => ({ ...f, habilidades: f.habilidades.filter((x) => x.id !== h.id) }))}
            />
          ))}
        </>
      ) : op2.equipamentos.length ? (
        op2.equipamentos.map((e) => (
          <CartaoEquipamento
            key={e.id}
            e={e}
            aberto={abertos.includes(e.id)}
            onAlternar={() => alternar(e.id)}
            onMudar={salvarEquipamento}
            onEditar={() => setJanela({ tipo: 'equipamento', editando: e })}
            onRemover={() => window.confirm(`Remover ${e.nome}?`) && mudar((f) => ({ ...f, equipamentos: f.equipamentos.filter((x) => x.id !== e.id) }))}
          />
        ))
      ) : (
        <div className="op2-equip-vazio">Adicione novos equipamentos para vê-los aqui.</div>
      )}

      {janela?.tipo === 'habilidade' && (
        <JanelaHabilidades
          cenarioInicial={op2.cenario}
          editando={janela.editando}
          onAdicionar={(h) => {
            const id = op2.habilidades.some((x) => x.id === h.id) ? `${h.id}-${crypto.randomUUID().slice(0, 6)}` : h.id
            salvarHabilidade({ id, nome: h.nome, texto: h.texto, ...(h.contador ? { contador: { ...h.contador, valor: 0 } } : {}) })
            setJanela(null)
          }}
          onSalvar={(h) => { salvarHabilidade(h); setJanela(null) }}
          onFechar={() => setJanela(null)}
        />
      )}
      {janela?.tipo === 'equipamento' && (
        <JanelaEquipamento editando={janela.editando} onSalvar={(e) => { salvarEquipamento(e); setJanela(null) }} onFechar={() => setJanela(null)} />
      )}
    </div>
  )
}
