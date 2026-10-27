-- Lanterna com bateria (KAN-114, pedido da Millie 27/10): o mestre faz a lanterna de um token
-- falhar (pisca sem parar) ou acabar a bateria (apaga, o tipo continua guardado). Só o mestre
-- mexe (update direto, regra da tabela); a lanterna volta quando ele troca a bateria.
alter table scene_tokens add column lanterna_estado text check (lanterna_estado in ('falhando', 'sem_bateria'));
