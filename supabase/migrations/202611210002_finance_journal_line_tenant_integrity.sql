-- Journal line tenant consistency. company_id is derived from its parent journal entry.
create unique index if not exists finance_journal_entries_company_id_id_uq
  on finance.journal_entries(company_id,id);

alter table finance.journal_lines add column if not exists company_id uuid;

update finance.journal_lines jl
set company_id = je.company_id
from finance.journal_entries je
where je.id = jl.journal_entry_id
  and jl.company_id is distinct from je.company_id;

do $$
begin
  if exists (select 1 from finance.journal_lines where company_id is null) then
    raise exception 'Cannot enforce journal line company_id: orphan journal line detected';
  end if;
end $$;

alter table finance.journal_lines alter column company_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='journal_lines_company_id_fkey' and conrelid='finance.journal_lines'::regclass) then
    alter table finance.journal_lines add constraint journal_lines_company_id_fkey
      foreign key (company_id) references finance.companies(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='journal_lines_company_journal_fk' and conrelid='finance.journal_lines'::regclass) then
    alter table finance.journal_lines add constraint journal_lines_company_journal_fk
      foreign key (company_id,journal_entry_id) references finance.journal_entries(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='journal_lines_company_account_fk' and conrelid='finance.journal_lines'::regclass) then
    alter table finance.journal_lines add constraint journal_lines_company_account_fk
      foreign key (company_id,account_id) references finance.chart_of_accounts(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='journal_lines_company_partner_fk' and conrelid='finance.journal_lines'::regclass) then
    alter table finance.journal_lines add constraint journal_lines_company_partner_fk
      foreign key (company_id,partner_id) references finance.partners(company_id,id) on delete restrict;
  end if;
end $$;

create or replace function finance.set_journal_line_company()
returns trigger
language plpgsql
as $$
declare
  parent_company uuid;
begin
  select company_id into parent_company
  from finance.journal_entries
  where id = new.journal_entry_id
  for key share;

  if parent_company is null then
    raise exception 'Journal entry not found';
  end if;

  new.company_id := parent_company;
  return new;
end;
$$;

drop trigger if exists trg_journal_lines_set_company on finance.journal_lines;
create trigger trg_journal_lines_set_company
before insert or update of journal_entry_id, company_id
on finance.journal_lines
for each row execute function finance.set_journal_line_company();

comment on column finance.journal_lines.company_id is
  'Derived from parent journal entry; composite foreign keys enforce same-company account and partner references.';
