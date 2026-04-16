type ImageGenerationEnv = Record<string, string | undefined> & {
  GEMINI_API_BASE_URL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_IMAGE_MODEL?: string;
  GEMINI_API_FORMAT?: string;
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
  return {
    baseUrl: env.GEMINI_API_BASE_URL ?? env.IMAGE_BASE_URL,
    apiKey: env.GEMINI_API_KEY ?? env.IMAGE_API_KEY,
    model: env.GEMINI_IMAGE_MODEL ?? env.IMAGE_MODEL ?? "gemini-3-pro-image-preview",
    format: env.GEMINI_API_FORMAT ?? env.IMAGE_API_FORMAT ?? "gemini-native"
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
    throw new Error(`Gemini image generation failed (${response.status}): ${body.slice(0, 500)}`);
  }

  if (!contentType.toLowerCase().includes("json")) {
    throw new Error(
      `Gemini endpoint returned ${contentType || "an unknown content type"} instead of JSON. Check GEMINI_API_BASE_URL or IMAGE_BASE_URL; it must be an API root, not a website or dashboard page. Response preview: ${body.slice(0, 160)}`
    );
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`Gemini endpoint returned invalid JSON. Check GEMINI_API_BASE_URL. ${error instanceof Error ? error.message : ""}`);
  }
}
