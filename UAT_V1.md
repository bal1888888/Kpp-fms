# KPP-FMS V1.0 Field UAT

Automated regression tests protect code-level invariants. This checklist is for the final real-device smoke test using controlled test data.

## Operator / HM
- [ ] Scan an active unit QR on an Android phone.
- [ ] First check-in accepts a real HM at or above the server reference.
- [ ] HM below the server reference is rejected.
- [ ] HM before rest lower than HM awal is rejected.
- [ ] After HM status is READY, a second HM submit is not offered.
- [ ] Disconnect signal during submit, reconnect, then use **Cek / kirim ulang**. Confirm only one logical request is stored.

## CCR
- [ ] READY operator appears in CCR monitor and can be selected.
- [ ] A second fueling in the same shift follows the configured approval path.
- [ ] ACTIVE/PENDING allocation from an ended shift cannot be used as a fresh allocation.

## Fuelman / Pengisian
- [ ] Current FUELMAN session opens Pengisian and locks FT + shift from the session.
- [ ] PIC TRANSFER cannot enter Pengisian.
- [ ] Leave Fuelman/Pengisian open across 06:30 or 18:30. Old session must block new fueling and direct the user to Closing/End Shift.
- [ ] Qty > unit tank capacity is rejected. Qty at the exact capacity remains valid.
- [ ] Bypass browser validation with controlled test tooling only; database guard must still reject Qty above configured capacity.
- [ ] If CCR limit is lower than tank capacity, the CCR limit wins. If tank capacity is lower, tank capacity wins.
- [ ] Double tap Save does not create a second logical request.

## Stock / Closing
- [ ] FUELMAN cannot End Shift before required FT closing is complete.
- [ ] PIC TRANSFER cannot End Shift before all required MT closing is complete.
- [ ] GL/Admin closing revision requires the existing revision controls and does not delete history.
- [ ] Receipt, transfer, sounding/tera and stock totals remain consistent after one controlled test transaction.

## Role access
- [ ] Fuelman sees only Fuelman operational access intended for the role.
- [ ] CCR cannot open management-only pages.
- [ ] Atasan remains view-only where configured, including tank capacity visible but not editable.
- [ ] GL/Admin can maintain unit tank capacity; other roles cannot change it.

## Device / release smoke
- [ ] Open related pages on PC and Android Chrome.
- [ ] Refresh during a safe non-submit state and confirm session/navigation recover correctly.
- [ ] GitHub Pages deployment is green and live assets are the current release.
- [ ] Test records are clearly identified and cleaned up only through approved audit-safe procedures.
