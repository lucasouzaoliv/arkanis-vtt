// Adaptador do Ordem Paranormal 2 (playtest) pra mesa (ver tipos.ts). A mesa é a mesma do Ordem 1;
// aqui fica o que muda: perícias e atributos do OP2, PV e PD no lugar de PV/Sanidade/PE, e o teste
// com os dados em passos (atributo + perícia) no lugar do d20.
import { supabase } from '../lib/supabase'
import { ATRIBUTOS, CENARIOS, nomeDaLinha, type Atributo } from './op2/cenarios'
import { passo, rolarTeste, type Dado } from './op2/dados'
import { MODIFICADORES_PADRAO, type FichaOP2 } from './op2/ficha'
import type { Sistema } from './tipos'

export const ID_OP2 = 'ordem_paranormal_2'

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Todas as perícias dos dois cenários, com os campos ("Aptidão (Artes)"), sem repetir.
const PERICIAS_OP2 = [...new Set(Object.values(CENARIOS).flatMap((c) => c.pericias.flatMap((p) => (p.campos ? [p.nome, ...p.campos.map((campo) => `${p.nome} (${campo})`)] : [p.nome]))))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

export const ordemParanormal2: Sistema = {
  id: ID_OP2,
  nome: 'Ordem Paranormal 2',
  pericias: PERICIAS_OP2,
  atributos: ATRIBUTOS.map((a) => ({ id: a.id, rotulo: a.nome })),
  // Playtest: só fala em alcance curto e longo; as distâncias seguem as do Ordem 1.
  alcances: [
    { id: 'pessoal', rotulo: 'Pessoal', metros: null },
    { id: 'toque', rotulo: 'Toque', metros: 1.5 },
    { id: 'curto', rotulo: 'Curto (9 m)', metros: 9 },
    { id: 'longo', rotulo: 'Longo (36 m)', metros: 36 },
    { id: 'ilimitado', rotulo: 'Ilimitado', metros: null },
  ],
  // Dano físico tira PV; dano emocional tira PD (entra na mesa como "mental").
  tiposDeDano: [
    { id: 'fisico', rotulo: 'Físico' },
    { id: 'mental', rotulo: 'Emocional' },
    { id: 'impacto', rotulo: 'Impacto' },
    { id: 'corte', rotulo: 'Corte' },
    { id: 'perfuracao', rotulo: 'Perfuração' },
    { id: 'balistico', rotulo: 'Balístico' },
    { id: 'fogo', rotulo: 'Fogo' },
  ],
  // Na mesa, o PD usa o lugar da Sanidade (o banco mantém os dois iguais nas fichas de OP2).
  recursos: [
    { id: 'pv', rotulo: 'PV' },
    { id: 'san', rotulo: 'PD' },
  ],
  magia: { nome: 'Ritual', tabela: 'rituals' },
  categoriasDeItem: [],
  moeda: { nome: 'Dinheiro', simbolo: 'R$' },
  compendio: null,

  // Teste do OP2: dado do atributo + dado da perícia (com os passos e dados bônus ligados na ficha).
  async testeDoPersonagem(characterId, pericia, atributo) {
    const { data } = await supabase.from('characters').select('op2').eq('id', characterId).maybeSingle()
    const op2 = data?.op2 as FichaOP2 | null | undefined
    if (!op2) return null
    const mods = { ...MODIFICADORES_PADRAO, ...op2.modificadores }
    const linha = pericia ? op2.pericias.find((l) => semAcento(nomeDaLinha(op2.cenario, l)) === semAcento(pericia)) ?? op2.pericias.find((l) => semAcento(nomeDaLinha(op2.cenario, { pericia: l.pericia })) === semAcento(pericia)) : undefined
    const atr = ((atributo && atributo in op2.atributos ? atributo : linha?.atributo) ?? 'fisico') as Atributo
    const dadoDoAtributo: Dado = (!atributo && linha?.dadoDoAtributo) || op2.atributos[atr]
    const nome = pericia || ATRIBUTOS.find((a) => a.id === atr)?.nome || 'Teste'
    return {
      nome,
      dados: 1,
      bonus: 0,
      rolar: () => {
        const r = rolarTeste({
          atributo: dadoDoAtributo,
          ...(linha ? { pericia: passo(linha.dado, mods.passos) } : {}),
          bonus: mods.bonus.filter((d): d is Dado => d !== null),
          pavor: mods.pavorAtivo || mods.pavorComoBonus ? mods.pavor : null,
          pavorComoBonus: mods.pavorComoBonus,
        })
        return { rolls: r.dados.map((d) => d.valor), kept: r.total, bonus: 0, total: r.total }
      },
    }
  },

  // Sem ficha (mestre testando): um d6 de atributo e um d4 de perícia.
  rolarTeste() {
    const r = rolarTeste({ atributo: 6, pericia: 4, bonus: [], pavor: null, pavorComoBonus: false })
    return { rolls: r.dados.map((d) => d.valor), kept: r.total, bonus: 0, total: r.total }
  },
}
