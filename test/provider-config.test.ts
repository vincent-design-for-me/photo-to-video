import test from "node:test";
import assert from "node:assert/strict";
import { buildGeminiGenerateContentUrl, getImageGenerationConfig, getJudgeLLMConfig, readGeminiJsonResponse } from "../lib/providers/geminiCompat";
import { buildKlingAuthorization, createKlingJwt, describeKlingJwt } from "../lib/providers/klingAuth";
import { buildKlingSkillRequestBody, fillKlingSkillTemplate } from "../lib/providers/klingSkill";
import {
  buildNovartVideoRequestBody,
  checkNovartVideoTaskOnce,
  extractNovartVideoTaskId,
  extractNovartVideoUrl,
  getNovartDownloadHeaders,
  getNovartVideoConfig,
  normalizeNovartVideoAspectRatio,
  normalizeNovartVideoDuration,
  normalizeNovartVideoResolution,
  pollNovartVideoTask
} from "../lib/providers/novartVideo";

test("Gemini-compatible base URL is converted to generateContent endpoint", () => {
  assert.equal(
    buildGeminiGenerateContentUrl("https://third-party.example/v1beta", "gemini-2.5-flash-image"),
    "https://third-party.example/v1beta/models/gemini-2.5-flash-image:generateContent"
  );
});

test("image generation config reads IMAGE_* env vars", () => {
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

test("judge LLM config falls back to LLM_* when no JUDGE_* overrides are set", () => {
  assert.deepEqual(
    getJudgeLLMConfig({ LLM_BASE_URL: "https://llm.example/", LLM_API_KEY: "llm-key", LLM_MODEL: "agnes-2.0-flash" }),
    { baseUrl: "https://llm.example", apiKey: "llm-key", model: "agnes-2.0-flash" }
  );
});

test("JUDGE_MODEL overrides only the model, reusing the LLM endpoint and key", () => {
  assert.deepEqual(
    getJudgeLLMConfig({ LLM_BASE_URL: "https://llm.example", LLM_API_KEY: "llm-key", LLM_MODEL: "agnes-2.0-flash", JUDGE_MODEL: "agnes-2.0-pro" }),
    { baseUrl: "https://llm.example", apiKey: "llm-key", model: "agnes-2.0-pro" }
  );
});

test("JUDGE_LLM_BASE_URL and JUDGE_LLM_API_KEY point the judge at a separate endpoint", () => {
  assert.deepEqual(
    getJudgeLLMConfig({
      LLM_BASE_URL: "https://llm.example", LLM_API_KEY: "llm-key", LLM_MODEL: "agnes-2.0-flash",
      JUDGE_LLM_BASE_URL: "https://judge.example/", JUDGE_LLM_API_KEY: "judge-key", JUDGE_MODEL: "strong-vision-1"
    }),
    { baseUrl: "https://judge.example", apiKey: "judge-key", model: "strong-vision-1" }
  );
});

test("judge LLM config is null when neither JUDGE_* nor LLM_* credentials exist", () => {
  assert.equal(getJudgeLLMConfig({}), null);
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

test("Novart video config reuses IMAGE_API_KEY / IMAGE_BASE_URL and ignores Kling AK/SK", () => {
  assert.deepEqual(
    getNovartVideoConfig({
      IMAGE_BASE_URL: "https://www.novartstudio.art/v1/",
      IMAGE_API_KEY: "nova_shared_key",
      KLING_ACCESS_KEY: "kling-ak",
      KLING_SECRET_KEY: "kling-sk",
      KLING_MODEL: "nova-video-k-3",
      KLING_DURATION_SECONDS: "3"
    }),
    {
      baseUrl: "https://www.novartstudio.art/v1",
      apiKey: "nova_shared_key",
      model: "nova-video-k-3",
      durationSeconds: 3,
      resolution: undefined,
      generateAudio: true
    }
  );

  assert.equal(
    getNovartVideoConfig({
      KLING_API_BASE_URL: "https://www.novartstudio.art/v1",
      KLING_API_KEY: "nova_video_key",
      KLING_SOUND: "off"
    })?.generateAudio,
    false
  );
});

test("Novart video normalizers clamp aspect_ratio, resolution, and duration for nova-video-k-3", () => {
  assert.equal(normalizeNovartVideoAspectRatio("16:9", "nova-video-k-3"), "16:9");
  assert.equal(normalizeNovartVideoAspectRatio("9:16", "nova-video-k-3"), "9:16");
  assert.equal(normalizeNovartVideoAspectRatio("3:4", "nova-video-k-3"), "9:16");
  assert.equal(normalizeNovartVideoAspectRatio("1:1", "nova-video-k-3"), "16:9");
  assert.equal(normalizeNovartVideoAspectRatio("3:4", "nova-video-s-2-pro"), "3:4");

  assert.equal(normalizeNovartVideoResolution("720p", "nova-video-k-3"), "720p");
  assert.equal(normalizeNovartVideoResolution("1080p", "nova-video-k-3"), "1080p");
  assert.equal(normalizeNovartVideoResolution("4k", "nova-video-k-3"), "1080p");

  assert.equal(normalizeNovartVideoDuration(3, "nova-video-k-3"), "3s");
  assert.equal(normalizeNovartVideoDuration(1, "nova-video-k-3"), "3s");
  assert.equal(normalizeNovartVideoDuration(20, "nova-video-k-3"), "15s");
  assert.equal(normalizeNovartVideoDuration(3, "nova-video-s-2-pro"), "4s");

  assert.deepEqual(
    buildNovartVideoRequestBody({
      model: "nova-video-k-3",
      prompt: "Smooth transition",
      firstFrameDataUri: "data:image/jpeg;base64,AAA",
      lastFrameDataUri: "data:image/png;base64,BBB",
      aspectRatio: "3:4",
      durationSeconds: 3,
      resolution: "4k",
      generateAudio: true
    }),
    {
      model: "nova-video-k-3",
      prompt: "Smooth transition",
      reference_images: ["data:image/jpeg;base64,AAA", "data:image/png;base64,BBB"],
      duration: "3s",
      resolution: "1080p",
      aspect_ratio: "9:16",
      generate_audio: true
    }
  );
});

test("Novart video helpers extract taskId, resolve video URLs, and scope download auth headers", () => {
  assert.equal(extractNovartVideoTaskId({ ok: true, data: { task_id: "vid_123" } }), "vid_123");
  assert.equal(extractNovartVideoTaskId({ id: "vid_456" }), "vid_456");

  assert.equal(
    extractNovartVideoUrl(
      { data: [{ url: "/v1/files/videos/vid_123/results/0/content" }] },
      "https://www.novartstudio.art/v1"
    ),
    "https://www.novartstudio.art/v1/files/videos/vid_123/results/0/content"
  );

  assert.equal(
    extractNovartVideoUrl(
      {
        results: [
          {
            download_url: "https://www.novartstudio.art/v1/files/videos/vid_123/results/0/content",
            signed_download_url: "https://cdn.example/signed.mp4?sig=abc"
          }
        ]
      },
      "https://www.novartstudio.art/v1"
    ),
    "https://cdn.example/signed.mp4?sig=abc"
  );

  const env = {
    KLING_API_BASE_URL: "https://www.novartstudio.art/v1",
    IMAGE_API_KEY: "nova_key"
  };
  assert.deepEqual(
    getNovartDownloadHeaders("https://www.novartstudio.art/v1/files/videos/vid_123/results/0/content", env),
    { Authorization: "Bearer nova_key" }
  );
  assert.deepEqual(
    getNovartDownloadHeaders("https://cdn.example/signed.mp4?sig=abc", env),
    {}
  );
});

test("Novart video polling handles in-progress status, /results fallback, and terminal failures", async () => {
  const cfg = {
    baseUrl: "https://www.novartstudio.art/v1",
    apiKey: "nova_key",
    model: "nova-video-k-3",
    generateAudio: true
  };

  let calls = 0;
  const mockFetch: typeof fetch = async (input) => {
    const url = String(input);
    calls += 1;
    if (calls === 1) {
      return new Response(
        JSON.stringify({ ok: true, data: { status: "running", url: "https://www.novartstudio.art/v1/videos/t1" } }),
        { status: 200 }
      );
    }
    if (url.endsWith("/videos/t1")) {
      return new Response(JSON.stringify({ ok: true, data: { status: "succeeded" } }), { status: 200 });
    }
    if (url.endsWith("/videos/t1/results")) {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            results: [{ download_url: "/v1/files/videos/t1/results/0/content" }]
          }
        }),
        { status: 200 }
      );
    }
    return new Response("not found", { status: 404 });
  };

  const finalUrl = await pollNovartVideoTask("t1", {
    config: cfg,
    fetchImpl: mockFetch,
    sleepImpl: async () => {},
    attempts: 5,
    intervalMs: 1
  });
  assert.equal(finalUrl, "https://www.novartstudio.art/v1/files/videos/t1/results/0/content");

  const failCheck = await checkNovartVideoTaskOnce("t2", {
    config: cfg,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ ok: true, data: { status: "failed", error: { message: "moderation rejected" } } }),
        { status: 200 }
      )
  });
  assert.deepEqual(failCheck, { status: "failed", error: "moderation rejected" });
});
