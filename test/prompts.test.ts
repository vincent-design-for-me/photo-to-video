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

  assert.match(imagePrompt, /Analyze the uploaded interior image/i);
  assert.match(imagePrompt, /Do NOT change the room layout/i);
  assert.match(imagePrompt, /Style: Modern Luxury/i);
  assert.match(imagePrompt, /Marble white surfaces/i);
  assert.match(motionPrompt, /Morph Transition/i);
  assert.match(motionPrompt, /soft dolly-in/i);
});

test("image prompts ask the LLM to detect clutter and remove it from the rendering", () => {
  const imagePrompt = buildNanoBananaPrompt("japandi");

  assert.match(imagePrompt, /identify.*clutter/i);
  assert.match(imagePrompt, /Do NOT preserve clutter/i);
  assert.match(imagePrompt, /cardboard boxes/i);
  assert.match(imagePrompt, /loose cables/i);
  assert.match(imagePrompt, /mismatched ornaments/i);
  assert.match(imagePrompt, /preserve.*architectural/i);
  assert.match(imagePrompt, /Clutter Assessment/i);
  assert.match(imagePrompt, /Clutter Removal & Styling Cleanup/i);
});
