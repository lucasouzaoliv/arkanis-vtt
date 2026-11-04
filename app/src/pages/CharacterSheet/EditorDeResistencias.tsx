import { useState } from 'react'
import { TIPOS_DE_DANO } from '../../lib/tiposDeDano'
import { resistenciasFinais, textoDasResistencias, TODO_DANO, type Resistencia, type ResistenciaExtra } from './itemMods'

const nomeNormal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
const rotulo = (tipo: string) => (nomeNormal(tipo) === nomeNormal(TODO_DANO) ? 'Todo dano' : tipo)

// Resistências da ficha (pedido da Millie, 04/11): as dos itens, mais as que a pessoa adiciona, tira ou
// marca como temporárias. A mesa usa o mesmo resultado na hora de descontar o dano.
export default function EditorDeResistencias({ deItens, extras, onSalvar }: {
  deItens: Resistencia[]
  extras: ResistenciaExtra[]
  onSalvar: (extras: ResistenciaExtra[]) => void
}) {
  const [editando, setEditando] = useState(false)
  const [tipo, setTipo] = useState(TIPOS_DE_DANO[0].rotulo)
  const [valor, setValor] = useState('5')
  const [temporaria, setTemporaria] = useState(true)

  const finais = resistenciasFinais(deItens, extras)
  const manuais = extras.filter((e) => !e.semItem)
  const tiradas = new Set(extras.filter((e) => e.semItem).map((e) => nomeNormal(e.tipo)))
  const temTemporaria = manuais.some((e) => e.temporaria)

  function adicionar() {
    const n = Math.floor(Number(valor))
    if (!n || n < 0) return
    onSalvar([...extras, { id: crypto.randomUUID(), tipo, valor: n, temporaria }])
  }

  return (
    <div className="resist-editor">
      <p className="resist-resumo">
        <strong>Resistência:</strong> {textoDasResistencias(finais.map((r) => ({ ...r, tipo: rotulo(r.tipo) }))) || 'Nenhuma'}
        <button type="button" className="resist-editar" onClick={() => setEditando((v) => !v)}>{editando ? 'Fechar' : 'Editar'}</button>
      </p>
      {editando && (
        <div className="resist-painel">
          {deItens.length > 0 && (
            <ul className="resist-lista">
              {deItens.map((r) => {
                const tirada = tiradas.has(nomeNormal(r.tipo))
                return (
                  <li key={r.tipo} className={tirada ? 'tirada' : undefined}>
                    <span>{rotulo(r.tipo)} {r.valor}<small>do item</small></span>
                    {tirada ? (
                      <button type="button" onClick={() => onSalvar(extras.filter((e) => !(e.semItem && nomeNormal(e.tipo) === nomeNormal(r.tipo))))}>Devolver</button>
                    ) : (
                      <button type="button" onClick={() => onSalvar([...extras, { id: crypto.randomUUID(), tipo: r.tipo, valor: 0, semItem: true }])}>Tirar</button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {manuais.length > 0 && (
            <ul className="resist-lista">
              {manuais.map((e) => (
                <li key={e.id}>
                  <span>
                    {rotulo(e.tipo)} {e.valor}
                    {e.temporaria && <small className="temp">{e.umaVez ? 'só no próximo dano' : 'temporária'}</small>}
                    {e.origem && <small>{e.origem}</small>}
                  </span>
                  <button type="button" onClick={() => onSalvar(extras.filter((x) => x.id !== e.id))}>Tirar</button>
                </li>
              ))}
            </ul>
          )}
          <div className="resist-nova">
            <select aria-label="Tipo de dano" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value={TODO_DANO}>Todo dano</option>
              {TIPOS_DE_DANO.map((t) => <option key={t.id} value={t.rotulo}>{t.rotulo}</option>)}
            </select>
            <input type="number" min={1} aria-label="Valor da resistência" value={valor} onChange={(e) => setValor(e.target.value)} onFocus={(e) => e.target.select()} />
            <label><input type="checkbox" checked={temporaria} onChange={(e) => setTemporaria(e.target.checked)} /> Temporária</label>
            <button type="button" onClick={adicionar}>Adicionar</button>
          </div>
          {temTemporaria && <button type="button" className="resist-limpar" onClick={() => onSalvar(extras.filter((e) => e.semItem || !e.temporaria))}>Tirar todas as temporárias</button>}
        </div>
      )}
    </div>
  )
}
