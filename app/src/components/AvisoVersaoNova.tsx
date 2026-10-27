import { useEffect, useState } from 'react'

// Saiu versão nova do site com a aba aberta (pedido da Millie, 08/10: os amigos ficavam com a
// versão velha e os bugs já corrigidos continuavam). A cada poucos minutos confere o arquivo
// principal do site; se mudou, mostra um aviso com o botão de atualizar.
const INTERVALO = 60_000 // 1 min (era 3, demorava; 27/10)

function scriptAtual(html: string): string | null {
  return /\/assets\/index-[\w-]+\.js/.exec(html)?.[0] ?? null
}

export default function AvisoVersaoNova() {
  const [nova, setNova] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    const minha = [...document.scripts].map((s) => s.src).find((s) => /\/assets\/index-[\w-]+\.js/.test(s))
    if (!minha) return
    const conferir = async () => {
      try {
        const html = await (await fetch('/', { cache: 'no-store' })).text()
        const atual = scriptAtual(html)
        if (atual && !minha.endsWith(atual)) setNova(true)
      } catch {
        // sem internet agora: tenta de novo depois
      }
    }
    const t = window.setInterval(conferir, INTERVALO)
    const aoVoltar = () => document.visibilityState === 'visible' && conferir()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [])

  if (!nova) return null
  return (
    <div className="aviso-versao" role="status">
      <span>Tem uma versão nova do Arkanis.</span>
      <button type="button" onClick={() => window.location.reload()}>Atualizar</button>
      <button type="button" className="aviso-versao-fechar" aria-label="Depois" onClick={() => setNova(false)}>×</button>
    </div>
  )
}
