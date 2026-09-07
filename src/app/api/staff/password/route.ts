import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sameOrigin,
  rateLimit,
  privateJson,
  publicError,
} from "@/lib/security";

// Any signed-in staff member can change their own password.
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const staff = await requireStaff();
    await rateLimit(req, "staff-password", 10);
    const { password } = z
      .object({ password: z.string().min(8).max(200) })
      .parse(await req.json());
    const { error } = await createAdminClient().auth.admin.updateUserById(
      staff.user_id,
      { password },
    );
    if (error) throw new Error("The password could not be changed");
    return privateJson({ ok: true });
  } catch (e) {
    return publicError(e);
  }
}
