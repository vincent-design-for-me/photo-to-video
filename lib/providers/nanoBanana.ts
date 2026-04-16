import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildGeminiGenerateContentUrl, extractGeminiInlineImageData, getImageGenerationConfig, getLLMConfig, readGeminiJsonResponse } from "./geminiCompat";

type GenerateInteriorFrameInput = {
  jobId: string;
  sourceImagePath: string;
  prompt: string;
  aspectRatio: string;
  outputPath: string;
};

export async function generateInteriorFrame(input: GenerateInteriorFrameInput): Promise<string> {
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  const config = getImageGenerationConfig();

  if (!config.apiKey) {
    await copyFile(input.sourceImagePath, input.outputPath);
    return input.outputPath;
  }

  const imageData = await readFile(input.sourceImagePath);
  const mimeType = inferMimeType(input.sourceImagePath);

  if (config.baseUrl) {
    if (config.format !== "gemini-native") {
      throw new Error(`Unsupported image API format "${config.format}". Set IMAGE_API_FORMAT=gemini-native for this provider.`);
    }

    const imageUrl = buildGeminiGenerateContentUrl(config.baseUrl, config.model);
    const response = await fetch(imageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey ?? ""
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: input.prompt },
              { inlineData: { mimeType, data: imageData.toString("base64") } }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: input.aspectRatio,
            novartResolution: "2k"
          }
        }
      })
    });

    const data = extractGeminiInlineImageData(await readGeminiJsonResponse(response));
    if (!data) {
      throw new Error("Third-party Gemini endpoint did not return an inline image");
    }

    await writeFile(input.outputPath, Buffer.from(data, "base64"));
    return input.outputPath;
  }

  const { GoogleGenAI, Modality } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  const response = await ai.models.generateContent({
    model: config.model,
    contents: [
      {
        role: "user",
        parts: [
          { text: `${input.prompt} Output aspect ratio: ${input.aspectRatio}.` },
          { inlineData: { mimeType, data: imageData.toString("base64") } }
        ]
      }
    ],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT]
    }
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => "inlineData" in part);
  const data = imagePart && "inlineData" in imagePart ? imagePart.inlineData?.data : undefined;

  if (!data) {
    throw new Error("Nano Banana did not return an image");
  }

  await writeFile(input.outputPath, Buffer.from(data, "base64"));
  return input.outputPath;
}

type GenerateNanoBananaPromptInput = {
  sourceImagePath: string;
  stylePrompt: string;
};

export async function generateNanoBananaPromptForImage(input: GenerateNanoBananaPromptInput): Promise<string> {
  const imageData = await readFile(input.sourceImagePath);
  const mimeType = inferMimeType(input.sourceImagePath);
  const base64Data = imageData.toString("base64");

  const llm = getLLMConfig();

  if (llm) {
    // Use OpenAI-compatible LLM API for text prompt generation
    const response = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: input.stylePrompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Data}` }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LLM prompt generation failed (${response.status}): ${body.slice(0, 400)}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const rawText = data.choices?.[0]?.message?.content ?? "";
    return extractNanoBananaPrompt(rawText);
  }

  // Fallback: no LLM configured, return the style prompt as-is
  return input.stylePrompt;
}

function extractNanoBananaPrompt(text: string): string {
  const patterns = [
    /3\.\s*Nano Banana Prompt[:\s]+([^]+)/i,
    /Nano Banana Prompt[:\s]+([^]+)/i,
    /3\.\s+(.+)/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return text.trim();
}

function inferMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
