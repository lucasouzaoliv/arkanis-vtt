-- Arquivos Secretos 02, página "Jae na sua mesa" (texto enviado pela Millie, 12/10): descrições
-- inteiras no lugar dos resumos, pré-requisitos e afinidade; Punhal X passa a crítico 19/x3.

update general_powers set
  description = $t$Seu treinamento com esquivas deu resultados. Você pode fazer uma segunda reação especial de defesa na mesma rodada, desde que ela seja uma esquiva.$t$,
  prerequisites = 'Agi 2'
where name = 'Esquiva Tática';

update class_powers set
  description = $t$Você sabe ferir os pontos vitais com ainda mais letalidade. O dano que você causa com a habilidade de trilha Ataque Furtivo aumenta em +1d6. Além disso, quando acerta um ataque furtivo, você pode gastar 2 PE para mudar o tipo dos dados de dano furtivo de d6 para d8.$t$,
  prerequisites = 'Ataque Furtivo'
where name = 'Assassinato Furtivo';

update paranormal_powers set
  description = $t$Você amaldiçoa uma área para que o Conhecimento influencie a percepção dos seres dentro dela. Com o gasto de uma ação completa e 3 PE, você marca uma área equivalente a um cômodo pequeno com vários símbolos "X". Para áreas maiores, podem ser necessários mais usos dessa habilidade, à critério do mestre. Nessa área, você recebe +5 em testes de ataque e não sofre penalidade por fazer testes de Furtividade após atacar ou fazer outras ações chamativas. Você pode ter no máximo três áreas criadas; se criar uma quarta, uma das anteriores desaparece.$t$,
  prerequisites = 'Conhecimento 1',
  affinity_description = $t$Se causar dano em um alvo desprevenido com um ataque corpo a corpo ou em alcance curto, ou um alvo que você esteja flanqueando, você pode rolar novamente quaisquer dados de dano com resultado 1 ou 2 e escolher ficar com os melhores resultados.$t$
where name = 'Zona dos Sussurros';

update cursed_items_special set
  description = $t$*Uma grande faca de cabo sombrio e guarda dourada.*

É uma arma simples corpo a corpo, de uma mão e *ágil*, que pode ser arremessada em alcance curto. Ela causa 1d4 pontos de dano de perfuração mais 1d6 pontos de dano de Conhecimento e tem crítico 19/x3. Além disso, quando ataca com esta arma, você pode gastar 2 PE para deixar o alvo desprevenido contra o ataque e, se acertar, o alvo fica cego por 1 rodada (só uma vez por cena por alvo).$t$
where name = 'Punhal X';
