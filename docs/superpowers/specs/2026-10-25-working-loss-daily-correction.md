# Dashboard working loss correction

User clarified that only Supply Loss should be MTD. Working Loss must remain H-1 daily, with total plus separate Shift 1 and Shift 2 cards. This supersedes the Working Loss MTD portion of the previous design.

Implementation: reuse the paged MTD rows for supply; calculate Working Loss from only endDate/H-1 rows and its own daily/shift usage denominator. Preserve total, incomplete safeguards, gain labels and date boundaries. Mixed-period heading explicitly labels supply date range and daily working date. Bump Dashboard helper URL. Daily Report remains unchanged. No database writes.

Verification: new regression tests first failed for missing calculateDashboard, then passed. Multi-day Dashboard integration proves supply uses range while working totals use H-1 only. Missing older closing does not suppress today's complete working result. Full npm run check: 474/474 passing, static checks pass.
