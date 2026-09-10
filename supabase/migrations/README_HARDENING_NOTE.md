# Hardening note

`20260910221000_dynamic_storage_backend_v1.sql` intentionally changes server validation from a fixed MT/FT list to `storage_master`.

Before production apply, verify every historical `fuel_truck`, stock opening/closing storage, and movement source/destination already exists in `storage_master`. This was checked against production before release. The migration uses restrictive foreign keys and no-overwrite RPCs; it does not rewrite historical rows.
