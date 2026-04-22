import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const jobClientSource = readFileSync(new URL("../app/jobs/[id]/JobClient.tsx", import.meta.url), "utf8");
const navbarSource = readFileSync(new URL("../app/components/Navbar.tsx", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const jobPageSource = readFileSync(new URL("../app/jobs/[id]/page.tsx", import.meta.url), "utf8");

test("job page does not render its own site header", () => {
  assert.doesNotMatch(jobClientSource, /<header className="site-header">/);
});

test("navbar can start from a server-provided logged-in user", () => {
  assert.match(navbarSource, /export default function Navbar\(\{ initialUser = null \}/);
  assert.match(navbarSource, /useState<User \| null>\(initialUser\)/);
});

test("layout seeds the shared navbar with the server user", () => {
  assert.match(layoutSource, /const supabase = await createServerClient\(\)/);
  assert.match(layoutSource, /const \{\s*data:\s*\{\s*user\s*\},\s*\}\s*=\s*await supabase\.auth\.getUser\(\)/);
  assert.match(layoutSource, /<Navbar initialUser=\{user\} \/>/);
});

test("job page seeds historical job data from the server", () => {
  assert.match(jobPageSource, /const result = await requireOwnedJob\(id\)/);
  assert.match(jobPageSource, /if \(result\.response\)/);
  assert.match(jobPageSource, /const initialJob = sanitizeJob\(result\.job\)/);
  assert.match(jobPageSource, /<JobClient id=\{id\} initialError=\{runError\} initialJob=\{initialJob\} \/>/);
});

test("job client initializes from server-provided job data", () => {
  assert.match(jobClientSource, /type JobPayload = \{/);
  assert.match(jobClientSource, /initialJob = null/);
  assert.match(jobClientSource, /const \[job, setJob\] = useState<JobPayload \| null>\(initialJob\)/);
});
