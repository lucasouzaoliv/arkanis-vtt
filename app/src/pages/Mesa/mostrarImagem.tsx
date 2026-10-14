// Ver a imagem ampliada e "Mostrar para todos" (pedido da Millie, 14/10): botão direito em token,
// item, personagem, posicionável ou documento abre a imagem numa janela no meio da tela, que dá
// pra arrastar e fechar. "Mostrar para todos" abre a mesma janela na tela de todo mundo da mesa
// (pelo canal ao vivo, sem gravar nada). Vale também pra foto mandada no celular.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { faEye, faImage, faTowerBroadcast } from '@fortawesome/free-solid-svg-icons'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import Janela from './Janela'
import type { ItemMenu } from './MenuContexto'

type Imagem = { id: string; url: string; titulo: string; por?: string }

export type MostrarImagem = {
  /** Abre só pra mim. */
  ver: (url: string, titulo?: string | null) => void
  /** Abre pra todo mundo da mesa (e pra mim). */
  mostrarParaTodos: (url: string, titulo?: string | null) => void
}

export const MostrarImagemContexto = createContext<MostrarImagem | null>(null)

export function useMostrarImagem(): MostrarImagem | null {
  return useContext(MostrarImagemContexto)
}

// As duas opções do botão direito, pra quem tem imagem.
export function itensDeImagem(m: MostrarImagem | null, url: string | null | undefined, titulo?: string | null): ItemMenu[] {
  if (!m || !url) return []
  return [
    { tipo: 'linha' },
    { rotulo: 'Ver Imagem', icone: faEye, onClick: () => m.ver(url, titulo) },
    { rotulo: 'Mostrar para Todos', icone: faTowerBroadcast, onClick: () => m.mostrarParaTodos(url, titulo) },
  ]
}

// Janela no meio da tela, do tamanho que a imagem pede (sem passar da tela).
function JanelaDaImagem({ img, onFechar, deslocamento }: { img: Imagem; onFechar: () => void; deslocamento: number }) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const maxW = Math.max(240, window.innerWidth * 0.8)
  const maxH = Math.max(200, window.innerHeight * 0.78 - 50)
  const k = nat ? Math.min(1, maxW / nat.w, maxH / nat.h) : 1
  const largura = nat ? Math.max(260, Math.round(nat.w * k) + 2) : 420
  const inicial = { x: Math.max(16, (window.innerWidth - largura) / 2) + deslocamento, y: Math.max(16, (window.innerHeight - (nat ? nat.h * k + 50 : 360)) / 2) + deslocamento }
  return (
    <Janela key={nat ? 'pronta' : 'carregando'} titulo={img.por ? `${img.titulo} · mostrado por ${img.por}` : img.titulo} icone={faImage} largura={largura} inicial={inicial} onFechar={onFechar} className="janela-imagem-mostrada">
      <img
        src={img.url}
        alt={img.titulo}
        className="imagem-mostrada"
        style={nat ? { width: Math.round(nat.w * k), height: Math.round(nat.h * k) } : undefined}
        onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth || 400, h: e.currentTarget.naturalHeight || 300 })}
        draggable={false}
      />
    </Janela>
  )
}

export function ImagensMostradas({ campanhaId, nome, children }: { campanhaId: string; nome: string; children: ReactNode }) {
  const [abertas, setAbertas] = useState<Imagem[]>([])
  const canal = useRef<RealtimeChannel | null>(null)

  const abrir = useCallback((img: Imagem) => {
    setAbertas((l) => [...l.filter((x) => x.url !== img.url), img].slice(-4))
  }, [])

  useEffect(() => {
    const c = supabase
      .channel(`imagens:${campanhaId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'mostrar' }, ({ payload }) => {
        const p = payload as Partial<Imagem>
        if (typeof p.url === 'string' && p.url) abrir({ id: crypto.randomUUID(), url: p.url, titulo: String(p.titulo || 'Imagem'), por: p.por })
      })
      .subscribe()
    canal.current = c
    return () => { supabase.removeChannel(c); canal.current = null }
  }, [campanhaId, abrir])

  const valor = useMemo<MostrarImagem>(() => ({
    ver: (url, titulo) => abrir({ id: crypto.randomUUID(), url, titulo: titulo || 'Imagem' }),
    mostrarParaTodos: (url, titulo) => {
      const t = titulo || 'Imagem'
      abrir({ id: crypto.randomUUID(), url, titulo: t })
      void canal.current?.send({ type: 'broadcast', event: 'mostrar', payload: { url, titulo: t, por: nome } })
    },
  }), [abrir, nome])

  return (
    <MostrarImagemContexto.Provider value={valor}>
      {children}
      {abertas.map((img, i) => (
        <JanelaDaImagem key={img.id} img={img} deslocamento={i * 24} onFechar={() => setAbertas((l) => l.filter((x) => x.id !== img.id))} />
      ))}
    </MostrarImagemContexto.Provider>
  )
}
