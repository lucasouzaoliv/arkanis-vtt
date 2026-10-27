// Gerador de NPC rápido (KAN-122, pedido da Millie 27/10): pra quando os jogadores falam com
// alguém que o mestre não planejou. Um clique sorteia nome, idade, profissão, aparência, jeito e
// um traço estranho, no clima de Ordem Paranormal (Brasil de hoje, com algo fora do lugar).

const NOMES_F = ['Ana', 'Beatriz', 'Carla', 'Denise', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Joana', 'Kátia', 'Larissa', 'Márcia', 'Natália', 'Olívia', 'Patrícia', 'Raquel', 'Sandra', 'Tereza', 'Vanessa', 'Yasmin', 'Zuleide', 'Rosângela', 'Luíza', 'Cecília']
const NOMES_M = ['André', 'Bruno', 'Carlos', 'Diego', 'Everton', 'Fábio', 'Gustavo', 'Heitor', 'Igor', 'João', 'Kléber', 'Leandro', 'Marcelo', 'Nélson', 'Otávio', 'Paulo', 'Ricardo', 'Sérgio', 'Tiago', 'Valdir', 'Wesley', 'Raimundo', 'Josué', 'Lauro', 'Benedito']
const SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Barbosa', 'Moreira', 'Cardoso', 'Teixeira', 'Pacheco', 'Vasconcelos', 'Brandão', 'Queiroz', 'Monteiro']
const PROFISSOES = ['dono de uma banca de jornal', 'enfermeira do plantão noturno', 'motorista de aplicativo', 'zelador do prédio', 'padre da paróquia', 'vendedora de seguros', 'policial aposentado', 'estudante de medicina', 'coveiro', 'dona de um brechó', 'radialista da madrugada', 'caminhoneiro', 'bibliotecária', 'mecânico', 'corretor de imóveis', 'professora de escola pública', 'segurança de shopping', 'atendente de farmácia 24h', 'pescador', 'jornalista de um blog local', 'cozinheira de boteco', 'eletricista', 'investigador particular', 'cartomante', 'técnico de TI']
const APARENCIAS = ['magro, com olheiras fundas', 'baixinha e de cabelo grisalho preso', 'alto, de barba por fazer', 'de óculos remendados com fita', 'com uma cicatriz no queixo', 'sempre de casaco, mesmo no calor', 'de unhas roídas até sangrar', 'com tatuagem desbotada no antebraço', 'impecavelmente arrumado', 'com as roupas cheirando a cigarro', 'de cabelo pintado de vermelho', 'com um curativo na mão', 'de sorriso largo demais', 'com a pele muito pálida', 'de chinelo e bermuda', 'com um terço no pescoço', 'mancando da perna esquerda', 'com o uniforme sujo de graxa']
const JEITOS = ['fala rápido e não olha nos olhos', 'desconfia de todo mundo', 'é simpático até demais', 'responde tudo com outra pergunta', 'conta piada em hora errada', 'é educado, mas quer ir embora logo', 'adora uma fofoca', 'fala baixo, quase sussurrando', 'se ofende fácil', 'é prestativo e curioso', 'mente mal e fica vermelho', 'é grosso, mas tem bom coração']
const ESTRANHOS = [
  'conta as pessoas na sala o tempo todo, baixinho',
  'tem um relógio parado sempre às 3h33',
  'sabe o nome de um dos agentes sem ninguém ter dito',
  'não tem reflexo nítido no vidro (ninguém repara)',
  'cheira a terra molhada',
  'tem um símbolo desenhado na palma da mão e esconde',
  'fala de um parente que morreu como se estivesse vivo',
  'se arrepia toda vez que alguém diz "Ordem"',
  'repete a última palavra que você disse',
  'tem sangue seco embaixo das unhas',
  'carrega uma foto antiga com um rosto riscado',
  'não pisca quando está nervoso',
  'sonha toda noite com a mesma porta vermelha',
  'evita sombras, anda sempre pelo sol',
  'ouve um zumbido que mais ninguém ouve',
  'tem medo de espelhos e cobre os de casa',
  'escreve tudo num caderno e não deixa ninguém ver',
  'sabe de cor um número de telefone que não existe',
  'diz que já viu os agentes antes, num sonho',
  'tem uma cruz de sal na soleira da porta',
]

export type Npc = { nome: string; idade: number; profissao: string; aparencia: string; jeito: string; estranho: string }

function sortear<T>(l: T[], r: () => number): T {
  return l[Math.min(l.length - 1, Math.floor(r() * l.length))]
}

export function gerarNpc(r: () => number = Math.random): Npc {
  const nomes = r() < 0.5 ? NOMES_F : NOMES_M
  return {
    nome: `${sortear(nomes, r)} ${sortear(SOBRENOMES, r)}`,
    idade: 18 + Math.floor(r() * 60),
    profissao: sortear(PROFISSOES, r),
    aparencia: sortear(APARENCIAS, r),
    jeito: sortear(JEITOS, r),
    estranho: sortear(ESTRANHOS, r),
  }
}

export function textoDoNpc(n: Npc): string {
  return `${n.nome}, ${n.idade} anos, ${n.profissao}.\nAparência: ${n.aparencia}.\nJeito: ${n.jeito}.\nAlgo estranho: ${n.estranho}.`
}
