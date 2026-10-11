-- dados_do_alvo manda o PE máximo digitado à mão (max_pe_override, 0157) pra cura de PE na mesa.

create or replace function dados_do_alvo(p_token_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
      'pe', v_ficha.current_pe
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
$$;
