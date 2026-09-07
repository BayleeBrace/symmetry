-- Canonical display names only. Prices, durations, slugs and booking references are unchanged.
begin;
update public.services set name = 'fade' where slug = 'fade';
update public.services set name = 'fade and beard' where slug = 'fade-beard';
update public.services set name = 'cut' where slug = 'cut';
update public.services set name = 'cut and beard' where slug = 'cut-beard';
update public.services set name = 'under sixteens' where slug = 'under-16';
update public.services set name = 'under thirteens' where slug = 'under-13';
update public.services set name = 'over sixties' where slug = 'over-60';
update public.services set name = 'one length' where slug = 'one-length';
update public.services set name = 'line up and beard' where slug = 'line-beard';
commit;
