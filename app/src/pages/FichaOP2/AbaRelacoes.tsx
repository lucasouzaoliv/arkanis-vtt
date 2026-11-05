import { useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { nomeSeguro } from '../../lib/nomeDeArquivo'
import { recortarImagem } from '../../components/RecortarImagem'
import { FICHAS_PRONTAS, type Relacao } from '../../sistemas/op2/fichasProntas'
import type { FichaOP2 } from '../../sistemas/op2/ficha'

// Aba Relações do OP2 (print de 05/11): cartão com foto (própria ou da biblioteca dos personagens
// prontos), nome e três bolinhas de proximidade (1 Afinidade, 2 Vínculo, 3 Devoção).

const CARDS = import.meta.glob('../../assets/op2/fichas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const cardDe = (arquivo: string) => CARDS[`../../assets/op2/fichas/${arquivo}`]
const GRAUS = ['Neutro', 'Afinidade', 'Vínculo', 'Devoção']

export type RelacaoNaFicha = Relacao & { foto?: string | null }

// Foto das fichas prontas: o rosto recortado do card oficial.
function fotoDaPronta(nome: string): string | null {
  const f = FICHAS_PRONTAS.find((x) => x.nome === nome || x.nome.endsWith(` ${nome}`) || nome.startsWith(x.nome))
  return f ? `card:${f.card}` : null
}

function Foto({ foto, nome }: { foto: string | null | undefined; nome: string }) {
  const src = foto?.startsWith('card:') ? cardDe(foto.slice(5)) : foto
  if (!src) return <span className="op2-rel-sem-foto">Clique para adicionar uma foto.</span>
  return <span className={`op2-rel-foto${foto?.startsWith('card:') ? ' do-card' : ''}`} style={{ backgroundImage: `url(${src})` }} role="img" aria-label={nome} />
}

export default function AbaRelacoes({ op2, mudar }: { op2: FichaOP2; mudar: (fn: (f: FichaOP2) => FichaOP2) => void }) {
  const { session } = useAuth()
  const [escolhendoFoto, setEscolhendoFoto] = useState<number | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const relacoes = op2.relacoes as RelacaoNaFicha[]
  const mudarRel = (n: number, campos: Partial<RelacaoNaFicha>) => mudar((f) => ({ ...f, relacoes: f.relacoes.map((r, i) => (i === n ? { ...r, ...campos } : r)) }))

  async function enviarFoto(e: ChangeEvent<HTMLInputElement>) {
    const n = escolhendoFoto
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    setEscolhendoFoto(null)
    const file = escolhido ? await recortarImagem(escolhido, { proporcao: 'quadrado', titulo: 'Foto da relação' }) : null
    if (!file || !session || n === null) return
    const caminho = `${session.user.id}/${Date.now()}-${nomeSeguro(file.name)}`
    const { error } = await supabase.storage.from('character_photos').upload(caminho, file, { upsert: true })
    if (!error) mudarRel(n, { foto: supabase.storage.from('character_photos').getPublicUrl(caminho).data.publicUrl })
  }

  return (
    <div className="op2-rel">
      <h1 className="op2-inv-titulo">Relações</h1>
      <button type="button" className="op2-inv-botao op2-rel-adicionar" onClick={() => mudar((f) => ({ ...f, relacoes: [...f.relacoes, { nome: '', grau: 0, rotulo: '', texto: '' }] }))}>
        Adicionar novo personagem
      </button>
      <input ref={arquivo} type="file" accept="image/*" hidden onChange={enviarFoto} />
      <div className="op2-rel-lista">
        {relacoes.map((r, n) => (
          <div key={n} className="op2-rel-cartao" title={r.texto || undefined}>
            <button type="button" className="op2-rel-foto-botao" onClick={() => setEscolhendoFoto(escolhendoFoto === n ? null : n)}>
              <Foto foto={r.foto ?? fotoDaPronta(r.nome)} nome={r.nome} />
            </button>
            {escolhendoFoto === n && (
              <div className="op2-rel-biblioteca">
                <button type="button" className="op2-inv-botao" onClick={() => arquivo.current?.click()}>Enviar foto</button>
                <div className="op2-rel-biblioteca-grade">
                  {FICHAS_PRONTAS.map((f) => (
                    <button key={f.id} type="button" title={f.nome} onClick={() => { mudarRel(n, { foto: `card:${f.card}`, ...(r.nome ? {} : { nome: f.nome }) }); setEscolhendoFoto(null) }}>
                      <span className="op2-rel-foto do-card" style={{ backgroundImage: `url(${cardDe(f.card)})` }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input className="op2-rel-nome" value={r.nome} placeholder="Nome aqui" aria-label="Nome" onChange={(e) => mudarRel(n, { nome: e.target.value })} />
            <div className="op2-rel-graus" role="radiogroup" aria-label={`Proximidade: ${GRAUS[r.grau]}`}>
              {[1, 2, 3].map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={r.grau >= g}
                  title={GRAUS[g]}
                  className={r.grau >= g ? 'cheia' : undefined}
                  onClick={() => mudarRel(n, { grau: (r.grau === g ? g - 1 : g) as Relacao['grau'] })}
                />
              ))}
            </div>
            {r.rotulo && <span className="op2-rel-rotulo">{r.rotulo}</span>}
            <button type="button" className="op2-rel-tirar" aria-label="Tirar relação" onClick={() => window.confirm(`Tirar ${r.nome || 'esta relação'}?`) && mudar((f) => ({ ...f, relacoes: f.relacoes.filter((_, i) => i !== n) }))}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
