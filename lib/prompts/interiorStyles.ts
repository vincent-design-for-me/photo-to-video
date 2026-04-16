export type InteriorStyleId =
  | "minimalist-calm"
  | "modern-luxury"
  | "japandi"
  | "industrial-soft-loft"
  | "cozy-warm-retreat"
  | "futuristic-clean"
  | "boutique-hotel-style"
  | "wabi-sabi-organic";

export type InteriorStylePrompt = {
  id: InteriorStyleId;
  name: string;
  description: string;
  styleDefinition: string;
  imagePrompt: string;
};

export const IMAGE_PROMPT_SYSTEM = `You are an expert interior designer and AI image prompt engineer.

Your task is to analyze an uploaded interior image and generate a high-quality Nano Banana prompt that redesigns the same space.

STRICT RULES:
- Do NOT change, replace, or alter any human subject. Preserve identity, face, body, and pose exactly.
- Do NOT change the room layout. Keep walls, windows, doors, and spatial structure identical.
- Do NOT move key furniture positions, especially the bed, desk, or major objects.
- Only modify interior design elements: materials, textures, finishes, lighting, furniture styling, decor.
- The output must feel like the SAME room, redesigned, not a different space.

OUTPUT FORMAT:
1. Concept Title, short and compelling
2. Design Direction, 1-2 concise lines
3. Nano Banana Prompt, detailed, cinematic, production-ready

PROMPT REQUIREMENTS:
- Be highly specific with materials, such as light oak wood, matte plaster, linen upholstery.
- Define lighting: temperature, direction, softness.
- Include styling details: bedding layers, decor, objects.
- Include mood and atmosphere.
- Include camera feel: lens, framing, depth, photography style.
- Keep it concise but rich, with no fluff.

STYLE ADAPTATION:
Apply the requested design style by adjusting:
- Color palette
- Materials
- Furniture finishes
- Lighting mood
- Decor language

Always ensure the design is cohesive and realistic.`;

type StyleDefinitionInput = {
  id: InteriorStyleId;
  name: string;
  description: string;
  styleDefinition: string;
};

const STYLE_DEFINITIONS: StyleDefinitionInput[] = [
  {
    id: "minimalist-calm",
    name: "Minimalist Calm",
    description: "Soft whites, warm textures, serene hotel vibe",
    styleDefinition:
      "Clean, uncluttered space with soft whites, minimal decor, hidden storage, smooth surfaces, and diffused natural light. Palette includes white, cream, and light grey. Focus on simplicity and negative space."
  },
  {
    id: "modern-luxury",
    name: "Modern Luxury",
    description: "Marble, gold accents, layered lighting",
    styleDefinition:
      "High-end materials such as marble, velvet, and brass. Layered lighting, rich textures, and a hotel-like finish. Palette includes taupe, gold, cream, and dark wood."
  },
  {
    id: "japandi",
    name: "Japandi",
    description: "Japanese + Scandinavian, warm wood + simplicity",
    styleDefinition:
      "Fusion of Japanese minimalism and Scandinavian warmth. Light wood, neutral tones, linen textures, and calm, balanced compositions. Emphasis on craftsmanship and simplicity."
  },
  {
    id: "industrial-soft-loft",
    name: "Industrial Soft Loft",
    description: "Concrete tones, black accents, raw textures",
    styleDefinition:
      "Raw materials like concrete, metal, and dark wood balanced with soft textiles. Neutral tones with black accents and moody lighting."
  },
  {
    id: "cozy-warm-retreat",
    name: "Cozy Warm Retreat",
    description: "Beige, linen, soft lighting, inviting feel",
    styleDefinition:
      "Soft textures, warm tones, layered fabrics, and ambient lighting. Inviting and comfortable atmosphere with beige, cream, and earth tones."
  },
  {
    id: "futuristic-clean",
    name: "Futuristic Clean",
    description: "Sleek surfaces, hidden lighting, cool tones",
    styleDefinition:
      "Sleek, minimal surfaces with integrated lighting, glossy finishes, and cool tones. High-tech, clean, and uncluttered environment."
  },
  {
    id: "boutique-hotel-style",
    name: "Boutique Hotel Style",
    description: "Rich fabrics, statement headboard, ambient lighting",
    styleDefinition:
      "Curated, stylish, and slightly dramatic. Rich textures, layered decor, statement lighting, and personality-driven design."
  },
  {
    id: "wabi-sabi-organic",
    name: "Wabi-Sabi Organic",
    description: "Raw textures, muted tones, handmade elements",
    styleDefinition:
      "Imperfect, natural beauty with raw textures, muted tones, handmade elements, and organic forms. Calm and grounded atmosphere."
  }
];

export const INTERIOR_STYLE_PROMPTS: InteriorStylePrompt[] = STYLE_DEFINITIONS.map((style) => ({
  ...style,
  imagePrompt: buildImagePrompt(style)
}));

export const DEFAULT_INTERIOR_STYLE_ID: InteriorStyleId = "minimalist-calm";

export function getInteriorStylePrompt(styleId: string | undefined): InteriorStylePrompt {
  return (
    INTERIOR_STYLE_PROMPTS.find((style) => style.id === styleId) ??
    INTERIOR_STYLE_PROMPTS.find((style) => style.id === DEFAULT_INTERIOR_STYLE_ID) ??
    INTERIOR_STYLE_PROMPTS[0]
  );
}

function buildImagePrompt(style: StyleDefinitionInput): string {
  return `${IMAGE_PROMPT_SYSTEM}

STYLE VARIABLE INPUT
Style: ${style.name}

Style Definition:
${style.styleDefinition}`;
}

export function buildImagePromptForStyle(styleId: string): string {
  const style = getInteriorStylePrompt(styleId);
  return `${IMAGE_PROMPT_SYSTEM}

STYLE VARIABLE INPUT
Style: ${style.name}

Style Definition:
${style.styleDefinition}`;
}
