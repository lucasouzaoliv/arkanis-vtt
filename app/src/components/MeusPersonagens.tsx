import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fallbackAvatarColor } from '../lib/color'
import { SISTEMAS } from '../lib/sistemas'
import arkanisLogo from '../assets/icons/arkanis-logo.png'

const nomeDoJogo = (system: string) => SISTEMAS.find((s) => s.id === system)?.name ?? 'Ordem Paranormal'

type CharacterListItem = {
  id: string
  name: string | null
  avatar_url: string | null
  historico: string | null
  system: string
}

export default function MeusPersonagens({ variant = 'perfil' }: { variant?: 'perfil' | 'jogar' }) {
  const { session } = useAuth()
  const [characters, setCharacters] = useState<CharacterListItem[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CharacterListItem | null>(null)
  const [accentColor, setAccentColor] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function loadCharacters() {
    if (!session) return
    const { data } = await supabase
      .from('characters')
      .select('id, name, avatar_url, historico, system')
      .eq('user_id', session.user.id)
      // NPCs do mestre vivem na aba Personagens da mesa, não aqui.
      .eq('npc', false)
      .order('created_at', { ascending: false })
    setCharacters(data ?? [])
  }

  useEffect(() => {
    loadCharacters()
  }, [session])

  useEffect(() => {
    if (!session || variant !== 'jogar') return
    supabase.from('profiles').select('accent_color').eq('id', session.user.id).single()
      .then(({ data }) => setAccentColor(data?.accent_color ?? null))
  }, [session, variant])

  async function handleCompartilhar(c: CharacterListItem) {
    const url = `${window.location.origin}/personagem/${c.id}`
    await navigator.clipboard.writeText(url)
    setCopiedId(c.id)
    setMenuOpen(null)
    setTimeout(() => setCopiedId((id) => (id === c.id ? null : id)), 2000)
  }

  async function handleDuplicar(c: CharacterListItem) {
    setMenuOpen(null)
    await supabase.rpc('duplicate_character', { p_source_id: c.id })
    loadCharacters()
  }

  async function handleDeletar() {
    if (!deleting) return
    await supabase.from('characters').delete().eq('id', deleting.id)
    setDeleting(null)
    loadCharacters()
  }

  function CardMenu({ c }: { c: CharacterListItem }) {
    return (
      <div className="character-card-menu" onClick={(e) => e.preventDefault()}>
        <button
          type="button"
          className="character-card-menu-btn"
          onClick={() => setMenuOpen((id) => (id === c.id ? null : c.id))}
          aria-label="Opções"
        >
          •••
        </button>
        {menuOpen === c.id && (
          <>
            <div className="dropdown-backdrop" onClick={() => setMenuOpen(null)} />
            <ul className="character-card-dropdown">
              <li><button type="button" onClick={() => handleCompartilhar(c)}>{copiedId === c.id ? 'Link copiado!' : 'Compartilhar'}</button></li>
              <li><button type="button" onClick={() => handleDuplicar(c)}>Duplicar</button></li>
              <li><button type="button" className="danger" onClick={() => { setMenuOpen(null); setDeleting(c) }}>Deletar</button></li>
            </ul>
          </>
        )}
      </div>
    )
  }

  return (
    <section>
      <div className="character-list-header">
        <h2>Meus Personagens</h2>
        {variant === 'jogar' && (
          <div className="character-list-actions">
            <Link to="/jogar" className="btn-pill" style={{ backgroundColor: accentColor ?? undefined }}>
              Ver todos os personagens
            </Link>
            <Link to="/personagem/criar" className="btn-pill btn-pill-neutral">Criar novo personagem</Link>
          </div>
        )}
      </div>

      {variant === 'jogar' && (
        <p className="character-list-desc">
          Aqui estão os personagens com quem você já jogou. Não está vendo o que procura? Acesse "Ver todos os personagens".
        </p>
      )}

      {characters === null && <p>Carregando…</p>}
      {characters?.length === 0 && <p>Nenhum personagem ainda.</p>}

      {variant === 'jogar' ? (
        <div className="character-tile-grid">
          {characters?.map((c) => (
            <Link
              key={c.id}
              to={`/personagem/${c.id}`}
              className="character-tile"
              style={c.avatar_url
                ? { backgroundImage: `url(${c.avatar_url})` }
                : { backgroundColor: fallbackAvatarColor(c.id) }}
            >
              {!c.avatar_url && <img className="character-tile-watermark" src={arkanisLogo} alt="" />}
              <CardMenu c={c} />
              <div className="character-tile-info">
                <strong>{c.name || 'Sem nome'}</strong>
                <span>{nomeDoJogo(c.system)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="character-list">
          {characters?.map((c) => (
            <div key={c.id} className="character-card">
              <Link to={`/personagem/${c.id}`} className="character-card-avatar-link">
                {c.avatar_url ? (
                  <img className="character-card-avatar" src={c.avatar_url} alt="" />
                ) : (
                  <div className="character-card-avatar character-card-avatar-fallback" style={{ backgroundColor: fallbackAvatarColor(c.id) }}>
                    <img src={arkanisLogo} alt="" />
                  </div>
                )}
              </Link>

              <div className="character-card-body">
                <button
                  type="button"
                  className="character-card-name"
                  onClick={() => setExpanded((e) => (e === c.id ? null : c.id))}
                >
                  {c.name || 'Sem nome'}
                </button>
                <p className="character-card-game">{nomeDoJogo(c.system)}</p>
                {expanded === c.id && (
                  <p className="character-card-historia">{c.historico || 'Sem história definida ainda.'}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleting && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3>Deletar Personagem</h3>
            <p>Você realmente quer deletar {deleting.name || 'este personagem'}?</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setDeleting(null)}>Cancelar</button>
              <button type="button" className="danger" onClick={handleDeletar}>Deletar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
