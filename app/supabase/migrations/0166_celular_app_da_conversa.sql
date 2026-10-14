-- Canal da Ordem (13/10): a conversa diz em qual app ela vive. "mensagens" é o app tipo WhatsApp;
-- "ordem" é o app da Ordo Realitas (terminal verde), com os canais da Ordem.

alter table public.celular_conversas add column if not exists app text not null default 'mensagens'
  check (app in ('mensagens', 'ordem'));

drop function if exists public.criar_conversa(uuid, text, uuid[], uuid[], text, text);

create or replace function public.criar_conversa(
  p_de_celular uuid, p_tipo text, p_celulares uuid[] default '{}', p_npcs uuid[] default '{}',
  p_nome text default null, p_foto text default null, p_app text default 'mensagens'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cel celulares%rowtype;
  v_id uuid;
  v_outro uuid;
begin
  select * into v_cel from celulares where id = p_de_celular;
  if v_cel.id is null or not acesso_aprovado() or not (controla_celular(v_cel.id) or is_campaign_owner(v_cel.campaign_id)) then
    raise exception 'Só quem controla o celular cria conversa nele';
  end if;
  if p_app not in ('mensagens', 'ordem') then
    raise exception 'App inválido';
  end if;
  if p_tipo not in ('direta', 'grupo') then
    raise exception 'Tipo de conversa inválido';
  end if;
  if exists (select 1 from unnest(p_celulares) x where not exists (select 1 from celulares c where c.id = x and c.campaign_id = v_cel.campaign_id))
     or exists (select 1 from unnest(p_npcs) x where not exists (select 1 from celular_npcs n where n.id = x and n.campaign_id = v_cel.campaign_id)) then
    raise exception 'Todo mundo da conversa precisa ser da mesma mesa';
  end if;
  if exists (select 1 from unnest(p_npcs) x where not pode_ver_npc(x)) then
    raise exception 'Contato desconhecido';
  end if;

  if p_tipo = 'direta' then
    if coalesce(array_length(p_celulares, 1), 0) + coalesce(array_length(p_npcs, 1), 0) <> 1 then
      raise exception 'Conversa direta é com uma pessoa só';
    end if;
    -- A mesma conversa de antes, se já existir entre os dois.
    select v.id into v_id
    from celular_conversas v
    join celular_participantes a on a.conversa_id = v.id and a.celular_id = p_de_celular
    join celular_participantes b on b.conversa_id = v.id
      and (b.celular_id = any(p_celulares) or b.npc_id = any(p_npcs))
    where v.tipo = 'direta' and v.app = p_app
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into celular_conversas (campaign_id, tipo, nome, foto, criada_por_celular, app)
  values (v_cel.campaign_id, p_tipo, case when p_tipo = 'grupo' then nullif(trim(p_nome), '') end, p_foto, p_de_celular, p_app)
  returning id into v_id;

  insert into celular_participantes (conversa_id, celular_id, papel, lida_ate)
  values (v_id, p_de_celular, case when p_tipo = 'grupo' then 'admin' else 'membro' end, now());
  foreach v_outro in array p_celulares loop
    if v_outro <> p_de_celular then
      insert into celular_participantes (conversa_id, celular_id) values (v_id, v_outro) on conflict do nothing;
    end if;
  end loop;
  foreach v_outro in array p_npcs loop
    insert into celular_participantes (conversa_id, npc_id) values (v_id, v_outro) on conflict do nothing;
  end loop;
  return v_id;
end;
$$;
