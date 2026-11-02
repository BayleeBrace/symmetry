import { verifyLink } from "@/lib/security";
import { createAdminClient, hasSupabase } from "@/lib/supabase/admin";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const page = (title: string, body: string, status = 200, form = "") =>
  new Response(
    `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} | Symmetry Barbers</title><style>body{margin:0;padding:48px 24px;background:#efebe3;color:#161616;font:18px/1.5 Jost,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif}main{max-width:480px;margin:0 auto}h1{margin:0 0 12px;font-weight:500;font-size:32px;line-height:1.2}a{color:#161616}button{margin:8px 0 4px;padding:14px 22px;border:0;background:#161616;color:#efebe3;font:inherit;cursor:pointer}button:focus-visible{outline:2px solid #161616;outline-offset:3px}</style></head><body><main><h1>${title}${/[.?!]$/.test(title) ? "" : "."}</h1><p>${body}</p>${form}<p><a href="/">Back to symmetrywales.com</a></p></main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );

const expired = () =>
  page(
    "This link has expired",
    "Reply to any reminder email and we will stop them for you.",
    400,
  );

// The stop link in every "Time for a trim?" email. Opening it only asks, so a
// mail scanner following the link changes nothing; the button (or a mail
// app's one-click unsubscribe) posts back here to stop the reminders.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!verifyLink(token, "reminders-stop")) return expired();
  return page(
    "Stop reminders?",
    "You will not get any more “time for a trim” emails from us. Messages about trims you book, like confirmations, still come through.",
    200,
    `<form method="post" action="/api/reminders/stop?token=${escape(encodeURIComponent(token))}"><button type="submit">Stop reminders</button></form>`,
  );
}

// Withdrawing is recorded as a consent row, so the audit trail stays in one place.
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const customer = verifyLink(token, "reminders-stop");
  if (!customer) return expired();
  if (!hasSupabase())
    return page(
      "Something went wrong",
      "Please try the link again in a moment, or reply to the email.",
      503,
    );
  const { error } = await createAdminClient()
    .from("email_marketing_consents")
    .insert({
      customer_id: customer,
      granted: false,
      consent_copy: "Stopped reminders using the link in an email.",
      consent_version: "2026-09-08",
    });
  if (error)
    return page(
      "Something went wrong",
      "Please try the link again in a moment, or reply to the email.",
      503,
    );
  return page(
    "Reminders stopped",
    "You will not get any more “time for a trim” emails from us. Messages about trims you book, like confirmations, still come through.",
  );
}
