import { z } from "zod";
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
  z.object({ action: z.literal("test"), kind: z.enum(kinds) }),
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
    const sample = PUSH_KINDS.find((k) => k.id === p.kind)!.sample;
    const r = await sendStaffPush(
      [staff.user_id],
      { kind: p.kind, ...sample, url: "/staff", tag: "test" },
      { force: true },
    );
    if ("off" in r && r.off) throw new Error(r.off);
    if (!r.devices)
      throw new Error(
        "No phone is enabled for your account yet. Tap Enable on this phone first.",
      );
    return privateJson({ ok: true, sent: r.sent, devices: r.devices });
  } catch (e) {
    return publicError(e, 409);
  }
}
