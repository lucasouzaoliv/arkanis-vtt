-- Documentos encontráveis (KAN-118) e Quadro de pistas (KAN-117), pedidos da Millie 27/10.
--
-- Documentos: o mestre escreve (carta, jornal, relatório, diário, bilhete) e esconde no mapa
-- (um token com documento_id). O jogador que clica nele "acha": entra em encontrado_por e só aí
-- consegue ler. O mestre também pode mostrar pra todo mundo de uma vez (revelado_todos).
--
-- Quadro de pistas: mural de cortiça da campanha, de todo mundo. Notas, fotos e documentos
-- presos com tachinha e ligados por barbante vermelho.

create table campaign_documents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  titulo text not null default 'Documento',
  estilo text not null default 'carta' check (estilo in ('carta', 'jornal', 'relatorio', 'diario', 'bilhete')),
  texto text not null default '',
  assinatura text,
  imagem_url text,
  revelado_todos boolean not null default false,
  encontrado_por uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index campaign_documents_campanha on campaign_documents (campaign_id);

alter table campaign_documents enable row level security;
create policy "acesso: so aprovados" on public.campaign_documents as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "documentos: mestre ou quem achou le" on campaign_documents for select using (
  is_campaign_owner(campaign_id)
  or (is_campaign_member(campaign_id) and (revelado_todos or auth.uid() = any(encontrado_por)))
);
create policy "documentos: mestre cria" on campaign_documents for insert with check (is_campaign_owner(campaign_id));
create policy "documentos: mestre edita" on campaign_documents for update using (is_campaign_owner(campaign_id)) with check (is_campaign_owner(campaign_id));
create policy "documentos: mestre exclui" on campaign_documents for delete using (is_campaign_owner(campaign_id));
alter publication supabase_realtime add table campaign_documents;

-- O papel no mapa que esconde o documento.
alter table scene_tokens add column documento_id uuid references campaign_documents(id) on delete cascade;

-- Jogador clicou no papel: acha o documento (se o token não estiver escondido na camada do mestre).
create function public.achar_documento(p_token_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tok scene_tokens%rowtype;
begin
  select * into v_tok from scene_tokens where id = p_token_id;
  if v_tok.id is null or v_tok.documento_id is null then
    raise exception 'Não tem documento aqui';
  end if;
  if not (is_campaign_member(v_tok.campaign_id) or is_campaign_owner(v_tok.campaign_id)) then
    raise exception 'Você não está nesta mesa';
  end if;
  if v_tok.layer = 'mestre' and not is_campaign_owner(v_tok.campaign_id) then
    raise exception 'Não tem documento aqui';
  end if;
  update campaign_documents
     set encontrado_por = array_append(encontrado_por, auth.uid())
   where id = v_tok.documento_id and not (auth.uid() = any(encontrado_por));
  return v_tok.documento_id;
end;
$$;
revoke execute on function public.achar_documento(uuid) from public, anon;
grant execute on function public.achar_documento(uuid) to authenticated;

create table clue_board_cards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null default 'nota' check (tipo in ('nota', 'foto', 'documento')),
  texto text not null default '',
  imagem_url text,
  documento_id uuid references campaign_documents(id) on delete cascade,
  x numeric not null default 0,
  y numeric not null default 0,
  rotacao numeric not null default 0,
  created_at timestamptz not null default now()
);

create table clue_board_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  de uuid not null references clue_board_cards(id) on delete cascade,
  para uuid not null references clue_board_cards(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (de, para),
  check (de <> para)
);

create index clue_board_cards_campanha on clue_board_cards (campaign_id);
create index clue_board_links_campanha on clue_board_links (campaign_id);

alter table clue_board_cards enable row level security;
alter table clue_board_links enable row level security;
create policy "acesso: so aprovados" on public.clue_board_cards as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.clue_board_links as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "pistas: a mesa toda mexe" on clue_board_cards for all
  using (is_campaign_owner(campaign_id) or is_campaign_member(campaign_id))
  with check (is_campaign_owner(campaign_id) or is_campaign_member(campaign_id));
create policy "barbantes: a mesa toda mexe" on clue_board_links for all
  using (is_campaign_owner(campaign_id) or is_campaign_member(campaign_id))
  with check (
    (is_campaign_owner(campaign_id) or is_campaign_member(campaign_id))
    and exists (select 1 from clue_board_cards c where c.id = de and c.campaign_id = clue_board_links.campaign_id)
    and exists (select 1 from clue_board_cards c where c.id = para and c.campaign_id = clue_board_links.campaign_id)
  );
alter publication supabase_realtime add table clue_board_cards;
alter publication supabase_realtime add table clue_board_links;
