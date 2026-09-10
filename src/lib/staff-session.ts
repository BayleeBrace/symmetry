import "server-only";
import { cookies } from "next/headers";
import type { Session } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";

const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

/** The staff sign-in cookies: a short-lived access token and a four-week refresh token. */
export async function saveStaffSession(session: Session) {
  const jar = await cookies();
  jar.set("symmetry_staff", session.access_token, {
    ...options,
    maxAge: session.expires_in,
  });
  jar.set("symmetry_staff_refresh", session.refresh_token, {
    ...options,
    maxAge: 60 * 60 * 24 * 28,
  });
}

export async function clearStaffSession() {
  const jar = await cookies();
  jar.delete("symmetry_staff");
  jar.delete("symmetry_staff_refresh");
}

export async function staffMembership(id: string) {
  const { data, error } = await createAdminClient()
    .from("staff_members")
    .select("role")
    .eq("user_id", id)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error("Staff access could not be checked");
  return data;
}
