import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { recordRoll } from '../../lib/rollHistory'
import { attrValue, computeDerivedStats, limiteDePE, nexSteps, rollAttributeTest, rollDiceFormula, trainingBonus, type AttributeKey, type Training } from '../../lib/rules'
import type { CharacterRecord } from './index'
import RollResult, { RollCard, type RollResultData, type RollCardDie } from './RollResult'
import { type Modifier } from './ModifiersPanel'
import CombateModifiersPanel from './CombateModifiersPanel'
import AttackFormModal, { type AttackToEdit } from './AttackFormModal'
import AttackCard from './AttackCard'
import { penalidadeDeCondicoes, rotuloComCondicoes } from './condicoes'
import { atributosComBonus, efeitosValendo, rdDeBloqueio, numerosDoAtaque, resistenciasDoItemEquipado, somaBonusNoDano, textoDasResistencias, type AppliedModifier, type Resistencia, modsComEfeitosDoItem } from './itemMods'
import { useAlvosDaMesa } from '../../lib/miraDaMesa'
import { defesaDosItens, defesaTotal, origemDoItem, origensDaDefesaDosItens, textoDasOrigens, type ItemDeDefesa } from './defesa'
import { usePoderesDaFicha } from './usePoderes'
import { postarAtaque } from '../Mesa/acoesDeMira'
import { textoDosAlvos } from '../Mesa/mira'
import { numerosComEncantos, textoDoEncanto, type Encanto } from './encantos'
import { corDoElemento, formulaDaEmpunhadura, type ParteRolada } from './danoDaArma'
import { nomeDoTipo } from '../Mesa/mira'
import defenseRing from '../../assets/combate/border-defense-desktop.png'
import resetIcon from '../../assets/combate/seta-reset.svg'
import mysteryIcon from '../../assets/combate/op-icon-misterio-custom.png'
import { lerCondicoesPersonalizadas } from './efeitosEscolhidos'
import { useClasseDaFicha } from './useClasseDaFicha'
import { useBonusDosItens } from './useBonusDosItens'
import { aplicarAjustes, type AjustesDoAtaque } from './ajustesDoAtaque'

const NOME_DO_ATRIBUTO: Record<string, string> = { forca: 'Força', agilidade: 'Agilidade', intelecto: 'Intelecto', vigor: 'Vigor', presenca: 'Presença' }
import { useVersaoDaFicha } from './fichaAoVivo'
import { dentroDaMesa, tocarSomDeArma } from '../../lib/sons'

type Attack = {
  id: string
  name: string
  skill_id: string | null
  attribute: AttributeKey | null
  d20_bonus: number
  threat_margin: number
  multiplier: number
  damage: { formula: string; tipo: string; origem?: string; elemento?: string }[]
  general_info: {
    tipo?: string
    empunhadura?: string
    alcance?: string
    tipo_municao?: string
    municao?: string | null
    modificadores?: { kind: 'modificacao' | 'maldicao'; name: string; effect: string; elemento: string | null; origem: 'Arma' | 'Munição' }[]
    damage_bonus_from_mods?: number
    // Edição de ataque vindo da arma (12/10): aplicada por cima dos números do item.
    ajustes?: AjustesDoAtaque
    // "Nenhum" no Atributo Dano: não soma Força/Agilidade no dano (12/10).
    sem_atributo_no_dano?: boolean
  } | null
  description: string | null
  from_inventory_item_id: string | null
  attack_bonus: string | null
  damage_attribute: AttributeKey | null
  modifiers: AppliedModifier[] | null
  alternative_attacks: Record<string, unknown>[] | null
  image_url: string | null
}

type InventoryAmmoInfo = {
  id: string
  linked_ammo_id: string | null
  ammo_current: number | null
  ammo_total: number | null
  ammo_label: string | null
  quantity: number
  name: string
  description: string | null
  stats: Record<string, unknown>
  applied_modifiers: AppliedModifier[]
  // Amaldiçoar Arma, Arma Atroz… conjurados nesta arma/munição (por você ou por um aliado).
  encantos: Encanto[]
}

type Skill = { id: string; name: string }

export default function CombateTab({ character, onUpdated, editMode }: { character: CharacterRecord; onUpdated: () => void; editMode: boolean }) {
  // Recarrega quando a ficha muda em qualquer lugar (Realtime, 11/10).
  const versao = useVersaoDaFicha()
  const { session } = useAuth()
  const [attacks, setAttacks] = useState<Attack[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [charSkillBonus, setCharSkillBonus] = useState<Record<string, number>>({})
  const [equippedDefense, setEquippedDefense] = useState(0)
  const [equippedProtectionName, setEquippedProtectionName] = useState<string | null>(null)
  const [itensEquipados, setItensEquipados] = useState<ItemDeDefesa[]>([])
  // Bônus de perícia dos itens equipados (Reflexos/Fortitude entram na Esquiva e no Bloqueio).
  const [bonusDeItens, setBonusDeItens] = useState<Record<string, number>>({})
  // RD a mais no Bloqueio vinda de itens equipados (Braçadeira reforçada), com a origem.
  const [bloqueioDeItens, setBloqueioDeItens] = useState<{ valor: number; origens: string[] }>({ valor: 0, origens: [] })
  // Relido junto com a proteção (botão de atualizar / equipar): bônus de atributo dos itens.
  const [recarregarItens, setRecarregarItens] = useState(0)
  const bonusDosItens = useBonusDosItens(character.id, recarregarItens)
  // Atributo que vale: o da ficha + itens equipados (maldição "+1 Agilidade"…), bug 11/10.
  const atributos = atributosComBonus(character.attributes, bonusDosItens)
  const { nomes: poderes, carregado: poderesCarregados } = usePoderesDaFicha(character.id)
  // Bloqueio/Esquiva dependem de tudo isso. Antes de tudo chegar, a conta é parcial: salvar ou
  // mostrar esse valor fazia o número variar a cada F5 (5 numa, 9 na outra), bug 08/10.
  const [carregou, setCarregou] = useState({ pericias: false, treino: false, itens: false })
  const classe = useClasseDaFicha(character)
  // Machucado = metade dos PV ou menos (Inquebrável da Tropa de Choque dá +5 Defesa).
  const maxPv = character.max_pv_override ?? (classe ? computeDerivedStats(classe, atributos, character.nex_percent, poderes).maxPv : null)
  const machucado = maxPv != null && maxPv > 0 && (character.current_pv ?? maxPv) <= maxPv / 2
  const limitePE = limiteDePE(character.nex_percent, poderes)
  const condicoesProprias = lerCondicoesPersonalizadas(character.condicoes_personalizadas)
  const [resistencias, setResistencias] = useState<Resistencia[]>([])
  const [adding, setAdding] = useState(false)
  const [roll, setRoll] = useState<RollResultData | null>(null)
  const [attackMods, setAttackMods] = useState<Modifier[]>([])
  const [damageMods, setDamageMods] = useState<Modifier[]>([])
  const [testMods, setTestMods] = useState<Modifier[]>([])
  const [inventoryAmmo, setInventoryAmmo] = useState<InventoryAmmoInfo[]>([])
  const [defenseDetailsOpen, setDefenseDetailsOpen] = useState(false)
  const [ammoOpen, setAmmoOpen] = useState(false)
  const [confirmDeleteAmmo, setConfirmDeleteAmmo] = useState<InventoryAmmoInfo | null>(null)
  const [expandedAttack, setExpandedAttack] = useState<string | null>(null)
  const [editingAttack, setEditingAttack] = useState<AttackToEdit | null>(null)
  const [attackSearch, setAttackSearch] = useState('')
  const [pendingAttack, setPendingAttack] = useState<{ attackId: string; isCrit: boolean } | null>(null)
  // Alvos marcados com a mira na mesa (12.9): com eles, o ataque vira ação no chat.
  const alvos = useAlvosDaMesa(character.campaign_id)
  const [avisoMira, setAvisoMira] = useState<string | null>(null)
  const [damageRoll, setDamageRoll] = useState<{ title: string; subtitle: string; total: number; dice: RollCardDie[]; extraLines?: string[]; bonus?: number } | null>(null)

  async function loadAttacks() {
    const { data } = await supabase
      .from('character_attacks')
      .select('id, name, skill_id, attribute, d20_bonus, attack_bonus, threat_margin, multiplier, damage_attribute, damage, general_info, modifiers, alternative_attacks, image_url, description, from_inventory_item_id')
      .eq('character_id', character.id)
    setAttacks((data ?? []) as unknown as Attack[])
  }

  async function loadInventoryAmmo() {
    const { data } = await supabase
      .from('character_inventory')
      .select('id, linked_ammo_id, ammo_current, ammo_total, ammo_label, quantity, applied_modifiers, encantos, custom_item, equipment_items(name, stats, description)')
      .eq('character_id', character.id)
    setInventoryAmmo(
      (data ?? []).map((row: any) => ({
        id: row.id,
        linked_ammo_id: row.linked_ammo_id,
        ammo_current: row.ammo_current,
        ammo_total: row.ammo_total,
        ammo_label: row.ammo_label,
        stats: row.equipment_items?.stats ?? row.custom_item?.stats ?? {},
        applied_modifiers: row.applied_modifiers ?? [],
        encantos: row.encantos ?? [],
        quantity: row.quantity,
        name: row.equipment_items?.name ?? row.custom_item?.name ?? 'Item',
        description: row.custom_item?.description ?? row.equipment_items?.description ?? null,
      })),
    )
  }

  function loadEquippedProtection() {
    setRecarregarItens((n) => n + 1)
    supabase
      .from('character_inventory')
      .select('is_equipped, applied_modifiers, active_bonuses, equipment_items(type, stats, name, description), custom_item')
      .eq('character_id', character.id)
      .eq('is_equipped', true)
      .then(({ data }) => {
        // O escudo acumula com a protecao, entao a Defesa soma todas as protecoes
        // equipadas, nao so a primeira encontrada.
        const protecoes = (data ?? []).filter((i: any) => (i.equipment_items?.type ?? i.custom_item?.type) === 'protecao')
        // A protecao conta a Defesa dela; modificacao/maldicao de Defesa vale em qualquer item
        // equipado (Coturnos com "+5 Defesa", bug 08/10).
        const itens: ItemDeDefesa[] = (data ?? []).map((i: any) => ({
          tipo: i.equipment_items?.type ?? i.custom_item?.type,
          nome: i.equipment_items?.name ?? i.custom_item?.name,
          stats: i.equipment_items?.stats ?? i.custom_item?.stats ?? {},
          mods: i.applied_modifiers ?? [],
        }))
        const nomes = protecoes.map((p: any) => p.equipment_items?.name ?? p.custom_item?.name).filter(Boolean)
        setItensEquipados(itens)
        setCarregou((c) => ({ ...c, itens: true }))
        setEquippedDefense(defesaDosItens(itens))
        const porPericia: Record<string, number> = {}
        for (const i of data ?? []) {
          for (const e of efeitosValendo((i as any).equipment_items?.description ?? (i as any).custom_item?.description, modsComEfeitosDoItem((i as any).custom_item?.stats, (i as any).applied_modifiers), (i as any).active_bonuses ?? [])) {
            if (e.pericias) for (const p of e.pericias) porPericia[p] = (porPericia[p] ?? 0) + e.valor
          }
        }
        setBonusDeItens(porPericia)
        const noBloqueio = { valor: 0, origens: [] as string[] }
        for (const i of (data ?? []) as any[]) {
          const nome = i.equipment_items?.name ?? i.custom_item?.name
          const daDescricao = rdDeBloqueio(i.equipment_items?.description ?? i.custom_item?.description)
          if (daDescricao) { noBloqueio.valor += daDescricao; noBloqueio.origens.push(origemDoItem(nome, daDescricao)) }
          for (const m of (i.applied_modifiers ?? []) as AppliedModifier[]) {
            const v = rdDeBloqueio(m.effect)
            if (v) { noBloqueio.valor += v; noBloqueio.origens.push(origemDoItem(nome, v, m)) }
          }
        }
        setBloqueioDeItens(noBloqueio)
        setEquippedProtectionName(nomes.length ? nomes.join(' + ') : null)

        // Resistencia nasce no proprio item (a Protecao Pesada ja traz corte/impacto/
        // balistico/perfuracao 2) e as modificacoes elevam isso. Vale pra qualquer item
        // equipado, nao so a protecao.
        const todas = (data ?? []).flatMap((i: any) => resistenciasDoItemEquipado(
          i.equipment_items?.stats ?? i.custom_item?.stats,
          i.applied_modifiers,
        ))
        const porTipo = new Map<string, number>()
        for (const r of todas) porTipo.set(r.tipo, Math.max(porTipo.get(r.tipo) ?? 0, r.valor))
        setResistencias([...porTipo].map(([tipo, valor]) => ({ tipo, valor })))
      })
  }

  useEffect(() => { loadAttacks(); loadInventoryAmmo() }, [character.id, versao])

  // Um aliado pode encantar a sua arma a qualquer hora: ao voltar pra ficha, ela relê o inventário.
  useEffect(() => {
    const reler = () => loadInventoryAmmo()
    window.addEventListener('focus', reler)
    return () => window.removeEventListener('focus', reler)
  }, [character.id])

  useEffect(() => {
    supabase.from('skills').select('id, name').order('sort_order').then(({ data }) => { setSkills(data ?? []); setCarregou((c) => ({ ...c, pericias: true })) })
    supabase
      .from('character_modifiers')
      .select('id, name, dice_bonus, value_bonus, threat_margin_bonus, multiplier_bonus, damage_type, is_active')
      .eq('character_id', character.id)
      .eq('scope', 'teste')
      .then(({ data }) => setTestMods(data ?? []))
    supabase
      .from('character_skills')
      .select('skill_id, training, extra_bonus')
      .eq('character_id', character.id)
      .then(({ data }) => {
        const map: Record<string, number> = {}
        for (const row of data ?? []) map[row.skill_id] = trainingBonus(row.training as Training) + row.extra_bonus
        setCharSkillBonus(map)
        setCarregou((c) => ({ ...c, treino: true }))
      })
    loadEquippedProtection()
  }, [character.id])

  async function updateDefenseField(patch: Partial<Pick<CharacterRecord, 'defense_other_bonus' | 'bloqueio_bonus' | 'esquiva_bonus'>>) {
    await supabase.from('characters').update(patch).eq('id', character.id)
    onUpdated()
  }

  async function removeAttack(id: string) {
    await supabase.from('character_attacks').delete().eq('id', id)
    await loadAttacks()
  }

  // O ataque guarda uma copia dos numeros de quando foi enviado. Quem manda e o item:
  // tirar uma maldicao da arma tem que mudar o ataque tambem. Entao aqui ele e recalculado
  // a partir do item e das modificacoes de agora, e e essa versao que aparece e que rola.
  const attacksAtualizados = attacks.map((a) => {
    if (!a.from_inventory_item_id) return a
    const origem = inventoryAmmo.find((i) => i.id === a.from_inventory_item_id)
    if (!origem) return a // item apagado do inventario: o ataque fica como estava
    const municao = origem.linked_ammo_id ? inventoryAmmo.find((i) => i.id === origem.linked_ammo_id) : null
    const numeros = numerosDoAtaque(origem.stats, [...modsComEfeitosDoItem(origem.stats, origem.applied_modifiers), ...(municao?.applied_modifiers ?? [])])
    const encantos = [...origem.encantos, ...(municao?.encantos ?? [])]
    const daArma = { d20_bonus: numeros.d20Bonus, threat_margin: numeros.threatMargin, multiplier: numeros.multiplier, damage: numeros.damage }
    const comAjustes = aplicarAjustes(daArma, a.general_info?.ajustes)
    return numerosComEncantos({
      ...a,
      ...comAjustes,
      description: a.description || origem.description,
      general_info: {
        ...a.general_info,
        alcance: numeros.alcance || a.general_info?.alcance,
        damage_bonus_from_mods: numeros.damageBonusFromMods,
        // O encanto aparece no card do ataque junto das modificações e maldições.
        modificadores: [
          ...(a.general_info?.modificadores ?? []),
          ...encantos.map((e) => ({ kind: 'maldicao' as const, name: e.nome, effect: `${textoDoEncanto(e)}${e.por ? ` (por ${e.por})` : ''}`, elemento: e.dano?.tipo ?? null, origem: 'Arma' as const })),
        ],
      },
      modifiers: [...origem.applied_modifiers, ...(municao?.applied_modifiers ?? [])],
    }, encantos)
  })

  // O modal abre com o ataque guardado (sem o encanto, que vem do ritual e não da edição) e, se
  // veio da arma, com os números da arma + ajustes; daArma é a base pra calcular o que mudou.
  function paraEditar(id: string): AttackToEdit {
    const a = attacks.find((x) => x.id === id)!
    const origem = a.from_inventory_item_id ? inventoryAmmo.find((i) => i.id === a.from_inventory_item_id) : null
    if (!origem) return a as unknown as AttackToEdit
    const municao = origem.linked_ammo_id ? inventoryAmmo.find((i) => i.id === origem.linked_ammo_id) : null
    const numeros = numerosDoAtaque(origem.stats, [...modsComEfeitosDoItem(origem.stats, origem.applied_modifiers), ...(municao?.applied_modifiers ?? [])])
    const daArma = { d20_bonus: numeros.d20Bonus, threat_margin: numeros.threatMargin, multiplier: numeros.multiplier, damage: numeros.damage }
    return { ...(a as unknown as AttackToEdit), ...aplicarAjustes(daArma, a.general_info?.ajustes), daArma }
  }

  function ammoForAttack(attack: Attack): InventoryAmmoInfo | null {
    if (!character.optional_rules.contagem_municao || !attack.from_inventory_item_id) return null
    const sourceInv = inventoryAmmo.find((i) => i.id === attack.from_inventory_item_id)
    if (!sourceInv?.linked_ammo_id) return null
    const ammoInv = inventoryAmmo.find((i) => i.id === sourceInv.linked_ammo_id)
    if (!ammoInv || ammoInv.ammo_total === null) return null
    return ammoInv
  }

  async function consumeAmmo(ammoInv: InventoryAmmoInfo) {
    const next = Math.max(0, (ammoInv.ammo_current ?? 0) - 1)
    await supabase.from('character_inventory').update({ ammo_current: next }).eq('id', ammoInv.id)
    await loadInventoryAmmo()
  }

  async function adjustAmmoCurrent(ammoInv: InventoryAmmoInfo, delta: number) {
    const next = Math.min(ammoInv.ammo_total ?? 0, Math.max(0, (ammoInv.ammo_current ?? 0) + delta))
    await supabase.from('character_inventory').update({ ammo_current: next }).eq('id', ammoInv.id)
    await loadInventoryAmmo()
  }

  async function deleteAmmoItem(ammoInv: InventoryAmmoInfo) {
    await supabase.from('character_inventory').update({ linked_ammo_id: null }).eq('linked_ammo_id', ammoInv.id)
    await supabase.from('character_inventory').delete().eq('id', ammoInv.id)
    setConfirmDeleteAmmo(null)
    await loadInventoryAmmo()
    await loadAttacks()
  }

  function rollAttackTest(attack: Attack) {
    const ammoInv = ammoForAttack(attack)
    if (ammoInv && (ammoInv.ammo_current ?? 0) <= 0) {
      window.alert(`Sem ${ammoInv.ammo_label ?? 'munição'} — recarregue no Inventário antes de atacar.`)
      return
    }

    const activeAttackMods = attackMods.filter((m) => m.is_active)
    const activeTestMods = testMods.filter((m) => m.is_active)

    const attackDiceBonus = activeAttackMods.reduce((sum, m) => sum + m.dice_bonus, 0) + activeTestMods.reduce((sum, m) => sum + m.dice_bonus, 0)
    const attackValueBonus = activeAttackMods.reduce((sum, m) => sum + m.value_bonus, 0) + activeTestMods.reduce((sum, m) => sum + m.value_bonus, 0)
    const threatBonus = activeAttackMods.reduce((sum, m) => sum + m.threat_margin_bonus, 0)

    // Condições: Fraco/Debilitado no atributo do ataque, Caído no corpo a corpo, Ofuscado…
    const corpo = /corpo/i.test(attack.general_info?.tipo ?? '') || /corpo/i.test(attack.general_info?.alcance ?? '')
    const cond = penalidadeDeCondicoes(character.conditions, { atributo: attack.attribute, ataque: corpo ? 'corpo' : 'distancia' }, condicoesProprias)
    const score = attrValue(atributos, attack.attribute) + attackDiceBonus + cond.dados
    const { rolls, kept } = rollAttributeTest(score)
    const skillBonus = attack.skill_id ? (charSkillBonus[attack.skill_id] ?? 0) : 0
    const bonus = skillBonus + attack.d20_bonus + attackValueBonus + cond.valor

    const effectiveThreatMargin = attack.threat_margin - threatBonus
    const isCrit = kept >= effectiveThreatMargin

    // Com alvo marcado na mesa: "[Personagem] está atacando [Alvo]" no chat, com os botões
    // Ataque e Dano; quem rola é o chat (e o dano já sai descontado da Vida do alvo).
    if (alvos.length && character.campaign_id) {
      const activeDamageMods = damageMods.filter((m) => m.is_active)
      postarAtaque({
        campanhaId: character.campaign_id,
        characterId: character.id,
        autor: { nome: character.name, foto: character.avatar_url },
        alvos,
        ataque: {
          nome: rotuloComCondicoes(attack.name, cond.motivos),
          dados: score,
          bonus,
          margem: effectiveThreatMargin,
          multiplicador: attack.multiplier + activeAttackMods.reduce((sum, m) => sum + m.multiplier_bonus, 0),
          partes: attack.damage.map((d) => ({ formula: formulaDaEmpunhadura(d.formula, attack.general_info?.empunhadura), tipo: d.tipo, origem: d.origem, elemento: d.elemento })),
          bonus_dano: activeDamageMods.reduce((sum, m) => sum + m.value_bonus, 0) + (attack.general_info?.damage_bonus_from_mods ?? 0) + atributoNoDano(attack),
          corpo,
        },
      }).then((erro) => {
        setAvisoMira(erro ?? `Ataque contra ${textoDosAlvos(alvos)} enviado pro chat.`)
        setTimeout(() => setAvisoMira(null), 3500)
      })
      if (ammoInv) consumeAmmo(ammoInv)
      return
    }

    const label = rotuloComCondicoes(`Ataque: ${attack.name}${isCrit ? ' (crítico!)' : ''}`, cond.motivos)
    // Fora da mesa, o som da arma toca aqui (dentro, a mesa toca junto com os dados 3D, pra todos).
    if (!dentroDaMesa()) tocarSomDeArma(attack.name)
    setRoll({
      label,
      rolls,
      kept,
      bonus,
      municao: attack.general_info?.municao ?? null,
      modificadores: attack.general_info?.modificadores ?? [],
      characterName: character.name,
      diceTray: character.dice_tray,
    })
    setPendingAttack({ attackId: attack.id, isCrit })

    if (ammoInv) consumeAmmo(ammoInv)

    if (session) {
      recordRoll({
        characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
        label,
        total: kept + bonus,
        detail: `d20 mantido: ${kept} (rolados: ${rolls.join(', ')}) + bônus ${bonus}`,
        dice: rolls.map((v) => ({ sides: 20, value: v, discarded: v !== kept })), bonus,
      })
    }
  }

  // Corpo a corpo e arremesso somam o atributo de dano (Força, por padrão) no dano; disparo e
  // arma de fogo não (OPRPG). Antes o campo "Atributo Dano" era salvo e nunca usado (bug 11/10).
  function atributoNoDano(attack: Attack): number {
    const g = attack.general_info
    const corpoOuArremesso = /corpo|arremess/i.test(g?.tipo ?? '') || /corpo/i.test(g?.alcance ?? '')
    if (!corpoOuArremesso || g?.sem_atributo_no_dano) return 0
    return attrValue(atributos, attack.damage_attribute ?? 'forca')
  }

  function rollDamage(attack: Attack, isCrit: boolean) {
    const activeAttackMods = attackMods.filter((m) => m.is_active)
    const activeDamageMods = damageMods.filter((m) => m.is_active)

    const multiplierBonus = activeAttackMods.reduce((sum, m) => sum + m.multiplier_bonus, 0)
    const noDano = atributoNoDano(attack)
    const damageValueBonus = activeDamageMods.reduce((sum, m) => sum + m.value_bonus, 0) + (attack.general_info?.damage_bonus_from_mods ?? 0) + noDano
    const critMultiplier = isCrit ? attack.multiplier + multiplierBonus : 1

    const dice: RollCardDie[] = []
    const extraLines: string[] = []
    let total = damageValueBonus

    // Cada parte rola com o seu tipo: o dano da arma (1d6/1d8 = uma mão/duas mãos) e os extras.
    const partes: ParteRolada[] = []
    attack.damage.forEach((d) => {
      const formula = formulaDaEmpunhadura(d.formula, attack.general_info?.empunhadura)
      const sidesMatch = formula.match(/d(\d+)/i)
      const sides = sidesMatch ? Number(sidesMatch[1]) : 6
      // Crítico: só o dano base da arma multiplica, e são os dados que multiplicam (x2: 1d6 vira
      // 2d6). Dano extra de encanto (Amaldiçoar Arma…) entra uma vez só.
      const rolled = rollDiceFormula(formula, d.origem ? 1 : critMultiplier)
      const tipo = nomeDoTipo(d.tipo)
      if (!rolled) {
        extraLines.push(`Dano${tipo ? ` (${tipo})` : ''}: role manualmente (${d.formula})`)
        return
      }
      rolled.rolls.forEach((v) => dice.push({ sides, value: v }))
      const valor = rolled.total
      total += valor
      partes.push({ formula, tipo, origem: d.origem, elemento: d.elemento, lados: sides, total: valor })
      extraLines.push(`${formula}${tipo ? ` ${tipo}` : ''}${d.origem ? ` (${d.origem})` : ''}: ${valor}`)
    })

    if (noDano) extraLines.push(`${NOME_DO_ATRIBUTO[attack.damage_attribute ?? 'forca'] ?? 'Força'}: ${noDano > 0 ? '+' : ''}${noDano}`)
    const label = isCrit ? `Dano Crítico: ${attack.name} (x${critMultiplier})` : `Dano: ${attack.name}`
    setDamageRoll({ title: character.name, subtitle: label, total, dice, extraLines, bonus: damageValueBonus })
    setPendingAttack(null)

    if (session) {
      recordRoll({
        characterId: character.id, userId: session.user.id, campaignId: character.campaign_id, characterName: character.name,
        label, total, detail: dice.map((d) => `d${d.sides}: ${d.value}`).join(' · '),
        dice, bonus: damageValueBonus, partes,
      })
    }
  }

  const agilidade = atributos.agilidade
  // Condições (Vulnerável -2, Desprevenido -5, Indefeso -10) entram sozinhas na Defesa.
  // Mesma conta da mesa (defesa.ts): 10 + AGI + itens + poderes fixos + outros + condições.
  const defesa = defesaTotal({ agilidade, outros: character.defense_other_bonus, condicoes: character.conditions, itens: itensEquipados, poderes, condicoesPersonalizadas: condicoesProprias, machucado })
  const defesaCondicoes = defesa.condicoes
  const defenseTotal = defesa.total
  const fortitudeSkill = skills.find((s) => s.name === 'Fortitude')
  const reflexosSkill = skills.find((s) => s.name === 'Reflexos')
  const bonusDaPericia = (sk: Skill) => (charSkillBonus[sk.id] ?? 0) + (bonusDeItens[sk.name] ?? 0) + (defesa.poderes.pericias[sk.name] ?? 0)
  // Bloqueio: o bônus de Fortitude vira resistência a dano. Esquiva: o bônus de Reflexos soma
  // na Defesa, então o número mostrado é a Defesa de quem esquiva.
  // Casca Grossa (Tropa de Choque): ao bloquear, soma o Vigor na resistência a dano.
  const cascaGrossa = poderes.some((n) => n.trim().toLowerCase() === 'casca grossa') ? atributos.vigor ?? 0 : 0
  const bloqueioAuto = fortitudeSkill ? bonusDaPericia(fortitudeSkill) + cascaGrossa + bloqueioDeItens.valor : 0
  const esquivaAuto = defenseTotal + (reflexosSkill ? bonusDaPericia(reflexosSkill) : 0)

  const tudoCarregado = carregou.pericias && carregou.treino && carregou.itens && poderesCarregados && (!character.class_id || !!classe)
  // Fora do modo de edição mostra a conta (já completa); no modo de edição, o valor salvo, que dá pra ajustar.
  const bloqueioMostrado = !editMode && tudoCarregado && fortitudeSkill ? bloqueioAuto : character.bloqueio_bonus
  const esquivaMostrada = !editMode && tudoCarregado && reflexosSkill ? esquivaAuto : character.esquiva_bonus

  // Salva só a conta completa, e cada valor uma vez (a mesa usa o Bloqueio salvo na reação).
  const salvos = useRef<{ bloqueio?: number; esquiva?: number }>({})
  useEffect(() => {
    if (!tudoCarregado || !fortitudeSkill || salvos.current.bloqueio === bloqueioAuto) return
    salvos.current.bloqueio = bloqueioAuto
    if (character.bloqueio_bonus !== bloqueioAuto) updateDefenseField({ bloqueio_bonus: bloqueioAuto })
  }, [tudoCarregado, bloqueioAuto])

  useEffect(() => {
    if (!tudoCarregado || !reflexosSkill || salvos.current.esquiva === esquivaAuto) return
    salvos.current.esquiva = esquivaAuto
    if (character.esquiva_bonus !== esquivaAuto) updateDefenseField({ esquiva_bonus: esquivaAuto })
  }, [tudoCarregado, esquivaAuto])

  return (
    <div>
      {roll && <RollResult result={roll} onClose={() => setRoll(null)} />}
      {damageRoll && (
        <RollCard
          title={damageRoll.title}
          subtitle={damageRoll.subtitle}
          total={damageRoll.total}
          dice={damageRoll.dice}
          extraLines={damageRoll.extraLines}
          bonus={damageRoll.bonus}
          background={character.dice_tray && character.dice_tray !== 'padrao' ? character.dice_tray : undefined}
          onClose={() => setDamageRoll(null)}
        />
      )}

      <div className="combat-defense-frame">
       <div className="combat-defense-card">
        <div className="combat-defense-top">
          <div className="combat-defense-badge">
            <img src={defenseRing} alt="" className="combat-defense-ring" />
            <span className="combat-defense-value">{tudoCarregado ? defenseTotal : '…'}</span>
          </div>

          <div className="combat-defense-main">
            <span className="combat-defense-label">Defesa</span>
            <div className="combat-defense-formula">
              {/* Cada parte fica junta (número + nome) e a linha quebra entre elas, sem invadir o Bloqueio/Esquiva. */}
              <span className="combat-defense-termo">
                <span className="combat-plain-value" title={textoDasOrigens(origensDaDefesaDosItens(itensEquipados))}>{equippedDefense}</span>
                <span className="combat-defense-sub">Equip</span>
              </span>
              <span className="combat-defense-termo">
                <span className="combat-defense-plus">+</span>
                <input
                  className="combat-dotted-input"
                  type="number"
                  value={character.defense_other_bonus}
                  onChange={(e) => updateDefenseField({ defense_other_bonus: Number(e.target.value) })}
                />
                <span className="combat-defense-sub">Outros</span>
              </span>
              {defesa.poderes.defesa !== 0 && (
                <span className="combat-defense-termo">
                  <span className="combat-defense-plus">+</span>
                  <span className="combat-plain-value" title={textoDasOrigens(defesa.poderes.motivos)}>{defesa.poderes.defesa}</span>
                  <span className="combat-defense-sub">Poderes</span>
                </span>
              )}
              <span className="combat-defense-fixed">+AGI({agilidade})+10</span>
              {defesaCondicoes.valor !== 0 && (
                <span className="combat-defense-condicoes" title={textoDasOrigens(defesaCondicoes.motivos.map((m) => `Condição ${m.replace(/ ([+-])/, ": $1")}`))}>
                  {defesaCondicoes.valor} Condições
                </span>
              )}
            </div>
          </div>

          <div className="combat-defense-side">
            <div className="combat-defense-side-item">
              {editMode ? (
                <input
                  className="combat-dotted-input"
                  type="number"
                  value={character.bloqueio_bonus}
                  onChange={(e) => updateDefenseField({ bloqueio_bonus: Number(e.target.value) })}
                />
              ) : (
                <span className="combat-plain-value" title={fortitudeSkill ? textoDasOrigens([`Bônus de Fortitude: ${bloqueioAuto - cascaGrossa - bloqueioDeItens.valor}`, ...(cascaGrossa ? [`Poder Casca Grossa: +${cascaGrossa} (Vigor)`] : []), ...bloqueioDeItens.origens]) : undefined}>{bloqueioMostrado}</span>
              )}
              <span className="combat-defense-sub">Bloqueio</span>
            </div>
            <div className="combat-defense-side-item">
              {editMode ? (
                <input
                  className="combat-dotted-input"
                  type="number"
                  value={character.esquiva_bonus}
                  onChange={(e) => updateDefenseField({ esquiva_bonus: Number(e.target.value) })}
                />
              ) : (
                <span className="combat-plain-value" title={reflexosSkill ? `Defesa ${defenseTotal} + bônus de Reflexos ${esquivaAuto - defenseTotal}` : undefined}>{esquivaMostrada}</span>
              )}
              <span className="combat-defense-sub">Esquiva</span>
            </div>
          </div>

          <button type="button" className="combat-defense-chevron" onClick={() => setDefenseDetailsOpen((v) => !v)} aria-label="Detalhes de defesa">
            {defenseDetailsOpen ? '▲' : '▾'}
          </button>
        </div>

        {defenseDetailsOpen && (
          <div className="combat-defense-details">
            <p><strong>Proteção:</strong> {equippedProtectionName ?? 'Nenhuma equipada'}</p>
            <p><strong>Resistência:</strong> {textoDasResistencias(resistencias) || 'Nenhuma'}</p>
            {defesa.poderes.motivos.length > 0 && <p><strong>Poderes:</strong> {defesa.poderes.motivos.join(', ')}</p>}
          </div>
        )}
       </div>
      </div>

      <div className="combat-stats-line">
        <button type="button" className="combat-refresh-btn" onClick={loadEquippedProtection} aria-label="Atualizar">
          <img src={resetIcon} alt="" />
        </button>

        <div className="combat-stats-row">
          <span title={`1 por degrau de NEX${limitePE > Math.max(1, nexSteps(character.nex_percent)) ? ' + poderes (Dedicação)' : ''}${poderes.some((n) => n.trim().toLowerCase() === 'presença poderosa') ? `
Presença Poderosa: +${character.attributes.presenca ?? 0} só pra conjurar rituais` : ''}`}><strong>PE / Turno:</strong> {limitePE}</span>
          <span><strong>Deslocamento:</strong> 9m (6q)</span>
        </div>
      </div>

      <CombateModifiersPanel characterId={character.id} onAttackChange={setAttackMods} onDamageChange={setDamageMods} />

      {character.optional_rules.contagem_municao && (
        (() => {
          const ammoItems = inventoryAmmo.filter((i) => i.ammo_total !== null)
          if (ammoItems.length === 0) {
            return <div className="combat-ammo-empty">Você não possui munição. Adicione a partir do seu inventário.</div>
          }
          return (
            <div className="combat-ammo-frame">
              <button type="button" className="combat-ammo-header" onClick={() => setAmmoOpen((v) => !v)}>
                <div className="combat-ammo-icons">
                  {ammoItems.map((a) => (
                    <span key={a.id} className="combat-ammo-icon-wrap">
                      <img src={mysteryIcon} alt="" className="combat-ammo-icon" />
                      <span className="combat-ammo-badge">×{a.quantity}</span>
                    </span>
                  ))}
                </div>
                <span className="combat-ammo-chevron">{ammoOpen ? '▲' : '▾'}</span>
              </button>

              {ammoOpen && (
                <div className="combat-ammo-body">
                  {ammoItems.map((a) => (
                    <div key={a.id} className="combat-ammo-row">
                      <img src={mysteryIcon} alt="" className="combat-ammo-row-thumb" />
                      <span className="combat-ammo-row-name">{a.name}</span>
                      <div className="combat-ammo-qty">
                        <span className="combat-ammo-qty-label">QUANTIDADE:</span>
                        <button type="button" onClick={() => adjustAmmoCurrent(a, -1)} disabled={(a.ammo_current ?? 0) <= 0}>−</button>
                        <span className="combat-ammo-qty-value">{a.ammo_current}/{a.ammo_total}</span>
                        <button type="button" onClick={() => adjustAmmoCurrent(a, 1)} disabled={(a.ammo_current ?? 0) >= (a.ammo_total ?? 0)}>+</button>
                      </div>
                      <button type="button" className="combat-ammo-delete" onClick={() => setConfirmDeleteAmmo(a)} aria-label="Excluir munição" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()
      )}

      {confirmDeleteAmmo && (
        <div className="combat-ammo-confirm-backdrop" onClick={() => setConfirmDeleteAmmo(null)}>
          <div className="combat-ammo-confirm" onClick={(e) => e.stopPropagation()}>
            <p>Você quer excluir <strong>{confirmDeleteAmmo.name}</strong>?</p>
            <div className="combat-ammo-confirm-actions">
              <button type="button" className="combat-ammo-confirm-yes" onClick={() => deleteAmmoItem(confirmDeleteAmmo)}>Confirmar</button>
              <button type="button" className="combat-ammo-confirm-no" onClick={() => setConfirmDeleteAmmo(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="combat-search-row">
        <div className="combat-search-field">
          <input className="combat-search-input" placeholder="Buscar Ataques" value={attackSearch} onChange={(e) => setAttackSearch(e.target.value)} />
          <svg className="combat-search-icon" viewBox="0 0 24 24" aria-hidden>
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <button type="button" className="combat-add-btn" onClick={() => setAdding(true)}>Adicionar Ataque</button>
      </div>

      {alvos.length > 0 && (
        <p className="ficha-mira-aviso">Mirando: <strong>{textoDosAlvos(alvos)}</strong>. O ataque vai pro chat da mesa.</p>
      )}
      {avisoMira && <p className="ficha-mira-aviso" role="status">{avisoMira}</p>}

      {(adding || editingAttack) && (
        <AttackFormModal
          characterId={character.id}
          skills={skills}
          editing={editingAttack ?? undefined}
          onClose={() => { setAdding(false); setEditingAttack(null) }}
          onSaved={loadAttacks}
        />
      )}

      {attacksAtualizados.filter((a) => a.name.toLowerCase().includes(attackSearch.toLowerCase())).map((a) => {
        const ammoInv = ammoForAttack(a)
        return (
          <AttackCard
            key={a.id}
            name={a.name}
            ataque={`${attrValue(atributos, a.attribute)}d20${a.d20_bonus ? `+${a.d20_bonus}` : ''}`}
            dano={(() => {
              const [principal, ...extras] = a.damage
              if (!principal) return '—'
              const base = somaBonusNoDano(principal.formula, a.general_info?.damage_bonus_from_mods ?? 0)
              const comTipo = `${base}${principal.tipo ? ` ${principal.tipo}` : ''}`
              return extras.length ? `${comTipo} +${extras.map((d) => d.formula).join(' +')}` : comTipo
            })()}
            danoDetalhado={(a.damage as Attack['damage']).map((d, i) => {
              const bonus = i === 0 ? (a.general_info?.damage_bonus_from_mods ?? 0) : 0
              const tipo = nomeDoTipo(d.tipo)
              return { texto: `${somaBonusNoDano(d.formula, bonus)}${tipo ? ` ${tipo}` : ''}`, origem: d.origem, cor: corDoElemento(d.elemento) }
            })}
            critico={`${a.threat_margin}/x${a.multiplier}`}
            info={a.general_info}
            municaoRestante={ammoInv ? `${ammoInv.ammo_current ?? 0}/${ammoInv.ammo_total} ${ammoInv.ammo_label ?? ''}`.trim() : null}
            expanded={expandedAttack === a.id}
            onToggle={() => setExpandedAttack((atual) => (atual === a.id ? null : a.id))}
            onRemove={() => removeAttack(a.id)}
            descricao={a.description}
            onEdit={() => setEditingAttack(paraEditar(a.id))}
            onRollAtaque={() => rollAttackTest(a)}
            onRollDano={(critico) => rollDamage(a, critico)}
            danoArmado={pendingAttack?.attackId === a.id}
            ehCritico={pendingAttack?.attackId === a.id && pendingAttack.isCrit}
          />
        )
      })}
    </div>
  )
}
