-- Ajustes do mestre numa ameaça da mesa (pedido da Millie, 08/11): cada cópia pode ter a própria
-- Vida máxima e as próprias resistências a dano, sem mexer no bestiário.
--   pv_maximo: null = a do bestiário.
--   resistencias_ajustadas: [{ "tipo": "fogo", "valor": 10 }] — troca o valor daquele tipo
--     (0 tira a resistência); "dano" vale pra todos os tipos.

alter table campaign_actors add column if not exists pv_maximo integer;
alter table campaign_actors add column if not exists resistencias_ajustadas jsonb not null default '[]'::jsonb;

-- As funções que leem a Vida máxima da criatura passam a olhar primeiro a da cópia.
do $$
declare
  f record;
  def text;
  novo text;
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('aplicar_dano_da_acao', 'aplicar_por_item', 'aplicar_cura_da_acao', 'dados_do_alvo')
  loop
    def := pg_get_functiondef(f.oid);
    novo := replace(def,
      '(select pv_maximo from creatures where id = v_ator.creature_id)',
      'coalesce(v_ator.pv_maximo, (select pv_maximo from creatures where id = v_ator.creature_id))');
    novo := replace(novo,
      'select pv_maximo into v_max_criatura from creatures where id = v_ator.creature_id;',
      'select coalesce(v_ator.pv_maximo, pv_maximo) into v_max_criatura from creatures where id = v_ator.creature_id;');
    novo := replace(novo,
      '''pv_maximo'', v_criatura.pv_maximo,',
      '''pv_maximo'', coalesce(v_ator.pv_maximo, v_criatura.pv_maximo),
      ''resistencias_ajustadas'', coalesce(v_ator.resistencias_ajustadas, ''[]''::jsonb),');
    if novo = def then
      raise exception 'Nada trocado em %', f.proname;
    end if;
    execute novo;
  end loop;
end $$;
