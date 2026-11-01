import { useEffect, useRef } from 'react'
import { COR_PADRAO_CLIMA } from './cenas'

// Névoa da cena em vídeo (pedido da Millie, 01/11: "nem dá pra perceber"), por cima do mapa e dos tokens.
// O vídeo tem fundo preto: no modo "tela" o preto some e só a fumaça clara fica. São duas cópias
// defasadas, uma aparecendo enquanto a outra some, pra não dar pra ver o corte quando ele recomeça.
const VIDEO_NEVOA = '/efeitos/nevoa.mp4'
const RITMO = 0.6

export default function NevoaNaTela({ cor }: { cor?: string | null }) {
  const a = useRef<HTMLVideoElement>(null)
  const b = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const videos = [a.current, b.current].filter((v): v is HTMLVideoElement => !!v)
    let raf = 0
    const defasar = () => {
      for (const v of videos) v.playbackRate = RITMO
      if (b.current && b.current.duration) b.current.currentTime = b.current.duration / 2
    }
    if (b.current?.readyState) defasar()
    else b.current?.addEventListener('loadedmetadata', defasar, { once: true })
    const quadro = () => {
      for (const v of videos) {
        // Some nas duas pontas do vídeo; as duas cópias somadas dão sempre a mesma força.
        if (v.duration) v.style.opacity = (Math.sin((Math.PI * v.currentTime) / v.duration) ** 2).toFixed(3)
      }
      raf = requestAnimationFrame(quadro)
    }
    raf = requestAnimationFrame(quadro)
    // O navegador pausa vídeo mudo com a aba escondida: ao voltar, segue tocando.
    const voltar = () => {
      if (!document.hidden) for (const v of videos) v.play().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', voltar)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', voltar)
      b.current?.removeEventListener('loadedmetadata', defasar)
    }
  }, [])

  return (
    <div className="mesa-nevoa" aria-hidden>
      <video ref={a} src={VIDEO_NEVOA} autoPlay loop muted playsInline disablePictureInPicture />
      <video ref={b} src={VIDEO_NEVOA} className="espelhado" autoPlay loop muted playsInline disablePictureInPicture />
      {/* A cor que o mestre escolheu para o efeito tinge a fumaça. */}
      <div className="mesa-nevoa-cor" style={{ background: cor || COR_PADRAO_CLIMA.nevoa || '#d7dae1' }} />
    </div>
  )
}
