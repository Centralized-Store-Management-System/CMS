-- หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) ผูกกับคำขอเบิก/เอกสารรายจ่าย — เพิ่มอย่างเดียว ไม่แตะข้อมูลเดิม
-- เก็บข้อมูลตามแบบฟอร์ม (snapshot ผู้จ่าย/ผู้รับ ณ วันที่ออก) → พิมพ์ซ้ำได้เหมือนเดิมทุกครั้ง
create table if not exists finance.wht_certificates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references finance.companies(id) on delete restrict,
  document_id uuid not null references finance.documents(id) on delete cascade,
  cert_number text not null,
  book_no text,
  issue_date date not null,
  form_type text not null check (form_type in ('pnd1a','pnd1a_special','pnd2','pnd3','pnd2a','pnd3a','pnd53')),
  seq_no text,
  payer jsonb not null,
  payee jsonb not null,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 12),
  total_amount numeric(14,2) not null check (total_amount > 0),
  total_tax numeric(14,2) not null check (total_tax >= 0),
  funds jsonb not null default '{}'::jsonb,
  payer_condition text not null default 'withhold' check (payer_condition in ('withhold','always','once','other')),
  payer_condition_other text,
  note text,
  status text not null default 'active' check (status in ('active','voided')),
  void_reason text,
  voided_by text,
  voided_at timestamptz,
  created_by text not null,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, cert_number)
);
create index if not exists wht_certificates_document_idx on finance.wht_certificates(company_id, document_id, created_at);
alter table finance.wht_certificates enable row level security;
revoke all on finance.wht_certificates from anon, authenticated;
