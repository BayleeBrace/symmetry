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

## Design pass (later the same evening)

### What changed
- **Hero.** The left-hand gradient is lighter (0.9 to 0.06 instead of 0.98 to 0.12), so the room and the cut through the photo read. Copy stays legible on the darker left third.
- **Booking header.** One slim row on every compact page: wordmark left, "Back to the site" right, and on the booking page "Formerly Studio 4 Barbers." as a small kicker beside the wordmark instead of a lone line above the form. On phones the monogram replaces the wordmark and the kicker sits on its own line.
- **Prices page.** One black "Book a trim" button, with "or book with Dylan, Travis or Sean" as text links. The button runs full width on phones.
- **Booking flow.** The "Live availability" note is gone once the shop is live; the preview note still shows in previews.
- **One heading scale.** Inner-page headings ("Prices.", "Come by.", "Your trims.") now cap at the hero's 6rem, and section headings at 5.5rem.
- **Staff diary, phones.** A sticky "Next" strip above the timeline names the next or current trim for the selected chair; tapping it opens that booking. It only appears on today's diary.
- **Photo brief for Sean** in `handover/PHOTO-BRIEF.md`: five frames, three matching portraits, and how to send them.

### Not done, on purpose
- **Map on the hours page.** Waits for Sean to confirm the pin; an address-based Google embed would also load Google's cookies, which the privacy notice does not mention yet.
- **Week view for the owner.** A later job once the daily diary has been used for a while.

### What to test
1. Home on a laptop: the photo should be visible through the gradient with the slip across it, and the headline still easy to read.
2. Open `/book`: the header is one row with the "Formerly" kicker; on a phone it shows the SY mark with the kicker underneath.
3. `/prices`: one black button, three name links; full width on a phone.
4. Staff diary on a phone on a day with bookings: the "Next" strip stays at the top while you scroll and opens the booking when tapped.

## Customer-ready pass and staff accounts (late evening)

### Customer-facing
- The barber cards no longer carry "portrait coming soon" placeholder text; they show name and role until the portraits arrive.
- **Thank-you email.** Two hours after a trim is marked done, the customer gets "Thanks for coming in" with a "Leave a review" button when `GOOGLE_REVIEW_URL` is set (the Business Profile's "Get more reviews" share link), otherwise a "Book again" button that opens the booking page on the same barber and service. One per trim; cancelled if the status changes. Walk-ins without an email are skipped. The launch checks tab shows whether the review link is set.
- **QR code** for the window, A-board and counter in `handover/qr-book.svg` and `.png`, pointing at the booking page, with print notes in `handover/QR-CODE.md`.
- **Analytics.** Vercel Web Analytics is wired in (same-origin script, so it fits the security policy). Enable it in the Vercel project under Analytics to start collecting; nothing is sent until then.

### Staff accounts
- **Team tab (owner).** Sean sees every chair with its sign-in: email, active or switched off, last sign-in. He can create a sign-in for a chair (email plus a temporary password), switch it off or on, and reset its password. One sign-in per chair. Barbers cannot see this tab.
- **Account tab (everyone).** Change your own password.
- **Reports.** The owner's report now has a per-chair table (trims, completed, no shows, cancelled, value). A barber's report is only their own figures, as before.
- The owner's own account is still created once in Supabase (see README step 4); everything after that happens in the diary.

### What to test
1. As Sean: Team tab, create Travis's sign-in with a temporary password, then sign in as Travis on a phone: only his chair, his walk-ins and breaks, his report, plus Account. Change the password from Account, sign out, sign back in.
2. As Sean: switch Travis off, confirm his next action is refused, switch him back on.
3. Mark a test trim done, wait two hours (or check the message queue in launch checks): a "Thanks for coming in" email should arrive with the right button.
4. Scan the QR code with a phone camera: it should open the booking page.

## Running late, customer history, rebook reminders, just my chair (night)

### Staff
- **Just my chair.** Sean's diary has a toggle above the day: "Just my chair" or "Whole shop". It applies to the diary, walk-ins and breaks, and the choice is remembered on that phone. Barbers' sign-ins are unchanged (their own chair only).
- **Running behind?** On today's diary each chair header has a "Running behind?" link. Pick 10, 15, 20 or 30 minutes and the next two customers with a trim still to come get a text (email if no mobile or no SMS set up): "{Barber} is running about 15 minutes behind for your 2.30pm trim today." Pressing again within ten minutes does not send a second message. The diary shows who was told.
- **Move this trim only offers free times.** The move form reads the chair's live diary for the chosen day and lists only the gaps the trim fits in (within opening hours, around other trims and breaks). It refreshes every half minute while the form is open, and the database still refuses an overlap if two people race for the same gap.
- **Customer history in the sheet.** Tap a trim: "3 previous visits. Last time: Fade with Travis, Tue 12 Aug." New customers show "First visit." No shows appear in oxblood. Walk-ins keep a history too once they have been in more than once.
- **A customer running late now reaches the barber.** When a customer taps "Running late?" on their booking page, the barber's (and Sean's) phone gets a push, and the trim card shows "late 15 min" as before.

### Customers
- **Running late?** on the booking page now asks how late (10, 15, 20 or 30 minutes) and confirms: "Thanks. Travis knows you are running about 15 minutes late."
- **Time for a trim?** A reminder email a week after a customer's usual gap between trims has passed (median of their visits, two to twelve weeks; four weeks after a single visit). Only for customers who ticked the reminder box when booking, never when they already have a trim booked, at most once every two months. "Book my usual" opens the booking page on their last barber and service; "Stop these reminders" works with one tap and is recorded as a withdrawn consent. Goes out once a day after 10am.
- The booking form's optional box now reads "Remind me when I'm due a trim, plus occasional news from Symmetry. Optional, and you can stop any time." The privacy notice says the same.

### Database
- Migration `20260908000000_rebook_reminders.sql`: adds `customers.last_nudged_at` and updates the stored consent wording to match the box. Apply it in Supabase before the next deploy.

### What to test
1. As Sean on a phone: toggle "Just my chair"; only Sean's column shows in Diary, Walk-in and Breaks. Switch to "Whole shop"; all three are back. Reload: the choice sticks.
2. On today's diary, tap "Running behind?" under a chair with trims still to come, pick 15 min. Expect the "Told the next two customers…" note, and a text or email to those customers within a minute (with NOTIFICATIONS_ENABLED and SMS or email set up).
3. Open a customer's booking link on a phone, tap "Running late?", choose 20 min. Expect the thank-you line, a push on the barber's phone (if notifications are enabled on it), and "late 20 min" on the card in the diary.
4. Tap a trim for a returning customer: the history line shows visits, last trim and any no shows.
5. Move a trim: open "Move this trim", change the date. Only free times for that chair appear; a day the shop is closed says so. Book something in that gap from another phone and the list drops it within half a minute.
6. Reminders: run `/api/jobs` after 10am with a test customer whose last completed trim was five to seven weeks ago and who ticked the box. Expect one "Time for a trim?" email; the stop link should land on "Reminders stopped".
