/**
 * Run judgeFrame() on a single before/after pair given as CLI args.
 *
 * Run:  node --env-file=.env.local --import tsx scripts/judge-one.ts <beforePath> <afterPath>
 */
import { judgeFrame } from "../lib/providers/judgeFrame";

function bar(score: number): string {
  const filled = Math.round(score / 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)} ${score}/100`;
}

async function main() {
  const [before, after] = process.argv.slice(2);
  if (!before || !after) {
    console.error("Usage: judge-one.ts <beforePath> <afterPath>");
    process.exit(1);
  }

  console.log(`\nBEFORE: ${before}\nAFTER:  ${after}\n`);
  const v = await judgeFrame({ beforeImagePath: before, afterImagePath: after });

  console.log(v.passed ? "PASS ✅" : "FAIL ❌");
  console.log(`  score      ${bar(v.consistencyScore)}  (threshold ${v.threshold})`);
  console.log(`  geometry   ${bar(v.geometryPreserved)}`);
  console.log(`  perspective${bar(v.perspectivePreserved)}`);
  if (v.flaggedIssues.length) {
    console.log(`  issues     ${v.flaggedIssues.map(s => `\n               - ${s}`).join("")}`);
  } else {
    console.log(`  issues     none`);
  }
  console.log(`  rationale  ${v.rationale}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
