import { drizzle, type AnyD1Database, type DrizzleD1Database } from "drizzle-orm/d1";
import { getD1Config } from "../cloudflare/config";
import { getD1Database, type D1DatabaseLike } from "../cloudflare/d1";
import { schema } from "./schema";

export type AppDb = DrizzleD1Database<typeof schema>;

/**
 * Wrap any D1Database-compatible client (production `D1HttpDatabase`, Workers binding,
 * or test mock) with a typed Drizzle ORM instance.
 */
export function createDrizzleD1(client: D1DatabaseLike): AppDb {
  return drizzle(client as unknown as AnyD1Database, { schema });
}

let cachedDb: AppDb | null = null;
let cachedKey = "";

export function getDb(): AppDb {
  const cfg = getD1Config();
  const key = `${cfg.accountId}:${cfg.databaseId}:${cfg.apiToken.slice(0, 8)}`;
  if (!cachedDb || cachedKey !== key) {
    cachedDb = createDrizzleD1(getD1Database());
    cachedKey = key;
  }
  return cachedDb;
}

export * from "./schema";
