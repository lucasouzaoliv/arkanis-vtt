import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fallbackAvatarColor } from '../lib/color'
import { esquecerDestino, guardarDestino } from '../lib/convitePendente'
import arkanisLogo from '../assets/icons/arkanis-logo.png'

type Opcao = { id: string; name: string | null; avatar_url: string | null; campaign_id: string | null }

// Escolher com qual personagem entrar numa campanha: um que a pessoa já criou ou um novo
// de Ordem Paranormal. Só depois disso ela entra na mesa.
// Pelo convite (`codigoConvite`), é aqui que a pessoa vira membro da campanha.
export default function EscolherPersonagem({ campanha, codigoConvite, voltarPara, janela, onFechar, onSemFicha }: {
  campanha: { id: string; name: string }
  codigoConvite?: string
  // Pra onde voltar depois de criar o personagem novo.
  voltarPara: string
  janela?: boolean
  onFechar?: () => void
  // Já na mesa: entrou sem ficha (a mesa abre sem recarregar).
  onSemFicha?: () => void
}) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    supabase
      .from('characters')
      .select('id, name, avatar_url, campaign_id')
      .eq('user_id', session.user.id)
      // NPCs do mestre vivem na aba Personagens da mesa, não aqui.
      .eq('npc', false)
      // Ordem Paranormal 2 ainda não joga na mesa.
      .neq('system', 'ordem_paranormal_2')
      .order('created_at', { ascending: false })
      .then(({ data }) => setOpcoes(data ?? []))
  }, [session])

  function criarNovo() {
    guardarDestino(voltarPara)
    navigate('/personagem/criar/ordem-paranormal')
  }

  async function entrar() {
    if (!escolhido || salvando) return
    setSalvando(true)
    setErro(null)
    if (codigoConvite) {
      const { error } = await supabase.rpc('join_campaign_by_code', { p_invite_code: codigoConvite })
      if (error) {
        setSalvando(false)
        setErro(error.message)
        return
      }
    }
    const { error } = await supabase.from('characters').update({ campaign_id: campanha.id }).eq('id', escolhido)
    if (error) {
      setSalvando(false)
      setErro(error.message)
      return
    }
    esquecerDestino()
    navigate(`/mesa/${campanha.id}`)
  }

  // Entrar sem ficha (pedido da Millie, 07/10): o mestre cria a ficha na mesa e dá pra pessoa
  // em Configurar Propriedade → Dono.
  async function entrarSemFicha() {
    if (!session || salvando) return
    setSalvando(true)
    setErro(null)
    if (codigoConvite) {
      const { error } = await supabase.rpc('join_campaign_by_code', { p_invite_code: codigoConvite })
      if (error) {
        setSalvando(false)
        setErro(error.message)
        return
      }
    }
    const { error } = await supabase.from('campaign_members').update({ sem_ficha: true }).eq('campaign_id', campanha.id).eq('user_id', session.user.id)
    if (error) {
      setSalvando(false)
      setErro(error.message)
      return
    }
    esquecerDestino()
    if (onSemFicha) onSemFicha()
    else navigate(`/mesa/${campanha.id}`)
  }

  const conteudo = (
    <div className={janela ? 'modal-box escolher-personagem' : 'escolher-personagem'} onClick={(e) => e.stopPropagation()}>
      <h2>Escolha seu personagem</h2>
      <p className="character-list-desc">Pra entrar em <strong>{campanha.name}</strong>, crie um personagem de Ordem Paranormal, leve um que você já criou ou entre sem ficha (o mestre te dá uma).</p>

      <button type="button" className="btn-pill btn-pill-danger" onClick={criarNovo}>Criar personagem de Ordem Paranormal</button>

      {opcoes === null && <p>Carregando…</p>}
      {opcoes && opcoes.length > 0 && (
        <>
          <p className="escolher-personagem-ou">ou adicione um que você já tem:</p>
          <div className="character-tile-grid escolher-personagem-lista">
            {opcoes.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`character-tile character-tile-selectable${escolhido === c.id ? ' selected' : ''}`}
                style={c.avatar_url ? { backgroundImage: `url(${c.avatar_url})` } : { backgroundColor: fallbackAvatarColor(c.id) }}
                onClick={() => setEscolhido(c.id)}
              >
                {!c.avatar_url && <img className="character-tile-watermark" src={arkanisLogo} alt="" />}
                <div className="character-tile-info">
                  <strong>{c.name || 'Sem nome'}</strong>
                  <span>{c.campaign_id && c.campaign_id !== campanha.id ? 'Em outra campanha' : 'Ordem Paranormal'}</span>
                </div>
              </button>
            ))}
          </div>
          {escolhido && opcoes.find((c) => c.id === escolhido)?.campaign_id && opcoes.find((c) => c.id === escolhido)?.campaign_id !== campanha.id && (
            <p className="character-list-desc">Esse personagem sai da outra campanha e passa pra esta.</p>
          )}
        </>
      )}

      {erro && <p role="alert">{erro}</p>}

      <div className="modal-actions">
        {onFechar && <button type="button" className="btn-pill btn-pill-neutral" onClick={onFechar}>Voltar</button>}
        <button type="button" className="btn-pill btn-pill-neutral" disabled={salvando} onClick={entrarSemFicha}>Entrar sem ficha</button>
        {opcoes && opcoes.length > 0 && (
          <button type="button" className="btn-pill" disabled={!escolhido || salvando} onClick={entrar}>
            {salvando ? 'Entrando…' : 'Entrar na campanha'}
          </button>
        )}
      </div>
    </div>
  )

  return janela ? <div className="modal-backdrop" onClick={onFechar}>{conteudo}</div> : conteudo
}
