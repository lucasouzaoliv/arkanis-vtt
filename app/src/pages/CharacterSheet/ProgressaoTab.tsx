import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { computeDerivedStats } from '../../lib/rules'
import { getClassExtras, type ClassPower, type ClassProgression, type ClassTrack, type ClassTrackTier } from '../../lib/content'
import { elementoPorChave } from './elementosParanormais'
import {
  NIVEIS_NEX, ROTULO_TIPO, anteriorNex, estadoDoNivel, habilidadeDaMelhoria, lerGanhos, niveisAte, periciasNoGrau,
  proximoNex, type Ganho,
} from './progressao'
import { usePoderes } from './usePoderes'
import { useVersaoDaFicha } from './fichaAoVivo'
import type { CharacterRecord } from './index'

/*
 * Aba de Progressao: a linha do NEX de 5% a 99% e, pra cada nivel, o que a classe ganha
 * ali e as escolhas planejadas (poder, atributo, pericias...). O planejamento fica em
 * character_progression_picks, uma linha por NEX.
 */

type Escolha = {
  kind: 'poder_classe' | 'poder_geral' | 'poder_paranormal' | 'trilha' | 'atributo' | 'pericia' | 'versatilidade' | 'outro'
  label: string
  ref_id: string | null
  // "Aplicar na ficha" (pedido da Millie, 08/10): escolha nova fica pendente; ao aplicar, entra na
  // ficha e guarda o que fez, pra desfazer se for tirada. Escolhas antigas (sem esses campos) não
  // são mexidas: podem já ter sido passadas à mão.
  pendente?: boolean
  aplicado?: { ability_id?: string | null; anterior?: string | null }
}
type LinhaPlano = { nex_percent: number; note: string; picks: Escolha[] }

type Opcao = { id: string; nome: string; detalhe?: string | null; descricao?: string | null; grupo?: string; tipo?: Escolha['kind'] }
type Poder = { id: string; name: string; description: string | null; prerequisites: string | null }

const ATRIBUTOS = [
  { key: 'forca', label: 'Força' },
  { key: 'agilidade', label: 'Agilidade' },
  { key: 'intelecto', label: 'Intelecto' },
  { key: 'vigor', label: 'Vigor' },
  { key: 'presenca', label: 'Presença' },
] as const

const ROTULO_ESCOLHA: Record<Escolha['kind'], string> = {
  poder_classe: 'Poder',
  poder_geral: 'Poder geral',
  poder_paranormal: 'Paranormal',
  trilha: 'Trilha',
  atributo: 'Atributo',
  pericia: 'Perícia',
  versatilidade: 'Versatilidade',
  outro: 'Outro',
}

export default function ProgressaoTab({ character, onUpdated }: { character: CharacterRecord; onUpdated: () => void }) {
  // Recarrega quando a ficha muda em qualquer lugar (Realtime, 11/10).
  const versao = useVersaoDaFicha()
  const [classRow, setClassRow] = useState<any>(null)
  const [tabela, setTabela] = useState<ClassProgression[]>([])
  const [poderes, setPoderes] = useState<ClassPower[]>([])
  const poderesDaFicha = usePoderes(character.id)
  const [habilidadesBase, setHabilidadesBase] = useState<ClassPower[]>([])
  const [trilhas, setTrilhas] = useState<ClassTrack[]>([])
  const [niveisTrilha, setNiveisTrilha] = useState<ClassTrackTier[]>([])
  const [paranormais, setParanormais] = useState<Poder[]>([])
  const [gerais, setGerais] = useState<Poder[]>([])
  const [pericias, setPericias] = useState<{ id: string; name: string }[]>([])
  const [plano, setPlano] = useState<Record<number, LinhaPlano>>({})
  // Copia sempre atual do plano: varios cliques seguidos nao podem partir do mesmo estado velho.
  const planoRef = useRef(plano)
  const [lembrete, setLembrete] = useState('')
  const [carregou, setCarregou] = useState(false)

  const nexAtual = character.nex_percent ?? 0
  const [selecionado, setSelecionado] = useState(() => (nexAtual >= 99 ? 99 : proximoNex(nexAtual)))

  useEffect(() => {
    supabase.from('characters').select('progressao_lembrete').eq('id', character.id).single()
      .then(({ data }) => setLembrete(data?.progressao_lembrete ?? ''))
    supabase.from('skills').select('id, name').order('sort_order').then(({ data }) => setPericias(data ?? []))
    supabase.from('paranormal_powers').select('id, name, description, prerequisites').order('name')
      .then(({ data }) => setParanormais(data ?? []))
    supabase.from('general_powers').select('id, name, description, prerequisites').order('name')
      .then(({ data }) => setGerais(data ?? []))
  }, [character.id])

  // Só o plano é relido quando a ficha muda em outro lugar (o lembrete não, pra não apagar o que se digita).
  useEffect(() => { carregarPlano() }, [character.id, versao])

  useEffect(() => {
    if (!character.class_id) { setCarregou(true); return }
    supabase.from('classes').select('*').eq('id', character.class_id).single().then(({ data }) => setClassRow(data))
    supabase.from('class_powers').select('id, name, description, prerequisites').eq('class_id', character.class_id).eq('is_base_ability', true)
      .then(({ data }) => setHabilidadesBase(data ?? []))
    getClassExtras(character.class_id).then((extras) => {
      setTabela(extras.progression)
      setPoderes(extras.powers.filter((p: any) => !p.is_base_ability))
      setTrilhas(extras.tracks)
      setNiveisTrilha(extras.tiers)
      setCarregou(true)
    })
  }, [character.class_id])

  async function carregarPlano() {
    const { data } = await supabase.from('character_progression_picks').select('nex_percent, note, picks').eq('character_id', character.id)
    const mapa: Record<number, LinhaPlano> = {}
    for (const linha of data ?? []) mapa[linha.nex_percent] = linha as LinhaPlano
    planoRef.current = mapa
    setPlano(mapa)
  }

  async function gravarLinha(linha: LinhaPlano) {
    planoRef.current = { ...planoRef.current, [linha.nex_percent]: linha }
    setPlano(planoRef.current)
    await supabase.from('character_progression_picks').upsert(
      { character_id: character.id, nex_percent: linha.nex_percent, note: linha.note, picks: linha.picks },
      { onConflict: 'character_id,nex_percent' },
    )
  }

  // Uma coisa por vez na ficha: dois cliques seguidos não aplicam em dobro.
  const fila = useRef<Promise<unknown>>(Promise.resolve())
  function emFila<T>(f: () => Promise<T>): Promise<T> {
    const proxima = fila.current.then(f, f)
    fila.current = proxima.catch(() => undefined)
    return proxima
  }

  async function mudarLinha(nex: number, mudar: (linha: LinhaPlano) => Partial<LinhaPlano>) {
    return emFila(async () => {
      const atual = planoRef.current[nex] ?? { nex_percent: nex, note: '', picks: [] }
      const mudanca = mudar(atual)
      const nova = { ...atual, ...mudanca }
      if (mudanca.picks) {
        const novas = mudanca.picks
        // O que entrou fica pendente; o que saiu e já estava na ficha é desfeito.
        nova.picks = novas.map((e) => (atual.picks.includes(e) ? e : { ...e, pendente: true }))
        let mexeu = false
        for (const e of atual.picks.filter((x) => !novas.includes(x))) {
          if (e.aplicado) { await desfazerNaFicha(e); mexeu = true }
        }
        if (mexeu) onUpdated()
      }
      await gravarLinha(nova)
    })
  }

  // ---- Aplicar na ficha ----

  async function colunaDoPoder(e: Escolha): Promise<Record<string, string> | null> {
    if (!e.ref_id) return null
    if (e.kind === 'poder_classe') return { class_power_id: e.ref_id }
    if (e.kind === 'poder_geral') return { general_power_id: e.ref_id }
    if (e.kind === 'poder_paranormal') return { paranormal_power_id: e.ref_id }
    if (e.kind === 'versatilidade') {
      if (niveisTrilha.some((t) => t.id === e.ref_id)) return { class_track_tier_id: e.ref_id }
      if (gerais.some((g) => g.id === e.ref_id)) return { general_power_id: e.ref_id }
      return { class_power_id: e.ref_id }
    }
    return null
  }

  const PROXIMO_GRAU: Record<string, string> = { nenhum: 'treinado', treinado: 'veterano', veterano: 'expert', expert: 'expert' }

  async function aplicarNaFicha(e: Escolha): Promise<Escolha> {
    const coluna = await colunaDoPoder(e)
    if (coluna) {
      const [campo, id] = Object.entries(coluna)[0]
      const { data: ja } = await supabase.from('character_abilities').select('id').eq('character_id', character.id).eq(campo, id).limit(1)
      // Já estava na ficha (posto à mão): não duplica, e tirar daqui não apaga o de antes.
      if (ja?.length) return { ...e, pendente: false, aplicado: { ability_id: null } }
      const { data } = await supabase.from('character_abilities').insert({ character_id: character.id, ...coluna }).select('id').single()
      return { ...e, pendente: false, aplicado: { ability_id: data?.id ?? null } }
    }
    if (e.kind === 'atributo' && e.ref_id) {
      const { data } = await supabase.from('characters').select('attributes').eq('id', character.id).single()
      const attrs = { ...(data?.attributes as Record<string, number>) }
      attrs[e.ref_id] = (attrs[e.ref_id] ?? 0) + 1
      await supabase.from('characters').update({ attributes: attrs }).eq('id', character.id)
      return { ...e, pendente: false, aplicado: {} }
    }
    if (e.kind === 'pericia' && e.ref_id) {
      const { data } = await supabase.from('character_skills').select('training, attribute_override, extra_bonus').eq('character_id', character.id).eq('skill_id', e.ref_id).maybeSingle()
      const anterior = data?.training ?? 'nenhum'
      await supabase.from('character_skills').upsert({
        character_id: character.id, skill_id: e.ref_id, training: PROXIMO_GRAU[anterior] ?? anterior,
        attribute_override: data?.attribute_override ?? null, extra_bonus: data?.extra_bonus ?? 0,
      })
      return { ...e, pendente: false, aplicado: { anterior } }
    }
    return { ...e, pendente: false }
  }

  async function desfazerNaFicha(e: Escolha) {
    if (!e.aplicado) return
    if (e.aplicado.ability_id) {
      await supabase.from('character_abilities').delete().eq('id', e.aplicado.ability_id)
    } else if (e.kind === 'atributo' && e.ref_id) {
      const { data } = await supabase.from('characters').select('attributes').eq('id', character.id).single()
      const attrs = { ...(data?.attributes as Record<string, number>) }
      attrs[e.ref_id] = Math.max(0, (attrs[e.ref_id] ?? 0) - 1)
      await supabase.from('characters').update({ attributes: attrs }).eq('id', character.id)
    } else if (e.kind === 'pericia' && e.ref_id && e.aplicado.anterior) {
      await supabase.from('character_skills').update({ training: e.aplicado.anterior }).eq('character_id', character.id).eq('skill_id', e.ref_id)
    }
  }

  // Pendentes nos NEX já alcançados (até o atual).
  const pendentesAlcancados = NIVEIS_NEX.filter((n) => n <= (character.nex_percent ?? 0))
    .reduce((t, n) => t + (plano[n]?.picks.filter((e) => e.pendente).length ?? 0), 0)
  const [aplicando, setAplicando] = useState(false)

  async function aplicarTudo() {
    setAplicando(true)
    await emFila(async () => {
      for (const n of NIVEIS_NEX) {
        if (n > (character.nex_percent ?? 0)) continue
        const linha = planoRef.current[n]
        if (!linha?.picks.some((e) => e.pendente)) continue
        const picks: Escolha[] = []
        for (const e of linha.picks) picks.push(e.pendente ? await aplicarNaFicha(e) : e)
        await gravarLinha({ ...linha, picks })
      }
    })
    setAplicando(false)
    onUpdated()
  }

  const salvarLinha = (nex: number, mudanca: Partial<LinhaPlano>) => mudarLinha(nex, () => mudanca)
  const escolhasEm = (nex: number) => plano[nex]?.picks ?? []
  const adicionar = (nex: number, e: Escolha) => mudarLinha(nex, (l) => ({ picks: [...l.picks, e] }))
  const remover = (nex: number, pred: (e: Escolha) => boolean) => mudarLinha(nex, (l) => ({ picks: l.picks.filter((e) => !pred(e)) }))

  async function mudarNex(nex: number) {
    await supabase.from('characters').update({ nex_percent: nex }).eq('id', character.id)
    onUpdated()
  }

  async function mudarExperiencia(xp: number) {
    await supabase.from('characters').update({ experience: xp }).eq('id', character.id)
    onUpdated()
  }

  async function escolherTrilha(id: string) {
    // A aba Agente da as habilidades da trilha sozinha quando a trilha muda.
    await supabase.from('characters').update({ chosen_track_id: id }).eq('id', character.id)
    onUpdated()
  }

  async function salvarLembrete(valor: string) {
    await supabase.from('characters').update({ progressao_lembrete: valor }).eq('id', character.id)
  }

  const semSanidade = !!character.optional_rules?.sem_sanidade
  const trilha = trilhas.find((t) => t.id === character.chosen_track_id) ?? null
  const elemento = character.afinidade_elemento ? elementoPorChave(character.afinidade_elemento as never) : null
  const nomeClasse = classRow?.name ?? character.custom_class?.name ?? null

  // Transcender troca a Sanidade daquele NEX por um poder paranormal.
  const sanidadePerdida = (nex: number) => {
    if (!classRow) return 0
    let vezes = 0
    for (const [n, linha] of Object.entries(plano)) {
      if (Number(n) <= nex) vezes += linha.picks.filter((e) => e.kind === 'poder_classe' && e.label === 'Transcender').length
    }
    return vezes * (classRow.sanity_per_nex ?? 0)
  }

  const statsEm = (nex: number) => {
    // Poderes que crescem com o NEX (Casca Grossa, Vitalidade Reforçada…) entram na prévia.
    if (!classRow) return null
    const s = computeDerivedStats(classRow, character.attributes, nex, poderesDaFicha)
    return { ...s, maxSanity: s.maxSanity - sanidadePerdida(nex) }
  }

  // Onde cada poder ja foi escolhido, pra marcar na lista.
  const ondeEscolhido = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const [n, linha] of Object.entries(plano)) {
      for (const e of linha.picks) if (e.ref_id) mapa.set(e.ref_id, Number(n))
    }
    return mapa
  }, [plano])

  const ganhosPorNex = useMemo(() => {
    const mapa = new Map<number, Ganho[]>()
    for (const linha of tabela) mapa.set(linha.nex_percent, lerGanhos(linha.gain_text))
    return mapa
  }, [tabela])

  // Poder de classe: os da classe (sem as habilidades base, que vem sozinhas) e os gerais.
  const opcoesDePoder: Opcao[] = [
    ...poderes
      .filter((p) => !habilidadesBase.some((b) => b.id === p.id))
      .map((p) => ({ id: p.id, nome: p.name, detalhe: p.prerequisites, descricao: p.description, grupo: `Poderes de ${nomeClasse ?? 'classe'}`, tipo: 'poder_classe' as const })),
    ...gerais.map((p) => ({ id: p.id, nome: p.name, detalhe: p.prerequisites, descricao: p.description, grupo: 'Poderes gerais', tipo: 'poder_geral' as const })),
  ]

  const semTabela = carregou && tabela.length === 0
  const indiceAtual = NIVEIS_NEX.indexOf(nexAtual)
  const preenchido = indiceAtual < 0 ? 0 : (indiceAtual / (NIVEIS_NEX.length - 1)) * 100

  const agora = statsEm(nexAtual)
  const depois = nexAtual < 99 ? statsEm(proximoNex(nexAtual)) : null

  return (
    <div
      className="prog"
      style={{ '--prog-cor': elemento?.cor ?? '#8b8596' } as React.CSSProperties}
    >
      <header className="prog-topo prog-vidro">
        <div className="prog-nex">
          <span className="prog-rotulo">NEX</span>
          <div className="prog-nex-linha">
            <button type="button" className="prog-seta" aria-label="Descer um NEX" disabled={nexAtual <= 0} onClick={() => mudarNex(anteriorNex(nexAtual))}>‹</button>
            <strong className="prog-nex-valor">{nexAtual}%</strong>
            <button type="button" className="prog-seta" aria-label="Subir um NEX" disabled={nexAtual >= 99} onClick={() => mudarNex(proximoNex(nexAtual))}>›</button>
          </div>
          {character.optional_rules?.nex_experiencia && (
            <label className="prog-xp">
              Experiência
              <select value={character.experience ?? 0} onChange={(e) => mudarExperiencia(Number(e.target.value))}>
                {Array.from({ length: 21 }, (_, i) => i).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="prog-quem">
          <div>
            <span className="prog-rotulo">Classe</span>
            <strong>{nomeClasse ?? '—'}</strong>
          </div>
          <div>
            <span className="prog-rotulo">Trilha</span>
            <strong>{trilha?.name ?? 'Nenhuma ainda'}</strong>
          </div>
          {/* Leva pra ficha o que foi escolhido nos NEX já alcançados (poderes, atributo, perícias). */}
          <button
            type="button"
            className="prog-trocar prog-aplicar"
            disabled={aplicando || pendentesAlcancados === 0}
            title={pendentesAlcancados
              ? 'Coloca na ficha os poderes, atributos e perícias escolhidos até o seu NEX atual. Tirar uma escolha depois desfaz na ficha.'
              : 'Nada novo pra aplicar até o seu NEX atual.'}
            onClick={aplicarTudo}
          >
            {aplicando ? 'Aplicando…' : `Aplicar na ficha${pendentesAlcancados ? ` (${pendentesAlcancados})` : ''}`}
          </button>
        </div>

        {agora && (
          <dl className="prog-stats">
            <Stat nome="Vida" valor={agora.maxPv} proximo={depois?.maxPv} />
            {semSanidade ? (
              <Stat nome="PD" valor={agora.maxPd} proximo={depois?.maxPd} />
            ) : (
              <>
                <Stat nome="Sanidade" valor={agora.maxSanity} proximo={depois?.maxSanity} />
                <Stat nome="PE" valor={agora.maxPe} proximo={depois?.maxPe} />
              </>
            )}
          </dl>
        )}
      </header>

      {semTabela ? (
        <p className="prog-vidro prog-aviso">
          {nomeClasse
            ? `${nomeClasse} não sobe por NEX, então não tem linha de progressão. Use o lembrete abaixo pra anotar o que planeja.`
            : 'Escolha uma classe pra ver a linha de progressão.'}
        </p>
      ) : (
        <>
          <nav className="prog-linha" aria-label="Linha do NEX">
            <div className="prog-trilho" aria-hidden>
              <div className="prog-trilho-cheio" style={{ width: `${preenchido}%` }} />
            </div>
            {NIVEIS_NEX.map((n) => {
              const estado = estadoDoNivel(n, nexAtual)
              const planejado = escolhasEm(n).length > 0 || !!plano[n]?.note
              const tipos = [...new Set((ganhosPorNex.get(n) ?? []).map((g) => ROTULO_TIPO[g.tipo]))]
              return (
                <button
                  key={n}
                  type="button"
                  className={`prog-marco prog-${estado}${n === selecionado ? ' prog-selecionado' : ''}${planejado ? ' prog-planejado' : ''}`}
                  aria-pressed={n === selecionado}
                  onClick={() => setSelecionado(n)}
                >
                  <span className="prog-marco-ponto" />
                  <span className="prog-marco-nex">{n}%</span>
                  <span className="prog-marco-tipo">{tipos.join(' · ')}</span>
                </button>
              )
            })}
          </nav>

          <div className="prog-corpo">
            <section className="prog-vidro prog-detalhe">
              <div className="prog-detalhe-topo">
                <h2 className="prog-titulo">NEX {selecionado}%</h2>
                <span className={`prog-chip prog-chip-${estadoDoNivel(selecionado, nexAtual)}`}>
                  {selecionado === nexAtual
                    ? 'Seu NEX atual'
                    : selecionado < nexAtual
                      ? 'Já alcançado'
                      : `Daqui a ${niveisAte(selecionado, nexAtual)} ${niveisAte(selecionado, nexAtual) === 1 ? 'nível' : 'níveis'}`}
                </span>
              </div>

              <div className="prog-rolagem">
                {(ganhosPorNex.get(selecionado) ?? []).map((g, i) => (
                  <Bloco key={`${selecionado}-${i}`} ganho={g}>
                    {g.tipo === 'poder' && (
                      <EscolhaDePoder
                        escolhas={escolhasEm(selecionado)}
                        opcoes={opcoesDePoder}
                        paranormais={paranormais}
                        ondeEscolhido={ondeEscolhido}
                        onAdicionar={(e) => adicionar(selecionado, e)}
                        onRemover={(pred) => remover(selecionado, pred)}
                      />
                    )}
                    {g.tipo === 'trilha' && (
                      trilha ? (
                        <HabilidadeDaTrilha nivel={niveisTrilha.find((t) => t.track_id === trilha.id && t.nex_percent === selecionado)} trilha={trilha.name} />
                      ) : (
                        <>
                          <p className="prog-dica">Você ainda não escolheu sua trilha. Ela define as habilidades de 10%, 40%, 65% e 99%.</p>
                          <Lista
                            opcoes={trilhas.map((t) => ({ id: t.id, nome: t.name, descricao: t.description }))}
                            onEscolher={(o) => escolherTrilha(o.id)}
                          />
                        </>
                      )
                    )}
                    {g.tipo === 'atributo' && (
                      <div className="prog-atributos">
                        {ATRIBUTOS.map((a) => {
                          const marcado = escolhasEm(selecionado).some((e) => e.kind === 'atributo' && (e.ref_id === a.key || e.label === a.label))
                          const valor = (character.attributes as Record<string, number>)[a.key] ?? 0
                          return (
                            <button
                              key={a.key}
                              type="button"
                              className={`prog-atributo${marcado ? ' prog-marcado' : ''}`}
                              aria-pressed={marcado}
                              onClick={() => marcado
                                ? remover(selecionado, (e) => e.kind === 'atributo')
                                : mudarLinha(selecionado, (l) => ({ picks: [...l.picks.filter((e) => e.kind !== 'atributo'), { kind: 'atributo', label: a.label, ref_id: a.key }] }))}
                            >
                              <span className="prog-atributo-nome">{a.label}</span>
                              <span className="prog-atributo-valor">{valor}{marcado && <> → {valor + 1}</>}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {g.tipo === 'grau' && (
                      <EscolhaDePericias
                        pericias={pericias}
                        limite={periciasNoGrau(nomeClasse, (character.attributes as Record<string, number>).intelecto ?? 0)}
                        escolhas={escolhasEm(selecionado).filter((e) => e.kind === 'pericia')}
                        onAlternar={(p, marcada) => {
                          if (marcada) return remover(selecionado, (e) => e.kind === 'pericia' && e.ref_id === p.id)
                          const limite = periciasNoGrau(nomeClasse, (character.attributes as Record<string, number>).intelecto ?? 0)
                          // Conta no plano mais novo, nao no da tela: cliques rapidos nao passam do limite.
                          return mudarLinha(selecionado, (l) => l.picks.filter((e) => e.kind === 'pericia').length >= (limite ?? Infinity)
                            ? {}
                            : { picks: [...l.picks, { kind: 'pericia', label: p.name, ref_id: p.id }] })
                        }}
                      />
                    )}
                    {g.tipo === 'versatilidade' && (
                      <EscolhaUnica
                        dica="Escolha um poder da sua classe ou a primeira habilidade de outra trilha."
                        escolha={escolhasEm(selecionado).find((e) => e.kind === 'versatilidade')}
                        opcoes={[
                          ...opcoesDePoder,
                          ...niveisTrilha
                            .filter((t) => t.nex_percent === 10 && t.track_id !== trilha?.id)
                            .map((t) => ({ id: t.id, nome: t.name, detalhe: `Trilha ${trilhas.find((x) => x.id === t.track_id)?.name ?? ''}`, descricao: t.description, grupo: 'Primeira habilidade de outra trilha' })),
                        ]}
                        ondeEscolhido={ondeEscolhido}
                        onEscolher={(o) => adicionar(selecionado, { kind: 'versatilidade', label: o.nome, ref_id: o.id })}
                        onTrocar={() => remover(selecionado, (e) => e.kind === 'versatilidade')}
                      />
                    )}
                    {g.tipo === 'melhoria' && <Melhoria texto={g.texto} base={habilidadesBase} />}
                  </Bloco>
                ))}

                {selecionado === 50 && (
                  <Bloco ganho={{ tipo: 'melhoria', texto: 'Afinidade' }} rotulo="Paranormal">
                    <p className="prog-dica">
                      {elemento
                        ? `A partir daqui sua afinidade com ${elemento.nome} vale. Os detalhes estão na aba Afinidade.`
                        : 'A partir de NEX 50% você pode escolher a afinidade com um elemento, na aba Afinidade.'}
                    </p>
                  </Bloco>
                )}

                <Estatisticas agora={statsEm(selecionado)} antes={statsEm(anteriorNex(selecionado))} semSanidade={semSanidade} />

                <label className="prog-nota">
                  <span className="prog-rotulo">Nota deste NEX</span>
                  <NotaLivre
                    key={selecionado}
                    valor={plano[selecionado]?.note ?? ''}
                    onSalvar={(note) => salvarLinha(selecionado, { note })}
                  />
                </label>
              </div>
            </section>

            <aside className="prog-vidro prog-resumo">
              <h2 className="prog-titulo">Caminho planejado</h2>
              <div className="prog-rolagem">
                <Resumo plano={plano} nexAtual={nexAtual} selecionado={selecionado} onSelecionar={setSelecionado} />
              </div>
            </aside>
          </div>
        </>
      )}

      <section className="prog-vidro prog-lembrete">
        <h2 className="prog-titulo">Lembrete geral</h2>
        <textarea
          rows={3}
          value={lembrete}
          placeholder="Ideias pro futuro do agente, combinações de poderes, o que pedir pro mestre..."
          onChange={(e) => setLembrete(e.target.value)}
          onBlur={(e) => salvarLembrete(e.target.value)}
        />
      </section>
    </div>
  )
}

function Stat({ nome, valor, proximo }: { nome: string; valor: number; proximo?: number }) {
  const ganho = proximo != null ? proximo - valor : 0
  return (
    <div className="prog-stat">
      <dt>{nome}</dt>
      <dd>
        {valor}
        {ganho > 0 && <span className="prog-stat-ganho" title="No próximo NEX">+{ganho}</span>}
      </dd>
    </div>
  )
}

function Bloco({ ganho, rotulo, children }: { ganho: Ganho; rotulo?: string; children: React.ReactNode }) {
  return (
    <div className={`prog-bloco prog-bloco-${ganho.tipo}`}>
      <div className="prog-bloco-topo">
        <span className="prog-bloco-tipo">{rotulo ?? ROTULO_TIPO[ganho.tipo]}</span>
        <h3 className="prog-bloco-nome">{ganho.texto}</h3>
      </div>
      {children}
    </div>
  )
}

/** Lista de opcoes com busca; clicar escolhe. */
function Lista({ opcoes, ondeEscolhido, onEscolher }: { opcoes: Opcao[]; ondeEscolhido?: Map<string, number>; onEscolher: (o: Opcao) => void }) {
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const filtradas = termo ? opcoes.filter((o) => o.nome.toLowerCase().includes(termo) || (o.descricao ?? '').toLowerCase().includes(termo)) : opcoes
  return (
    <div className="prog-lista">
      {opcoes.length > 8 && (
        <input className="prog-busca" type="search" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      )}
      <ul>
        {filtradas.map((o, i) => {
          const onde = ondeEscolhido?.get(o.id)
          const novoGrupo = o.grupo && o.grupo !== filtradas[i - 1]?.grupo
          return (
            <li key={o.id}>
              {novoGrupo && <span className="prog-lista-grupo">{o.grupo}</span>}
              <button type="button" className="prog-opcao" onClick={() => onEscolher(o)}>
                <span className="prog-opcao-nome">
                  {o.nome}
                  {onde != null && <span className="prog-opcao-onde">já no NEX {onde}%</span>}
                </span>
                {o.detalhe && <span className="prog-opcao-detalhe">{o.detalhe}</span>}
                {o.descricao && <span className="prog-opcao-desc">{o.descricao}</span>}
              </button>
            </li>
          )
        })}
        {filtradas.length === 0 && <li className="prog-dica">Nada com esse nome.</li>}
      </ul>
    </div>
  )
}

function Escolhido({ nome, detalhe, descricao, onTrocar }: { nome: string; detalhe?: string | null; descricao?: string | null; onTrocar: () => void }) {
  return (
    <div className="prog-escolhido">
      <div className="prog-escolhido-topo">
        <strong>{nome}</strong>
        <button type="button" className="prog-trocar" onClick={onTrocar}>Trocar</button>
      </div>
      {detalhe && <span className="prog-opcao-detalhe">{detalhe}</span>}
      {descricao && <p className="prog-escolhido-desc">{descricao}</p>}
    </div>
  )
}

function EscolhaUnica({ dica, escolha, opcoes, ondeEscolhido, onEscolher, onTrocar }: {
  dica?: string
  escolha: Escolha | undefined
  opcoes: Opcao[]
  ondeEscolhido: Map<string, number>
  onEscolher: (o: Opcao) => void
  onTrocar: () => void
}) {
  if (escolha) {
    const o = opcoes.find((x) => x.id === escolha.ref_id)
    return <Escolhido nome={escolha.label} detalhe={o?.detalhe} descricao={o?.descricao} onTrocar={onTrocar} />
  }
  return (
    <>
      {dica && <p className="prog-dica">{dica}</p>}
      <Lista opcoes={opcoes} ondeEscolhido={ondeEscolhido} onEscolher={onEscolher} />
    </>
  )
}

function EscolhaDePoder({ escolhas, opcoes, paranormais, ondeEscolhido, onAdicionar, onRemover }: {
  escolhas: Escolha[]
  opcoes: Opcao[]
  paranormais: Poder[]
  ondeEscolhido: Map<string, number>
  onAdicionar: (e: Escolha) => void
  onRemover: (pred: (e: Escolha) => boolean) => void
}) {
  const poder = escolhas.find((e) => e.kind === 'poder_classe' || e.kind === 'poder_geral')
  const paranormal = escolhas.find((e) => e.kind === 'poder_paranormal')
  const transcender = poder?.label === 'Transcender'
  return (
    <>
      <EscolhaUnica
        escolha={poder}
        opcoes={opcoes}
        ondeEscolhido={ondeEscolhido}
        onEscolher={(o) => onAdicionar({ kind: o.tipo ?? 'poder_classe', label: o.nome, ref_id: o.id })}
        onTrocar={() => onRemover((e) => e.kind === 'poder_classe' || e.kind === 'poder_geral' || e.kind === 'poder_paranormal')}
      />
      {transcender && (
        <div className="prog-sub">
          <span className="prog-rotulo">Poder paranormal do Transcender</span>
          <EscolhaUnica
            escolha={paranormal}
            opcoes={paranormais.map((p) => ({ id: p.id, nome: p.name, detalhe: p.prerequisites, descricao: p.description }))}
            ondeEscolhido={ondeEscolhido}
            onEscolher={(o) => onAdicionar({ kind: 'poder_paranormal', label: o.nome, ref_id: o.id })}
            onTrocar={() => onRemover((e) => e.kind === 'poder_paranormal')}
          />
        </div>
      )}
    </>
  )
}

function EscolhaDePericias({ pericias, limite, escolhas, onAlternar }: {
  pericias: { id: string; name: string }[]
  limite: number | null
  escolhas: Escolha[]
  onAlternar: (p: { id: string; name: string }, marcada: boolean) => void
}) {
  return (
    <>
      <p className="prog-dica">
        {limite != null
          ? <>Suba o grau de <strong>{limite}</strong> perícias já treinadas ({escolhas.length}/{limite}).</>
          : 'Suba o grau das perícias já treinadas.'}
      </p>
      <div className="prog-pericias">
        {pericias.map((p) => {
          const marcada = escolhas.some((e) => e.ref_id === p.id)
          const cheio = limite != null && escolhas.length >= limite && !marcada
          return (
            <button
              key={p.id}
              type="button"
              className={`prog-pericia${marcada ? ' prog-marcado' : ''}`}
              aria-pressed={marcada}
              disabled={cheio}
              onClick={() => onAlternar(p, marcada)}
            >
              {p.name}
            </button>
          )
        })}
      </div>
    </>
  )
}

function HabilidadeDaTrilha({ nivel, trilha }: { nivel: ClassTrackTier | undefined; trilha: string }) {
  if (!nivel) return <p className="prog-dica">A trilha {trilha} não tem habilidade cadastrada neste NEX.</p>
  return (
    <div className="prog-escolhido">
      <div className="prog-escolhido-topo">
        <strong>{nivel.name}</strong>
        <span className="prog-auto">{trilha}</span>
      </div>
      <p className="prog-escolhido-desc">{nivel.description}</p>
    </div>
  )
}

function Melhoria({ texto, base }: { texto: string; base: ClassPower[] }) {
  const hab = habilidadeDaMelhoria(texto, base)
  return (
    <div className="prog-escolhido">
      <div className="prog-escolhido-topo">
        <strong>{hab?.name ?? texto}</strong>
        <span className="prog-auto">Automático</span>
      </div>
      {hab?.description && <p className="prog-escolhido-desc">{hab.description}</p>}
    </div>
  )
}

function Estatisticas({ agora, antes, semSanidade }: {
  agora: { maxPv: number; maxPe: number; maxSanity: number; maxPd: number } | null
  antes: { maxPv: number; maxPe: number; maxSanity: number; maxPd: number } | null
  semSanidade: boolean
}) {
  if (!agora) return null
  const linhas = semSanidade
    ? [['Vida', agora.maxPv, antes?.maxPv], ['PD', agora.maxPd, antes?.maxPd]] as const
    : [['Vida', agora.maxPv, antes?.maxPv], ['Sanidade', agora.maxSanity, antes?.maxSanity], ['PE', agora.maxPe, antes?.maxPe]] as const
  return (
    <div className="prog-bloco prog-bloco-stats">
      <div className="prog-bloco-topo">
        <span className="prog-bloco-tipo">Neste NEX</span>
      </div>
      <dl className="prog-stats prog-stats-nivel">
        {linhas.map(([nome, valor, anterior]) => (
          <div key={nome} className="prog-stat">
            <dt>{nome}</dt>
            <dd>
              {valor}
              {anterior != null && valor - anterior > 0 && <span className="prog-stat-ganho">+{valor - anterior}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Nota com estado proprio: salva quando sai do campo, nao a cada letra. */
function NotaLivre({ valor, onSalvar }: { valor: string; onSalvar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor)
  useEffect(() => setTexto(valor), [valor])
  return (
    <textarea
      rows={2}
      value={texto}
      placeholder="O que você quer lembrar quando chegar aqui..."
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { if (texto !== valor) onSalvar(texto) }}
    />
  )
}

function Resumo({ plano, nexAtual, selecionado, onSelecionar }: {
  plano: Record<number, LinhaPlano>
  nexAtual: number
  selecionado: number
  onSelecionar: (n: number) => void
}) {
  const niveis = NIVEIS_NEX.filter((n) => (plano[n]?.picks.length ?? 0) > 0 || plano[n]?.note)
  if (niveis.length === 0) {
    return <p className="prog-dica">Nada planejado ainda. Clique num NEX da linha pra escolher o que ganhar nele.</p>
  }
  return (
    <ol className="prog-resumo-lista">
      {niveis.map((n) => (
        <li key={n}>
          <button
            type="button"
            className={`prog-resumo-linha prog-${estadoDoNivel(n, nexAtual)}${n === selecionado ? ' prog-selecionado' : ''}`}
            onClick={() => onSelecionar(n)}
          >
            <span className="prog-resumo-nex">{n}%</span>
            <span className="prog-resumo-itens">
              {plano[n].picks.map((e, i) => (
                <span key={i} className="prog-resumo-item">
                  <span className="prog-resumo-tipo">{ROTULO_ESCOLHA[e.kind] ?? e.kind}</span>
                  {e.label}
                </span>
              ))}
              {plano[n].note && <span className="prog-resumo-nota">{plano[n].note}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
