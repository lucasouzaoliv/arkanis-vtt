import { useEffect, useRef, useState } from 'react'

// Gravar áudio pelo microfone (recado de voz, áudio no WhatsApp).
export function useGravador() {
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const rec = useRef<{ r: MediaRecorder; fluxo: MediaStream; pedacos: Blob[]; desde: number; fim: (v: { blob: Blob; duracao: number } | null) => void } | null>(null)

  useEffect(() => {
    if (!gravando) return
    const t = window.setInterval(() => setSegundos(Math.floor((Date.now() - (rec.current?.desde ?? Date.now())) / 1000)), 300)
    return () => window.clearInterval(t)
  }, [gravando])
  useEffect(() => () => { rec.current?.fluxo.getTracks().forEach((t) => t.stop()) }, [])

  async function comecar(): Promise<string | null> {
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(fluxo)
      const g = { r, fluxo, pedacos: [] as Blob[], desde: Date.now(), fim: (_: { blob: Blob; duracao: number } | null) => {} }
      r.ondataavailable = (ev) => g.pedacos.push(ev.data)
      rec.current = g
      r.start()
      setSegundos(0)
      setGravando(true)
      return null
    } catch {
      return 'Não deu pra usar o microfone.'
    }
  }

  // Para e devolve o áudio (ou null se não estava gravando).
  function parar(): Promise<{ blob: Blob; duracao: number } | null> {
    const g = rec.current
    if (!g) return Promise.resolve(null)
    return new Promise((resolver) => {
      g.r.onstop = () => {
        g.fluxo.getTracks().forEach((t) => t.stop())
        rec.current = null
        setGravando(false)
        resolver({ blob: new Blob(g.pedacos, { type: g.r.mimeType || 'audio/webm' }), duracao: Math.round((Date.now() - g.desde) / 1000) })
      }
      g.r.stop()
    })
  }

  function cancelar() {
    const g = rec.current
    if (!g) return
    g.r.onstop = null
    g.r.stop()
    g.fluxo.getTracks().forEach((t) => t.stop())
    rec.current = null
    setGravando(false)
  }

  return { gravando, segundos, comecar, parar, cancelar }
}
