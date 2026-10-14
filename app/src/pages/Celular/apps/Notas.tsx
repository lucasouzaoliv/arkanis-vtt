// Notas: o bloco de notas do personagem (pistas, nomes, endereços). Só o dono e o mestre leem.
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons'
import { useCelular } from '../estado'
import { apagarNota, notasDo, salvarNota, useAoVivo, type Nota } from '../dadosDosApps'
import { horaDaMensagem } from '../dados'
import { Topo } from './comum'

export default function AppNotas() {
  const e = useCelular()
  const meu = 'celular' in e.eu ? e.eu.celular : null
  const [notas, setNotas] = useState<Nota[]>([])
  const [aberta, setAberta] = useState<{ id?: string; titulo: string; texto: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useAoVivo('celular_notas', meu ? `celular_id=eq.${meu}` : null, () => { if (meu) void notasDo(meu).then(setNotas) })

  if (!meu) return <div className="cel-notas"><p className="cel-vazio">O NPC não tem notas.</p></div>

  async function guardar(n: { id?: string; titulo: string; texto: string }) {
    if (!n.titulo.trim() && !n.texto.trim()) return
    const r = await salvarNota({ ...n, celularId: meu! })
    setErro(r.erro)
    if (r.id && !n.id) setAberta((a) => (a ? { ...a, id: r.id! } : a))
    setNotas(await notasDo(meu!))
  }

  if (aberta) {
    return (
      <div className="cel-notas cel-notas-editor">
        <Topo titulo="Notas" voltar={() => { void guardar(aberta); setAberta(null) }} direita={aberta.id && (
          <button type="button" className="cel-link perigo" aria-label="Apagar" onClick={async () => { await apagarNota(aberta.id!); setAberta(null); setNotas(await notasDo(meu)) }}><FontAwesomeIcon icon={faTrash} /></button>
        )} />
        <input className="cel-notas-titulo" placeholder="Título" value={aberta.titulo} maxLength={120} onChange={(ev) => setAberta({ ...aberta, titulo: ev.target.value })} onBlur={() => guardar(aberta)} />
        <textarea className="cel-notas-texto" placeholder="Escreva aqui…" value={aberta.texto} maxLength={20000} onChange={(ev) => setAberta({ ...aberta, texto: ev.target.value })} onBlur={() => guardar(aberta)} autoFocus={!aberta.id} />
        {erro && <p className="cel-erro">{erro}</p>}
      </div>
    )
  }

  return (
    <div className="cel-notas">
      <div className="cel-galeria-topo">
        <h1 className="cel-titulo-grande">Notas</h1>
        <button type="button" className="cel-link cel-notas-nova" aria-label="Nova nota" onClick={() => setAberta({ titulo: '', texto: '' })}><FontAwesomeIcon icon={faPenToSquare} /></button>
      </div>
      <div className="cel-lista cel-notas-lista">
        {notas.map((n) => (
          <button key={n.id} type="button" className="cel-lista-item cel-pessoa" onClick={() => setAberta({ id: n.id, titulo: n.titulo ?? '', texto: n.texto ?? '' })}>
            <span><strong>{n.titulo || (n.texto ?? '').split('\n')[0] || 'Nota'}</strong><small>{horaDaMensagem(e.tempo, n.minuto_no_jogo, n.updated_at)} · {(n.texto ?? '').replace(/\s+/g, ' ').slice(0, 60)}</small></span>
          </button>
        ))}
        {notas.length === 0 && <p className="cel-vazio">Nenhuma nota. Toque no lápis pra escrever.</p>}
      </div>
    </div>
  )
}
