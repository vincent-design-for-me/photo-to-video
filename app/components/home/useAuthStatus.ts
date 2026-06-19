"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Tracks whether the current visitor is authenticated.
 * Returns `null` while the initial check is in flight, then a boolean that
 * stays in sync with Supabase auth state changes.
 */
export function useAuthStatus() {
  const supabaseRef = useRef(createClient());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabaseRef.current.auth.getUser().then(({ data }) => {
      if (active) setIsAuthenticated(Boolean(data.user));
    });
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return isAuthenticated;
}
