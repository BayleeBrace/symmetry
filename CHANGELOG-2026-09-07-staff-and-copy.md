# Symmetry: staff diary rebuild and copy pass, 7 September 2026

## What changed

### Staff area (`/staff`), rebuilt mobile first
- **Diary is now a timeline.** One column per chair with a time rail, bookings placed at their real time and length, blocks shown as hatched space, a whole day off shown across the column, and an oxblood "now" line on today's diary. On a phone the diary opens at the current time and one chair shows at a time, with sticky chair pills to switch.
- **Tap a booking for a sheet.** Customer, service, length, price, notes, phone and email links, status chip, running-late note. Actions follow the status: "In the chair" then "Done", with "No show" and "Cancel trim" as secondary buttons (both confirm first). "Done" and "No show" only enable once the trim has started, which is also what the server enforces. "Move this trim" and the owner's fee charge/waive live in the same sheet.
- **Tap a gap to add a walk-in.** The walk-in form opens with that chair and time filled in. The form shows the price and length for the chosen barber and service, and offers only times inside opening hours.
- **Breaks are a choice** between "A break" (from/until) and "The whole day" (holiday), with a label.
- **Day navigation** is one row: previous day, the date (tap it to pick any date), next day, and "Back to today" when you have moved.
- **Settings show the current values.** Prices and timings are a table of every service by every barber; tap a cell to change it. Weekly hours are a table of chairs by day; tap a cell to set start and finish or a day off. The cancellation policy form is unchanged in behaviour.
- **Reports** show the six figures as tiles plus trims per day.
- **Launch checks** keep their layout with the site's spacing and type.
- **Sign-in** no longer shows an error before anyone has typed, and the page shows "Opening the diary…" instead of flashing the sign-in form for someone already signed in.
- Staff styles now live in `src/app/staff/staff.css` (scoped to `.staff-page`); the old dashboard CSS block was removed from `globals.css`. The diary API also returns the day's opening hours (`hours`) so the timeline knows the shop day.

### Copy: proper capitalisation everywhere (Sean's request)
- Sentences, headings, buttons and labels are sentence case; names, places, days and months are capitalised: "Same chairs. New name.", "Sean", "Saundersfoot", "4 Brewery Terrace", "Monday", "Formerly Studio 4 Barbers."
- Service names are sentence case in code (`Fade`, `Cut and beard`, `Under sixteens`…) and a new migration `supabase/migrations/20260907230000_sentence_case_service_names.sql` updates the database names and the barbers' role labels to match. Until it is applied, the staff diary still shows the canonical names from code.
- The lowercase `text-transform` on the navigation and the teaser label was removed. Uppercase tracked labels (buttons, eyebrows) are unchanged.
- "Next open" wording now uses the same "9am" style as the hours list.
- The "trim" vocabulary is kept as agreed.

### Errors in oxblood
- Error messages across the site (booking flow, your bookings, waitlist, staff sign-in and diary, notification button) render in oxblood. On the black teaser the password error sits on a bone chip so it stays readable.

## What to test
1. **Phone first.** Sign in at `/staff` on a phone. Today's diary should open at the current time with your chair selected. Switch chairs with the pills, scroll the day, tap a booking, try "In the chair", then "Done", then close the sheet.
2. Tap an empty gap: the walk-in form should open with that chair and time. Add a walk-in and check it appears in the diary.
3. Breaks: add a 30-minute break, then a whole day off on a future date. Both should appear; remove them from their sheets.
4. Settings (owner): change one price, check the prices page and the booking page show it. Change one day's hours for a chair that has no future bookings; a chair with future bookings should show the server's message asking you to reconcile first.
5. Reports and launch checks load and read correctly.
6. Desktop: the same diary shows all three chairs side by side; the sheet opens on the right.
7. Public site: read every page once for capitalisation. Try the waitlist form with the shop's database disconnected (preview) and confirm the error reads in oxblood.

## Migrations to apply
- `supabase/migrations/20260907230000_sentence_case_service_names.sql` (names only; prices, durations and slugs unchanged).

## Verification here
- Production build, ESLint and TypeScript clean; 15 automated tests pass.
- Diary, sheet, walk-in, breaks, reports, settings and launch checks were rendered locally at 375px and 1370px with a mocked day of bookings. Live database actions were not exercised here.

## Booking flow: faster, with motion (added later the same evening)

### What changed
- **Picking a date scrolls to the times** once the diary has answered, on every screen size. Picking the same date again re-reveals the times. Choosing a time reveals the repeat option if it is off screen. Nothing scrolls when the target is already fully visible.
- **One tap fewer per step.** Tapping a barber moves to the service step, tapping a service moves to the dates, each after a short beat so the selection is seen. The "Choose a trim" and "Choose dates" buttons still work. Step changes scroll to the top.
- **Motion.** Pressed states on cards, dates and times; time slots rise in one after another; a shimmer stands in for "Checking the diary…"; the progress steps have an animated bar; the summary in the sticky bar fades as it changes; the "Add this trim" button nudges once a time is chosen; basket items and the confirmation card ease in. Every animation and transition is disabled for visitors with reduced motion switched on.

### What to test
1. On a phone, tap a barber, then a service, then a date. You should land on the times without scrolling by hand.
2. Tap a time and watch the bar update; add the trim and check the basket item eases in.
3. With "Reduce motion" on in the phone's accessibility settings, repeat step 1: everything should still work with no animation.

### Towards the customer app
The booking flow, the "Your bookings" page and the waitlist are already client-side screens driven by the JSON API, the site is installable (manifest, icons, service worker) and web push subscriptions exist. The shortest route to a store app is a native shell around these same screens with native push, the way the Broadfield guest app was done, with a customer sign-in added so the app can open straight onto "Your bookings" instead of a link from an email. That is a separate piece of work; nothing here blocks it.
