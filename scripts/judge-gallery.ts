/**
 * Prototype validation for judgeFrame().
 *
 * Runs the structural-consistency judge over the gallery before/after pairs so
 * we can eyeball whether its scores match human judgement before wiring it into
 * the product. Includes a negative control (two different rooms) that SHOULD
 * score low — if it doesn't, the judge isn't really discriminating structure.
 *
 * Run:  npm run judge:gallery
 *   (= node --env-file=.env.local --import tsx scripts/judge-gallery.ts)
 */
import path from "node:path";
import { judgeFrame } from "../lib/providers/judgeFrame";

const GALLERY = path.join(process.cwd(), "public", "gallery");
const g = (name: string) => path.join(GALLERY, name);

type Case = {
  label: string;
  before: string;
  after: string;
  expectation: string;
};

const CASES: Case[] = [
  { label: "Contemporary",  before: g("Contemporary-before.png"), after: g("Contemporary.png"),  expectation: "HIGH — same room, restyled" },
  { label: "Japandi",       before: g("Japandi-before.png"),      after: g("Japandi.png"),       expectation: "HIGH — same room, restyled" },
  { label: "Luxury Modern", before: g("Luxury Modern-Before.png"), after: g("Luxury Modern.png"), expectation: "HIGH — same room, restyled" },
  // Negative control: original of one room vs the finished image of a different room.
  { label: "CONTROL (mismatched rooms)", before: g("Contemporary-before.png"), after: g("Japandi.png"), expectation: "LOW — different rooms, should fail" },
];

function bar(score: number): string {
  const filled = Math.round(score / 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)} ${score}/100`;
}

async function main() {
  console.log(`\nRunning judgeFrame over ${CASES.length} cases…\n`);

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    process.stdout.write(`[${i + 1}/${CASES.length}] ${c.label} … `);
    try {
      const v = await judgeFrame({ beforeImagePath: c.before, afterImagePath: c.after });
      console.log(v.passed ? "PASS ✅" : "FAIL ❌");
      console.log(`        score      ${bar(v.consistencyScore)}  (threshold ${v.threshold})`);
      console.log(`        geometry   ${bar(v.geometryPreserved)}`);
      console.log(`        perspective${bar(v.perspectivePreserved)}`);
      console.log(`        expected   ${c.expectation}`);
      if (v.flaggedIssues.length) {
        console.log(`        issues     ${v.flaggedIssues.map(s => `\n                     - ${s}`).join("")}`);
      } else {
        console.log(`        issues     none`);
      }
      console.log(`        rationale  ${v.rationale}\n`);
    } catch (err) {
      console.log("ERROR");
      console.log(`        ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  console.log("Done. Compare each score against your own eye on the image pair.\n");
}

main().catch(err => { console.error(err); process.exit(1); });
