-- Jump scare (pedido da Millie, 16/10): sustos que o mestre deixa prontos — imagem, GIF ou vídeo, o
-- som (um dos prontos do site, um arquivo ou um link do YouTube), o jeito de aparecer e quanto tempo
-- fica. Só o mestre vê a lista (os jogadores não podem saber o que vem); o susto chega na tela deles
-- pelo canal ao vivo da mesa, na hora.

create table if not exists public.sustos (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  midia_url text,
  midia_tipo text not null default 'imagem' check (midia_tipo in ('imagem', 'video')),
  som_tipo text not null default 'pronto' check (som_tipo in ('pronto', 'arquivo', 'youtube', 'nenhum')),
  -- Pronto: o id do som do site (grito, estrondo…). Arquivo/YouTube: o endereço.
  som text,
  som_inicio integer not null default 0 check (som_inicio >= 0),  -- segundo do YouTube em que começa
  efeito text not null default 'pulo' check (efeito in ('pulo', 'zoom', 'piscar')),
  duracao numeric not null default 2.5 check (duracao between 0.5 and 30),
  tremor boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sustos_campanha on public.sustos (campaign_id, created_at desc);

alter table public.sustos enable row level security;
create policy "acesso: so aprovados" on public.sustos as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "sustos: so o mestre" on public.sustos for all
  using (is_campaign_owner(campaign_id)) with check (is_campaign_owner(campaign_id));

-- Imagens, vídeos e sons dos sustos (cada um na própria pasta).
insert into storage.buckets (id, name, public)
values ('sustos', 'sustos', true)
on conflict (id) do nothing;
create policy "sustos: leitura pública" on storage.objects for select using (bucket_id = 'sustos');
create policy "sustos: dono escreve" on storage.objects for insert
  with check (bucket_id = 'sustos' and (storage.foldername(name))[1] = auth.uid()::text and public.acesso_aprovado());
create policy "sustos: dono remove" on storage.objects for delete
  using (bucket_id = 'sustos' and (storage.foldername(name))[1] = auth.uid()::text);
