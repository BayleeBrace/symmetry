import { randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson } from "@/lib/security";

/**
 * One-off: gives a barber's chair its sign-in, as the owner's Team page does,
 * with a temporary password made here and shown once. Only works with the long
 * random key saved in Vercel as SETUP_KEY; answers Not found otherwise. The
 * barber changes the password in More, Account. Remove this route after use.
 */
const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function GET(req: Request) {
  const key = process.env.SETUP_KEY ?? "";
  const params = new URL(req.url).searchParams;
  const given = params.get("key") ?? "";
  if (
    key.length < 32 ||
    given.length !== key.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(key))
  )
    return privateJson({ error: "Not found" }, 404);
  const email = z.email().safeParse(params.get("email")?.toLowerCase());
  const chair = z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .safeParse(params.get("chair"));
  if (!email.success || !chair.success)
    return privateJson({ error: "Email and chair needed" }, 400);
  const db = createAdminClient();
  const { data: barber } = await db
    .from("barbers")
    .select("id,name")
    .eq("slug", chair.data)
    .maybeSingle();
  if (!barber) return privateJson({ error: "No such chair" }, 404);
  const { data: existing } = await db
    .from("staff_members")
    .select("user_id")
    .eq("barber_id", barber.id)
    .maybeSingle();
  if (existing)
    return privateJson(
      { error: `${barber.name}'s chair already has a sign-in` },
      409,
    );
  const password =
    "Sym-" +
    Array.from({ length: 10 }, () => LETTERS[randomInt(LETTERS.length)]).join(
      "",
    );
  const { data, error } = await db.auth.admin.createUser({
    email: email.data,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    return privateJson(
      { error: error?.message ?? "The sign-in could not be created" },
      409,
    );
  const { error: link } = await db.from("staff_members").insert({
    user_id: data.user.id,
    barber_id: barber.id,
    role: "barber",
    active: true,
  });
  if (link) {
    await db.auth.admin.deleteUser(data.user.id);
    return privateJson({ error: "Not linked: " + link.message }, 500);
  }
  return privateJson({
    ok: true,
    chair: barber.name,
    email: email.data,
    password,
  });
}
