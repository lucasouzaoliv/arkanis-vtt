-- Bestiário Vendeta Oculta — Coração da Insanidade (missão 4): Sussurro Enraizado, Enfermeiro
-- Joaquim e Enfermeira Nívea (uma ficha só no livro, separadas aqui), Giordano Argento
-- (enfraquecido) e o Dr. Nicácio Morão (Rastejador Sombrio do livro base, com a arte da missão).
-- Imagens em public/conteudo/vendeta-oculta/criaturas (arte do livro). Pedido 18/10.

insert into sources (slug, name, sort_order)
select 'vendeta_oculta', 'Vendeta Oculta', 12
where not exists (select 1 from sources where slug = 'vendeta_oculta');

insert into creatures (source_id, categoria, tipo_criatura, name, vd, flavor_text, descritores, tamanho, presenca_dt, presenca_dano, presenca_nex_imune, percepcao, iniciativa, defesa, fortitude, reflexos, vontade, pv_maximo, pv_machucado, resistencias, vulnerabilidades, atributos, pericias, deslocamento, habilidades, acoes, image_url, sort_order)
values
(
  (select id from sources where slug = 'vendeta_oculta'), 'paranormal', 'Criatura', 'Sussurro Enraizado', 20,
  'Criatura de Lodo, galhos e raízes marcados com sigilos que espalha a palavra da Morte pelo manicômio Coração das Chagas.',
  array['Morte', 'Conhecimento'], 'Médio', 14, '2d6 mental', 25,
  '+0 (1d20, Percepção às cegas)', '+0 (1d20)', 18, '+5 (2d20)', '+0 (1d20)', '+0 (1d20)', 30, 15,
  'Corte, impacto e perfuração 5, Conhecimento 20, Morte 10', 'Energia',
  '{"agi":1,"for":1,"int":2,"pre":2,"vig":2}', null, '6m | 4',
  '[{"nome":"Imortalidade","descricao":"Quando morre, se desfaz numa poça de Lodo, galhos e raízes com sigilos e volta após 1d2 rodadas com 15 PV. Se sofrer 5 de dano de fogo ou de Energia (somados) na forma de poça, é destruído de vez."}]',
  '[{"tipo":"Padrão","nome":"Agredir (Pancada, corpo a corpo)","teste":"+5 (1d20)","dano":"1d6+5 impacto"},{"tipo":"Padrão","nome":"Agredir (Mordida, corpo a corpo)","teste":"+5 (1d20)","dano":"1d8+5 perfuração","descricao":"Mais a doença embaralhada (veja Doença Embaralhada)."},{"tipo":"Livre","nome":"Doença Embaralhada","descricao":"Quando acerta uma mordida, contamina o alvo com a doença mente embaralhada (Vontade DT 20 evita; OPRPG, p. 291)."},{"tipo":"Livre","nome":"Sussurros da Morte","dano":"1d6 mental","descricao":"Uma vez por rodada, todos os seres que possam ouvi-lo em alcance curto sofrem o dano (Vontade DT 14 reduz à metade)."}]',
  null, 900
),
(
  (select id from sources where slug = 'vendeta_oculta'), 'paranormal', 'Criatura', 'Enfermeiro Joaquim', 120,
  'Antigo enfermeiro do manicômio, transformado pelo Dr. Nicácio numa massa de músculos hipertrofiados com uma bocarra que se abre pelo torso. Com um ponto de pista justificando a ficha admissional dele, sofre –5 na Defesa, nos testes de ataque e nas rolagens de dano até o fim do combate.',
  array['Conhecimento', 'Sangue'], 'Grande', 20, '4d6 mental', 50,
  '+5 (2d20, Visão no escuro)', '+10 (3d20)', 28, '+10 (3d20)', '+10 (3d20)', '+5 (2d20)', 200, 100,
  'Balístico, corte e impacto 10, Conhecimento 20', 'Sangue',
  '{"agi":3,"for":3,"int":1,"pre":2,"vig":3}', null, '12m | 8',
  '[{"nome":"Ficha admissional","descricao":"Com um ponto de pista justificando a ficha admissional, sofre –5 na Defesa, testes de ataque e rolagens de dano até o fim do combate."}]',
  '[{"tipo":"Padrão","nome":"Agredir (Pancada, corpo a corpo x2)","teste":"+15 (3d20)","dano":"2d8+10 impacto"},{"tipo":"Padrão","nome":"Agredir (Mordida, corpo a corpo)","teste":"+15 (3d20)","dano":"2d10+10 perfuração"},{"tipo":"Livre","nome":"Agarrão","teste":"+20 (3d20)","descricao":"Se acertar um ataque de pancada, pode tentar agarrar o alvo."},{"tipo":"Livre","nome":"Mastigar Existência","dano":"2d10 Conhecimento","descricao":"Se acertar uma mordida num alvo agarrado, causa esse dano a mais."}]',
  '/conteudo/vendeta-oculta/criaturas/enfermeiro-joaquim.png', 901
),
(
  (select id from sources where slug = 'vendeta_oculta'), 'paranormal', 'Criatura', 'Enfermeira Nívea', 120,
  'Antiga enfermeira do manicômio, transformada pelo Dr. Nicácio numa criatura cega e violenta, com o rosto repuxado por grampos cirúrgicos e utensílios médicos enxertados nos braços. Seus saltos ecoam pelo piso. Com um ponto de pista justificando a ficha admissional dela, sofre –5 na Defesa, nos testes de ataque e nas rolagens de dano até o fim do combate.',
  array['Conhecimento', 'Sangue'], 'Médio', 20, '4d6 mental', 50,
  '+5 (2d20, Percepção às cegas)', '+10 (3d20)', 28, '+10 (3d20)', '+10 (3d20)', '+5 (2d20)', 200, 100,
  'Balístico, corte e impacto 10, Conhecimento 20', 'Sangue',
  '{"agi":3,"for":3,"int":1,"pre":2,"vig":3}', null, '12m | 8',
  '[{"nome":"Ficha admissional","descricao":"Com um ponto de pista justificando a ficha admissional, sofre –5 na Defesa, testes de ataque e rolagens de dano até o fim do combate."}]',
  '[{"tipo":"Padrão","nome":"Agredir (Serra Enxertada, corpo a corpo x2)","teste":"+15 (3d20)","dano":"2d12+10 corte"},{"tipo":"Padrão","nome":"Agredir (Seringas Venenosas, corpo a corpo)","teste":"+15 (3d20)","dano":"1d4+10 perfuração","descricao":"Mais veneno (veja Injetar Conhecimento)."},{"tipo":"Reação","nome":"Torcer Ossos","descricao":"Uma vez por rodada, torce o corpo de forma inumana e evita um ataque que a tenha atingido ou outro efeito negativo (exceto rituais)."},{"tipo":"Livre","nome":"Injetar Conhecimento","descricao":"Se acertar as seringas venenosas, o alvo faz Vontade (DT 23). Se falhar, fica fascinado sofrendo visões horríveis até sofrer uma ação hostil, ser sacudido ou até o fim da cena."}]',
  '/conteudo/vendeta-oculta/criaturas/enfermeira-nivea.png', 902
),
(
  (select id from sources where slug = 'vendeta_oculta'), 'mundana', 'Pessoa', 'Giordano Argento (Enfraquecido)', 140,
  'Patriarca da família Argento, ferido depois de subjugar o Dr. Nicácio. Quer fugir, não lutar, mas quebra os ossos de quem ficar no caminho. Ciclo de Vingança: se Julieta Argento sobreviveu a Distúrbio Selvagem, todos os testes desta ficha sofrem –1d20; se ela morreu, ele não sofre a penalidade e mata Lívia Takeda no fim da missão.',
  '{}', 'Médio', null, null, null,
  '+15 (3d20)', '+10 (2d20)', 27, '+10 (2d20)', '+10 (2d20)', '+15 (3d20)', 150, 75,
  null, null,
  '{"agi":2,"for":3,"int":3,"pre":3,"vig":2}', 'Atletismo +15 (3d20), Enganação +15 (3d20), Furtividade +10 (2d20), Intimidação +15 (3d20), Ocultismo +15 (3d20)', '9m | 6',
  '[{"nome":"Close Quarter Combat","descricao":"Estilo de luta militar pra espaços fechados: +1d20 em ataques corpo a corpo (inclusive com armas de disparo) e em manobras (inclusive pra resistir); mira, recarrega, saca e guarda itens como ação livre (bônus já contados)."},{"nome":"Conjurador","descricao":"Usa Armadura de Sangue, Descarnar, Dissipar Ritual, Eletrocussão, Salto Fantasma e Velocidade Mortal sem pagar PE, até 10 PE por conjuração. DT 25."},{"nome":"Ciclo de Vingança","descricao":"Se Julieta Argento sobreviveu a Distúrbio Selvagem, todos os testes desta ficha sofrem –1d20. Se ela morreu, não sofre a penalidade e mata Lívia Takeda no fim de Coração da Insanidade."}]',
  '[{"tipo":"Padrão","nome":"Agredir (Pancada, corpo a corpo x2)","teste":"+15 (4d20)","dano":"1d4+20 impacto"},{"tipo":"Padrão","nome":"Agredir (Pistola Silenciada, à distância curto x2)","teste":"+15 (3d20), crítico x3","dano":"1d12+20 balístico"},{"tipo":"Livre","nome":"Ataque Furtivo","dano":"4d6","descricao":"Uma vez por rodada, +4d6 de dano em ataques corpo a corpo, ou à distância em alcance curto, contra alvos desprevenidos ou que esteja flanqueando."},{"tipo":"Livre","nome":"Especialista em Manobras","descricao":"Uma vez por rodada, quando acerta um ataque desarmado, pode tentar agarrar, derrubar ou desarmar o oponente como ação livre."}]',
  '/conteudo/vendeta-oculta/criaturas/giordano-argento.png', 903
);

-- Dr. Nicácio Morão: o livro usa o Rastejador Sombrio (OPRPG, p. 248); aqui é uma cópia com a arte
-- e o ritual de enfraquecimento da cena final.
insert into creatures (source_id, categoria, tipo_criatura, name, vd, flavor_text, description, descritores, tamanho, presenca_dt, presenca_dano, presenca_nex_imune, percepcao, iniciativa, defesa, fortitude, reflexos, vontade, pv_maximo, pv_machucado, resistencias, vulnerabilidades, atributos, pericias, deslocamento, habilidades, acoes, enigma_medo, stats, image_url, sort_order)
select (select id from sources where slug = 'vendeta_oculta'), categoria, tipo_criatura, 'Dr. Nicácio Morão (Rastejador Sombrio)', vd,
  'Médico do manicômio que, corrompido pelos próprios experimentos em busca da vida eterna, virou um rastejador sombrio. Ataca sem piedade, priorizando quem carrega fontes de luz. Ritual de enfraquecimento (papéis da mesa + rituais da paróquia): ação completa, 3 PE e Ocultismo DT 20; se passar, ele sofre –10 em Defesa, testes e rolagens de dano até o fim do combate.',
  description, descritores, tamanho, presenca_dt, presenca_dano, presenca_nex_imune, percepcao, iniciativa, defesa, fortitude, reflexos, vontade, pv_maximo, pv_machucado, resistencias, vulnerabilidades, atributos, pericias, deslocamento,
  habilidades || '[{"nome":"Ritual de enfraquecimento","descricao":"Um personagem com as pesquisas da mesa e os fragmentos da paróquia gasta uma ação completa, 3 PE e passa em Ocultismo (DT 20): o Dr. Nicácio sofre –10 em Defesa, testes e rolagens de dano até o fim do combate."}]'::jsonb,
  acoes, enigma_medo, stats, '/conteudo/vendeta-oculta/criaturas/nicacio-morao.png', 904
from creatures where name = 'Rastejador Sombrio' and owner_id is null
  and not exists (select 1 from creatures where name = 'Dr. Nicácio Morão (Rastejador Sombrio)');
