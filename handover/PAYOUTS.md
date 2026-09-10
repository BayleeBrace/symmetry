# Payouts

Staff, Payouts. Replaces the "how much is each of us owed" part of Fresha.

## How it adds up

For a period (this week, last week, this month, or any dates up to three months):

- **Sales**: the booked prices of trims checked out on that chair.
- **Card** and **cash**: from what was chosen at Checkout. Trims checked out without a payment method show as "not recorded".
- **Share**: the percentage of sales the barber keeps, set per barber.
- **Rent**: a fixed weekly amount the barber pays the shop. It is charged once for every Monday-to-Sunday week the period touches, and never twice for the same week: if a barber is paid on Thursday and again on Sunday, only the first payout carries that week's rent. Zero if the shop does not charge rent.
- **Cash kept**: if barbers pocket cash on the day, the cash they took comes off what the shop transfers.
- **To pay** = share − rent − cash kept. With the shop's rules (100% share, cash kept) that is simply card takings less rent. A negative figure means the barber owes the shop the rest of the rent for that period.

The owner's own chair shows its takings but never a payout.

## Paying

"Mark paid" records one barber's payout for the period, with an optional note. "Pay everyone" records all unpaid barbers at once. Both only record; the money moves from the shop's bank. "Undo" removes a recorded payout. Everything recorded appears in the list underneath, and each barber sees their own under Your pay.

"Bank file" downloads a CSV for a bulk payment (name, sort code, account number, amount, reference) using the bank details saved under Rules and bank. Starling Business and Wise Business accept a file like this; other banks may need the columns rearranged. Leave the bank details blank to fill the file in by hand.

## Rules

Under each barber, Rules and bank: share of sales, weekly chair rent, whether they keep cash, and optional bank details. Defaults are 100% share, no rent, and the barber keeps the cash they take (Sean's rule), so a payout is the card side of their share. Only the owner sees or edits these; bank details never appear anywhere else.

## Install

Apply `supabase/migrations/20260910210000_payouts.sql`.
