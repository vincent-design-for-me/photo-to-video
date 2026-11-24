import { NextResponse, type NextRequest } from "next/server";
import { canonicalizeAuthPath, isPublicPath } from "./paths";

const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)?.value));
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const canonicalPath = canonicalizeAuthPath(pathname);

  if (canonicalPath !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = canonicalPath;
    return NextResponse.redirect(url);
  }

  // Better Auth API routes and application API routes handle their own 401 responses.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Fast cookie presence check at the edge; every protected page & API route
  // performs full session validation against Cloudflare D1 via getServerUser().
  const signedIn = hasSessionCookie(request);

  if (!signedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
