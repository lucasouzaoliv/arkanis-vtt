-- Ficha ao vivo (pedido da Millie, 11/10): mudar algo na ficha (pela própria ficha, pela mesa ou
-- pelo mestre) tinha que fechar e abrir de novo pra ver. As tabelas da ficha passam a avisar em
-- tempo real; a ficha escuta e recarrega. RLS continua valendo pro que cada um recebe.
-- REPLICA IDENTITY FULL: o aviso de DELETE traz o character_id, pra filtrar pela ficha.

do $$
declare t text;
begin
  foreach t in array array['character_inventory', 'character_abilities', 'character_skills', 'character_rituals',
                           'character_attacks', 'character_modifiers', 'character_progression_picks', 'character_temp_bonuses']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
    execute format('alter table %I replica identity full', t);
  end loop;
end $$;
