"use client";

import { authClient } from "@/lib/auth/client";

/**
 * Tracks whether the current visitor is authenticated.
 * Returns `null` while the initial check is in flight, then a boolean that
 * stays in sync with Better Auth session state.
 */
export function useAuthStatus() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return null;
  return Boolean(data?.user);
}
