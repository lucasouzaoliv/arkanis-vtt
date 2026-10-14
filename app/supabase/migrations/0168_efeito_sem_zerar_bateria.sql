-- Bug 14/10: qualquer efeito do mestre (sem sinal, interferência…) zerava a bateria. Sem bateria na
-- chamada, p_bateria vem nulo, e greatest(0, null) no Postgres dá 0 (ele ignora o nulo). Agora a
-- bateria só muda quando o mestre manda uma.

create or replace function public.efeito_no_celular(p_campaign_id uuid, p_celulares uuid[] default null, p_efeitos jsonb default '{}', p_bateria int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not acesso_aprovado() or not is_campaign_owner(p_campaign_id) then
    raise exception 'Só o mestre mexe nos efeitos do celular';
  end if;
  update celulares
  set efeitos = jsonb_strip_nulls(efeitos || coalesce(p_efeitos, '{}'::jsonb)),
      bateria = case when p_bateria is null then bateria else least(100, greatest(0, p_bateria)) end,
      updated_at = now()
  where campaign_id = p_campaign_id and (p_celulares is null or id = any(p_celulares));

  with saindo as (
    update celular_mensagens m set estado = 'enviada', created_at = now()
    from celulares c
    where m.de_celular_id = c.id and m.estado = 'pendente' and c.campaign_id = p_campaign_id
      and (p_celulares is null or c.id = any(p_celulares))
      and not coalesce((c.efeitos ->> 'sem_sinal')::boolean, false)
    returning m.conversa_id
  )
  update celular_conversas set ultima_em = now() where id in (select conversa_id from saindo);
end;
$$;
