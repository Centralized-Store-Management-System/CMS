# IAM Runtime Authorization Contract

Status: Phase 1 evaluator endpoint — integration required before any module may rely on it.

## Endpoint
Supabase Edge Function: `iam-authorize`

POST body:
```json
{
  "application_key": "hr",
  "permission_code": "hr.employee.view",
  "resource_scope": { "branch": "BRANCH_CODE" }
}
```
Header: `x-cms-session: <existing CMS session>`

## Decision semantics
- The function revalidates the CMS session through the Back Office bootstrap endpoint.
- Default deny. An allow requires an active application, permission, role, and a time-valid active principal-role grant linked through role-permission rows.
- Resource scope is checked against the grant scope. Wildcard, exact scalar, and explicit array scopes are supported. Missing grant scope does not imply access.
- The endpoint writes an IAM audit record for allow decisions.
- The evaluator does not expand position-role bindings yet. That requires a verified canonical employee↔principal link and effective-dated assignment resolver.
- A module must call this endpoint from its own trusted backend before every protected read/write. A browser call or hidden menu is not enforcement.
- On timeout, malformed response, 401/403, or 5xx, sensitive operations must fail closed. Do not treat network errors as allow.
- The endpoint response is a decision helper, not a replacement for module-specific row ownership, branch filtering, SoD, workflow-stage, or data-integrity checks.

## Integration status
No existing business module is declared protected by this endpoint until that module's backend is changed and tested. Existing Finance and authentication behavior are intentionally untouched in this foundation PR.
