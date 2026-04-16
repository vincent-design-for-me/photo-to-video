# Nano Banana Kling Automator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that turns uploaded interior photos into an automated multi-clip video workflow using Nano Banana image generation, Kling image-to-video generation, and FFmpeg post-production.

**Architecture:** A Next.js App Router app provides the upload UI, job detail page, and API routes. Server-side job orchestration stores files under `.data/jobs`, calls provider adapters for Gemini/Nano Banana and Kling, then runs an FFmpeg timeline renderer. Missing API keys use explicit mock providers so the UI and pipeline can be tested before credentials are added.

**Tech Stack:** Next.js, React, TypeScript, Node test runner, Google Gemini REST API, Kling-compatible HTTP API, FFmpeg CLI.

---

## File Structure

- `app/page.tsx`: Upload and configuration surface for creators.
- `app/jobs/[id]/page.tsx`: Job status page with step timeline, generated assets, and final download.
- `app/api/jobs/route.ts`: Creates jobs from uploaded images.
- `app/api/jobs/[id]/route.ts`: Reads job state.
- `app/api/jobs/[id]/run/route.ts`: Starts the async workflow.
- `app/api/jobs/[id]/download/route.ts`: Streams final MP4.
- `lib/jobs/store.ts`: Local filesystem job persistence.
- `lib/jobs/workflow.ts`: Orchestrates Nano Banana, Kling, and rendering.
- `lib/providers/nanoBanana.ts`: Gemini image generation adapter with mock fallback.
- `lib/providers/kling.ts`: Kling image-to-video adapter with mock fallback.
- `lib/video/timeline.ts`: Deterministic clip and transition planning.
- `lib/video/ffmpeg.ts`: FFmpeg renderer and placeholder clip generation.
- `test/timeline.test.ts`: Timeline behavior tests.
- `test/prompts.test.ts`: Prompt/config tests.

## Chunk 1: Core Rules

- [ ] Write failing tests for timeline duration and prompt constraints.
- [ ] Run `npm test` and verify the tests fail before implementation.
- [ ] Implement timeline and prompt builders.
- [ ] Run `npm test` and verify green.

## Chunk 2: Workflow Backend

- [ ] Implement filesystem job store.
- [ ] Implement Nano Banana and Kling adapters.
- [ ] Implement FFmpeg renderer with deterministic fallbacks.
- [ ] Add API routes to create, inspect, run, and download jobs.

## Chunk 3: Product UI

- [ ] Build upload workspace with fixed automation settings.
- [ ] Build job detail page with polling and status timeline.
- [ ] Add clear setup guidance for required API keys.
- [ ] Verify build and local browser flow.
