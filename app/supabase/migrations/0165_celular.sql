-- Celular dos personagens (pedido da Millie, 13/10) — só a parte do banco; as telas esperam as
-- referências visuais dela.
--
-- Cada personagem da campanha tem um celular (perfil, capinha, papel de parede, toques). Os contatos
-- são outros celulares da mesa ou NPCs (o pai da Nina, o Veríssimo), e quem fala pelos NPCs é o mestre.
-- Conversas (diretas ou em grupo) têm participantes (celulares ou NPCs) e mensagens (texto, foto,
-- vídeo, áudio). O mestre lê tudo e controla os efeitos do aparelho (sem sinal, interferência, brilho
-- de ritual, bateria). Ligações só fazem o "teatro" (tocar, atender, cronômetro); a voz é no Discord.
-- A hora de cada mensagem e ligação é a do relógio do jogo (minutos desde o início da campanha).

-- ---- Hora do jogo: a mesma conta de minutosAgora() em pages/Mesa/tempo.ts ----
create or replace function public.minutos_no_jogo(p_campaign_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when c.configuracoes -> 'tempo' is null then null
    when nullif(c.configuracoes #>> '{tempo,rodando}', '') is null then coalesce((c.configuracoes #>> '{tempo,minutos}')::numeric, 0)
    else coalesce((c.configuracoes #>> '{tempo,minutos}')::numeric, 0)
      + greatest(0, extract(epoch from (now() - (c.configuracoes #>> '{tempo,rodando}')::timestamptz)) / 60)
        * coalesce((c.configuracoes #>> '{tempo,velocidade}')::numeric, 1)
  end
  from campaigns c where c.id = p_campaign_id
$$;

-- ---- Celular de cada personagem ----
create table if not exists public.celulares (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null unique references public.characters(id) on delete cascade,
  modelo text not null default 'android' check (modelo in ('iphone', 'android')),
  capinha jsonb not null default '{}'::jsonb,          -- {cor, textura}
  papel_de_parede text,
  papel_de_bloqueio text,
  nome_no_perfil text check (char_length(nome_no_perfil) <= 80),
  foto_perfil text,
  recado text check (char_length(recado) <= 200),     -- o "status" do perfil
  toque_padrao text,                                   -- mp3 da ligação
  toque_mensagem text,                                 -- mp3 da notificação
  numero text check (char_length(numero) <= 30),
  -- Primeira vez: a pessoa configura o aparelho (idioma, modelo). Depois disso, configurado = true.
  configurado boolean not null default false,
  idioma text not null default 'pt-BR' check (char_length(idioma) <= 10),
  -- Apps instalados, na ordem da tela inicial. Vem só com o básico; o resto se baixa na loja
  -- (App Store no iPhone, Play Store no Android). {instalados: [ids], dock: [ids], paginas: [[ids]]}
  apps jsonb not null default '{"instalados": ["telefone", "mensagens", "configuracoes", "mapas", "loja"]}'::jsonb,
  -- Controlados só pelo mestre (efeito_no_celular): {sem_sinal, interferencia, brilho, desligado}.
  efeitos jsonb not null default '{}'::jsonb,
  bateria smallint not null default 100 check (bateria between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists celulares_campanha on public.celulares (campaign_id);

-- NPCs que aparecem nos celulares. Quem cria pode ser o mestre ou um jogador (o pai da Nina, com
-- dono_character_id = Nina); quem responde por eles é sempre o mestre.
create table if not exists public.celular_npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  foto text,
  numero text check (char_length(numero) <= 30),
  recado text check (char_length(recado) <= 200),
  toque text,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dono_character_id uuid references public.characters(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists celular_npcs_campanha on public.celular_npcs (campaign_id);

-- Agenda de cada celular: um outro celular da mesa ou um NPC, com o nome/foto/toque que o dono deu.
create table if not exists public.celular_contatos (
  id uuid primary key default gen_random_uuid(),
  celular_id uuid not null references public.celulares(id) on delete cascade,
  contato_celular_id uuid references public.celulares(id) on delete cascade,
  npc_id uuid references public.celular_npcs(id) on delete cascade,
  apelido text check (char_length(apelido) <= 80),
  foto text,
  toque text,
  favorito boolean not null default false,
  bloqueado boolean not null default false,
  -- O mestre pode pôr um contato que aparece como "Número desconhecido".
  desconhecido boolean not null default false,
  created_at timestamptz not null default now(),
  check ((contato_celular_id is null) <> (npc_id is null)),
  check (contato_celular_id is distinct from celular_id)
);
create unique index if not exists celular_contatos_celular on public.celular_contatos (celular_id, contato_celular_id) where contato_celular_id is not null;
create unique index if not exists celular_contatos_npc on public.celular_contatos (celular_id, npc_id) where npc_id is not null;

create table if not exists public.celular_conversas (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  tipo text not null check (tipo in ('direta', 'grupo')),
  nome text check (char_length(nome) <= 80),
  foto text,
  descricao text check (char_length(descricao) <= 500),
  criada_por_celular uuid references public.celulares(id) on delete set null,
  ultima_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists celular_conversas_campanha on public.celular_conversas (campaign_id, ultima_em desc);

create table if not exists public.celular_participantes (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.celular_conversas(id) on delete cascade,
  celular_id uuid references public.celulares(id) on delete cascade,
  npc_id uuid references public.celular_npcs(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('admin', 'membro')),
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz,
  lida_ate timestamptz,       -- até onde este celular leu (contador de não lidas)
  silenciada boolean not null default false,
  check ((celular_id is null) <> (npc_id is null))
);
create unique index if not exists celular_participantes_celular on public.celular_participantes (conversa_id, celular_id) where celular_id is not null;
create unique index if not exists celular_participantes_npc on public.celular_participantes (conversa_id, npc_id) where npc_id is not null;
create index if not exists celular_participantes_do_celular on public.celular_participantes (celular_id);

create table if not exists public.celular_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.celular_conversas(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  de_celular_id uuid references public.celulares(id) on delete set null,
  de_npc_id uuid references public.celular_npcs(id) on delete set null,
  enviado_por uuid not null references auth.users(id) on delete cascade,  -- quem clicou (o mestre, no NPC)
  tipo text not null check (tipo in ('texto', 'foto', 'video', 'audio', 'arquivo', 'sistema')),
  texto text check (char_length(texto) <= 4000),
  arquivo_url text,
  arquivo jsonb,              -- {nome, duracao, largura, altura}
  minuto_no_jogo numeric,     -- hora no relógio do jogo
  -- Sem sinal: fica "pendente" (só quem mandou e o mestre veem) até o sinal voltar.
  estado text not null default 'enviada' check (estado in ('pendente', 'enviada')),
  efeito jsonb,               -- {corrompida, some_apos_ler, elemento}
  responde_a uuid references public.celular_mensagens(id) on delete set null,
  apagada boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists celular_mensagens_conversa on public.celular_mensagens (conversa_id, created_at);

-- Galeria: fotos e vídeos guardados no celular (de recordação, ou salvos de uma conversa).
create table if not exists public.celular_galeria (
  id uuid primary key default gen_random_uuid(),
  celular_id uuid not null references public.celulares(id) on delete cascade,
  url text not null,
  tipo text not null default 'foto' check (tipo in ('foto', 'video')),
  legenda text check (char_length(legenda) <= 300),
  minuto_no_jogo numeric,
  mensagem_id uuid references public.celular_mensagens(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists celular_galeria_celular on public.celular_galeria (celular_id, created_at desc);

create table if not exists public.celular_ligacoes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  de_celular_id uuid references public.celulares(id) on delete cascade,
  de_npc_id uuid references public.celular_npcs(id) on delete cascade,
  para_celular_id uuid references public.celulares(id) on delete cascade,
  para_npc_id uuid references public.celular_npcs(id) on delete cascade,
  estado text not null default 'chamando' check (estado in ('chamando', 'em_curso', 'recusada', 'perdida', 'encerrada', 'sem_sinal')),
  iniciada_por uuid not null references auth.users(id) on delete cascade,
  minuto_no_jogo numeric,
  iniciada_em timestamptz not null default now(),
  atendida_em timestamptz,
  encerrada_em timestamptz,
  check ((de_celular_id is null) <> (de_npc_id is null)),
  check ((para_celular_id is null) <> (para_npc_id is null))
);
create index if not exists celular_ligacoes_campanha on public.celular_ligacoes (campaign_id, iniciada_em desc);

-- ---- Quem pode o quê ----

-- Controla o celular quem pode editar a ficha (dono, quem ganhou a ficha como Dono, o mestre).
create or replace function public.controla_celular(p_celular_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from celulares c where c.id = p_celular_id and pode_editar_ficha(c.character_id))
$$;

create or replace function public.mestre_do_celular(p_celular_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from celulares c where c.id = p_celular_id and is_campaign_owner(c.campaign_id))
$$;

-- Participa: algum celular que eu controlo está na conversa (e não saiu). O mestre vê todas.
create or replace function public.participa_da_conversa(p_conversa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select acesso_aprovado() and (
    exists (select 1 from celular_conversas v where v.id = p_conversa_id and is_campaign_owner(v.campaign_id))
    or exists (
      select 1 from celular_participantes p
      where p.conversa_id = p_conversa_id and p.celular_id is not null and p.saiu_em is null and controla_celular(p.celular_id)
    )
  )
$$;

-- NPC: o mestre vê todos; o jogador vê os que criou, os da agenda dele e os das conversas dele.
create or replace function public.pode_ver_npc(p_npc_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select acesso_aprovado() and exists (
    select 1 from celular_npcs n
    where n.id = p_npc_id and (
      is_campaign_owner(n.campaign_id)
      or n.criado_por = auth.uid()
      or exists (select 1 from celular_contatos k where k.npc_id = n.id and controla_celular(k.celular_id))
      or exists (select 1 from celular_participantes p where p.npc_id = n.id and participa_da_conversa(p.conversa_id))
      or exists (select 1 from celular_ligacoes l where (l.de_npc_id = n.id or l.para_npc_id = n.id)
                 and (controla_celular(l.de_celular_id) or controla_celular(l.para_celular_id)))
    )
  )
$$;

-- ---- RLS ----
alter table public.celulares enable row level security;
alter table public.celular_npcs enable row level security;
alter table public.celular_contatos enable row level security;
alter table public.celular_conversas enable row level security;
alter table public.celular_participantes enable row level security;
alter table public.celular_mensagens enable row level security;
alter table public.celular_galeria enable row level security;
alter table public.celular_ligacoes enable row level security;

create policy "acesso: so aprovados" on public.celulares as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_npcs as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_contatos as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_conversas as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_participantes as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_mensagens as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_galeria as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));
create policy "acesso: so aprovados" on public.celular_ligacoes as restrictive for all to public
  using ((select public.acesso_aprovado())) with check ((select public.acesso_aprovado()));

-- Celular: a mesa vê o perfil dos outros (nome, foto, recado aparecem nos grupos); o dono muda o dele.
-- Quem cria é a função abrir_celular; efeitos e bateria só o mestre (efeito_no_celular).
create policy "celulares: a mesa ve" on public.celulares for select
  using (is_campaign_member(campaign_id) or is_campaign_owner(campaign_id));
create policy "celulares: dono muda" on public.celulares for update
  using (controla_celular(id)) with check (controla_celular(id));
revoke update on public.celulares from anon, authenticated;
grant update (modelo, capinha, papel_de_parede, papel_de_bloqueio, nome_no_perfil, foto_perfil, recado, toque_padrao, toque_mensagem, numero,
  configurado, idioma, apps, updated_at)
  on public.celulares to authenticated;

create policy "celular_npcs: quem pode ve" on public.celular_npcs for select using (pode_ver_npc(id));
create policy "celular_npcs: membro cria" on public.celular_npcs for insert with check (
  criado_por = (select auth.uid())
  and (is_campaign_owner(campaign_id) or (is_campaign_member(campaign_id) and (dono_character_id is null or pode_editar_ficha(dono_character_id))))
);
create policy "celular_npcs: quem criou ou o mestre muda" on public.celular_npcs for update
  using (criado_por = (select auth.uid()) or is_campaign_owner(campaign_id))
  with check (criado_por = (select auth.uid()) or is_campaign_owner(campaign_id));
create policy "celular_npcs: quem criou ou o mestre apaga" on public.celular_npcs for delete
  using (criado_por = (select auth.uid()) or is_campaign_owner(campaign_id));

-- Agenda: o dono do celular (e o mestre) mexe à vontade, desde que o contato seja da mesma mesa.
create policy "celular_contatos: dono ou mestre ve" on public.celular_contatos for select
  using (controla_celular(celular_id) or mestre_do_celular(celular_id));
create policy "celular_contatos: dono ou mestre adiciona" on public.celular_contatos for insert with check (
  (controla_celular(celular_id) or mestre_do_celular(celular_id))
  and (
    (contato_celular_id is not null and exists (
      select 1 from celulares a, celulares b where a.id = celular_id and b.id = contato_celular_id and a.campaign_id = b.campaign_id))
    or (npc_id is not null and pode_ver_npc(npc_id) and exists (
      select 1 from celulares a, celular_npcs n where a.id = celular_id and n.id = npc_id and a.campaign_id = n.campaign_id))
  )
  -- "Número desconhecido" é coisa do mestre.
  and (not desconhecido or mestre_do_celular(celular_id))
);
create policy "celular_contatos: dono ou mestre muda" on public.celular_contatos for update
  using (controla_celular(celular_id) or mestre_do_celular(celular_id))
  with check ((controla_celular(celular_id) or mestre_do_celular(celular_id)) and (not desconhecido or mestre_do_celular(celular_id)));
create policy "celular_contatos: dono ou mestre apaga" on public.celular_contatos for delete
  using (controla_celular(celular_id) or mestre_do_celular(celular_id));
revoke update on public.celular_contatos from anon, authenticated;
grant update (apelido, foto, toque, favorito, bloqueado, desconhecido) on public.celular_contatos to authenticated;

-- Conversas: quem participa vê; nome/foto/descrição do grupo mudam pelo admin ou pelo mestre.
-- Criar e mexer em participantes é pelas funções (criar_conversa, adicionar_na_conversa, sair_da_conversa).
create policy "celular_conversas: participante ve" on public.celular_conversas for select using (participa_da_conversa(id));
create policy "celular_conversas: admin ou mestre muda" on public.celular_conversas for update using (
  is_campaign_owner(campaign_id) or exists (
    select 1 from celular_participantes p where p.conversa_id = celular_conversas.id and p.papel = 'admin' and p.saiu_em is null and controla_celular(p.celular_id))
);
create policy "celular_conversas: mestre apaga" on public.celular_conversas for delete using (is_campaign_owner(campaign_id));
revoke update on public.celular_conversas from anon, authenticated;
grant update (nome, foto, descricao) on public.celular_conversas to authenticated;

create policy "celular_participantes: participante ve" on public.celular_participantes for select using (participa_da_conversa(conversa_id));
-- Cada um marca o próprio "lido até" e o silenciar.
create policy "celular_participantes: o proprio marca lido" on public.celular_participantes for update
  using (celular_id is not null and controla_celular(celular_id)) with check (celular_id is not null and controla_celular(celular_id));
revoke update on public.celular_participantes from anon, authenticated;
grant update (lida_ate, silenciada) on public.celular_participantes to authenticated;

-- Mensagens: quem participa lê as enviadas; a pendente (sem sinal) só quem mandou e o mestre.
-- Enviar e apagar é pelas funções (enviar_no_celular, apagar_mensagem_do_celular).
create policy "celular_mensagens: participante le" on public.celular_mensagens for select using (
  participa_da_conversa(conversa_id)
  and (estado = 'enviada' or is_campaign_owner(campaign_id) or (de_celular_id is not null and controla_celular(de_celular_id)))
);
create policy "celular_mensagens: mestre apaga" on public.celular_mensagens for delete using (is_campaign_owner(campaign_id));

create policy "celular_galeria: dono ou mestre ve" on public.celular_galeria for select
  using (controla_celular(celular_id) or mestre_do_celular(celular_id));
create policy "celular_galeria: dono ou mestre guarda" on public.celular_galeria for insert
  with check (controla_celular(celular_id) or mestre_do_celular(celular_id));
create policy "celular_galeria: dono ou mestre muda" on public.celular_galeria for update
  using (controla_celular(celular_id) or mestre_do_celular(celular_id))
  with check (controla_celular(celular_id) or mestre_do_celular(celular_id));
create policy "celular_galeria: dono ou mestre apaga" on public.celular_galeria for delete
  using (controla_celular(celular_id) or mestre_do_celular(celular_id));

-- Ligações: os dois lados (e o mestre, que atende pelos NPCs) veem. Tudo muda pelas funções.
create policy "celular_ligacoes: quem esta na ligacao ve" on public.celular_ligacoes for select using (
  is_campaign_owner(campaign_id)
  or (de_celular_id is not null and controla_celular(de_celular_id))
  or (para_celular_id is not null and controla_celular(para_celular_id))
);

-- ---- Funções ----

-- Abre (e cria na primeira vez) o celular da ficha. A ficha precisa estar numa campanha.
create or replace function public.abrir_celular(p_character_id uuid)
returns public.celulares language plpgsql security definer set search_path = public as $$
declare
  v_ficha characters%rowtype;
  v_cel celulares%rowtype;
begin
  if not acesso_aprovado() or not pode_editar_ficha(p_character_id) then
    raise exception 'Só quem controla a ficha abre o celular dela';
  end if;
  select * into v_ficha from characters where id = p_character_id;
  if v_ficha.campaign_id is null then
    raise exception 'A ficha precisa estar numa campanha pra ter celular';
  end if;
  select * into v_cel from celulares where character_id = p_character_id;
  if v_cel.id is null then
    -- Um número de enfeite, no formato brasileiro: (11) 9XXXX-XXXX.
    insert into celulares (campaign_id, character_id, nome_no_perfil, foto_perfil, numero)
    values (v_ficha.campaign_id, p_character_id, v_ficha.name, v_ficha.avatar_url,
            '(11) 9' || lpad(floor(random() * 10000)::text, 4, '0') || '-' || lpad(floor(random() * 10000)::text, 4, '0'))
    returning * into v_cel;
  elsif v_cel.campaign_id <> v_ficha.campaign_id then
    -- A ficha mudou de campanha: o celular vai junto.
    update celulares set campaign_id = v_ficha.campaign_id where id = v_cel.id returning * into v_cel;
  end if;
  return v_cel;
end;
$$;

-- Cria uma conversa. Direta: dois lados (se já existe, devolve a mesma). Grupo: quem cria vira admin.
-- p_celulares e p_npcs são os outros participantes.
create or replace function public.criar_conversa(
  p_de_celular uuid, p_tipo text, p_celulares uuid[] default '{}', p_npcs uuid[] default '{}',
  p_nome text default null, p_foto text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cel celulares%rowtype;
  v_id uuid;
  v_outro uuid;
begin
  select * into v_cel from celulares where id = p_de_celular;
  if v_cel.id is null or not acesso_aprovado() or not (controla_celular(v_cel.id) or is_campaign_owner(v_cel.campaign_id)) then
    raise exception 'Só quem controla o celular cria conversa nele';
  end if;
  if p_tipo not in ('direta', 'grupo') then
    raise exception 'Tipo de conversa inválido';
  end if;
  if exists (select 1 from unnest(p_celulares) x where not exists (select 1 from celulares c where c.id = x and c.campaign_id = v_cel.campaign_id))
     or exists (select 1 from unnest(p_npcs) x where not exists (select 1 from celular_npcs n where n.id = x and n.campaign_id = v_cel.campaign_id)) then
    raise exception 'Todo mundo da conversa precisa ser da mesma mesa';
  end if;
  if exists (select 1 from unnest(p_npcs) x where not pode_ver_npc(x)) then
    raise exception 'Contato desconhecido';
  end if;

  if p_tipo = 'direta' then
    if coalesce(array_length(p_celulares, 1), 0) + coalesce(array_length(p_npcs, 1), 0) <> 1 then
      raise exception 'Conversa direta é com uma pessoa só';
    end if;
    -- A mesma conversa de antes, se já existir entre os dois.
    select v.id into v_id
    from celular_conversas v
    join celular_participantes a on a.conversa_id = v.id and a.celular_id = p_de_celular
    join celular_participantes b on b.conversa_id = v.id
      and (b.celular_id = any(p_celulares) or b.npc_id = any(p_npcs))
    where v.tipo = 'direta'
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into celular_conversas (campaign_id, tipo, nome, foto, criada_por_celular)
  values (v_cel.campaign_id, p_tipo, case when p_tipo = 'grupo' then nullif(trim(p_nome), '') end, p_foto, p_de_celular)
  returning id into v_id;

  insert into celular_participantes (conversa_id, celular_id, papel, lida_ate)
  values (v_id, p_de_celular, case when p_tipo = 'grupo' then 'admin' else 'membro' end, now());
  foreach v_outro in array p_celulares loop
    if v_outro <> p_de_celular then
      insert into celular_participantes (conversa_id, celular_id) values (v_id, v_outro) on conflict do nothing;
    end if;
  end loop;
  foreach v_outro in array p_npcs loop
    insert into celular_participantes (conversa_id, npc_id) values (v_id, v_outro) on conflict do nothing;
  end loop;
  return v_id;
end;
$$;

-- Adicionar alguém num grupo: admin do grupo ou mestre.
create or replace function public.adicionar_na_conversa(p_conversa_id uuid, p_celular uuid default null, p_npc uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_conv celular_conversas%rowtype;
begin
  select * into v_conv from celular_conversas where id = p_conversa_id;
  if v_conv.id is null or v_conv.tipo <> 'grupo' or not acesso_aprovado() then
    raise exception 'Só dá pra adicionar gente em grupo';
  end if;
  if not (is_campaign_owner(v_conv.campaign_id) or exists (
    select 1 from celular_participantes p where p.conversa_id = p_conversa_id and p.papel = 'admin' and p.saiu_em is null and controla_celular(p.celular_id))) then
    raise exception 'Só o admin do grupo adiciona pessoas';
  end if;
  if (p_celular is null) = (p_npc is null) then
    raise exception 'Escolha um celular ou um NPC';
  end if;
  if p_celular is not null and not exists (select 1 from celulares c where c.id = p_celular and c.campaign_id = v_conv.campaign_id) then
    raise exception 'Esse celular não é desta mesa';
  end if;
  if p_npc is not null and not (exists (select 1 from celular_npcs n where n.id = p_npc and n.campaign_id = v_conv.campaign_id) and pode_ver_npc(p_npc)) then
    raise exception 'Esse contato não é desta mesa';
  end if;

  if p_celular is not null then
    update celular_participantes set saiu_em = null, entrou_em = now() where conversa_id = p_conversa_id and celular_id = p_celular;
    if not found then insert into celular_participantes (conversa_id, celular_id) values (p_conversa_id, p_celular); end if;
  else
    update celular_participantes set saiu_em = null, entrou_em = now() where conversa_id = p_conversa_id and npc_id = p_npc;
    if not found then insert into celular_participantes (conversa_id, npc_id) values (p_conversa_id, p_npc); end if;
  end if;
end;
$$;

-- Sair do grupo (o próprio celular) ou remover alguém (admin/mestre).
create or replace function public.sair_da_conversa(p_conversa_id uuid, p_celular uuid default null, p_npc uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_conv celular_conversas%rowtype;
  v_admin boolean;
begin
  select * into v_conv from celular_conversas where id = p_conversa_id;
  if v_conv.id is null or not acesso_aprovado() then
    raise exception 'Conversa não encontrada';
  end if;
  v_admin := is_campaign_owner(v_conv.campaign_id) or exists (
    select 1 from celular_participantes p where p.conversa_id = p_conversa_id and p.papel = 'admin' and p.saiu_em is null and controla_celular(p.celular_id));
  if not (v_admin or (p_celular is not null and controla_celular(p_celular))) then
    raise exception 'Só o admin do grupo remove outras pessoas';
  end if;
  update celular_participantes set saiu_em = now()
  where conversa_id = p_conversa_id and (celular_id = p_celular or npc_id = p_npc) and saiu_em is null;
end;
$$;

-- Promover/rebaixar admin do grupo.
create or replace function public.papel_na_conversa(p_conversa_id uuid, p_participante uuid, p_papel text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_conv celular_conversas%rowtype;
begin
  select * into v_conv from celular_conversas where id = p_conversa_id;
  if v_conv.id is null or p_papel not in ('admin', 'membro') or not acesso_aprovado() then
    raise exception 'Pedido inválido';
  end if;
  if not (is_campaign_owner(v_conv.campaign_id) or exists (
    select 1 from celular_participantes p where p.conversa_id = p_conversa_id and p.papel = 'admin' and p.saiu_em is null and controla_celular(p.celular_id))) then
    raise exception 'Só o admin do grupo muda isso';
  end if;
  update celular_participantes set papel = p_papel where id = p_participante and conversa_id = p_conversa_id;
end;
$$;

-- Mandar mensagem. Por um celular (quem controla) ou por um NPC (só o mestre).
-- Celular sem sinal: a mensagem fica pendente até o mestre devolver o sinal.
create or replace function public.enviar_no_celular(
  p_conversa_id uuid, p_tipo text, p_texto text default null, p_arquivo_url text default null, p_arquivo jsonb default null,
  p_de_celular uuid default null, p_de_npc uuid default null, p_efeito jsonb default null, p_responde_a uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_conv celular_conversas%rowtype;
  v_cel celulares%rowtype;
  v_estado text := 'enviada';
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

  if p_de_celular is not null then
    select * into v_cel from celulares where id = p_de_celular;
    if not controla_celular(p_de_celular) then
      raise exception 'Só quem controla o celular manda mensagem por ele';
    end if;
    if not exists (select 1 from celular_participantes p where p.conversa_id = p_conversa_id and p.celular_id = p_de_celular and p.saiu_em is null) then
      raise exception 'Esse celular não está nesta conversa';
    end if;
    if coalesce((v_cel.efeitos ->> 'desligado')::boolean, false) or v_cel.bateria = 0 then
      raise exception 'O celular está desligado';
    end if;
    if coalesce((v_cel.efeitos ->> 'sem_sinal')::boolean, false) then
      v_estado := 'pendente';
    end if;
    -- Mensagem de sistema e efeito paranormal são do mestre.
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

  insert into celular_mensagens (conversa_id, campaign_id, de_celular_id, de_npc_id, enviado_por, tipo, texto, arquivo_url, arquivo,
                                 minuto_no_jogo, estado, efeito, responde_a)
  values (p_conversa_id, v_conv.campaign_id, p_de_celular, p_de_npc, auth.uid(), p_tipo, nullif(trim(coalesce(p_texto, '')), ''),
          p_arquivo_url, p_arquivo, minutos_no_jogo(v_conv.campaign_id), v_estado, p_efeito,
          (select m.id from celular_mensagens m where m.id = p_responde_a and m.conversa_id = p_conversa_id))
  returning id into v_id;

  if v_estado = 'enviada' then
    update celular_conversas set ultima_em = now() where id = p_conversa_id;
  end if;
  if p_de_celular is not null then
    update celular_participantes set lida_ate = now() where conversa_id = p_conversa_id and celular_id = p_de_celular;
  end if;
  return v_id;
end;
$$;

-- Apagar a própria mensagem ("Esta mensagem foi apagada"); o mestre apaga qualquer uma.
-- "Some depois de lida" (Outro Lado) também passa por aqui.
create or replace function public.apagar_mensagem_do_celular(p_mensagem_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_msg celular_mensagens%rowtype;
begin
  select * into v_msg from celular_mensagens where id = p_mensagem_id;
  if v_msg.id is null or not acesso_aprovado() then
    raise exception 'Mensagem não encontrada';
  end if;
  if not (
    is_campaign_owner(v_msg.campaign_id)
    or (v_msg.de_celular_id is not null and controla_celular(v_msg.de_celular_id))
    or (coalesce((v_msg.efeito ->> 'some_apos_ler')::boolean, false) and participa_da_conversa(v_msg.conversa_id))
  ) then
    raise exception 'Só quem mandou apaga a mensagem';
  end if;
  update celular_mensagens set apagada = true, texto = null, arquivo_url = null, arquivo = null where id = p_mensagem_id;
end;
$$;

-- Efeitos do mestre num celular (ou em todos da mesa, com p_celulares nulo): {sem_sinal,
-- interferencia, brilho, desligado} são mesclados; p_bateria muda a bateria. Quando o sinal volta,
-- as mensagens pendentes saem.
create or replace function public.efeito_no_celular(p_campaign_id uuid, p_celulares uuid[] default null, p_efeitos jsonb default '{}', p_bateria int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not acesso_aprovado() or not is_campaign_owner(p_campaign_id) then
    raise exception 'Só o mestre mexe nos efeitos do celular';
  end if;
  update celulares
  set efeitos = jsonb_strip_nulls(efeitos || coalesce(p_efeitos, '{}'::jsonb)),
      bateria = coalesce(least(100, greatest(0, p_bateria)), bateria),
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

-- ---- Ligações ----

create or replace function public.ligar_no_celular(
  p_de_celular uuid default null, p_de_npc uuid default null, p_para_celular uuid default null, p_para_npc uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_campanha uuid;
  v_estado text := 'chamando';
  v_id uuid;
begin
  if not acesso_aprovado() or (p_de_celular is null) = (p_de_npc is null) or (p_para_celular is null) = (p_para_npc is null) then
    raise exception 'Escolha quem liga e pra quem';
  end if;
  if p_de_celular is not null then
    select campaign_id into v_campanha from celulares where id = p_de_celular;
    if not controla_celular(p_de_celular) then
      raise exception 'Só quem controla o celular liga por ele';
    end if;
  else
    select campaign_id into v_campanha from celular_npcs where id = p_de_npc;
    if not is_campaign_owner(v_campanha) then
      raise exception 'Só o mestre liga como NPC';
    end if;
  end if;
  if (p_para_celular is not null and not exists (select 1 from celulares where id = p_para_celular and campaign_id = v_campanha))
     or (p_para_npc is not null and not exists (select 1 from celular_npcs where id = p_para_npc and campaign_id = v_campanha)) then
    raise exception 'Esse número não é desta mesa';
  end if;
  -- Sem sinal ou desligado (de quem liga ou de quem recebe): não completa.
  if exists (select 1 from celulares c where c.id in (p_de_celular, p_para_celular)
             and (coalesce((c.efeitos ->> 'sem_sinal')::boolean, false) or coalesce((c.efeitos ->> 'desligado')::boolean, false) or c.bateria = 0)) then
    v_estado := 'sem_sinal';
  end if;
  insert into celular_ligacoes (campaign_id, de_celular_id, de_npc_id, para_celular_id, para_npc_id, estado, iniciada_por, minuto_no_jogo,
                                encerrada_em)
  values (v_campanha, p_de_celular, p_de_npc, p_para_celular, p_para_npc, v_estado, auth.uid(), minutos_no_jogo(v_campanha),
          case when v_estado = 'sem_sinal' then now() end)
  returning id into v_id;
  return v_id;
end;
$$;

-- Atender, recusar ou encerrar. Atende/recusa quem recebe (o mestre, se for NPC); encerra qualquer
-- um dos lados. Ninguém atendeu: "perdida".
create or replace function public.responder_ligacao(p_ligacao_id uuid, p_acao text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_l celular_ligacoes%rowtype;
  v_recebe boolean;
  v_liga boolean;
begin
  select * into v_l from celular_ligacoes where id = p_ligacao_id for update;
  if v_l.id is null or not acesso_aprovado() then
    raise exception 'Ligação não encontrada';
  end if;
  v_recebe := is_campaign_owner(v_l.campaign_id) or (v_l.para_celular_id is not null and controla_celular(v_l.para_celular_id));
  v_liga := is_campaign_owner(v_l.campaign_id) or (v_l.de_celular_id is not null and controla_celular(v_l.de_celular_id));
  if p_acao = 'atender' and v_recebe and v_l.estado = 'chamando' then
    update celular_ligacoes set estado = 'em_curso', atendida_em = now() where id = p_ligacao_id;
  elsif p_acao = 'recusar' and v_recebe and v_l.estado = 'chamando' then
    update celular_ligacoes set estado = 'recusada', encerrada_em = now() where id = p_ligacao_id;
  elsif p_acao = 'encerrar' and (v_recebe or v_liga) and v_l.estado in ('chamando', 'em_curso') then
    update celular_ligacoes
    set estado = case when v_l.estado = 'chamando' then 'perdida' else 'encerrada' end, encerrada_em = now()
    where id = p_ligacao_id;
  else
    raise exception 'Não dá pra fazer isso nesta ligação';
  end if;
end;
$$;

-- ---- Tempo real e arquivos ----
alter table public.celulares replica identity full;
alter table public.celular_npcs replica identity full;
alter table public.celular_contatos replica identity full;
alter table public.celular_conversas replica identity full;
alter table public.celular_participantes replica identity full;
alter table public.celular_mensagens replica identity full;
alter table public.celular_galeria replica identity full;
alter table public.celular_ligacoes replica identity full;
alter publication supabase_realtime add table public.celulares, public.celular_npcs, public.celular_contatos, public.celular_conversas,
  public.celular_participantes, public.celular_mensagens, public.celular_galeria, public.celular_ligacoes;

-- Fotos, vídeos, áudios, papéis de parede e toques: cada um na própria pasta.
insert into storage.buckets (id, name, public)
values ('celular_arquivos', 'celular_arquivos', true)
on conflict (id) do nothing;
create policy "celular_arquivos: leitura pública" on storage.objects for select using (bucket_id = 'celular_arquivos');
create policy "celular_arquivos: dono escreve" on storage.objects for insert
  with check (bucket_id = 'celular_arquivos' and (storage.foldername(name))[1] = auth.uid()::text and public.acesso_aprovado());
create policy "celular_arquivos: dono remove" on storage.objects for delete
  using (bucket_id = 'celular_arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
