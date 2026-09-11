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

## Push notifications for the team

- **Settings, Notifications** (every barber): Enable on this phone, Turn off on this phone, a "Send a test to my phone" button with a pick-list of every kind, and tick boxes for what you want. Everything is on to start with.
- **What arrives:** new online booking; cancellation; trim moved; customer running late; a trim added to your diary by someone else on the team; "Tomorrow" at six each evening (barbers get their chair, the owner the whole shop, chair by chair); "Not in the chair yet" ten minutes after a trim was due with nobody marked arrived. No customer names, ever: pushes show on the lock screen. Tapping one opens the diary on that day.
- The instant kinds are sent from the booking itself, so they work now, without the cron. The evening brief and the no-show nudge come from the once-a-minute job and go out even while customer messaging is switched off.
- Owners hear about every chair for online bookings, cancellations, moves and late customers. Things the team does to each other's diaries only go to the chair's barber, never to the person who did it.
- Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_CONTACT` in Vercel (in `vercel-env.txt`), and migration `20260911120000_staff_notify.sql` for the choices. Details in `handover/PUSH.md`.

### What to test
1. Put the three VAPID variables in Vercel and redeploy. On your iPhone, open the staff app from the Home Screen, Settings, Notifications, Enable on this phone, allow.
2. Send a test of each kind from the pick-list. Each should arrive on the lock screen within a few seconds with its own title.
3. Sign in as Travis on a second phone and enable it. Then, as Sean, add a walk-in onto Travis's chair: Travis's phone should get "Added to your diary". Move it: "Trim moved". Cancel it: "Trim cancelled". Sean's phone gets nothing for his own actions.
4. Book a trim on the website (test mode) and cancel it from the manage link: both phones should get "New booking" then "Cancelled online".
5. Untick "Possible no show" for Travis and check the box stays off after a reload.

## Checkout edits, holidays, two more pushes, and phone polish

- **Change what was done at checkout.** Checkout now has "What was done" and "Price" above the card, cash and other buttons, filled in from the booking. A fade that became a fade and beard is recorded as such, at that price, and Sales, Reports and Payouts use the recorded figure. A note shows what was booked when you change either. Needs migration `20260911150000_checkout_edits.sql`, which stops a checkout edit being logged as a "moved" trim (otherwise the sender would queue and then drop a pointless customer message).
- **Block a run of days.** Blocked time, "A day off, or a run of days": first day and an optional last day. One block per day, up to nine weeks. Days with bookings are skipped and the message says how many, so move those trims first. The label switches to Holiday for a run.
- **End of day push** at closing: each barber gets their trims, card and cash; the owner gets the shop total and each chair's count. A barber who was off hears nothing.
- **Payday push** on Monday at nine: the owner gets "Last week is ready: Travis owed £510, Dylan £430" and a tap opens Payouts. Each barber gets "It is payday": last week's trims, and card takings less rent due from the shop, or that it has been marked paid. Both use exactly the figures the Payouts screen shows.
- **The time label while dragging** now sits at the top of the screen when you drag with a finger, not under your thumb. With a mouse it still follows the pointer.
- **Floating glass tab bar** on phones: a rounded bar lifted off the bottom edge, frosted so the diary shows through, in both light and dark.
- **Pull down to refresh** anywhere in the staff app: pull from the top of the page and let go to reload the whole thing. Useful on the Home Screen app, which has no address bar.
- **Push tests you can trust.** The test button now reports what each phone's push service said (accepted, or refused with the reason). "Send in 10 seconds" lets you lock the phone first: on iPhone a push sent while the app is open in front may not show.
- **Failed messages** under Launch checks now list why they failed, most common first, with a "Retry failed" button once the cause is fixed.
- Mobile numbers typed by staff are saved in international form (07700 900123 becomes +447700900123), so texts can reach them once Twilio is set up.

### What to test
1. Open a trim in the chair, Checkout, change the service to Fade and beard: the price updates. Change the price to 30. Card. Open Sales: it shows fade and beard at 30.
2. Blocked time, A day off or a run of days, first day Monday, last day Friday, Block these days. Five days blocked; the week view shows them. Try again over a day with a booking: that day is skipped and the message says so.
3. Hold a trim and drag it: the time pill sits at the top of the screen. Drop it.
4. Look at the tab bar: floating, rounded, the diary blurred behind it. Switch to dark: still legible.
5. Scroll to the top of the diary, pull down past "Let go to refresh", let go: the app reloads.
6. Settings, Notifications: Send in 10 seconds, lock the phone. The test should land on the lock screen. If it is refused, the message now says why.
7. Settings, Launch checks: the failed reasons are listed. Once Resend is configured, Retry failed, then Send now.

## Settings, cleaned up

- **Settings is now a list**, one card per page: Your account, Notifications, Appearance, and for the owner, Cancellation policy and Launch checks. Tap one to open it, with a Settings link at the top to come back. The row of tabs that ran off the side of the phone is gone.
- Every settings page sits in its own bordered panel, so the sections read as separate things.
- **Notifications** shows three facts about the phone under the test buttons: whether the app was opened from the Home Screen, whether notifications are allowed on the phone, and which push service the phone is registered with. If the phone has notifications blocked, it says so and where to fix it. Test outcomes are also written to the Vercel logs.

### What to test
1. Settings: five cards for the owner, three for a barber. Open each and come back.
2. Notifications: the three facts at the bottom of Send a test. On your iPhone, the first should say Yes, the second Yes, the third web.push.apple.com. Send me a photo of that block and of the message after a test.

## Push keys check (11 Sep)

- The Notifications page now checks the VAPID keys in Vercel and says exactly what is wrong with them (the failed queue showed "Vapid private key should be 32 bytes long when decoded", so the private key was pasted wrongly). A fresh pair is in `vercel-env.txt`.
- Enabling a phone after the keys change now starts the phone's registration afresh instead of failing on the old one.

## Running behind pill

- The "Running behind?" link in each chair header was drawn full size across the avatar once every chair had a trim coming up. It is now a small pill in the top corner of the column, reading "Late?" on phones and "Running behind?" on desktop, and never touches the avatar.

## Three more pushes: waitlist, fees, notes

- **Waitlist.** When a customer confirms a waitlist request, Sean gets the day, chair and service they want. When a cancellation or an online move frees a slot on a day people are waiting for, the chair's barber and Sean get "A slot freed on Fri 12 Sept with Travis: 2 people are waiting". The sender still emails the waiting customers as before.
- **Fee to review.** A late cancellation online, or a no-show marked by one of the team, that puts a fee up for review now pushes Sean the amount and the trim. Marking your own no-show does not push you.
- **Customer notes.** A customer who edits their notes on the booking page pushes the barber of their next booked trim: "Notes updated. Read before the trim". New-booking pushes end with "Has notes" when the customer wrote any.
- All three have their own switch under Settings, Notifications.

### What to test
1. On the website, join the waitlist for a full day and confirm the email link. Sean's phone: "Waitlist: someone wants ...".
2. Cancel a trim on that day from its manage link. The chair's phone and Sean's: "A slot freed ... 1 person is waiting".
3. On a booking page, edit the notes and save. The chair's phone: "Notes updated".
4. As Travis, mark a no-show on a booking with a saved card and a no-show percentage set. Sean's phone: "Fee to review".

## Waitlist from the staff app

- **Plus, Waitlist.** When the day is full and someone rings, put them on the list: name (regulars come up as you type), mobile, optional email, day, chair or any chair, trim. No confirm email for entries the team adds. The same drawer shows everyone waiting for that day with a Remove link.
- Someone added with a mobile is offered a freed slot by text once Twilio is set up; with an email, by email. With only a mobile and no Twilio yet, they stay on the list so the team can ring them, and the "slot freed" push tells you.
- Details in `handover/WAITLIST.md`.

### What to test
1. Plus, Waitlist, on a full day: add a name and mobile. They appear in "Waiting for" below. Add the same person again: "already on the list".
2. Cancel a trim on that day: the chair and Sean get "A slot freed…". Remove them from the drawer.

## Waitlist: demand in the diary, one offer at a time, texts, runs of days

- **See the demand.** A red count on a day in the week strip when people are waiting for it, and a "2 people are waiting for this day" pill above the diary that opens the list. Under Clients, a Waitlist button lists everyone waiting, day by day, with Remove.
- **One person at a time.** When a slot frees, the first person waiting for that day is offered it. If it is still free five minutes later, the next person is offered it. Nobody is offered the same day more than twice, and a request stays open until they book or the day passes. Before, everyone got the same email at once and raced.
- **Text first.** The offer goes by text when there is a mobile and Twilio is on, else by email. Someone with only a mobile and no Twilio yet stays on the list for the team to ring.
- **A run of days.** On the website and in the staff drawer, "any day until" lets someone wait for a stretch of up to two weeks rather than one date. The diary counts them on every day in the run.
- Needs migration `20260911180000_waitlist_range_hold.sql` (four columns on the waitlist table).

### What to test
1. Add two people to the waitlist for a full day from the staff app. The week strip shows a red 2 on that day; the pill above the diary says "2 people are waiting".
2. Cancel a trim on that day. Within a minute (once the sender runs) the first person gets the offer, and the drawer shows "offered a slot" against them. Five minutes later, if nobody booked, the second person gets it.
3. On the website, join with "any day until" a week ahead. The count shows on every day of that run.

## Splash screen

- The opening screen is now the brand card: black, the monogram settles in, the Symmetry wordmark is revealed by a thin blade sweeping left to right, a hairline draws under it, then "Opening the diary" fades up. About a second and a half, then the diary. It stays black in both light and dark, like an app splash should. People who have reduced motion set on the phone get the finished card with no animation.
- Launch checks: "Clear old messages" now clears anything more than an hour overdue rather than a day, since the sender would have taken them within a minute. "Send now" works through up to fifty a tap.

## Red bands instead of notices, and a quieter message queue

- **Every confirmation and warning now drops down from the top as a red band and goes away by itself:** trim added, moved, cancelled, blocked, checked out, running behind told, password changed, notifications on, policy saved, details saved, queue cleared, and any error. Tap a band to dismiss it early. The grey notice boxes and inline "saved" notes are gone.
- **The messages notice** no longer nags about messages that are merely waiting. It shows one line only when messages have actually failed, with Review and Hide. Everything about the queue lives under Settings, Launch checks.
- **Clear everything waiting** under Launch checks cancels every pending message whenever it is due, for wiping the noise from test data. Clear old messages still clears only those more than an hour overdue.
- The owner's own "messages need attention" alerts no longer appear in the queue list or get stuck as "interrupted".

### What to test
1. Move a trim: a red band drops from the top, "Moved…", and fades. Drop a trim on a taken slot: a darker red band with the reason.
2. Settings, Launch checks, Clear everything waiting, confirm: the count goes to zero and the notice at the top is gone.

## Your own chair first

- The calendar now opens on the signed-in barber's own chair rather than the whole shop. Pick All chairs from the sliders icon to see everyone; that choice is remembered on the phone. An owner without a chair of their own still sees the whole shop.

## Loading

- Every "Loading..." across the staff app (Clients, Sales, Payouts, Team, Reports, Marketing, Settings, the diary itself) is now a thin line with a sweep and a quiet word in small caps, the same cut as the splash. Reduced motion shows a still line.

## Catalogue: the whole menu, live on the website

- **Add a service** (name, starting price and timing, applied to every chair), **rename** it, **move it up or down** the menu, **hide** it (off the website and the diary, history kept) or **delete** it (only if no booking ever used it). Tap a service name for these.
- **Per chair:** tap a price to change the price and timing, or untick "Offered on this chair" so that barber does not do it. Hidden services show dimmed with a Hidden chip.
- The website's prices page, booking page and waitlist form now read the names and prices the owner set, not the old fixed list. Renames show up on the site on the next load.
- Splash: the SY monogram is gone; wordmark, cut and note only.
- The "Running behind" panel no longer runs off the left when only one chair is showing.
- **Rebook.** Open a cancelled or no-show trim and tap Rebook (or Book again on a finished one): New appointment opens with the client, chair, trim and slot filled in, ready to save or change.
- **Loading is the wordmark now.** Between pages, a faint Symmetry wordmark with the full one drawn across it left to right, over and over, plus the quiet word. It takes the theme colour, so it is black on light and bone on dark. Reduced motion shows it still.
