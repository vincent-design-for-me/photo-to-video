import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchWithRetry } from "../http/fetchWithRetry";
import { getJudgeLLMConfig } from "./geminiCompat";

/**
 * Structural-consistency verdict for a single before/after pair.
 *
 * The judge scores ONE thing: whether the AI-restyled "after" image preserved
 * the room's structure and geometry. Style/colour/furniture changes are the
 * product's whole point and are NOT penalised — see the prompt below.
 */
export type FrameJudgement = {
  /** 0-100 overall structural fidelity (100 = geometry perfectly preserved). */
  consistencyScore: number;
  /** 0-100 sub-scores, surfaced for threshold calibration during testing. */
  geometryPreserved: number;
  perspectivePreserved: number;
  /** Concrete structural problems; empty when none found. */
  flaggedIssues: string[];
  /** One or two sentences of human-readable reasoning. */
  rationale: string;
  /** consistencyScore >= threshold. */
  passed: boolean;
  /** Threshold used to compute `passed`. */
  threshold: number;
};

const DEFAULT_THRESHOLD = 70;

const JUDGE_SYSTEM_PROMPT = `You are a STRICT quality-control judge for an AI interior-restyling product used for real-estate listings, where the video must HONESTLY represent the real property. A beautiful image that depicts a DIFFERENT room than the original is a FAILURE, not a success.

You are given two images of the SAME room: BEFORE (the user's original photo) and AFTER (an AI-restyled version).

The product INTENTIONALLY changes décor, materials, furniture, colours, and lighting style. Those changes are DESIRED and must NEVER lower the score.

You evaluate exactly ONE thing: does the AFTER image faithfully preserve the real room's ARCHITECTURE — its shape, dimensions, and the position of every fixed structural element?

Before scoring, do this analysis explicitly in your head:
1. Map the BEFORE room region by region: left wall, right wall, far/back wall, floor, ceiling. Note the room's overall DEPTH and proportions (is it a long narrow room? a square room?), and the POSITION of every fixed opening (each window, door, archway, passage) — which wall it sits on and where.
2. Do the SAME for the AFTER image.
3. Compare region to region. Score how well the AFTER matches the BEFORE's actual architecture.

These are HARD structural failures — penalise them heavily even if each element looks individually realistic:
- Room DEPTH or overall proportions changed (e.g. a long/deep room rendered as a short/square one, or aspect/crop that compresses the space).
- A fixed opening MOVED to a different wall or a different position (an archway on the LEFT wall reappearing on the BACK wall counts as moved — existence elsewhere does NOT excuse it).
- Windows/doors/archways added, removed, duplicated, melted, or changed in count.
- Mid-room architecture (alcoves, partitions, level changes, passages into other rooms) that disappears or is invented.
- Warped/bent walls, broken or inconsistent perspective, impossible/contradictory geometry, objects fused into walls.
- "Plausible but different room" overall — if the AFTER reads as a different floor plan, that alone caps the score low even if every element looks clean.

Do NOT penalise: style, colour palette, furniture choice, materials, decorations, artwork, plants, rugs, lighting mood, or any added/removed MOVABLE décor.

Scoring guide (consistencyScore): 90-100 = architecture faithfully preserved; 70-89 = preserved with minor fixed-element changes; 40-69 = noticeable architectural drift (a moved opening, altered proportions, or lost mid-room structure); 0-39 = different floor plan / room.

Respond with ONLY a JSON object — no markdown, no code fences, no prose — of exactly this shape:
{
  "consistencyScore": <integer 0-100, overall architectural fidelity>,
  "geometryPreserved": <integer 0-100, walls/proportions/depth and openings' positions>,
  "perspectivePreserved": <integer 0-100, vanishing points and viewpoint consistency>,
  "flaggedIssues": [<short strings naming concrete structural problems, e.g. "archway moved from left wall to back wall", "room depth compressed"; [] if none>],
  "rationale": "<one or two sentences>"
}`;

function inferMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function toDataUri(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return `data:${inferMimeType(filePath)};base64,${data.toString("base64")}`;
}

/** Pull the first balanced JSON object out of a model response that may be fenced. */
function parseJudgeJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Judge did not return JSON. Got: ${raw.slice(0, 200)}`);
  }
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

function clampScore(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type JudgeFrameInput = {
  beforeImagePath: string;
  afterImagePath: string;
  /** Pass threshold for `passed`; defaults to 70 during the testing phase. */
  threshold?: number;
};

export async function judgeFrame(input: JudgeFrameInput): Promise<FrameJudgement> {
  const llm = getJudgeLLMConfig();
  if (!llm) {
    throw new Error("Judge LLM is not configured. Set LLM_BASE_URL/LLM_API_KEY (and optionally JUDGE_MODEL) in .env.local.");
  }

  const threshold = input.threshold ?? DEFAULT_THRESHOLD;
  const [beforeUri, afterUri] = await Promise.all([
    toDataUri(input.beforeImagePath),
    toDataUri(input.afterImagePath),
  ]);

  const response = await fetchWithRetry(
    `${llm.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          { role: "system", content: JUDGE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "BEFORE (original photo):" },
              { type: "image_url", image_url: { url: beforeUri } },
              { type: "text", text: "AFTER (AI-restyled):" },
              { type: "image_url", image_url: { url: afterUri } },
              { type: "text", text: "Judge structural consistency now. Output JSON only." },
            ],
          },
        ],
      }),
    },
    {
      timeoutMs: 45_000,
      maxAttempts: 2,
      baseDelayMs: 1500,
      label: "judgeFrame",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Judge call failed (${response.status}): ${body.slice(0, 400)}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const rawText = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseJudgeJson(rawText);

  const consistencyScore = clampScore(parsed.consistencyScore);
  const flaggedIssues = Array.isArray(parsed.flaggedIssues)
    ? parsed.flaggedIssues.filter((x): x is string => typeof x === "string")
    : [];

  return {
    consistencyScore,
    geometryPreserved: clampScore(parsed.geometryPreserved, consistencyScore),
    perspectivePreserved: clampScore(parsed.perspectivePreserved, consistencyScore),
    flaggedIssues,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    passed: consistencyScore >= threshold,
    threshold,
  };
}
