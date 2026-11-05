-- Ficha de Ordem Paranormal 2 (playtest): o que é só desse jogo fica em characters.op2
-- (cenário, perfil, nível, dados de atributo e perícia, habilidades, equipamentos, relações).
-- Nome, foto, PV e PD continuam nas colunas de sempre, pra mesa enxergar igual.
alter table characters add column op2 jsonb;
