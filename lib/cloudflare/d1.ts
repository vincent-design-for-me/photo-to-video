import { fetchWithRetry } from "../http/fetchWithRetry";
import { getD1Config, type D1Config } from "./config";

export type D1ResultMeta = {
  changed_db?: boolean;
  changes?: number;
  duration?: number;
  last_row_id?: number | null;
  rows_read?: number;
  rows_written?: number;
};

export type D1Result<T = Record<string, unknown>> = {
  results: T[];
  success: boolean;
  meta: D1ResultMeta;
};

type D1ApiResponse<T = Record<string, unknown>> = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<{
    results?: T[];
    success?: boolean;
    meta?: D1ResultMeta;
  }>;
};

type D1RawApiResponse = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<{
    results?: {
      columns?: string[];
      rows?: unknown[][];
    };
    success?: boolean;
    meta?: D1ResultMeta;
  }>;
};

export type D1PreparedStatementLike = {
  readonly sql: string;
  readonly params: unknown[];
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
};

export type D1DatabaseLike = {
  prepare(sql: string): D1PreparedStatementLike;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatementLike[]): Promise<D1Result<T>[]>;
  exec(sql: string): Promise<{ count: number; duration: number }>;
};

export function normalizeD1Param(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.from(value).toString("base64");
  }
  return JSON.stringify(value);
}

class D1HttpPreparedStatement implements D1PreparedStatementLike {
  readonly sql: string;
  readonly params: unknown[];
  readonly #db: D1HttpDatabase;

  constructor(db: D1HttpDatabase, sql: string, params: unknown[] = []) {
    this.#db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): D1PreparedStatementLike {
    return new D1HttpPreparedStatement(this.#db, this.sql, values);
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.#db.queryOne<T>(this.sql, this.params);
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const res = await this.all<Record<string, unknown>>();
    const row = res.results[0];
    if (!row) return null;
    if (colName !== undefined) {
      return (row[colName] as T | undefined) ?? null;
    }
    return row as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.all<T>();
  }
}

/**
 * Cloudflare D1 REST API client implementing the standard D1Database interface
 * (`prepare`, `batch`, `exec`), so it works natively with BOTH Better Auth's
 * built-in `D1SqliteDialect` and our `store.d1.ts` job store from Vercel Node.js.
 */
export class D1HttpDatabase implements D1DatabaseLike {
  readonly #endpoint: string;
  readonly #apiToken: string;
  readonly #fetchImpl?: typeof fetch;

  constructor(config: D1Config, options?: { fetchImpl?: typeof fetch }) {
    this.#endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      config.accountId
    )}/d1/database/${encodeURIComponent(config.databaseId)}/query`;
    this.#apiToken = config.apiToken;
    this.#fetchImpl = options?.fetchImpl;
  }

  prepare(sql: string): D1PreparedStatementLike {
    return new D1HttpPreparedStatement(this, sql);
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<D1Result<T>> {
    const normalizedParams = params.map(normalizeD1Param);
    const response = await fetchWithRetry(
      this.#endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql,
          params: normalizedParams,
        }),
      },
      {
        timeoutMs: 20_000,
        maxAttempts: 3,
        baseDelayMs: 400,
        maxDelayMs: 4000,
        label: "cloudflare:d1",
        fetchImpl: this.#fetchImpl,
      }
    );

    const payload = (await response.json().catch(() => null)) as D1ApiResponse<T> | null;
    if (!response.ok || !payload?.success) {
      const errText =
        payload?.errors?.map((e) => `${e.code ?? ""}: ${e.message ?? "unknown"}`).join("; ") ||
        `HTTP ${response.status}`;
      throw new Error(`Cloudflare D1 query failed: ${errText}`);
    }

    const first = payload.result?.[0];
    return {
      results: first?.results ?? [],
      success: first?.success ?? true,
      meta: first?.meta ?? {},
    };
  }

  async batch<T = Record<string, unknown>>(
    statements: D1PreparedStatementLike[]
  ): Promise<D1Result<T>[]> {
    const out: D1Result<T>[] = [];
    for (const stmt of statements) {
      out.push(await this.queryOne<T>(stmt.sql, stmt.params));
    }
    return out;
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    const started = Date.now();
    const res = await this.queryOne(sql, []);
    return {
      count: res.results.length,
      duration: res.meta.duration ?? Date.now() - started,
    };
  }
}

let cachedD1: D1HttpDatabase | null = null;
let cachedKey = "";

export function getD1Database(): D1HttpDatabase {
  const cfg = getD1Config();
  const key = `${cfg.accountId}:${cfg.databaseId}:${cfg.apiToken.slice(0, 8)}`;
  if (!cachedD1 || cachedKey !== key) {
    cachedD1 = new D1HttpDatabase(cfg);
    cachedKey = key;
  }
  return cachedD1;
}
