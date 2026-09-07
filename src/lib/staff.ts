import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase/admin";
export async function requireStaff(owner = false) {
  const token = (await cookies()).get("symmetry_staff")?.value;
  if (!token) throw new Error("Please sign in");
  const db = createAdminClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user) throw new Error("Please sign in again");
  const { data: staff, error: e } = await db
    .from("staff_members")
    .select("user_id,barber_id,role")
    .eq("user_id", user.id)
    .eq("active", true)
    .single();
  if (e || !staff || (owner && staff.role !== "owner"))
    throw new Error("You do not have access");
  return staff;
}
