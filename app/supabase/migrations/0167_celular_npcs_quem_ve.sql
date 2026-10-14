-- Criar NPC dava "new row violates row-level security policy" (bug 14/10): o insert devolve a
-- linha nova (select), e a regra de leitura só chamava pode_ver_npc(), que procura o NPC na
-- tabela e ainda não enxerga a linha que está sendo criada. Quem criou e o mestre veem direto
-- pelas colunas da própria linha.

drop policy if exists "celular_npcs: quem pode ve" on public.celular_npcs;
create policy "celular_npcs: quem pode ve" on public.celular_npcs for select using (
  criado_por = (select auth.uid()) or is_campaign_owner(campaign_id) or pode_ver_npc(id)
);
