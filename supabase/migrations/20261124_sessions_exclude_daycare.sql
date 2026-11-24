-- Daycare check-ins share the checkins table with sitter/family check-ins (facility_id is
-- set on the daycare's rows). The sessions view pairs each check-in with the next
-- check-out, and it feeds the family's "Hours This Week", the sessions list, and a
-- sitter's "import sessions" on an invoice. It must count only sitter/family check-ins:
-- otherwise daycare hours land on a sitter's invoice, and a daycare check-out can close a
-- sitter's session. Same columns as before; only the two facility filters are new.
create or replace view public.sessions with (security_invoker = true) as
 select ci.id as checkin_id,
    ci.child_id,
    ci.family_id,
    ci.checked_at as checked_in_at,
    ci.checked_by_name as checked_in_by,
    co.id as checkout_id,
    co.checked_at as checked_out_at,
    co.checked_by_name as checked_out_by,
    extract(epoch from coalesce(co.checked_at, now()) - ci.checked_at) / 3600::numeric as hours,
    co.checked_at is null as is_open,
    ci.checked_at < (now() - '12:00:00'::interval) and co.checked_at is null as needs_review,
    ci.edited as checkin_edited,
    co.edited as checkout_edited
   from checkins ci
     left join lateral ( select co2.child_id,
            co2.status,
            co2.checked_at,
            co2.checked_by,
            co2.checked_by_role,
            co2.family_id,
            co2.checked_by_name,
            co2.id,
            co2.sitter_id,
            co2.edited,
            co2.edited_by,
            co2.edited_by_name,
            co2.edit_note
           from checkins co2
          where co2.child_id = ci.child_id and co2.family_id = ci.family_id and co2.status = 'out'::checkin_status
            and co2.checked_at > ci.checked_at
            and co2.facility_id is null
          order by co2.checked_at
         limit 1) co on true
  where ci.status = 'in'::checkin_status
    and ci.facility_id is null
  order by ci.checked_at desc;
