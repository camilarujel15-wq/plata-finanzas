-- Plata 1.3: gastos fijos mensuales y tarjetas de crédito (cierre, pago, cuotas con TEA).
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
