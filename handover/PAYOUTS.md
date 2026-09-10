# Payouts

Staff, Payouts. Replaces the "how much is each of us owed" part of Fresha.

## How it adds up

For a period (this week, last week, this month, or any dates up to three months):

- **Sales**: the booked prices of trims checked out on that chair.
- **Card** and **cash**: from what was chosen at Checkout. Trims checked out without a payment method show as "not recorded".
- **Share**: the percentage of sales the barber keeps, set per barber.
- **Rent**: a fixed weekly amount the barber pays the shop, charged once per week of the period (a part week counts as a week). Zero if the shop does not charge rent.
- **Cash kept**: if barbers pocket cash on the day, the cash they took comes off what the shop transfers.
- **To pay** = share − rent − cash kept. A negative figure means the barber owes the shop for that period.

The owner's own chair shows its takings but never a payout.

## Paying

"Mark paid" records one barber's payout for the period, with an optional note. "Pay everyone" records all unpaid barbers at once. Both only record; the money moves from the shop's bank. "Undo" removes a recorded payout. Everything recorded appears in the list underneath, and each barber sees their own under Your pay.

"Bank file" downloads a CSV for a bulk payment (name, sort code, account number, amount, reference) using the bank details saved under Rules and bank. Starling Business and Wise Business accept a file like this; other banks may need the columns rearranged. Leave the bank details blank to fill the file in by hand.

## Rules

Under each barber, Rules and bank: share of sales, weekly chair rent, whether they keep cash, and optional bank details. Defaults are 100% share, no rent, cash into the till. Only the owner sees or edits these; bank details never appear anywhere else.

## Install

Apply `supabase/migrations/20260910210000_payouts.sql`.
