# Finance & Accounting — User Acceptance Test Plan

Status: PREPARATION ONLY. No production or staging deployment has been performed.

## A. Current preview build
- Open the Finance route directly on the feature branch preview (if hosting preview is enabled).
- Confirm the Finance dashboard renders without changing CMS login/session behavior.
- Open Company, Partners and Chart of Accounts. Confirm each module is lazy-loaded and shows local validation only.
- Open Revenue, Expenses and Payments. Confirm the transaction form renders, supports multiple lines, and calculates subtotal, VAT, withholding tax and net total.
- Confirm invalid 13-digit tax ID and non-positive quantity are rejected.
- Confirm reset clears the form and recalculates totals.
- Confirm every screen clearly states that no data is saved.

## B. Accounting validation cases (accountant must approve expected values)
- VAT 7%, VAT 0%, VAT exempt and outside VAT scope.
- WHT 1%, 2%, 3%, 5% and 10%, including correct tax base and rounding policy.
- Multiple line items, fractional quantities, discounts and rounding.
- Invoice/receipt matching, partial payment, overpayment and refund.
- Credit note/debit note and reversal workflows.
- Closed accounting period and duplicate document/idempotency key.

## C. Security and authorization (required before persistence is enabled)
- Unauthenticated/expired CMS session is denied.
- Owner and Accounting access are mapped from verified CMS identity; unknown identity is denied.
- Accounting cannot approve own payment, post journals, close periods or submit tax filings.
- Owner approval actions require a second explicit confirmation and are audit logged.
- Cross-company reads/writes are denied.
- Direct browser access to Finance tables/storage is denied.
- Audit rows cannot be updated or deleted.
- Posted records cannot be edited/deleted; reversal/adjustment is required.

## D. Isolation and regression
- With Finance closed, browser network trace shows no Finance JS, CSS, API, polling or Realtime activity.
- Opening Finance loads only Finance assets; leaving Finance stops any Finance-only activity.
- Existing CMS login, PIN, POS, HR, roster, order and Owner workflows continue to pass their regression tests.
- Compare CPU, memory, network requests and key workflow timings against an agreed pre-change baseline.
- Verify narrow mobile, iPad and desktop layouts and keyboard accessibility.

## E. Release evidence required
- Separate staging project/database and verified backup.
- Reviewed SQL drafts 001–003 and rollback plan.
- Verified CMS bootstrap payload, stable actor identifier and Accounting permission contract.
- Finance API and private document storage security tests.
- Automated unit/integration/RLS/regression tests and browser network trace.
- Explicit Owner approval before merge or production deployment.
