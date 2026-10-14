// Calculadora (estilo iPhone): funciona de verdade, sem eval.
import { useState } from 'react'

type Op = '+' | '−' | '×' | '÷'

function calcular(a: number, b: number, op: Op): number {
  if (op === '+') return a + b
  if (op === '−') return a - b
  if (op === '×') return a * b
  return b === 0 ? Number.NaN : a / b
}

function formatar(n: number): string {
  if (!Number.isFinite(n)) return 'Erro'
  const s = Number(n.toPrecision(10)).toString()
  return s.replace('.', ',')
}

export default function AppCalculadora() {
  const [visor, setVisor] = useState('0')
  const [guardado, setGuardado] = useState<number | null>(null)
  const [op, setOp] = useState<Op | null>(null)
  const [novo, setNovo] = useState(true)
  const valor = () => Number(visor.replace(',', '.'))

  function digito(d: string) {
    if (novo || visor === '0' || visor === 'Erro') setVisor(d === ',' ? '0,' : d)
    else if (!(d === ',' && visor.includes(',')) && visor.length < 12) setVisor(visor + d)
    setNovo(false)
  }
  function operar(o: Op) {
    if (op && guardado !== null && !novo) { const r = calcular(guardado, valor(), op); setGuardado(r); setVisor(formatar(r)) } else setGuardado(valor())
    setOp(o)
    setNovo(true)
  }
  function igual() {
    if (op === null || guardado === null) return
    const r = calcular(guardado, valor(), op)
    setVisor(formatar(r))
    setGuardado(null)
    setOp(null)
    setNovo(true)
  }
  const teclas: [string, () => void, string?][] = [
    [visor === '0' ? 'AC' : 'C', () => { setVisor('0'); setGuardado(null); setOp(null); setNovo(true) }, 'cinza'],
    ['±', () => setVisor(formatar(-valor())), 'cinza'],
    ['%', () => setVisor(formatar(valor() / 100)), 'cinza'],
    ['÷', () => operar('÷'), 'laranja'],
    ['7', () => digito('7')], ['8', () => digito('8')], ['9', () => digito('9')], ['×', () => operar('×'), 'laranja'],
    ['4', () => digito('4')], ['5', () => digito('5')], ['6', () => digito('6')], ['−', () => operar('−'), 'laranja'],
    ['1', () => digito('1')], ['2', () => digito('2')], ['3', () => digito('3')], ['+', () => operar('+'), 'laranja'],
    ['0', () => digito('0'), 'zero'], [',', () => digito(',')], ['=', igual, 'laranja'],
  ]
  return (
    <div className="cel-calc">
      <div className="cel-calc-visor" style={{ fontSize: visor.length > 8 ? 44 : 64 }}>{visor}</div>
      <div className="cel-calc-teclas">
        {teclas.map(([t, f, classe]) => (
          <button key={t} type="button" className={`cel-calc-tecla ${classe ?? ''}${classe === 'laranja' && op === t && novo ? ' ativa' : ''}`} onClick={f}>{t}</button>
        ))}
      </div>
    </div>
  )
}
