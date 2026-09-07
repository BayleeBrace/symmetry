import { verifyLink } from "@/lib/security";
import { createAdminClient, hasSupabase } from "@/lib/supabase/admin";

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Symmetry Barbers</title><style>body{margin:0;padding:48px 24px;background:#efebe3;color:#161616;font:18px/1.5 Arial,sans-serif}main{max-width:480px;margin:0 auto}h1{margin:0 0 12px;font:normal 32px/1.2 Georgia,serif}a{color:#161616}</style></head><body><main><h1>${title}.</h1><p>${body}</p><p><a href="/">Back to symmetrywales.com</a></p></main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );

// The stop link in every "Time for a trim?" email. Withdrawing is recorded as a consent row, so the audit trail stays in one place.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const customer = verifyLink(token, "reminders-stop");
  if (!customer)
    return page(
      "This link has expired",
      "Reply to any reminder email and we will stop them for you.",
      400,
    );
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
