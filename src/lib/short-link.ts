import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A booking link short enough for a one-part text message: the booking's id,
 * the day the link stops working and an 8-byte signature, 35 characters in
 * all (symmetrywales.com/b/<code>). Opening it swaps it for the usual signed
 * booking link, so it grants exactly what that link does, for the same 180
 * days. A full link is about 190 characters, which would take a text from one
 * paid part to three.
 */
const DAY_MS = 86_400_000;
const CODE = /^[A-Za-z0-9_-]{35}$/;

function signature(key: string, body: Buffer) {
  return createHmac("sha256", key)
    .update("short-link:")
    .update(body)
    .digest()
    .subarray(0, 8);
}

export function shortCode(
  groupId: string,
  key: string,
  now = Date.now(),
  days = 180,
) {
  const id = Buffer.from(groupId.replace(/-/g, ""), "hex");
  if (id.length !== 16) throw new Error("Not a booking id");
  const until = Buffer.alloc(2);
  until.writeUInt16BE(Math.floor(now / DAY_MS) + days);
  const body = Buffer.concat([id, until]);
  return Buffer.concat([body, signature(key, body)]).toString("base64url");
}

/** The booking id a short code stands for, or null if it is altered, expired or not one of ours. */
export function readShortCode(code: string, key: string, now = Date.now()) {
  if (!CODE.test(code)) return null;
  const raw = Buffer.from(code, "base64url");
  if (raw.length !== 26) return null;
  const body = raw.subarray(0, 18);
  if (!timingSafeEqual(raw.subarray(18), signature(key, body))) return null;
  if (raw.readUInt16BE(16) < Math.floor(now / DAY_MS)) return null;
  const hex = raw.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
