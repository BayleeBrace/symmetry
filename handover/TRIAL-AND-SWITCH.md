# Sean and the lads — trial and handover

Use staging, Stripe test cards and designated test recipients. Keep real public booking disabled throughout this trial.

## Busy-day trial

- Sean signs in as owner; Travis and Dylan sign in to their own chairs.
- Add a walk-in, a break and a holiday. Try an overlapping booking; it must be refused.
- Mark a trim arrived, complete another, and mark a past test trim as a no-show.
- Verify each barber cannot change another barber’s diary. Verify an inactive staff account loses access.
- Leave the diary open beyond the access-token lifetime. Return after the phone sleeps. It should renew the session without losing the chosen date. Test two open tabs and explicit sign-out.

## Customer trial

- Book a single trim and four fortnightly trims. Create one clash and change only that week.
- Leave checkout before saving the card. Return in the same tab within two hours and recover the selected trims.
- Change a price or reserve one of those dates before recovery: current prices should appear and the unavailable date should be omitted with an explanation.
- Complete card setup once, refresh its completion page, and verify only one booking exists.
- Move the barber/service/time. Cancel outside and inside the six-hour window. Check the exact deadline and accepted fee.
- Test a fee waiver and a test-card fee. Check Stripe, the diary and messages for duplicates.
- Disable the email provider in staging and queue a test message. The owner diary must warn; an opted-in owner device should receive an independent push alert on a cron run. Alerts are attempted at most once per hour while problems remain.
- Check recovery emails, calendar imports, mobile scrolling, larger step labels, and spacing beneath headings on iPhone and desktop.

Record the test date, person, result and any issue. Do not mark provider/device checks passed just because a local test passes.

## Fresha switch

1. Agree a cutover time and export every future appointment, including repeats and bookings at all three chairs.
2. Normalize a copy to the column layout in `fresha-bookings-template.csv`. Keep the original export untouched. Use YYYY-MM-DD dates, HH:MM local UK times, and sean/travis/dylan for barber.
3. Run `python3 scripts/check-handover.py handover/your-normalized-export.csv`. Resolve invalid rows, duplicate references and overlaps with Sean.
4. Import only after reviewing the real export and agreeing how references, prices, cancellation consent and contacts map. This package deliberately contains no automatic import of unknown Fresha data.
5. Export the resulting Symmetry diary in the same format and run `python3 scripts/check-handover.py fresha.csv --symmetry symmetry.csv`. It compares date/time, barber, duration and service, preserving duplicate counts. Review every unmatched entry. It does not verify customers, prices or saved cards.
6. Manually reconcile customer details, prices and any consent records. Do not assume saved cards or marketing permission transfer. Decide which provider manages fees for pre-existing bookings.
7. Stop new Fresha bookings at the agreed cutover, reconcile last-minute changes, then enable Symmetry bookings. Retain a fallback list and the original Fresha records.

No live bookings have been imported, cancelled or changed by this handover tool.
