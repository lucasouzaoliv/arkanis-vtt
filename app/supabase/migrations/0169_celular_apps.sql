-- Terminar o celular (pedido da Millie, 14/10): os apps que eram só ícone ganham dados.
--   Notas      — do próprio celular (o mestre também lê).
--   Notícias   — o mestre publica manchetes pra mesa.
--   Instagram  — posts de celulares e de NPCs (o mestre posta como NPC), com curtidas.
--   E-mail     — pra um celular, de outro celular, de um NPC ou de um remetente escrito (só o mestre).
--   Mapas      — a imagem do mapa e os pontos que o mestre marca (pra todos ou pra alguns celulares).
--   Mensagem agendada — o mestre deixa pronta e ela sai quando o relógio do jogo chega na hora.

-- ---- Notas ----
create table if not exists public.celular_notas (
  id uuid primary key default gen_random_uuid(),
  celular_id uuid not null references public.celulares(id) on delete cascade,
  titulo text check (char_length(titulo) <= 120),
  texto text check (char_length(texto) <= 20000),
  minuto_no_jogo numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists celular_notas_celular on public.celular_notas (celular_id, updated_at desc);

-- ---- Notícias ----
create table if not exists public.celular_noticias (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 200),
  texto text check (char_length(texto) <= 20000),
  imagem text,
  fonte text check (char_length(fonte) <= 80),
  minuto_no_jogo numeric,
  publicada boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists celular_noticias_campanha on public.celular_noticias (campaign_id, created_at desc);

-- ---- Instagram ----
create table if not exists public.celular_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  de_celular_id uuid references public.celulares(id) on delete cascade,
  de_npc_id uuid references public.celular_npcs(id) on delete cascade,
  imagem text not null,
  legenda text check (char_length(legenda) <= 2200),
  minuto_no_jogo numeric,
  created_at timestamptz not null default now(),
  check ((de_celular_id is null) <> (de_npc_id is null))
);
create index if not exists celular_posts_campanha on public.celular_posts (campaign_id, created_at desc);

create table if not exists public.celular_curtidas (
  post_id uuid not null references public.celular_posts(id) on delete cascade,
  celular_id uuid not null references public.celulares(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, celular_id)
);

-- ---- E-mail ----
create table if not exists public.celular_emails (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  para_celular_id uuid not null references public.celulares(id) on delete cascade,
  de_celular_id uuid references public.celulares(id) on delete set null,
  de_npc_id uuid references public.celular_npcs(id) on delete set null,
  -- Remetente escrito pelo mestre ("Ordo Realitas <missoes@ordo.org>").
  remetente text check (char_length(remetente) <= 120),
  assunto text not null check (char_length(assunto) between 1 and 200),
  corpo text check (char_length(corpo) <= 20000),
  anexos jsonb not null default '[]'::jsonb,   -- [{nome, url}]
  lido boolean not null default false,
  minuto_no_jogo numeric,
  created_at timestamptz not null default now(),
  check (de_celular_id is not null or de_npc_id is not null or remetente is not null)
);
create index if not exists celular_emails_para on public.celular_emails (para_celular_id, created_at desc);

-- ---- Mapas ----
create table if not exists public.celular_mapas (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  imagem text,
  nome text check (char_length(nome) <= 80),
  updated_at timestamptz not null default now()
);

create table if not exists public.celular_mapa_pontos (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  descricao text check (char_length(descricao) <= 1000),
  -- Posição no mapa, de 0 a 1 (canto de cima à esquerda = 0,0).
  x numeric not null check (x between 0 and 1),
  y numeric not null check (y between 0 and 1),
  cor text check (char_length(cor) <= 20),
  -- "Você está aqui": o ponto é a localização de um celular.
  celular_id uuid references public.celulares(id) on delete cascade,
  -- Quem vê: nulo = todo mundo; senão, só esses celulares (e o mestre).
  visivel_para uuid[],
  created_at timestamptz not null default now()
);
create index if not exists celular_mapa_pontos_campanha on public.celular_mapa_pontos (campaign_id);

-- ---- Quem vê um celular da lista (pra pontos e curtidas) ----
create or replace function public.controla_algum_celular(p_celulares uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from unnest(coalesce(p_celulares, '{}')) x where controla_celular(x))
$$;

-- ---- RLS ----
alter table public.celular_notas enable row level security;
alter table public.celular_noticias enable row level security;
alter table public.celular_posts enable row level security;
alter table public.celular_curtidas enable row level security;
alter table public.celular_emails enable row level security;
alter table public.celular_mapas enable row level security;
alter table public.celular_mapa_pontos enable row level security;

create policy "acesso: so aprovados" on public.celular_notas as restrictive for all to public using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_noticias as restrictive for all to public using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_posts as restrictive for all to public using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_curtidas as restrictive for all to public using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_emails as restrictive for all to public using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_mapas as restrictive for all to public using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_mapa_pontos as restrictive for all to public using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));

-- Notas: o dono do celular e o mestre.
create policy "celular_notas: dono ou mestre" on public.celular_notas for all
  using (controla_celular(celular_id) or mestre_do_celular(celular_id))
  with check (controla_celular(celular_id) or mestre_do_celular(celular_id));

-- Notícias: a mesa lê as publicadas; o mestre escreve.
create policy "celular_noticias: a mesa le" on public.celular_noticias for select
  using (is_campaign_owner(campaign_id) or (publicada and is_campaign_member(campaign_id)));
create policy "celular_noticias: mestre escreve" on public.celular_noticias for insert with check (is_campaign_owner(campaign_id));
create policy "celular_noticias: mestre muda" on public.celular_noticias for update using (is_campaign_owner(campaign_id)) with check (is_campaign_owner(campaign_id));
create policy "celular_noticias: mestre apaga" on public.celular_noticias for delete using (is_campaign_owner(campaign_id));

-- Instagram: a mesa vê; posta quem controla o celular (ou o mestre, como NPC); apaga o autor ou o mestre.
create policy "celular_posts: a mesa ve" on public.celular_posts for select
  using (is_campaign_member(campaign_id) or is_campaign_owner(campaign_id));
create policy "celular_posts: autor posta" on public.celular_posts for insert with check (
  (de_celular_id is not null and controla_celular(de_celular_id)
    and exists (select 1 from celulares c where c.id = de_celular_id and c.campaign_id = celular_posts.campaign_id))
  or (de_npc_id is not null and is_campaign_owner(campaign_id)
    and exists (select 1 from celular_npcs n where n.id = de_npc_id and n.campaign_id = celular_posts.campaign_id))
);
create policy "celular_posts: autor ou mestre apaga" on public.celular_posts for delete
  using (is_campaign_owner(campaign_id) or (de_celular_id is not null and controla_celular(de_celular_id)));

create policy "celular_curtidas: a mesa ve" on public.celular_curtidas for select using (
  exists (select 1 from celular_posts p where p.id = post_id and (is_campaign_member(p.campaign_id) or is_campaign_owner(p.campaign_id)))
);
create policy "celular_curtidas: quem curte" on public.celular_curtidas for insert with check (controla_celular(celular_id));
create policy "celular_curtidas: quem descurte" on public.celular_curtidas for delete using (controla_celular(celular_id));

-- E-mail: quem recebe, quem mandou e o mestre leem. Manda quem controla o celular de origem; NPC e
-- remetente escrito, só o mestre. Quem recebe marca como lido.
create policy "celular_emails: quem pode le" on public.celular_emails for select using (
  is_campaign_owner(campaign_id) or controla_celular(para_celular_id) or (de_celular_id is not null and controla_celular(de_celular_id))
);
create policy "celular_emails: quem pode manda" on public.celular_emails for insert with check (
  exists (select 1 from celulares c where c.id = para_celular_id and c.campaign_id = celular_emails.campaign_id)
  and (
    is_campaign_owner(campaign_id)
    or (de_celular_id is not null and de_npc_id is null and remetente is null and controla_celular(de_celular_id))
  )
);
create policy "celular_emails: quem recebe marca lido" on public.celular_emails for update
  using (controla_celular(para_celular_id) or is_campaign_owner(campaign_id))
  with check (controla_celular(para_celular_id) or is_campaign_owner(campaign_id));
create policy "celular_emails: quem recebe ou o mestre apaga" on public.celular_emails for delete
  using (controla_celular(para_celular_id) or is_campaign_owner(campaign_id));
revoke update on public.celular_emails from anon, authenticated;
grant update (lido) on public.celular_emails to authenticated;

-- Mapas: a mesa vê; o mestre muda.
create policy "celular_mapas: a mesa ve" on public.celular_mapas for select using (is_campaign_member(campaign_id) or is_campaign_owner(campaign_id));
create policy "celular_mapas: mestre muda" on public.celular_mapas for all using (is_campaign_owner(campaign_id)) with check (is_campaign_owner(campaign_id));

create policy "celular_mapa_pontos: quem pode ve" on public.celular_mapa_pontos for select using (
  is_campaign_owner(campaign_id)
  or (is_campaign_member(campaign_id) and (
    (visivel_para is null and celular_id is null)
    or controla_algum_celular(visivel_para)
    or (celular_id is not null and controla_celular(celular_id))
  ))
);
create policy "celular_mapa_pontos: mestre muda" on public.celular_mapa_pontos for all using (is_campaign_owner(campaign_id)) with check (is_campaign_owner(campaign_id));

-- ---- Mensagem agendada ----
alter table public.celular_mensagens drop constraint if exists celular_mensagens_estado_check;
alter table public.celular_mensagens add constraint celular_mensagens_estado_check check (estado in ('pendente', 'enviada', 'agendada'));

drop function if exists public.enviar_no_celular(uuid, text, text, text, jsonb, uuid, uuid, jsonb, uuid);

create or replace function public.enviar_no_celular(
  p_conversa_id uuid, p_tipo text, p_texto text default null, p_arquivo_url text default null, p_arquivo jsonb default null,
  p_de_celular uuid default null, p_de_npc uuid default null, p_efeito jsonb default null, p_responde_a uuid default null,
  p_agendar_para numeric default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_conv celular_conversas%rowtype;
  v_cel celulares%rowtype;
  v_estado text := 'enviada';
  v_minuto numeric;
  v_id uuid;
begin
  select * into v_conv from celular_conversas where id = p_conversa_id;
  if v_conv.id is null or not acesso_aprovado() then
    raise exception 'Conversa não encontrada';
  end if;
  if (p_de_celular is null) = (p_de_npc is null) then
    raise exception 'Escolha quem manda: um celular ou um NPC';
  end if;
  if p_tipo not in ('texto', 'foto', 'video', 'audio', 'arquivo', 'sistema') then
    raise exception 'Tipo de mensagem inválido';
  end if;
  if p_tipo = 'texto' and nullif(trim(coalesce(p_texto, '')), '') is null then
    raise exception 'Mensagem vazia';
  end if;
  if p_tipo in ('foto', 'video', 'audio', 'arquivo') and p_arquivo_url is null then
    raise exception 'Falta o arquivo';
  end if;
  if p_agendar_para is not null and not is_campaign_owner(v_conv.campaign_id) then
    raise exception 'Só o mestre agenda mensagem';
  end if;

  if p_de_celular is not null then
    select * into v_cel from celulares where id = p_de_celular;
    if not controla_celular(p_de_celular) then
      raise exception 'Só quem controla o celular manda mensagem por ele';
    end if;
    if not exists (select 1 from celular_participantes p where p.conversa_id = p_conversa_id and p.celular_id = p_de_celular and p.saiu_em is null) then
      raise exception 'Esse celular não está nesta conversa';
    end if;
    if p_agendar_para is null and (coalesce((v_cel.efeitos ->> 'desligado')::boolean, false) or v_cel.bateria = 0) then
      raise exception 'O celular está desligado';
    end if;
    if p_agendar_para is null and coalesce((v_cel.efeitos ->> 'sem_sinal')::boolean, false) then
      v_estado := 'pendente';
    end if;
    if p_tipo = 'sistema' and not is_campaign_owner(v_conv.campaign_id) then
      raise exception 'Mensagem de sistema é do mestre';
    end if;
  else
    if not is_campaign_owner(v_conv.campaign_id) then
      raise exception 'Só o mestre responde pelos NPCs';
    end if;
    if not exists (select 1 from celular_participantes p where p.conversa_id = p_conversa_id and p.npc_id = p_de_npc and p.saiu_em is null) then
      raise exception 'Esse NPC não está nesta conversa';
    end if;
  end if;
  if p_efeito is not null and not is_campaign_owner(v_conv.campaign_id) then
    p_efeito := null;
  end if;

  v_minuto := minutos_no_jogo(v_conv.campaign_id);
  if p_agendar_para is not null then
    v_estado := 'agendada';
    v_minuto := p_agendar_para;
  end if;

  insert into celular_mensagens (conversa_id, campaign_id, de_celular_id, de_npc_id, enviado_por, tipo, texto, arquivo_url, arquivo,
                                 minuto_no_jogo, estado, efeito, responde_a)
  values (p_conversa_id, v_conv.campaign_id, p_de_celular, p_de_npc, auth.uid(), p_tipo, nullif(trim(coalesce(p_texto, '')), ''),
          p_arquivo_url, p_arquivo, v_minuto, v_estado, p_efeito,
          (select m.id from celular_mensagens m where m.id = p_responde_a and m.conversa_id = p_conversa_id))
  returning id into v_id;

  if v_estado = 'enviada' then
    update celular_conversas set ultima_em = now() where id = p_conversa_id;
  end if;
  if p_de_celular is not null and v_estado <> 'agendada' then
    update celular_participantes set lida_ate = now() where conversa_id = p_conversa_id and celular_id = p_de_celular;
  end if;
  return v_id;
end;
$$;

-- Solta as agendadas cuja hora do jogo já chegou (o mestre chama de tempos em tempos, com a mesa aberta).
create or replace function public.entregar_agendadas(p_campaign_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_agora numeric;
  v_n int;
begin
  if not acesso_aprovado() or not is_campaign_owner(p_campaign_id) then
    return 0;
  end if;
  v_agora := minutos_no_jogo(p_campaign_id);
  if v_agora is null then
    return 0;
  end if;
  with saindo as (
    update celular_mensagens set estado = 'enviada', created_at = now()
    where campaign_id = p_campaign_id and estado = 'agendada' and minuto_no_jogo <= v_agora
    returning conversa_id
  )
  update celular_conversas set ultima_em = now() where id in (select conversa_id from saindo);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---- Tempo real ----
alter table public.celular_notas replica identity full;
alter table public.celular_noticias replica identity full;
alter table public.celular_posts replica identity full;
alter table public.celular_curtidas replica identity full;
alter table public.celular_emails replica identity full;
alter table public.celular_mapas replica identity full;
alter table public.celular_mapa_pontos replica identity full;
alter publication supabase_realtime add table public.celular_notas, public.celular_noticias, public.celular_posts, public.celular_curtidas,
  public.celular_emails, public.celular_mapas, public.celular_mapa_pontos;
