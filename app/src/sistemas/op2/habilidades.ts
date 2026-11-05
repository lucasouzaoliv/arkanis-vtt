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
  // ---- Maldição do Ídolo de Pedra (Alpha) ----
  h('maldicao', 'impeto', 'Ímpeto', 'Executor',
    'Sempre que **falha em um teste**, preenche um espaço da barra. Pode apagar espaços preenchidos para:\n- **1 espaço:** recebe +{d4} em um teste.\n- **3 espaços:** aumenta um atributo em um passo até o fim da cena.',
    { tipo: 'espacos', maximo: 3 }),
  h('maldicao', 'impeto-nivel-6', 'Ímpeto (Nível 6)', 'Executor',
    'Sempre que **falha em um teste**, preenche um espaço da barra. Pode apagar espaços preenchidos para:\n- **1 espaço:** recebe +{d4} em um teste.\n- **2 espaços:** recebe +{d10} em um teste.\n- **3 espaços:** aumenta um atributo em um passo até o fim da cena.\n- **5 espaços:** faz uma ação extra na rodada.',
    { tipo: 'espacos', maximo: 5 }),
  h('maldicao', 'avaliacao', 'Avaliação', 'Analista',
    'Gasta **uma ação e 2 PD** para observar um ser ou ambiente. Recebe **2 × {d4}** para usar em testes relativos àquele ser ou ambiente: **+2{d4}** em um teste ou **+{d4}** em dois testes. Não acumula mais de 2 dados bônus por esta habilidade.'),
  h('maldicao', 'prontidao', 'Prontidão', 'Vigilante',
    'No início de qualquer conflito, pode gastar **3 PD**. Se fizer, **ganha uma rodada na qual pode agir antes dos demais personagens e NPCs**.'),
  h('maldicao', 'foco-mental', 'Foco Mental', 'Cientista',
    'Em um **teste mental**, pode gastar **2 PD** para receber +{d4} no teste.'),
  h('maldicao', 'foco-mental-nivel-6', 'Foco Mental (Nível 6)', 'Cientista',
    'Em um **teste mental**, pode gastar **4 PD** para receber +{d8} no teste.'),
  h('maldicao', 'foco-emocional', 'Foco Emocional', 'Artista',
    'Em um **teste emocional**, pode gastar **2 PD** para receber +{d4} no teste.'),
  h('maldicao', 'esforco-e-suor', 'Esforço e Suor', 'Operário',
    'Uma perícia física aumentada para {d6}.'),
  h('maldicao', 'conhecimento-tecnico', 'Conhecimento Técnico', 'Profissional de Escritório',
    'Uma perícia mental aumentada para {d6}.'),
  h('maldicao', 'mentoria', 'Mentoria', 'Professor',
    'Quando **ajuda** outro personagem, pode fazer um teste da perícia usada contra **DT 7**. Se passar, o ajudado pode **substituir um dos dados rolados** pela sua **rolagem alta**.'),
  h('maldicao', 'amor-pela-descoberta', 'Amor pela Descoberta', 'Professor',
    'Ao **examinar** um ponto de interesse e receber uma informação nova, **recupera 1 PD**.'),
  h('maldicao', 'olhar-infalivel', 'Olhar Infalível', 'Cientista',
    'Em um **teste de examinar**, pode gastar **2 PD** para **rolar novamente um dos dados** do teste.'),
  h('maldicao', 'incansavel', 'Incansável', 'Policial',
    'Uma vez por **cena de conflito**, pode gastar **5 PV** para fazer uma **ação extra**.'),
  h('maldicao', 'linha-de-tiro', 'Linha de Tiro', 'Policial',
    'Tem **proficiência com armas de fogo**. Ao fazer um teste de ataque com elas, pode gastar **4 PD** para receber +{d10}.'),
  h('maldicao', 'estoico', 'Estoico', 'Militar',
    'Recebe +{d6} em **testes de trauma**. Na primeira vez em cada cena em que faz um teste de trauma, **recupera 9 PD**.'),
  h('maldicao', 'para-bellum', 'Para Bellum', 'Militar',
    'Tem **proficiência com armas de fogo** e o dano com elas recebe **+2**.'),
  h('maldicao', 'tecnica-medicinal', 'Técnica Medicinal', 'Médico',
    'Sempre que usa um efeito que **cura PV**, ele cura **+1 PV** (ou +1 PV por dado).'),
  h('maldicao', 'varredura-ampla', 'Varredura Ampla', 'Médico',
    'Ao **investigar** um ponto de interesse, pode escolher **duas perícias** e receber as informações de ambas.'),

  // ---- Contos da Vigília (Beta) ----
  h('contos', 'analise', 'Análise', 'Analista',
    'Gasta **uma ação** para receber **2 marcadores de análise**. Ao fazer um teste, pode gastar marcadores **depois de rolar os dados**: cada um muda o resultado de um dado em **+1 ou −1** (até o máximo do dado). **Máximo de 4 marcadores**; no fim da cena, perde os que não usou.',
    { tipo: 'marcadores', maximo: 4 }),
  h('contos', 'leitura-de-combate', 'Leitura de Combate', 'Analista',
    'Em combate, sempre que gasta uma ação para **se defender**, recebe **1 marcador de análise**.'),
  h('contos', 'impeto', 'Ímpeto', 'Executor',
    'Cada **teste falho** preenche 1 espaço da barra. Como **ação livre**, pode gastar espaços para:\n- **1 espaço:** +{d4} em um teste.\n- **3 espaços:** +1 passo em um atributo até o fim da cena.\n- **3 espaços:** em cenas de conflito, uma ação extra.\nA barra esvazia no fim da cena.',
    { tipo: 'espacos', maximo: 5 }),
  h('contos', 'prontidao', 'Prontidão', 'Vigilante',
    'Uma vez por rodada, quando você ou outro ser em **alcance curto** faz um teste, pode gastar **2 PD** para rolar de novo (ou fazer o outro rolar de novo) **um dado** do teste cujo resultado não tenha sido 1. Em combate, pode agir na fase dela ou em fases posteriores, e depois de qualquer ação daquela fase já ter sido rolada.'),
  h('contos', 'segredo-do-aco', 'Segredo do Aço', 'Ferreira',
    'Sabe usar **equipamentos marciais**. Se vestir um item que forneça pontos de armadura, ele fornece **+1 ponto de armadura**.'),
  h('contos', 'esquiva', 'Esquiva', 'Adestrador',
    'Uma vez por rodada, ao sofrer um ataque, faz um **teste de Acrobacia** oposto ao ataque, como **ação livre**. Se vencer, evita o ataque.'),
  h('contos', 'espectro-o-lobo', 'Espectro, o Lobo', 'Adestrador',
    'Seu parceiro lobo dá +{d6} em **testes de ataque corpo a corpo**. Se o dado do lobo rolar **1**, ele se machuca e não ajuda mais até o fim da cena.'),
  h('contos', 'arsenal-de-herborista', 'Arsenal de Herborista', 'Herborista',
    'Pequena bolsa de preparados medicinais. **Escolhe um alvo e gasta uma ação; cada item é de uso único.**\n- **Tônico de urtiga-feroz:** o alvo recebe aumento de passo no atributo Físico por uma cena.\n- **Bálsamo de confrei:** o alvo recupera 2{d4} PV; se for outro ser, ele precisa ficar parado nesta rodada.\n- **Pote de vespa:** teste de Sobrevivência para ataque à distância, dano RA+1; se o alvo sobreviver, perde a próxima ação espantando as vespas.'),
  h('contos', 'curandeiro', 'Curandeiro', 'Professor',
    'Gasta **uma ação e 2 PD** e faz um **teste de Medicina (DT 7)**. Se passar, cura PV do aliado iguais à **RA** do teste. Uma vez por cena no mesmo alvo.'),
  h('contos', 'mentoria', 'Mentoria', 'Professor',
    'Ao **ajudar** outro personagem, pode testar a perícia usada contra **DT 7**. Se passar, o ajudado pode trocar um dos dados rolados pela sua **rolagem alta**.'),
  h('contos', 'impeto-fervilhante', 'Ímpeto Fervilhante', 'Explorador',
    'No início de cada cena, preenche **1 espaço** da barra de ímpeto.'),
  h('contos', 'antecipacao-tatica', 'Antecipação Tática', 'Viking',
    'No início de qualquer combate, pode gastar **2 PD**. Se fizer, ganha uma rodada em que **age antes dos demais** personagens e NPCs.'),
  h('contos', 'sorrateiro', 'Sorrateiro', 'Viking',
    'Ao testar **Crime** ou **Furtividade**, pode gastar **3 PD** para receber +{d8} no teste.'),
  h('contos', 'guardia', 'Guardiã', 'Talentosa',
    'Recebe **+1 PV por patamar** (já anotado na ficha). Uma vez por rodada, quando um aliado em **alcance curto** sofre um ataque, pode gastar **2 PD** para se tornar o alvo.'),
  h('contos', 'instinto-de-sobrevivencia', 'Instinto de Sobrevivência', 'Talentosa',
    'Com **metade ou menos** dos PV máximos, recebe **+1 passo em todos os testes**.'),
  h('contos', 'heranca', 'Herança', 'Aristocrata',
    'Sua **categoria de riqueza** aumenta em 1 (as regras de compra virão em playtests futuros; por ora, você começa com itens melhores).'),
  h('contos', 'plano-estrategico', 'Plano Estratégico', 'Aristocrata',
    'Gasta **uma ação e 3 PD** e faz um **teste de Aptidão (Guerra)** contra **DT 7**. Se passar, você e seus aliados recebem {d6}, mais {d6} a cada 3 pontos acima da DT, para gastar em qualquer teste até o fim da cena.'),
]

export function habilidadeDoCatalogo(cenario: IdCenario, id: string): Habilidade | undefined {
  return HABILIDADES.find((x) => x.cenario === cenario && x.id === id)
}
