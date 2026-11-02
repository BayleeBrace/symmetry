# Symmetry: whole-site audit, 2 November 2026

An audit of the public website, booking flow, customer pages, share images, staff app, server routes and database. It was checked against the brand handover of 2 November 2026 (`CURRENT-DECISIONS.md`, the master prompt, Edition 01) and the existing repository decisions.

## Decisions

- **Proper capitalisation stays.** The brand handover asks for lowercase headings and labels. A lowercase pass was tried on 2 November and reverted the same day: Baylee chose proper capitals everywhere, as Sean asked on 7 September (`CHANGELOG-2026-09-07-staff-and-copy.md`). Headings, buttons, labels and service names use normal sentence case, and names, places, days and months keep their capitals.
- **Staff warning bands and the dark-mode oxblood** (`#c8737d`) were requested for legibility and stay. The pink and lilac service colours were not requested and were replaced (see the staff section).
- **The phone number is still unconfirmed.** `SHOP_PHONE` stays empty until Sean confirms 01834 811351 or another number.
- **The teaser password was changed** in Vercel (production `SITE_PASSWORD`) on 2 November. It is not stored in the repository. Anyone who unlocked the preview with the old password has to enter the new one.

## Database update to apply

Apply `supabase/migrations/20261102120000_audit_fixes.sql` to the Symmetry database. It is safe to run twice, and it does three things:

- Returning customers keep the notes the team wrote.
- A normal trim can't be booked over a squeeze-in.
- One confirmation goes out per booking rather than one per trim.

Until it is applied, the new code still works, but a booking of several trims sends one confirmation per trim, and each one lists every trim in the booking.

## Public website

- **Search and share metadata.** The root layout no longer sets a site-wide canonical URL or `og:url`. Before, every page without its own (waitlist, bookings, staff, the 404) told search engines and share cards that it was the home page. Privacy and cancellation policy have their own descriptions.
- **Contact email.** `info@symmetrywales.com` is the default shop email (confirmed in the handover). It now shows on the home, hours and policy pages, the footer and the structured data, and transactional email replies go to it. `SHOP_EMAIL` still overrides it.
- **Teaser.** While the site is locked, the teaser now says where the shop is and keeps the old name for recognition: "Formerly Studio 4 Barbers. 4 Brewery Terrace, Saundersfoot. @symmetry.wales".
- **Readability.** Body copy on the public pages is 17px on phones and 18px on desktop. It was 16px Jost Light, below the brand's 17–18px. The following were 12–12.5px and are now larger:
  - desktop navigation
  - hero address
  - footer links
  - eyebrows
  - booking form labels (now Jost Regular)
  - teaser labels
- **Hero call to action.** "Book a trim" on the hero photo is solid white with black text, so the primary action is obvious. It has a white focus ring.
- **Links look like links.** Links inside running text and the contact links are underlined. Before, the Instagram link on the cancellation policy page looked like plain grey text.
- **Phone menu.** Escape closes it and returns focus to the menu button.
- **Privacy notice.** It now mentions Vercel Web Analytics, which counts visits without cookies; before, it said there were no trackers but didn't mention analytics. Dated 2 November 2026.
- **Share images.** The strapline "Barbers · Saundersfoot" sat inside the wordmark's clear space and was removed. The overlay is one gradient that stays dark behind the words and opens up on the right, so the lit mirrors and the room show. The booking card's eyebrow no longer says "Book online".
- **Waitlist alert email** says "Book a trim" rather than "Book online".

## Booking flow and customer pages

- **Barber links start at the service step.** "Book" next to a barber's name (home, prices) opens the flow at the service step with that barber chosen. It used to make customers choose the same barber again.
- **Errors come into view.** An error after tapping the bar's button (often a bad mobile number at the end of the form) is scrolled into view above the fixed bar. Before, it appeared below the fold and the button seemed to do nothing.
- **The mobile number field has an accessible name.** Its label wrapped both the country select and the input, so screen readers announced the input without a name.
- **More country codes.** The list grew from 6 to 30 countries. The UK is still the default.
- **Spacing fixes.** "Any barber" times read "Sean · 24", not "Sean ·24". The booking management page reads "45 min · 22", not "45 min ·22".

## Staff app

- **Fresh data.** The diary and payouts ignore answers that arrive after you've moved on, so a slow day no longer replaces the one you're looking at. A sign-in that expires during the background refresh now shows the sign-in screen instead of stale data.
- **Checkout and clients.** Checkout always sends the price typed at the till. Picking an existing client reuses them instead of creating a duplicate.
- **New appointments.** The form shows diary errors with "Try again". It only offers what the chosen chair does, and limits repeats to the 120-day diary with an accurate message.
- **Settings, reports and payouts.**
  - Settings can't save an empty policy field as 0%.
  - Reports and payouts show loading and errors when switching period.
  - An impossible payout range says so instead of spinning forever.
  - Success notices are toasts, not permanent spinners.
- **Sheets and editors.** Opening one moves focus in, Escape closes the top one, and focus goes back to what opened it. Editors on phones have a real backdrop that closes them and a close button. Pull-to-refresh no longer fires inside an editor. Phones get a date picker.
- **Tap targets and visibility.**
  - Small controls have 44px tap areas.
  - Small card text passes contrast in dark mode.
  - Logos are visible in dark mode.
  - The tab bar respects the iPhone safe area.
  - Sign-out forgets the phone's notifications.
- **Brand.** Slate and stone service colours replace pink and lilac. Selected states are black and white, and there is no synthetic bold.

## Server and database

- **Card setup.**
  - Only the tab that started a booking gets the manage link back after card setup; anyone else is told it's in their email.
  - Stripe is told "done" for setups that can never succeed, so it stops retrying.
  - Times are checked for clashes before the customer enters a card.
- **Bookings and messages.**
  - Returning customers keep their notes.
  - A normal trim can't go over a squeeze-in.
  - One confirmation per booking, listing every trim.
  - Customer messages still go out if the waitlist step fails.
  - Waitlist offers go round everyone before anyone gets a second.
- **Reports and exports.** Reports, sales, payouts, rebook reminders and the client CSV read past the 1000-row limit. CSV exports can't carry spreadsheet formulas. Charged late-cancellation fees count in sales.
- **Small fixes.**
  - Weekly hours changes are only blocked by bookings they would strand.
  - Push can move to a returning customer's new booking.
  - No duplicate "running late" push.
  - Unsubscribe links ask before stopping, so mail scanners can't unsubscribe people.
  - The waitlist works in preview.
  - Landlines are refused for the mobile field.
  - Message wording is tidied: punctuation, "Book a trim", the day in waitlist texts, and one deadline format ("Tue, 10 November 2026 at 9:00").

## Checks

- **Automated:** the tests pass, including new database tests for notes, squeeze-in overlaps and one confirmation per booking. Lint (no errors), TypeScript, Prettier and the production build pass.
- **Browser:** public pages and the full preview booking flow were checked with Playwright and axe at 375px and 1440px, with no accessibility violations and no horizontal scroll.

## Still needs real accounts or devices

- **Staff app:** could only be type-checked and read, not used, because there is no Supabase here. Sign in on a phone and try the diary, checkout, a new appointment, editors and dark mode.
- **Payments and messages:** card setup, the webhook and email/SMS delivery need the Stripe test mode and Resend trial in `LAUNCH-CHECKS.md`.
- **Real iPhone:** date picker, safe areas, pull-to-refresh and booking scroll.
- **Known gaps:**
  - The rebook step's customer, consent and upcoming-trim lookups are not paged yet.
  - Per-client stats in the staff client list still stop at 2000 rows.
  - Customer history in the diary still stops at 3000 rows.
