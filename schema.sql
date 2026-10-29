-- Leitura Guiada: execute este arquivo uma vez em Supabase > SQL Editor.

-- 1) Anotações: uma linha por capítulo (chave "39-5" = livro 39, capítulo 5) e uma linha "meta".
create table if not exists public.estudos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chave text not null,
  dados jsonb not null,
  atualizado_em bigint not null default 0,
  primary key (user_id, chave)
);

alter table public.estudos enable row level security;

drop policy if exists "estudos_select" on public.estudos;
drop policy if exists "estudos_insert" on public.estudos;
drop policy if exists "estudos_update" on public.estudos;
drop policy if exists "estudos_delete" on public.estudos;

create policy "estudos_select" on public.estudos for select to authenticated
  using (user_id = (select auth.uid()));
create policy "estudos_insert" on public.estudos for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "estudos_update" on public.estudos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "estudos_delete" on public.estudos for delete to authenticated
  using (user_id = (select auth.uid()));

-- 2) Texto bíblico: bucket privado, só quem está logado consegue baixar.
insert into storage.buckets (id, name, public)
values ('biblia', 'biblia', false)
on conflict (id) do nothing;

drop policy if exists "biblia_leitura" on storage.objects;
create policy "biblia_leitura" on storage.objects for select to authenticated
  using (bucket_id = 'biblia');
