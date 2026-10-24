# Daily supply and working loss

Approved in conversation: add daily Supply Loss and Working Loss (liters and %) to Dashboard, Daily Report, and copied Daily text.

- Supply loss = sum(transportir flowmeter qty - measured tank receipt), percentage divided by matched transportir qty. Match existing receipt audit; missing measurement is incomplete, never invented zero.
- Working loss = sum of each shift's ledger balance minus physical closing for all storages. Ledger = opening + measured receipt + measured transfer in - measured transfer out - nonduplicate issue. Percentage divided by daily issue. Supply/transfer measurement loss is already excluded from ledger inputs and is not counted again.
- Use H-1 (both shifts) to match Usage Yesterday. Daily uses selected report date minus one; Dashboard uses today minus one. Explicit date in cards and copy.
- Positive = LOSS, negative = GAIN. No denominator => percentage unavailable. No receipt => no receipt, no fictitious 0%.
- Require opening and closing for both shifts, including every storage referenced by transactions and every storage present in either shift. Use historical rows, not today's active storage count. Unknown fuel mapping, malformed numeric fields, duplicates in snapshots => incomplete.
- Recalculate from current ledger so late historical postings/revisions are reflected; no database writes or history changes.
- One shared calculation/formatting module prevents Dashboard, Daily and clipboard divergence. Read three paged tables for one day, reuse existing daily fuel rows; isolate failures to loss display.

Approach: shared read-only browser helper over existing tables. Rejected independent page formulas (drift) and new DB schema/RPC (unnecessary production change). UI uses compact two-card section, responsive at mobile widths. Reset on refresh and guard stale asynchronous responses and copy while loading.

Historical warehouse-only fuel can be mapped only when its FT is available in the page master; inactive warehouse-only references remain incomplete instead of being guessed. Explicit historical FT codes use snapshot membership.
