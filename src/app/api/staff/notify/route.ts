import { z } from "zod";
import { after } from "next/server";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUSH_KINDS, type PushKind } from "@/lib/push-kinds";
import { pushConfigured, sendStaffPush } from "@/lib/staff-push";
import { sameOrigin, privateJson, publicError } from "@/lib/security";

const kinds = PUSH_KINDS.map((k) => k.id) as [PushKind, ...PushKind[]];

const actions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("prefs"),
    notify: z.record(z.enum(kinds), z.boolean()),
  }),
  z.object({
    action: z.literal("test"),
    kind: z.enum(kinds),
    // Seconds to wait, so the phone can be locked first: a foreground app may swallow its own test.
    delay: z.number().int().min(0).max(30).optional(),
  }),
  z.object({ action: z.literal("forget"), endpoint: z.url().max(2048) }),
]);

/** This staff member's push set-up: whether the server can send, their choices, how many phones. */
export async function GET() {
  try {
    const staff = await requireStaff();
    const db = createAdminClient();
    const [{ data: me }, { count }] = await Promise.all([
      db
        .from("staff_members")
        .select("*")
        .eq("user_id", staff.user_id)
        .single(),
      db
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("staff_user", staff.user_id),
    ]);
    return privateJson({
      configured: pushConfigured(),
      notify: (me as { notify?: Record<string, boolean> } | null)?.notify ?? {},
      devices: count ?? 0,
    });
  } catch (e) {
    return publicError(e, 403);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const staff = await requireStaff();
    const p = actions.parse(await req.json());
    const db = createAdminClient();
    if (p.action === "prefs") {
      const { error } = await db
        .from("staff_members")
        .update({ notify: p.notify })
        .eq("user_id", staff.user_id);
      if (error)
        throw new Error(
          /notify/.test(error.message)
            ? "Run the 20260911120000_staff_notify migration first."
            : "Your choices could not be saved",
        );
      return privateJson({ ok: true });
    }
    if (p.action === "forget") {
      await db
        .from("push_subscriptions")
        .delete()
        .eq("staff_user", staff.user_id)
        .eq("endpoint", p.endpoint);
      return privateJson({ ok: true });
    }
    // A test goes to this account's phones whatever the choices say.
    if (!pushConfigured())
      throw new Error(
        "Push is not set up yet: add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel and redeploy.",
      );
    const { count } = await db
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("staff_user", staff.user_id);
    if (!count)
      throw new Error(
        "No phone is enabled for your account yet. Tap Enable on this phone first.",
      );
    const sample = PUSH_KINDS.find((k) => k.id === p.kind)!.sample;
    const send = () =>
      sendStaffPush(
        [staff.user_id],
        { kind: p.kind, ...sample, url: "/staff", tag: "test" },
        { force: true },
      );
    if (p.delay) {
      after(async () => {
        await new Promise((r) => setTimeout(r, p.delay! * 1000));
        await send();
      });
      return privateJson({ ok: true, scheduled: p.delay, devices: count });
    }
    const r = await send();
    // Visible in Vercel logs, so a phone that never shows anything can be traced.
    console.log(
      "[push test]",
      staff.user_id,
      p.kind,
      JSON.stringify(r.outcomes),
    );
    return privateJson({
      ok: true,
      sent: r.sent,
      devices: r.devices,
      outcomes: r.outcomes,
    });
  } catch (e) {
    return publicError(e, 409);
  }
}
