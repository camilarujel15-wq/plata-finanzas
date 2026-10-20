-- Plata 1.1: varias monedas, inversiones y cuentas por cobrar ("me deben").
alter type account_type add value if not exists 'investment';
alter type account_type add value if not exists 'receivable';
alter type transfer_kind add value if not exists 'investment';
alter type transfer_kind add value if not exists 'loan';
alter type transfer_kind add value if not exists 'repayment';

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
