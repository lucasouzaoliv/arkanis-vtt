-- Quadro de pistas aprimorado (pedido da Millie, 10/11):
--   estilo: papel da nota (caderno, pardo, post-it amarelo/rosa/verde/azul/laranja/vermelho/preto).
--   largura: tamanho do papel no mural (null = o padrão do tipo); a altura acompanha o conteúdo.
--   marcas: grifos de marca-texto por cima do papel
--     [{ id, cor, grossura, pontos: [[x, y], ...] }] em fração da largura do papel.
--   uv: tinta UV que o mestre escreve por cima; só aparece debaixo da luz UV
--     { itens: [{ id, tipo: 'texto' | 'pingo', x, y, ... }], rastro: bool }.

alter table clue_board_cards add column if not exists estilo text;
alter table clue_board_cards add column if not exists largura numeric;
alter table clue_board_cards add column if not exists marcas jsonb not null default '[]'::jsonb;
alter table clue_board_cards add column if not exists uv jsonb;
