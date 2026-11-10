-- Ordem Paranormal 2 na mesa (pedido da Millie, 10/11).
--
-- A mesa (dano, cura, itens, barras do token e do combate) fala em PV, Sanidade e PE. No OP2 só
-- existem PV e PD, e o PD faz o papel mental. Pra mesa inteira funcionar sem reescrever cada
-- função, nas fichas de OP2 a coluna de Sanidade anda sempre igual ao PD:
--   a mesa mexeu em current_sanity (dano emocional, cura)  -> current_pd acompanha
--   a ficha mexeu em current_pd                            -> current_sanity acompanha
--   max_sanity_override = PD máximo da ficha (op2.pdMaximo)

create or replace function public.op2_pd_e_sanidade()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_max int := nullif(new.op2 ->> 'pdMaximo', '')::int;
begin
  if new.system <> 'ordem_paranormal_2' or new.op2 is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.current_sanity is distinct from old.current_sanity and new.current_pd is not distinct from old.current_pd then
    new.current_pd := greatest(0, least(coalesce(v_max, new.current_sanity), coalesce(new.current_sanity, 0)));
  end if;
  new.current_sanity := new.current_pd;
  new.max_sanity_override := v_max;
  return new;
end;
$$;

drop trigger if exists characters_op2_pd on characters;
create trigger characters_op2_pd before insert or update on characters
  for each row execute function public.op2_pd_e_sanidade();

-- Fichas de OP2 que já existem.
update characters set current_pd = current_pd where system = 'ordem_paranormal_2' and op2 is not null;

-- Quem vai entrar numa campanha precisa saber de qual jogo ela é, pra levar a ficha certa
-- (ainda não é membro, então não lê a tabela campaigns direto).
create or replace function public.sistema_da_campanha(p_campaign_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.system from campaigns c where c.id = p_campaign_id and acesso_aprovado();
$$;
revoke execute on function public.sistema_da_campanha(uuid) from public, anon;
grant execute on function public.sistema_da_campanha(uuid) to authenticated;
