-- Finance tenant-integrity hardening (additive, no business data changes)
-- Enforce that optional/related records belong to the same company.
-- Existing cross-company references were checked before applying: all counts = 0.

create unique index if not exists finance_partners_company_id_id_uq on finance.partners(company_id,id);
create unique index if not exists finance_documents_company_id_id_uq on finance.documents(company_id,id);
create unique index if not exists finance_payments_company_id_id_uq on finance.payments(company_id,id);
create unique index if not exists finance_tax_filings_company_id_id_uq on finance.tax_filings(company_id,id);
create unique index if not exists finance_tax_transactions_company_id_id_uq on finance.tax_transactions(company_id,id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='documents_company_partner_fk' and conrelid='finance.documents'::regclass) then
    alter table finance.documents add constraint documents_company_partner_fk
      foreign key (company_id,partner_id) references finance.partners(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='payments_company_document_fk' and conrelid='finance.payments'::regclass) then
    alter table finance.payments add constraint payments_company_document_fk
      foreign key (company_id,document_id) references finance.documents(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='tax_transactions_company_document_fk' and conrelid='finance.tax_transactions'::regclass) then
    alter table finance.tax_transactions add constraint tax_transactions_company_document_fk
      foreign key (company_id,document_id) references finance.documents(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='tax_transactions_company_partner_fk' and conrelid='finance.tax_transactions'::regclass) then
    alter table finance.tax_transactions add constraint tax_transactions_company_partner_fk
      foreign key (company_id,counterparty_id) references finance.partners(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='journal_entries_company_source_document_fk' and conrelid='finance.journal_entries'::regclass) then
    alter table finance.journal_entries add constraint journal_entries_company_source_document_fk
      foreign key (company_id,source_document_id) references finance.documents(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='payment_allocations_company_payment_fk' and conrelid='finance.payment_allocations'::regclass) then
    alter table finance.payment_allocations add constraint payment_allocations_company_payment_fk
      foreign key (company_id,payment_id) references finance.payments(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='payment_allocations_company_document_fk' and conrelid='finance.payment_allocations'::regclass) then
    alter table finance.payment_allocations add constraint payment_allocations_company_document_fk
      foreign key (company_id,document_id) references finance.documents(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='payment_events_company_payment_fk' and conrelid='finance.payment_events'::regclass) then
    alter table finance.payment_events add constraint payment_events_company_payment_fk
      foreign key (company_id,payment_id) references finance.payments(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='tax_filing_lines_company_filing_fk' and conrelid='finance.tax_filing_lines'::regclass) then
    alter table finance.tax_filing_lines add constraint tax_filing_lines_company_filing_fk
      foreign key (company_id,filing_id) references finance.tax_filings(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='tax_filing_lines_company_transaction_fk' and conrelid='finance.tax_filing_lines'::regclass) then
    alter table finance.tax_filing_lines add constraint tax_filing_lines_company_transaction_fk
      foreign key (company_id,source_tax_transaction_id) references finance.tax_transactions(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='tax_filing_lines_company_partner_fk' and conrelid='finance.tax_filing_lines'::regclass) then
    alter table finance.tax_filing_lines add constraint tax_filing_lines_company_partner_fk
      foreign key (company_id,counterparty_id) references finance.partners(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='document_files_company_document_fk' and conrelid='finance.document_files'::regclass) then
    alter table finance.document_files add constraint document_files_company_document_fk
      foreign key (company_id,document_id) references finance.documents(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='document_files_company_filing_fk' and conrelid='finance.document_files'::regclass) then
    alter table finance.document_files add constraint document_files_company_filing_fk
      foreign key (company_id,filing_id) references finance.tax_filings(company_id,id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='categories_company_default_account_fk' and conrelid='finance.categories'::regclass) then
    alter table finance.categories add constraint categories_company_default_account_fk
      foreign key (company_id,default_account_id) references finance.chart_of_accounts(company_id,id) on delete restrict;
  end if;
end $$;

comment on constraint documents_company_partner_fk on finance.documents is
  'Prevents a document from referencing a partner owned by another Finance company.';
comment on constraint payments_company_document_fk on finance.payments is
  'Prevents a payment from referencing a document owned by another Finance company.';
