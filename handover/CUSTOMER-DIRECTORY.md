# Customer directory

Open Staff → customers while signed in as an owner.

Search by name, email or mobile. Open a profile to view contact details,
customer preferences, and paginated past or upcoming bookings. Booking cards
include the barber, service, date, time, duration, price and status. Contact
links open the phone or email app. Edit details saves to the existing profile;
marketing consent is not changed. Preferences are customer-facing booking
preferences, not private staff notes.

## Install

Apply `supabase/migrations/20260910072152_customer_directory.sql` after the
existing booking upgrade and rate-limit repair, then deploy this source.
Do not rerun the original migrations. No new environment variables are needed.

The migration preserves original customer rows. Identical guest records
(same name, email, mobile, country and preferences, without waitlist membership)
are grouped under one directory profile; their booking and consent references
are retained under that profile. Different contact details, notes, authenticated
accounts and waitlist-linked records are deliberately left separate. New booking
batches reuse an existing guest profile only when name, email and mobile match.
Changing any of these details on a later booking can create a separate profile;
there is no manual merge feature in this release.

The directory is owner-only, checked on every API request. Responses are private
and uncached. Profile edits compare the original field values before saving to
avoid overwriting a concurrent change. No payment card data or booking access
tokens are returned by this endpoint.

Historical Fresha bookings will need a separate import; this directory shows
bookings already held in this app's database.

Validation: local database migration tests cover returning customers, conservative
consolidation and preserved history; lint and production build also checked.
Verify with a test profile on the connected deployment before daily use.

Suggested commit title:
feat: add searchable customer profiles and booking history
