import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";
import { ContactLinks } from "@/components/contact-links";
import { shopContact } from "@/lib/shop-contact";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Privacy notice",
  alternates: { canonical: "/privacy" },
};
export default function PrivacyPage() {
  const ready =
    process.env.PRIVACY_CONFIRMED === "true" &&
    Boolean(
      process.env.PRIVACY_CONTROLLER &&
      process.env.PRIVACY_RETENTION &&
      process.env.PRIVACY_TRANSFERS &&
      shopContact.email,
    );
  return (
    <main className="information-page">
      <BrandHeader />
      <section className="information-hero privacy-copy">
        <p className="eyebrow">Your information</p>
        <h1>Your privacy.</h1>
        {!ready && (
          <p className="draft-notice">
            Preview notice. The shop’s legal identity, contact details,
            retention schedule and provider arrangements must be confirmed
            before this notice is ready for live bookings.
          </p>
        )}
        <p>
          {process.env.PRIVACY_CONTROLLER ||
            "Symmetry Barbers (legal operator to be confirmed)"}{" "}
          is responsible for the personal information used to run your bookings.
          You can write to us at 4 Brewery Terrace, Saundersfoot, SA69 9HG.
        </p>
        <ContactLinks fallback />
        <h2>What we collect.</h2>
        <p>
          When you book, we ask for your name, email and mobile number, your
          chosen barber, services and dates. You can optionally add haircut
          preferences or notes. Please avoid sensitive health information in the
          notes; speak to your barber directly if needed. When booking for a
          child, use a parent or guardian’s contact details.
        </p>
        <p>
          We keep booking changes, cancellations, attendance, the price and
          cancellation policy you accepted, and relevant payment references.
          Stripe collects and stores your card details on its own secure page.
          The shop does not receive your full card number or security code.
        </p>
        <h2>Why we use it.</h2>
        <ul>
          <li>
            To arrange and manage the service you request, send booking updates,
            and administer the cancellation policy. This is necessary to perform
            our contract with you or take steps at your request before it.
          </li>
          <li>
            To protect the booking system and investigate errors, disputes or
            misuse. We rely on our legitimate interests in running a secure,
            reliable shop.
          </li>
          <li>
            To keep records required by law, including relevant financial
            records.
          </li>
          <li>
            To send optional marketing only when you opt in. You can withdraw
            that consent without affecting a booking.
          </li>
        </ul>
        <p>
          Name and contact details are needed for online bookings and important
          updates. Notes and marketing permission are optional. Card-related
          fees are reviewed by the owner; the app does not automatically decide
          to charge a no-show fee.
        </p>
        <h2>Messages and the waitlist.</h2>
        <p>
          Booking confirmations, reminders and recovery messages are service
          messages, separate from marketing. If you tick the reminder box when
          you book, we also email you when you are due a trim; every one of
          those has a link to stop them. A waitlist request uses your email,
          preferred date, service and barber to contact you about availability.
          You can leave through your waitlist link. Device notifications are
          optional and can be disabled in your device settings.
        </p>
        <h2>Who helps us.</h2>
        <p>
          Authorised shop staff use the information needed to manage your visit.
          The booking service uses Supabase for records and staff
          authentication, Vercel for hosting, Stripe for saved cards and
          payments, and Resend for email. Twilio is used if SMS is enabled. If
          you enable push notifications or add a Wallet pass, the relevant
          device or wallet provider also processes information to provide that
          feature.
        </p>
        <p>
          {process.env.PRIVACY_TRANSFERS ||
            "Before launch, the shop will confirm the providers’ processing locations and the safeguards that apply where information is transferred outside the UK."}
        </p>
        <h2>How long we keep it.</h2>
        <p>
          {process.env.PRIVACY_RETENTION ||
            "The retention schedule is awaiting the shop’s approval. It must cover booking and customer records, notes, waitlist requests, payment and accounting records, message logs, backups and marketing preferences before live bookings begin."}
        </p>
        <p>
          A booking draft stored in your browser tab expires after two hours and
          contains only selected trims, not contact details or card data.
          Expired drafts are discarded when the booking page next reads them;
          closing the tab normally clears this storage. Payment providers may
          need to retain their own records separately.
        </p>
        <h2>Cookies and browser storage.</h2>
        <p>
          Essential cookies support preview access and staff sign-in. Browser
          session storage helps recover selected trims. The site does not
          currently use advertising trackers. Calendar downloads and Wallet
          passes are copies and may not update when your booking changes; your
          booking link shows the current details.
        </p>
        <h2>Your choices.</h2>
        <p>
          You can ask to see or correct your information, ask for deletion or
          restriction where applicable, object to uses based on legitimate
          interests, and request a portable copy where the right applies. Some
          information may need to be retained to meet legal obligations or
          resolve a dispute. Contact the shop using the details above; we may
          need to verify your identity.
        </p>
        <p>
          To withdraw marketing permission, contact the shop or use the
          unsubscribe option in a marketing email. If you are unhappy with our
          response, you can{" "}
          <a href="https://ico.org.uk/make-a-complaint/">
            contact the Information Commissioner’s Office
          </a>
          .
        </p>
        <p>
          Updated 7 September 2026. We will update this notice if our use of
          your information changes.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
