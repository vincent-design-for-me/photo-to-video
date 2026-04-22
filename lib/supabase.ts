import { createClient } from "@supabase/supabase-js";

type SupabaseServiceRoleEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export function isSupabaseMode(): boolean {
  return isSupabaseServiceRoleConfigured(readSupabaseServiceRoleEnv());
}

export function getSupabaseClient() {
  const env = readSupabaseServiceRoleEnv();

  if (!isSupabaseServiceRoleConfigured(env)) {
    const configuredRole = getSupabaseKeyRole(env.SUPABASE_SERVICE_ROLE_KEY);
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY is not configured with a service_role JWT${configuredRole ? ` (current role: ${configuredRole})` : ""}.`
    );
  }

  return createClient(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function getSupabaseKeyRole(key: string | undefined): string | undefined {
  if (!key) {
    return undefined;
  }

  const parts = key.split(".");
  if (parts.length < 2) {
    return undefined;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
    return payload.role;
  } catch {
    return undefined;
  }
}

export function isSupabaseServiceRoleConfigured(
  env: SupabaseServiceRoleEnv
): boolean {
  return Boolean(env.SUPABASE_URL && getSupabaseKeyRole(env.SUPABASE_SERVICE_ROLE_KEY) === "service_role");
}

function readSupabaseServiceRoleEnv(): SupabaseServiceRoleEnv {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
