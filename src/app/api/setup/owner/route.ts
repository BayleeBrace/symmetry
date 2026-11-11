import { randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson } from "@/lib/security";

/**
 * One-off: creates an owner sign-in with no chair, for someone who tests and
 * looks after the app. Only works with the long random key saved in Vercel as
 * SETUP_KEY; answers Not found otherwise. The password is made here and
 * shown once; change it in More, Your account. Remove this route after use.
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
  const email = z.email().safeParse(params.get("email"));
  if (!email.success) return privateJson({ error: "Email needed" }, 400);
  const password =
    "Sym-" +
    Array.from({ length: 12 }, () => LETTERS[randomInt(LETTERS.length)]).join(
      "",
    );
  const db = createAdminClient();
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
    barber_id: null,
    role: "owner",
    active: true,
  });
  if (link) {
    await db.auth.admin.deleteUser(data.user.id);
    return privateJson({ error: "Not linked: " + link.message }, 500);
  }
  return privateJson({ ok: true, email: email.data, password });
}
