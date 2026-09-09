-- Roll frontend back first. Retain receipt journal for audit and future recovery.
drop function if exists public.submit_reliable(uuid,text,jsonb,timestamptz);
