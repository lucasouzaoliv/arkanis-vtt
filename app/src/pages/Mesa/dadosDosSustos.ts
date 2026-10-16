// Jump scare (pedido da Millie, 16/10). Os sustos ficam guardados (só o mestre vê); quando ele aperta,
// o susto vai pela mesa ao vivo e aparece em tela cheia, com som, em quem ele escolheu.
import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { efeitosMudos, lerVolumes } from './volumesDoUsuario'

export type Efeito = 'pulo' | 'zoom' | 'piscar'
export type TipoDeSom = 'pronto' | 'arquivo' | 'youtube' | 'nenhum'

export type Susto = {
  id: string
  campaign_id: string
  nome: string
  midia_url: string | null
  midia_tipo: 'imagem' | 'video'
  som_tipo: TipoDeSom
  som: string | null
  som_inicio: number
  efeito: Efeito
  duracao: number
  tremor: boolean
  created_at: string
}

/** O que vai pela mesa: o susto e pra quem (nulo = todo mundo menos o mestre). */
export type SustoDisparado = Pick<Susto, 'midia_url' | 'midia_tipo' | 'som_tipo' | 'som' | 'som_inicio' | 'efeito' | 'duracao' | 'tremor'> & { id: string; alvos: string[] | null }

const erroDe = (e: { message?: string } | null) => (e ? e.message || 'Não deu certo.' : null)

// ---- Banco ----

export async function sustosDa(campanhaId: string): Promise<Susto[]> {
  const { data } = await supabase.from('sustos').select('*').eq('campaign_id', campanhaId).order('created_at', { ascending: false })
  return ((data ?? []) as Susto[]).map((s) => ({ ...s, duracao: Number(s.duracao) }))
}

export async function salvarSusto(s: Omit<Susto, 'id' | 'created_at'> & { id?: string }): Promise<string | null> {
  const { id, ...campos } = s
  const { error } = id
    ? await supabase.from('sustos').update(campos).eq('id', id)
    : await supabase.from('sustos').insert(campos)
  return erroDe(error)
}

export async function apagarSusto(id: string): Promise<string | null> {
  const { error } = await supabase.from('sustos').delete().eq('id', id)
  return erroDe(error)
}

export async function enviarArquivoDeSusto(arquivo: File): Promise<{ url: string | null; erro: string | null }> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return { url: null, erro: 'Entre na sua conta.' }
  const caminho = `${u.user.id}/${Date.now()}-${arquivo.name.replace(/[^\w.-]/g, '_')}`
  const { error } = await supabase.storage.from('sustos').upload(caminho, arquivo)
  if (error) return { url: null, erro: erroDe(error) }
  return { url: supabase.storage.from('sustos').getPublicUrl(caminho).data.publicUrl, erro: null }
}

// ---- Ao vivo ----

// Ouve os sustos da mesa (todo mundo) e devolve a função de disparar (o mestre).
export function useCanalDeSustos(campanhaId: string, userId: string | null, aoChegar: (s: SustoDisparado) => void) {
  const canal = useRef<RealtimeChannel | null>(null)
  const chegar = useRef(aoChegar)
  chegar.current = aoChegar
  useEffect(() => {
    const c = supabase
      .channel(`sustos:${campanhaId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'susto' }, ({ payload }) => {
        const s = payload as SustoDisparado
        if (!s || (s.alvos && userId && !s.alvos.includes(userId))) return
        chegar.current(s)
      })
      .subscribe()
    canal.current = c
    return () => { supabase.removeChannel(c); canal.current = null }
  }, [campanhaId, userId])
  return (s: SustoDisparado) => { void canal.current?.send({ type: 'broadcast', event: 'susto', payload: s }) }
}

// ---- YouTube (só o áudio) ----

export function idDoYoutube(url: string | null | undefined): string | null {
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i.exec(url ?? '')
  return m ? m[1] : null
}

// Começo no link (?t=90 ou &t=1m30s) vira o segundo de início.
export function inicioDoYoutube(url: string): number {
  const m = /[?&](?:t|start)=(\d+h)?(\d+m)?(\d+)s?/i.exec(url)
  if (!m) return 0
  return (parseInt(m[1] ?? '0') || 0) * 3600 + (parseInt(m[2] ?? '0') || 0) * 60 + (parseInt(m[3] ?? '0') || 0)
}

// ---- Sons prontos (feitos na hora, sem arquivo) ----

export const SONS_PRONTOS: { id: string; nome: string }[] = [
  { id: 'grito', nome: 'Grito' },
  { id: 'violino', nome: 'Violino agudo' },
  { id: 'estrondo', nome: 'Estrondo' },
  { id: 'pancada', nome: 'Pancada metálica' },
  { id: 'estatica', nome: 'Estática' },
]

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

export function volumeDoSusto(): number {
  // Susto tem que ser alto: o volume de Efeitos da pessoa, sem deixar sumir.
  return efeitosMudos() ? 0 : Math.max(0.35, lerVolumes().efeitos)
}

function ruido(c: AudioContext, segundos: number): AudioBufferSourceNode {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * segundos), c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const s = c.createBufferSource()
  s.buffer = b
  return s
}

function distorcao(c: AudioContext, k = 40): WaveShaperNode {
  const w = c.createWaveShaper()
  const n = 1024
  const curva = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curva[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)) }
  w.curve = curva
  return w
}

// Toca o som pronto e devolve o "parar".
export function tocarSomPronto(id: string, nivel = volumeDoSusto()): () => void {
  const c = contexto()
  if (!c || nivel <= 0) return () => {}
  const t = c.currentTime + 0.01
  const saida = c.createGain()
  saida.gain.value = nivel
  saida.connect(c.destination)
  const fontes: AudioScheduledSourceNode[] = []
  const env = (g: GainNode, ataque: number, pico: number, fim: number) => {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(pico, t + ataque)
    g.gain.exponentialRampToValueAtTime(0.0001, t + fim)
  }

  if (id === 'grito') {
    // Guincho que sobe, com ruído chiando por cima.
    const d = distorcao(c, 60)
    const g = c.createGain()
    env(g, 0.02, 0.9, 1.7)
    d.connect(g).connect(saida)
    for (const [base, alvo] of [[620, 1500], [930, 2100]]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(base, t)
      o.frequency.exponentialRampToValueAtTime(alvo, t + 0.35)
      o.frequency.exponentialRampToValueAtTime(alvo * 0.8, t + 1.6)
      const vib = c.createOscillator()
      const vg = c.createGain()
      vib.frequency.value = 18
      vg.gain.value = 60
      vib.connect(vg).connect(o.frequency)
      o.connect(d)
      o.start(t); o.stop(t + 1.8); vib.start(t); vib.stop(t + 1.8)
      fontes.push(o, vib)
    }
    const n = ruido(c, 1.8)
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(1200, t)
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.5)
    const ng = c.createGain()
    env(ng, 0.01, 0.6, 1.5)
    n.connect(f).connect(ng).connect(saida)
    n.start(t)
    fontes.push(n)
  } else if (id === 'violino') {
    // Quatro notas agudas e desafinadas, em golpes rápidos.
    const freqs = [1046, 1108, 1174, 1244]
    for (let golpe = 0; golpe < 5; golpe++) {
      const ini = t + golpe * 0.28
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, ini)
      g.gain.exponentialRampToValueAtTime(0.5, ini + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, ini + 0.26)
      const f = c.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = 700
      g.connect(f).connect(saida)
      for (const fr of freqs) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(fr * (1 + golpe * 0.01), ini)
        o.connect(g)
        o.start(ini); o.stop(ini + 0.27)
        fontes.push(o)
      }
    }
  } else if (id === 'estrondo') {
    // Grave que cai, com uma rajada de ruído abafado.
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(90, t)
    o.frequency.exponentialRampToValueAtTime(28, t + 1.6)
    const g = c.createGain()
    env(g, 0.01, 1, 2)
    o.connect(distorcao(c, 20)).connect(g).connect(saida)
    o.start(t); o.stop(t + 2)
    const n = ruido(c, 1.4)
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(1800, t)
    f.frequency.exponentialRampToValueAtTime(120, t + 1.2)
    const ng = c.createGain()
    env(ng, 0.005, 0.9, 1.3)
    n.connect(f).connect(ng).connect(saida)
    n.start(t)
    fontes.push(o, n)
  } else if (id === 'pancada') {
    // Batida seca e um metal ressoando, desafinado.
    const n = ruido(c, 0.15)
    const ng = c.createGain()
    env(ng, 0.002, 1, 0.14)
    n.connect(ng).connect(saida)
    n.start(t)
    fontes.push(n)
    for (const [fr, vol] of [[220, 0.5], [347, 0.35], [513, 0.3], [781, 0.2], [1187, 0.15]]) {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.value = fr
      const g = c.createGain()
      env(g, 0.003, vol, 2.2)
      o.connect(g).connect(saida)
      o.start(t); o.stop(t + 2.3)
      fontes.push(o)
    }
  } else {
    // Estática: chiado alto que corta e volta.
    const n = ruido(c, 1.6)
    const g = c.createGain()
    g.gain.setValueAtTime(0.9, t)
    for (let i = 1; i < 12; i++) g.gain.setValueAtTime(Math.random() > 0.35 ? 0.9 : 0.05, t + i * 0.12)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    n.connect(distorcao(c, 30)).connect(g).connect(saida)
    n.start(t)
    fontes.push(n)
  }

  return () => {
    for (const f of fontes) { try { f.stop() } catch { /* já parou */ } }
    saida.disconnect()
  }
}
