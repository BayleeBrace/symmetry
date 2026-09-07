# Symmetry app

The production foundation for Symmetry Barbers, Saundersfoot. This is separate from the earlier static Netlify mock-up and is intended for GitHub, Vercel and Supabase.

## Working now

- Mobile-first booking flow using the approved Symmetry identity.
- Sean, Travis, Dylan or "any barber".
- Each barber's own price and service duration.
- Month calendar, grouped times and guided mobile scrolling.
- Multiple and repeating trims in one booking.
- A conflicting repeat keeps the valid weeks and offers alternatives for only the week that clashes.
- Required name, email and mobile with a separate unticked marketing choice.
- Preview fallback when Supabase has not been connected. Preview submissions return a disposable reference and do not save contact details.
- Installable web-app metadata and icons.
- Staff area placeholder for the next development slice.

## Local development

```bash
npm install
npm run dev
```

Run checks with:

```bash
npm test
npm run lint
npm run build
```

## Connect Supabase

1. Create a new Supabase project in the London region.
2. Apply `supabase/migrations/20260906151133_initial_booking.sql` to a development project first.
3. Copy `.env.example` to `.env.local` and add the project's URL, publishable key and server-only secret key.
4. Add the same values in Vercel. Never expose `SUPABASE_SECRET_KEY` with a `NEXT_PUBLIC_` prefix.
5. Add each barber's authenticated user ID to `staff_members` before enabling the staff diary.

The migration enables row-level security on every public table. Customers do not receive direct table access. Public booking creation calls a server-only atomic database function which rechecks current services, prices, durations, opening hours, diary blocks and collisions. A random management token is stored only as a SHA-256 hash.

## Before real customers use it

- Finish the secure manage-booking route and its email link.
- Add staff phone sign-in and complete the live diary actions.
- Connect confirmation/reminder email and SMS providers.
- Add rate limiting and abuse protection to public booking endpoints.
- Normalise and verify international mobile numbers on the server.
- Add individual barber schedules, holidays and exceptions.
- Test concurrent booking, cancellation, repeat-booking, UK daylight-saving and permissions against a Supabase development branch.
- Run Supabase security and performance advisors after applying the migration.
- Agree privacy wording, retention, cancellation, deposit and no-show policies with Sean.
- Reconcile every existing Fresha booking before public availability is opened.

Do not treat the current staff screen as authentication and do not take live bookings until those launch checks are complete.
