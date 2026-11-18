-- ============================================================
--  Relatório de Testes — estrutura do banco no Supabase
--  Cole tudo no "SQL Editor" do Supabase e clique em "Run".
--  Pode rodar mais de uma vez sem problema.
-- ============================================================

-- 1) Tabela dos casos de teste
create table if not exists public.casos_teste (
  id            bigint generated always as identity primary key,
  titulo        text        not null,
  area          text        not null default '',
  modulo        text        not null default '',
  status        text        not null default 'pendente'
                check (status in ('aprovado', 'reprovado', 'pendente')),
  data          date,
  realizador    text        not null default '',
  observacoes   text        not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- atualiza "atualizado_em" sozinho a cada edição
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists casos_teste_atualizado_em on public.casos_teste;
create trigger casos_teste_atualizado_em
  before update on public.casos_teste
  for each row execute function public.tocar_atualizado_em();

-- 2) Quem pode editar: lista de e-mails autorizados
create table if not exists public.editores (
  email text primary key
);
alter table public.editores enable row level security;
-- (sem políticas: ninguém lê/edita essa tabela pelo site, só pelo painel do Supabase)

-- Função usada pelas regras de acesso: o usuário logado é editor?
create or replace function public.eh_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.editores
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.eh_editor() from public;
grant execute on function public.eh_editor() to anon, authenticated;

-- 3) Regras de acesso (Row Level Security)
alter table public.casos_teste enable row level security;

drop policy if exists "Todos podem ler"        on public.casos_teste;
drop policy if exists "Editores podem incluir" on public.casos_teste;
drop policy if exists "Editores podem alterar" on public.casos_teste;
drop policy if exists "Editores podem excluir" on public.casos_teste;

create policy "Todos podem ler" on public.casos_teste
  for select to anon, authenticated using (true);

create policy "Editores podem incluir" on public.casos_teste
  for insert to authenticated with check (public.eh_editor());

create policy "Editores podem alterar" on public.casos_teste
  for update to authenticated using (public.eh_editor()) with check (public.eh_editor());

create policy "Editores podem excluir" on public.casos_teste
  for delete to authenticated using (public.eh_editor());

grant select on public.casos_teste to anon, authenticated;
grant insert, update, delete on public.casos_teste to authenticated;
grant usage, select on sequence public.casos_teste_id_seq to authenticated;

-- 4) Cadastre aqui o(s) e-mail(s) de quem pode editar
--    (troque pelo e-mail real e rode de novo; repita a linha para mais pessoas)
insert into public.editores (email) values ('seu-email@exemplo.com')
on conflict (email) do nothing;
