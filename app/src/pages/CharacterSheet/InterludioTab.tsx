import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { recordRoll } from '../../lib/rollHistory'
import { attrValue, computeDerivedStats, limiteDePE, recuperarAteMaximo, rollAttributeTest, rollDiceFormula, trainingBonus, type Training } from '../../lib/rules'
import type { CharacterRecord } from './index'
import RollResult, { type RollResultData } from './RollResult'
import { elementoPorChave } from './elementosParanormais'
import { useClasseDaFicha } from './useClasseDaFicha'
import { ALTURA_CENA, LARGURA_CENA, OBJETOS, centroDe } from './interludioCena'
import { usePoderes } from './usePoderes'
import { useTranscendencias } from './transcender'
import esconderijo from '../../assets/interludio/esconderijo.webp'

type ActionKey = 'alimentar' | 'dormir' | 'exercitar' | 'ler' | 'manutencao' | 'relaxar' | 'revisar_caso' | 'resolver_problema'

const INTERESSES = ['Relacionamento', 'Trabalho', 'Lazer'] as const

const ACTIONS: { key: ActionKey; label: string; description: string }[] = [
  { key: 'alimentar', label: 'Alimentar-se', description: 'Escolha um prato especial (Favorito, Nutritivo, Energético ou Rápido) e receba o benefício dele. Só uma refeição por interlúdio.' },
  { key: 'dormir', label: 'Dormir', description: 'Recupera PV e PE iguais ao seu limite de PE, multiplicado pela condição de descanso (Precária x0,5, Normal x1, Confortável x2, Luxuosa x3). Só pode dormir uma vez por interlúdio.' },
  { key: 'exercitar', label: 'Exercitar-se', description: 'Recebe +1d6 num teste futuro baseado em Agilidade, Força ou Vigor (até o fim da missão). Acumula até um número de cargas igual ao seu Vigor.' },
  { key: 'ler', label: 'Ler', description: 'Recebe +1d6 num teste futuro baseado em Intelecto ou Presença (até o fim da missão). Acumula até um número de cargas igual ao seu Intelecto.' },
  { key: 'manutencao', label: 'Manutenção', description: 'Conserta um item quebrado, recuperando os PV dele ao máximo (registro manual — ainda não há sistema de durabilidade de item).' },
  { key: 'relaxar', label: 'Relaxar', description: 'Funciona como Dormir, mas recupera Sanidade em vez de PV/PE. Cada outro personagem que também relaxar no mesmo interlúdio dá +1 Sanidade adicional pra todos. Só pode relaxar uma vez por interlúdio.' },
  { key: 'revisar_caso', label: 'Revisar Caso', description: 'Escolhe uma página de investigação e uma perícia, testa contra a DT da cena; se passar, ganha uma pista complementar. Pode repetir na mesma cena.' },
  { key: 'resolver_problema', label: 'Resolver Problema (Folga)', description: 'Resolve o problema pendente de uma Folga malsucedida, liberando a ação Relaxar de novo.' },
]

const CONDICOES = [
  { key: 'precaria', label: 'Precária (x0,5)', mult: 0.5 },
  { key: 'normal', label: 'Normal (x1)', mult: 1 },
  { key: 'confortavel', label: 'Confortável (x2)', mult: 2 },
  { key: 'luxuosa', label: 'Luxuosa (x3)', mult: 3 },
]

const PRATOS = [
  { key: 'favorito', label: 'Prato Favorito', description: 'Se relaxar neste interlúdio, recupera 2 de Sanidade adicionais.' },
  { key: 'nutritivo', label: 'Prato Nutritivo', description: 'Se dormir neste interlúdio, aumenta a recuperação de PV em um passo.' },
  { key: 'energetico', label: 'Prato Energético', description: 'Se dormir neste interlúdio, aumenta a recuperação de PE em um passo.' },
  { key: 'rapido', label: 'Prato Rápido', description: 'Se revisar caso neste interlúdio, +5 no teste de perícia.' },
]

export default function InterludioTab({ character, onUpdated }: { character: CharacterRecord & { class_id: string | null }; onUpdated: () => void }) {
  const { session } = useAuth()
  const [selectedActions, setSelectedActions] = useState<ActionKey[]>([])
  const [condicao, setCondicao] = useState<'precaria' | 'normal' | 'confortavel' | 'luxuosa'>('normal')
  const [prato, setPrato] = useState<string | null>(null)
  // Relaxar: cada outro personagem que também relaxa no mesmo interlúdio dá +1 pra todos.
  const [outrosRelaxando, setOutrosRelaxando] = useState(0)
  const [pages, setPages] = useState<{ id: string; title: string; clues: string }[]>([])
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [skills, setSkills] = useState<{ id: string; name: string; default_attribute: string | null }[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [charSkills, setCharSkills] = useState<Record<string, { training: Training; extra_bonus: number; attribute_override: string | null }>>({})
  const [roll, setRoll] = useState<RollResultData | null>(null)
  const [foundClue, setFoundClue] = useState('')
  const [manutencaoNote, setManutencaoNote] = useState('')
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const [tempBonuses, setTempBonuses] = useState<{ id: string; source: string; attribute_group: string; dice: string; remaining: number }[]>([])
  const [paixaoChecked, setPaixaoChecked] = useState(false)
  const [parceiroNome, setParceiroNome] = useState('')
  const [vinculo, setVinculo] = useState<{ vinculo_parceiro: string | null; vinculo_pv_pe_bonus: number; problema_folga: string | null } | null>(null)
  const [interesse, setInteresse] = useState<(typeof INTERESSES)[number]>('Relacionamento')
  const [folgaSkill1, setFolgaSkill1] = useState<string | null>(null)
  const [folgaSkill2, setFolgaSkill2] = useState<string | null>(null)
  const [folgaResult, setFolgaResult] = useState<{ successes: number; nat20: boolean } | null>(null)
  // Painel do lado: uma acao da cena, a folga ou os bonus guardados.
  const [painel, setPainel] = useState<ActionKey | 'folga' | 'bonus' | null>(null)

  async function loadVinculo() {
    const { data } = await supabase.from('characters').select('vinculo_parceiro, vinculo_pv_pe_bonus, problema_folga').eq('id', character.id).single()
    setVinculo(data)
  }

  useEffect(() => {
    loadVinculo()
    supabase.from('character_investigation_pages').select('id, title, clues').eq('character_id', character.id).then(({ data }) => setPages(data ?? []))
    supabase.from('skills').select('id, name, default_attribute').order('sort_order').then(({ data }) => setSkills(data ?? []))
    supabase.from('character_skills').select('skill_id, training, extra_bonus, attribute_override').eq('character_id', character.id).then(({ data }) => {
      const map: Record<string, { training: Training; extra_bonus: number; attribute_override: string | null }> = {}
      for (const row of data ?? []) map[row.skill_id] = row
      setCharSkills(map)
    })
    loadTempBonuses()
  }, [character.id])

  async function loadTempBonuses() {
    const { data } = await supabase.from('character_temp_bonuses').select('id, source, attribute_group, dice, remaining').eq('character_id', character.id).gt('remaining', 0)
    setTempBonuses(data ?? [])
  }

  function toggleAction(key: ActionKey) {
    setSelectedActions((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      if (key !== 'revisar_caso' && prev.length >= 2) return prev
      return [...prev, key]
    })
  }

  const poderes = usePoderes(character.id)
  const limitePE = limiteDePE(character.nex_percent, poderes)
  const classe = useClasseDaFicha(character)
  const transcendeu = useTranscendencias(character.id, character.nex_percent)

  async function confirmar() {
    const patches: Record<string, number | string | null> = {}

    const semSanidade = character.optional_rules.sem_sanidade
    // O descanso para no maximo que a ficha mostra (com os ajustes a mao de maximo).
    const formula = classe ? computeDerivedStats(classe, character.attributes, character.nex_percent, poderes) : null
    const maxPv = character.max_pv_override ?? formula?.maxPv ?? null
    const maxSanity = character.max_sanity_override ?? (formula ? formula.maxSanity - transcendeu * (classe?.sanity_per_nex ?? 0) : null)
    const maxPe = character.max_pe_override ?? formula?.maxPe ?? null
    const maxPd = formula?.maxPd ?? null

    if (selectedActions.includes('dormir')) {
      const base = CONDICOES.find((c) => c.key === condicao)!.mult
      const pvMult = base + (prato === 'nutritivo' ? 1 : 0)
      patches.current_pv = recuperarAteMaximo(character.current_pv ?? 0, Math.round(limitePE * pvMult), maxPv)
      // "Jogando sem Sanidade": dormir só recupera PV (PE não existe nessa regra).
      if (!semSanidade) {
        const peMult = base + (prato === 'energetico' ? 1 : 0)
        patches.current_pe = recuperarAteMaximo(character.current_pe ?? 0, Math.round(limitePE * peMult), maxPe)
      }

      // O vinculo da Regra da Paixao aumenta o maximo e o atual, entao soma por cima do limite.
      if (paixaoChecked && parceiroNome) {
        const rolled = rollDiceFormula('1d8')!
        patches.vinculo_parceiro = parceiroNome
        patches.vinculo_pv_pe_bonus = rolled.total
        patches.current_pv = Number(patches.current_pv) + rolled.total
        if (!semSanidade) patches.current_pe = Number(patches.current_pe) + rolled.total
      }
    }

    if (selectedActions.includes('resolver_problema')) {
      patches.problema_folga = null
    }

    if (selectedActions.includes('relaxar')) {
      const base = CONDICOES.find((c) => c.key === condicao)!.mult
      const bonus = (prato === 'favorito' ? 2 : 0) + outrosRelaxando
      // "Jogando sem Sanidade": relaxar recupera PD em vez de Sanidade.
      if (semSanidade) {
        patches.current_pd = recuperarAteMaximo(character.current_pd ?? 0, Math.round(limitePE * base) + bonus, maxPd)
      } else {
        patches.current_sanity = recuperarAteMaximo(character.current_sanity ?? 0, Math.round(limitePE * base) + bonus, maxSanity)
      }
    }

    if (Object.keys(patches).length) {
      await supabase.from('characters').update(patches).eq('id', character.id)
    }

    if (selectedActions.includes('exercitar')) {
      await supabase.from('character_temp_bonuses').insert({ character_id: character.id, source: 'Exercitar-se', attribute_group: 'fisico', dice: '1d6', remaining: character.attributes.vigor })
    }
    if (selectedActions.includes('ler')) {
      await supabase.from('character_temp_bonuses').insert({ character_id: character.id, source: 'Ler', attribute_group: 'mental', dice: '1d6', remaining: character.attributes.intelecto })
    }

    if (selectedActions.includes('revisar_caso') && selectedPageId && foundClue) {
      const page = pages.find((p) => p.id === selectedPageId)
      if (page) {
        await supabase.from('character_investigation_pages').update({ clues: `${page.clues}\n${foundClue}`.trim() }).eq('id', selectedPageId)
      }
    }

    setConfirmed(`Interlúdio resolvido: ${selectedActions.map((a) => ACTIONS.find((x) => x.key === a)?.label).join(', ')}.`)
    setSelectedActions([])
    setPrato(null)
    setFoundClue('')
    setManutencaoNote('')
    setPaixaoChecked(false)
    setParceiroNome('')
    setOutrosRelaxando(0)
    await loadVinculo()
    onUpdated()
    await loadTempBonuses()
  }

  async function useTempBonus(id: string) {
    const bonus = tempBonuses.find((b) => b.id === id)
    if (!bonus) return
    if (bonus.remaining <= 1) await supabase.from('character_temp_bonuses').delete().eq('id', id)
    else await supabase.from('character_temp_bonuses').update({ remaining: bonus.remaining - 1 }).eq('id', id)
    await loadTempBonuses()
  }

  const canConfirm = selectedActions.length > 0

  function rolarRevisarCaso() {
    const skill = skills.find((s) => s.id === selectedSkillId)
    if (!skill) return
    const cs = charSkills[skill.id] ?? { training: 'nenhum' as const, extra_bonus: 0, attribute_override: null }
    const attr = cs.attribute_override ?? skill.default_attribute
    const score = attrValue(character.attributes, attr)
    const { rolls, kept } = rollAttributeTest(score)
    const bonus = trainingBonus(cs.training) + cs.extra_bonus + (prato === 'rapido' ? 5 : 0)
    const label = `Revisar Caso — Teste de ${skill.name}`
    setRoll({ label, rolls, kept, bonus, characterName: character.name, diceTray: character.dice_tray })
    if (session) {
      recordRoll({
        characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
        label, total: kept + bonus, detail: `d20 mantido: ${kept} (rolados: ${rolls.join(', ')}) + bônus ${bonus}`,
        dice: rolls.map((v) => ({ sides: 20, value: v, discarded: v !== kept })), bonus,
      })
    }
  }

  function testarFolga() {
    let successes = 0
    let nat20 = false
    const parts: string[] = []
    for (const skillId of [folgaSkill1, folgaSkill2]) {
      const skill = skills.find((s) => s.id === skillId)
      if (!skill) continue
      const cs = charSkills[skill.id] ?? { training: 'nenhum' as const, extra_bonus: 0, attribute_override: null }
      const attr = cs.attribute_override ?? skill.default_attribute
      const score = attrValue(character.attributes, attr)
      const { rolls, kept } = rollAttributeTest(score)
      if (rolls.includes(20)) nat20 = true
      const bonus = trainingBonus(cs.training) + cs.extra_bonus
      const total = kept + bonus
      if (total >= 20) successes += 1
      parts.push(`${skill.name}: ${total} (d20 mantido ${kept} + bônus ${bonus})`)
    }
    setFolgaResult({ successes, nat20 })
    if (session) {
      recordRoll({
        characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
        label: `Folga da Ordem (${interesse})`, total: successes, detail: parts.join(' · '),
      })
    }
  }

  async function aplicarFolga() {
    if (!folgaResult) return
    if (folgaResult.successes === 2) {
      const rolled = rollDiceFormula(folgaResult.nat20 ? '3d6' : '1d6')!
      await supabase.from('character_temp_bonuses').insert({ character_id: character.id, source: 'Folga da Ordem', attribute_group: 'geral', dice: `${rolled.total} (fixo)`, remaining: 1 })
    } else if (folgaResult.successes === 0) {
      await supabase.from('characters').update({ problema_folga: `Problema em ${interesse} (folga sem sucesso)` }).eq('id', character.id)
      await loadVinculo()
    }
    setFolgaResult(null)
    await loadTempBonuses()
  }

  async function perderVinculo() {
    await supabase.from('characters').update({ vinculo_parceiro: null, vinculo_pv_pe_bonus: 0 }).eq('id', character.id)
    await loadVinculo()
    onUpdated()
  }

  // Por que uma acao nao pode entrar agora (ou null se pode).
  function bloqueio(key: ActionKey): string | null {
    if (selectedActions.includes(key)) return null
    if (key === 'relaxar' && vinculo?.problema_folga) return 'Relaxar está travado até resolver o problema da folga.'
    if (key !== 'revisar_caso' && selectedActions.length >= 2) return 'Já tem 2 ações neste interlúdio. Tire uma pra trocar.'
    return null
  }

  // Clicar num objeto da cena: escolhe a acao (se der) e abre o painel dela.
  function clicarObjeto(key: ActionKey) {
    setConfirmed(null)
    if (!selectedActions.includes(key) && !bloqueio(key)) toggleAction(key)
    setPainel(key)
  }

  const acao = painel && painel !== 'folga' && painel !== 'bonus' ? ACTIONS.find((a) => a.key === painel)! : null
  const elemento = character.afinidade_elemento ? elementoPorChave(character.afinidade_elemento as never) : null

  return (
    <div className="inter aba-travada" style={{ '--inter-cor': elemento?.cor ?? '#8b8596' } as React.CSSProperties}>
      <svg
        className="inter-cena"
        viewBox={`0 0 ${LARGURA_CENA} ${ALTURA_CENA}`}
        preserveAspectRatio="xMidYMid slice"
        role="group"
        aria-label="Esconderijo: clique no que o agente vai fazer"
      >
        <defs>
          {/* Borda um pouco desfocada: o recorte some na cena em vez de fazer um degrau. */}
          <filter id="inter-borda" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          {OBJETOS.map((o) => (
            <mask key={o.acao} id={`inter-recorte-${o.acao}`} maskUnits="userSpaceOnUse" x="0" y="0" width={LARGURA_CENA} height={ALTURA_CENA}>
              <g filter="url(#inter-borda)">
                {o.contornos.map((c) => <polygon key={c} points={c} fill="#fff" />)}
              </g>
            </mask>
          ))}
        </defs>
        <image href={esconderijo} width={LARGURA_CENA} height={ALTURA_CENA} />
        {OBJETOS.map((o) => {
          const a = ACTIONS.find((x) => x.key === o.acao)!
          const escolhida = selectedActions.includes(o.acao)
          const travada = !!bloqueio(o.acao)
          const [cx, cy] = centroDe(o)
          return (
            <g
              key={o.acao}
              className={`inter-objeto${escolhida ? ' inter-escolhido' : ''}${travada ? ' inter-travado' : ''}${painel === o.acao ? ' inter-aberto' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={a.label}
              aria-pressed={escolhida}
              onClick={() => clicarObjeto(o.acao)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clicarObjeto(o.acao) } }}
            >
              <image
                className="inter-aceso"
                href={esconderijo}
                width={LARGURA_CENA}
                height={ALTURA_CENA}
                mask={`url(#inter-recorte-${o.acao})`}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              />
              {o.contornos.map((c) => <polygon key={c} className="inter-alvo" points={c} />)}
              <g className="inter-etiqueta" transform={`translate(${o.etiqueta[0]} ${o.etiqueta[1]})`}>
                <text textAnchor="middle" dominantBaseline="middle">{a.label}</text>
              </g>
            </g>
          )
        })}
      </svg>

      <header className="inter-topo">
        <h2 className="inter-titulo">Interlúdio</h2>
        <p className="inter-sub">Clique no que o agente vai fazer. Até 2 ações; Revisar Caso pode repetir.</p>
      </header>

      <div className="inter-avisos">
        {confirmed && <p className="inter-vidro inter-aviso" role="status">{confirmed}</p>}
        {vinculo?.problema_folga && (
          <p className="inter-vidro inter-aviso">
            <strong>Problema pendente (Folga):</strong> {vinculo.problema_folga}. Relaxar fica travado até resolver.
          </p>
        )}
        {vinculo?.vinculo_parceiro && (
          <div className="inter-vidro inter-aviso">
            <p><strong>Vínculo romântico:</strong> {vinculo.vinculo_parceiro} (+{vinculo.vinculo_pv_pe_bonus} PV e PE, máx. e atual).</p>
            <p className="inter-dica">Condição Apaixonado: -{vinculo.vinculo_pv_pe_bonus} em testes contra {vinculo.vinculo_parceiro}.</p>
            <button type="button" className="inter-botao" onClick={perderVinculo}>Parceiro morreu</button>
            <p className="inter-dica">Perde o vínculo; condição Trêmulo: -1d20 em Força/Vigor por 3 rodadas.</p>
          </div>
        )}
      </div>

      {painel && (
        <aside className="inter-vidro inter-painel" aria-label="Detalhes">
          <div className="inter-painel-topo">
            <h3 className="inter-painel-titulo">
              {acao ? acao.label : painel === 'folga' ? 'Folga da Ordem' : 'Bônus guardados'}
            </h3>
            <button type="button" className="inter-fechar" aria-label="Fechar" onClick={() => setPainel(null)}>
              {/* Desenhado em vez do caractere "×", que fica fora do centro na fonte. */}
              <svg viewBox="0 0 12 12" aria-hidden><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>

          <div className="inter-painel-corpo">
            {acao && (
              <>
                <p className="inter-desc">{acao.description}</p>

                {(acao.key === 'dormir' || acao.key === 'relaxar') && (
                  <div className="inter-campo">
                    <span className="inter-rotulo">Condição de descanso</span>
                    <div className="inter-opcoes inter-opcoes-4">
                      {CONDICOES.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          className={`inter-opcao${condicao === c.key ? ' inter-marcado' : ''}`}
                          aria-pressed={condicao === c.key}
                          onClick={() => setCondicao(c.key as typeof condicao)}
                        >
                          {c.label.replace(/ \(.*\)/, '')}
                          <span className="inter-opcao-extra">x{String(c.mult).replace('.', ',')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {acao.key === 'relaxar' && (
                  <div className="inter-campo">
                    <span className="inter-rotulo">Quantos outros personagens também relaxaram</span>
                    <p className="inter-dica">Cada um dá +1 de {character.optional_rules.sem_sanidade ? 'Determinação' : 'Sanidade'} pra todos que relaxaram.</p>
                    <div className="inter-contador">
                      <button type="button" aria-label="Menos um" disabled={outrosRelaxando <= 0} onClick={() => setOutrosRelaxando((n) => Math.max(0, n - 1))}>-</button>
                      <span>{outrosRelaxando}</span>
                      <button type="button" aria-label="Mais um" onClick={() => setOutrosRelaxando((n) => n + 1)}>+</button>
                      {outrosRelaxando > 0 && <span className="inter-opcao-extra">+{outrosRelaxando}</span>}
                    </div>
                  </div>
                )}

                {acao.key === 'dormir' && !vinculo?.vinculo_parceiro && (
                  <div className="inter-campo">
                    <span className="inter-rotulo">Regra da Paixão (opcional)</span>
                    <p className="inter-dica">Envolvimento romântico com outro personagem, combinado com a mesa antes.</p>
                    <label className="inter-check">
                      <input type="checkbox" checked={paixaoChecked} onChange={(e) => setPaixaoChecked(e.target.checked)} />
                      Envolver-se romanticamente
                    </label>
                    {paixaoChecked && (
                      <input className="inter-input" placeholder="Nome do parceiro" value={parceiroNome} onChange={(e) => setParceiroNome(e.target.value)} />
                    )}
                  </div>
                )}

                {acao.key === 'alimentar' && (
                  <div className="inter-campo">
                    <span className="inter-rotulo">Prato</span>
                    <div className="inter-pratos">
                      {PRATOS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          className={`inter-prato${prato === p.key ? ' inter-marcado' : ''}`}
                          aria-pressed={prato === p.key}
                          onClick={() => setPrato(p.key)}
                        >
                          <strong>{p.label}</strong>
                          <span>{p.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {acao.key === 'manutencao' && (
                  <div className="inter-campo">
                    <span className="inter-rotulo">Item consertado</span>
                    <input className="inter-input" placeholder="Qual item?" value={manutencaoNote} onChange={(e) => setManutencaoNote(e.target.value)} />
                  </div>
                )}

                {acao.key === 'revisar_caso' && (
                  <div className="inter-campo">
                    <span className="inter-rotulo">Página de investigação</span>
                    <select className="inter-input" value={selectedPageId ?? ''} onChange={(e) => setSelectedPageId(e.target.value || null)}>
                      <option value="">—</option>
                      {pages.map((p) => <option key={p.id} value={p.id}>{p.title || '(sem título)'}</option>)}
                    </select>
                    <span className="inter-rotulo">Perícia</span>
                    <select className="inter-input" value={selectedSkillId ?? ''} onChange={(e) => setSelectedSkillId(e.target.value || null)}>
                      <option value="">—</option>
                      {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {prato === 'rapido' && <p className="inter-dica">+5 no teste (Prato Rápido).</p>}
                    <button type="button" className="inter-botao" disabled={!selectedSkillId} onClick={rolarRevisarCaso}>Rolar teste</button>
                    <span className="inter-rotulo">Pista encontrada (se passar)</span>
                    <textarea className="inter-input" rows={3} value={foundClue} onChange={(e) => setFoundClue(e.target.value)} />
                  </div>
                )}
              </>
            )}

            {painel === 'bonus' && (
              tempBonuses.length === 0 ? (
                <p className="inter-dica">Nenhum bônus guardado. Exercitar-se, Ler e a Folga da Ordem guardam bônus pra testes futuros.</p>
              ) : (
                <ul className="inter-bonus">
                  {tempBonuses.map((b) => (
                    <li key={b.id}>
                      <div>
                        <strong>{b.source}</strong>
                        <span className="inter-dica">
                          {b.remaining}x {b.dice} · {b.attribute_group === 'fisico' ? 'Agilidade/Força/Vigor' : b.attribute_group === 'mental' ? 'Intelecto/Presença' : 'qualquer teste'}
                        </span>
                      </div>
                      <button type="button" className="inter-botao" onClick={() => useTempBonus(b.id)}>Usar 1</button>
                    </li>
                  ))}
                </ul>
              )
            )}

            {painel === 'folga' && (
              <div className="inter-campo">
                <p className="inter-desc">Entre missões, uma folga por missão. Escolha um interesse pessoal e 2 perícias; cada uma é testada contra DT 20.</p>
                <span className="inter-rotulo">Interesse</span>
                <div className="inter-opcoes">
                  {INTERESSES.map((i) => (
                    <button key={i} type="button" className={`inter-opcao${interesse === i ? ' inter-marcado' : ''}`} aria-pressed={interesse === i} onClick={() => setInteresse(i)}>{i}</button>
                  ))}
                </div>
                <span className="inter-rotulo">Perícias</span>
                <select className="inter-input" value={folgaSkill1 ?? ''} onChange={(e) => setFolgaSkill1(e.target.value || null)}>
                  <option value="">—</option>
                  {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="inter-input" value={folgaSkill2 ?? ''} onChange={(e) => setFolgaSkill2(e.target.value || null)}>
                  <option value="">—</option>
                  {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" className="inter-botao" disabled={!folgaSkill1 || !folgaSkill2} onClick={testarFolga}>Testar folga</button>
                {folgaResult && (
                  <div className="inter-resultado">
                    <p>{folgaResult.successes} sucesso(s) de 2.</p>
                    <button type="button" className="inter-botao" onClick={aplicarFolga}>Aplicar resultado</button>
                  </div>
                )}
                {vinculo?.problema_folga && (
                  <>
                    <span className="inter-rotulo">Problema pendente</span>
                    <p className="inter-dica">{ACTIONS.find((a) => a.key === 'resolver_problema')!.description}</p>
                    <button
                      type="button"
                      className={`inter-botao${selectedActions.includes('resolver_problema') ? ' inter-marcado' : ''}`}
                      disabled={!!bloqueio('resolver_problema')}
                      onClick={() => toggleAction('resolver_problema')}
                    >
                      {selectedActions.includes('resolver_problema') ? 'Tirar do interlúdio' : 'Resolver neste interlúdio'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {acao && (
            <div className="inter-painel-rodape">
              {bloqueio(acao.key) && <p className="inter-dica">{bloqueio(acao.key)}</p>}
              {selectedActions.includes(acao.key) ? (
                <button type="button" className="inter-botao" onClick={() => toggleAction(acao.key)}>Tirar do interlúdio</button>
              ) : (
                <button type="button" className="inter-botao inter-botao-forte" disabled={!!bloqueio(acao.key)} onClick={() => toggleAction(acao.key)}>Fazer isso</button>
              )}
            </div>
          )}
        </aside>
      )}

      <footer className="inter-vidro inter-barra">
        <div className="inter-escolhidas">
          {selectedActions.length === 0 ? (
            <span className="inter-dica">Nenhuma ação escolhida.</span>
          ) : (
            selectedActions.map((k) => (
              <span key={k} className="inter-chip">
                <button type="button" className="inter-chip-nome" onClick={() => setPainel(k === 'resolver_problema' ? 'folga' : k)}>
                  {ACTIONS.find((a) => a.key === k)?.label}
                </button>
                <button type="button" className="inter-chip-tirar" aria-label={`Tirar ${ACTIONS.find((a) => a.key === k)?.label}`} onClick={() => toggleAction(k)}>×</button>
              </span>
            ))
          )}
        </div>
        <button type="button" className={`inter-botao${painel === 'bonus' ? ' inter-marcado' : ''}`} onClick={() => setPainel(painel === 'bonus' ? null : 'bonus')}>
          Bônus guardados ({tempBonuses.length})
        </button>
        <button type="button" className={`inter-botao${painel === 'folga' ? ' inter-marcado' : ''}`} onClick={() => setPainel(painel === 'folga' ? null : 'folga')}>
          Folga da Ordem
        </button>
        <button type="button" className="inter-botao inter-botao-forte" onClick={async () => { await confirmar(); setPainel(null) }} disabled={!canConfirm}>
          Resolver interlúdio
        </button>
      </footer>

      {roll && <RollResult result={roll} onClose={() => setRoll(null)} />}
    </div>
  )
}
