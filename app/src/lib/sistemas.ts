import cardOrdemParanormal from '../assets/backgrounds/card-ordem-paranormal.webp'
import cardOrdemParanormal2 from '../assets/backgrounds/card-ordem-paranormal-2.webp'

// Jogos disponíveis no Arkanis. A mesa é genérica; cada jogo traz a própria ficha.
// `slug` vai na URL da criação de personagem; `id` é o que a campanha guarda em `system`.
export const SISTEMAS = [
  {
    id: 'ordem_paranormal',
    slug: 'ordem-paranormal',
    name: 'Ordem Paranormal',
    description: 'Se torne um agente da Ordo Realitas, especializado em defender o nosso mundo das forças do Outro Lado.',
    version: 'Atualizado v0.1',
    image: cardOrdemParanormal,
  },
  {
    // Ordem Paranormal 2 (playtest): jogo novo, com ficha e regras próprias (src/sistemas/op2).
    id: 'ordem_paranormal_2',
    slug: 'ordem-paranormal-2',
    name: 'Ordem Paranormal 2',
    description: 'Crie sua ficha ou jogue com uma pronta com nossas fichas dedicadas para Ordem 2. Assim como o sistema, elas ainda estão em desenvolvimento, então muitas atualizações estão por vir!',
    version: 'Atualizado v0.1',
    image: cardOrdemParanormal2,
    botao: 'btn-pill-verde',
    // A mesa ainda não roda a ficha do OP2: sem campanha por enquanto.
    semCampanha: true,
  },
]
