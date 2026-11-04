import type { ResistenciaExtra } from './itemMods'

// Ritual que já mexe na ficha quando conjurado (pedido da Millie, 04/11). Por enquanto, a Tela de Ruído:
// "30 PV temporários, mas apenas contra dano balístico, de corte, de impacto ou de perfuração. Ou,
// como reação ao sofrer dano, resistência 15 apenas contra esse dano." Discente: 60 e 30.
// O Verdadeiro cria uma esfera na mesa, sem efeito na ficha.

export const TIPOS_DA_TELA_DE_RUIDO = ['balistico', 'corte', 'impacto', 'perfuracao']
export const ORIGEM_TELA_DE_RUIDO = 'Tela de Ruído'

export type EscolhaDaTela = 'pelicula' | 'reacao'

const nomeNormal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function efeitoDaTelaDeRuido(nomeDoRitual: string, modo: string): { pvTemp: number; resistencia: number } | null {
  if (nomeNormal(nomeDoRitual) !== 'tela de ruido') return null
  if (modo === 'normal') return { pvTemp: 30, resistencia: 15 }
  if (modo === 'discente') return { pvTemp: 60, resistencia: 30 }
  return null
}

// PV temporários não somam: fica o maior. Se o que a pessoa já tem é maior, a película não muda nada.
export function camposDaPelicula(tempAtual: number | null | undefined, pvTemp: number): { temp_pv: number; temp_pv_tipos: string[] } | null {
  if ((tempAtual ?? 0) >= pvTemp) return null
  return { temp_pv: pvTemp, temp_pv_tipos: TIPOS_DA_TELA_DE_RUIDO }
}

// Reação: resistência contra o próximo dano, que some sozinha depois dele. Conjurar de novo troca a anterior.
export function extrasDaReacao(extras: ResistenciaExtra[], valor: number, id: string): ResistenciaExtra[] {
  return [
    ...extras.filter((e) => !(e.umaVez && e.origem === ORIGEM_TELA_DE_RUIDO)),
    { id, tipo: 'Dano', valor, temporaria: true, umaVez: true, origem: ORIGEM_TELA_DE_RUIDO },
  ]
}
