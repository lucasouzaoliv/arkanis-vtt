import { useState } from 'react'
import { TIPOS_DE_DANO, rotuloDoTipoDeDano } from '../../lib/tiposDeDano'

// "Tipo de Dano" com a lista de todos os tipos (pedido 12/10), no mesmo estilo dos seletores do
// modal de ataque. Guarda o rótulo ("Perfuração"), que é o que a mesa lê pra descontar a resistência.
// Um texto antigo que não é tipo conhecido aparece como está, pra não sumir ao abrir.
export default function CampoTipoDeDano({ value, onChange, label = 'Tipo de Dano' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const atual = rotuloDoTipoDeDano(value) ?? value
  const opcoes = [
    { value: '', label: 'Nenhum' },
    ...TIPOS_DE_DANO.map((t) => ({ value: t.rotulo, label: t.rotulo })),
    ...(atual && !TIPOS_DE_DANO.some((t) => t.rotulo === atual) ? [{ value: atual, label: atual }] : []),
  ]
  return (
    <div className="attack-field">
      <span className="attack-field-label">{label}</span>
      <div className="attack-select">
        <button type="button" className="attack-select-trigger" aria-label={label} onClick={() => setOpen((v) => !v)}>
          <span>{atual || 'Nenhum'}</span>
          <span className="attack-select-arrow">{open ? '▲' : '▾'}</span>
        </button>
        {open && (
          <div className="attack-select-list">
            {opcoes.map((o) => (
              <button key={o.value || 'nenhum'} type="button" className={o.value === atual ? 'selected' : ''} onClick={() => { onChange(o.value); setOpen(false) }}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
