import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSiteAccess, SITE_ACCESS_COOKIE } from "@/lib/site-access";

const PUBLIC_PATHS = new Set(["/", "/api/site-access", "/opengraph-image"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(SITE_ACCESS_COOKIE)?.value;

  if (await hasSiteAccess(cookieValue)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: "/:path*",
};
