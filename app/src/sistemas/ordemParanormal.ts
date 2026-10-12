// Adaptador do Ordem Paranormal pra mesa (ver tipos.ts).
import { supabase } from '../lib/supabase'
import { attrValue, rollAttributeTest, trainingBonus, type Attributes, type Training } from '../lib/rules'
import { PERICIAS } from '../pages/CharacterSheet/itemMods'
import { penalidadeDeCondicoes } from '../pages/CharacterSheet/condicoes'
import type { EntradaCompendio, Sistema } from './tipos'
import { TIPOS_DE_DANO } from '../lib/tiposDeDano'

export const ATRIBUTOS_OP = [
  { id: 'agilidade', rotulo: 'Agilidade' },
  { id: 'forca', rotulo: 'Força' },
  { id: 'intelecto', rotulo: 'Intelecto' },
  { id: 'presenca', rotulo: 'Presença' },
  { id: 'vigor', rotulo: 'Vigor' },
]

export const ordemParanormal: Sistema = {
  id: 'ordem_paranormal',
  nome: 'Ordem Paranormal',
  pericias: PERICIAS,
  atributos: ATRIBUTOS_OP,
  // Livro: curto 9 m, médio 18 m, longo 36 m, extremo 90 m; toque = quadrado vizinho (1,5 m).
  alcances: [
    { id: 'pessoal', rotulo: 'Pessoal', metros: null },
    { id: 'toque', rotulo: 'Toque', metros: 1.5 },
    { id: 'curto', rotulo: 'Curto (9 m)', metros: 9 },
    { id: 'medio', rotulo: 'Médio (18 m)', metros: 18 },
    { id: 'longo', rotulo: 'Longo (36 m)', metros: 36 },
    { id: 'extremo', rotulo: 'Extremo (90 m)', metros: 90 },
    { id: 'ilimitado', rotulo: 'Ilimitado', metros: null },
  ],
  tiposDeDano: TIPOS_DE_DANO,
  recursos: [
    { id: 'pv', rotulo: 'PV' },
    { id: 'san', rotulo: 'Sanidade' },
    { id: 'pe', rotulo: 'PE' },
  ],
  magia: { nome: 'Ritual', tabela: 'rituals' },
  categoriasDeItem: ['0', 'I', 'II', 'III', 'IV'],

  // Teste do OP: d20 por ponto de atributo (fica o maior) + bônus do treino da perícia, com as
  // penalidades das condições (a mesma conta da ficha).
  async testeDoPersonagem(characterId, pericia, atributo) {
    const { data: ficha } = await supabase.from('characters').select('attributes, conditions').eq('id', characterId).maybeSingle()
    if (!ficha) return null
    let attr = atributo || null
    let bonus = 0
    if (pericia) {
      const { data: skill } = await supabase.from('skills').select('id, default_attribute').eq('name', pericia).maybeSingle()
      if (skill) {
        const { data: treino } = await supabase.from('character_skills').select('training, extra_bonus, attribute_override').eq('character_id', characterId).eq('skill_id', skill.id).maybeSingle()
        attr = atributo || treino?.attribute_override || skill.default_attribute
        bonus = trainingBonus((treino?.training ?? 'nenhum') as Training) + (treino?.extra_bonus ?? 0)
      }
    }
    const cond = penalidadeDeCondicoes(ficha.conditions as string[] | null, { atributo: attr ?? '', pericia })
    const nome = pericia || ATRIBUTOS_OP.find((a) => a.id === attr)?.rotulo || 'Teste'
    return { nome, dados: attrValue(ficha.attributes as Attributes, attr) + cond.dados, bonus }
  },

  moeda: { nome: 'Dinheiro', simbolo: 'R$' },

  compendio: {
    nome: 'Equipamentos',
    tipos: [
      { id: 'arma', rotulo: 'Arma' },
      { id: 'municao', rotulo: 'Munição' },
      { id: 'protecao', rotulo: 'Proteção' },
      { id: 'geral', rotulo: 'Geral' },
      { id: 'paranormal', rotulo: 'Paranormal' },
    ],
    // Sem filtro, as 60 primeiras; com tipo/categoria, tudo daquele filtro (pro "Marcar todos").
    async buscar(termo, tipo, categoria) {
      let q = supabase.from('equipment_items').select('id, name, type, category, spaces, description, image_url').order('name').limit(tipo || categoria ? 500 : 60)
      if (termo.trim()) q = q.ilike('name', `%${termo.trim()}%`)
      if (tipo) q = q.eq('type', tipo)
      if (categoria) q = q.eq('category', categoria)
      const { data } = await q
      return ((data ?? []) as { id: string; name: string; type: string; category: string; spaces: number; description: string | null; image_url: string | null }[]).map(
        (e): EntradaCompendio => ({ id: e.id, nome: e.name, tipo: e.type, categoria: e.category, carga: Number(e.spaces) || 0, descricao: e.description ?? '', imagem: e.image_url }),
      )
    },
  },

  rolarTeste({ dados, bonus }) {
    const { rolls, kept } = rollAttributeTest(dados)
    return { rolls, kept, bonus, total: kept + bonus }
  },
}
