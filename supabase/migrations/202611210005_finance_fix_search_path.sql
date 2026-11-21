-- ตรึง search_path ของ trigger function (Supabase advisor 0011)
alter function finance.set_journal_line_company() set search_path = '';
