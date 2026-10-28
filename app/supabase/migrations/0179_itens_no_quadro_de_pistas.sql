-- Itens da aba Itens presos no quadro de pistas (pedido da Millie 28/10).
-- O papel guarda nome e imagem do momento em que foi preso: quem não vê o item ainda vê a pista.
alter table clue_board_cards drop constraint if exists clue_board_cards_tipo_check;
alter table clue_board_cards add constraint clue_board_cards_tipo_check check (tipo in ('nota', 'foto', 'documento', 'item'));
alter table clue_board_cards add column item_id uuid references campaign_items(id) on delete cascade;
