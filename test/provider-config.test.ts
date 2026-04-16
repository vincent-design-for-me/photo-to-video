import test from "node:test";
import assert from "node:assert/strict";
import { buildGeminiGenerateContentUrl, getImageGenerationConfig, readGeminiJsonResponse } from "../lib/providers/geminiCompat";
import { buildKlingAuthorization, createKlingJwt, describeKlingJwt } from "../lib/providers/klingAuth";
import { buildKlingSkillRequestBody, fillKlingSkillTemplate } from "../lib/providers/klingSkill";

test("Gemini-compatible base URL is converted to generateContent endpoint", () => {
  assert.equal(
    buildGeminiGenerateContentUrl("https://third-party.example/v1beta", "gemini-2.5-flash-image"),
    "https://third-party.example/v1beta/models/gemini-2.5-flash-image:generateContent"
  );
});

test("image generation config accepts IMAGE_* aliases from the other project", () => {
  assert.deepEqual(
    getImageGenerationConfig({
      IMAGE_BASE_URL: "https://www.xinroute.com",
      IMAGE_API_KEY: "image-key",
      IMAGE_MODEL: "gemini-3-pro-image-preview",
      IMAGE_API_FORMAT: "gemini-native"
    }),
    {
      baseUrl: "https://www.xinroute.com",
      apiKey: "image-key",
      model: "gemini-3-pro-image-preview",
      format: "gemini-native"
    }
  );
});

test("Gemini-compatible response parser reports HTML endpoint mistakes clearly", async () => {
  const response = new Response("<!doctype html><html></html>", {
    status: 200,
    headers: { "Content-Type": "text/html" }
  });

  await assert.rejects(
    () => readGeminiJsonResponse(response),
    /returned text\/html instead of JSON.*IMAGE_BASE_URL/i
  );
});

test("Kling official access key and secret key produce a JWT bearer token", () => {
  const token = createKlingJwt("access-key", "secret-key", 1000);
  const [header, payload, signature] = token.split(".");

  assert.ok(header);
  assert.ok(payload);
  assert.ok(signature);
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")), {
    iss: "access-key",
    exp: 2800,
    nbf: 995
  });
  assert.match(buildKlingAuthorization({ accessKey: "access-key", secretKey: "secret-key", nowSeconds: 1000 }) ?? "", /^Bearer /);
});

test("Kling JWT description matches official token timing rules", () => {
  assert.deepEqual(describeKlingJwt("access-key", "secret-key", 1000), {
    token: createKlingJwt("access-key", "secret-key", 1000),
    authorization: `Bearer ${createKlingJwt("access-key", "secret-key", 1000)}`,
    issuedTo: "access-key",
    notBefore: 995,
    expiresAt: 2800,
    ttlSeconds: 1800
  });
});

test("Kling Skill request template replaces workflow placeholders", () => {
  const body = fillKlingSkillTemplate(
    '{"effect_scene":"{{effectScene}}","image":"{{firstFrameUrl}}","tail":"{{lastFrameUrl}}","prompt":"{{prompt}}","duration":{{clipSeconds}}}',
    {
      effectScene: "interior-pan",
      firstFrameUrl: "https://cdn.example/first.png",
      lastFrameUrl: "https://cdn.example/last.png",
      prompt: "Slow camera move",
      clipSeconds: 3,
      aspectRatio: "16:9"
    }
  );

  assert.deepEqual(body, {
    effect_scene: "interior-pan",
    image: "https://cdn.example/first.png",
    tail: "https://cdn.example/last.png",
    prompt: "Slow camera move",
    duration: 3
  });
});

test("Kling Skill default body uses effect_scene and input image URLs", () => {
  assert.deepEqual(
    buildKlingSkillRequestBody({
      effectScene: "interior-pan",
      model: "video-3.0-omni",
      resolution: "1080p",
      nativeAudio: true,
      audioSync: true,
      firstFrameUrl: "https://cdn.example/first.png",
      lastFrameUrl: "https://cdn.example/last.png",
      prompt: "Slow camera move",
      clipSeconds: 3,
      aspectRatio: "16:9"
    }),
    {
      effect_scene: "interior-pan",
      model: "video-3.0-omni",
      resolution: "1080p",
      input: {
        image: "https://cdn.example/first.png",
        image_tail: "https://cdn.example/last.png"
      },
      prompt: "Slow camera move",
      duration: 3,
      aspect_ratio: "16:9",
      native_audio: true,
      audio_sync: true
    }
  );
});
