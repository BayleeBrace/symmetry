# Clients

Open Staff, Clients. Every signed-in barber can search by name, mobile or email and open a client: contact links, visits, spend, no shows, upcoming and past appointments. The owner can edit a client's details (the screen refuses to save over a change made elsewhere). "New appointment" opens the calendar with the client filled in.

## Install

Apply `supabase/migrations/20260910120000_clients_and_checkout.sql`, then deploy this source. It is safe to run on a database that already had the other copy's `20260910072152_customer_directory.sql` applied, and with or without `20260908000000_rebook_reminders.sql`: every step skips what already exists, and it restores the reminder consent wording that the other migration overwrote. If `20260907230000_sentence_case_service_names.sql` has not been applied yet, apply that too, so the website shows the capitalised service names.

The migration keeps every customer row. Identical guest records (same name, email, mobile, country and preferences, no waitlist membership) are grouped under one client; their bookings and consents move to that client. Different contact details, notes, signed-in accounts and waitlist-linked records stay separate. A new booking reuses a client only when name, email and mobile match exactly; there is no manual merge yet.

It also adds `bookings.paid_by` (card, cash or other), set from Checkout in the calendar, which the Sales section reports on.

Historical Fresha bookings still need a separate import; the Clients section shows what is in this app's database.
