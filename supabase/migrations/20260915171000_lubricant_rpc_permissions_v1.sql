revoke all on function public.lubricant_create_storage(text,text,text) from public, anon;
revoke all on function public.lubricant_receive_yard(uuid,text,text,numeric,numeric,text,text,text) from public, anon;
revoke all on function public.lubricant_transfer(uuid,text,text,numeric,text) from public, anon;
revoke all on function public.lubricant_record_reading(text,text,numeric,text) from public, anon;
revoke all on function public.lubricant_unit_directory() from public, anon;
revoke all on function public.lubricant_issue_to_unit(uuid,text,text,text,numeric,text,text,text,text,numeric,smallint,text) from public, anon;

grant execute on function public.lubricant_create_storage(text,text,text) to authenticated;
grant execute on function public.lubricant_receive_yard(uuid,text,text,numeric,numeric,text,text,text) to authenticated;
grant execute on function public.lubricant_transfer(uuid,text,text,numeric,text) to authenticated;
grant execute on function public.lubricant_record_reading(text,text,numeric,text) to authenticated;
grant execute on function public.lubricant_unit_directory() to authenticated;
grant execute on function public.lubricant_issue_to_unit(uuid,text,text,text,numeric,text,text,text,text,numeric,smallint,text) to authenticated;
