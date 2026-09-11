# Capacity UAT

1. Login GL/Admin, open Master Unit, set tank capacity for one test unit.
2. Login Atasan, verify the capacity is visible but the field is locked.
3. Open Pengisian for the same unit and verify the capacity hint appears.
4. Enter Qty below capacity, validation should allow normal flow.
5. Enter Qty above capacity, browser must reject it.
6. If a client bypasses browser validation, database trigger must still reject fuel_history above unit capacity.
7. For CCR mode, effective input max must be the lower of CCR final limit and unit capacity.
