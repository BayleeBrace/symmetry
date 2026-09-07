-- Sentence-case display names, as the owner asked for proper capitalisation. Slugs, prices and durations are unchanged.
begin;
update public.services set name = 'Fade' where slug = 'fade';
update public.services set name = 'Fade and beard' where slug = 'fade-beard';
update public.services set name = 'Cut' where slug = 'cut';
update public.services set name = 'Cut and beard' where slug = 'cut-beard';
update public.services set name = 'Under sixteens' where slug = 'under-16';
update public.services set name = 'Under thirteens' where slug = 'under-13';
update public.services set name = 'Over sixties' where slug = 'over-60';
update public.services set name = 'One length' where slug = 'one-length';
update public.services set name = 'Line up and beard' where slug = 'line-beard';
update public.barbers set role_label = 'Owner, barber' where slug = 'sean';
update public.barbers set role_label = 'Senior barber' where slug = 'travis';
update public.barbers set role_label = 'Junior barber' where slug = 'dylan';
commit;
