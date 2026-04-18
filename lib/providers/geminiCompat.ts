type ImageGenerationEnv = Record<string, string | undefined> & {
  IMAGE_BASE_URL?: string;
  IMAGE_API_KEY?: string;
  IMAGE_MODEL?: string;
  IMAGE_API_FORMAT?: string;
};

export type ImageGenerationConfig = {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  format: string;
};

export function buildGeminiGenerateContentUrl(baseUrl: string, model: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");

  if (trimmed.includes(":generateContent")) {
    return trimmed;
  }

  return `${trimmed}/models/${encodeURIComponent(model)}:generateContent`;
}

export function getImageGenerationConfig(env: ImageGenerationEnv = process.env): ImageGenerationConfig {
  if (!env.IMAGE_MODEL) {
    throw new Error("IMAGE_MODEL is not set. Add it to .env.local (e.g. IMAGE_MODEL=nova-image-2).");
  }
  return {
    baseUrl: env.IMAGE_BASE_URL,
    apiKey: env.IMAGE_API_KEY,
    model: env.IMAGE_MODEL,
    format: env.IMAGE_API_FORMAT ?? "gemini-native"
  };
}

export function extractGeminiInlineImageData(payload: unknown): string | undefined {
  const response = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { data?: string }; inline_data?: { data?: string } }>;
      };
    }>;
  };

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    if (data) return data;
  }

  return undefined;
}

export type LLMConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function getLLMConfig(env: Record<string, string | undefined> = process.env): LLMConfig | null {
  const baseUrl = env.LLM_BASE_URL;
  const apiKey = env.LLM_API_KEY;
  const model = env.LLM_MODEL ?? "gpt-5.4";
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model };
}

export async function readGeminiJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Image generation failed (${response.status}): ${body.slice(0, 500)}`);
  }

  if (!contentType.toLowerCase().includes("json")) {
    throw new Error(
      `Image endpoint returned ${contentType || "an unknown content type"} instead of JSON. Check IMAGE_BASE_URL; it must be an API root, not a website or dashboard page. Response preview: ${body.slice(0, 160)}`
    );
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`Image endpoint returned invalid JSON. Check IMAGE_BASE_URL. ${error instanceof Error ? error.message : ""}`);
  }
}
