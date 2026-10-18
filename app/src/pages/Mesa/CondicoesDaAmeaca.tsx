import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { supabase } from '../../lib/supabase'
import { CONDITION_ESCALATION } from '../../lib/rules'
import ConditionsModal, { CUSTOM_ICONS } from '../CharacterSheet/ConditionsModal'
import { lerCondicoesPersonalizadas, type CondicaoPersonalizada } from '../CharacterSheet/efeitosEscolhidos'
import conditionsIcon from '../../assets/condicoes/conditions.svg'
import enemyEffectsIcon from '../../assets/condicoes/enemy-effects.svg'
import ritualsIcon from '../../assets/condicoes/rituals.svg'
import skillsIcon from '../../assets/condicoes/skills.svg'
import extraIcon from '../../assets/condicoes/extra.svg'

const ICONE_DA_CATEGORIA: Record<string, string> = { condicao: conditionsIcon, efeito_inimigo: enemyEffectsIcon, habilidade: skillsIcon, extra: extraIcon }

// Catálogo (ícone e descrição) carregado uma vez e dividido entre todas as ameaças abertas.
let catalogo: Promise<Record<string, { icone: string; descricao: string }>> | null = null
function carregarCatalogo() {
  catalogo ??= Promise.all([
    supabase.from('effects_catalog').select('category, name, description'),
    supabase.from('rituals').select('name, effect'),
  ]).then(([efeitos, rituais]) => {
    const mapa: Record<string, { icone: string; descricao: string }> = {}
    for (const r of efeitos.data ?? []) mapa[r.name] = { icone: ICONE_DA_CATEGORIA[r.category] ?? conditionsIcon, descricao: r.description }
    for (const r of rituais.data ?? []) mapa[r.name] = { icone: ritualsIcon, descricao: r.effect }
    return mapa
  })
  return catalogo
}

// Condições e efeitos de uma ameaça na mesa (18/10): a mesma janela de escolher da ficha de
// personagem; o que mexe em dados e Defesa vale sozinho nos testes dela e quando miram nela.
export default function CondicoesDaAmeaca({ condicoes, personalizadas, podeEditar, compacto = false, onMudar }: {
  condicoes: string[]
  personalizadas: unknown
  podeEditar: boolean
  compacto?: boolean
  onMudar?: (condicoes: string[], personalizadas: CondicaoPersonalizada[]) => void
}) {
  const [escolhendo, setEscolhendo] = useState(false)
  const [info, setInfo] = useState<Record<string, { icone: string; descricao: string }>>({})
  const proprias = lerCondicoesPersonalizadas(personalizadas)
  useEffect(() => { void carregarCatalogo().then(setInfo) }, [])

  function adicionar(nome: string, propria?: CondicaoPersonalizada) {
    if (propria) {
      onMudar?.(condicoes.includes(nome) ? condicoes : [...condicoes, nome], [...proprias.filter((c) => c.nome !== propria.nome), propria])
      return
    }
    // Abalado de novo vira Apavorado, igual à ficha.
    const sobe = CONDITION_ESCALATION[nome]
    if (sobe && condicoes.includes(nome)) onMudar?.([...condicoes.filter((c) => c !== nome), sobe], proprias)
    else if (!condicoes.includes(nome)) onMudar?.([...condicoes, nome], proprias)
  }

  function tirar(nome: string) {
    onMudar?.(condicoes.filter((c) => c !== nome), proprias.filter((c) => c.nome !== nome))
  }

  if (!condicoes.length && (!podeEditar || compacto)) {
    return podeEditar && compacto ? (
      <>
        <button type="button" className="ameaca-condicoes-mais" aria-label="Adicionar condição" title="Adicionar condição ou efeito" onClick={() => setEscolhendo(true)}><FontAwesomeIcon icon={faPlus} /></button>
        {escolhendo && <ConditionsModal onClose={() => setEscolhendo(false)} onAddCondition={adicionar} />}
      </>
    ) : null
  }

  return (
    <div className={`ameaca-condicoes${compacto ? ' compacto' : ''}`}>
      {!compacto && <h4 className="ficha-ameaca-titulo">Condições e Efeitos</h4>}
      <div className="ameaca-condicoes-lista">
        {condicoes.map((nome) => {
          const propria = proprias.find((c) => c.nome === nome)
          const icone = propria ? CUSTOM_ICONS[Number(propria.icone) || 0] : info[nome]?.icone ?? conditionsIcon
          return (
            <span key={nome} className="ameaca-condicao" title={propria?.descricao ?? info[nome]?.descricao ?? nome}>
              <img src={icone} alt="" />
              <span>{nome}</span>
              {podeEditar && (
                <button type="button" aria-label={`Tirar ${nome}`} onClick={() => tirar(nome)}><FontAwesomeIcon icon={faXmark} /></button>
              )}
            </span>
          )
        })}
        {podeEditar && (
          <button type="button" className="ameaca-condicoes-mais" aria-label="Adicionar condição" title="Adicionar condição ou efeito" onClick={() => setEscolhendo(true)}><FontAwesomeIcon icon={faPlus} /></button>
        )}
      </div>
      {escolhendo && <ConditionsModal onClose={() => setEscolhendo(false)} onAddCondition={adicionar} />}
    </div>
  )
}
