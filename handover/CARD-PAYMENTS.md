# Card payments

One card machine for the shop. Each trim's payment goes to that chair's
barber, in their own Stripe account, and on to their own bank three working
days later. No-show and late-cancellation fees go to the barber the same way.
Clients never pay online; their card is only saved, at booking, for fees.

## How it works

- **Each barber**, signed in on their own phone: More, Card payments, Set up
  card payments. Stripe asks for their name, address, photo ID and bank
  details. About ten minutes, once.
- **Checkout**: "Take £22 on the card machine" sends the price to the
  machine. The client taps their card. The trim marks itself paid.
- **Card fee**: 1.4% + 10p, plus 0.25% for splitting, comes off each payment
  (43p on £20). No-show fees on a saved card: 1.5% + 20p, plus 0.25%. Set in
  `src/lib/card-fees.ts`.
- **Shop's costs**: Stripe also bills the shop 10p a payout and £2 a month for
  each barber who's paid that month. Not passed on yet; the owner decides.
- **Refunds**: owner only, on a paid trim in the diary. The barber's share
  comes back from their account.
- **Payouts screen**: card-machine takings show as "paid by Stripe" and come
  off what the shop owes, so what's left is rent owed, as with cash kept.

## Practice mode

With Stripe's test key (`sk_test_…`) in Vercel, everything runs on Stripe's
pretend money:

- More, Card payments shows "Practice mode".
- The owner adds a **practice card machine** (a pretend Stripe S700).
- At checkout, "Tap a test card" or "Try a declined card" stands in for a
  real card.
- On Stripe's sign-up pages use test details: the test buttons where offered,
  phone code 000000, sort code 10-88-00, account 00012345.
- The owner can set up every chair themselves in practice mode.
- **Test clients**: More, Card payments, Add test clients. Ten pretend clients
  with past visits and four trims a day per chair for ten days, each with a
  test card saved. No email or mobile, so nothing is sent. "Remove all test
  clients" takes out them and everything attached to them, and nothing else.
  It still works after going live. `TEST-DATA-REMOVE.sql` does the same by
  hand.

## Setting up Stripe (once)

1. Create the shop's Stripe account (stripe.com, using the shop email), or
   sign in to it.
2. Create a sandbox for practice: top-left account menu, Sandboxes, Create.
3. In the sandbox: Connect, Get started. Choose a marketplace, where the
   platform handles pricing and is responsible for losses. Complete the
   platform profile and add the shop's name, icon and colour under Connect
   branding.
4. In the sandbox: Developers, API keys. Copy the **Secret key** (`sk_test_…`)
   into Vercel as `STRIPE_SECRET_KEY` (Production, Sensitive).
5. In the sandbox: Developers, Webhooks, Add endpoint:
   `https://symmetrywales.com/api/stripe/webhook`, events
   `checkout.session.completed` and `payment_intent.succeeded`. Copy its
   signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`.
6. In Vercel, set `CARD_CHARGES_ENABLED` to `true` to allow no-show fees, then
   redeploy.

## Trial checklist

- Each barber sets up card payments and sees "Ready".
- Owner adds the practice card machine, then adds test clients.
- Check out a test trim on the machine: paid, the diary shows Card, and the
  barber's Stripe payouts show it less the fee.
- Try a declined card, then Try again with a good one: charged once.
- Start a payment and Cancel: nothing charged, trim still open.
- Mark a test client's trim a no show, then Charge fee: it goes to that barber.
- Refund a paid trim as the owner.
- Payouts: card-machine takings show as paid by Stripe.

## Going live

1. Remove the test clients (More, Card payments).
2. In the live Stripe account, repeat steps 3 to 5 above with the live keys.
   A restricted key (`rk_live_…`) is safer than the secret key.
3. Order the Stripe Reader S700. When it shows its registration words, the
   owner types them in More, Card payments, Register the card machine.
4. Each barber sets up again in live mode with their real details.
5. Practice accounts and the pretend machine stay in the sandbox and never
   mix with real ones.
