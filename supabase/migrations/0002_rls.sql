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

-- Bucket privado para comprobantes (V2: OCR). Ruta: {user_id}/{transaction_id}.jpg
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict do nothing;
create policy "receipts_own" on storage.objects for all to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
