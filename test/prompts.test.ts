import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKlingMotionPrompt,
  buildNanoBananaPrompt,
  DEFAULT_WORKFLOW_CONFIG
} from "../lib/jobs/workflow";
import { INTERIOR_STYLE_PROMPTS } from "../lib/prompts/interiorStyles";

test("default workflow uses fixed vertical social video settings", () => {
  assert.equal(DEFAULT_WORKFLOW_CONFIG.aspectRatio, "9:16");
  assert.equal(DEFAULT_WORKFLOW_CONFIG.clipSeconds, 3);
  assert.equal(DEFAULT_WORKFLOW_CONFIG.maxImages, 6);
  assert.equal(DEFAULT_WORKFLOW_CONFIG.outputWidth, 1080);
  assert.equal(DEFAULT_WORKFLOW_CONFIG.outputHeight, 1920);
  assert.equal(DEFAULT_WORKFLOW_CONFIG.videoModel, "video-3.0-omni");
  assert.equal(DEFAULT_WORKFLOW_CONFIG.resolution, "1080p");
  assert.equal(DEFAULT_WORKFLOW_CONFIG.nativeAudio, true);
  assert.equal(DEFAULT_WORKFLOW_CONFIG.audioSync, true);
});

test("selectable interior style prompts are available for image generation", () => {
  assert.equal(INTERIOR_STYLE_PROMPTS.length, 8);
  assert.deepEqual(
    INTERIOR_STYLE_PROMPTS.map((style) => style.name),
    [
      "Minimalist Calm",
      "Modern Luxury",
      "Japandi",
      "Industrial Soft Loft",
      "Cozy Warm Retreat",
      "Futuristic Clean",
      "Boutique Hotel Style",
      "Wabi-Sabi Organic"
    ]
  );
});

test("prompts include interior ad constraints and avoid unwanted artifacts", () => {
  const imagePrompt = buildNanoBananaPrompt("modern-luxury");
  const motionPrompt = buildKlingMotionPrompt("soft dolly-in");

  assert.match(imagePrompt, /high-quality Nano Banana prompt/i);
  assert.match(imagePrompt, /Do NOT change the room layout/i);
  assert.match(imagePrompt, /Preserve identity, face, body, and pose exactly/i);
  assert.match(imagePrompt, /Style: Modern Luxury/i);
  assert.match(imagePrompt, /marble, velvet, and brass/i);
  assert.match(motionPrompt, /stable geometry/i);
  assert.match(motionPrompt, /no jitter/i);
});
