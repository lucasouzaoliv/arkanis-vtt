-- Ordem dos ataques (pedido 12/10): a pessoa arrasta os ataques na aba Combate pra organizar.
-- Sem posição (ataques antigos), ficam depois dos ordenados.

alter table character_attacks add column if not exists sort_order integer;
