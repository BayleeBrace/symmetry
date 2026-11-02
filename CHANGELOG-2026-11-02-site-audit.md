# Symmetry: whole-site audit, 2 November 2026

An audit of the public website, booking flow, customer pages, share images, staff app, server routes and database. It was checked against the brand handover of 2 November 2026 (`CURRENT-DECISIONS.md`, the master prompt, Edition 01) and the existing repository decisions.

## Decisions kept as they are

- **Sentence case stays.** The handover asks for lowercase headings and labels, but Sean asked for sentence case on 7 September 2026 (see `CHANGELOG-2026-09-07-staff-and-copy.md`). Nothing in the handover records him reversing that, so the site was not changed. If lowercase is wanted after all, that is one deliberate pass across copy and service names.
- **Staff warning bands and the dark-mode oxblood** (`#c8737d`) were requested for legibility and stay. The pink and lilac service colours were not requested and were replaced (see the staff section).
- **The phone number is still unconfirmed.** `SHOP_PHONE` remains empty until Sean confirms 01834 811351 or another number.

## Public website

- **Search and share metadata.** The root layout no longer sets a site-wide canonical URL or `og:url`. Before, every page without its own (waitlist, bookings, staff, the 404) told search engines and share cards that it was the home page. Privacy and cancellation policy have their own descriptions.
- **Contact email.** `info@symmetrywales.com` is the default shop email (confirmed in the handover). It now shows on the home, hours and policy pages, the footer and the structured data, and transactional email replies go to it. `SHOP_EMAIL` still overrides it.
- **Teaser.** While the site is locked, the teaser now says where the shop is and keeps the old name for recognition: "Formerly Studio 4 Barbers. 4 Brewery Terrace, Saundersfoot. @symmetry.wales".
- **Readability.** Body copy on the public pages is 17px on phones and 18px on desktop. It was 16px Jost Light, below the brand's 17–18px. The following were 12–12.5px and are now larger:
  - desktop navigation
  - hero address
  - footer links
  - eyebrows
  - booking form labels (now Jost Regular)
  - teaser labels
- **Hero call to action.** "Book a trim" on the hero photo is solid white with black text, so the primary action is obvious. It has a white focus ring.
- **Links look like links.** Links inside running text and the contact links are underlined. Before, the Instagram link on the cancellation policy page looked like plain grey text.
- **Phone menu.** Escape closes it and returns focus to the menu button.
- **Privacy notice.** It now mentions Vercel Web Analytics, which counts visits without cookies; before, it said there were no trackers but didn't mention analytics. Dated 2 November 2026.
- **Share images.** The strapline "Barbers · Saundersfoot" sat inside the wordmark's clear space and was removed. The overlay is one gradient that stays dark behind the words and opens up on the right, so the lit mirrors and the room show. The booking card's eyebrow no longer says "Book online".
- **Waitlist alert email** says "Book a trim" rather than "Book online".

## Booking flow and customer pages

- **Barber links start at the service step.** "Book" next to a barber's name (home, prices) opens the flow at the service step with that barber chosen. It used to make customers choose the same barber again.
- **Errors come into view.** An error after tapping the bar's button (often a bad mobile number at the end of the form) is scrolled into view above the fixed bar. Before, it appeared below the fold and the button seemed to do nothing.
- **The mobile number field has an accessible name.** Its label wrapped both the country select and the input, so screen readers announced the input without a name.
- **More country codes.** The list grew from 6 to 30 countries. The UK is still the default.
- **Spacing fixes.** "Any barber" times read "Sean · 24", not "Sean ·24". The booking management page reads "45 min · 22", not "45 min ·22".
