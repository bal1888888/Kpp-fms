# Admin / GL End Shift

Dashboard → Monitoring Petugas Shift → Semua Sesi Aktif lists all ACTIVE sessions, oldest first, including periods outside the current shift and inactive/removed master assignments. Admin and GL receive an End Shift action with required reason (10–1000 characters) and identity confirmation. Atasan remains read-only.

The RPC authorizes against current_staff_role, locks the owner's session, writes an immutable audit snapshot, and ends it in the same transaction. An already-ended session returns success without a second audit. Direct table writes and anonymous calls are denied. The private implementation cannot be called by authenticated clients directly. A narrow public wrapper validates Admin/GL before delegation.

Administrative ending deliberately permits missing Closing/meter for abandoned sessions. Missing storage Closing and meter completeness are captured in the audit; it never invents stock or meter readings. The normal Fuelman End Shift trigger still requires Closing. The exception only applies to the audited actor/session/timestamp from the same transaction. Same-period reassignment restrictions remain: ending an old session releases its ACTIVE lock, but does not permit a second assignment for the same FT/date/shift.

No existing operational session was ended during deployment. Schema/RPC and grants verified read-only after migration. PGlite tests verify permissions, current/old sessions, retry, audit immutability, and normal Closing guard. UI test verifies unfiltered old ACTIVE sessions and Admin/GL-only buttons. Browser UAT not performed with production accounts.

Security advisor reviewed: authenticated SECURITY DEFINER warning on the public wrapper is expected for this role-checked administrative entry point (https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Other project-wide advisor findings are outside this change.
