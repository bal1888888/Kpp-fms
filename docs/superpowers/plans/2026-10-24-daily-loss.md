# Daily Loss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Consistent daily supply/working loss in both pages and copied report.
**Architecture:** Shared browser calculation, paged read-only loader and formatter; small page integrations reuse H-1 fuel rows.
**Tech Stack:** Vanilla JavaScript/HTML, existing Supabase client, Node test runner.
**Spec:** docs/superpowers/specs/2026-10-24-daily-loss-design.md

## Global Constraints
- No production DB writes, no dependency additions, task branch only.
- H-1 two shifts; loss-positive/gain-negative; missing data is not zero.
- Run npm run check before merge and verify deployed commit.

## Review Focus
- Incomplete/missing one shift or one transaction storage: no misleading total.
- Zero receipts/usage: no divide-by-zero or fake percentage.
- Measured transfers and late fuel: reconcile once, no duplicate loss.
- Filter races/read failures: no stale loss in copied report.
- Pagination and historical/inactive FT references: complete daily calculation.

### Task 1: Shared daily loss calculation and tests
Files: daily-loss.js, daily-loss.css, scripts/test-daily-loss.mjs.
Interfaces: KPPDailyLoss.calculate({date,openings,closings,movements,fuels,master}) returns {date,supply,working}; load(db,date,fuels,master) returns same; reportText(result), render(host,result), pending(host,date,message).
- [x] Write failing numeric tests: receipt 1000/990 => loss 10/1%; working ledger 1200 physical 1185 and 975 => total 25 / issue 400 = 6.25%.
- [x] Cover missing snapshot/measurement, zero denominator, gain, duplicate fuel, historical storage, paged reads, query errors.
- [x] Run node --test scripts/test-daily-loss.mjs; expect missing helper failure.
- [x] Implement helper and responsive two-card stylesheet; rerun to pass.

### Task 2: Page and clipboard integration
Files: daily-report.html, dashboard.html, scripts/test-daily-loss-pages.mjs.
- [x] Write runtime tests for same H-1 labels/values in page and copied report, missing/error and refresh/race handling.
- [x] Run tests red; integrate shared module, reuse existing fuel rows, reset stale content, guard overlapping loads; run green.
- [x] Update two pre-existing stale test harnesses without changing Stock behavior (baseline 448/450).
- [x] Run npm run check, inspect diff, independent whole-branch review; commit and PR.
- [ ] Merge after green CI, verify main Static checks and Pages on same SHA.

## Execution evidence
- Baseline: 448/450 tests; fixed stale DOM harness and snapshot variable-name expectations only.
- New numeric and page tests observed RED before implementation, then GREEN.
- Independent reviewer identified missing cross-shift tank coverage and unsafe explicit-FT fallback. Both reproduced RED, fixed, full suite GREEN: 465/465; static checks and diff whitespace checks pass.
- Read-only production schema validation confirms all queried columns. On 2026-10-23 the current ledger produces supply gain 1020.6 L (3.197669%) and working gain 31.4 L (0.066799%); rendered rounded to 3.2% and 0.07%.
- Browser visual QA unavailable: Chromium archive download failed. Runtime DOM integration tested automatically.
- Deferred minor: inactive warehouse-only fuel lacks mapping in active page master; renders incomplete rather than guessing. Explicit historic FT references work.
- Decisions: use H-1 to align daily usage, require both shifts of every observed tank; late posted transactions recalculate read-only loss. No production data mutated.
