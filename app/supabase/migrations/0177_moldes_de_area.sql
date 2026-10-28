-- Moldes de área (KAN-119, pedido da Millie 27/10): círculo, cone, linha e quadrado que qualquer
-- um coloca no mapa (em metros pela grade) e todo mundo vê, com quem foi pego marcado.
-- x/y = origem (centro do círculo, ponta do cone/linha, canto do quadrado); angulo em graus.

create table scene_templates (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  forma text not null check (forma in ('circulo', 'cone', 'linha', 'quadrado')),
  x numeric not null,
  y numeric not null,
  angulo numeric not null default 0,
  metros numeric not null check (metros > 0),
  created_at timestamptz not null default now()
);

create index scene_templates_cena on scene_templates (scene_id);

alter table scene_templates enable row level security;
create policy "acesso: so aprovados" on public.scene_templates as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "moldes: membros veem" on scene_templates for select using (is_campaign_owner(campaign_id) or is_campaign_member(campaign_id));
create policy "moldes: membro coloca" on scene_templates for insert with check (
  author_id = auth.uid()
  and (is_campaign_owner(campaign_id) or is_campaign_member(campaign_id))
  and exists (select 1 from scenes s where s.id = scene_id and s.campaign_id = scene_templates.campaign_id)
);
create policy "moldes: autor ou mestre mexe" on scene_templates for update
  using (author_id = auth.uid() or is_campaign_owner(campaign_id))
  with check (author_id = auth.uid() or is_campaign_owner(campaign_id));
create policy "moldes: autor ou mestre tira" on scene_templates for delete
  using (author_id = auth.uid() or is_campaign_owner(campaign_id));

alter publication supabase_realtime add table scene_templates;
