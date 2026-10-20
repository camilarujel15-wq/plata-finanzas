-- Plata · instalación completa en Supabase (proyecto nuevo: copiar todo y ejecutar una sola vez en SQL Editor)


create extension if not exists "pgcrypto";

-- ───────────────────────── Tipos ─────────────────────────
create type account_type   as enum ('checking', 'savings', 'credit_card', 'wallet', 'cash', 'investment', 'receivable');
create type tx_type        as enum ('expense', 'income', 'transfer');
create type transfer_kind  as enum ('internal', 'card_payment', 'savings', 'investment', 'loan', 'repayment');
create type category_kind  as enum ('expense', 'income');
create type tx_source      as enum ('manual', 'text', 'voice', 'import', 'ocr', 'widget');

-- ───────────────────────── Perfil ─────────────────────────
create table public.profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  currency     char(3) not null default 'PEN',
  locale       text not null default 'es-PE',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ───────────────────────── Cuentas ─────────────────────────
create table public.accounts (
  id              uuid primary key,
  user_id         uuid not null references auth.users on delete cascade,
  name            text not null check (char_length(name) between 1 and 60),
  type            account_type not null,
  initial_balance bigint not null default 0,
  currency        char(3) not null default 'PEN',
  color           text not null default '#2563eb',
  icon            text not null default '🏦',
  credit_limit    bigint check (credit_limit is null or credit_limit >= 0),
  archived        boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index accounts_user_idx on public.accounts (user_id, updated_at);

-- ───────────────────────── Categorías ─────────────────────────
create table public.categories (
  id          uuid primary key,
  user_id     uuid not null references auth.users on delete cascade,
  key         text,                    -- clave estable de las predeterminadas ("food")
  name        text not null check (char_length(name) between 1 and 40),
  kind        category_kind not null,
  icon        text not null default '🏷️',
  color       text not null default '#64748b',
  is_default  boolean not null default false,
  archived    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index categories_user_idx on public.categories (user_id, updated_at);
create unique index categories_user_key_uq on public.categories (user_id, key) where key is not null and deleted_at is null;

-- ───────────────────────── Importaciones (V2: historial) ─────────────────────────
create table public.imports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  file_name   text not null,
  source      text not null default 'csv',   -- csv | xlsx | pdf | notion
  row_count   int not null default 0,
  created_at  timestamptz not null default now()
);

-- ───────────────────────── Movimientos ─────────────────────────
create table public.transactions (
  id             uuid primary key,
  user_id        uuid not null references auth.users on delete cascade,
  type           tx_type not null,
  amount         bigint not null check (amount > 0),
  account_id     uuid not null references public.accounts on delete restrict,
  to_account_id  uuid references public.accounts on delete restrict,
  transfer_kind  transfer_kind,
  category_id    uuid references public.categories on delete set null,
  date           date not null,
  note           text check (note is null or char_length(note) <= 500),
  merchant       text check (merchant is null or char_length(merchant) <= 200),
  tags           text[] not null default '{}',
  source         tx_source not null default 'manual',
  import_id      uuid,
  import_hash    text,
  attachment_path text,                         -- V2: foto del comprobante en Storage
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  -- Integridad: transferencias tienen destino distinto y no tienen categoría.
  constraint transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id and category_id is null)
    or (type <> 'transfer' and to_account_id is null and transfer_kind is null)
  )
);
create index transactions_user_updated_idx on public.transactions (user_id, updated_at);
create index transactions_user_date_idx    on public.transactions (user_id, date desc) where deleted_at is null;
create index transactions_account_idx      on public.transactions (account_id);
create index transactions_category_idx     on public.transactions (category_id);
create index transactions_import_hash_idx  on public.transactions (user_id, import_hash) where import_hash is not null;

-- ───────────────────────── Presupuestos ─────────────────────────
create table public.budgets (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade,
  category_id  uuid not null references public.categories on delete cascade,
  amount       bigint not null check (amount > 0),
  thresholds   int[] not null default '{50,80,100}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index budgets_user_idx on public.budgets (user_id, updated_at);

create table public.budget_alerts (
  id          uuid primary key,
  user_id     uuid not null references auth.users on delete cascade,
  budget_id   uuid not null references public.budgets on delete cascade,
  period      char(7) not null,             -- YYYY-MM
  threshold   int not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (budget_id, period, threshold)
);

-- ───────────────────────── Metas ─────────────────────────
create table public.goals (
  id             uuid primary key,
  user_id        uuid not null references auth.users on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  target_amount  bigint not null check (target_amount > 0),
  target_date    date,
  icon           text not null default '🎯',
  color          text not null default '#16a34a',
  account_id     uuid references public.accounts on delete set null,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index goals_user_idx on public.goals (user_id, updated_at);

create table public.goal_contributions (
  id          uuid primary key,
  user_id     uuid not null references auth.users on delete cascade,
  goal_id     uuid not null references public.goals on delete cascade,
  amount      bigint not null check (amount <> 0),   -- negativo = retiro
  date        date not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index goal_contributions_user_idx on public.goal_contributions (user_id, updated_at);

-- ───────────────────────── Aprendizaje de categorías ─────────────────────────
create table public.category_rules (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade,
  pattern      text not null,               -- comercio normalizado ("plaza vea")
  category_id  uuid not null references public.categories on delete cascade,
  hits         int not null default 1,
  origin       text not null default 'user' check (origin in ('user', 'system')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index category_rules_user_idx on public.category_rules (user_id, updated_at);

-- ───────────────────────── V2: recurrentes ─────────────────────────
create table public.recurring_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  type         tx_type not null,
  amount       bigint not null check (amount > 0),
  account_id   uuid not null references public.accounts on delete cascade,
  category_id  uuid references public.categories on delete set null,
  merchant     text,
  rrule        text not null,               -- RFC 5545, p. ej. FREQ=MONTHLY;BYMONTHDAY=5
  next_date    date not null,
  auto_post    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ───────────────────────── Vista de saldos ─────────────────────────
-- Los saldos se derivan de los movimientos (nunca se guardan) → no pueden descuadrarse.
create view public.account_balances with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.initial_balance
       + coalesce(sum(case
           when t.type = 'income'   and t.account_id = a.id    then  t.amount
           when t.type = 'expense'  and t.account_id = a.id    then -t.amount
           when t.type = 'transfer' and t.account_id = a.id    then -t.amount
           when t.type = 'transfer' and t.to_account_id = a.id then  t.amount
         end), 0) as balance
from public.accounts a
left join public.transactions t
  on (t.account_id = a.id or t.to_account_id = a.id) and t.deleted_at is null
where a.deleted_at is null
group by a.id;

-- ───────────────────────── Perfil automático al registrarse ─────────────────────────
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Plata · Row Level Security
-- Cada usuario solo puede ver y modificar sus propias filas. La anon key es pública por diseño;
-- la seguridad real la imponen estas políticas.

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'accounts', 'categories', 'imports', 'transactions', 'budgets', 'budget_alerts',
    'goals', 'goal_contributions', 'category_rules', 'recurring_rules'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy "own_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "own_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "own_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
    execute format($p$create policy "own_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

-- Las referencias cruzadas también deben pertenecer al mismo usuario
-- (evita colgar un movimiento de la cuenta de otra persona adivinando su uuid).
create function public.assert_same_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'transactions' then
    if not exists (select 1 from accounts where id = new.account_id and user_id = new.user_id)
       or (new.to_account_id is not null and not exists (select 1 from accounts where id = new.to_account_id and user_id = new.user_id))
       or (new.category_id is not null and not exists (select 1 from categories where id = new.category_id and user_id = new.user_id)) then
      raise exception 'referencia a recurso de otro usuario';
    end if;
  elsif tg_table_name in ('budgets', 'category_rules') then
    if not exists (select 1 from categories where id = new.category_id and user_id = new.user_id) then
      raise exception 'referencia a recurso de otro usuario';
    end if;
  elsif tg_table_name = 'goal_contributions' then
    if not exists (select 1 from goals where id = new.goal_id and user_id = new.user_id) then
      raise exception 'referencia a recurso de otro usuario';
    end if;
  elsif tg_table_name = 'budget_alerts' then
    if not exists (select 1 from budgets where id = new.budget_id and user_id = new.user_id) then
      raise exception 'referencia a recurso de otro usuario';
    end if;
  end if;
  return new;
end $$;

create trigger tx_same_owner      before insert or update on public.transactions       for each row execute function public.assert_same_owner();
create trigger budget_same_owner  before insert or update on public.budgets            for each row execute function public.assert_same_owner();
create trigger rule_same_owner    before insert or update on public.category_rules     for each row execute function public.assert_same_owner();
create trigger contrib_same_owner before insert or update on public.goal_contributions for each row execute function public.assert_same_owner();
create trigger alert_same_owner   before insert or update on public.budget_alerts      for each row execute function public.assert_same_owner();


alter table public.accounts
  add column if not exists investment_kind text check (investment_kind is null or investment_kind in ('property', 'education', 'funds', 'business', 'other')),
  add column if not exists target_amount bigint check (target_amount is null or target_amount >= 0),
  add column if not exists market_value bigint,
  add column if not exists due_date date,
  add column if not exists note text check (note is null or char_length(note) <= 300);

-- Transferencias entre monedas: monto que llega a la cuenta destino.
alter table public.transactions
  add column if not exists to_amount bigint check (to_amount is null or to_amount > 0);

-- Saldos: en transferencias entre monedas, la cuenta destino recibe to_amount.
create or replace view public.account_balances with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.initial_balance
       + coalesce(sum(case
           when t.type = 'income'   and t.account_id = a.id    then  t.amount
           when t.type = 'expense'  and t.account_id = a.id    then -t.amount
           when t.type = 'transfer' and t.account_id = a.id    then -t.amount
           when t.type = 'transfer' and t.to_account_id = a.id then  coalesce(t.to_amount, t.amount)
         end), 0) as balance
from public.accounts a
left join public.transactions t
  on (t.account_id = a.id or t.to_account_id = a.id) and t.deleted_at is null
where a.deleted_at is null
group by a.id;

alter table public.accounts
  add column if not exists include_in_available boolean,
  add column if not exists linked_account_id uuid references public.accounts (id) on delete set null;

alter table public.accounts
  add column if not exists closing_day int check (closing_day is null or closing_day between 1 and 31),
  add column if not exists due_day int check (due_day is null or due_day between 1 and 31),
  add column if not exists tea numeric check (tea is null or (tea >= 0 and tea <= 1000));

alter table public.transactions
  add column if not exists installments int check (installments is null or installments between 1 and 60),
  add column if not exists installment_rate numeric check (installment_rate is null or installment_rate >= 0),
  add column if not exists recurring_id uuid;

alter table public.recurring_rules
  add column if not exists name text,
  add column if not exists day_of_month int check (day_of_month is null or day_of_month between 1 and 31),
  add column if not exists to_account_id uuid references public.accounts (id) on delete set null,
  add column if not exists icon text,
  add column if not exists active boolean not null default true,
  alter column rrule drop not null,
  alter column next_date drop not null;

create index if not exists recurring_rules_user_idx on public.recurring_rules (user_id, updated_at);
