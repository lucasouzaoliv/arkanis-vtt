-- Instagram (pedido 14/10): o NPC também curte (o mestre, pelo celular do NPC), e todo mundo comenta.

-- Curtida: de um celular ou de um NPC.
alter table public.celular_curtidas drop constraint if exists celular_curtidas_pkey;
alter table public.celular_curtidas add column if not exists id uuid not null default gen_random_uuid();
alter table public.celular_curtidas add primary key (id);
alter table public.celular_curtidas alter column celular_id drop not null;
alter table public.celular_curtidas add column if not exists npc_id uuid references public.celular_npcs(id) on delete cascade;
alter table public.celular_curtidas add constraint celular_curtidas_um_lado check ((celular_id is null) <> (npc_id is null));
create unique index if not exists celular_curtidas_celular on public.celular_curtidas (post_id, celular_id) where celular_id is not null;
create unique index if not exists celular_curtidas_npc on public.celular_curtidas (post_id, npc_id) where npc_id is not null;

drop policy if exists "celular_curtidas: quem curte" on public.celular_curtidas;
drop policy if exists "celular_curtidas: quem descurte" on public.celular_curtidas;
create policy "celular_curtidas: quem curte" on public.celular_curtidas for insert with check (
  (celular_id is not null and controla_celular(celular_id))
  or (npc_id is not null and exists (select 1 from celular_posts p where p.id = post_id and is_campaign_owner(p.campaign_id)))
);
create policy "celular_curtidas: quem descurte" on public.celular_curtidas for delete using (
  (celular_id is not null and controla_celular(celular_id))
  or (npc_id is not null and exists (select 1 from celular_posts p where p.id = post_id and is_campaign_owner(p.campaign_id)))
);

-- Comentários.
create table if not exists public.celular_comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.celular_posts(id) on delete cascade,
  de_celular_id uuid references public.celulares(id) on delete cascade,
  de_npc_id uuid references public.celular_npcs(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1000),
  minuto_no_jogo numeric,
  created_at timestamptz not null default now(),
  check ((de_celular_id is null) <> (de_npc_id is null))
);
create index if not exists celular_comentarios_post on public.celular_comentarios (post_id, created_at);

alter table public.celular_comentarios enable row level security;
create policy "acesso: so aprovados" on public.celular_comentarios as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "celular_comentarios: a mesa ve" on public.celular_comentarios for select using (
  exists (select 1 from celular_posts p where p.id = post_id and (is_campaign_member(p.campaign_id) or is_campaign_owner(p.campaign_id)))
);
create policy "celular_comentarios: quem comenta" on public.celular_comentarios for insert with check (
  (de_celular_id is not null and controla_celular(de_celular_id))
  or (de_npc_id is not null and exists (select 1 from celular_posts p where p.id = post_id and is_campaign_owner(p.campaign_id)))
);
create policy "celular_comentarios: autor ou mestre apaga" on public.celular_comentarios for delete using (
  (de_celular_id is not null and controla_celular(de_celular_id))
  or exists (select 1 from celular_posts p where p.id = post_id and is_campaign_owner(p.campaign_id))
);

alter table public.celular_comentarios replica identity full;
alter publication supabase_realtime add table public.celular_comentarios;
