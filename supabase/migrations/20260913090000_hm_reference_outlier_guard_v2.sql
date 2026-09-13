-- KPP-FMS HM reference outlier guard v2
-- Prevents one malformed historical HM row from becoming the permanent server reference.
-- Historical rows are not rewritten or deleted.

create or replace function private.kpp_current_hm_reference(p_unit text)
returns table(hm numeric, source text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_unit text := upper(trim(coalesce(p_unit,'')));
  v_corr public.hm_corrections%rowtype;
  v_hist_hm numeric;
  v_recent_median numeric;
  v_recent_count integer;
begin
  if v_unit = '' then
    return;
  end if;

  select *
    into v_corr
  from public.hm_corrections c
  where upper(trim(c.unit)) = v_unit
    and c.hm is not null
    and c.hm >= 0
    and c.hm::text not in ('NaN','Infinity','-Infinity')
  order by c.tanggal desc, c.jam desc, c.id desc
  limit 1;

  if found then
    -- A HM Master correction is an authoritative reset point.
    -- Rows after it may raise the reference only when the increase is physically
    -- plausible for an hour meter: elapsed wall-clock hours + 48 h tolerance.
    select max(q.hm_akhir)
      into v_hist_hm
    from (
      select h.hm_akhir::numeric as hm_akhir
      from public.fuel_history h
      where upper(trim(coalesce(h.unit,''))) = v_unit
        and coalesce(h.hm_ref_excluded,false) = false
        and h.hm_akhir is not null
        and h.hm_akhir >= v_corr.hm
        and h.hm_akhir::text not in ('NaN','Infinity','-Infinity')
        and (
          h.tanggal > v_corr.tanggal
          or (
            h.tanggal = v_corr.tanggal
            and coalesce(h.jam,time '00:00:00') > v_corr.jam
          )
        )
        and h.hm_akhir::numeric <= v_corr.hm + greatest(
          48::numeric,
          (
            extract(epoch from (
              (h.tanggal + coalesce(h.jam,time '00:00:00'))
              - (v_corr.tanggal + v_corr.jam)
            )) / 3600.0
          )::numeric + 48
        )
      order by h.tanggal desc, coalesce(h.jam,time '00:00:00') desc, h.id desc
      limit 30
    ) q;

    hm := case
      when v_hist_hm is null then v_corr.hm
      else greatest(v_corr.hm,v_hist_hm)
    end;
    source := case
      when v_hist_hm is not null and v_hist_hm > v_corr.hm
        then 'HM valid setelah koreksi (server, outlier guard)'
      else 'HM Master / Koreksi Aktual (server)'
    end;
    return next;
    return;
  end if;

  -- Legacy history can contain one malformed value (extra digit/zero). Instead
  -- of MAX(all history), inspect only the seven latest trusted rows and build a
  -- robust cluster around their median. This keeps a single spike from poisoning
  -- all future operator HM validation.
  with recent as (
    select h.hm_akhir::numeric as hm_akhir,
           h.tanggal,
           coalesce(h.jam,time '00:00:00') as jam,
           h.id
    from public.fuel_history h
    where upper(trim(coalesce(h.unit,''))) = v_unit
      and coalesce(h.hm_ref_excluded,false) = false
      and h.hm_akhir is not null
      and h.hm_akhir >= 0
      and h.hm_akhir::text not in ('NaN','Infinity','-Infinity')
    order by h.tanggal desc, coalesce(h.jam,time '00:00:00') desc, h.id desc
    limit 7
  ), stats as (
    select count(*)::integer as n,
           percentile_cont(0.5) within group(order by hm_akhir)::numeric as median_hm
    from recent
  )
  select s.n, s.median_hm,
         case
           when s.n >= 3 then (
             select max(r.hm_akhir)
             from recent r
             where r.hm_akhir between greatest(0::numeric,s.median_hm*0.5)
                                    and s.median_hm*1.5
           )
           else (
             select r.hm_akhir
             from recent r
             order by r.tanggal desc,r.jam desc,r.id desc
             limit 1
           )
         end
    into v_recent_count,v_recent_median,v_hist_hm
  from stats s;

  if v_hist_hm is null then
    select h.hm_akhir::numeric
      into v_hist_hm
    from public.fuel_history h
    where upper(trim(coalesce(h.unit,''))) = v_unit
      and coalesce(h.hm_ref_excluded,false) = false
      and h.hm_akhir is not null
      and h.hm_akhir >= 0
      and h.hm_akhir::text not in ('NaN','Infinity','-Infinity')
    order by h.tanggal desc, coalesce(h.jam,time '00:00:00') desc, h.id desc
    limit 1;
  end if;

  if v_hist_hm is not null then
    hm := v_hist_hm;
    source := case
      when coalesce(v_recent_count,0) >= 3
        then 'HM cluster transaksi terbaru (server, outlier guard)'
      else 'HM transaksi terbaru (server)'
    end;
    return next;
  end if;
end;
$$;

revoke all on function private.kpp_current_hm_reference(text) from public, anon, authenticated;
