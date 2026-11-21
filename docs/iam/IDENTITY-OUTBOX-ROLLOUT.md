# HR IAM Identity and Outbox Foundation

## Canonical identity
- `iam_principals.id` is the stable IAM principal identifier.
- Each principal maps to exactly one `staff.id`.
- Existing `auth_user_id` and `cms_ref` are copied as optional unique aliases; legacy values are not rewritten.
- Backfill only creates a mapping for an existing staff row and does not create login accounts or issue grants.
- Changes to staff identity must be performed by trusted service-side code and audited.

## Outbox delivery lifecycle
The outbox now has lease and delivery metadata (`locked_at`, `locked_by`, `delivered_at`, `idempotency_key`). A consumer must:
1. Claim eligible pending/failed events atomically with `FOR UPDATE SKIP LOCKED` and a bounded lease.
2. Deliver only to explicitly active/registered consumers over authenticated transport.
3. Use `event_key` as the idempotency key at the receiver.
4. Acknowledge success by setting `processed` and `processed_at`/ `delivered_at`.
5. On failure, increment attempts and schedule exponential backoff; after the configured limit mark `dead_letter`.
6. Reclaim expired processing leases safely.

No external consumer endpoints or credentials are configured in UAT yet. Therefore this migration does not mark events delivered and does not enable automatic dispatch. Do not activate draft IAM applications until a consumer is registered and tested.

## Current rollout boundary
This is a foundation, not full account provisioning. Email invitations, OTP delivery, LINE account linking, runtime module enforcement and authenticated browser E2E still require their respective trusted provider/backend integrations. Existing login flows remain untouched.
