# รีเซ็ตฐานข้อมูลทดสอบ + เปิด mock CMS + Finance API (Deno)
P="psql -h 127.0.0.1 -p 5544 -U postgres -q"
(su pgtest -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/fpg/data status" >/dev/null 2>&1) || su pgtest -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/fpg/data -o '-p 5544 -k /tmp/fpg -c listen_addresses=127.0.0.1' -l /tmp/fpg/pg.log start" >/dev/null
sleep 1
pkill -f "deno run -A index.ts" 2>/dev/null; pkill -f "deno run.*fapi" 2>/dev/null; pkill -f mockcms.py 2>/dev/null; pkill -f mockstorage.py 2>/dev/null; sleep 0.5
$P -c "drop database if exists fin with (force)" -c "create database fin" && $P -d fin -f /tmp/fpg/base.sql >/dev/null 2>&1
# public.staff จำลอง (ของจริงซิงก์จาก CMS): Manager U5 + Staff U6 สาขา A · Accountant U1 สาขา B
$P -d fin -c "create table if not exists public.staff(id uuid primary key default gen_random_uuid(), cms_ref text unique, is_active boolean default true, branch_id uuid); insert into public.staff(cms_ref, branch_id) values ('u:U5','aaaaaaaa-0000-0000-0000-00000000000a'),('u:U6','aaaaaaaa-0000-0000-0000-00000000000a'),('u:U1','bbbbbbbb-0000-0000-0000-00000000000b') on conflict do nothing;" >/dev/null
# Storage ของ Supabase จำลอง (migration สร้าง bucket + trigger ลบไฟล์)
$P -d fin -c "create schema if not exists storage; create table if not exists storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]); create table if not exists storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);" >/dev/null
$P -d fin -v ON_ERROR_STOP=1 -f /home/claude/fin/supabase/migrations/202611210004_finance_operational_v1.sql >/dev/null 2>&1 || echo "MIGRATION 004 FAILED"
$P -d fin -v ON_ERROR_STOP=1 -f /home/claude/fin/supabase/migrations/202611210005_finance_fix_search_path.sql >/dev/null 2>&1 || echo "MIGRATION 005 FAILED"
$P -d fin -v ON_ERROR_STOP=1 -f /home/claude/fin/supabase/migrations/202611210006_finance_manager_final_verification.sql >/dev/null 2>&1 || echo "MIGRATION 006 FAILED"
for m in /home/claude/fin/supabase/migrations/202611211[89]*.sql /home/claude/fin/supabase/migrations/2026112120*.sql /home/claude/fin/supabase/migrations/2026112121*.sql /home/claude/fin/supabase/migrations/2026112122*.sql /home/claude/fin/supabase/migrations/2026112123*.sql; do
  [ -f "$m" ] || continue
  $P -d fin -v ON_ERROR_STOP=1 -f "$m" >/tmp/fe2e/mig.log 2>&1 || { echo "MIGRATION FAILED $m"; tail -3 /tmp/fe2e/mig.log; }
done
rm -rf /tmp/fapi/*.ts; cp /home/claude/fin/supabase/functions/finance-api/*.ts /tmp/fapi/
nohup python3 /tmp/fe2e/mockcms.py >/tmp/fe2e/cms.log 2>&1 &
nohup python3 /home/claude/fin/tests/finance/e2e/mockstorage.py >/tmp/fe2e/storage.log 2>&1 &
cd /tmp/fapi && FINANCE_DB_URL=postgres://postgres@127.0.0.1:5544/fin FINANCE_CMS_URL=http://127.0.0.1:8799/ SUPABASE_URL=http://127.0.0.1:8760 SUPABASE_SERVICE_ROLE_KEY=test-service-role-key FINANCE_TEST_ORIGINS=http://localhost:8766,http://localhost:8767 nohup deno run -A index.ts >/tmp/fe2e/api.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null localhost:8000 && break; sleep 0.5; done
curl -s localhost:8000 ; echo
