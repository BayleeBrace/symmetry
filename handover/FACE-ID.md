# Home-screen app and Face ID

## The staff app on a phone

The staff area has its own web app manifest, so adding `/staff` to the home screen gives an app called "Symmetry staff" that opens on the diary and stays in the staff area. If a phone already has the old icon, remove it and add it again from `symmetrywales.com/staff` in Safari (share, Add to Home Screen).

## Face ID or fingerprint sign-in

This is a passkey. The phone keeps a private key behind Face ID; the site keeps the matching public key in `staff_passkeys` and checks a signed challenge on every sign-in. Nothing about the face itself ever leaves the phone.

Each barber sets it up once per phone:

1. Sign in with email and password.
2. Settings, Your account, "Set up Face ID on this phone".
3. From then on the sign-in screen has "Sign in with Face ID". The password still works, and the owner can still reset it from Team.

Remove a phone from the same place. Signing in with Face ID gives the same session as a password sign-in, with the same renewal and the same sign-out.

## Requirements

- Apply `supabase/migrations/20260910180000_staff_passkeys.sql`.
- iOS 17 or later for the home-screen app; Safari on iOS 16 also works. Android phones use fingerprint or face unlock the same way.
- Passkeys are bound to the domain. They work on `symmetrywales.com` and `www.symmetrywales.com`, not on Vercel preview addresses.
- `LINK_SIGNING_SECRET` must be set (it already is for booking links); it signs the short-lived challenge.
