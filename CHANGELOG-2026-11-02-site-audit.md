# Symmetry: whole-site audit, 2 November 2026

An audit of the public website, booking flow, customer pages, share images, staff app, server routes and database. It was checked against the brand handover of 2 November 2026 (`CURRENT-DECISIONS.md`, the master prompt, Edition 01) and the existing repository decisions.

## Decisions

- **Proper capitalisation stays.** The brand handover asks for lowercase headings and labels. A lowercase pass was tried on 2 November and reverted the same day: Baylee chose proper capitals everywhere, as Sean asked on 7 September (`CHANGELOG-2026-09-07-staff-and-copy.md`). Headings, buttons, labels and service names use normal sentence case, and names, places, days and months keep their capitals.
- **Staff warning bands and the dark-mode oxblood** (`#c8737d`) were requested for legibility and stay. The pink and lilac service colours were not requested and were replaced (see the staff section).
- **Shop phone.** Production already has `SHOP_PHONE` set to 01834 811351, so it shows on the live site. The handover lists that number as unconfirmed, so check it is still the shop's line.
- **The teaser password was changed** in Vercel (production `SITE_PASSWORD`) on 2 November. It is not stored in the repository. Anyone who unlocked the preview with the old password has to enter the new one.

## Database update (applied 2 November 2026)

`supabase/migrations/20261102120000_audit_fixes.sql` was applied to the live Symmetry database through the Supabase SQL editor on 2 November, after a check that the September squeeze-in column was present. It is safe to run twice, and it does three things:

- Returning customers keep the notes the team wrote.
- A normal trim can't be booked over a squeeze-in.
- One confirmation goes out per booking rather than one per trim.

On a fresh database, apply it after the earlier migrations, in filename order.

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

## Follow-up: the last row limits (2 November 2026)

The three places that could still stop counting are fixed:

- **Rebook reminders.** Customer details, reminder consent and upcoming trims are looked up a slice of customers at a time, then a page at a time. Before, everyone due went in one request, which gets too long with a few hundred people and was capped at 1000 rows.
- **Client profile totals.** Visits, spend, no-shows, cancellations and upcoming trims count every booking, not just the first 1000.
- **Diary history.** "First visit", visit counts and "Last time" count every past visit for the clients on screen, in slices and pages. The shared "Walk-in" record is left out: its history is everyone's, so walk-ins no longer show a meaningless visit count, and it can't crowd out real clients' history.

A new `forChunks` helper in `src/lib/paging.ts` does the slicing, with a unit test.

## New features (2 November 2026)

- **Remember me on this phone.** The booking form has an unticked box: "Remember my name, email and mobile on this phone for next time".
  - **What's kept:** only those three details, in the customer's own browser (`src/lib/remembered-details.ts`). Marketing permission, notes and the cancellation-policy tick are always asked afresh.
  - **What returning customers see:** "Your details are remembered on this phone. Forget them", with the fields already filled in.
  - **Clearing:** the details are forgotten after a year, when the box is unticked, or when the customer taps "Forget them". The privacy notice says so.
- **Soonest times.** After choosing a barber and a service, the dates step shows the earliest free time on each of the next three days with space, looking three weeks ahead. For "Any barber" it also shows the barber and price. One tap adds that time and goes straight to the details step. Served by `GET /api/availability/next` (`src/lib/next-free.ts`). Times that clash with a trim already in the booking are left out.
- **Live walk-in wait.** The home hero and the hours page say "Walk-ins: a chair is free now.", "about 20 minutes' wait right now.", "next free chair about 3:15pm" or "no space left today", and say nothing while the shop is closed.
  - **How it's worked out:** from today's diary, breaks and each barber's own hours, using each barber's cut length (`src/lib/walk-in.ts`, `src/lib/walk-in-wait.ts`).
  - **Running behind:** a "Running behind" reported in the staff app in the last hour is added to that chair's wait.
  - **Tested:** with unit tests, and in the browser at a fixed time with every chair busy (it read "about 25 minutes").

## Design audit against Edition 01 (2 November 2026)

Every public page was measured at 375px and 1440px for the brand rules:
- clear space around the wordmark and monogram
- one oxblood element per layout
- the serif never under 40px
- no bold, italic or pink
- filled buttons

The pages were also compared by eye with pages 10, 12, 18, 20 and 22 of the guidelines.

What was fixed:

- **The cut never runs through the words** (page 12). The hero's cut ran right between "Same chairs." and "New name." on phones and behind the text block on desktop. It now runs through the top band of the photograph, at least 47px clear of the words at every size from a 360px phone to a 1440px desktop. On wider screens the words sit low and left, as in the website application on page 18.
- **Hero button outlined again** (page 18; "One black button per screen. Nothing else is filled.", page 20). An earlier pass in this audit had made it solid white. It is now a full-white outline that fills on hover.
- **Booking header** (page 20: "Wordmark at the top, black on white"). On phones the full wordmark is centred at the top instead of the SY monogram, and it links home. "Formerly Studio 4 Barbers." moved out of the header, where it sat 12px under the mark inside its clear space, to the top of the booking page.
- **Booking times three across on phones**, as on page 20, which also means less scrolling.
- **Welsh first, English beneath** (page 22). "Croeso." on the home page now has "Welcome." under it, and the error page's "Diolch." has "Thank you.".
- **Type.** Subheads are Jost Light (page 10), so "Finding us." is no longer Regular. Labels are tracked 18%.
- **Heading order.** Trim headings in the booking summary are h2 under the page's h1, so screen readers announce them in order. They look the same.

Checked afterwards:
- no clear-space breaches
- no axe accessibility violations on any public page at either width
- no sideways scroll
- the booking flow passes axe at every step

Not changed, and needing photos or a decision:
- **Photography.** The hero is a 1200 × 1600 portrait, so it is upscaled on wide screens, and on phones most of the visible photo is ceiling. A sharp landscape shot of the mirror wall would suit both. Barber portraits are still to come.
- **Booking order.** Page 20 puts the barber pills and the service list on one screen. The site uses two steps. Merging them would save a tap.
- **Prices page cut.** The A3 poster (page 15) takes the cut above the list. The prices page could do the same, as its one cut.
- **Staff app.** It needs a signed-in account to audit visually.

## New header (2 November 2026)

Chosen from the mockups on the header canvas:
- **At the top:** one row with the wordmark and "Menu". On the home page it sits over the shop photo, which now runs to the top of the screen, with a calm dark band behind the mark.
- **Once you scroll:** a slim black bar with the SY monogram, "Book a trim" and "Menu". Wide screens show the links in the bar instead.
- **The menu:** "Menu" opens a full-screen black menu with large serif links, "Ar agor." or "Ar gau." with today's hours in English beneath, the address, email and Instagram.
  - Focus moves into the menu, Tab stays inside it, and Escape closes it.
  - The page behind doesn't scroll while it's open.

Other changes:
- **Phone status bar:** the area behind it is black now, rather than the bone page colour.
- **Bottom bar removed:** the "Book a trim" bar at the bottom of the home page is gone, since the slim header carries "Book a trim".
- **Code:** `src/components/site-header.tsx` is the header, with `src/components/header.tsx` passing in the open status and contact details. `BrandHeader` is now only the white booking-page header.
- **Checked:** at 375px and 1440px, with no accessibility violations, no sideways scroll, and the cut clear of the words.

## Staff app: calmer screens (3 November 2026)

Same features, easier to read and quicker to get around. Approved from the
mockups first.

- **Diary.** One slim bar with the date and a Day/Week switch, then the
  chairs as chips (Sean, Travis, Dylan, All) and "3 waiting". The tools menu
  and the "In the chair" strip are gone; "Today" sits in the date strip on a
  phone. Cards are flat colour with soft corners: done cards go grey, no
  shows dashed, in the chair black. Dragging is unchanged.
- **Booking sheet.** Call, Text and Email buttons; a quiet Move / No show /
  Cancel row; one black button (In the chair, then Checkout). Prices in £,
  phone numbers as 07700 900233, no computer date in the footer.
- **New appointment.** Date, time and chair in one line with Change; client
  search with Walk-in; mobile and email only for a new client; services as a
  tap list with minutes and prices; one "Book · £24" button.
- **Clients.** The list filters as you type. The profile has Call/Text/Email,
  the numbers in one plain row, and Upcoming/Past tabs.
- **Sales.** The total large, one summary line, a card/cash split bar, and
  the completed trims as a list on a phone.
- **More.** The More sheet and Settings are one page: your account, the
  shop's sections (Catalogue is now "Services and prices", Team is "Team and
  hours"), the settings, Back to the site and Sign out.
- **Dark mode.** Cards are one calm grey with the service colour as a thin
  edge, instead of muddy fills.
- **Fixed.** "Last time" on a booking always said "Trim". The checkout price
  box ran off a phone screen. "Select time" and "Walk-in now" could offer a
  start that runs past closing (14:30 for a 40-minute Fade with a 15:00
  close); they now look for a gap that fits the chair's first service, and
  the form moves a time that would overrun to the nearest start that fits.

## Cancelled trims leave the diary (9 November 2026)

At Sean's request, a cancelled trim no longer shows in the day or week view,
so a cancelled walk-in no longer sits beside the next one. One stays only
while a late-cancellation fee waits for the owner to charge or waive, since
the booking is where that is done. Cancelled trims still appear in the
client's past visits, sales and reports. No shows still show (dashed).

## Text reminders fit one part (10 November 2026)

Texts (confirmations, the day-before reminder, moves, cancellations, no
shows, running late, running behind and waitlist offers) now fit in one
160-character part, so each costs one part instead of three. They carry a
short booking link, symmetrywales.com/b/ and a 35-character code, which
opens the usual signed booking page and lasts the same 180 days. They use
plain characters only, since one curly apostrophe would make the network
send the whole text as Unicode, at 70 characters a part. A very long
service name drops out of the text before it would spill into a second
part. Emails are unchanged. Texts start once Twilio is set up in Vercel
(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).

## Card machine and practice mode (10 November 2026)

Checkout can send a trim's price to the shop's one card machine. The payment
goes to that chair's barber, in their own Stripe account, and on to their own
bank; the card fee (1.4% + 10p, plus 0.25% to split it) comes off it. Each
barber sets up their own account in More, Card payments. No-show and
late-cancellation fees go to the barber too. The owner can refund a paid trim
from the diary. Payouts show card-machine takings as already paid by Stripe.

With Stripe's test key everything runs in practice mode: a pretend card
machine, "Tap a test card" at checkout, and test clients with test cards that
the owner adds and removes from More, Card payments. Clients still never pay
online; their card is only saved for fees. See handover/CARD-PAYMENTS.md.
