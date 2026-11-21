alter table finance.payments add column if not exists idempotency_key text;
create unique index if not exists payments_company_idempotency_key_uq
  on finance.payments(company_id,idempotency_key)
  where idempotency_key is not null;
comment on column finance.payments.idempotency_key is
  'Client-supplied request key for safe retry of payment creation within a company.';
