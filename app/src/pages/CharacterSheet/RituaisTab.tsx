import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { recordRoll } from '../../lib/rollHistory'
import { custoDoRitual, descontoDeElemento, dtDoRitual, notaDoGasto, recursoDoRitual, type ElementosEscolhidos, type ModoRitual } from './ritualCusto'
import { usePoderes } from './usePoderes'
import { useBonusDosItens } from './useBonusDosItens'
import { atributosComBonus } from './itemMods'
import { custoExtraDeCondicoes, penalidadeDeCondicoes, rotuloComCondicoes } from './condicoes'
import { attrValue, rollAttributeTest, rollDiceFormula, trainingBonus, type Training } from '../../lib/rules'
import type { CharacterRecord } from './index'
import RollResult, { RollCard, type RollCardDie, type RollResultData } from './RollResult'
import RitualPickerModal, { type RitualPickResult } from './RitualPickerModal'
import RitualCard, { diceFromText, type RitualView } from './RitualCard'
import RitualEditModal from './RitualEditModal'
import { useAlvosDaMesa } from '../../lib/miraDaMesa'
import { postarCura } from '../Mesa/acoesDeMira'
import { curaDoTexto } from '../Mesa/mira'
import { encantoDoRitual, regraDoRitual, textoDoEncanto } from './encantos'
import EscolherArmaModal, { type ArmaEscolhivel } from './EscolherArmaModal'
import d20Icon from '../../assets/icons/d20-paranormal.svg'
import sangueIcon from '../../assets/rituais/sangue-simbolo.png'
import morteIcon from '../../assets/rituais/morte-simbolo.png'
import conhecimentoIcon from '../../assets/rituais/conhecimento-simbolo.png'
import energiaIcon from '../../assets/rituais/energia-simbolo.png'
import medoIcon from '../../assets/rituais/medo-simbolo.png'
import { lerCondicoesPersonalizadas } from './efeitosEscolhidos'
import { somDoRitual, tocarSom } from '../../lib/sons'

const ELEMENT_ICON: Record<string, string> = {
  sangue: sangueIcon,
  morte: morteIcon,
  conhecimento: conhecimentoIcon,
  energia: energiaIcon,
  medo: medoIcon,
}

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }


type Ritual = {
  id: string
  name: string
  elemento: string | null
  circle: number
  execution: string | null
  range: string | null
  target: string | null
  duration: string | null
  resistance: string | null
  effect: string
  discente_cost: number | null
  discente_effect: string | null
  verdadeiro_cost: number | null
  verdadeiro_effect: string | null
}

type CustomRitual = {
  name: string
  elemento: string | null
  circle: number | null
  execution?: string | null
  duration?: string | null
  target?: string | null
  range?: string | null
  area?: string | null
  resistance?: string | null
  effect: string
  dice?: string | null
  dice_discente?: string | null
  dice_verdadeiro?: string | null
  discente_cost?: number | null
  discente_effect?: string | null
  verdadeiro_cost?: number | null
  verdadeiro_effect?: string | null
  image_url?: string | null
  description?: string | null
}

type CharacterRitual = {
  id: string
  ritual_id: string | null
  custom_ritual: CustomRitual | null
  rituals: (Ritual & { image_url: string | null }) | null
}

const ELEMENTOS = ['sangue', 'morte', 'conhecimento', 'energia', 'medo'] as const
const CIRCULOS = [1, 2, 3, 4]

export default function RituaisTab({ character, onGastar }: { character: CharacterRecord; onGastar: (campo: 'current_pe' | 'current_pd', valor: number) => Promise<void> }) {
  // DT e custo dependem dos poderes, da Presença (com itens) e do elemento escolhido (11/10).
  const poderes = usePoderes(character.id)
  const atributos = atributosComBonus(character.attributes, useBonusDosItens(character.id))
  const [elementos, setElementos] = useState<ElementosEscolhidos>(character.elementos_escolhidos ?? {})
  const temPoder = (nome: string) => poderes.some((p) => p.trim().toLowerCase() === nome)
  async function escolherElemento(chave: keyof ElementosEscolhidos, elemento: string) {
    const novos = { ...elementos, [chave]: elemento || null }
    setElementos(novos)
    await supabase.from('characters').update({ elementos_escolhidos: novos }).eq('id', character.id)
  }
  const dtGeral = dtDoRitual({ nexPercent: character.nex_percent, presenca: atributos.presenca ?? 0, poderes, elementos })
  const dtDe = (elemento: string | null) => dtDoRitual({ nexPercent: character.nex_percent, presenca: atributos.presenca ?? 0, poderes, elementos, elementoDoRitual: elemento })
  // Custo de conjurar: círculo + variação + condições (Alquebrado…) - Mestre em Elemento.
  const custoFinal = (r: { circle: number; discenteCost: number | null; verdadeiroCost: number | null; elemento: string | null }, mode: ModoRitual) =>
    Math.max(0, custoDoRitual(r.circle, mode, r.discenteCost, r.verdadeiroCost) + custoExtraDeCondicoes(character.conditions, lerCondicoesPersonalizadas(character.condicoes_personalizadas)) - descontoDeElemento(poderes, elementos, r.elemento))
  const { session } = useAuth()
  const [known, setKnown] = useState<CharacterRitual[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CharacterRitual | null>(null)
  const [search, setSearch] = useState('')
  const [elementFilter, setElementFilter] = useState<string[]>([])
  const [circleFilter, setCircleFilter] = useState<number[]>([])
  const [ocultismoSkill, setOcultismoSkill] = useState<{ id: string; default_attribute: string } | null>(null)
  const [ocultismoBonus, setOcultismoBonus] = useState({ training: 'nenhum' as Training, extra_bonus: 0, attribute_override: null as string | null })
  const [roll, setRoll] = useState<RollResultData | null>(null)
  const [ritualRoll, setRitualRoll] = useState<{ title: string; subtitle: string; total: number; dice: RollCardDie[]; bonus: number; nota: string; semRolagem?: boolean } | null>(null)
  const [avisoGasto, setAvisoGasto] = useState<string | null>(null)
  // Alvos marcados com a mira na mesa (12.9): ritual de cura com alvo vai pro chat.
  const alvos = useAlvosDaMesa(character.campaign_id)
  // Amaldiçoar Arma e afins: primeiro escolhe a arma (e o elemento), depois conjura.
  const [armaPara, setArmaPara] = useState<{ ritual: RitualView; mode: ModoRitual; formula: string | null } | null>(null)

  useEffect(() => {
    supabase.from('skills').select('id, default_attribute').eq('name', 'Ocultismo').single().then(({ data }) => {
      if (!data) return
      setOcultismoSkill(data)
      supabase
        .from('character_skills')
        .select('training, extra_bonus, attribute_override')
        .eq('character_id', character.id)
        .eq('skill_id', data.id)
        .maybeSingle()
        .then(({ data: cs }) => {
          if (cs) setOcultismoBonus(cs as any)
        })
    })
  }, [character.id])

  function rollOcultismo() {
    if (!ocultismoSkill) return
    const attr = ocultismoBonus.attribute_override ?? ocultismoSkill.default_attribute
    const cond = penalidadeDeCondicoes(character.conditions, { atributo: attr, pericia: 'Ocultismo' }, lerCondicoesPersonalizadas(character.condicoes_personalizadas))
    const score = attrValue(atributos, attr) + cond.dados
    const { rolls, kept } = rollAttributeTest(score)
    const bonus = trainingBonus(ocultismoBonus.training) + ocultismoBonus.extra_bonus + cond.valor
    const label = rotuloComCondicoes('Teste de Ocultismo', cond.motivos)
    setRoll({ label, rolls, kept, bonus, characterName: character.name, diceTray: character.dice_tray })
    if (session) {
      recordRoll({
        characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
        label, total: kept + bonus, detail: `d20 mantido: ${kept} (rolados: ${rolls.join(', ')}) + bônus ${bonus}`,
        dice: rolls.map((v) => ({ sides: 20, value: v, discarded: v !== kept })), bonus,
      })
    }
  }

  async function loadKnown() {
    const { data } = await supabase
      .from('character_rituals')
      .select('id, ritual_id, custom_ritual, rituals(id, name, elemento, circle, execution, range, target, duration, resistance, effect, discente_cost, discente_effect, verdadeiro_cost, verdadeiro_effect, image_url)')
      .eq('character_id', character.id)
    setKnown((data ?? []) as unknown as CharacterRitual[])
  }

  useEffect(() => { loadKnown() }, [character.id])

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  async function removeRitual(id: string) {
    await supabase.from('character_rituals').delete().eq('id', id)
    await loadKnown()
  }

  async function addFromPicker(result: RitualPickResult) {
    if (result.kind === 'catalog') {
      await supabase.from('character_rituals').insert({ character_id: character.id, ritual_id: result.id })
    } else {
      await supabase.from('character_rituals').insert({
        character_id: character.id,
        custom_ritual: {
          name: result.name,
          elemento: result.elemento,
          circle: result.circle,
          execution: result.execution || null,
          duration: result.duration || null,
          target: result.target || null,
          range: result.range || null,
          area: result.area || null,
          resistance: result.resistance || null,
          effect: result.effect || result.description || '',
          dice: result.dice || null,
          dice_discente: result.diceDiscente || null,
          dice_verdadeiro: result.diceVerdadeiro || null,
          image_url: result.image_url,
          description: result.description || null,
        },
      })
    }
    setAdding(false)
    await loadKnown()
  }

  function toView(cr: CharacterRitual): RitualView | null {
    if (cr.rituals) {
      const r = cr.rituals
      return {
        entryId: cr.id,
        name: r.name,
        elemento: r.elemento,
        circle: r.circle,
        execution: r.execution,
        range: r.range,
        target: r.target,
        area: null,
        duration: r.duration,
        resistance: r.resistance,
        effect: r.effect,
        description: null,
        image_url: r.image_url,
        dice: diceFromText(r.effect),
        diceDiscente: diceFromText(r.discente_effect),
        diceVerdadeiro: diceFromText(r.verdadeiro_effect),
        discenteCost: r.discente_cost,
        discenteEffect: r.discente_effect,
        verdadeiroCost: r.verdadeiro_cost,
        verdadeiroEffect: r.verdadeiro_effect,
      }
    }
    const c = cr.custom_ritual
    if (!c) return null
    return {
      entryId: cr.id,
      name: c.name,
      elemento: c.elemento,
      circle: c.circle ?? 1,
      execution: c.execution ?? null,
      range: c.range ?? null,
      target: c.target ?? null,
      area: c.area ?? null,
      duration: c.duration ?? null,
      resistance: c.resistance ?? null,
      effect: c.effect,
      description: c.description ?? null,
      image_url: c.image_url ?? null,
      dice: c.dice ?? diceFromText(c.effect),
      diceDiscente: c.dice_discente ?? null,
      diceVerdadeiro: c.dice_verdadeiro ?? null,
      discenteCost: c.discente_cost ?? null,
      discenteEffect: c.discente_effect ?? null,
      verdadeiroCost: c.verdadeiro_cost ?? null,
      verdadeiroEffect: c.verdadeiro_effect ?? null,
    }
  }

  // Conjurar (Normal / Discente / Verdadeiro): desconta o custo do PE (ou da Determinação, em
  // "Jogando sem Sanidade"), rola os dados se o ritual tiver e registra tudo no chat e no
  // Histórico com o gasto embaixo.
  async function conjurar(ritual: RitualView, mode: ModoRitual, formula: string | null, arma?: { arma: ArmaEscolhivel; elemento: string }) {
    const regra = regraDoRitual(ritual.name)
    if (regra && !arma && encantoDoRitual(ritual.name, mode, regra.elementos[0] ?? '')) {
      setArmaPara({ ritual, mode, formula })
      return
    }
    // Som do ritual pelo elemento (Sangue, Morte, Conhecimento, Energia, Medo).
    const som = somDoRitual(arma?.elemento ?? ritual.elemento)
    if (som) tocarSom(som)
    // Alquebrado: +1 PE no custo.
    const custo = custoFinal(ritual, mode)
    const recurso = recursoDoRitual(character.optional_rules)
    const antes = (character as unknown as Record<string, number | null>)[recurso.campo] ?? 0
    if (antes < custo && !window.confirm(`Você tem ${antes} ${recurso.sigla} e o ritual custa ${custo}. Conjurar mesmo assim?`)) return
    const depois = Math.max(0, antes - custo)

    // Encanta a arma escolhida antes de gastar (se não der, não gasta).
    const encanto = arma ? encantoDoRitual(ritual.name, mode, arma.elemento) : null
    if (arma && encanto) {
      const { error } = await supabase.rpc('encantar_arma', { p_inventario_id: arma.arma.inventario_id, p_conjurador: character.id, p_encanto: encanto })
      if (error) {
        setAvisoGasto(`Não deu pra encantar a arma: ${error.message}`)
        return
      }
    }
    await onGastar(recurso.campo, depois)
    const nota = notaDoGasto(custo, recurso.sigla, antes, depois)

    const modeLabel = mode === 'normal' ? '' : mode === 'discente' ? ' (Discente)' : ' (Verdadeiro)'
    const label = `Ritual: ${ritual.name}${modeLabel}`

    if (arma && encanto) {
      const notaArma = `${nota} · ${arma.arma.item} de ${arma.arma.personagem}: ${textoDoEncanto(encanto)}`
      setRitualRoll({ title: character.name, subtitle: label, total: 0, dice: [], bonus: 0, nota: notaArma, semRolagem: true })
      if (session) {
        recordRoll({
          characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
          label, total: 0, detail: '', nota: notaArma, semRolagem: true,
        })
      }
      return
    }

    // Ritual de cura com alvo marcado na mesa: "[Personagem] está usando o ritual [X] em [Alvo]"
    // no chat, com o Teste de Ocultismo e depois Curar (que soma na vida do alvo).
    const textoDoModo = mode === 'discente' ? ritual.discenteEffect : mode === 'verdadeiro' ? ritual.verdadeiroEffect : ritual.effect
    const cura = curaDoTexto(textoDoModo) ?? curaDoTexto(ritual.effect)
    if (cura && alvos.length && character.campaign_id) {
      const ocultismo = ocultismoSkill ? ocultismoSkill.default_attribute : 'intelecto'
      const attr = ocultismoBonus.attribute_override ?? ocultismo
      const cond = penalidadeDeCondicoes(character.conditions, { atributo: attr, pericia: 'Ocultismo' }, lerCondicoesPersonalizadas(character.condicoes_personalizadas))
      const erro = await postarCura({
        campanhaId: character.campaign_id,
        characterId: character.id,
        autor: { nome: character.name, foto: character.avatar_url },
        fonte: `o ritual ${ritual.name}${modeLabel}`,
        formula: formula ?? cura.formula,
        recurso: cura.recurso,
        teste: { nome: 'Ocultismo', dados: attrValue(atributos, attr) + cond.dados, bonus: trainingBonus(ocultismoBonus.training) + ocultismoBonus.extra_bonus + cond.valor },
        alvos,
      })
      if (erro) setAvisoGasto(erro)
      else setRitualRoll({ title: character.name, subtitle: label, total: 0, dice: [], bonus: 0, nota: `${nota} · enviado pro chat (Teste de Ocultismo e Curar)`, semRolagem: true })
      if (session) {
        recordRoll({
          characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
          label, total: 0, detail: '', nota, semRolagem: true, semChat: true,
        })
      }
      return
    }
    const rolled = formula ? rollDiceFormula(formula) : null
    if (rolled && formula) {
      // O RollResult e feito pra teste de pericia e assume d20; rolagem de ritual usa a
      // formula do proprio ritual (3d6, 8d6...), entao vai pelo RollCard com os lados certos.
      const sides = Number(formula.match(/d(\d+)/i)?.[1] ?? 20)
      const dice: RollCardDie[] = rolled.rolls.map((v) => ({ sides, value: v }))
      setRitualRoll({ title: character.name, subtitle: label, total: rolled.total, dice, bonus: rolled.modifier, nota })
      if (session) {
        recordRoll({
          characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
          label, total: rolled.total, detail: `${formula}: ${rolled.rolls.join(', ')}${rolled.modifier ? ` ${rolled.modifier > 0 ? '+' : ''}${rolled.modifier}` : ''}`,
          dice, bonus: rolled.modifier, nota,
        })
      }
    } else {
      setRitualRoll({ title: character.name, subtitle: label, total: 0, dice: [], bonus: 0, nota, semRolagem: true })
      if (session) {
        recordRoll({
          characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
          label, total: 0, detail: '', nota, semRolagem: true,
        })
      }
    }
  }

  const filteredKnown = known.filter((cr) => {
    const ritual = cr.rituals ?? cr.custom_ritual
    if (!ritual) return false
    if (elementFilter.length && (!ritual.elemento || !elementFilter.includes(ritual.elemento))) return false
    if (circleFilter.length && !circleFilter.includes(ritual.circle ?? 0)) return false
    if (search && !ritual.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      {roll && <RollResult result={roll} onClose={() => setRoll(null)} />}
      {ritualRoll && (
        <RollCard
          title={ritualRoll.title}
          subtitle={ritualRoll.subtitle}
          total={ritualRoll.total}
          dice={ritualRoll.dice}
          bonus={ritualRoll.bonus}
          extraLines={[ritualRoll.nota]}
          semRolagem={ritualRoll.semRolagem}
          background={character.dice_tray && character.dice_tray !== 'padrao' ? character.dice_tray : undefined}
          onClose={() => setRitualRoll(null)}
        />
      )}

      {armaPara && (() => {
        const regra = regraDoRitual(armaPara.ritual.name)!
        return (
          <EscolherArmaModal
            ritual={armaPara.ritual.name}
            alvo={regra.alvo}
            elementos={regra.elementos}
            campanhaId={character.campaign_id}
            characterId={character.id}
            onEscolher={(a, elemento) => {
              const p = armaPara
              setArmaPara(null)
              conjurar(p.ritual, p.mode, p.formula, { arma: a, elemento })
            }}
            onClose={() => setArmaPara(null)}
          />
        )
      })()}

      {avisoGasto && (
        <p className="rituais-aviso-gasto" role="status">
          {avisoGasto}
          <button type="button" aria-label="Fechar" onClick={() => setAvisoGasto(null)}>×</button>
        </p>
      )}

      <div className="rituais-toolbar">
        <div className="rituais-left-box">
          <div className="rituais-top-row">
            <div className="rituais-search combat-search-field">
              <input className="combat-search-input" placeholder="Busque Rituais" value={search} onChange={(e) => setSearch(e.target.value)} />
              <svg className="combat-search-icon" viewBox="0 0 24 24" aria-hidden>
                <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            <button type="button" className="rituais-add-ghost-btn" onClick={() => setAdding((a) => !a)}>
              Adicionar<br />Ritual
            </button>
          </div>

          <div className="rituais-filter-row">
            {ELEMENTOS.map((e) => (
              <button
                key={e}
                type="button"
                className={`rituais-element-btn${elementFilter.includes(e) ? ' active' : ''}`}
                onClick={() => setElementFilter((f) => toggle(f, e))}
                aria-pressed={elementFilter.includes(e)}
                title={e}
              >
                <img src={ELEMENT_ICON[e]} alt={e} />
              </button>
            ))}

            <div className="rituais-circle-group">
              {CIRCULOS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`rituais-circle-btn${circleFilter.includes(c) ? ' active' : ''}`}
                  onClick={() => setCircleFilter((f) => toggle(f, c))}
                  aria-pressed={circleFilter.includes(c)}
                >
                  {ROMAN[c]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* DT em cima do Ocultismo: do lado dos círculos ela era espremida e o "IV" ficava por cima (11/10). */}
        <div className="rituais-direita">
        <div className="rituais-dt" title={dtGeral.motivos.join('\n')}>
          <span className="rituais-dt-rotulo">DT</span>
          <strong>{dtGeral.dt}</strong>
          {temPoder('especialista em elemento') && (
            <label title="Especialista em Elemento: +2 na DT dos rituais desse elemento">
              +2 DT
              <select value={elementos.especialista ?? ''} onChange={(e) => escolherElemento('especialista', e.target.value)} aria-label="Elemento do Especialista em Elemento">
                <option value="">—</option>
                {ELEMENTOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>
          )}
          {temPoder('mestre em elemento') && (
            <label title="Mestre em Elemento: rituais desse elemento custam 1 PE a menos">
              -1 PE
              <select value={elementos.mestre ?? ''} onChange={(e) => escolherElemento('mestre', e.target.value)} aria-label="Elemento do Mestre em Elemento">
                <option value="">—</option>
                {ELEMENTOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </label>
          )}
        </div>

        <button type="button" className="rituais-skill-btn" onClick={rollOcultismo}>
          <img src={d20Icon} alt="" />
          <span>Ocultismo</span>
        </button>
        </div>
      </div>

      <div className="rituais-rune-row">Tudo comeca com o sangue. Saber tudo e perder tudo</div>

      <div className="ritual-card-list">
        {filteredKnown.map((cr) => {
          const view = toView(cr)
          if (!view) return null
          return (
            <RitualCard
              key={cr.id}
              ritual={view}
              expanded={expanded === cr.id}
              onToggle={() => setExpanded(expanded === cr.id ? null : cr.id)}
              onRoll={(mode, formula) => conjurar(view, mode, formula)}
              custo={(mode) => custoFinal(view, mode)}
              dt={dtDe(view.elemento)}
              sigla={recursoDoRitual(character.optional_rules).sigla}
              onRemove={() => removeRitual(cr.id)}
              onEdit={() => setEditing(cr)}
            />
          )
        })}
      </div>

      {adding && (
        <RitualPickerModal
          characterId={character.id}
          onClose={() => setAdding(false)}
          onAdd={addFromPicker}
          onDeleteHomebrew={removeRitual}
        />
      )}

      {editing && (() => {
        const view = toView(editing)
        if (!view) return null
        return (
          <RitualEditModal
            characterId={character.id}
            entryId={editing.id}
            initial={view}
            onClose={() => setEditing(null)}
            onSaved={loadKnown}
          />
        )
      })()}
    </div>
  )
}
