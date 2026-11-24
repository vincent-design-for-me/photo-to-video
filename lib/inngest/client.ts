import { Inngest } from "inngest";

export type InngestEnv = Record<string, string | undefined> & {
  INNGEST_EVENT_KEY?: string;
  INNGEST_SIGNING_KEY?: string;
  INNGEST_DEV?: string;
};

/**
 * Returns true when Inngest should handle async job execution:
 * - Production/Preview: `INNGEST_EVENT_KEY` is configured (Vercel + Inngest Cloud)
 * - Local Dev Server: `INNGEST_DEV` is set (e.g. `INNGEST_DEV=1` or `http://127.0.0.1:8288`)
 *
 * When false, job routes fall back seamlessly to Next.js `after()` so local dev
 * works out of the box without running a separate process.
 */
export function isInngestConfigured(env: InngestEnv = process.env): boolean {
  const hasEventKey = Boolean(env.INNGEST_EVENT_KEY?.trim());
  const devFlag = env.INNGEST_DEV?.trim();
  const hasDevServer = Boolean(devFlag && devFlag !== "0" && devFlag.toLowerCase() !== "false");
  return hasEventKey || hasDevServer;
}

export const inngest = new Inngest({
  id: "photo-to-video",
});
