import { chaveDaLinha, periciasVazias, type Atributo, type IdCenario, type LinhaDePericia } from './cenarios'
import type { Dado } from './dados'

// As 18 fichas prontas dos playtests (VTT_Conteudo_OP2_FichasProntas.md), copiadas como impressas.
// Perícias: só as acima do d4; chave "pericia" ou "pericia:Campo" (Aptidão e Ofício).
// ajustes: as linhas impressas com outro atributo e/ou outro segundo dado (Contos da Vigília, 7.4).

export type Perfil = 'executor' | 'analista' | 'vigilante'

export type Relacao = { nome: string; grau: 0 | 1 | 2 | 3; rotulo: string; texto: string }

export type FichaPronta = {
  id: string
  cenario: IdCenario
  ato?: 'ato1' | 'ato2'
  nome: string
  sobrenome?: string
  perfil: Perfil
  vocacao: string
  nivel: number
  atributos: Record<Atributo, Dado>
  pv: number
  pd: number
  pericias: Record<string, Dado>
  ajustes?: { chave: string; atributo?: Atributo; dadoDoAtributo?: Dado }[]
  habilidades: string[]
  equipamento?: string[]
  relacoes?: Relacao[]
  // Card da tela de seleção (pasta menu, 1210×484).
  card: string
}

const at = (fisico: Dado, mente: Dado, emocao: Dado): Record<Atributo, Dado> => ({ fisico, mente, emocao })
const r = (nome: string, grau: Relacao['grau'], rotulo: string, texto: string): Relacao => ({ nome, grau, rotulo, texto })

export const FICHAS_PRONTAS: FichaPronta[] = [
  // ---- Maldição do Ídolo de Pedra — Ato I (nível 2) ----
  {
    id: 'alan', cenario: 'maldicao', ato: 'ato1', nome: 'Alan', perfil: 'executor', vocacao: 'Cientista', nivel: 2,
    atributos: at(6, 8, 8), pv: 10, pd: 16, card: 'alan.png',
    pericias: { 'aptidao:Humanas': 6, crime: 6, disciplina: 6, enganacao: 6, percepcao: 8, pesquisar: 6, vigor: 6 },
    habilidades: ['foco-mental', 'impeto'],
  },
  {
    id: 'edgar', cenario: 'maldicao', ato: 'ato1', nome: 'Edgar', perfil: 'executor', vocacao: 'Operário', nivel: 2,
    atributos: at(10, 6, 6), pv: 18, pd: 10, card: 'edgar.png',
    pericias: { atletismo: 8, crime: 6, intimidar: 6, luta: 6, percepcao: 6, sobrevivencia: 6, vigor: 6 },
    habilidades: ['esforco-e-suor', 'impeto'],
  },
  {
    id: 'eloisa', cenario: 'maldicao', ato: 'ato1', nome: 'Eloísa', perfil: 'analista', vocacao: 'Artista', nivel: 2,
    atributos: at(8, 8, 6), pv: 12, pd: 14, card: 'eloisa.png',
    pericias: { acrobacia: 6, crime: 6, disciplina: 6, intuicao: 8, percepcao: 6, pesquisar: 6, tecnologia: 6 },
    habilidades: ['avaliacao', 'foco-emocional'],
  },
  {
    id: 'kenia', cenario: 'maldicao', ato: 'ato1', nome: 'Kênia', perfil: 'analista', vocacao: 'Profissional de Escritório', nivel: 2,
    atributos: at(6, 10, 6), pv: 12, pd: 12, card: 'kenia.png',
    pericias: { acrobacia: 6, 'aptidao:Atualidades': 6, atletismo: 6, disciplina: 6, intuicao: 6, percepcao: 6, pesquisar: 6, tecnologia: 8, vigor: 6 },
    habilidades: ['avaliacao', 'conhecimento-tecnico'],
  },
  {
    id: 'victor', cenario: 'maldicao', ato: 'ato1', nome: 'Victor', perfil: 'vigilante', vocacao: 'Professor', nivel: 2,
    atributos: at(8, 6, 8), pv: 14, pd: 14, card: 'victor.png',
    pericias: { 'aptidao:Humanas': 6, atletismo: 6, disciplina: 6, percepcao: 6, pesquisar: 8, vigor: 6 },
    habilidades: ['mentoria', 'prontidao'],
  },
  // ---- Maldição do Ídolo de Pedra — Ato II (nível 6) ----
  {
    id: 'amanda', cenario: 'maldicao', ato: 'ato2', nome: 'Amanda', perfil: 'analista', vocacao: 'Cientista', nivel: 6,
    atributos: at(8, 8, 8), pv: 26, pd: 26, card: 'amanda.png',
    pericias: { 'aptidao:Burocracia': 8, 'aptidao:Exatas': 8, crime: 6, disciplina: 6, enganacao: 6, intuicao: 8, maquinas: 6, medicina: 6, percepcao: 10, pesquisar: 10, tecnologia: 10 },
    habilidades: ['avaliacao', 'foco-mental-nivel-6', 'olhar-infalivel'],
  },
  {
    id: 'antonio', cenario: 'maldicao', ato: 'ato2', nome: 'Antônio', perfil: 'analista', vocacao: 'Professor', nivel: 6,
    atributos: at(6, 12, 6), pv: 24, pd: 24, card: 'antonio.png',
    pericias: { 'aptidao:Humanas': 10, 'aptidao:Burocracia': 8, crime: 8, disciplina: 10, enganacao: 8, furtividade: 6, intuicao: 8, ocultismo: 10, percepcao: 8, pontaria: 6, tecnologia: 6, vigor: 8 },
    habilidades: ['amor-pela-descoberta', 'avaliacao', 'mentoria'],
  },
  {
    id: 'heitor', cenario: 'maldicao', ato: 'ato2', nome: 'Heitor', perfil: 'executor', vocacao: 'Policial', nivel: 6,
    atributos: at(10, 6, 8), pv: 34, pd: 20, card: 'heitor.png',
    pericias: { 'aptidao:Tática': 8, atletismo: 10, disciplina: 6, intimidar: 6, luta: 10, percepcao: 10, pesquisar: 6, pontaria: 8, vigor: 8 },
    habilidades: ['impeto-nivel-6', 'incansavel', 'linha-de-tiro'],
  },
  {
    id: 'raven', cenario: 'maldicao', ato: 'ato2', nome: 'Raven', perfil: 'executor', vocacao: 'Militar', nivel: 6,
    atributos: at(10, 8, 6), pv: 28, pd: 24, card: 'raven.png',
    pericias: { 'aptidao:Tática': 10, atletismo: 8, disciplina: 6, intimidar: 6, luta: 6, maquinas: 10, percepcao: 8, pontaria: 10, sobrevivencia: 8, vigor: 10 },
    habilidades: ['estoico', 'impeto', 'para-bellum'],
  },
  {
    id: 'val', cenario: 'maldicao', ato: 'ato2', nome: 'Val', perfil: 'vigilante', vocacao: 'Médico', nivel: 6,
    atributos: at(6, 10, 8), pv: 18, pd: 32, card: 'val.png',
    pericias: { 'aptidao:Exatas': 10, disciplina: 10, enganacao: 6, intuicao: 8, medicina: 10, ocultismo: 8, percepcao: 6, persuasao: 8, pesquisar: 6, pontaria: 10, tecnologia: 10 },
    habilidades: ['prontidao', 'tecnica-medicinal', 'varredura-ampla'],
  },

  // ---- Contos da Vigília (nível 3) ----
  {
    id: 'rhiona', cenario: 'contos', nome: 'Rhiona', sobrenome: 'Mac Tuirenn', perfil: 'analista', vocacao: 'Ferreira', nivel: 3,
    atributos: at(10, 6, 6), pv: 22, pd: 12, card: 'rhiona.png',
    pericias: { atletismo: 8, disciplina: 6, luta: 10, 'oficio:Metalurgia': 8, percepcao: 6, persuasao: 6, vigor: 8 },
    habilidades: ['analise', 'leitura-de-combate', 'segredo-do-aco'],
    equipamento: ['Martelo de forja (arma corpo a corpo, dano RA+3)', 'Tenaz de ferreiro'],
    relacoes: [
      r('Rowan', 1, 'Confiança', 'É quem lhe traz o minério de ferro do pântano.'),
      r('Muirenn', 0, 'Neutro', 'Soube de enfermos que foram tratados pela curandeira.'),
      r('Cavan', 2, 'Amizade', 'Passam horas debatendo contabilidade.'),
      r('Malik', 1, 'Admiração', 'Gosta de ouvir as histórias que ele traz de terras distantes.'),
      r('Sira', 0, 'Neutro', 'Aguarda ela se recuperar do naufrágio para fazer perguntas.'),
      r('Sorcha', 1, 'Respeito', 'Reconhece a importância de sua vigilância.'),
      r('Cormac', 1, 'Curiosidade', 'Pergunta-se de onde vem a espada que carrega.'),
    ],
  },
  {
    id: 'rowan', cenario: 'contos', nome: 'Rowan', sobrenome: 'Lobo Castanho', perfil: 'vigilante', vocacao: 'Adestrador', nivel: 3,
    atributos: at(8, 8, 6), pv: 20, pd: 12, card: 'rowan.png',
    pericias: { acrobacia: 6, animais: 6, atletismo: 6, furtividade: 6, luta: 6, medicina: 6, percepcao: 8, pontaria: 10, sobrevivencia: 8, vigor: 6 },
    habilidades: ['prontidao', 'esquiva', 'espectro-o-lobo'],
    equipamento: ['Arco curto de teixo (arma à distância, dano RA+1)', 'Lança de javali (arma corpo a corpo, dano RA+2; +1 passo no primeiro ataque da cena)'],
    relacoes: [
      r('Rhiona', 1, 'Dever', 'A ferreira é importante para a vila e deve ser protegida.'),
      r('Muirenn', 2, 'Cumplicidade', 'Têm em comum o modo de vida apartado da vila.'),
      r('Cavan', 0, 'Neutro', 'O monge traz bons conselhos aos camponeses.'),
      r('Malik', 0, 'Neutro', 'O jeito bisbilhoteiro do andarilho não chega a incomodar.'),
      r('Sira', 0, 'Neutro', 'Só se viram uma vez.'),
      r('Sorcha', 0, 'Neutro', 'Acha os rastros da passagem dela chamativos demais.'),
      r('Cormac', 1, 'Tranquilidade', 'Sabe de onde ele vem pelos espinhos grudados em suas roupas, mas não o considera uma ameaça.'),
    ],
  },
  {
    id: 'muirenn', cenario: 'contos', nome: 'Muirenn', sobrenome: 'da Lua Pálida', perfil: 'executor', vocacao: 'Herborista', nivel: 3,
    atributos: at(8, 8, 8), pv: 15, pd: 17, card: 'muirenn.png',
    pericias: { 'aptidao:Folclore': 8, atletismo: 6, disciplina: 6, inspecionar: 6, intimidar: 6, intuicao: 6, medicina: 8, ocultismo: 8, pontaria: 6, sobrevivencia: 8, vigor: 6 },
    habilidades: ['impeto', 'arsenal-de-herborista'],
    equipamento: ['Faca ritualística (arma corpo a corpo, dano RA+0)', 'Maleta de medicamentos'],
    relacoes: [
      r('Rhiona', 0, 'Neutro', 'Não gosta de armas de metal, mas sabe que são necessárias.'),
      r('Rowan', 2, 'Amizade', 'Ao contrário do restante da vila, não tem medo do lobo.'),
      r('Cavan', 0, 'Neutro', 'Desaprova a doutrina escrita do monge, mas não a odeia.'),
      r('Malik', 0, 'Neutro', 'O julga tolo, mas não perigoso.'),
      r('Sira', 0, 'Neutro', 'Sabe que ela já se recuperou do naufrágio, mas finge debilidade.'),
      r('Sorcha', 0, 'Neutro', 'Duvida que a guarda a protegeria de algum perigo.'),
      r('Cormac', 0, 'Neutro', 'Só mais um forasteiro sendo bem recebido na vila que a desamparou.'),
    ],
  },
  {
    id: 'cavan', cenario: 'contos', nome: 'Irmão Cavan', sobrenome: 'do Mosteiro do Olmo Cinzento', perfil: 'analista', vocacao: 'Professor', nivel: 3,
    atributos: at(6, 10, 6), pv: 15, pd: 15, card: 'cavan.png',
    pericias: { acrobacia: 6, 'aptidao:Erudição': 6, atletismo: 10, disciplina: 8, inspecionar: 8, intuicao: 6, luta: 8, medicina: 6, ocultismo: 6, percepcao: 6, vigor: 6 },
    ajustes: [
      { chave: 'inspecionar', atributo: 'emocao', dadoDoAtributo: 10 },
      { chave: 'intuicao', atributo: 'fisico' },
      { chave: 'luta', atributo: 'mente', dadoDoAtributo: 6 },
      { chave: 'percepcao', atributo: 'emocao', dadoDoAtributo: 10 },
      { chave: 'persuasao', atributo: 'mente', dadoDoAtributo: 6 },
      { chave: 'pontaria', dadoDoAtributo: 10 },
      { chave: 'sobrevivencia', dadoDoAtributo: 6 },
    ],
    habilidades: ['analise', 'leitura-de-combate', 'curandeiro', 'mentoria'],
    equipamento: ['Porrete (arma corpo a corpo, dano RA+1)'],
    relacoes: [
      r('Rhiona', 3, 'Grande afeição', 'Sentimento conflitante com seus votos monásticos.'),
      r('Rowan', 0, 'Neutro', 'Espera um dia poderem conversar melhor.'),
      r('Muirenn', 0, 'Neutro', 'Desaprova a tradição da curandeira, mas não a odeia.'),
      r('Malik', 1, 'Admiração', 'Interesse pelo conhecimento trazido de outras terras.'),
      r('Sira', 0, 'Neutro', 'Aguarda ela se recuperar do naufrágio para fazer perguntas.'),
      r('Sorcha', 0, 'Neutro', 'Acredita que ela já sofreu muito.'),
      r('Cormac', 1, 'Discrição', 'Reconhece seu sotaque de nobre bretão, mas não contou a ninguém.'),
    ],
  },
  {
    id: 'malik', cenario: 'contos', nome: 'Malik', sobrenome: 'ibn Qamar', perfil: 'executor', vocacao: 'Explorador', nivel: 3,
    atributos: at(6, 6, 10), pv: 15, pd: 19, card: 'malik.png',
    pericias: { 'aptidao:Erudição': 8, atletismo: 6, disciplina: 6, inspecionar: 6, percepcao: 10, persuasao: 6, pontaria: 8, sobrevivencia: 6 },
    habilidades: ['impeto', 'impeto-fervilhante'],
    equipamento: ['Arco composto de Al-Andalus (arma à distância, dano RA+1)', 'Diário de viagem'],
    relacoes: [
      r('Rhiona', 0, 'Neutro', 'Gosta de tê-la como ouvinte de suas histórias.'),
      r('Rowan', 0, 'Neutro', 'Interessado em seu lobo e as superstições que o cercam.'),
      r('Muirenn', 1, 'Admiração', 'Fascinado por seu conhecimento ancestral exótico.'),
      r('Cavan', 1, 'Admiração', 'Fascinado por sua caligrafia e didática.'),
      r('Sira', 1, 'Curiosidade', 'Enche-a de perguntas pessoais em toda oportunidade.'),
      r('Sorcha', 0, 'Neutro', 'Sente-se oprimido pelo olhar desconfiado dela.'),
      r('Cormac', 1, 'Curiosidade', 'Admira seu vocabulário.'),
    ],
  },
  {
    id: 'sira', cenario: 'contos', nome: 'Sira', sobrenome: 'Cissé', perfil: 'vigilante', vocacao: 'Viking', nivel: 3,
    atributos: at(8, 6, 8), pv: 20, pd: 12, card: 'sira.png',
    pericias: { acrobacia: 6, 'aptidao:Erudição': 6, atletismo: 6, crime: 8, furtividade: 10, luta: 8, percepcao: 6, vigor: 6 },
    ajustes: [
      { chave: 'intuicao', atributo: 'fisico' },
      { chave: 'luta', atributo: 'mente' },
      { chave: 'percepcao', atributo: 'emocao' },
    ],
    habilidades: ['prontidao', 'antecipacao-tatica', 'sorrateiro'],
    equipamento: ['Machado de batalha nórdico (arma corpo a corpo, dano RA+3)'],
    relacoes: [
      r('Rhiona', 1, 'Anseio', 'Deseja usar o poder social da ferreira para voltar para o mar.'),
      r('Rowan', 0, 'Neutro', 'Só se viram uma vez.'),
      r('Muirenn', 1, 'Gratidão', 'A curandeira tratou suas feridas após o naufrágio.'),
      r('Cavan', 1, 'Anseio', 'Deseja usar o poder religioso do monge para voltar para o mar.'),
      r('Malik', 0, 'Neutro', 'Não gosta de suas perguntas desnecessárias.'),
      r('Sorcha', 1, 'Respeito', 'Reconhece a força da guerreira e sabe que pode contar com ela em uma luta.'),
      r('Cormac', 1, 'Empatia', 'Suspeita que o jovem esteja escondendo algo, o que os torna iguais.'),
    ],
  },
  {
    id: 'sorcha', cenario: 'contos', nome: 'Sorcha', sobrenome: 'Roth', perfil: 'vigilante', vocacao: 'Talentosa', nivel: 3,
    atributos: at(8, 6, 8), pv: 22, pd: 14, card: 'sorcha.png',
    pericias: { atletismo: 8, disciplina: 8, intuicao: 6, luta: 8, medicina: 6, percepcao: 6, vigor: 8 },
    ajustes: [
      { chave: 'intuicao', atributo: 'fisico' },
      { chave: 'luta', atributo: 'mente' },
      { chave: 'percepcao', atributo: 'emocao' },
    ],
    habilidades: ['prontidao', 'guardia', 'instinto-de-sobrevivencia'],
    equipamento: [
      'Lança (arma corpo a corpo, dano RA+2; no primeiro ataque contra um inimigo que ainda não a atacou, +1 passo)',
      'Escudo (se perder o teste oposto de ataque mas o teste somar 7 ou mais, reduz a rolagem baixa do dano)',
      'Elmo aberto (1 ponto de armadura, mas −1 passo em Percepção)',
    ],
    relacoes: [
      r('Rhiona', 2, 'Respeito', 'Admira sua dedicação à forja e depende de suas armas para proteger Ballynyr.'),
      r('Rowan', 0, 'Neutro', 'Respeita suas habilidades nos ermos, mas prefere manter distância do lobo…'),
      r('Muirenn', 2, 'Admiração', 'Reverencia as artes da floresta, e reconhece o valor de seus remédios.'),
      r('Cavan', 1, 'Proteção', 'Acha o monge ingênuo para o mundo real e busca resguardá-lo.'),
      r('Malik', 0, 'Neutro', 'Acha o andarilho curioso demais para o próprio bem, mantendo-o sob vigilância.'),
      r('Sira', 0, 'Suspeita', 'Reconhece o olhar de uma combatente marítima e não acredita em sua história de fragilidade.'),
      r('Cormac', 1, 'Suspeita', 'Acha as mãos limpas, a postura nobre e o sotaque estrangeiro do rapaz incompatíveis com a história de simples andarilho.'),
    ],
  },
  {
    id: 'cormac', cenario: 'contos', nome: 'Cormac', sobrenome: 'Coluim', perfil: 'executor', vocacao: 'Aristocrata', nivel: 3,
    atributos: at(8, 8, 6), pv: 17, pd: 15, card: 'cormac.png',
    pericias: { 'aptidao:Erudição': 6, 'aptidao:Guerra': 6, 'aptidao:Nobreza': 6, atletismo: 6, disciplina: 8, furtividade: 6, inspecionar: 6, luta: 8, percepcao: 6, persuasao: 6, sobrevivencia: 8, vigor: 8 },
    ajustes: [
      { chave: 'acrobacia', dadoDoAtributo: 6 },
      { chave: 'animais', dadoDoAtributo: 8 },
    ],
    habilidades: ['impeto', 'heranca', 'plano-estrategico'],
    equipamento: [
      'Espada forjada em castelo (arma corpo a corpo, dano RA+3; ao atacar com ela, sucesso crítico com dois valores 5 ou mais)',
      'Cota de malha (2 pontos de armadura, mas −1 passo em Furtividade)',
    ],
    relacoes: [
      r('Rhiona', 1, 'Admiração', 'Respeita a autoridade natural da ferreira, vendo nela o tipo de líder que ele foi incapaz de ser.'),
      r('Rowan', 0, 'Neutro', 'Admira a liberdade total que o caçador tem nos ermos.'),
      r('Muirenn', 0, 'Neutro', 'Mantém distância da curandeira, temendo que seus óleos e visões revelem sua verdadeira identidade.'),
      r('Cavan', 2, 'Vínculo', 'Encontra no monge a única companhia intelectual da vila, embora tema que ele descubra seu segredo.'),
      r('Malik', 1, 'Afinidade', 'Gosta de ouvir as histórias de quem veio de longe, mas não pode compartilhar seu próprio passado.'),
      r('Sira', 0, 'Neutro', 'Nota que ela também esconde algo de seu passado e prefere não cruzar seu caminho.'),
      r('Sorcha', 1, 'Confiança', 'Aprendeu desde cedo a confiar em soldados.'),
    ],
  },
]

// As linhas de perícia da ficha pronta: a ficha vazia do cenário com os dados e os ajustes impressos.
export function periciasDaFichaPronta(f: FichaPronta): LinhaDePericia[] {
  return periciasVazias(f.cenario).map((l) => {
    const chave = chaveDaLinha(l)
    const ajuste = f.ajustes?.find((a) => a.chave === chave)
    return {
      ...l,
      dado: f.pericias[chave] ?? l.dado,
      ...(ajuste?.atributo ? { atributo: ajuste.atributo } : {}),
      ...(ajuste?.dadoDoAtributo ? { dadoDoAtributo: ajuste.dadoDoAtributo } : {}),
    }
  })
}

export function fichasDoCenario(cenario: IdCenario, ato?: string): FichaPronta[] {
  return FICHAS_PRONTAS.filter((f) => f.cenario === cenario && (!ato || f.ato === ato))
}
