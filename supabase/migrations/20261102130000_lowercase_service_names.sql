-- Lowercase service names and barber roles, as the brand handover of
-- 2 November 2026 asks: lowercase headings and labels, with the canonical
-- service names "fade", "fade and beard" and so on. Reverses the display
-- names set by 20260907230000_sentence_case_service_names.sql.
--
-- Only a name still exactly as that migration (or the canonical-names
-- migration) left it is changed, so anything the owner has since renamed in
-- the catalogue is kept. Slugs, prices and durations are unchanged. Safe to
-- run more than once.
begin;
update public.services set name = 'fade' where slug = 'fade' and name = 'Fade';
update public.services set name = 'fade and beard' where slug = 'fade-beard' and name = 'Fade and beard';
update public.services set name = 'cut' where slug = 'cut' and name = 'Cut';
update public.services set name = 'cut and beard' where slug = 'cut-beard' and name = 'Cut and beard';
update public.services set name = 'under sixteens' where slug = 'under-16' and name = 'Under sixteens';
update public.services set name = 'under thirteens' where slug = 'under-13' and name = 'Under thirteens';
update public.services set name = 'over sixties' where slug = 'over-60' and name = 'Over sixties';
update public.services set name = 'one length' where slug = 'one-length' and name = 'One length';
update public.services set name = 'line up and beard' where slug = 'line-beard' and name = 'Line up and beard';
update public.barbers set role_label = 'owner, barber' where slug = 'sean' and role_label = 'Owner, barber';
update public.barbers set role_label = 'senior barber' where slug = 'travis' and role_label = 'Senior barber';
update public.barbers set role_label = 'junior barber' where slug = 'dylan' and role_label = 'Junior barber';
commit;
