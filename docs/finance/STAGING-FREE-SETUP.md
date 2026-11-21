# Finance API — No-cost preparation and activation checklist

Status: CODE PREPARATION ONLY. No Development Branch, SQL migration, bucket, or Edge Function has been created or deployed.

## Current implementation
- Isolated Edge Function source: `supabase/functions/finance-api/index.ts`.
- CMS session verification uses the existing Back Office bootstrap endpoint.
- Finance access is denied unless the CMS actor has a matching active row in `finance.user_roles` for an active company.
- The API scopes partner, account and document reads/writes by the mapped `company_id`.
- Supported initial data actions: list partners, accounts and documents; create partner; create draft invoice/expense document.
- Payment approval, journal posting, period closing and tax submission intentionally return HTTP 501 until their workflows are designed and tested.
- Browser code does not read guessed localStorage/sessionStorage keys. The CMS host must explicitly inject the verified session-token provider.

## Zero-additional-infrastructure work
1. Continue static code review and JavaScript syntax checks on the feature branch.
2. Use the standalone UI preview for layout and local form validation only.
3. Do not run SQL drafts against the existing production project.
4. Do not deploy `finance-api` until the database schema and identity mapping are available.
5. Do not add Finance to the production Owner menu or modify the shared CMS session flow.

## Requirements before a real API test
- A separately approved database environment containing SQL drafts 001–003.
- Edge Function secrets: `SUPABASE_URL` and `SUPABASE_DB_URL`. The function uses a server-side PostgreSQL connection; never place database credentials in browser code.
- Deploy the isolated `finance-api` function with gateway JWT verification disabled because it verifies the CMS session itself. The function CORS allowlist must match the actual preview origin.
- Confirm the exact stable actor reference returned by Back Office bootstrap (`me.id`, `me.username`, or `me.code`) before provisioning Finance roles.
- Insert an active company row and an active `finance.user_roles` mapping for the verified actor. Do not guess either value.
- Inject the CMS session-token provider into `FinanceAuth.configure({ getSessionToken })` only after verifying the actual host-side token API. Do not read storage keys directly from the Finance page.

## Initial company and role provisioning (operator-reviewed SQL)
After SQL 001–003 have been reviewed and applied to a non-production database, an authorized operator may provision the first company and actor mapping with explicit values:

```sql
begin;

insert into finance.companies (legal_name, tax_id, vat_registered, currency_code)
values ('<LEGAL_ENTITY_NAME>', '<13_DIGIT_TAX_ID>', false, 'THB')
returning id;

-- Use the company UUID returned above and the verified CMS actor reference.
insert into finance.user_roles (company_id, cms_actor_ref, role_code, is_active)
values ('<COMPANY_UUID>'::uuid, '<VERIFIED_CMS_ACTOR_REFERENCE>', 'owner', true);

commit;
```

Replace every placeholder with verified information. Set `vat_registered` to the company's actual status. Have an accountant verify the legal name, tax registration, VAT status and branch data. Never paste secrets or session tokens into SQL.

## Rollback / isolation
- Disable the `finance-api` function or remove its route from the preview if a security issue is found.
- Revoke the Finance actor mapping by setting `is_active = false`.
- Do not drop or alter existing CMS, HR, POS, order or Owner tables/functions as part of Finance rollback.
- Do not merge the feature branch or deploy to Production without explicit approval.
