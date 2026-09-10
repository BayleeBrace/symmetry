import { cookies } from "next/headers";
import { z } from "zod";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/staff";
import { saveStaffSession, staffMembership } from "@/lib/staff-session";
import {
  privateJson,
  publicError,
  rateLimit,
  sameOrigin,
  signLink,
  siteUrl,
  verifyLink,
} from "@/lib/security";

// Face ID and fingerprint sign-in, one passkey per phone per barber.
// The phone holds the private key; we keep the public key and check a signed challenge.

const CHALLENGE_COOKIE = "symmetry_passkey";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/staff/passkey",
  maxAge: 300,
};

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("register-options") }),
  z.object({
    action: z.literal("register-verify"),
    label: z.string().max(60).optional(),
    response: z.record(z.string(), z.unknown()),
  }),
  z.object({ action: z.literal("login-options") }),
  z.object({
    action: z.literal("login-verify"),
    response: z.record(z.string(), z.unknown()),
  }),
  z.object({ action: z.literal("remove"), id: z.uuid() }),
]);

/** Passkeys are bound to the domain: symmetrywales.com live (with or without www), localhost in development. */
function relyingParty(req: Request) {
  const site = new URL(siteUrl());
  const rpID = site.hostname.replace(/^www\./, "");
  const origins = new Set([site.origin]);
  if (rpID !== "localhost") {
    origins.add(`https://${rpID}`);
    origins.add(`https://www.${rpID}`);
  }
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const o = new URL(origin);
      if (o.hostname === rpID || o.hostname.endsWith("." + rpID))
        origins.add(o.origin);
    } catch {}
  }
  return { rpID, origins: [...origins] };
}

export async function GET() {
  try {
    const staff = await requireStaff();
    const { data, error } = await createAdminClient()
      .from("staff_passkeys")
      .select("id,label,created_at,last_used_at")
      .eq("user_id", staff.user_id)
      .order("created_at");
    if (error) throw new Error("Face ID settings could not load");
    return privateJson({ passkeys: data });
  } catch (e) {
    return publicError(e, 403);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = actions.parse(await req.json());
    const jar = await cookies();
    const { rpID, origins } = relyingParty(req);

    if (p.action === "register-options") {
      const db = createAdminClient();
      const staff = await requireStaff();
      const [{ data: userData }, { data: existing }, chair] = await Promise.all(
        [
          db.auth.admin.getUserById(staff.user_id),
          db
            .from("staff_passkeys")
            .select("credential_id,transports")
            .eq("user_id", staff.user_id),
          staff.barber_id
            ? db
                .from("barbers")
                .select("name")
                .eq("id", staff.barber_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ],
      );
      const email = userData.user?.email ?? "staff";
      const options = await generateRegistrationOptions({
        rpName: "Symmetry Barbers",
        rpID,
        userName: email,
        userDisplayName: chair.data?.name ?? email,
        userID: new TextEncoder().encode(staff.user_id),
        attestationType: "none",
        excludeCredentials: (existing ?? []).map((c) => ({
          id: c.credential_id,
          transports: c.transports as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
      });
      jar.set(
        CHALLENGE_COOKIE,
        signLink("passkey-register", options.challenge, 300),
        cookieOptions,
      );
      return privateJson(options);
    }

    if (p.action === "register-verify") {
      const db = createAdminClient();
      const staff = await requireStaff();
      const expectedChallenge = verifyLink(
        jar.get(CHALLENGE_COOKIE)?.value ?? "",
        "passkey-register",
      );
      if (!expectedChallenge)
        throw new Error("Face ID setup timed out. Try again.");
      const verification = await verifyRegistrationResponse({
        response: p.response as unknown as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo)
        throw new Error("Face ID could not be set up on this phone");
      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;
      const { error } = await db.from("staff_passkeys").insert({
        user_id: staff.user_id,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports ?? [],
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        label: p.label?.trim() || "This phone",
      });
      if (error) throw new Error("Face ID could not be saved");
      jar.delete(CHALLENGE_COOKIE);
      return privateJson({ ok: true });
    }

    if (p.action === "login-options") {
      await rateLimit(req, "passkey-login", 20);
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
        allowCredentials: [],
      });
      jar.set(
        CHALLENGE_COOKIE,
        signLink("passkey-login", options.challenge, 300),
        cookieOptions,
      );
      return privateJson(options);
    }

    if (p.action === "login-verify") {
      await rateLimit(req, "passkey-login", 20);
      const expectedChallenge = verifyLink(
        jar.get(CHALLENGE_COOKIE)?.value ?? "",
        "passkey-login",
      );
      if (!expectedChallenge)
        throw new Error("Face ID sign-in timed out. Try again.");
      const response = p.response as unknown as AuthenticationResponseJSON;
      const db = createAdminClient();
      const { data: key } = await db
        .from("staff_passkeys")
        .select("*")
        .eq("credential_id", response.id)
        .maybeSingle();
      if (!key)
        throw new Error(
          "This phone is not set up for Face ID yet. Sign in with your password, then set it up in Settings.",
        );
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: key.credential_id,
          publicKey: new Uint8Array(Buffer.from(key.public_key, "base64url")),
          counter: Number(key.counter),
          transports: key.transports as AuthenticatorTransportFuture[],
        },
      });
      if (!verification.verified) throw new Error("Face ID did not match");
      await db
        .from("staff_passkeys")
        .update({
          counter: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", key.id);
      if (!(await staffMembership(key.user_id)))
        throw new Error("Staff access has been removed");
      const { data: userData, error: userError } =
        await db.auth.admin.getUserById(key.user_id);
      if (userError || !userData.user?.email)
        throw new Error("Sign-in could not be completed");
      // A session without a password: a one-time sign-in token, used here and now, never emailed.
      const { data: link, error: linkError } = await db.auth.admin.generateLink(
        { type: "magiclink", email: userData.user.email },
      );
      if (linkError || !link.properties?.hashed_token)
        throw new Error("Sign-in could not be completed");
      const { data: otp, error: otpError } = await db.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: "magiclink",
      });
      if (otpError || !otp.session)
        throw new Error("Sign-in could not be completed");
      await saveStaffSession(otp.session);
      jar.delete(CHALLENGE_COOKIE);
      return privateJson({ ok: true });
    }

    const staff = await requireStaff();
    const { error } = await createAdminClient()
      .from("staff_passkeys")
      .delete()
      .eq("id", p.id)
      .eq("user_id", staff.user_id);
    if (error) throw new Error("Could not remove Face ID from that phone");
    return privateJson({ ok: true });
  } catch (e) {
    return publicError(e, 401);
  }
}
