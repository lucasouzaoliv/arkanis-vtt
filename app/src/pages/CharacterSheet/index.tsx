import { useEffect, useState } from 'react'
import OuroLiquido from './OuroLiquido'
import GotaMorte from './GotaMorte'
import CaosEnergia from './CaosEnergia'
import VeiaSangue from './VeiaSangue'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Attributes } from '../../lib/rules'
import AgenteTab from './AgenteTab'
import InvestigacaoTab from './InvestigacaoTab'
import DiceRoller from './DiceRoller'
import ProgressaoTab from './ProgressaoTab'
import AfinidadeTab from './AfinidadeTab'
import InterludioTab from './InterludioTab'
import RegrasExtrasTab from './RegrasExtrasTab'
import ConfiguracoesPanel from './ConfiguracoesPanel'
import HistoricoRolagens from './HistoricoRolagens'
import bgPadrao from '../../assets/backgrounds/bg-padrao.webp'
import bgSangue from '../../assets/backgrounds/bg-sangue.webp'
import bgMorte from '../../assets/backgrounds/bg-morte.webp'
import bgConhecimento from '../../assets/backgrounds/bg-conhecimento.webp'
import bgEnergia from '../../assets/backgrounds/bg-energia.webp'
import bgMedo from '../../assets/backgrounds/bg-medo.webp'
import d20Icon from '../../assets/icons/d20-paranormal.svg'
import changeIcon from '../../assets/icons/change-icon.svg'
import settingsIcon from '../../assets/icons/settings-icon.svg'
import historyIcon from '../../assets/icons/history-icon.svg'
import { FichaAoVivo } from './fichaAoVivo'
import arkanisLogo from '../../assets/icons/arkanis-logo.png'

const ELEMENT_BACKGROUNDS: Record<string, string> = {
  sangue: bgSangue,
  morte: bgMorte,
  conhecimento: bgConhecimento,
  energia: bgEnergia,
  medo: bgMedo,
}

export type CharacterRecord = {
  item_limit_override: Partial<Record<'I' | 'II' | 'III' | 'IV', number>>
  id: string
  campaign_id: string | null
  name: string
  avatar_url: string | null
  avatar_frame: string | null
  doc_number: string
  attributes: Attributes
  nex_percent: number
  nex_mode: string
  experience: number | null
  current_pv: number | null
  temp_pv: number
  max_pv_override: number | null
  pv_death_marks: number
  current_sanity: number | null
  temp_sanity: number
  max_sanity_override: number | null
  sanity_death_marks: number
  current_pe: number | null
  temp_pe: number
  current_pd: number | null
  temp_pd: number
  patente: string
  prestigio: number
  optional_rules: Record<string, boolean>
  afinidade_elemento: string | null
  conditions: string[]
  // Condições criadas na mão, com os efeitos escolhidos (efeitosEscolhidos.ts).
  condicoes_personalizadas?: unknown
  // PE máximo digitado à mão (como Vida/Sanidade) e o elemento dos poderes de elemento (11/10).
  max_pe_override?: number | null
  elementos_escolhidos?: { especialista?: string | null; mestre?: string | null } | null
  sheet_banner: string
  dice_tray: string
  defense_other_bonus: number
  bloqueio_bonus: number
  esquiva_bonus: number
  editable_by_others: boolean
  hidden_from_others: boolean
  chosen_track_id: string | null
  origin_id: string | null
  custom_origin: { name: string; skill1Id: string | null; skill2Id: string | null; powerName: string; powerDescription: string } | null
  class_id: string | null
  custom_class: {
    name: string
    pvInitial: number | null
    pvPerNex: number | null
    peInitial: number | null
    pePerNex: number | null
    sanityInitial: number | null
    sanityPerNex: number | null
    pdInitial: number | null
    pdPerNex: number | null
    trainedSkillsText: string
    proficienciesText: string
  } | null
}

const TABS = ['Agente', 'Arquivos', 'Afinidade', 'Progressão', 'Interlúdio', 'Regras Extras'] as const

const ELEMENTO_NOMES: Record<string, string> = {
  sangue: 'Sangue',
  morte: 'Morte',
  conhecimento: 'Conhecimento',
  energia: 'Energia',
  medo: 'Medo',
}

export default function CharacterSheet() {
  const { id } = useParams()
  const [character, setCharacter] = useState<CharacterRecord | null>(null)
  const [originName, setOriginName] = useState<string | null>(null)
  const [className, setClassName] = useState<string | null>(null)
  const [trackName, setTrackName] = useState<string | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Agente')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showDice, setShowDice] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [bgAnimated, setBgAnimated] = useState(() => localStorage.getItem('vtt_bg_animated') !== 'false')

  useEffect(() => {
    function onChange() { setBgAnimated(localStorage.getItem('vtt_bg_animated') !== 'false') }
    window.addEventListener('vtt-bg-animated-change', onChange)
    return () => window.removeEventListener('vtt-bg-animated-change', onChange)
  }, [])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        setCharacter(data)
        if (data?.origin_id) {
          const { data: origin } = await supabase.from('origins').select('name').eq('id', data.origin_id).single()
          setOriginName(origin?.name ?? null)
        } else if (data?.custom_origin) {
          setOriginName(data.custom_origin.name)
        }
        if (data?.class_id) {
          const { data: cls } = await supabase.from('classes').select('name').eq('id', data.class_id).single()
          setClassName(cls?.name ?? null)
        } else if (data?.custom_class) {
          setClassName(data.custom_class.name)
        }

        if (data?.chosen_track_id) {
          const { data: track } = await supabase.from('class_tracks').select('name').eq('id', data.chosen_track_id).single()
          setTrackName(track?.name ?? null)
        } else {
          setTrackName(null)
        }
      })
  }, [id, refreshKey])

  if (!character) return <main>Carregando…</main>

  const elemento = character.afinidade_elemento
  const bgImage = (elemento && ELEMENT_BACKGROUNDS[elemento]) ?? bgPadrao
  const bgClass = elemento && ELEMENT_BACKGROUNDS[elemento] ? `bg-${elemento}` : 'bg-padrao'

  return (
    <FichaAoVivo characterId={character.id} onPersonagemMudou={() => setRefreshKey((k) => k + 1)}>
    <main className={`sheet-root${elemento ? ' com-afinidade' : ''}`}>
      {elemento === 'conhecimento' ? (
        // Conhecimento: o ouro derretido com os veios em movimento, no lugar da imagem.
        <div className="sheet-bg sheet-bg-ouro">
          <OuroLiquido parado={!bgAnimated} />
        </div>
      ) : elemento === 'energia' ? (
        // Energia: o marmore roxo mexendo sem direcao, no lugar da imagem.
        <div className="sheet-bg sheet-bg-ouro afin-fundo-energia">
          <CaosEnergia parado={!bgAnimated} />
        </div>
      ) : elemento === 'sangue' ? (
        // Sangue: os coagulos passando dentro da veia, no lugar da imagem.
        <div className="sheet-bg sheet-bg-ouro afin-fundo-sangue">
          <VeiaSangue parado={!bgAnimated} />
        </div>
      ) : elemento === 'morte' ? (
        // Morte: a gota caindo na agua, no lugar da imagem.
        <div className="sheet-bg afin-fundo-morte">
          <GotaMorte parado={!bgAnimated} />
        </div>
      ) : (
        <div
          className={`sheet-bg ${bgClass}${bgAnimated ? '' : ' sheet-bg-static'}`}
          style={{ backgroundImage: `linear-gradient(rgba(19,17,24,0.4), rgba(19,17,24,0.4)), url(${bgImage})` }}
        />
      )}
      <header className="vtt-topbar">
        <nav className="vtt-tabs">
          <img className="vtt-topbar-logo" src={arkanisLogo} alt="Arkanis" />
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} disabled={tab === t}>{t}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button type="button" className="vtt-icon-btn vtt-icon-btn-labeled" onClick={() => setShowDice((v) => !v)}>
              <img src={d20Icon} alt="" />
              <span>Dados</span>
            </button>
            {showDice && <DiceRoller character={character} onClose={() => setShowDice(false)} />}
          </div>
          <button type="button" className="vtt-icon-btn vtt-icon-btn-labeled" onClick={() => setEditMode((v) => !v)}>
            <img src={changeIcon} alt="" />
            <span>{editMode ? 'Modo de Jogo' : 'Modo de Edição'}</span>
          </button>
          <button type="button" className="vtt-icon-btn" aria-label="Configurações" onClick={() => setShowConfig((v) => !v)}>
            <img src={settingsIcon} alt="" />
          </button>
          <button type="button" className="vtt-icon-btn" aria-label="Histórico de Rolagens" onClick={() => setShowHistory((v) => !v)}>
            <img src={historyIcon} alt="" />
          </button>
        </div>
      </header>

      {showConfig && (
        <ConfiguracoesPanel
          character={character}
          onUpdated={() => setRefreshKey((k) => k + 1)}
          onClose={() => setShowConfig(false)}
        />
      )}
      {showHistory && <HistoricoRolagens character={character} onClose={() => setShowHistory(false)} />}

      {tab === 'Agente' && (
        <AgenteTab
          character={character}
          onUpdated={() => setRefreshKey((k) => k + 1)}
          editMode={editMode}
          originName={originName}
          className={className}
          trackName={trackName}
          elementoNome={elemento ? ELEMENTO_NOMES[elemento] ?? elemento : null}
          onNameChange={async (name) => {
            setCharacter((c) => (c ? { ...c, name } : c))
            await supabase.from('characters').update({ name }).eq('id', character.id)
          }}
        />
      )}
      {tab === 'Arquivos' && (
        <InvestigacaoTab character={character} originName={originName} className={className} />
      )}
      {tab === 'Progressão' && (
        <ProgressaoTab character={character} onUpdated={() => setRefreshKey((k) => k + 1)} />
      )}
      {tab === 'Afinidade' && (
        <AfinidadeTab character={character} onUpdated={() => setRefreshKey((k) => k + 1)} />
      )}
      {tab === 'Interlúdio' && (
        <InterludioTab character={character} onUpdated={() => setRefreshKey((k) => k + 1)} />
      )}
      {tab === 'Regras Extras' && <RegrasExtrasTab elemento={elemento} />}
    </main>
    </FichaAoVivo>
  )
}
