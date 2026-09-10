# Waitlist

Two ways onto it.

**Customers, on the website.** From the booking page when their day has no free times ("join the waitlist"), or at `/waitlist`: email, chair or any, trim, day. They confirm from an email; nothing counts until they do. The confirm pushes the owner "Waitlist: someone wants…".

**The team, in the staff app.** Plus, Waitlist: name (existing clients come up as you type), mobile, optional email, day, chair or any, trim. No confirm step. The same drawer lists everyone waiting for that day with a Remove link. A person can only be on the list once per day, chair and trim.

Either way a request covers one day or a run of days ("any day until", up to two weeks).

**What happens when a slot frees.** The once-a-minute sender checks every waiting request against the diary. When a slot that fits is open on one of their days, the first person waiting is offered it: by text when there is a mobile and Twilio is set up, else by email. Someone with only a mobile and no Twilio stays on the list for the team to ring. One offer per day is live at a time; if the slot is still free five minutes later, the next person is offered it. Nobody is offered the same day more than twice. A request stays open until they book or their last day passes.

**In the diary.** Days with people waiting carry a red count in the week strip, and the day view shows "2 people are waiting for this day" above the columns; tap it for the list. Under Clients, the Waitlist button lists everyone waiting.

Needs migration `20260911180000_waitlist_range_hold.sql`.

At the same moment, the chair's barber and the owner get "A slot freed on Fri 12 Sept with Travis: 2 people are waiting for that day", so someone can ring a regular rather than wait for the email to work.

Requests lapse when the day has passed.
