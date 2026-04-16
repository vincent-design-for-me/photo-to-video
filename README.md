# Interior Video Automator

Automated version of the Nano Banana -> Kling -> edit workflow for interior ad videos.

## What it does

1. Upload 1-6 interior photos.
2. Generate one upgraded commercial interior frame per photo with Nano Banana / Gemini.
3. Send each source/generated frame pair into a Kling Skill or image-to-video endpoint.
4. Build a vertical MP4 timeline with FFmpeg.

If API keys are missing, the app uses preview fallbacks so the UI and job flow can still be tested locally.

## Required API information

- `GEMINI_API_KEY`: Google Gemini API key for Nano Banana image generation.
- `GEMINI_API_BASE_URL`: optional third-party Gemini-compatible base URL.
- `GEMINI_IMAGE_MODEL`: defaults to `gemini-2.5-flash-image`.
- `KLING_PROVIDER`: set to `skill` for Kling API Skills, or `image2video` for the direct image-to-video endpoint.
- `KLING_API_KEY`: your Kling provider API key.
- `KLING_ACCESS_KEY` and `KLING_SECRET_KEY`: official-style Kling AK/SK credentials. Use these instead of `KLING_API_KEY` when your provider gives separate keys.
- `KLING_API_BASE_URL`: base URL for the Kling-compatible provider. For Kling's Beijing service, use `https://api-beijing.klingai.com`.
- `KLING_MODEL`: defaults to `video-3.0-omni` for Kling Video 3.0 Omni.
- `KLING_DURATION_SECONDS`: defaults to `3`.
- `KLING_RESOLUTION`: defaults to `1080p`.
- `KLING_NATIVE_AUDIO` and `KLING_AUDIO_SYNC`: default to `true`.
- `KLING_SKILL_EFFECT_SCENE`: the Skill/effect scene id from Kling's Skill API page.
- `KLING_SKILL_CREATE_PATH`: Skill task creation path. Defaults to `/v1/videos/effects`.
- `KLING_SKILL_STATUS_PATH`: Skill status path. Defaults to `/v1/videos/{task_id}`.
- `KLING_SKILL_REQUEST_TEMPLATE`: optional JSON body template if the selected Skill needs custom fields.
- `PUBLIC_ASSET_BASE_URL`: public URL base for frames sent to Kling.

Kling Skill templates can use these placeholders: `{{effectScene}}`, `{{firstFrameUrl}}`, `{{lastFrameUrl}}`, `{{prompt}}`, `{{clipSeconds}}`, and `{{aspectRatio}}`.

Kling providers differ in parameter names for first frame and last frame. The direct endpoint adapter sends `image`, `first_frame`, and `last_frame`; Skill mode sends a configurable JSON body from `lib/providers/klingSkill.ts`.

For Google's Gemini API, leave `GEMINI_API_BASE_URL` / `IMAGE_BASE_URL` blank and set only the API key and model. For third-party Gemini providers, set the base URL to the Gemini-compatible API root, for example `https://provider.example/v1beta`; do not use a website or dashboard URL such as `https://www.example.com`. The app calls `/models/{model}:generateContent` and sends both `Authorization: Bearer <key>` and `x-goog-api-key`.

## Kling JWT check

Kling official API authentication uses Access Key + Secret Key, not a single API key. Generate a short-lived JWT from `.env.local` with:

```bash
npm run kling:jwt
```

Paste the plain JWT into Kling's developer-platform JWT verifier. API requests use the full header printed by the command: `Authorization: Bearer <jwt>`.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm test
npm run build
```
