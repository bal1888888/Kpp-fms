# Fuelman flowmeter lifecycle — 21 October 2026

Requested flow: Fuelman selects shift, duty FUELMAN and FT; records starting counter before Start Shift. Ending counter is entered once in Stock Closing. Physical Logsheet HO reads the same ft_shift_flowmeter row by date, shift and FT. PIC TRANSFER does not enter FT counters.

Verified existing main and live database already contain ft_shift_flowmeter RPC and guards for starting meter before fueling and ending meter before closing. The supplied screenshot shows the duty dropdown before FUELMAN selection; the meter field is conditional.

Fixed:
- Start button remains locked through both session and meter requests; network exceptions restore buttons with an uncertainty message.
- Missing start meter can be recovered in active Fuelman panel. Ending meter is entered only in Stock Closing, avoiding duplicate entry.
- Navigation hides fueling when start meter is unconfirmed or final meter has been saved.
- Clear counters when changing FT/duty and after ending a session; refresh saved meter before End Shift.
- Closing validates readiness, physical measurements and confirmations before saving the immutable final counter.
- Closing restores a saved final counter on reload, locks its field and reuses the server value on retry.
- Closing network exceptions display unconfirmed status and release the local attempt lock.

Verification: npm run check; behavioral regression tests for required/zero start, duplicate click during pending meter request, rejected network request, no final-meter save from Fuelman panel, refreshed End Shift, restored Closing counter and rejected Closing readiness. Live database inspection was read-only. No operational test transactions or historical values changed.

Limits: session/start-meter and final-meter/Closing remain separate existing RPC transactions. A server failure between them can leave an active session awaiting its starting meter, or a saved final meter awaiting Closing; recovery UI handles these states. This change does not make those RPCs atomic or introduce new database guards. Logged-in browser UAT with real equipment is still required; automated tests use mocked requests.
