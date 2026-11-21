-- บันทึกย้อนหลัง (ทำบนฐานจริงแล้วโดย GPT แต่ไม่มีไฟล์ใน repo): แยกบริษัททดสอบ (uat) กับใช้งานจริง (production) · มีบริษัททดสอบได้แห่งเดียว
alter table finance.companies add column if not exists environment text default 'uat'::text not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'companies_environment_check') then
    alter table finance.companies add constraint companies_environment_check CHECK ((environment = ANY (ARRAY['uat'::text, 'production'::text])));
  end if;
end $$;
create unique index if not exists finance_companies_one_uat_workspace on finance.companies using btree (environment) where (environment = 'uat'::text);
