# Push notifications for the team

Each barber turns notifications on per phone under Staff, Settings, Notifications, and chooses what to get. Nothing in a push names a customer: it shows on the lock screen.

## What arrives

| Kind | Who gets it | When |
| --- | --- | --- |
| New online booking | The chair's barber and the owners | The moment a customer books on the website |
| Cancellation | The chair's barber and the owners when a customer cancels online; only the chair's barber when someone on the team cancels | Straight away |
| Trim moved | As above | Straight away |
| Customer running late | The chair's barber and the owners | When the customer taps Running late |
| Added to your diary by the team | The chair's barber, when someone else made the booking | Straight away |
| Tomorrow, the evening before | Everyone, once a day | Six in the evening: barbers get their chair, the owner gets the whole shop |
| Possible no show | The chair's barber | Ten minutes after a trim was due with nobody marked in the chair |
| End of day | Each barber who worked; the owner gets the shop and each chair's count | At closing time (from the shop's opening hours) |
| Payday | Barbers get what the shop owes them for last week; the owner gets every chair | Monday at nine in the morning, using the Payouts figures |
| Waitlist | The owner when someone confirms a waitlist request; the chair's barber and the owner when a cancellation frees a slot on a day with people waiting | Straight away |
| Fee to review | The owner (never the person who marked it) | When a late cancellation or a no-show puts a fee up for review |
| Customer notes changed | The chair's barber, for the customer's next booked trim | When a customer edits their notes; new-booking pushes also say "Has notes" |

Tapping a push opens the staff app on the day in question, or on Sales or Payouts for the daily and weekly ones.

## If a test never arrives on an iPhone

- The app must be opened from the Home Screen, not Safari, and notifications must be allowed for it (phone Settings, Notifications, Symmetry staff).
- A push sent while the app is open in front may not show. Use "Send in 10 seconds" and lock the phone.
- The test now reports what Apple's push service replied. "Accepted" means it left the server; a refusal shows the code and reason (403 usually means the VAPID keys changed after the phone was enabled: turn notifications off and on again on the phone).

## Set up

1. Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` (see `vercel-env.txt` on the Desktop), then redeploy. Until these exist the Notifications screen says so and nothing can be sent.
2. Supabase: apply `supabase/migrations/20260911120000_staff_notify.sql` (the per-person choices column). Without it, the choices cannot be saved; everything else works.
3. On each phone: add the staff app to the Home Screen (iPhone: Share, then Add to Home Screen), open it from there, go to Settings, Notifications, Enable on this phone, and allow.
4. Send a test from the same screen. It goes to every phone enabled for that account and ignores the choices, so it always arrives.

The instant kinds are sent from the booking itself and need no cron. The evening brief and the no-show nudge come from the once-a-minute `/api/jobs` run and go out whether or not customer messaging (`NOTIFICATIONS_ENABLED`) is on.

## Under the hood

- `src/lib/staff-push.ts`: `notifyTrim` (who to tell about one trim), `sendStaffPush` (one message to a set of staff, honouring their choices), `sendStaffBriefs` (the two cron kinds, deduped through `notification_jobs` rows of kind `staff_push`).
- `src/lib/push-kinds.ts`: the list of kinds, labels, sample wording and the pure text builders, shared with the settings screen.
- `/api/staff/notify`: GET this member's set-up; POST `prefs`, `test`, `forget`. Phones are registered through the existing `/api/push` with the staff session.
- Phones that have withdrawn permission (404 or 410 from the push service) are forgotten automatically.
