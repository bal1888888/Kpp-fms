# Dashboard MTD Loss Implementation Plan

> Use superpowers:executing-plans for inline implementation.

Goal: Four Dashboard MTD loss cards including total and each working shift; Daily unchanged.
Spec: docs/superpowers/specs/2026-10-25-loss-mtd-shifts.md
Architecture: extend daily-loss.js with independent shift metrics plus calculatePeriod/loadPeriod, reuse existing period and MTD fuel data; shared renderer supports daily and period results.
Constraints: read-only, 26–25 through H-1, preserve total, weighted percent and explicit incomplete data.

- [x] Add failing numeric tests for two-day weighted supply/shift/total, gain, zero denominator, one missing shift, missing date and range pagination.
- [x] Add independently computed workingByShift and denominator to metrics; preserve existing daily outputs. Add period aggregation, loader and period placeholders.
- [x] Update Dashboard to load/render MTD four cards, show dates and bases; keep Daily integration unchanged. Update runtime integration tests to distinguish daily and MTD layouts, errors and stale refresh.
- [x] Run all checks and independent review; fix important findings with regression tests.
- [ ] Publish task branch/PR, CI then merge and verify main CI + Pages SHA.

Review focus: total cannot be removed; percentages use the corresponding shift's denominator; incomplete shift 2 cannot suppress complete shift 1; missing days cannot become 0; no multiplied daily queries; Daily copy unchanged.

Validation: 472/472 tests and static checks pass. Independent review approved without blockers; added multi-day Dashboard and error/race tests to address its test coverage suggestion. Production DB unchanged.
