"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_INTERIOR_STYLE_ID, INTERIOR_STYLE_PROMPTS } from "../lib/prompts/interiorStyles";

export default function HomePage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Creating the job...");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const createResponse = await fetch("/api/jobs", {
        method: "POST",
        body: formData
      });
      if (!createResponse.ok) {
        throw new Error(await createResponse.text());
      }

      const job = (await createResponse.json()) as { id: string };
      setMessage("Starting Nano Banana and Kling workflow...");

      await fetch(`/api/jobs/${job.id}/run`, { method: "POST" });
      router.push(`/jobs/${job.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create job");
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="intro">
        <div>
          <span className="eyebrow">Nano Banana + Kling + FFmpeg</span>
          <h1>Interior ad video machine.</h1>
          <p className="lede">
            Upload room photos. Generate polished AI design frames. Animate each frame into a short Kling shot.
            Assemble the full vertical video automatically.
          </p>
        </div>
        <div className="stack" aria-label="Workflow stages">
          <div className="stack-item"><strong>01</strong><span>Source images</span></div>
          <div className="stack-item"><strong>02</strong><span>Nano Banana frames</span></div>
          <div className="stack-item"><strong>03</strong><span>Kling three-second clips</span></div>
          <div className="stack-item"><strong>04</strong><span>FFmpeg final timeline</span></div>
        </div>
      </section>

      <section className="workspace">
        <form className="panel" onSubmit={submit}>
          <h2>Start a production run</h2>
          <p className="fineprint">
            Add up to six interior images. The first version uses fixed vertical video settings: 9:16,
            three seconds per shot, and the selected interior style prompt.
          </p>
          <div className="dropzone">
            <label className="label" htmlFor="images">Interior photos</label>
            <input
              id="images"
              className="file-input"
              name="images"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              required
            />
          </div>
          <fieldset className="style-options">
            <legend className="label">Image generation style</legend>
            {INTERIOR_STYLE_PROMPTS.map((style) => (
              <label className="style-option" key={style.id}>
                <input
                  type="radio"
                  name="styleId"
                  value={style.id}
                  defaultChecked={style.id === DEFAULT_INTERIOR_STYLE_ID}
                />
                <span>
                  <strong>{style.name}</strong>
                  <small>{style.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="actions">
            <button className="button" type="submit" disabled={busy}>
              {busy ? "Creating..." : "Generate video"}
            </button>
            <span className="fineprint">{message}</span>
          </div>
        </form>

        <section className="panel">
          <h3>Fixed automation settings</h3>
          <div className="config-grid">
            <div className="config-cell"><span className="label">Image model</span><span className="value">gemini-2.5-flash-image</span></div>
            <div className="config-cell"><span className="label">Video model</span><span className="value">Kling Video 3.0 Omni</span></div>
            <div className="config-cell"><span className="label">Clip length</span><span className="value">3 seconds</span></div>
            <div className="config-cell"><span className="label">Output</span><span className="value">1080p MP4</span></div>
            <div className="config-cell"><span className="label">Audio</span><span className="value">native sync</span></div>
          </div>
        </section>

        <section className="panel">
          <h3>API keys needed</h3>
          <p className="fineprint">
            Set <strong>GEMINI_API_KEY</strong> for Nano Banana image generation. Set <strong>KLING_API_KEY</strong>,
            <strong> KLING_API_BASE_URL</strong>, and a public asset uploader/base URL for real Kling generation.
            Without keys, the app runs in preview mode so the interface and job flow remain testable.
          </p>
        </section>
      </section>
    </main>
  );
}
