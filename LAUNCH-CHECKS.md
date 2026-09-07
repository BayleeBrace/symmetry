# Symmetry — final launch checks

The app is not yet signed off for real customers. This file separates what has been checked from what still requires the actual Symmetry accounts and the lads’ trial.

## Checked in this workspace

- Production build and lint.
- Fifteen automated tests, covering prices, blocked times, atomic multi-booking rollback, percentage fees, daylight-saving deadlines, duplicate card-finalization calls private database function permissions, draft expiry/privacy and staff renewal single-flight/recovery.
- Seven running-preview HTTP checks passed: direct-to-dates rebooking, valid/invalid booking submissions, and protected endpoints. Additional preview HTTP checks are included in `tests/preview-http.test.mjs`. Run against the isolated preview with no Supabase or payment credentials, using `TEST_BASE_URL=http://localhost:3000 node --experimental-strip-types --test tests/preview-http.test.mjs`.
- The connected Vercel and Supabase accounts expose Broadfield projects only. No Symmetry credentials were present in the local project. No existing business database was changed.
- The cloud browser could not open localhost, so no mobile browser/device verification is claimed.

## Needed before taking real bookings

1. Connect the **Symmetry** GitHub/Vercel and Supabase projects. Apply the database upgrade to staging first. Keep the public site in teaser mode while testing.
2. Add Stripe **test-mode** keys and webhook, Resend sending-domain configuration, and optional Twilio test setup. Enable BOOKINGS_ENABLED and NOTIFICATIONS_ENABLED only in that test environment. Use test cards and designated test recipients.
3. Trial one trim, multiple weekly trims, a conflicting repeat, a changed service/barber, a cancellation before/after its deadline, and a failed/interrupted card setup. Verify what appears in the diary, database, Stripe and messages.
4. Test fee review and waiver. Confirm no deposit is taken, 50%/100% use the booked price, repeated clicks do not duplicate a charge, and failed/authentication-required charges appear for owner handling.
5. Test the full journey on an actual iPhone and desktop: date-to-time scrolling, keyboard/forms, back button, recovery link, calendar import and optional installed-app notifications. Check that an old/expired link cannot access a booking.
6. Have Sean confirm prices, durations, opening hours, cancellation wording and staff access. Add real portraits/copy when ready.
7. Reconcile **all future Fresha bookings**. Export or supply a booking list, agree the switch time, and verify each date/chair before disabling Fresha booking links. Do not assume saved cards can be transferred between providers.
8. Finish privacy/contact/retention wording and verify backups, email delivery, failed-message monitoring and a practical support route.
9. Switch providers to live mode only after the trial passes. Confirm the cron is running and the owner launch-checks page is clear. Then enable BOOKINGS_ENABLED and SITE_LIVE on the intended production project.

## Still manual or limited

- Failed/ambiguous messages require provider reconciliation before retry. Provider acceptance is not delivery confirmation.
- Wallet and calendar files are snapshots, not automatically updated after a booking changes.
- Staff sessions now renew; real-account expiry, revocation, wake-from-sleep and two-tab behaviour still need testing. Existing staff should sign in again after this update.
- Fee collection requires owner review. Some interrupted/failed payment states require Stripe reconciliation.
- No Fresha bookings have been imported and no live provider transactions have been performed here.

Use `handover/TRIAL-AND-SWITCH.md` and its CSV checker for the trial and reconciliation. No live Fresha export has been supplied.

See `AUDIT-FOLLOWUP.md` for privacy/contact configuration and domain/email tasks before launch. New UI changes still need an actual mobile browser check.
