-- Resistências que a pessoa edita na ficha e PV temporários que só valem contra alguns tipos de dano
-- (Tela de Ruído, pedido da Millie 04/11).
--   resistencias_extras: [{ id, tipo, valor, temporaria?, umaVez?, origem?, semItem? }]
--     umaVez: some depois do próximo dano aplicado (Tela de Ruído como reação).
--     semItem: a pessoa tirou a resistência daquele tipo que vinha dos itens.
--   temp_pv_tipos: null = os PV temporários valem contra tudo; senão, só contra esses tipos.
alter table characters add column resistencias_extras jsonb not null default '[]'::jsonb;
alter table characters add column temp_pv_tipos text[];

-- O alvo do ataque também manda as duas coisas.
do $$
declare
  d text;
begin
  d := pg_get_functiondef('dados_do_alvo(uuid)'::regprocedure);
  if position($x$'luta', treino_em_luta(v_ficha.id)$x$ in d) = 0 then
    raise exception 'dados_do_alvo mudou: revise esta migration';
  end if;
  d := replace(d, $x$'luta', treino_em_luta(v_ficha.id)$x$,
    $x$'luta', treino_em_luta(v_ficha.id),
      'resistencias_extras', v_ficha.resistencias_extras,
      'temp_pv_tipos', to_jsonb(v_ficha.temp_pv_tipos)$x$);
  execute d;
end;
$$;

-- p_pv_temp: quanto do dano em PV pode ser absorvido pelos PV temporários (null = todo ele).
drop function aplicar_dano_da_acao(uuid, uuid, integer, integer);
create function aplicar_dano_da_acao(p_msg_id uuid, p_token_id uuid, p_pv integer, p_san integer, p_pv_temp integer default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_msg chat_messages%rowtype;
  v_token scene_tokens%rowtype;
  v_ator campaign_actors%rowtype;
  v_ficha characters%rowtype;
  v_pv int := greatest(0, coalesce(p_pv, 0));
  v_san int := greatest(0, coalesce(p_san, 0));
  v_temp int;
begin
  select * into v_msg from chat_messages where id = p_msg_id for update;
  if v_msg.id is null or v_msg.acao is null or not pode_conduzir_acao(v_msg) then
    raise exception 'Você não pode aplicar este dano';
  end if;
  if not (v_msg.acao -> 'estado' ? 'dano') then
    raise exception 'Role o dano primeiro';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_msg.acao -> 'alvos') a where a ->> 'token_id' = p_token_id::text) then
    raise exception 'Este token não é alvo do ataque';
  end if;
  if v_msg.acao #> array['estado', 'aplicado', p_token_id::text] is not null then
    raise exception 'O dano já foi aplicado';
  end if;

  select * into v_token from scene_tokens where id = p_token_id and campaign_id = v_msg.campaign_id;
  if v_token.id is null then
    raise exception 'O alvo saiu da mesa';
  end if;
  if v_token.actor_id is not null then
    select * into v_ator from campaign_actors where id = v_token.actor_id;
  end if;
  select * into v_ficha from characters where id = coalesce(v_ator.character_id, v_token.character_id);

  if v_ficha.id is not null then
    v_temp := least(coalesce(v_ficha.temp_pv, 0), v_pv, greatest(0, coalesce(p_pv_temp, v_pv)));
    update characters set
      temp_pv = coalesce(temp_pv, 0) - v_temp,
      temp_pv_tipos = case when coalesce(temp_pv, 0) - v_temp <= 0 then null else temp_pv_tipos end,
      current_pv = greatest(0, coalesce(current_pv, 0) - (v_pv - v_temp)),
      -- Resistência de uma vez só (reação) já foi usada neste dano.
      resistencias_extras = coalesce((
        select jsonb_agg(r) from jsonb_array_elements(resistencias_extras) r where not coalesce((r ->> 'umaVez')::boolean, false)
      ), '[]'::jsonb)
    where id = v_ficha.id;
    v_temp := least(coalesce(v_ficha.temp_sanity, 0), v_san);
    update characters set
      temp_sanity = coalesce(temp_sanity, 0) - v_temp,
      current_sanity = greatest(0, coalesce(current_sanity, 0) - (v_san - v_temp))
    where id = v_ficha.id;
  elsif v_ator.creature_id is not null then
    perform set_config('arkanis.dano_da_acao', 'on', true);
    update campaign_actors set
      pv_atual = greatest(0, coalesce(pv_atual, (select pv_maximo from creatures where id = v_ator.creature_id), 0) - v_pv - v_san)
    where id = v_ator.id;
    perform set_config('arkanis.dano_da_acao', 'off', true);
  else
    raise exception 'Este token não tem ficha';
  end if;

  update chat_messages
  set acao = jsonb_set(acao, '{estado,aplicado}',
                       coalesce(acao #> '{estado,aplicado}', '{}'::jsonb) || jsonb_build_object(p_token_id::text, jsonb_build_object('pv', v_pv, 'san', v_san)))
  where id = p_msg_id;
end;
$function$;
