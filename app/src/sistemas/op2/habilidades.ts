import type { IdCenario } from './cenarios'

// Habilidades que aparecem nas fichas prontas dos playtests (o catálogo da janela "Seleção de
// Habilidades"). Texto copiado das fichas oficiais. Marcação do texto, que a tela desenha:
//   **negrito**  ·  {d4}…{d12} = ícone do dado  ·  linhas começando com "- " viram lista.
// contador: estado próprio da habilidade na ficha (barra do Ímpeto, marcadores da Análise).

export type Habilidade = {
  id: string
  nome: string
  cenario: IdCenario
  // De onde vem: perfil (Executor/Analista/Vigilante) ou ocupação/vocação.
  origem: string
  texto: string
  contador?: { tipo: 'espacos' | 'marcadores'; maximo: number }
}

const h = (cenario: IdCenario, id: string, nome: string, origem: string, texto: string, contador?: Habilidade['contador']): Habilidade => ({ id, nome, cenario, origem, texto, ...(contador ? { contador } : {}) })

export const HABILIDADES: Habilidade[] = [
  // ---- Maldição do Ídolo de Pedra (Alpha) ---- texto exatamente como nas fichas oficiais do playtest
  h('maldicao', 'impeto', 'Ímpeto', 'Executor',
    'Você possui uma **barra de ímpeto** com três **espaços**. Sempre que **falha** em um **teste**, você preenche um espaço na barra.\nVocê pode apagar espaços preenchidos para:\n- {esp} receber +{d4} em um **teste**.\n- {esp}{esp}{esp} aumentar um **atributo** em um **passo** até o fim da cena.',
    { tipo: 'espacos', maximo: 3 }),
  h('maldicao', 'impeto-nivel-6', 'Ímpeto (Nível 6)', 'Executor',
    'Você possui uma **barra de ímpeto** com cinco **espaços**. Sempre que **falha** em um **teste**, você preenche um espaço na barra.\nVocê pode apagar espaços preenchidos para:\n- {esp} receber +{d4} em um **teste**.\n- {esp}{esp} receber +{d10} em um **teste**.\n- {esp}{esp}{esp} aumentar um **atributo** em um **passo** até o fim da cena.\n- {esp}{esp}{esp}{esp}{esp} fazer uma ação extra na rodada..',
    { tipo: 'espacos', maximo: 5 }),
  h('maldicao', 'avaliacao', 'Avaliação', 'Analista',
    'Você pode gastar **uma ação e 2 PD** para observar um ser ou um ambiente. Você recebe {d4}{d4} que pode usar em testes relativos àquele ser ou ambiente (você pode usá-los como quiser, recebendo +{d4}{d4} em um teste ou +{d4} em dois testes). Você não pode acumular mais do que dois dados bônus por esta habilidade.'),
  h('maldicao', 'prontidao', 'Prontidão', 'Vigilante',
    'No início de qualquer conflito, você pode gastar **3 PD**. Se fizer isso, **ganha uma rodada** na qual pode agir antes dos demais personagens e NPCs.'),
  h('maldicao', 'foco-mental', 'Foco Mental', 'Cientista',
    'Quando faz um **teste mental**, você pode gastar **2 PD** para receber +{d4} no teste.'),
  h('maldicao', 'foco-mental-nivel-6', 'Foco Mental (Nível 6)', 'Cientista',
    'Quando faz um **teste mental**, você pode gastar **4 PD** para receber +{d8} no teste.'),
  h('maldicao', 'foco-emocional', 'Foco Emocional', 'Artista',
    'Quando faz um **teste emocional**, você pode gastar **2 PD** para receber +{d4} no teste.'),
  h('maldicao', 'esforco-e-suor', 'Esforço e Suor', 'Operário',
    'Você possui uma perícia física aumentada para {d6} (já contabilizado na ficha).'),
  h('maldicao', 'conhecimento-tecnico', 'Conhecimento Técnico', 'Profissional de Escritório',
    'Você possui uma perícia mental aumentada para {d6} (este aumento já está contabilizado na ficha).'),
  h('maldicao', 'mentoria', 'Mentoria', 'Professor',
    'Quando **ajuda** outro personagem, você pode fazer um teste da perícia que usou para ajudar contra **DT 7**. Se passar, o personagem ajudado pode substituir um dos dados rolados por ele pela sua rolagem alta.'),
  h('maldicao', 'amor-pela-descoberta', 'Amor pela Descoberta', 'Professor',
    'Quando **examina** um ponto de interesse e recebe uma informação nova, você recupera **1 PD**.'),
  h('maldicao', 'olhar-infalivel', 'Olhar Infalível', 'Cientista',
    'Quando faz um **teste de examinar**, você pode gastar **2 PD** para rolar novamente um dos dados do teste.'),
  h('maldicao', 'incansavel', 'Incansável', 'Policial',
    'Uma vez por cena de conflito, você pode gastar 5 PV para fazer uma ação extra.'),
  h('maldicao', 'linha-de-tiro', 'Linha de Tiro', 'Policial',
    'Você recebe proficiência com armas de fogo e, quando faz um teste de ataque com essas armas, pode **gastar 4 PD** para receber +{d10} no teste.'),
  h('maldicao', 'estoico', 'Estoico', 'Militar',
    'Você recebe +{d6} em testes de trauma e, na primeira vez em que cada cena que faz um teste de trauma, recupera **9 PD**.'),
  h('maldicao', 'para-bellum', 'Para Bellum', 'Militar',
    'Você recebe **proficiência** com armas de fogo e seu dano com essas armas aumenta em **+2**.'),
  h('maldicao', 'tecnica-medicinal', 'Técnica Medicinal', 'Médico',
    'Sempre que você usa um efeito que **cura** pontos de vida, seu efeito cura **+1 PV** (ou **+1 PV** por dado).'),
  h('maldicao', 'varredura-ampla', 'Varredura Ampla', 'Médico',
    'Quando **investiga** um ponto de interesse, você pode escolher duas perícias e receber informações de ambas.'),

  // ---- Contos da Vigília (Beta) ---- texto exatamente como nas fichas oficiais do playtest
  h('contos', 'analise', 'Análise', 'Analista',
    'Você pode **gastar uma ação** para receber **2 marcadores de análise**.\n- Quando faz um teste, **pode gastar** quantos marcadores quiser **após rolar os dados**. Para cada marcador gasto, pode mudar o resultado de um dado em +1 ou –1 (até o máximo do dado).\n- Você pode acumular **no máximo 4 marcadores de análise** e, no fim da cena, **perde** quaisquer marcadores não usados.',
    { tipo: 'marcadores', maximo: 4 }),
  h('contos', 'leitura-de-combate', 'Leitura de Combate', 'Analista',
    'Em combate, sempre que você gastar uma ação para **se defender**, você recebe **um marcador de análise**.'),
  h('contos', 'impeto', 'Ímpeto', 'Executor',
    'Você possui uma **barra de ímpeto**, com **cinco espaços**. Sempre que **faz um teste e falha**, você preenche um espaço na **barra de ímpeto**. Como uma ação livre, você pode gastar espaços da barra de ímpeto para receber benefícios.\n- **1 espaço.** Você recebe +{d4} em **um teste**.\n- **3 espaços.** Você **aumenta** um atributo em **um passo** até o **fim da cena**.\n- **3 espaços.** Em **cenas de conflito**, você faz **uma ação extra**.\nNo fim da cena, sua barra de ímpeto esvazia.',
    { tipo: 'espacos', maximo: 5 }),
  h('contos', 'prontidao', 'Prontidão', 'Vigilante',
    'Uma vez por rodada, quando você ou outro ser em **alcance curto** faz um teste, você pode **gastar 2 PD** para rolar novamente, ou para fazer o outro ser rolar novamente, **um dos dados** do teste cujo resultado não tenha sido 1. Além disso, em combates, você pode fazer sua ação **na fase dela ou em fases posteriores**, e após qualquer ação daquela fase já ter sido rolada.'),
  h('contos', 'segredo-do-aco', 'Segredo do Aço', 'Ferreira',
    'Você sabe usar **equipamentos marciais**. Além disso, se estiver vestindo um item que forneça pontos de armadura, o item fornece **1 ponto de armadura adicional**.'),
  h('contos', 'esquiva', 'Esquiva', 'Adestrador',
    'Uma vez por rodada, quando sofre um ataque, pode fazer um **teste de Acrobacia** ({d8}+{d6}) oposto ao teste de ataque como uma **ação livre**. Se vencer, **evita o ataque**.'),
  h('contos', 'espectro-o-lobo', 'Espectro, o Lobo', 'Adestrador',
    'Você possui um parceiro lobo que fornece +{d6} em **testes de ataque corpo a corpo**. Porém, se o dado do lobo rolar 1, ele terá se machucado e **não poderá mais ajudá-lo** pelo resto da cena.'),
  h('contos', 'arsenal-de-herborista', 'Arsenal de Herborista', 'Herborista',
    'Você possui uma pequena bolsa contendo preparados medicinais feitos com ervas, óleos e mel. Para usar o item, **escolha um alvo e gaste uma ação**. Cada item é de **uso único**.\n- **Tônico de urtiga-feroz.** Uma mistura viscosa de sabor amargo, capaz de fortalecer quem a consome. O alvo recebe **aumento de passo** no atributo Físico por uma cena.\n- **Bálsamo de confrei.** Uma pasta grossa e mal-cheirosa feita para passar nos ferimentos. O alvo **recupera 2{d4} PV** (se for outro ser, ele precisa ficar parado nesta rodada).\n- **Pote de vespa.** Um pote quebradiço contendo vespas furiosas. Faça um **teste de Sobrevivência** para fazer um ataque à distância, com **dano RA+1**. Se o alvo sobreviver, perde sua próxima ação espantando as vespas.'),
  h('contos', 'curandeiro', 'Curandeiro', 'Professor',
    'Você pode **gastar uma ação e 2 PD** para curar um aliado. Faça um **teste de Medicina (DT 7)**. Se passar, você cura PV do aliado iguais à **RA do teste**. Você só pode usar este poder em um mesmo alvo **uma vez por cena**.'),
  h('contos', 'mentoria', 'Mentoria', 'Professor',
    'Quando **ajuda** outro personagem, você pode fazer um teste da perícia que usou para ajudar contra **DT 7**. Se passar, o personagem ajudado pode substituir um dos dados rolados por ele pela sua **rolagem alta**.'),
  h('contos', 'impeto-fervilhante', 'Ímpeto Fervilhante', 'Explorador',
    'No **início de cada cena**, você preenche **um espaço** de sua barra de ímpeto.'),
  h('contos', 'antecipacao-tatica', 'Antecipação Tática', 'Viking',
    'No início de qualquer combate, você pode **gastar 2 PD**. Se fizer isso, ganha uma rodada na qual pode **agir antes dos demais** personagens e NPCs.'),
  h('contos', 'sorrateiro', 'Sorrateiro', 'Viking',
    'Quando faz um teste usando **Crime** ou **Furtividade**, você pode **gastar 3 PD** para receber +{d8} no teste.'),
  h('contos', 'guardia', 'Guardiã', 'Talentosa',
    'Você recebe **+1 PV por patamar** (já anotado na ficha) e, uma vez por rodada, quando um aliado em **alcance curto** sofre um ataque, pode **gastar 2 PD** para se tornar o alvo deste ataque.'),
  h('contos', 'instinto-de-sobrevivencia', 'Instinto de Sobrevivência', 'Talentosa',
    'Se você estiver com **metade ou menos** de seus PV máximos, recebe **um aumento de passo** em todos os testes.'),
  h('contos', 'heranca', 'Herança', 'Aristocrata',
    'Sua **categoria de riqueza** aumenta em 1*.\n*As regras para compra de itens serão apresentadas futuramente. Na prática, por hora isso significa que Diarmaid começa com itens melhores (veja em “Equipamento”).'),
  h('contos', 'plano-estrategico', 'Plano Estratégico', 'Aristocrata',
    'Você pode **gastar uma ação e 3 PD** para elaborar um plano de ação. Faça um **teste de Aptidão (Guerra)** contra **DT 7**. Se passar, você e os seus aliados recebem {d6}, +{d6} para cada 3 pontos pelos quais o resultado do teste exceder a DT, que podem gastar em **quaisquer testes** até o fim da cena.'),
]

export function habilidadeDoCatalogo(cenario: IdCenario, id: string): Habilidade | undefined {
  return HABILIDADES.find((x) => x.cenario === cenario && x.id === id)
}
