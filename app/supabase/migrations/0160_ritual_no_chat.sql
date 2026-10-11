-- Ritual no chat (pedido da Millie, 11/10): a rolagem de ritual leva o elemento e o símbolo do ritual,
-- pro cartão do chat ganhar a textura do elemento bem clarinha e o símbolo do lado.
-- ritual = {"nome": "Cicatrização", "elemento": "morte", "imagem": "/conteudo/rituais/cicatrizacao.webp"}

alter table character_rolls add column if not exists ritual jsonb;

create or replace function public.rolagem_no_chat()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_modo text;
  v_foto text;
  v_conta text;
begin
  if new.campaign_id is null or new.sem_chat then
    return new;
  end if;
  select chat_mode into v_modo from campaign_members where campaign_id = new.campaign_id and user_id = new.user_id;
  select avatar_url into v_foto from characters where id = new.character_id;
  if v_modo = 'publico_usuario' then
    select display_name, avatar_url into v_conta, v_foto from profiles where id = new.user_id;
  end if;
  insert into chat_messages (campaign_id, user_id, character_id, modo, autor_nome, autor_foto, rolagem)
  values (
    new.campaign_id, new.user_id, new.character_id, coalesce(v_modo, 'publico_personagem'),
    coalesce(case when v_modo = 'publico_usuario' then v_conta end, new.character_name, 'Sem nome'),
    v_foto,
    jsonb_build_object('label', new.label, 'total', new.total, 'detail', new.detail, 'dice', new.dice, 'bonus', new.bonus,
                       'nota', new.nota, 'sem_rolagem', new.sem_rolagem, 'partes', new.partes, 'ritual', new.ritual)
  );
  return new;
end;
$function$;
