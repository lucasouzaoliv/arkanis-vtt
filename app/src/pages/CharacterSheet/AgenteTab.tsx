import { recortarImagem } from '../../components/RecortarImagem'
import { nomeSeguro } from '../../lib/nomeDeArquivo'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { recordRoll } from '../../lib/rollHistory'
import { attrValue, computeDerivedStats, computePatentePd, rollAttributeTest, trainingBonus, CONDITION_ESCALATION, type AttributeKey, type Training } from '../../lib/rules'
import type { CharacterRecord } from './index'
import RollResult, { type RollResultData } from './RollResult'
import HabilidadesTab from './HabilidadesTab'
import RituaisTab from './RituaisTab'
import { fotoNaMoldura } from './molduras'
import { penalidadeDeCondicoes, rotuloComCondicoes } from './condicoes'
import InventarioTab from './InventarioTab'
import { efeitosValendo, penalidadeDeCarga, type AlvoDeBonus, atributosComBonus, modsComEfeitosDoItem } from './itemMods'
import CombateTab from './CombateTab'
import ModifiersPanel, { type Modifier } from './ModifiersPanel'
import PericiasTable from './PericiasTable'
import AttributeDiagram from './AttributeDiagram'
import StatBar from './StatBar'
import { useClasseDaFicha } from './useClasseDaFicha'
import ConditionsModal, { CUSTOM_ICONS } from './ConditionsModal'
import FrameModal from './FrameModal'
import conditionsIcon from '../../assets/condicoes/conditions.svg'
import enemyEffectsIcon from '../../assets/condicoes/enemy-effects.svg'
import ritualsIcon from '../../assets/condicoes/rituals.svg'
import skillsIcon from '../../assets/condicoes/skills.svg'
import extraIcon from '../../assets/condicoes/extra.svg'
import { getClassExtras, type ClassTrack, type ClassTrackTier } from '../../lib/content'
import pvEmpty from '../../assets/pv-empty.svg'
import pvLow from '../../assets/pv-low.svg'
import pvHalf from '../../assets/pv-half.svg'
import pvFull from '../../assets/pv-full.svg'
import sanityEmpty from '../../assets/sanity-empty.svg'
import sanityLow from '../../assets/sanity-low.svg'
import sanityFull from '../../assets/sanity-full.svg'
import effortEmpty from '../../assets/effort-empty.svg'
import effortHalf from '../../assets/effort-half.svg'
import effortFull from '../../assets/effort-full.svg'
import determinationEmpty from '../../assets/determination-empty.svg'
import determinationLow from '../../assets/determination-low.svg'
import determinationHalf from '../../assets/determination-half.svg'
import determinationFull from '../../assets/determination-full.svg'
import conditionsBorderTop from '../../assets/conditions-border-top.svg'
import conditionsBorderBottom from '../../assets/conditions-border-bottom.svg'
import { bonusDosPoderes, origemDoItem, temProtecaoLeve } from './defesa'
import { usePoderes } from './usePoderes'
import { lerCondicoesPersonalizadas, resumoDosEfeitos, type CondicaoPersonalizada } from './efeitosEscolhidos'
import { TextoRico } from '../../components/TextoRico'
import { tocarSom } from '../../lib/sons'

function pvIconFor(pct: number): string {
  if (pct <= 0) return pvEmpty
  if (pct <= 33) return pvLow
  if (pct <= 66) return pvHalf
  return pvFull
}

function sanityIconFor(pct: number): string {
  if (pct <= 0) return sanityEmpty
  if (pct <= 50) return sanityLow
  return sanityFull
}

function effortIconFor(pct: number): string {
  if (pct <= 0) return effortEmpty
  if (pct <= 50) return effortHalf
  return effortFull
}

function determinationIconFor(pct: number): string {
  if (pct <= 0) return determinationEmpty
  if (pct <= 33) return determinationLow
  if (pct <= 66) return determinationHalf
  return determinationFull
}

type SkillRow = {
  id: string
  name: string
  default_attribute: string | null
  description: string | null
  carga_penalty?: boolean
}

type CharacterSkillRow = {
  skill_id: string
  training: Training
  attribute_override: string | null
  extra_bonus: number
}

export default function AgenteTab({
  character,
  onUpdated,
  editMode,
  originName,
  className,
  trackName,
  elementoNome,
  onNameChange,
}: {
  character: CharacterRecord
  onUpdated: () => void
  editMode: boolean
  originName: string | null
  className: string | null
  trackName: string | null
  elementoNome: string | null
  onNameChange: (name: string) => void
}) {
  const { session } = useAuth()
  const classRow = useClasseDaFicha(character)
  const [skills, setSkills] = useState<SkillRow[]>([])
  // Penalidade que a protecao equipada impoe as pericias de carga (ex.: -5 da pesada).
  const [cargaPenalty, setCargaPenalty] = useState(0)
  // Bonus de pericia que o item equipado da sempre (ex.: Pe de Morto, +5 Furtividade).
  const [bonusDeItens, setBonusDeItens] = useState<Record<string, number>>({})
  const condicoesProprias = lerCondicoesPersonalizadas(character.condicoes_personalizadas)
  // De onde vem cada bônus verde (passar o mouse mostra: item, poder…), pedido da Millie 08/10.
  const [origensPericia, setOrigensPericia] = useState<Record<string, string[]>>({})
  const [origensFicha, setOrigensFicha] = useState<Partial<Record<AlvoDeBonus, string[]>>>({})
  const [origensCarga, setOrigensCarga] = useState<string[]>([])
  // Atributo, PV e PE que os itens equipados somam (ex.: Pujanca +1 Forca).
  const [bonusDeFicha, setBonusDeFicha] = useState<Partial<Record<AlvoDeBonus, number>>>({})
  // Atributo que vale nas contas: o da ficha + itens equipados (o "+1" verde), bug 11/10.
  const atributos = atributosComBonus(character.attributes, bonusDeFicha)
  const [charSkills, setCharSkills] = useState<Record<string, CharacterSkillRow>>({})
  const [roll, setRoll] = useState<RollResultData | null>(null)
  const [rightTab, setRightTab] = useState<'Combate' | 'Habilidades' | 'Rituais' | 'Inventário'>('Combate')
  const poderes = usePoderes(character.id, rightTab)
  const [testModifiers, setTestModifiers] = useState<Modifier[]>([])
  const [testDraft, setTestDraft] = useState({ diceBonus: 0, valueBonus: 0 })
  const [showConditionsModal, setShowConditionsModal] = useState(false)
  const [showFrameModal, setShowFrameModal] = useState(false)
  const [conditionCatalog, setConditionCatalog] = useState<Record<string, { icon: string; description: string }>>({})
  const [openConditionDetail, setOpenConditionDetail] = useState<string | null>(null)
  const [tracks, setTracks] = useState<ClassTrack[]>([])
  const [trackTiers, setTrackTiers] = useState<ClassTrackTier[]>([])
  const [trackMenuOpen, setTrackMenuOpen] = useState(false)

  useEffect(() => {
    const categoryIcon: Record<string, string> = {
      condicao: conditionsIcon,
      efeito_inimigo: enemyEffectsIcon,
      habilidade: skillsIcon,
      extra: extraIcon,
    }
    Promise.all([
      supabase.from('effects_catalog').select('category, name, description'),
      supabase.from('rituals').select('name, effect'),
    ]).then(([effects, rituals]) => {
      const map: Record<string, { icon: string; description: string }> = {}
      for (const row of effects.data ?? []) {
        map[row.name] = { icon: categoryIcon[row.category] ?? conditionsIcon, description: row.description }
      }
      for (const row of rituals.data ?? []) {
        map[row.name] = { icon: ritualsIcon, description: row.effect }
      }
      setConditionCatalog(map)
    })
  }, [])

  useEffect(() => {
    if (!character.class_id) {
      setTracks([])
      setTrackTiers([])
      return
    }
    getClassExtras(character.class_id).then((extras) => {
      setTracks(extras.tracks)
      setTrackTiers(extras.tiers)
    })
  }, [character.class_id])

  async function grantEligibleTrackTiers(trackId: string) {
    const eligibleTiers = trackTiers.filter((t) => t.track_id === trackId && t.nex_percent <= character.nex_percent)
    if (eligibleTiers.length === 0) return

    const [{ data: existingRows }, { data: existingAbilities }] = await Promise.all([
      supabase.from('character_progression_picks').select('nex_percent, note, picks').eq('character_id', character.id),
      supabase.from('character_abilities').select('class_track_tier_id').eq('character_id', character.id).not('class_track_tier_id', 'is', null),
    ])
    const grantedTierIds = new Set((existingAbilities ?? []).map((a) => a.class_track_tier_id))

    let changed = false
    for (const tier of eligibleTiers) {
      const existingRow = existingRows?.find((r) => r.nex_percent === tier.nex_percent)
      const existingPicks: { kind: string; label: string; ref_id: string | null }[] = existingRow?.picks ?? []
      if (!existingPicks.some((p) => p.kind === 'trilha' && p.ref_id === tier.id)) {
        await supabase.from('character_progression_picks').upsert(
          { character_id: character.id, nex_percent: tier.nex_percent, note: existingRow?.note ?? '', picks: [...existingPicks, { kind: 'trilha', label: tier.name, ref_id: tier.id }] },
          { onConflict: 'character_id,nex_percent' }
        )
        changed = true
      }
      if (!grantedTierIds.has(tier.id)) {
        await supabase.from('character_abilities').insert({ character_id: character.id, class_track_tier_id: tier.id })
        changed = true
      }
    }
    if (changed) onUpdated()
  }

  async function pickTrack(trackId: string) {
    setTrackMenuOpen(false)
    await supabase.from('characters').update({ chosen_track_id: trackId }).eq('id', character.id)
    await grantEligibleTrackTiers(trackId)
    onUpdated()
  }

  useEffect(() => {
    if (!character.chosen_track_id || trackTiers.length === 0) return
    grantEligibleTrackTiers(character.chosen_track_id)
  }, [character.chosen_track_id, character.nex_percent, trackTiers])

  // A penalidade de carga vem da descricao da protecao equipada ("-5 em perícias com
  // penalidade de carga"), entao ela muda quando a pessoa equipa ou desequipa.
  useEffect(() => {
    supabase
      .from('character_inventory')
      .select('active_bonuses, applied_modifiers, equipment_items(description, name, type), custom_item')
      .eq('character_id', character.id)
      .eq('is_equipped', true)
      .then(({ data }) => {
        const linhas = (data ?? []).map((i: any) => ({
          nome: (i.equipment_items?.name ?? i.custom_item?.name) as string | undefined,
          descricao: i.equipment_items?.description ?? i.custom_item?.description,
          mods: modsComEfeitosDoItem(i.custom_item?.stats, i.applied_modifiers, i.equipment_items?.name ?? i.custom_item?.name),
          ligados: (i.active_bonuses ?? []) as string[],
        }))
        setCargaPenalty(linhas.reduce((soma, l) => soma + penalidadeDeCarga(l.descricao), 0))
        setOrigensCarga(linhas.filter((l) => penalidadeDeCarga(l.descricao)).map((l) => origemDoItem(l.nome, `${penalidadeDeCarga(l.descricao)} (penalidade de carga)`)))
        const origemP: Record<string, string[]> = {}
        const origemF: Partial<Record<AlvoDeBonus, string[]>> = {}

        const porPericia: Record<string, number> = {}
        const porAlvo: Partial<Record<AlvoDeBonus, number>> = {}
        for (const l of linhas) {
          // os que valem sempre entram direto; os condicionais so se a pessoa ligou
          for (const e of efeitosValendo(l.descricao, l.mods, l.ligados)) {
            const origem = origemDoItem(l.nome, e.valor, e.mod)
            if (e.pericias) for (const p of e.pericias) { porPericia[p] = (porPericia[p] ?? 0) + e.valor; (origemP[p] ??= []).push(origem) }
            if (e.alvo) { porAlvo[e.alvo] = (porAlvo[e.alvo] ?? 0) + e.valor; (origemF[e.alvo] ??= []).push(origem) }
          }
        }
        // Poderes com bônus fixo (Reflexos Defensivos: +2 nos testes de resistência), bug 08/10.
        const protecaoLeve = temProtecaoLeve((data ?? []).map((i: any) => ({ tipo: i.equipment_items?.type ?? i.custom_item?.type, nome: i.equipment_items?.name ?? i.custom_item?.name })))
        const dosPoderes = bonusDosPoderes(poderes, { protecaoLeve })
        for (const [pericia, v] of Object.entries(dosPoderes.pericias)) porPericia[pericia] = (porPericia[pericia] ?? 0) + v
        for (const [pericia, lista] of Object.entries(dosPoderes.origens)) (origemP[pericia] ??= []).push(...lista)
        setBonusDeItens(porPericia)
        setBonusDeFicha(porAlvo)
        setOrigensPericia(origemP)
        setOrigensFicha(origemF)
      })
  }, [character.id, rightTab, poderes])

  useEffect(() => {
    supabase.from('skills').select('id, name, default_attribute, description, carga_penalty').order('sort_order').then(({ data }) => setSkills(data ?? []))
    supabase
      .from('character_skills')
      .select('skill_id, training, attribute_override, extra_bonus')
      .eq('character_id', character.id)
      .then(({ data }) => {
        const map: Record<string, CharacterSkillRow> = {}
        for (const row of data ?? []) map[row.skill_id] = row
        setCharSkills(map)
      })
  }, [character.id])

  const derived = useMemo(() => {
    if (!classRow) return { maxPv: 0, maxPe: 0, maxSanity: 0, maxPd: 0 }
    return computeDerivedStats(classRow, atributos, character.nex_percent, poderes)
  }, [classRow, atributos, character.nex_percent, poderes])

  async function updateAttribute(key: keyof typeof character.attributes, value: number) {
    const attributes = { ...character.attributes, [key]: value }
    await supabase.from('characters').update({ attributes }).eq('id', character.id)
    onUpdated()
  }

  async function updateCharacterField(field: string, value: number | string | null) {
    await supabase.from('characters').update({ [field]: value }).eq('id', character.id)
    onUpdated()
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    // Recorte (pedido da Millie, 08/10): a pessoa enquadra a parte que quer ou usa a inteira.
    const file = escolhido ? await recortarImagem(escolhido, { proporcao: 'quadrado', titulo: 'Foto do personagem' }) : null
    if (!file || !session) return
    const path = `${session.user.id}/${Date.now()}-${nomeSeguro(file.name)}`
    const { error } = await supabase.storage.from('character_photos').upload(path, file, { upsert: true })
    if (error) return
    const { publicUrl } = supabase.storage.from('character_photos').getPublicUrl(path).data
    await updateCharacterField('avatar_url', publicUrl)
  }

  async function addCondition(name: string, propria?: CondicaoPersonalizada) {
    const current = character.conditions ?? []
    // Condição criada na mão: guarda a definição (descrição, ícone e efeitos) na ficha.
    if (propria) {
      const outras = condicoesProprias.filter((c) => c.nome !== propria.nome)
      const next = current.includes(name) ? current : [...current, name]
      await supabase.from('characters').update({ conditions: next, condicoes_personalizadas: [...outras, propria] }).eq('id', character.id)
      onUpdated()
      return
    }
    const escalatesTo = CONDITION_ESCALATION[name]
    if (escalatesTo && current.includes(name)) {
      const next = [...current.filter((c) => c !== name), escalatesTo]
      await supabase.from('characters').update({ conditions: next }).eq('id', character.id)
    } else {
      await supabase.from('characters').update({ conditions: [...current, name] }).eq('id', character.id)
    }
    onUpdated()
  }

  async function removeCondition(index: number) {
    const current = character.conditions ?? []
    const next = current.filter((_, i) => i !== index)
    await supabase.from('characters').update({ conditions: next }).eq('id', character.id)
    onUpdated()
  }

  function rollAttribute(key: AttributeKey, abbr: string) {
    // Condições (Frustrado, Fraco…) tiram dados sozinhas, e a rolagem diz por quê.
    const cond = penalidadeDeCondicoes(character.conditions, { atributo: key }, condicoesProprias)
    const score = atributos[key] + cond.dados
    const { rolls, kept } = rollAttributeTest(score)
    const label = rotuloComCondicoes(`Teste de ${abbr}`, cond.motivos)
    setRoll({ label, rolls, kept, bonus: cond.valor, characterName: character.name, diceTray: character.dice_tray })
    if (session) {
      recordRoll({
        characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
        label, total: kept + cond.valor, detail: `d20 mantido: ${kept} (rolados: ${rolls.join(', ')})${cond.valor ? ` + bônus ${cond.valor}` : ''}`,
        dice: rolls.map((v) => ({ sides: 20, value: v, discarded: v !== kept })), bonus: cond.valor,
      })
    }
  }

  async function setSkillField(skillId: string, patch: Partial<CharacterSkillRow>) {
    const current = charSkills[skillId] ?? { skill_id: skillId, training: 'nenhum', attribute_override: null, extra_bonus: 0 }
    const next = { ...current, ...patch }
    setCharSkills((m) => ({ ...m, [skillId]: next }))
    await supabase.from('character_skills').upsert({ character_id: character.id, skill_id: skillId, training: next.training, attribute_override: next.attribute_override, extra_bonus: next.extra_bonus })
  }

  const activeTestMods = testModifiers.filter((m) => m.is_active)
  const testDiceBonus = activeTestMods.reduce((sum, m) => sum + m.dice_bonus, 0) + testDraft.diceBonus
  const testValueBonus = activeTestMods.reduce((sum, m) => sum + m.value_bonus, 0) + testDraft.valueBonus

  function rollSkill(skill: SkillRow) {
    const cs = charSkills[skill.id] ?? { skill_id: skill.id, training: 'nenhum' as const, attribute_override: null, extra_bonus: 0 }
    const attr = cs.attribute_override ?? skill.default_attribute
    const cond = penalidadeDeCondicoes(character.conditions, { atributo: attr, pericia: skill.name }, condicoesProprias)
    const score = attrValue(atributos, attr) + testDiceBonus + cond.dados
    const { rolls, kept } = rollAttributeTest(score)
    // O mesmo total da tabela: itens equipados (o +N verde) e a penalidade da Proteção Pesada.
    const bonus = trainingBonus(cs.training) + cs.extra_bonus + testValueBonus + (bonusDeItens[skill.name] ?? 0) + (skill.carga_penalty ? cargaPenalty : 0) + cond.valor
    const label = rotuloComCondicoes(`Teste de ${skill.name}`, cond.motivos)
    setRoll({ label, rolls, kept, bonus, characterName: character.name, diceTray: character.dice_tray })
    if (session) {
      recordRoll({
        characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
        label, total: kept + bonus, detail: `d20 mantido: ${kept} (rolados: ${rolls.join(', ')}) + bônus ${bonus}`,
        dice: rolls.map((v) => ({ sides: 20, value: v, discarded: v !== kept })), bonus,
      })
    }
  }

  const maxPv = character.max_pv_override ?? derived.maxPv
  // PE máximo digitável como a Vida (pedido 11/10); vazio volta pra conta da classe.
  const maxPe = character.max_pe_override ?? derived.maxPe
  const maxSanity = character.max_sanity_override ?? derived.maxSanity
  const pct = (cur: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0)
  const maxPdPatente = character.optional_rules.evolucao_patente && classRow
    ? computePatentePd(classRow.pd_patente_initial, classRow.pd_patente_per_patente, atributos.presenca, character.patente)
    : null

  return (
    <div className="vtt-columns">
      {roll && <RollResult result={roll} onClose={() => setRoll(null)} />}

      <div className="vtt-col-side">
        <div className="vtt-card" style={{ textAlign: 'center' }}>
          <div className="vtt-avatar-wrap">
            {/* Com moldura, a foto encolhe pro tamanho do furo dela e a moldura não cobre a foto. */}
            <img
              className="vtt-avatar"
              src={character.avatar_url ?? undefined}
              alt=""
              style={character.avatar_frame ? { width: fotoNaMoldura(character.avatar_frame, 150), height: fotoNaMoldura(character.avatar_frame, 150) } : undefined}
            />
            {character.avatar_frame && <img className="vtt-avatar-frame" src={character.avatar_frame} alt="" />}
          </div>
          {editMode && (
            <div className="vtt-avatar-actions">
              <label className="vtt-avatar-action-btn">
                Mudar foto
                <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
              </label>
              <button type="button" className="vtt-avatar-action-btn" onClick={() => setShowFrameModal(true)}>Mudar moldura</button>
            </div>
          )}

          {showFrameModal && (
            <FrameModal
              currentFrame={character.avatar_frame}
              onClose={() => setShowFrameModal(false)}
              onSave={(frame) => { updateCharacterField('avatar_frame', frame); setShowFrameModal(false) }}
            />
          )}

          {editMode ? (
            <input value={character.name} onChange={(e) => onNameChange(e.target.value)} className="vtt-name-input" style={{ textAlign: 'center', width: '100%' }} />
          ) : (
            <h2 className="vtt-name">{character.name}</h2>
          )}

          <div className="vtt-profile-grid">
            <span className={originName ? 'set' : undefined}>{originName || 'Origem'}</span>
            <span className={className ? 'set' : undefined}>{className || 'Classe'}</span>
            <span className={`vtt-track-field${trackName ? ' set' : ''}`} style={{ position: 'relative' }}>
              <button type="button" onClick={() => setTrackMenuOpen((v) => !v)} disabled={tracks.length === 0}>
                {trackName || 'Trilha'}
              </button>
              {trackMenuOpen && (
                <ul className="vtt-track-menu">
                  {tracks.map((t) => (
                    <li key={t.id}><button type="button" onClick={() => pickTrack(t.id)}>{t.name}</button></li>
                  ))}
                </ul>
              )}
            </span>
            <span className={elementoNome ? 'set' : undefined}>{elementoNome || 'Afinidade'}</span>
          </div>
        </div>

        <div className="vtt-card">
          <AttributeDiagram
            attributes={character.attributes}
            nexPercent={character.nex_percent}
            onRoll={rollAttribute}
            onNexChange={(value) => updateCharacterField('nex_percent', value)}
            editable={editMode}
            onAttributeChange={updateAttribute}
            bonus={bonusDeFicha}
            origens={origensFicha}
          />

          {character.optional_rules.evolucao_patente && (
            <label style={{ display: 'block', marginTop: '0.6em' }}>
              Patente
              <select value={character.patente} onChange={(e) => updateCharacterField('patente', e.target.value)}>
                {['sem_patente', 'recruta', 'operador', 'agente_especial', 'oficial_operacoes', 'agente_elite'].map((p) => (
                  <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="vtt-card">
          <StatBar
            label="Vida"
            icon={pvIconFor(pct(character.current_pv ?? 0, maxPv))}
            current={character.current_pv ?? 0}
            max={maxPv}
            temp={character.temp_pv}
            colorClass="pv"
            onDecrement={() => updateCharacterField('current_pv', (character.current_pv ?? 0) - 1)}
            onIncrement={() => updateCharacterField('current_pv', (character.current_pv ?? 0) + 1)}
            onTempDecrement={() => updateCharacterField('temp_pv', Math.max(0, (character.temp_pv ?? 0) - 1))}
            onTempIncrement={() => updateCharacterField('temp_pv', (character.temp_pv ?? 0) + 1)}
            onCurrentChange={(value) => updateCharacterField('current_pv', value)}
            onMaxChange={(value) => updateCharacterField('max_pv_override', value)}
            deathMarks={character.pv_death_marks ?? 0}
            onToggleDeathMark={(i) => updateCharacterField('pv_death_marks', (character.pv_death_marks ?? 0) ^ (1 << i))}
            onHeal={() => { updateCharacterField('current_pv', 1); updateCharacterField('pv_death_marks', 0) }}
          />

          {character.optional_rules.sem_sanidade ? (
            <StatBar
              label="Determinação"
              icon={determinationIconFor(pct(character.current_pd ?? 0, derived.maxPd))}
              current={character.current_pd ?? 0}
              max={derived.maxPd}
              temp={character.temp_pd}
              colorClass="pd"
              onDecrement={() => updateCharacterField('current_pd', (character.current_pd ?? 0) - 1)}
              onIncrement={() => updateCharacterField('current_pd', (character.current_pd ?? 0) + 1)}
              onTempDecrement={() => updateCharacterField('temp_pd', Math.max(0, (character.temp_pd ?? 0) - 1))}
              onTempIncrement={() => updateCharacterField('temp_pd', (character.temp_pd ?? 0) + 1)}
              onCurrentChange={(value) => updateCharacterField('current_pd', value)}
            />
          ) : (
            <>
              <StatBar
                label="Sanidade"
                icon={sanityIconFor(pct(character.current_sanity ?? 0, maxSanity))}
                current={character.current_sanity ?? 0}
                max={maxSanity}
                temp={character.temp_sanity}
                colorClass="sanidade"
                onDecrement={() => updateCharacterField('current_sanity', (character.current_sanity ?? 0) - 1)}
                onIncrement={() => updateCharacterField('current_sanity', (character.current_sanity ?? 0) + 1)}
                onTempDecrement={() => updateCharacterField('temp_sanity', Math.max(0, (character.temp_sanity ?? 0) - 1))}
                onTempIncrement={() => updateCharacterField('temp_sanity', (character.temp_sanity ?? 0) + 1)}
                onCurrentChange={(value) => updateCharacterField('current_sanity', value)}
                onMaxChange={(value) => updateCharacterField('max_sanity_override', value)}
                deathMarks={character.sanity_death_marks ?? 0}
                onToggleDeathMark={(i) => updateCharacterField('sanity_death_marks', (character.sanity_death_marks ?? 0) ^ (1 << i))}
                onHeal={() => { updateCharacterField('current_sanity', 1); updateCharacterField('sanity_death_marks', 0) }}
              />
              <StatBar
                label="Esforço"
                icon={effortIconFor(pct(character.current_pe ?? 0, maxPe))}
                current={character.current_pe ?? 0}
                max={maxPe}
                temp={character.temp_pe}
                colorClass="esforco"
                onDecrement={() => updateCharacterField('current_pe', (character.current_pe ?? 0) - 1)}
                onIncrement={() => updateCharacterField('current_pe', (character.current_pe ?? 0) + 1)}
                onTempDecrement={() => updateCharacterField('temp_pe', Math.max(0, (character.temp_pe ?? 0) - 1))}
                onTempIncrement={() => updateCharacterField('temp_pe', (character.temp_pe ?? 0) + 1)}
                onCurrentChange={(value) => updateCharacterField('current_pe', value)}
                onMaxChange={(value) => updateCharacterField('max_pe_override', value)}
              />
            </>
          )}

          {character.optional_rules.evolucao_patente && !character.optional_rules.sem_sanidade && (
            maxPdPatente == null ? (
              <p style={{ fontSize: '0.85em', color: 'var(--text-dim)' }}>PD por Evolução de Patente ainda não confirmado pra essa classe.</p>
            ) : (
              <StatBar
                label="Determinação (Patente)"
                icon={determinationIconFor(pct(character.current_pd ?? 0, maxPdPatente))}
                current={character.current_pd ?? 0}
                max={maxPdPatente}
                temp={character.temp_pd}
                colorClass="pd"
                onDecrement={() => updateCharacterField('current_pd', (character.current_pd ?? 0) - 1)}
                onIncrement={() => updateCharacterField('current_pd', (character.current_pd ?? 0) + 1)}
                onTempDecrement={() => updateCharacterField('temp_pd', Math.max(0, (character.temp_pd ?? 0) - 1))}
                onTempIncrement={() => updateCharacterField('temp_pd', (character.temp_pd ?? 0) + 1)}
                onCurrentChange={(value) => updateCharacterField('current_pd', value)}
              />
            )
          )}

          <img className="vtt-condition-border" src={conditionsBorderTop} alt="" />
          <div className="vtt-condition-header">
            <h3>Condições e Efeitos</h3>
            <button type="button" className="vtt-condition-add" onClick={() => setShowConditionsModal(true)} aria-label="Adicionar condição">+</button>
          </div>
          <img className="vtt-condition-border" src={conditionsBorderBottom} alt="" />
          <div className="vtt-condition-tags">
            {(character.conditions ?? []).map((cond, i) => {
              const propria = condicoesProprias.find((c) => c.nome === cond)
              const info = propria ? { icon: CUSTOM_ICONS[Number(propria.icone) || 0] } : conditionCatalog[cond]
              return (
                <div key={i} className="vtt-condition-tag-row">
                  <button type="button" className="vtt-condition-tag" onClick={() => setOpenConditionDetail(cond)}>
                    {info && <img src={info.icon} alt="" />}
                    <span>{cond}</span>
                  </button>
                  <button type="button" className="vtt-condition-remove" onClick={() => removeCondition(i)} aria-label={`Remover ${cond}`}>×</button>
                </div>
              )
            })}
          </div>

          {openConditionDetail && (
            <div className="vtt-condition-detail-backdrop" onClick={() => setOpenConditionDetail(null)}>
              <div className="vtt-condition-detail-card" onClick={(e) => e.stopPropagation()}>
                <div className="vtt-condition-detail-header">
                  {(() => {
                    const propria = condicoesProprias.find((c) => c.nome === openConditionDetail)
                    const icone = propria ? CUSTOM_ICONS[Number(propria.icone) || 0] : conditionCatalog[openConditionDetail]?.icon
                    return icone ? <img src={icone} alt="" /> : null
                  })()}
                  <h4>{openConditionDetail}</h4>
                  <button type="button" onClick={() => setOpenConditionDetail(null)} aria-label="Fechar">×</button>
                </div>
                {(() => {
                  const propria = condicoesProprias.find((c) => c.nome === openConditionDetail)
                  if (!propria) return <p>{conditionCatalog[openConditionDetail]?.description ?? 'Condição personalizada.'}</p>
                  return (
                    <>
                      <p><TextoRico texto={propria.descricao || 'Condição personalizada.'} /></p>
                      {propria.efeitos.length > 0 && <p><strong>Efeitos:</strong> {resumoDosEfeitos(propria.efeitos)}</p>}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {showConditionsModal && (
        <ConditionsModal onClose={() => setShowConditionsModal(false)} onAddCondition={addCondition} />
      )}

      <div className="vtt-col-main">
        <div className="vtt-card modpanel-card">
          <ModifiersPanel characterId={character.id} scope="teste" onChange={setTestModifiers} onDraftChange={setTestDraft} />
        </div>

        <div className="vtt-card pericias-card">
          <PericiasTable
            skills={skills}
            charSkills={charSkills}
            attributes={atributos}
            testDiceBonus={testDiceBonus}
            dadosDeCondicoes={(nome, atributo) => penalidadeDeCondicoes(character.conditions, { atributo, pericia: nome }, condicoesProprias).dados}
            valorDeCondicoes={(nome, atributo) => penalidadeDeCondicoes(character.conditions, { atributo, pericia: nome }, condicoesProprias).valor}
            testValueBonus={testValueBonus}
            cargaPenalty={cargaPenalty}
            bonusDeItens={bonusDeItens}
            origensDoBonus={origensPericia}
            origensDaCarga={origensCarga}
            origensDosTestes={(nome, atributo) => [
              ...activeTestMods.filter((m) => m.dice_bonus || m.value_bonus).map((m) => `Modificador ${m.name}: ${[m.dice_bonus ? `${m.dice_bonus > 0 ? '+' : ''}${m.dice_bonus}d20` : '', m.value_bonus ? `${m.value_bonus > 0 ? '+' : ''}${m.value_bonus}` : ''].filter(Boolean).join(' ')}`),
              ...penalidadeDeCondicoes(character.conditions, { atributo, pericia: nome }, condicoesProprias).motivos.map((m) => `Condição ${m.replace(/ ([+-])/, ': $1')}`),
            ]}
            onSetSkillField={setSkillField}
            onRoll={rollSkill}
          />
        </div>
      </div>

      <div className="vtt-col-combat">
        <nav className="vtt-subtabs">
          {(['Combate', 'Habilidades', 'Rituais', 'Inventário'] as const).map((t) => (
            <button key={t} type="button" onClick={() => { tocarSom('aba'); setRightTab(t) }} disabled={rightTab === t}>{t}</button>
          ))}
        </nav>

        {rightTab === 'Habilidades' && <HabilidadesTab character={character} />}
        {rightTab === 'Rituais' && <RituaisTab character={character} onGastar={(campo, valor) => updateCharacterField(campo, valor)} />}
        {rightTab === 'Inventário' && <InventarioTab character={character} editMode={editMode} />}
        {rightTab === 'Combate' && <CombateTab character={character} onUpdated={onUpdated} editMode={editMode} />}
      </div>
    </div>
  )
}
