# Symmetry — audit follow-up, 7 September 2026

## Included in this update

- Hero image declares its full viewport width. Hero/teaser quality matches the configured 85 setting; AVIF and WebP are enabled. Desktop copy is vertically centred.
- Home descriptions follow SITE_LIVE and retain “formerly Studio 4 Barbers”. Page titles avoid repeating Saundersfoot.
- All four share cards render explicit dark overlays with the actual Cormorant Garamond Light and Jost Light fonts converted from the site's WOFF2 files. JPEG output is generated at build time, 1200 × 630, approximately 30–36KB per card. Changing SITE_LIVE requires a new deployment so the home share card and sitemap update too.
- Optional SHOP_PHONE and SHOP_EMAIL populate tappable footer/home/hours/policy contact links and structured data. No number or inbox was invented. A maps link is present in structured data; precise coordinates await confirmation.
- EMAIL_REPLY_TO (falling back to SHOP_EMAIL) is passed to Resend. This does not provision or verify an inbox or sending domain.
- A draft privacy notice is accessible while the teaser is locked, linked in the footer and at booking/waitlist collection points. Cancellation and waitlist pages now have the site footer.
- Secondary booking links are real padded buttons. “Book my usual” sits below the barber choices. The mobile booking bar appears after the hero button has scrolled above the viewport.
- Small labels and muted text are more readable. The footer uses the full existing wordmark. Existing heading/description spacing fixes are retained.
- Reveal content is visible by default, even if JavaScript never runs. Once hydrated, a small entrance animation starts on viewport entry. Reduced motion is respected.
- Hours use a description list with machine-readable times, a London-time “next open” message, and shared-entrance guidance. The forced empty-height band is removed. No parking claims or exact map coordinates were invented.
- Branded 404 and error pages; a matching lightweight offline screen. New service-worker registration is limited to booking, management, waitlist and staff routes. Previously installed workers remain installed.
- Existing favicon artwork exported to 32px ICO/PNG, 180px Apple, 192px and 512px PNGs and a safe-zone maskable icon. The original logo artwork is preserved.
- CSP is report-only. It is not enforcement, and no remote report collector has been connected. Inspect browser violations before tightening it.
- Preview-password attempts now have a rate limit and same-origin checks. Unconnected previews use bounded per-instance memory; production still needs shared Supabase limits/WAF. In-memory protection does not survive cold starts or span instances.
- Initial staff sign-in no longer shows an error just because nobody is signed in.
- Retired home/staff CSS and starter assets removed. Supabase temporary files excluded. Source formatted with Prettier; npm run format and format:check are available.
- Live sitemap includes privacy and cancellation policy with generation-time dates; teaser sitemap remains home-only.

## Still required from Sean / account owners

1. Confirm the shop phone number and monitored email. Set SHOP_PHONE, SHOP_EMAIL and EMAIL_REPLY_TO in the intended deployment and redeploy.
2. Confirm the legal operator, retention/cleanup schedule, processing locations and international-transfer safeguards. Fill PRIVACY_CONTROLLER, PRIVACY_RETENTION and PRIVACY_TRANSFERS, review the complete notice, then set PRIVACY_CONFIRMED=true. This flag records review; it does not implement deletion schedules or certify compliance. The page remains visibly a preview until required details are present. Owner launch checks list these items.
3. Supply three portraits, approved personal copy and sharp shop photos. The current hero source is a 1200 × 1600 portrait, so image sizing alone cannot make it a sharp wide desktop photograph. The heavy gradient is retained until a stronger source is supplied.
4. Supply the original vector logo if available. File size or tracing style alone cannot prove an SVG is invalid; this update does not redesign the supplied mark.
5. Add www in the actual Symmetry Vercel project, use the DNS target Vercel supplies in Cloudflare, and configure the apex redirect. No DNS or domain settings changed here.
6. Verify the Resend sending domain with its exact records; arrange a monitored reply inbox and publish an agreed DMARC policy. Do not replace an existing SPF record with a second SPF record. No mailbox, DNS, email or SMS delivery was configured/tested here.
7. Confirm the Vercel plan/scheduler, test the actual iPhone booking flow, and complete the real Supabase/Stripe/provider trial and Fresha reconciliation before launch.
8. At cutover, update the existing Google Business Profile, Instagram and Fresha links. Confirm exact map location and any parking directions before adding them.

## Copy rule

Proper capitalisation throughout, at Sean's request (7 September 2026): sentence case for sentences, headings, buttons and labels; capitals for names, places, days and months (Sean, Saundersfoot, 4 Brewery Terrace, Monday). Uppercase tracked labels keep their treatment. Do not invent barber biographies or claims about every cut. See CHANGELOG-2026-09-07-staff-and-copy.md.

## Verification

Production build/TypeScript and lint passed. Fifteen automated tests passed, including rate-limit windows and London opening-time boundaries. Seven local production HTTP checks passed for preview bookings, protected endpoints, home metadata, information pages, the branded 404, JPEG share cards, install icons and password throttling. The rendered home share card was visually inspected. No new Lighthouse scores or browser/device interaction results are claimed.

Privacy drafting reference: [ICO — right to be informed](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/). This draft still needs the shop's real operating details and review.

## Edition 01 brand alignment

The supplied deck was read, including its website mock. This pass also:

- Uses the canonical nine service names, preserving every supplied Fresha price, duration and slug. `/prices` is one d / t / s table with no durations. Display prices omit the currency symbol and include a pounds note.
- Includes `supabase/migrations/20260907190113_canonical_service_names.sql`. Apply this after the existing database setup/upgrade in the intended project so staff, notifications and stored-service reads use the same names. It was tested locally to leave prices and durations unchanged; it has not been applied to a live database. Do not re-run or edit the initial migration to rename services.
- Uses black buttons, selected states, email buttons and wallet backgrounds. Booking, management and staff use a white ground. Oxblood is limited to the designated light-page eyebrow or the small share-card rule; pink tints are removed.
- Reserves the serif for display headings, uses Jost for smaller operational headings, prevents faux bold, and gives labels regular weight and 18% tracking.
- Removes the header strap and redundant home navigation link. Full wordmarks have a 240px minimum with the supplied SY artwork below 340px. Narrow headers put the menu on a separate row to preserve clear space. Booking uses the black artwork on white with a back link. Footer uses the full mark; initials tiles are removed pending portraits.
- Adds the rising cut to the home hero photo only, with gap and slip tied to display-letter size. Body text and prices remain uncut.
- Displays opening hours as “9am to 6pm” and booking times as “9:00”. HTML time inputs and machine-readable times retain “09:00”.
- Adds FORMERLY_UNTIL: the first London date without the visible old-name line. Set this to the agreed launch date plus three months. It controls home, footer, booking and descriptions; structured-data alternateName stays. With no agreed date it remains visible. Update printed material, Google Business Profile and Instagram manually on the same date.

### Decisions preserved

The earlier explicit preference for “book a trim” remains. The report proposes “book online”/“cut”, but that would reverse the agreed vocabulary. The domain remains symmetrywales.com and the handle remains @symmetry.wales. No second domain was registered. The deck’s under-thirteens/over-sixties prices were not substituted for the newer Fresha screenshots. The deck’s old straight-razor promise was not restored.

The card in the guidelines shows 01834 811351, but whether that is still the shop’s monitored line needs confirmation before setting SHOP_PHONE.
