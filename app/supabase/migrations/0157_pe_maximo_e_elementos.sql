-- Pedidos da Millie (11/10):
-- * PE máximo editável na ficha, como já é com Vida e Sanidade (max_pv_override/max_sanity_override).
-- * Elemento escolhido nos poderes "Especialista em Elemento" (+2 DT dos rituais do elemento) e
--   "Mestre em Elemento" (-1 PE no custo), ex.: {"especialista": "sangue", "mestre": "energia"}.

alter table characters add column if not exists max_pe_override integer;
alter table characters add column if not exists elementos_escolhidos jsonb not null default '{}'::jsonb;
