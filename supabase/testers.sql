-- ============================================================
--  Relatório de Testes — estrutura de Testers / Casos / Execuções
--  e conversão dos dados da tabela antiga (casos_teste).
--
--  ANTES: faça o backup da tabela casos_teste
--         (Table Editor > casos_teste > Export > CSV).
--  Cole tudo no "SQL Editor" do Supabase e clique em "Run".
--  A tabela antiga NÃO é alterada: o site atual continua funcionando.
--  Pode rodar de novo sem duplicar nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabelas
-- ------------------------------------------------------------

-- Pessoas que testam (a área é da pessoa)
create table if not exists public.testers (
  id            bigint generated always as identity primary key,
  nome          text        not null,
  usuario       text        not null default '',   -- usuário do Protheus
  area          text        not null default '',
  email         text,                               -- login futuro (opcional)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists testers_nome_unico on public.testers (lower(trim(nome)));

-- Funcionalidades (cada uma existe uma vez só por módulo)
create table if not exists public.casos (
  id            bigint generated always as identity primary key,
  titulo        text        not null,
  modulo        text        not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists casos_unico on public.casos (lower(trim(titulo)), lower(trim(modulo)));

-- Resultado de um tester em um caso (no máximo um por pessoa e caso)
create table if not exists public.execucoes (
  id            bigint generated always as identity primary key,
  caso_id       bigint      not null references public.casos(id)   on delete cascade,
  tester_id     bigint      not null references public.testers(id) on delete restrict,
  status        text        not null default 'pendente'
                check (status in ('aprovado', 'reprovado', 'pendente')),
  data          date,
  observacoes   text        not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (caso_id, tester_id)
);
create index if not exists execucoes_tester on public.execucoes (tester_id);

-- "atualizado_em" automático (a função já existe desde o setup.sql)
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists testers_atualizado_em   on public.testers;
drop trigger if exists casos_atualizado_em     on public.casos;
drop trigger if exists execucoes_atualizado_em on public.execucoes;
create trigger testers_atualizado_em   before update on public.testers   for each row execute function public.tocar_atualizado_em();
create trigger casos_atualizado_em     before update on public.casos     for each row execute function public.tocar_atualizado_em();
create trigger execucoes_atualizado_em before update on public.execucoes for each row execute function public.tocar_atualizado_em();

-- ------------------------------------------------------------
-- 2) Regras de acesso: todos leem, só editores alteram
--    (usa a função eh_editor() criada no setup.sql)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['testers', 'casos', 'execucoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Todos podem ler" on public.%I', t);
    execute format('drop policy if exists "Editores podem incluir" on public.%I', t);
    execute format('drop policy if exists "Editores podem alterar" on public.%I', t);
    execute format('drop policy if exists "Editores podem excluir" on public.%I', t);
    execute format('create policy "Todos podem ler" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "Editores podem incluir" on public.%I for insert to authenticated with check (public.eh_editor())', t);
    execute format('create policy "Editores podem alterar" on public.%I for update to authenticated using (public.eh_editor()) with check (public.eh_editor())', t);
    execute format('create policy "Editores podem excluir" on public.%I for delete to authenticated using (public.eh_editor())', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('grant usage, select on sequence public.%I to authenticated', t || '_id_seq');
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3) Conversão dos dados da tabela antiga
-- ------------------------------------------------------------

-- 3a) Testers: um por realizador; área = a mais usada pela pessoa
insert into public.testers (nome, area)
select trim(realizador), mode() within group (order by area)
from public.casos_teste
where trim(realizador) <> ''
group by trim(realizador)
on conflict ((lower(trim(nome)))) do nothing;

-- Ajustes combinados
update public.testers set area = 'Contabilidade'            where nome = 'Viviane Miranda de Araujo';
update public.testers set area = 'Tecnologia da Informação' where nome = 'Guilherme Cunha Alves';

-- Usuários do Protheus
update public.testers t set usuario = u.usuario
from (values
  ('Aldenir Antonio de Souza',      'aasouza'),
  ('Brenda Santos Oliveira',        'bsoliveira'),
  ('Guilherme Cunha Alves',         'gcalves'),
  ('Inubia Alves Moreira',          'imoreira'),
  ('Joao Pedro Monteiro Govea',     'jgovea'),
  ('Leandro Alves de Oliveira',     'laoliveira'),
  ('Maria Vitoria Barreto Queiroz', 'mqueiroz'),
  ('Marina Lais Siqueira',          'mlsiqueira'),
  ('Matheus Pereira Campos',        'mcampos'),
  ('Vitor Perroud Belarmino',       'vbelarmino'),
  ('Viviane Miranda de Araujo',     'varaujo')
) as u(nome, usuario)
where t.nome = u.nome and t.usuario = '';

-- 3b) Casos: um por funcionalidade + módulo (nomes diferentes = casos diferentes)
insert into public.casos (titulo, modulo)
select distinct on (lower(trim(titulo)), lower(trim(modulo))) trim(titulo), trim(modulo)
from public.casos_teste
order by lower(trim(titulo)), lower(trim(modulo)), id
on conflict ((lower(trim(titulo))), (lower(trim(modulo)))) do nothing;

-- 3c) Execuções: uma por linha antiga que tem realizador
--     (linhas pendentes sem realizador viram só o caso, sem tester)
insert into public.execucoes (caso_id, tester_id, status, data, observacoes)
select c.id, t.id, a.status, a.data, a.observacoes
from public.casos_teste a
join public.casos   c on lower(trim(c.titulo)) = lower(trim(a.titulo))
                     and lower(trim(c.modulo)) = lower(trim(a.modulo))
join public.testers t on lower(trim(t.nome))   = lower(trim(a.realizador))
where trim(a.realizador) <> ''
on conflict (caso_id, tester_id) do nothing;

-- ------------------------------------------------------------
-- 4) Conferência: resultado mostrado na tela
-- ------------------------------------------------------------
select 'Linhas na tabela antiga' as item, count(*)::text as valor from public.casos_teste
union all select 'Casos (sem repetição)', count(*)::text from public.casos
union all select 'Testers',               count(*)::text from public.testers
union all select 'Execuções',             count(*)::text from public.execucoes
union all select 'Casos sem tester',      count(*)::text from public.casos c
           where not exists (select 1 from public.execucoes e where e.caso_id = c.id);
