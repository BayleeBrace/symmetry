import { NextResponse } from "next/server";
import { createSiteAccessToken, SITE_ACCESS_COOKIE } from "@/lib/site-access";

export async function POST(request: Request) {
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    return NextResponse.json({ error: "Preview access is not configured." }, { status: 503 });
  }

  let submittedPassword = "";

  try {
    const body = (await request.json()) as { password?: unknown };
    submittedPassword = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const [submittedToken, accessToken] = await Promise.all([
    createSiteAccessToken(submittedPassword),
    createSiteAccessToken(sitePassword),
  ]);

  if (submittedToken !== accessToken) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SITE_ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
