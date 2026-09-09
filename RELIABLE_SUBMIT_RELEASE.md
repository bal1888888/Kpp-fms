# Reliable submission checkpoint — 9 September 2026

Scope: fuelman CCR, non-jatah, operatorless fueling, operator check-in and actual HM. Existing allocation, shift, QR and HM rules still execute server-side. No historical records are rewritten.

## Behavior

- Draft fields are stored locally per signed-in account; fuel drafts include session/truck/shift context. Operator drafts are scoped to the unit QR digest. Raw QR tokens are omitted from local saved requests and from the database receipt journal.
- Pressing save freezes a UUID, payload and event time. WIB jam derives from that frozen time; actual HM uses its observed timestamp. Server receipt time is separate. Draft typing alone is not a completed event: press save when recording it.
- A 20-second timeout or lost response leaves an uncertain request. Use **Cek / kirim ulang**; the same ID is replayed. A private transaction journal returns the original result, even after the shift or check-in has ended. No automatic background submission.
- A successful request remains visibly confirmed until **Input berikutnya**. Uncertain requests cannot be discarded through the UI. Definitive server rejections allow **Koreksi draf**.
- Unsaved requests from a past shift are rejected and retained. They are not reassigned to a new shift. Contact Admin/GL for historical corrections.
- Fuel draft restore checks session/truck/shift and never changes read-only HM. Re-scan/check the unit, then restore Qty. Operator check-in and actual HM remain separate actions.

## Limits

This supports a page already opened and validated before connection loss, plus recovery when reconnecting. It does not cache the whole application for a first offline visit, synchronize drafts between devices, or bypass shift validation. Browser data clearing removes local drafts. Storage or Web Locks unavailable blocks new submissions with an explanation. Use a current HTTPS browser.

Idempotency is per request UUID and caller/QR scope. It is not heuristic deduplication of separate intentional transactions on different devices. The older RPCs remain for compatibility; clients should refresh to use the new wrapper.

## Validation

`npm run check`: 15 tests, including existing operational tests plus isolated PostgreSQL and client-state tests. Covered lost acknowledgements, reload, exact replay, local quota error, shared-tab locking, token omission, wrong QR/account, stale shift, altered payload, receipt-insert rollback, and all five dispatch routes. Replay works after simulated shift end. `git diff --check` clean.

Tests use synthetic records in PGlite. No production fueling test or concurrent multi-connection PostgreSQL load test was performed. Visual PC/HP checks remain manual (local browser preview is blocked in this environment).

## Security review

`private.submission_receipts` has RLS and no anon/authenticated grants. The public RPC has explicit action allowlisting, account-role validation for fueling, QR validation for operator actions, pinned empty search_path, scoped advisory lock and payload digest. Underlying fueling role/QR/shift/quota checks are retained. Operatorless insert policy was reviewed and permits the same three roles enforced by the wrapper; session ownership/date/shift are additionally validated. Tokens and full request payloads are not stored in the journal.

## Release order and recovery

1. Upload branch and review CI; apply `supabase/migrations/20260909065023_reliable_submit.sql` to the existing project.
2. Verify function/grants/table, advisors and a rejected input read-only probe (no production records).
3. Merge and await Pages + main checks. Verify deployment.
4. User smoke check: a real permitted transaction, lost-connection recovery if encountered, and HP layout. Never create fictitious BBM records.

Rollback: restore the previous frontend first. `supabase/rollback/reliable_submit.sql` removes only the new RPC and keeps receipt records for audit/recovery. To re-enable after rollback, restore the function definition and grants; do not recreate or delete the receipt table.

At checkpoint creation: implementation and local tests complete; remote migration and deployment still pending. GitHub commit/PR status is the release source of truth.
