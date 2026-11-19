-- Private HR employee document bucket (20 MB, PDFs and common image formats).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hr-employee-documents',
  'hr-employee-documents',
  false,
  20971520,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
