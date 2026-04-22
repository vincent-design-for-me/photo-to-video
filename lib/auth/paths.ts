const AUTH_PATH_ALIASES: Record<string, string> = {
  "/auth/login": "/login",
  "/auth/signup": "/signup",
  "/auth/forgot-password": "/forgot-password",
  "/auth/reset-password": "/reset-password",
};

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

export function canonicalizeAuthPath(pathname: string): string {
  return AUTH_PATH_ALIASES[pathname] ?? pathname;
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(canonicalizeAuthPath(pathname)) || pathname === "/auth/callback";
}

export function buildLoginHref(nextPath?: string): string {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/login";
  }

  return `/login?next=${encodeURIComponent(nextPath)}`;
}
