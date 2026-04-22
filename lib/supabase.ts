import { createClient } from "@supabase/supabase-js";

export function isSupabaseMode(): boolean {
  return isSupabaseServiceRoleConfigured(process.env);
}

export function getSupabaseClient() {
  if (!isSupabaseServiceRoleConfigured(process.env)) {
    const configuredRole = getSupabaseKeyRole(process.env.SUPABASE_SERVICE_ROLE_KEY);
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY is not configured with a service_role JWT${configuredRole ? ` (current role: ${configuredRole})` : ""}.`
    );
  }

  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
  env: Pick<NodeJS.ProcessEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">
): boolean {
  return Boolean(env.SUPABASE_URL && getSupabaseKeyRole(env.SUPABASE_SERVICE_ROLE_KEY) === "service_role");
}
