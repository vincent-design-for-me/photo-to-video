import { headers } from "next/headers";
import { getAuth } from "./server";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
];

function hasSessionCookieHeader(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return SESSION_COOKIE_NAMES.some((name) => cookieHeader.includes(`${name}=`));
}

export async function getServerUser(): Promise<AuthUser | null> {
  // Call headers() outside try/catch so Next.js always knows the route is dynamic
  // and never statically prerenders authenticated pages with user=null.
  const reqHeaders = await headers();
  if (!hasSessionCookieHeader(reqHeaders.get("cookie"))) {
    return null;
  }

  try {
    const session = await getAuth().api.getSession({
      headers: reqHeaders,
    });
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
  } catch (error) {
    console.warn("[auth] Failed to read server session:", error instanceof Error ? error.message : error);
    return null;
  }
}
