-- Removes everything TEST-DATA.sql created, and nothing else.
-- Test clients are the ones whose preferences start with "Test record".
-- Run in the Supabase SQL editor before the shop goes live with real clients.
delete from public.notification_jobs
 where group_id in (select g.id from public.booking_groups g
                     join public.customers c on c.id = g.customer_id
                    where c.preferences like 'Test record%');

delete from public.booking_events
 where group_id in (select g.id from public.booking_groups g
                     join public.customers c on c.id = g.customer_id
                    where c.preferences like 'Test record%');

delete from public.push_subscriptions
 where group_id in (select g.id from public.booking_groups g
                     join public.customers c on c.id = g.customer_id
                    where c.preferences like 'Test record%');

delete from public.bookings
 where group_id in (select g.id from public.booking_groups g
                     join public.customers c on c.id = g.customer_id
                    where c.preferences like 'Test record%');

delete from public.booking_groups
 where customer_id in (select id from public.customers where preferences like 'Test record%');

delete from public.customers where preferences like 'Test record%';

-- Should be zero.
select count(*) as test_clients_left from public.customers where preferences like 'Test record%';
