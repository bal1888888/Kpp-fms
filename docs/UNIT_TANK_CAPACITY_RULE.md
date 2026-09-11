# Unit Tank Capacity Guard

KPP-FMS stores an optional maximum tank capacity per unit in `unit_master.tank_capacity_liter`.

Rules:
- Only GL/Admin may set or change the capacity.
- Atasan can view the value but cannot change it.
- Fuelman sees the configured capacity on Pengisian.
- If a capacity exists, Qty fuel above that value is rejected in the browser and again by the database trigger.
- CCR limits still apply. The effective browser maximum is the lower value between CCR final limit and unit tank capacity.
- Empty capacity keeps legacy units operational while GL/Admin completes master data.

Example: if an HD unit is configured at 1,380 L, entering 13,800 L is rejected before a fueling record can be stored.
