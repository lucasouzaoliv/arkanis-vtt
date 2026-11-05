import { recortarImagem } from '../components/RecortarImagem'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { SISTEMAS } from '../lib/sistemas'

// Criar Campanha (spec 4.4): nome, descrição, capa, cor de destaque e o jogo.
// O card seleciona o jogo; ao criar, o mestre entra direto na mesa (12.1).
// Com /campanha/:id/editar (pedido da Millie, 08/10): a mesma tela, já preenchida, pra trocar
// nome, descrição, capa e cor (o jogo não muda depois de criada).
export default function CriarCampanha() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { id: editandoId } = useParams()
  const capaRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState('Nova Campanha')
  const [descricao, setDescricao] = useState('')
  const [capa, setCapa] = useState<string | null>(null)
  const [cor, setCor] = useState('#b48af0')
  const [jogo, setJogo] = useState<string | null>(null)
  const [enviandoCapa, setEnviandoCapa] = useState(false)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroCapa, setErroCapa] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(!!editandoId)

  useEffect(() => {
    if (!editandoId) return
    supabase.from('campaigns').select('name, description, cover_image_url, accent_color, system').eq('id', editandoId).maybeSingle().then(({ data }) => {
      if (data) {
        setNome(data.name ?? '')
        setDescricao(data.description ?? '')
        setCapa(data.cover_image_url)
        setCor(data.accent_color || '#b48af0')
        setJogo(data.system)
      } else setErro('Campanha não encontrada (ou você não é o mestre dela).')
      setCarregando(false)
    })
  }, [editandoId])

  async function salvarEdicao() {
    if (!editandoId || criando) return
    if (!nome.trim()) {
      setErro('Dê um nome pra campanha.')
      return
    }
    setCriando(true)
    setErro(null)
    const { error } = await supabase.from('campaigns').update({ name: nome.trim(), description: descricao.trim() || null, cover_image_url: capa, accent_color: cor }).eq('id', editandoId)
    setCriando(false)
    if (error) setErro(error.message)
    else navigate('/jogar')
  }

  async function escolherCapa(e: ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    // Recorte (pedido da Millie, 08/10): a pessoa enquadra a parte que quer ou usa a inteira.
    const arquivo = escolhido ? await recortarImagem(escolhido, { proporcao: 'quadrado', titulo: 'Capa da campanha' }) : null
    if (!arquivo || !session) return
    setEnviandoCapa(true)
    setErroCapa(null)
    const caminho = `${session.user.id}/${Date.now()}-${arquivo.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('campaign_covers').upload(caminho, arquivo)
    setEnviandoCapa(false)
    if (error) {
      setErroCapa(`Não deu pra enviar a imagem: ${error.message}`)
      return
    }
    setCapa(supabase.storage.from('campaign_covers').getPublicUrl(caminho).data.publicUrl)
  }

  async function criar() {
    if (!session || criando) return
    if (!jogo) {
      setErro('Escolha o jogo da campanha.')
      return
    }
    if (!nome.trim()) {
      setErro('Dê um nome pra campanha.')
      return
    }
    setCriando(true)
    setErro(null)
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        name: nome.trim(),
        description: descricao.trim() || null,
        cover_image_url: capa,
        accent_color: cor,
        system: jogo,
        owner_id: session.user.id,
      })
      .select('id')
      .single()
    if (error) {
      setCriando(false)
      setErro(error.message)
      return
    }
    await supabase.from('campaign_members').insert({ campaign_id: data.id, user_id: session.user.id, role: 'mestre' })
    navigate(`/mesa/${data.id}`)
  }

  return (
    <main className="criar-campanha" style={{ '--cc-destaque': cor } as React.CSSProperties}>
      <h1>{editandoId ? 'Editar Campanha' : 'Criar Campanha'}</h1>
      {carregando && <p>Carregando…</p>}

      <section>
        <h2>Informações básicas</h2>
        <label className="cc-linha">
          <span className="cc-rotulo">Nome da campanha</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="cc-linha">
          <span className="cc-rotulo">Descrição</span>
          <textarea value={descricao} placeholder="Escreva aqui" onChange={(e) => setDescricao(e.target.value)} />
        </label>
      </section>

      <section>
        <h2>Aparência</h2>
        <div className="cc-linha">
          <span className="cc-rotulo">Imagem de Capa</span>
          <div className="cc-capa">
            {capa && <img src={capa} alt="" className="cc-capa-previa" />}
            {capa && <button type="button" className="cc-botao" onClick={() => setCapa(null)}>Tirar imagem</button>}
            <input ref={capaRef} type="file" accept="image/*" hidden onChange={escolherCapa} />
            <button type="button" className="cc-botao" disabled={enviandoCapa} onClick={() => capaRef.current?.click()}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
              </svg>
              {enviandoCapa ? 'Enviando…' : capa ? 'Trocar imagem' : 'Escolher imagem'}
            </button>
            {erroCapa && <p role="alert" className="cc-erro">{erroCapa}</p>}
          </div>
        </div>
        <div className="cc-linha">
          <span className="cc-rotulo">Cor de Destaque</span>
          <input type="color" className="cc-cor-rgb" value={cor} aria-label="Cor de Destaque" onChange={(e) => setCor(e.target.value)} />
        </div>
      </section>

      {!editandoId && (
      <section>
        <h2>Escolha o jogo para a campanha</h2>
        <div className="system-card-grid cc-jogos">
          {SISTEMAS.filter((s) => !('semCampanha' in s && s.semCampanha)).map((s) => (
            <div key={s.id} className={`system-card-wrap${jogo === s.id ? ' cc-jogo-escolhido' : ''}`}>
              <span className="system-card-badge">{s.version}</span>
              <div className="system-card">
                <div className="system-card-left">
                  <h2>{s.name}</h2>
                  <p>{s.description}</p>
                  <button type="button" className="btn-pill btn-pill-danger" aria-pressed={jogo === s.id} onClick={() => { setJogo(s.id); setErro(null) }}>
                    {jogo === s.id ? 'Jogo selecionado' : 'Selecionar jogo'}
                  </button>
                </div>
                <div className="system-card-right" style={{ backgroundImage: `url(${s.image})` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {erro && <p role="alert" className="cc-erro">{erro}</p>}

      <div className="cc-acoes">
        <button type="button" className="cc-botao cc-criar" disabled={criando || enviandoCapa || carregando} onClick={editandoId ? salvarEdicao : criar}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4.5 12.5l5 5L19.5 7" />
          </svg>
          {editandoId ? (criando ? 'Salvando…' : 'Salvar Alterações') : criando ? 'Criando…' : 'Criar Campanha'}
        </button>
      <Link to="/jogar" className="cc-voltar">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
        Voltar
      </Link>
      </div>
    </main>
  )
}
