import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBullseye, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { supabase } from '../../lib/supabase'
import type { Cena, ObjetoCena } from './cenas'
import { arrastoDoMolde, caminhoDoMolde, contornoDoMolde, FORMAS_MOLDE, nomeDoMolde, origemDoMolde, pegosPeloMolde, rotuloDoMolde, type FormaMolde, type Molde, type Ponto } from './moldes'

export type MoldeSalvo = Molde & { id: string; scene_id: string; campaign_id: string; author_id: string; created_at: string }

const CAMPOS = 'id, scene_id, campaign_id, author_id, forma, x, y, angulo, metros, created_at'
const normal = (m: MoldeSalvo): MoldeSalvo => ({ ...m, x: Number(m.x), y: Number(m.y), angulo: Number(m.angulo), metros: Number(m.metros) })
const trocar = (l: MoldeSalvo[], m: MoldeSalvo) => (l.some((x) => x.id === m.id) ? l.map((x) => (x.id === m.id ? m : x)) : [...l, m])

// Moldes da cena em tempo real (KAN-119).
function useMoldes(cenaId: string | null) {
  const [moldes, setMoldes] = useState<MoldeSalvo[]>([])
  useEffect(() => {
    setMoldes([])
    if (!cenaId) return
    let cancelado = false
    supabase.from('scene_templates').select(CAMPOS).eq('scene_id', cenaId).then(({ data }) => {
      if (!cancelado) setMoldes(((data ?? []) as MoldeSalvo[]).map(normal))
    })
    const filtro = `scene_id=eq.${cenaId}`
    const canal = supabase
      .channel(`moldes:${cenaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scene_templates', filter: filtro }, (p) => setMoldes((l) => trocar(l, normal(p.new as MoldeSalvo))))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scene_templates', filter: filtro }, (p) => setMoldes((l) => trocar(l, normal(p.new as MoldeSalvo))))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'scene_templates' }, (p) => {
        const id = (p.old as { id?: string }).id
        if (id) setMoldes((l) => l.filter((m) => m.id !== id))
      })
      .subscribe()
    return () => {
      cancelado = true
      supabase.removeChannel(canal)
    }
  }, [cenaId])

  const criar = useCallback(async (m: Omit<MoldeSalvo, 'id' | 'created_at'>) => {
    const { data } = await supabase.from('scene_templates').insert(m).select(CAMPOS).single()
    if (data) setMoldes((l) => trocar(l, normal(data as MoldeSalvo)))
    return data ? (data as MoldeSalvo).id : null
  }, [])
  const mover = useCallback(async (id: string, p: Ponto, salvar = true) => {
    setMoldes((l) => l.map((m) => (m.id === id ? { ...m, ...p } : m)))
    if (salvar) await supabase.from('scene_templates').update(p).eq('id', id)
  }, [])
  const excluir = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    setMoldes((l) => l.filter((m) => !ids.includes(m.id)))
    await supabase.from('scene_templates').delete().in('id', ids)
  }, [])
  return { moldes, criar, mover, excluir }
}

type Gesto = { tipo: 'novo'; a: Ponto } | { tipo: 'mover'; id: string; inicio: Ponto; origem: Ponto; ultimo: Ponto }

// Ferramenta Moldes de Área (barra esquerda, Controles de Token): escolhe a forma, aperta onde ela
// começa e arrasta (direção e tamanho, de quadrado em quadrado). Todo mundo vê os moldes e quem
// cada um pegou; com a ferramenta aberta, clicar num molde mostra Marcar alvos e Tirar.
export function useMoldesNoPalco({ cena, ferramenta, souMestre, userId, pontoNoMapa, escala, celula, tokens, meusAlvos, onAlternarAlvo }: {
  cena: Cena | null
  ferramenta: string
  souMestre: boolean
  userId: string
  pontoNoMapa: (x: number, y: number) => Ponto
  escala: number
  celula: { w: number; h: number }
  tokens: ObjetoCena[]
  meusAlvos: string[]
  onAlternarAlvo: (ids: string[]) => void
}) {
  const dados = useMoldes(cena?.id ?? null)
  const [forma, setForma] = useState<FormaMolde>('circulo')
  const [previa, setPrevia] = useState<Molde | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const gesto = useRef<Gesto | null>(null)
  const ativo = ferramenta === 'molde'
  const mpq = cena?.grid_distance || 1.5

  useEffect(() => setSelecionado(null), [cena?.id, ferramenta])

  const podeMexer = (m: MoldeSalvo) => souMestre || m.author_id === userId

  function aoApertar(e: React.PointerEvent<HTMLDivElement>): boolean {
    if (!ativo || e.button !== 0 || !cena) return false
    if ((e.target as Element).closest?.('.mesa-molde-acoes')) return true
    setSelecionado(null)
    const a = origemDoMolde(pontoNoMapa(e.clientX, e.clientY), celula)
    gesto.current = { tipo: 'novo', a }
    setPrevia({ forma, x: a.x, y: a.y, angulo: 0, metros: mpq })
    e.currentTarget.setPointerCapture(e.pointerId)
    return true
  }

  function aoMover(e: React.PointerEvent): void {
    const g = gesto.current
    if (!ativo || !g) return
    const p = pontoNoMapa(e.clientX, e.clientY)
    if (g.tipo === 'novo') {
      const { angulo, metros } = arrastoDoMolde(forma, g.a, p, celula, mpq)
      setPrevia({ forma, x: g.a.x, y: g.a.y, angulo, metros })
    } else {
      // Arrastando um molde: a origem anda de meio em meio quadrado (canto ou centro).
      const o = origemDoMolde({ x: g.origem.x + p.x - g.inicio.x, y: g.origem.y + p.y - g.inicio.y }, celula)
      if (o.x !== g.ultimo.x || o.y !== g.ultimo.y) {
        g.ultimo = o
        dados.mover(g.id, o, false)
      }
    }
  }

  function aoSoltar(): boolean {
    const g = gesto.current
    gesto.current = null
    if (!g) return false
    if (g.tipo === 'novo') {
      const m = previa
      setPrevia(null)
      if (m && cena) {
        void dados.criar({ scene_id: cena.id, campaign_id: cena.campaign_id, author_id: userId, ...m }).then((id) => id && setSelecionado(id))
      }
    } else if (g.ultimo.x !== g.origem.x || g.ultimo.y !== g.origem.y) {
      dados.mover(g.id, g.ultimo)
    }
    return true
  }

  function pegarMolde(e: React.PointerEvent, m: MoldeSalvo) {
    if (!ativo || e.button !== 0) return
    e.stopPropagation()
    setSelecionado(m.id)
    if (!podeMexer(m)) return
    const origem = { x: m.x, y: m.y }
    gesto.current = { tipo: 'mover', id: m.id, inicio: pontoNoMapa(e.clientX, e.clientY), origem, ultimo: origem }
    ;(e.currentTarget as Element).closest('.mesa-palco')?.setPointerCapture(e.pointerId)
  }

  function aoTeclar(e: KeyboardEvent): boolean {
    if (!ativo) return false
    const m = dados.moldes.find((x) => x.id === selecionado)
    if ((e.key === 'Delete' || e.key === 'Backspace') && m && podeMexer(m)) {
      dados.excluir([m.id])
      setSelecionado(null)
      return true
    }
    if (e.key === 'Escape' && selecionado) {
      setSelecionado(null)
      return true
    }
    return false
  }

  const px = 1 / escala
  const desenhar = (m: Molde, chave: string, salvo?: MoldeSalvo) => {
    const pegos = pegosPeloMolde(m, tokens, celula, mpq)
    const r = rotuloDoMolde(m, celula, mpq)
    const sel = salvo && salvo.id === selecionado
    return (
      <g key={chave} className={`mesa-molde mesa-molde-${m.forma}${sel ? ' selecionado' : ''}${salvo ? '' : ' previa'}`}>
        <path
          className="mesa-molde-area"
          d={caminhoDoMolde(contornoDoMolde(m, celula, mpq))}
          strokeWidth={2 * px}
          onPointerDown={salvo ? (e) => pegarMolde(e, salvo) : undefined}
        />
        <circle className="mesa-molde-origem" cx={m.x} cy={m.y} r={4 * px} />
        {tokens.filter((t) => pegos.includes(t.id)).map((t) => (
          <rect key={t.id} className="mesa-molde-pego" x={t.x} y={t.y} width={t.width} height={t.height} rx={6 * px} strokeWidth={3 * px} />
        ))}
        <text x={r.x} y={r.y - 10 * px} fontSize={14 * px} className="mesa-regua-total mesa-molde-rotulo">
          {nomeDoMolde(m)}{pegos.length ? ` · ${pegos.length} ${pegos.length === 1 ? 'pego' : 'pegos'}` : ''}
        </text>
        {sel && salvo && (
          <foreignObject x={r.x - 60 * px} y={r.y - 4 * px} width={120 * px} height={34 * px} overflow="visible">
            <div className="mesa-molde-acoes" style={{ transform: `scale(${px})`, transformOrigin: '0 0' }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
              <button
                type="button"
                title="Marcar quem foi pego como alvo"
                disabled={!pegos.length}
                onClick={() => {
                  const novos = pegos.filter((id) => !meusAlvos.includes(id))
                  if (novos.length) onAlternarAlvo(novos)
                }}
              >
                <FontAwesomeIcon icon={faBullseye} />
              </button>
              {podeMexer(salvo) && (
                <button type="button" title="Tirar o molde (Delete)" onClick={() => { dados.excluir([salvo.id]); setSelecionado(null) }}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              )}
              <button type="button" title="Fechar" onClick={() => setSelecionado(null)}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </foreignObject>
        )}
      </g>
    )
  }

  const camada = cena && (dados.moldes.length || previa) ? (
    <svg className={`mesa-moldes${ativo ? ' ativo' : ''}`} aria-hidden={!ativo}>
      {dados.moldes.map((m) => desenhar(m, m.id, m))}
      {previa && desenhar(previa, 'previa')}
    </svg>
  ) : null

  const meus = dados.moldes.filter(podeMexer)
  const barra = ativo && cena ? (
    <div className="mesa-moldes-barra" role="toolbar" aria-label="Moldes de área" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      {FORMAS_MOLDE.map((f) => (
        <button key={f.id} type="button" className={forma === f.id ? 'ativo' : ''} aria-pressed={forma === f.id} onClick={() => setForma(f.id)}>
          <svg viewBox="0 0 20 20" aria-hidden>
            <path d={ICONE_FORMA[f.id]} />
          </svg>
          {f.rotulo}
        </button>
      ))}
      {meus.length > 0 && (
        <button type="button" className="mesa-moldes-limpar" title={souMestre ? 'Tirar todos os moldes da cena' : 'Tirar os moldes que eu coloquei'} onClick={() => dados.excluir(meus.map((m) => m.id))}>
          <FontAwesomeIcon icon={faTrash} /> {souMestre ? 'Limpar todos' : 'Limpar os meus'}
        </button>
      )}
      <span className="mesa-moldes-dica"><kbd>Clique + Arraste</kbd> no mapa</span>
    </div>
  ) : null

  return { ativo, camada, barra, aoApertar, aoMover, aoSoltar, aoTeclar }
}

const ICONE_FORMA: Record<FormaMolde, string> = {
  circulo: 'M10 2a8 8 0 1 0 0.01 0Z',
  cone: 'M2 10L18 2.5Q20 10 18 17.5Z',
  linha: 'M2 8h16v4H2Z',
  quadrado: 'M3 3h14v14H3Z',
}
