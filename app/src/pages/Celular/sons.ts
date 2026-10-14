// Toques do celular: o mp3 que a pessoa escolheu (por contato ou o padrão) ou, sem nenhum, um toque
// feito na hora. Respeita o volume de Efeitos Sonoros da pessoa.
import { efeitosMudos, lerVolumes } from '../Mesa/volumesDoUsuario'

function volume(): number {
  return efeitosMudos() ? 0 : lerVolumes().efeitos
}

let ctx: AudioContext | null = null
function contexto(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// Dois bipes, como um telefone tocando.
function bipe(c: AudioContext, quando: number, nivel: number, freqs: number[], duracao: number) {
  const ganho = c.createGain()
  ganho.gain.setValueAtTime(0, quando)
  ganho.gain.linearRampToValueAtTime(nivel * 0.25, quando + 0.02)
  ganho.gain.setValueAtTime(nivel * 0.25, quando + duracao - 0.05)
  ganho.gain.linearRampToValueAtTime(0, quando + duracao)
  ganho.connect(c.destination)
  for (const f of freqs) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    o.connect(ganho)
    o.start(quando)
    o.stop(quando + duracao)
  }
}

// Toque de ligação em repetição até parar (atender, recusar, encerrar). Devolve o "parar".
export function tocarToque(url: string | null | undefined): () => void {
  const nivel = volume()
  if (nivel <= 0) return () => {}
  if (url) {
    const a = new Audio(url)
    a.loop = true
    a.volume = Math.min(1, nivel)
    void a.play().catch(() => {})
    return () => { a.pause(); a.src = '' }
  }
  const c = contexto()
  if (!c) return () => {}
  let parado = false
  const tocar = () => {
    if (parado) return
    const t = c.currentTime + 0.05
    bipe(c, t, nivel, [440, 480], 0.4)
    bipe(c, t + 0.6, nivel, [440, 480], 0.4)
  }
  tocar()
  const t = window.setInterval(tocar, 3000)
  return () => { parado = true; window.clearInterval(t) }
}

// Som de mensagem chegando (uma vez).
export function tocarNotificacao(url: string | null | undefined) {
  const nivel = volume()
  if (nivel <= 0) return
  if (url) {
    const a = new Audio(url)
    a.volume = Math.min(1, nivel)
    void a.play().catch(() => {})
    return
  }
  const c = contexto()
  if (!c) return
  const t = c.currentTime + 0.02
  bipe(c, t, nivel, [880], 0.12)
  bipe(c, t + 0.14, nivel, [1320], 0.16)
}
