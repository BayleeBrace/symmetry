import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sameOrigin,
  rateLimit,
  privateJson,
  publicError,
} from "@/lib/security";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    barber_id: z.uuid(),
    email: z.email().max(254),
    password: z.string().min(8).max(200),
  }),
  z.object({
    action: z.literal("active"),
    user_id: z.uuid(),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("password"),
    user_id: z.uuid(),
    password: z.string().min(8).max(200),
  }),
]);

// Owner only: one sign-in per chair. The first owner account is created in Supabase once (see README).
export async function GET() {
  try {
    await requireStaff(true);
    const db = createAdminClient();
    const [barbers, members] = await Promise.all([
      db
        .from("barbers")
        .select("id,name,slug,role_label,active")
        .order("display_order"),
      db.from("staff_members").select("user_id,barber_id,role,active"),
    ]);
    if (barbers.error || members.error)
      throw new Error("The team could not load");
    const accounts = await Promise.all(
      members.data.map(async (member) => {
        const { data } = await db.auth.admin.getUserById(member.user_id);
        return {
          ...member,
          email: data.user?.email ?? "",
          last_sign_in: data.user?.last_sign_in_at ?? null,
        };
      }),
    );
    return privateJson({
      team: barbers.data.map((barber) => ({
        barber,
        account:
          accounts.find((account) => account.barber_id === barber.id) ?? null,
      })),
    });
  } catch (e) {
    return publicError(e, 403);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const owner = await requireStaff(true);
    await rateLimit(req, "team", 30);
    const p = schema.parse(await req.json());
    const db = createAdminClient();
    if (p.action === "create") {
      const { data: existing } = await db
        .from("staff_members")
        .select("user_id")
        .eq("barber_id", p.barber_id)
        .maybeSingle();
      if (existing) throw new Error("This chair already has a sign-in");
      const { data: created, error } = await db.auth.admin.createUser({
        email: p.email,
        password: p.password,
        email_confirm: true,
      });
      if (error || !created.user)
        throw new Error(
          error?.message.toLowerCase().includes("already")
            ? "That email already has an account"
            : "The sign-in could not be created",
        );
      const { error: link } = await db.from("staff_members").insert({
        user_id: created.user.id,
        barber_id: p.barber_id,
        role: "barber",
        active: true,
      });
      if (link) {
        await db.auth.admin.deleteUser(created.user.id);
        throw new Error("The sign-in could not be linked to the chair");
      }
      return privateJson({ ok: true });
    }
    if (p.user_id === owner.user_id)
      throw new Error("Use the Account tab for your own sign-in");
    if (p.action === "active") {
      const { data, error } = await db
        .from("staff_members")
        .update({ active: p.active })
        .eq("user_id", p.user_id)
        .neq("role", "owner")
        .select("user_id")
        .maybeSingle();
      if (error || !data) throw new Error("The sign-in could not be changed");
      return privateJson({ ok: true });
    }
    const { error } = await db.auth.admin.updateUserById(p.user_id, {
      password: p.password,
    });
    if (error) throw new Error("The password could not be reset");
    return privateJson({ ok: true });
  } catch (e) {
    return publicError(e);
  }
}
