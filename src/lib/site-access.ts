export const SITE_ACCESS_COOKIE = "symmetry_preview";

export async function createSiteAccessToken(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function hasSiteAccess(cookieValue?: string) {
  if (process.env.SITE_LIVE === "true") return true;
  const password = process.env.SITE_PASSWORD;

  if (!password || !cookieValue) {
    return false;
  }

  return cookieValue === (await createSiteAccessToken(password));
}
