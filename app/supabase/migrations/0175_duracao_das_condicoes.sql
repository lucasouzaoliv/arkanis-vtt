-- Condições com duração no combate (KAN-121, pedido da Millie 27/10): o mestre marca quantas
-- rodadas uma condição dura (ou "até o fim da cena"). Ela sai sozinha no começo do turno de quem
-- está com ela, N rodadas depois; as da cena (e as que sobrarem) saem quando o combate acaba.
-- Quem sai: characters.conditions (jogador/NPC) ou campaign_actors.condicoes (ameaça).

create table combat_condition_timers (
  id uuid primary key default gen_random_uuid(),
  combat_id uuid not null references combats(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  combatant_id uuid not null references combatants(id) on delete cascade,
  condicao text not null,
  ate_rodada int, -- null = até o fim da cena (do combate)
  created_at timestamptz not null default now(),
  unique (combatant_id, condicao)
);

alter table combat_condition_timers enable row level security;
create policy "acesso: so aprovados" on public.combat_condition_timers as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "timers: membros leem" on combat_condition_timers for select using (is_campaign_member(campaign_id) or is_campaign_owner(campaign_id));
create policy "timers: mestre cria" on combat_condition_timers for insert with check (is_campaign_owner(campaign_id));
create policy "timers: mestre edita" on combat_condition_timers for update using (is_campaign_owner(campaign_id));
create policy "timers: mestre exclui" on combat_condition_timers for delete using (is_campaign_owner(campaign_id));
alter publication supabase_realtime add table combat_condition_timers;

-- Tira a condição de quem está no combate (ameaça: no personagem da mesa; jogador/NPC: na ficha).
create function public.tirar_condicao_do_combatente(p_combatant_id uuid, p_condicao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cb combatants%rowtype;
begin
  select * into v_cb from combatants where id = p_combatant_id;
  if v_cb.id is null then return; end if;
  if v_cb.actor_id is not null and exists (select 1 from campaign_actors a where a.id = v_cb.actor_id and a.creature_id is not null) then
    update campaign_actors set condicoes = array_remove(condicoes, p_condicao) where id = v_cb.actor_id;
  elsif v_cb.character_id is not null then
    update characters set conditions = coalesce(conditions, '[]'::jsonb) - p_condicao where id = v_cb.character_id;
  end if;
end;
$$;
revoke execute on function public.tirar_condicao_do_combatente(uuid, text) from public, anon, authenticated;

-- Turno passou ou combate acabou: tira o que venceu.
create function public.vencer_condicoes() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  if not new.ativo and old.ativo then
    for t in select * from combat_condition_timers where combat_id = new.id loop
      perform tirar_condicao_do_combatente(t.combatant_id, t.condicao);
    end loop;
    delete from combat_condition_timers where combat_id = new.id;
    return new;
  end if;
  if new.ativo and (new.turno_atual is distinct from old.turno_atual or new.rodada <> old.rodada) then
    for t in
      select * from combat_condition_timers
       where combat_id = new.id and ate_rodada is not null
         and ((combatant_id = new.turno_atual and ate_rodada <= new.rodada) or ate_rodada < new.rodada)
    loop
      perform tirar_condicao_do_combatente(t.combatant_id, t.condicao);
      delete from combat_condition_timers where id = t.id;
    end loop;
  end if;
  return new;
end;
$$;

create trigger combats_vencer_condicoes after update on combats
  for each row execute function vencer_condicoes();
