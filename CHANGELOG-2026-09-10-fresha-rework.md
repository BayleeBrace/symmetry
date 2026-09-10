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

## Closer to Fresha (late)

- **Splash screen** while the diary opens: monogram, Symmetry, a soft pulse. No more grey "Opening the diary…" text.
- **One-row calendar header on phones.** Today, arrows, the date with a caret, and a sliders icon. Tap the date for the week strip; tap the sliders for the chair filter and Day or Week. Desktop is unchanged.
- **Calendar look.** Avatars centred above each column, a divider between chairs, rounded cards with a deeper edge in the service colour and a bolder client name.
- **Current-time bar** runs across every chair with the time on the rail, in oxblood. The diary opens scrolled to it. Only on today, of course.
- **The messages notice** now says plainly what is up: how many messages are waiting, and that the once-a-minute sender (the Vercel cron with NOTIFICATIONS_ENABLED) is not running when the number keeps growing.

## Payouts and the plus button

- **The plus button works again on phones.** Its menu had ended up inside the panel the sliders icon hides.
- **Payouts.** A new section for the owner: pick this week, last week, this month or any dates; every barber's trims, sales, card and cash, their share, rent and cash kept, and what is owed. "Mark paid" per barber or "Pay everyone", with a history and Undo. "Bank file" gives a CSV for a bulk payment. Rules per barber (share of sales, weekly chair rent, keeps cash, optional bank details) live under each name. Barbers see their own figures and what has been paid to them under "Your pay". Details in `handover/PAYOUTS.md`.
- Chair rent is charged once per calendar week whatever the payout period, and never twice in the same week. The rules form leads with rent, since that is the shop's arrangement.
- Barbers keep the cash they take on the day by default, so a payout is the card side of their share. If you had already run the payouts migration, run `alter table public.payout_rules alter column keeps_cash set default true;` once.
- Needs migration `20260910210000_payouts.sql`.

### What to test
1. Tap the plus button on the phone: New appointment and Blocked time should appear above it.
2. Payouts, This week: figures per chair from the test data. Under Travis, Rules and bank: set 60% share, save, and watch "to pay" change.
3. Mark Travis paid with a note, then Undo. Pay everyone, then check the list at the bottom.
4. Bank file: with sort code and account saved for one barber, the CSV has their line.
5. Sign in as Travis: Your pay shows only his figures and payouts, no rules, no buttons.

## The Fresha flow (11 Sep)

From Sean's screen recording of Fresha. Four things the Symmetry app now does the same way.

- **The plus is in the middle of the tab bar.** Calendar, Clients, plus, Sales, More. The floating button in the corner is gone. Tap the plus from any section and the calendar opens with the menu: New appointment, Walk-in now, Blocked time.
- **Select time.** New appointment drops a dashed plus on the chair you are looking at (your own chair when the whole shop is showing), at the next free quarter hour, with a black "Select time" bar above the diary and the time in a pill on the rail. Hold and drag the plus to another time or chair, or tap a gap to move it there. Tap the plus, or Next, to fill in the rest. The X, Escape, or changing the day cancels.
- **Walk-in.** A Walk-in button under the client field (and "Walk-in now" in the plus menu) books the trim with no name or number. Walk-ins share one hidden record, so they never clutter the Clients list.
- **Squeeze in.** The time list now shows every quarter hour the chair is working, with taken ones marked "(taken, squeeze in)". Pick one and the button reads Squeeze in; it asks once, naming who is already in that slot, then books it alongside. The two trims sit side by side in the column, in day and week view, the way Fresha draws them. Online bookings still cannot overlap anything. The sheet shows a "Squeezed in" chip.
- **Repeat.** For a regular: Repeat every week, 2, 3 or 4 weeks, 2 to 12 times. Each date goes in as its own trim; any date already taken is skipped and the message says how many.
- Blocked time from the plus menu starts on the chair you are looking at.
- Needs migration `20260911090000_squeeze_in.sql` (adds `bookings.squeezed` and rebuilds the no-overlap rules to allow it). Without it, a squeeze-in is refused with a message saying so; everything else works.

### What to test
1. On the phone, tap the plus in the tab bar. Pick New appointment. A dashed plus should land on your chair with a "Select time" bar above. Hold it and drag it down two slots, then across into Travis's column. The pill on the rail should follow.
2. Tap a gap lower down: the plus should jump there. Tap the plus: the drawer opens with that chair and time.
3. Tap Walk-in in the drawer, pick a service, save. The trim should say Walk-in, and Clients should not list a "Walk-in" client.
4. Open the drawer on a time that is already taken (the list says "taken, squeeze in"). Save, confirm, and the two trims should share the column side by side. Open the new one: the sheet shows "Squeezed in".
5. Book a regular: Repeat every week, 4 times. Four trims on the same weekday and time. Then try again on the same time: it should say the dates were taken and skipped.
6. Try to drag an ordinary trim onto a taken slot: it still bounces back.

## Dark mode and the message backlog

- **Appearance.** Settings, Your account: Light, Dark, or With the phone. Remembered on the device, applied before the page paints, so no flash. Dark keeps the brand: black ground, bone text, the service colours go muted so the cards still read, the "in the chair" card turns bone. The iPhone status bar follows.
- **Message queue tools** under Settings, Launch checks (owner only). The queue now says how many messages are more than a day overdue, how many are due, and how many failed, and whether sending is on. "Clear old messages" cancels everything more than a day overdue: those trims have been and gone, so nothing useful is lost. "Send now" runs the sender once by hand (ten messages a go) when NOTIFICATIONS_ENABLED is on.
- The waiting-messages notice at the top now points to Launch checks.

### What to test
1. Settings, Your account, Appearance: tap Dark. The whole staff app should go dark at once, including the tab bar, sheets and the calendar. Close the app and reopen it: still dark, no white flash.
2. Tap With the phone, then switch the phone to dark in Control Centre: the app should follow.
3. Settings, Launch checks: the message queue shows the three counts. Tap Clear old messages; the waiting number at the top should drop to the ones actually due.
