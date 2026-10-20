-- Plata 1.2: elegir qué cuentas cuentan para gastar y billeteras vinculadas (Yape/Plin → banco).
alter table public.accounts
  add column if not exists include_in_available boolean,
  add column if not exists linked_account_id uuid references public.accounts (id) on delete set null;
