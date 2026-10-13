// Sonoplastia (pedido da Millie, 06/10; arquivos que ela trouxe, em public/sons). Cada som toca no
// volume de Efeitos Sonoros da pessoa (Lista de Reprodução → Controles de Volume de Usuário).
import { efeitosMudos, lerVolumes } from '../pages/Mesa/volumesDoUsuario'
import { SONS_DE_ARMA, somDaArma, ehSomDeArma } from './somDasArmas'

export const SONS = {
  dado: 'dado.mp3', // dados caindo
  virar: 'virar-cartao.mp3', // virar o cartão de rolagem
  aba: 'abrir.mp3', // trocar de aba
  clique: 'abrir.mp3', // qualquer clique em botão (máquina de escrever): diminuir vida, adicionar…
  abrir: 'abrir.mp3', // abrir janela/módulo
  fechar: 'fechar.mp3', // fechar janela/módulo ("desligando áudio")
  parar: 'fechar.mp3', // desligar um som da Lista de Reprodução
  check: 'check.mp3', // marcar uma caixinha
  escrever: 'escrever.mp3', // mandar mensagem, salvar nota
  criar: 'pagina-nova.mp3', // criar item, nota, pasta
  deletar: 'deletar.mp3', // excluir
  'ritual-sangue': 'ritual-sangue.mp3',
  'ritual-morte': 'ritual-morte.mp3',
  'ritual-conhecimento': 'ritual-conhecimento.mp3',
  'ritual-energia': 'ritual-energia.mp3',
  'ritual-medo': 'ritual-medo.mp3',
} as const

export type Som = keyof typeof SONS

// Sons de interface (clique, abas, janelas, caixinhas, criar/apagar…) são só da ficha (pedido da
// Millie: na mesa não). Na mesa ficam só o dado rolando e o som da arma.
const SO_NA_FICHA = new Set<Som>(['clique', 'aba', 'abrir', 'fechar', 'parar', 'check', 'escrever', 'criar', 'deletar'])

// A ficha do personagem (sozinha ou aberta dentro da mesa, que usa o mesmo endereço).
export function naFicha(): boolean {
  return /^\/personagem\/(?!criar(\/|$))[^/]+\/?$/.test(window.location.pathname)
}

// O mesmo som disparado várias vezes no mesmo instante (ex.: excluir 5 tokens) toca uma vez só.
const ultimo: Partial<Record<Som, number>> = {}
// Quando tocou o último som (qualquer um): o clique genérico não toca por cima de um som próprio.
let ultimoQualquer = -1e9
export function tocouDesde(t: number): boolean {
  return ultimoQualquer >= t
}

// Os arquivos vêm com volumes muito diferentes (os cliques chegam a ser 40x mais baixos que o
// dado) e o <audio> do navegador para em 100%. Então cada som é normalizado: ao carregar, mede o
// pico e ganha o reforço que falta pra chegar em PICO_ALVO; depois passa por um limitador, pra
// não estourar (pedido da Millie: os sons estavam muito baixinhos).
export const PICO_ALVO = 0.9
const REFORCO_MAXIMO = 60

let contexto: AudioContext | null = null
let saida: AudioNode | null = null
const buffers = new Map<string, Promise<{ buffer: AudioBuffer; reforco: number } | null>>()

// Quanto multiplicar pra o pico chegar no alvo (sem passar do reforço máximo).
export function reforcoDoPico(pico: number): number {
  if (pico <= 0) return 1
  return Math.min(REFORCO_MAXIMO, Math.max(1, PICO_ALVO / pico))
}

function audio(): { ctx: AudioContext; saida: AudioNode } | null {
  try {
    if (!contexto) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      contexto = new Ctx()
      const limitador = contexto.createDynamicsCompressor()
      limitador.threshold.value = -3
      limitador.knee.value = 0
      limitador.ratio.value = 20
      limitador.attack.value = 0.002
      limitador.release.value = 0.12
      limitador.connect(contexto.destination)
      saida = limitador
      // Já deixa todos os sons carregados (o primeiro clique não fica atrasado).
      for (const arquivo of new Set(Object.values(SONS))) carregar(contexto, arquivo)
    }
    if (contexto.state === 'suspended') contexto.resume().catch(() => null)
    return { ctx: contexto, saida: saida! }
  } catch {
    return null
  }
}

function carregar(ctx: AudioContext, arquivo: string): Promise<{ buffer: AudioBuffer; reforco: number } | null> {
  let b = buffers.get(arquivo)
  if (!b) {
    b = fetch(`/sons/${arquivo}`)
      .then((r) => r.arrayBuffer())
      .then((d) => ctx.decodeAudioData(d))
      .then((buffer) => {
        let pico = 0
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const dados = buffer.getChannelData(c)
          for (let i = 0; i < dados.length; i++) pico = Math.max(pico, Math.abs(dados[i]))
        }
        return { buffer, reforco: reforcoDoPico(pico) }
      })
      .catch(() => null)
    buffers.set(arquivo, b)
  }
  return b
}

export function tocarSom(som: Som) {
  if (SO_NA_FICHA.has(som) && !naFicha()) return
  const volume = efeitosMudos() ? 0 : lerVolumes().efeitos
  if (volume <= 0) return
  const agora = performance.now()
  if ((ultimo[som] ?? -1e9) > agora - 90) return
  ultimo[som] = agora
  ultimoQualquer = agora
  const a = audio()
  if (!a) return
  tocarArquivo(a, SONS[som], volume)
}

// Toca um arquivo (normalizado). Com maxSegundos, corta ali, sumindo devagar no fim.
function tocarArquivo(a: { ctx: AudioContext; saida: AudioNode }, arquivo: string, volume: number, maxSegundos?: number) {
  carregar(a.ctx, arquivo).then((s) => {
    if (!s) return
    const fonte = a.ctx.createBufferSource()
    fonte.buffer = s.buffer
    const ganho = a.ctx.createGain()
    const v = volume * s.reforco
    ganho.gain.value = v
    fonte.connect(ganho).connect(a.saida)
    const agora = a.ctx.currentTime
    fonte.start(agora)
    if (maxSegundos && s.buffer.duration > maxSegundos) {
      ganho.gain.setValueAtTime(v, agora + maxSegundos - 0.5)
      ganho.gain.linearRampToValueAtTime(0.0001, agora + maxSegundos)
      fonte.stop(agora + maxSegundos + 0.05)
    }
  })
}

// Som da arma no ataque (pelo nome do ataque; nome próprio cai pelo tipo de dano). Os arquivos
// longos (rajada, lança-chamas) param em ~3 s.
export function tocarSomDeArma(nome: string | null | undefined, tipoDano?: string | null, som?: string | null) {
  // A ficha já manda o som escolhido (pelo nome do ataque ou da arma de origem).
  const arma = ehSomDeArma(som) ? som : somDaArma(nome, tipoDano)
  if (!arma) return
  const volume = efeitosMudos() ? 0 : lerVolumes().efeitos
  if (volume <= 0) return
  const a = audio()
  if (!a) return
  ultimoQualquer = performance.now()
  tocarArquivo(a, SONS_DE_ARMA[arma], volume, 3)
}

// "Sangue" → ritual-sangue (Medo, Morte, Conhecimento, Energia). Sem elemento conhecido, nada.
export function somDoRitual(elemento: string | null | undefined): Som | null {
  const e = (elemento ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const s = `ritual-${e}` as Som
  return s in SONS ? s : null
}

// Ficha aberta dentro da mesa (janela portátil): quem toca o dado é a mesa, junto com os dados 3D.
export function dentroDaMesa(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

// Liga os sons de interface da ficha (pedido da Millie, 06/10; na mesa e no resto do site não):
// * toda janelinha que abre (os fundos escuros "...-backdrop" da ficha e as janelas da mesa)
//   toca "abrir" e, ao sumir, "fechar" — inclusive as que forem criadas depois;
// * todo clique em botão toca a máquina de escrever, a não ser que o clique já tenha tocado um
//   som próprio (aba, virar cartão, ritual, abrir janela…);
// * marcar/desmarcar caixinha toca "check".
export function ligarSonsDoSite() {
  const ehModulo = (n: Node): boolean => n instanceof HTMLElement && (/(^|\s)[\w-]*backdrop(\s|$)/.test(n.className) || n.classList.contains('janela'))
  const temModulo = (n: Node): boolean => ehModulo(n) || (n instanceof HTMLElement && !!n.querySelector('[class*="backdrop"], .janela'))
  new MutationObserver((mudancas) => {
    let abriu = false
    let fechou = false
    for (const m of mudancas) {
      m.addedNodes.forEach((n) => { if (temModulo(n)) abriu = true })
      m.removedNodes.forEach((n) => { if (temModulo(n)) fechou = true })
    }
    if (!naFicha()) return
    if (abriu) tocarSom('abrir')
    else if (fechou) tocarSom('fechar')
  }).observe(document.body, { childList: true, subtree: true })

  document.addEventListener('click', (e) => {
    if (!naFicha()) return
    const alvo = e.target instanceof Element ? e.target.closest('button, [role="button"], [role="tab"], summary') : null
    if (!alvo || (alvo as HTMLButtonElement).disabled || alvo.closest('[data-sem-som]')) return
    const quando = performance.now()
    // Espera o clique terminar: se ele mesmo tocou um som (ou abriu/fechou uma janela), fica só esse.
    setTimeout(() => { if (!tocouDesde(quando)) tocarSom('clique') }, 30)
  }, true)

  document.addEventListener('change', (e) => {
    const t = e.target
    if (t instanceof HTMLInputElement && t.type === 'checkbox') tocarSom('check')
  }, true)
}
