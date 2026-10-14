-- Contra-ataque (pedido 13/10): só quem é treinado em Luta contra-ataca um ataque corpo a corpo
-- que errou. dados_do_alvo passa a dizer o treino em Luta da ficha, pro botão só aparecer pra quem pode.

create or replace function public.treino_em_luta(p_character_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select cs.training::text from character_skills cs join skills s on s.id = cs.skill_id
    where cs.character_id = p_character_id and s.name = 'Luta'
  ), 'nenhum')
$$;

create or replace function public.dados_do_alvo(p_token_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_token scene_tokens%rowtype;
  v_ator campaign_actors%rowtype;
  v_ficha characters%rowtype;
  v_criatura creatures%rowtype;
begin
  select * into v_token from scene_tokens where id = p_token_id;
  if v_token.id is null or not (is_campaign_member(v_token.campaign_id) or is_campaign_owner(v_token.campaign_id)) then
    return null;
  end if;
  if v_token.layer = 'mestre' and not is_campaign_owner(v_token.campaign_id) then
    return null;
  end if;
  if v_token.actor_id is not null then
    select * into v_ator from campaign_actors where id = v_token.actor_id;
  end if;
  select * into v_ficha from characters where id = coalesce(v_ator.character_id, v_token.character_id);
  if v_ficha.id is not null then
    return jsonb_build_object(
      'tipo', 'ficha',
      'nome', coalesce(nullif(v_token.name, ''), v_ficha.name),
      'agilidade', coalesce((v_ficha.attributes ->> 'agilidade')::int, 0),
      'condicoes', coalesce(v_ficha.conditions, '[]'::jsonb),
      'condicoes_personalizadas', v_ficha.condicoes_personalizadas,
      'defesa_outros', v_ficha.defense_other_bonus,
      'bloqueio', v_ficha.bloqueio_bonus,
      'itens', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'tipo', coalesce(e.type::text, i.custom_item ->> 'type'),
          'nome', coalesce(e.name, i.custom_item ->> 'name'),
          'stats', coalesce(e.stats, i.custom_item -> 'stats', '{}'::jsonb),
          'mods', coalesce(i.applied_modifiers, '[]'::jsonb)
        )), '[]'::jsonb)
        from character_inventory i
        left join equipment_items e on e.id = i.equipment_item_id
        where i.character_id = v_ficha.id and i.is_equipped
      ),
      'poderes', to_jsonb(poderes_da_ficha(v_ficha.id)),
      'atributos', v_ficha.attributes,
      'nex', v_ficha.nex_percent,
      'class_id', v_ficha.class_id,
      'custom_class', v_ficha.custom_class,
      'max_pv_override', v_ficha.max_pv_override,
      'max_sanity_override', v_ficha.max_sanity_override,
      'max_pe_override', v_ficha.max_pe_override,
      'pv', v_ficha.current_pv,
      'san', v_ficha.current_sanity,
      'pe', v_ficha.current_pe,
      'luta', treino_em_luta(v_ficha.id)
    );
  end if;
  if v_ator.creature_id is not null then
    select * into v_criatura from creatures where id = v_ator.creature_id;
    return jsonb_build_object(
      'tipo', 'criatura',
      'nome', coalesce(nullif(v_token.name, ''), v_ator.name),
      'defesa', coalesce(v_criatura.defesa, 10),
      'resistencias', v_criatura.resistencias,
      'vulnerabilidades', v_criatura.vulnerabilidades,
      'pv_maximo', v_criatura.pv_maximo
    );
  end if;
  return jsonb_build_object('tipo', 'nenhum', 'nome', coalesce(v_token.name, 'Token'));
end;
$function$;

create or replace function public.reagir_na_acao(p_msg_id uuid, p_token_id uuid, p_reacao text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_msg chat_messages%rowtype;
  v_ficha characters%rowtype;
  v_valor int := 0;
begin
  select * into v_msg from chat_messages where id = p_msg_id for update;
  if v_msg.id is null or v_msg.acao ->> 'tipo' is distinct from 'ataque'
     or not exists (select 1 from jsonb_array_elements(v_msg.acao -> 'alvos') a where a ->> 'token_id' = p_token_id::text) then
    raise exception 'Este token não é alvo do ataque';
  end if;
  if p_reacao not in ('esquiva', 'bloqueio', 'contra') then
    raise exception 'Reação inválida';
  end if;
  if v_msg.acao #> array['estado', 'reacoes', p_token_id::text] is not null
     or v_msg.acao #> array['estado', 'bloqueios', p_token_id::text] is not null then
    raise exception 'Este alvo já reagiu a este ataque';
  end if;

  select c.* into v_ficha
  from scene_tokens t
  left join campaign_actors a on a.id = t.actor_id
  join characters c on c.id = coalesce(a.character_id, t.character_id)
  where t.id = p_token_id;
  if v_ficha.id is null or not pode_editar_ficha(v_ficha.id) then
    raise exception 'Só quem controla o alvo pode reagir';
  end if;

  if p_reacao = 'esquiva' then
    if v_msg.acao -> 'estado' ? 'ataque' then
      raise exception 'O ataque já foi rolado; não dá mais pra esquivar';
    end if;
    v_valor := bonus_de_reflexos(v_ficha.id);
  elsif p_reacao = 'bloqueio' then
    if v_msg.acao -> 'estado' ? 'dano' then
      raise exception 'O dano já foi rolado';
    end if;
    v_valor := greatest(0, v_ficha.bloqueio_bonus);
  else
    if not (v_msg.acao -> 'estado' ? 'ataque') or (v_msg.acao #>> array['estado', 'ataque', 'acertos', p_token_id::text])::boolean then
      raise exception 'Só dá pra contra-atacar um ataque que errou';
    end if;
    if coalesce((v_msg.acao #>> '{ataque,corpo}')::boolean, false) is false then
      raise exception 'Só dá pra contra-atacar ataque corpo a corpo';
    end if;
    if treino_em_luta(v_ficha.id) = 'nenhum' then
      raise exception 'Só quem é treinado em Luta pode contra-atacar';
    end if;
  end if;

  update chat_messages
  set acao = jsonb_set(acao, '{estado,reacoes}',
                       coalesce(acao #> '{estado,reacoes}', '{}'::jsonb) || jsonb_build_object(p_token_id::text, jsonb_build_object('tipo', p_reacao, 'valor', v_valor)))
  where id = p_msg_id;
end;
$function$;
