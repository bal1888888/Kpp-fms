# Dashboard MTD loss with shift breakdown

User requested Dashboard loss MTD and Working Loss separated into shifts 1 and 2, while retaining the total. Four cards: Supply Loss MTD, Total Working Loss MTD, Working Loss MTD Shift 1, Working Loss MTD Shift 2. Daily Report/clipboard remain daily.

Use Dashboard's existing operational period (26th–25th), accumulated through H-1. Supply denominator = summed transportir measured qty. Each working shift denominator = its own summed issue; total denominator = both shifts' issue. Sum signed liters first, then compute percentage (no averaging daily percentages). Gain remains gain.

Reuse the shared daily calculation, adding independently validated per-shift outputs and an MTD aggregation/loader. Require every calendar date in the selected elapsed period; missing opening/closing makes the affected shift incomplete, not zero. One incomplete shift must not hide the other complete shift. Total is incomplete if either shift is incomplete. Supply independently preserves incomplete measurement/no-receipt status. Show completeness count for incomplete MTD working cards.

Read existing tables with ordered pagination over the period; reuse Dashboard's already loaded MTD fuel rows. Preserve request sequence guards and read-error placeholders. No DB writes, no modifications to Stock transaction logic or Daily behavior. Responsive grid: two columns desktop, one mobile.

Approach: extend existing shared helper, retaining daily public interfaces. Separate page formulas rejected because they would drift from daily audit rules.
