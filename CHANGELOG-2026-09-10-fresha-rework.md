# Staff app rework, 10 September 2026

The staff side now works the way Fresha does, in Symmetry's colours. Base: the build that is live on Vercel (the one with Team, reminders and running-late). Also merged in from the other copy of the project: the customer directory, now the Clients section.

## What changed

### Layout
- **Left rail on desktop, bottom tabs on phones.** Calendar, Clients, Sales, Catalogue, Team, Reports, Marketing, Settings. Barbers see Calendar, Clients, Sales, Reports and Settings (their account). On a phone the bottom bar has Calendar, Clients, Sales and More.
- **Everyone sees every chair.** Travis and Dylan get the whole shop in the calendar, the same as Sean, and can add appointments or blocked time for any chair. The chair filter narrows it to one chair and "me" is remembered on the device. Sales and Reports still show a barber only their own figures.
- **Sign-in** is a centred card with the monogram.

### Calendar
- **Top bar like Fresha:** Today, arrows, the date (tap to pick), a chair filter (All chairs, or one), Day or Week, and Add (New appointment or Blocked time). On phones there is a row of the week's dates under the bar and a round + button.
- **Day view:** a column per chair with an initials avatar in the header; each chair's appointments carry that chair's tint. Booked is tinted with a black edge, in the chair is black, done is white with a tick, no show and cancelled are dashed. The oxblood "now" line, the next-up strip, "Running behind?" and tap-a-gap all stay.
- **Week view:** one chair across seven days, today circled, closed days hatched. Tap a gap to add an appointment on that day. The chair filter picks which chair.
- **Just my chair / whole shop** is now the chair filter, remembered on the device as before.

### Appointment drawer
- Client avatar and name, date and time, service with the price, status chip, visits and last trim, notes, contact links.
- **Checkout** replaces Done: it shows the total and asks Card, Cash or Other, and records it against the trim. "Done without recording payment" is there for the odd free one. The thank-you email still follows two hours later.
- In the chair, No show, Cancel trim, Reschedule (live free times only) and the fee controls are unchanged.

### New appointment (Add, or tap a gap)
- **Client search:** start typing a name and existing clients appear; pick one and their mobile and email fill in, so regulars are not duplicated. Or type a new client.
- Service, chair, date, and a time list that only shows free times for that chair on that day.

### Clients
- Search by name, mobile or email. A client page shows visits, spend, no shows and cancellations, upcoming and past appointments with how they paid, notes, and a **New appointment** button that opens the calendar with the client filled in. The owner can edit details.
- Every barber can look clients up; only the owner edits.

### Sales
- Today, This week, This month or Last 30 days: sales, trims completed, average per trim, fees charged; a split by payment method and (owner) by chair; and the list of completed trims. A barber sees their own chair.

### Catalogue, Team, Marketing, Settings
- **Catalogue:** the services-by-chair price and timing grid, tap to edit.
- **Team:** Team members (sign-ins, as before) and **Shifts** (each chair's weekly hours, moved here from Settings).
- **Marketing:** the automated messages (confirmation, reminder, running-behind texts, thank-you and review link, "Time for a trim?", waitlist alerts) with On or Needs setup, how many went out in the last 30 days, and how many clients opted in to reminders.
- **Settings:** Your account (password), Cancellation policy (owner), Launch checks (owner).

### Test data
- `handover/TEST-DATA.sql` puts ten test clients with visit history and a few upcoming trims into the database (blank emails and mobiles, so no messages can go out). `handover/TEST-DATA-REMOVE.sql` takes them all out again before launch.

### Database
- `20260910120000_clients_and_checkout.sql`: the customer directory (groups identical guest records, reuses a client on later bookings when name, email and mobile match) plus `bookings.paid_by`. Safe to run on the live database even though this morning's `20260910072152_customer_directory.sql` is already applied: every step skips what exists, and it puts the reminder consent wording back. Also apply `20260907230000_sentence_case_service_names.sql` if you have not yet. Without this migration every online booking creates a new customer row, so visit history and rebook reminders cannot see a regular's past trims.

## What to test
1. On a phone, sign in as Sean: bottom tabs, the date row, one chair at a time with the avatar chips, and the + button. Add a new appointment by typing a regular's name and picking them from the list.
2. On desktop: three chairs side by side with tints, switch to Week, pick Travis in the chair filter, tap a gap on Thursday to add an appointment there.
3. Tap a trim that has started, Checkout, Cash. The chip should read "Done · Cash" and the trim appear in Sales for today under Cash.
4. Clients: search "Tom", open the profile, check the figures, tap New appointment and save one.
5. Team, Shifts: change Dylan's Monday to Off and back.
6. As Travis (barber sign-in): every chair in the calendar, only his own sales and reports, no Catalogue, Team or Marketing.

## Home-screen app, Face ID, and fixes (afternoon)

- **The staff app opens on the diary.** `/staff` now has its own web app manifest ("Symmetry staff", starts and stays in the staff area). Remove the old home-screen icon and add it again from the staff page in Safari.
- **Face ID or fingerprint sign-in.** Settings, Your account, "Set up Face ID on this phone", once per phone per barber. The sign-in screen then has "Sign in with Face ID". Passwords still work. Details in `handover/FACE-ID.md`. Needs migration `20260910180000_staff_passkeys.sql`.
- **Clients list on phones** lays out properly again (name beside the avatar, contact details under it).
- **Everyone sees every chair** in the calendar; sales and reports stay each barber's own.
- **Test data** (`handover/TEST-DATA.sql`) now fills four trims a day on every chair for the rest of today and the next ten days, with this morning's trims already done. Run `TEST-DATA-REMOVE.sql` first if the test clients are already in.

### What to test
1. Remove the old home-screen icon, open symmetrywales.com/staff in Safari, Add to Home Screen. It should open straight on the diary as "Symmetry staff".
2. Sign in with the password, Settings, set up Face ID. Sign out. "Sign in with Face ID" should sign you straight back in.
3. On a second phone the Face ID button should say the phone is not set up yet until you set it up there too.

## Calendar feel (evening)

- **Hold and drag.** Hold a trim for a moment and drag it to another time or another chair; the card follows your finger, a dashed outline shows where it lands and a label shows the new time. Let go to move it. With a mouse, just drag. The database still refuses a slot that is taken. In week view you can drag between days.
- **Every chair side by side on the phone**, with the avatar row above, like Fresha. The chair filter at the top still narrows it to one chair.
- **Colour by service.** Fade, cut, fade and beard and the rest each get their own soft colour, the same in day and week view. In the chair stays black, done is white with a tick, no show and cancelled are dashed.
- **Hatched time outside hours.** Before opening, after closing, and outside a barber's own shift is hatched, and a chair that is off that day says so.
- Moving a trim to another chair keeps its price and length.

### What to test
1. On the phone, hold a trim for half a second, drag it down two slots, let go. It should move, and the diary should refresh with it in the new place.
2. Drag a trim from Sean's column into Travis's. The sheet should then say "with Travis".
3. Drag one onto a slot that is already taken: it should bounce back with the "diary changed or that time is unavailable" message.
4. Switch to Week, drag a trim from Thursday to Friday.

- **Dropped trims stay put.** A dragged trim shows in its new place the moment you let go, while the save happens in the background. If the diary refuses the move, it slides back and the reason shows at the top.
