import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const jobClientSource = read("../app/(app)/jobs/[id]/JobClient.tsx");
const jobPageSource = read("../app/(app)/jobs/[id]/page.tsx");
const jobLayoutSource = read("../app/(app)/jobs/[id]/layout.tsx");
const navbarSource = read("../app/components/Navbar.tsx");
const rootLayoutSource = read("../app/layout.tsx");
const appLayoutSource = read("../app/(app)/layout.tsx");
const homePageSource = read("../app/(app)/page.tsx");
const libraryLayoutSource = read("../app/library/layout.tsx");
const authServerSource = read("../lib/auth/server.ts");
const sessionSource = read("../lib/auth/session.ts");

test("job page does not render its own site header", () => {
  assert.doesNotMatch(jobClientSource, /<header className="site-header">/);
});

test("navbar can start from a server-provided logged-in user", () => {
  assert.match(navbarSource, /export default function Navbar\(\{ initialUser = null \}/);
  // The server user covers the first paint; the client session wins once it resolves.
  assert.match(navbarSource, /const user: AuthUser \| null = isPending\s*\? initialUser/);
});

test("navbar logo navigates client-side instead of reloading the document", () => {
  assert.match(navbarSource, /<Link href="\/" className="logo">/);
  assert.doesNotMatch(navbarSource, /<a href="\/"/);
});

test("root layout stays free of request-time data so public routes can be static", () => {
  assert.doesNotMatch(rootLayoutSource, /getServerUser|next\/headers|Navbar/);
});

test("app layout seeds the shared navbar with the server user", () => {
  assert.match(appLayoutSource, /const user = await getServerUser\(\)/);
  assert.match(appLayoutSource, /<Navbar initialUser=\{user\} \/>/);
});

test("library layout renders the navbar without a server session read", () => {
  assert.match(libraryLayoutSource, /<Navbar \/>/);
  assert.doesNotMatch(libraryLayoutSource, /getServerUser/);
});

test("home page picks landing vs workspace on the server", () => {
  assert.doesNotMatch(homePageSource, /"use client"/);
  assert.match(homePageSource, /const user = await getServerUser\(\)/);
  assert.match(homePageSource, /user \? <AuthenticatedHome \/> : <LandingPage \/>/);
});

test("session reads are de-duplicated within a server render", () => {
  assert.match(sessionSource, /import \{ cache \} from "react"/);
  assert.match(sessionSource, /export const getServerUser = cache\(/);
});

test("auth keeps a cookie session cache and skips database rate limiting for get-session", () => {
  assert.match(authServerSource, /cookieCache: \{\s*enabled: true,/);
  assert.match(authServerSource, /"\/get-session": false/);
  // Credential endpoints must stay rate limited in the database.
  assert.match(authServerSource, /rateLimit: \{\s*enabled: true,\s*storage: "database"/);
});

test("job page seeds historical job data from the server", () => {
  assert.match(jobPageSource, /const result = await requireOwnedJob\(id\)/);
  assert.match(jobPageSource, /if \(result\.response\)/);
  assert.match(jobPageSource, /const initialJob = sanitizeJob\(result\.job\)/);
  assert.match(jobPageSource, /<JobClient id=\{id\} initialError=\{runError\} initialJob=\{initialJob\} \/>/);
});

test("job route shows an instant loading state over a persistent backdrop", () => {
  assert.ok(existsSync(new URL("../app/(app)/jobs/[id]/loading.tsx", import.meta.url)));
  assert.match(jobLayoutSource, /className="bg-video"/);
  assert.doesNotMatch(jobClientSource, /className="bg-video"/);
});

test("job client initializes from server-provided job data", () => {
  assert.match(jobClientSource, /type JobPayload = \{/);
  assert.match(jobClientSource, /initialJob = null/);
  assert.match(jobClientSource, /const \[job, setJob\] = useState<JobPayload \| null>\(initialJob\)/);
});

test("Vercel functions run in Singapore, next to the APAC D1 database", () => {
  const vercelConfig = JSON.parse(read("../vercel.json")) as { regions?: string[] };
  assert.deepEqual(vercelConfig.regions, ["sin1"]);
});
