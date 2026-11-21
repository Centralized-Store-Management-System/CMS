-- Harden expense-clearance records: Finance API uses the server-side DB connection.
-- Browser clients must never access clearance rows or evidence metadata directly.
alter table finance.expense_clearances enable row level security;
alter table finance.document_files enable row level security;

revoke all on table finance.expense_clearances from anon, authenticated;
revoke all on table finance.document_files from anon, authenticated;

-- No client-facing policies are intentionally created. The Finance API authenticates
-- the CMS session and enforces company, role, branch and maker-checker rules server-side.
-- Server-side postgres/service roles retain their existing access path.
