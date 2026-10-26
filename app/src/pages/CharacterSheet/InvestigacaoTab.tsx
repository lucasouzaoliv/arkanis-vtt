import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { CharacterRecord } from './index'
import { fallbackAvatarColor } from '../../lib/color'
import brasao from '../../assets/criacao/brasao-ordo-realitas.png'
import clipe from '../../assets/investigacao/clipe.svg'
import arkanisLogo from '../../assets/icons/arkanis-logo.png'
import lixeira from '../../assets/combate/lixeira.png'
import lixeiraAberta from '../../assets/combate/lixeira-aberta.png'
import { TextareaFormatada, TextoRico } from '../../components/TextoRico'
import { tocarSom } from '../../lib/sons'

type Page = {
  id: string
  title: string
  objective: string
  summary: string
  questions: string
  clues: string
}

type PersonalFields = {
  aparencia: string | null
  personalidade: string | null
  objetivo: string | null
  historico: string | null
  lembrete_fechado: boolean
}

export const TITULO_PADRAO = 'Investigação'

export default function InvestigacaoTab({ character, originName, className }: { character: CharacterRecord; originName: string | null; className: string | null }) {
  const [personal, setPersonal] = useState<PersonalFields | null>(null)
  const [pages, setPages] = useState<Page[]>([])
  // null = a sub-aba Pessoal; qualquer outro valor e o id da pagina aberta.
  const [activePage, setActivePage] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; valor: string } | null>(null)
  const [deleting, setDeleting] = useState<Page | null>(null)
  const [trashHover, setTrashHover] = useState(false)
  // A primeira pagina e criada sozinha; esse guarda evita criar duas no StrictMode.
  const criouPrimeira = useRef(false)

  useEffect(() => {
    supabase
      .from('characters')
      .select('aparencia, personalidade, objetivo, historico, lembrete_fechado')
      .eq('id', character.id)
      .single()
      .then(({ data }) => setPersonal(data))
    loadPages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id])

  async function loadPages() {
    const { data } = await supabase
      .from('character_investigation_pages')
      .select('id, title, objective, summary, questions, clues')
      .eq('character_id', character.id)
      .order('sort_order')
    const lista = data ?? []
    if (lista.length === 0 && !criouPrimeira.current) {
      criouPrimeira.current = true
      await addPage()
      return
    }
    setPages(lista)
  }

  async function savePersonalField(field: keyof PersonalFields, value: string | boolean) {
    setPersonal((p) => (p ? { ...p, [field]: value } : p))
    await supabase.from('characters').update({ [field]: value }).eq('id', character.id)
  }

  async function addPage() {
    tocarSom('criar')
    const { data } = await supabase
      .from('character_investigation_pages')
      .insert({ character_id: character.id, title: TITULO_PADRAO, sort_order: pages.length })
      .select('id, title, objective, summary, questions, clues')
      .single()
    if (data) {
      setPages((ps) => [...ps, data])
      setActivePage(data.id)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    tocarSom('deletar')
    const id = deleting.id
    setDeleting(null)
    setPages((ps) => ps.filter((p) => p.id !== id))
    if (activePage === id) setActivePage(null)
    await supabase.from('character_investigation_pages').delete().eq('id', id)
  }

  async function updatePage(id: string, patch: Partial<Page>) {
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    await supabase.from('character_investigation_pages').update(patch).eq('id', id)
  }

  async function salvarTitulo() {
    if (!renaming) return
    const { id, valor } = renaming
    setRenaming(null)
    await updatePage(id, { title: valor.trim() || TITULO_PADRAO })
  }

  /** Clicar na aba ja aberta abre o modal de renomear; na fechada, so troca de aba. */
  function clicarNaAba(p: Page) {
    if (activePage !== p.id) tocarSom('criar') // virar a página
    if (activePage === p.id) setRenaming({ id: p.id, valor: p.title })
    else setActivePage(p.id)
  }

  const current = pages.find((p) => p.id === activePage) ?? null

  const lembreteAberto = activePage === null && personal !== null && !personal.lembrete_fechado

  return (
    <div className={`inv-pasta${lembreteAberto ? ' com-lembrete' : ''}`}>
      <nav className="inv-pasta-abas">
        <button
          type="button"
          className={`inv-pasta-aba${activePage === null ? ' ativa' : ''}`}
          onClick={() => setActivePage(null)}
        >
          Arquivo Pessoal
        </button>
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`inv-pasta-aba${activePage === p.id ? ' ativa' : ''}`}
            onClick={() => clicarNaAba(p)}
            title={activePage === p.id ? 'Clique para renomear' : undefined}
          >
            {p.title || TITULO_PADRAO}
          </button>
        ))}

        <div className="inv-pasta-acoes">
          <button type="button" className="inv-pasta-add" onClick={addPage}>Adicionar nova página</button>
          {current && (
            <button
              type="button"
              className="inv-pasta-lixo"
              onMouseEnter={() => setTrashHover(true)}
              onMouseLeave={() => setTrashHover(false)}
              onClick={() => setDeleting(current)}
              aria-label="Deletar esta página"
            >
              <img src={trashHover ? lixeiraAberta : lixeira} alt="" />
            </button>
          )}
        </div>
      </nav>

      <div className="inv-pasta-corpo">
        {activePage === null && personal && (
          <>
          <div className="inv-pasta-grid">
            <div className="inv-pasta-coluna">
              <FichaAgente character={character} originName={originName} className={className} />
              <Campo
                titulo="Aparência"
                valor={personal.aparencia ?? ''}
                onChange={(v) => savePersonalField('aparencia', v)}
                cresce
              />
            </div>

            <div className="inv-pasta-coluna">
              <Campo
                titulo="Personalidade"
                valor={personal.personalidade ?? ''}
                onChange={(v) => savePersonalField('personalidade', v)}
                cresce
              />
              <Campo
                titulo="Objetivo"
                valor={personal.objetivo ?? ''}
                onChange={(v) => savePersonalField('objetivo', v)}
                cresce
              />
            </div>

            <div className="inv-pasta-coluna">
              <Campo
                titulo="Histórico"
                valor={personal.historico ?? ''}
                onChange={(v) => savePersonalField('historico', v)}
                cresce
              />
            </div>

            </div>

            {!personal.lembrete_fechado && (
              <div className="inv-lembrete">
                <div className="inv-lembrete-topo">
                  <span className="inv-lembrete-titulo">Lembrete</span>
                  <button
                    type="button"
                    className="inv-lembrete-x"
                    onClick={() => savePersonalField('lembrete_fechado', true)}
                    aria-label="Fechar lembrete"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden>
                      <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <p className="inv-lembrete-texto">
                  Anote as perguntas que você têm ao longo da investigação, e responda-as à medida que encontra evidências
                </p>
              </div>
            )}
          </>
        )}

        {current && (
          <div className="inv-pasta-grid">
            <div className="inv-pasta-coluna">
              <Campo
                titulo="Título/Identificador"
                valor={current.title === TITULO_PADRAO ? '' : current.title}
                onChange={(v) => updatePage(current.id, { title: v })}
                destaque
                linhas={2}
              />
              <Campo
                titulo="Objetivo"
                valor={current.objective}
                onChange={(v) => updatePage(current.id, { objective: v })}
                linhas={4}
              />
              <Campo
                titulo="Resumo"
                valor={current.summary}
                onChange={(v) => updatePage(current.id, { summary: v })}
                cresce
              />
            </div>

            <div className="inv-pasta-coluna">
              <Campo
                titulo="Perguntas"
                valor={current.questions}
                onChange={(v) => updatePage(current.id, { questions: v })}
                cresce
              />
            </div>

            <div className="inv-pasta-coluna">
              <Campo
                titulo="Pistas"
                valor={current.clues}
                onChange={(v) => updatePage(current.id, { clues: v })}
                cresce
              />
            </div>
          </div>
        )}
      </div>

      {renaming && (
        <div className="inv-modal-backdrop" onClick={() => setRenaming(null)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Editar título</h3>
            <input
              autoFocus
              value={renaming.valor}
              onChange={(e) => setRenaming({ ...renaming, valor: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvarTitulo()
                if (e.key === 'Escape') setRenaming(null)
              }}
            />
            <div className="inv-modal-botoes">
              <button type="button" className="inv-modal-btn" onClick={() => setRenaming(null)}>Descartar</button>
              <button type="button" className="inv-modal-btn" onClick={salvarTitulo}>Salvar e voltar</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="inv-modal-backdrop" onClick={() => setDeleting(null)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirme sua escolha</h3>
            <p>Tem certeza que deseja deletar a página "{deleting.title || TITULO_PADRAO}"?</p>
            <p className="inv-modal-aviso">Essa ação é irreversível!</p>
            <div className="inv-modal-botoes">
              <button type="button" className="inv-modal-btn" onClick={() => setDeleting(null)}>Cancelar</button>
              <button type="button" className="inv-modal-btn perigo" onClick={confirmDelete}>Deletar página</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Campo({
  titulo,
  valor,
  onChange,
  cresce,
  destaque,
  linhas,
}: {
  titulo: string
  valor: string
  onChange: (v: string) => void
  cresce?: boolean
  destaque?: boolean
  linhas?: number
}) {
  // Formatação (11/10): fora da edição o texto aparece formatado (negrito, itálico, sublinhado,
  // riscado); clicar abre a caixa com a barra B I U S, e sair dela volta a mostrar formatado.
  const [editando, setEditando] = useState(false)
  return (
    <div className={`inv-campo${cresce ? ' cresce' : ''}${destaque ? ' destaque' : ''}`}>
      <div className="inv-campo-titulo">{titulo}</div>
      {editando ? (
        <TextareaFormatada
          autoFocus
          className="inv-campo-texto"
          placeholder="Escreva aqui..."
          rows={linhas}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditando(false)}
        />
      ) : (
        <div
          className={`inv-campo-texto inv-campo-lido${valor ? '' : ' vazio'}`}
          role="textbox"
          tabIndex={0}
          aria-label={titulo}
          onClick={() => setEditando(true)}
          onFocus={() => setEditando(true)}
        >
          {valor ? <TextoRico texto={valor} /> : 'Escreva aqui...'}
        </div>
      )}
    </div>
  )
}

export function FichaAgente({ character, originName, className }: { character: CharacterRecord; originName: string | null; className: string | null }) {
  return (
    <div className="inv-ficha">
      <div className="inv-ficha-fundo">
        <img className="inv-ficha-brasao" src={brasao} alt="" />
      </div>
      <img className="inv-ficha-clipe" src={clipe} alt="" />
      <div className="inv-ficha-lateral">
        <span className="inv-ficha-barra" />
        <span className="inv-ficha-doc">Agente Nº</span>
      </div>

      <div className="inv-ficha-miolo">
        <div
          className="inv-ficha-foto"
          style={character.avatar_url ? undefined : { background: fallbackAvatarColor(character.id) }}
        >
          {character.avatar_url
            ? <img src={character.avatar_url} alt="" />
            : <img className="sem-foto" src={arkanisLogo} alt="" />}
        </div>

        <div className="inv-ficha-identidade">
          <div className="inv-ficha-rotulo">Agente</div>
          <div className="inv-ficha-nome">{character.name}</div>
        </div>

        <div className="inv-ficha-linha">
          <div>
            <div className="inv-ficha-rotulo">Origem</div>
            <div className="inv-ficha-valor">{originName ?? '—'}</div>
          </div>
          <div>
            <div className="inv-ficha-rotulo">Classe</div>
            <div className="inv-ficha-valor">{className ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="inv-ficha-tracos" aria-hidden>/////////////////</div>
    </div>
  )
}
