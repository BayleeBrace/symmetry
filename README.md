# Symmetry — booking app

A mobile-first Symmetry website and bespoke booking app for GitHub, Vercel and Supabase. This package updates the existing app; it has not been deployed or connected to live payment or messaging accounts.

## This update

- Editable cancellation policy: free until six hours before, then 50% late cancellation and 100% no-show. Sean must confirm these settings before live bookings are enabled.
- Stripe-hosted card setup with no deposit. Fees use the price and policy accepted at booking, and require a separate owner review. Charges default to disabled.
- Staff sign-in and chair-specific diary, walk-ins, arrivals, completed trims, no-shows, moves, breaks and holidays. Owners can manage prices, weekly schedules, policy and fee review.
- Customer links for changing barber/service/time, cancellation, preferences, running-late updates, booking history and rebooking.
- Calendar downloads, email recovery, confirmations and reminders, optional SMS and push, verified waitlist requests and availability alerts.
- Basic completed-service and cancellation reports. Optional Apple and Google Wallet passes.
- Server-side phone validation, rate limiting, atomic multi-booking and diary collision checks, accepted-policy snapshots and current-price checks.

## Develop

Use Node 22 or newer. Run `npm ci`, then `npm run dev`. Checks: `npm test`, `npm run lint`, `npm run build`. Vercel's root directory must be this folder containing package.json and src/app.

## Connect a development project first

1. Apply `supabase/migrations/20260906151133_initial_booking.sql` to a new Supabase development project. Skip it if it was already applied.
2. Apply `supabase/migrations/20260907200703_booking_app_upgrade.sql` after the initial and canonical service-name migrations. It contains the complete booking, policy, notification, rate-limit and staff-diary backend added after the foundation schema.
3. Apply `supabase/migrations/20260907202315_repair_rate_limit_schema.sql`. This safely aligns early `rate_limits` installs with the completed booking backend.
3. Copy `.env.example` to `.env.local`, then set the corresponding Vercel variables. Never expose server secrets with a NEXT_PUBLIC prefix. Keep LINK_SIGNING_SECRET stable: rotating it invalidates signed booking links.
4. Create the owner's account once through Supabase Auth and add its UUID to `staff_members` with Sean's barber_id, role `owner`, active=true. Sean then creates Travis's and Dylan's sign-ins from the diary's Team tab (email plus a temporary password), can switch them off or reset a password there, and everyone changes their own password in the Account tab. Every sign-in sees every chair in the calendar; sales and reports are each barber's own. Staff sign in at `/staff` using email/password. The staff app is laid out like Fresha: Calendar (day or week, one chair or all), Clients, Sales, Catalogue, Team with shifts, Reports, Marketing and Settings. See `handover/CLIENTS.md` for the client directory migration. Sessions renew through an HTTP-only refresh cookie. Existing staff must sign in once after this update; expiry, revocation and two-tab behaviour still need a real-account trial.
5. In Stripe test mode configure `/api/stripe/webhook` for `checkout.session.completed`, and set its webhook signing secret. Checkout saves the payment method and then finalizes the booking. Availability is checked again after card setup; a saved card does not guarantee that a slot remains available.
6. Configure Resend with a verified EMAIL_FROM address. Live booking creation requires email and webhook configuration. Configure Twilio for optional SMS. Notifications are operational booking messages. The one marketing message is the rebook reminder ("Time for a trim?"), sent only to customers who ticked the reminder box when booking, once they are a week past their usual gap between trims, at most once every two months, and never when they already have a trim booked. Every reminder carries a stop link; stopping is recorded as a withdrawn consent. The box is unticked by default.
7. This package includes a Vercel cron calling `/api/jobs` every minute (requires a plan supporting minute-level jobs, such as Pro). Set CRON_SECRET and enable NOTIFICATIONS_ENABLED only after configuring your intended test/live providers. Cron runs on production deployments; trigger the protected endpoint manually in staging. See https://vercel.com/docs/cron-jobs.
8. Sign in as owner and confirm the cancellation policy. Set BOOKINGS_ENABLED=true only for the intended test/live environment. Keep CARD_CHARGES_ENABLED=false until test-card workflows and the fee policy have been signed off. Owner-initiated staff cancellation is treated as a courtesy cancellation without a fee.
9. Keep SITE_LIVE=false and SITE_PASSWORD set during preview. Set SITE_LIVE=true at launch; the public sitemap then expands to the main shop pages.

## Optional app features

Push requires VAPID keys and user permission. On iPhone, web push requires an installed Home Screen web app on a supported iOS version. Push subscriptions are tied to a staff account or secure booking link.

Wallet buttons appear only when the relevant certificates/service account variables are configured. Apple requires a Pass Type ID and signing certificates. Google requires an approved Generic Wallet class and service-account access. Wallet passes and downloaded calendar entries are snapshots: they do not update automatically after moves/cancellations. The customer booking link remains authoritative.

## Operational limits and checks before launch

- The production build and local PostgreSQL-compatible tests passed. Real Supabase permissions, simultaneous requests, provider delivery, Stripe authentication/failures and browser/device flows still need end-to-end staging verification. No real cards were charged or messages sent here.
- Run Supabase security/performance advisors after applying the SQL. Reconcile existing Fresha bookings before opening availability.
- Review `notification_jobs` for failed or interrupted deliveries. Provider acceptance is not proof of delivery. Failures do not automatically retry: reconcile the provider record before retrying to avoid duplicate SMS. The owner’s launch-checks tab shows the oldest 50 unsettled messages. Delivery webhooks are not included.
- An interrupted fee with no recorded PaymentIntent pauses for manual Stripe reconciliation. Recorded intents are reused rather than creating another charge. Failed/authentication-required fees need owner handling; no unattended fee collection is enabled.
- Weekly schedule changes are blocked when future bookings exist; reconcile those bookings first or use dated diary blocks.
- Reminders are queued for 24 hours before a trim. Scheduler delays affect delivery time. Monitor queue backlog and tune worker capacity before scaling.
- Reports show completed service value, not bank/payment reconciliation. Staff phone OTP, native mobile apps, automatic Wallet updates and full marketing campaigns remain future work.
- Agree customer privacy/retention wording and retention cleanup before collecting live customer data. Do not commit .env.local or certificate/private-key files.


## Latest readiness pass

“Book my usual” links now start directly at dates, retaining the selected barber and service. Customers still see the current service and review the booking before saving a card. Unavailable services fall back to selection.

Confirmation/reminder messages and customer booking pages show the precise free-cancellation deadline in Europe/London, including daylight-saving changes. Reminders for trims that have started or been cancelled are suppressed. Waitlist links preserve the requested date. Availability failures no longer leave selectable stale times.

The owner-only **launch checks** tab reports configuration presence and pending/failed messages. It never displays secret values, and it does not certify delivery or payment success.

See LAUNCH-CHECKS.md for the remaining staging and Fresha cutover checks. Live customer bookings and messaging both default to disabled independently of the website teaser switch.

## Session, recovery and layout update

Supporting copy now has more space below headings across the site. Booking preview and progress labels use larger, darker, regular-weight text.

Staff sessions renew while the diary is used and when returning to the tab. Removed staff lose access. A rejected renewal asks for sign-in again.

Trims already added to a booking are saved in the same tab for up to two hours, without customer contact details or payment tokens. Recovery rechecks availability, durations and current prices. Customers returning from card setup are prompted to check their bookings before starting another booking.

Owners see a diary warning for failed messages or messages delayed more than 15 minutes. Optional owner push alerts require VAPID configuration, a subscribed owner device and the notification worker; alerts are attempted at most once per hour. This cannot detect a stopped scheduler or database outage: external monitoring remains necessary. Customer messages are not blindly retried.

See `handover/TRIAL-AND-SWITCH.md` for the lads’ trial and Fresha reconciliation. `scripts/check-handover.py` compares normalized booking CSVs without importing anything or contacting customers.

## September site audit fixes

See `AUDIT-FOLLOWUP.md` for the visual, SEO, privacy, contact and security changes, verification results and outstanding owner/account tasks. Contact fields are configurable; the privacy notice remains a clearly marked draft until reviewed. No DNS records or provider accounts were changed.

Apply `supabase/migrations/20260907190113_canonical_service_names.sql` after the existing setup to align database service labels. It changes names only. Set FORMERLY_UNTIL to the first date without the old-name line once the launch date is agreed.
