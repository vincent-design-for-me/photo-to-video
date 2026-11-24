export type CloudflareEnv = Record<string, string | undefined> & {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_D1_DATABASE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_ENDPOINT?: string;
};

export type D1Config = {
  accountId: string;
  databaseId: string;
  apiToken: string;
};

export type R2Config = {
  accountId: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

export function isD1Configured(env: CloudflareEnv = process.env): boolean {
  return Boolean(
    env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      env.CLOUDFLARE_D1_DATABASE_ID?.trim() &&
      env.CLOUDFLARE_API_TOKEN?.trim()
  );
}

export function isR2Configured(env: CloudflareEnv = process.env): boolean {
  const hasEndpoint = Boolean(env.R2_ENDPOINT?.trim() || env.CLOUDFLARE_ACCOUNT_ID?.trim());
  return Boolean(
    hasEndpoint &&
      env.R2_ACCESS_KEY_ID?.trim() &&
      env.R2_SECRET_ACCESS_KEY?.trim()
  );
}

export function isCloudMode(env: CloudflareEnv = process.env): boolean {
  return isD1Configured(env) && isR2Configured(env);
}

export function getD1Config(env: CloudflareEnv = process.env): D1Config {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const databaseId = env.CLOUDFLARE_D1_DATABASE_ID?.trim();
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      "Cloudflare D1 is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN."
    );
  }

  return { accountId, databaseId, apiToken };
}

export function getR2Config(env: CloudflareEnv = process.env): R2Config {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const endpoint =
    env.R2_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = env.R2_BUCKET_NAME?.trim() || "photo-to-video-assets";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 is not configured. Set CLOUDFLARE_ACCOUNT_ID (or R2_ENDPOINT), R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY."
    );
  }

  return {
    accountId,
    endpoint: endpoint.replace(/\/$/, ""),
    accessKeyId,
    secretAccessKey,
    bucketName,
  };
}
