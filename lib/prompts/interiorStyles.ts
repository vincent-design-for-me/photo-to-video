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
  imagePrompt: string;
};

export const IMAGE_PROMPT_SYSTEM = `You are an interior redesign prompt generator.

TASK:
Analyze the uploaded interior image, identify the room type and visible contents, judge whether the scene contains clutter or unreasonable styling objects, then generate a production-ready image generation prompt for a professional interior rendering.

STRICT RULES:
- Preserve the exact room layout, major furniture positions, and architectural structure.
- Do NOT change the room layout, camera angle, walls, windows, doors, ceiling, floor, columns, built-in cabinetry, or any structural elements.
- Do NOT move walls, windows, doors, or any structural elements.
- Preserve major functional furniture in its original position, but upgrade its material, finish, color, and styling to match the selected interior style.
- Do NOT preserve clutter. Remove objects that are visually distracting, temporary, messy, low-quality, accidental, or unrelated to a professional interior design rendering.
- Treat these as clutter when they appear: cardboard boxes, plastic bags, loose cables, cleaning tools, laundry, trash, random containers, excessive tabletop items, mismatched ornaments, cheap decorative objects, personal items, and awkward small objects.
- If a decorative object supports the selected professional style, keep or upgrade it. If it looks arbitrary, excessive, stylistically inconsistent, or poorly placed, remove or replace it with minimal intentional styling.
- Only modify: materials, colors, textures, lighting, decor, window treatment, non-structural styling objects, and clutter cleanup.
- Apply ONLY the provided style variables. Do NOT invent new directions.

OUTPUT FORMAT (mandatory, in this exact order):
1. Concept Title
2. Design Direction (1 sentence)
3. Clutter Assessment (1 sentence naming what should be removed or stating "no clutter detected")
4. Nano Banana Prompt

The Nano Banana Prompt must follow this exact structure:
[Scene Lock] → [Clutter Removal & Styling Cleanup] → [Color Transformation] → [Furniture Upgrade] → [Textile Layering] → [Lighting System] → [Decor Styling] → [Window Treatment] → [Rendering Settings]

The Nano Banana Prompt is a direct image generation prompt. It must be:
- Visual and descriptive
- Production-ready (no meta-language, no instructions, only scene description)
- Adapted to the specific room type detected in the image`;

type StyleConfig = {
  id: InteriorStyleId;
  name: string;
  description: string;
  designDirection: string;
  color: string;
  furniture: string;
  textile: string;
  lighting: string;
  decor: string;
  window: string;
  render: string;
};

const STYLE_CONFIGS: StyleConfig[] = [
  {
    id: "minimalist-calm",
    name: "Minimalist Calm",
    description: "Soft whites, warm textures, serene hotel vibe",
    designDirection: "clean, serene space emphasizing negative space, pure materials, and diffused natural light",
    color: "Replace all warm or saturated tones with a pure, airy palette of crisp white, soft cream, and light grey. No color accents.",
    furniture: "Streamline all furniture to simple geometric forms with smooth matte or natural wood finishes. No visible hardware. Hidden storage where possible. Keep all positions exact.",
    textile: "Crisp white cotton or linen bedding. Single light grey or cream throw. Minimal solid-tone cushions. No patterns or textures.",
    lighting: "Diffused, even natural light. Recessed or hidden LED strips at 3500K. No decorative fixtures. One simple functional lamp if needed.",
    decor: "Maximum one or two objects per surface. Single-stem vase or small sculptural object only. One thin-framed abstract print or bare walls.",
    window: "Sheer white curtains, floor-length, to diffuse light evenly. No heavy drapes. No visible hardware.",
    render: "Balanced natural daylight, even exposure, no harsh shadows. Neutral color grading. 24mm lens, eye-level, ultra-clean editorial interior photography."
  },
  {
    id: "modern-luxury",
    name: "Modern Luxury",
    description: "Marble, gold accents, layered lighting",
    designDirection: "high-end, hotel-finish space with rich materials, warm gold accents, and dramatic layered lighting",
    color: "Rich base palette of warm taupe, cream, and charcoal. Marble white surfaces. Warm gold and brushed brass metal accents.",
    furniture: "Upgrade to high-gloss or velvet-finished furniture with brushed gold or brass hardware. Architectural, statement-piece profile. Keep all positions exact.",
    textile: "Velvet throw pillows in deep jewel tones. Silk-like layered sheets and plush duvet. Soft area rug with subtle woven texture.",
    lighting: "Layered lighting: statement pendant or chandelier, bedside sconces, warm LED strips at 2700K. Theatrical warmth with depth and shadow.",
    decor: "Sculptural decor, fresh flowers in tall vase, metallic objects, stacked art books. One large statement artwork in gold or dark frame.",
    window: "Floor-length heavy linen or velvet drapes in deep neutral or charcoal, layered with a sheer inner curtain.",
    render: "Golden hour soft light, warm cinematic color grading, shallow depth of field. 24mm lens, slightly low angle for drama. Editorial luxury interior photography."
  },
  {
    id: "japandi",
    name: "Japandi",
    description: "Japanese + Scandinavian, warm wood + simplicity",
    designDirection: "calm, balanced sanctuary using light oak, natural linen, and warm neutral tones with emphasis on craftsmanship and negative space",
    color: "Warm neutral palette of soft beige, muted taupe, off-white, and subtle charcoal accents. Slightly warm the floor tone through color grading.",
    furniture: "Light oak wood finishes throughout. Low-profile, horizontal lines. Clean edges, no visible hardware. Natural wood platform base extensions around key pieces. Keep all positions exact.",
    textile: "Off-white washed linen sheets, light taupe duvet, oversized pillows in muted earth tones. Woven jute or wool rug in warm beige under the bed, extending evenly outward.",
    lighting: "Warm diffused 2700K. Soft indirect LED strip behind headboard for ambient glow. Single sculptural ceramic table lamp in matte off-white.",
    decor: "One bonsai or ikebana-style plant. One neutral abstract artwork in thin black frame above the bed. Minimal, intentional placement. Emphasize negative space.",
    window: "Sheer off-white linen curtains layered behind existing blinds. Soft, diffused natural light. No heavy layering.",
    render: "Soft morning light, diffused and calm, with gentle shadows. 24mm lens, eye-level, balanced composition, natural depth, editorial interior photography."
  },
  {
    id: "industrial-soft-loft",
    name: "Industrial Soft Loft",
    description: "Concrete tones, black accents, raw textures",
    designDirection: "raw, urban loft with exposed materials and structural honesty, softened by warm textiles and ambient lighting",
    color: "Concrete grey, raw umber, charcoal, and matte black as base. Softened with warm white and aged dark walnut accents.",
    furniture: "Exposed raw materials: concrete surfaces, brushed steel frames, dark walnut shelving. Paired with soft upholstered seating in neutral tones. Industrial silhouette. Keep all positions exact.",
    textile: "Chunky knit or woven throw in charcoal or oatmeal. Linen or canvas cushions. Worn leather accent. Simple flat-weave rug in grey or matte black.",
    lighting: "Edison bulb pendants, industrial floor lamp, exposed-filament sconces. Warm 2700K. Creates strong, moody directional shadows.",
    decor: "Concrete planters, metal sculptures, black-and-white photography in raw black frames. Stacked books, small industrial objects on shelves.",
    window: "Black metal window frame treatment emphasized. Simple roller blind or unlined linen panel. Let structural frame remain visible.",
    render: "Moody interior light with strong directional shadows. Slight desaturation with warm highlights. 24mm lens, eye-level, gritty editorial interior photography."
  },
  {
    id: "cozy-warm-retreat",
    name: "Cozy Warm Retreat",
    description: "Beige, linen, soft lighting, inviting feel",
    designDirection: "soft, inviting retreat using warm woods, layered textiles, and multi-source ambient lighting",
    color: "Warm neutral palette of beige, cream, and soft taupe. Terracotta and caramel as accent tones. No cool or grey tones.",
    furniture: "Upgrade to plush, rounded, soft-textured finishes. Upholstered in warm fabric. Replace harsh or angular surfaces with warmer walnut-toned wood alternatives. Keep all positions exact.",
    textile: "Chunky knit throws, linen cushions in earthy tones like terracotta, caramel, and muted olive. Warm woven rug with subtle texture under the seating area.",
    lighting: "Warm ambient lighting at 2700K from multiple sources: floor lamp, table lamp with linen shade, and subtle LED backlighting. No harsh overhead light.",
    decor: "Ceramic vases, candles, and small indoor plant. Minimal neutral-toned artwork. Stacked books. Warm personal objects without clutter.",
    window: "Sheer beige or linen curtains to diffuse natural light into a warm, golden glow.",
    render: "Warm golden afternoon light, soft color grading, shallow depth of field. 24mm lens, eye-level, warm inviting editorial interior photography."
  },
  {
    id: "futuristic-clean",
    name: "Futuristic Clean",
    description: "Sleek surfaces, hidden lighting, cool tones",
    designDirection: "high-tech, monochromatic space with integrated lighting, sleek surfaces, and absolute visual silence",
    color: "Cool whites, matte concrete grey, and matte black. Subtle chrome accents. Strictly monochromatic, cold palette. No warmth.",
    furniture: "Sleek, geometric, minimal-profile furniture. Glossy white or matte concrete surfaces. Fully integrated or hidden storage. No visible hardware. Sharp, precise edges. Keep all positions exact.",
    textile: "Crisp white or light grey technical fabric. Absolutely minimal texture. Single flat pillow. Simple geometric rug in white or pale grey only.",
    lighting: "Integrated LED strips along edges and ceiling coves at 4500K cool white. No visible fixtures. Dramatic architectural light lines only.",
    decor: "One geometric sculptural object maximum. No plants or organic elements. Optionally one monochrome digital artwork, frameless.",
    window: "Motorized roller blind in matte white or grey. Completely flush and integrated. No visible mechanism or frame.",
    render: "Cool, bright, high-contrast lighting. Slight blue-white color grading. 24mm wide lens, slightly elevated angle. Ultra-clean futuristic interior photography."
  },
  {
    id: "boutique-hotel-style",
    name: "Boutique Hotel Style",
    description: "Rich fabrics, statement headboard, ambient lighting",
    designDirection: "curated, personality-driven space with rich materials, statement lighting, and layered decor that tells a story",
    color: "Deep, curated palette: charcoal, forest green, dusty rose, or navy base with brass and warm cream accents. Rich, saturated but controlled.",
    furniture: "Statement upholstered headboard in textured fabric. Rich dark wood side tables. Plush seating with personality. Mix of textures and finishes. Keep all positions exact.",
    textile: "Layered bedding with high-contrast duvet and accent pillows in velvet or boucle. Patterned or textured throw. Deep-toned area rug with subtle motif.",
    lighting: "Bedside pendant lamps or wall sconces at warm 2700K. Dimmer, moody atmosphere. Statement fixture as focal point.",
    decor: "Fresh flowers or sculptural greenery. Curated framed artwork. Styled tray with minimal objects on surfaces. Personality without clutter.",
    window: "Floor-length drapery in deep fabric, layered with sheer inner curtain. Creates drama and a sense of enclosure.",
    render: "Late afternoon warm, moody light. Cinematic shadow depth. Rich, deep color grading. 24mm lens, slightly low angle, editorial luxury hotel interior photography."
  },
  {
    id: "wabi-sabi-organic",
    name: "Wabi-Sabi Organic",
    description: "Raw textures, muted tones, handmade elements",
    designDirection: "quiet, grounded space celebrating imperfection, natural materials, and the beauty of organic form",
    color: "Muted, desaturated tones: clay, ash white, raw linen, sage grey-green, and earthy brown. Imperfect, organic color palette with no saturation.",
    furniture: "Handmade-feel furniture with visible wood grain, natural imperfection, and tactile texture. Raw wood, unglazed ceramic, and woven rattan elements. Slightly asymmetric but intentional. Keep all positions exact.",
    textile: "Undyed linen, rough-textured cotton, hand-woven throw in natural tan or off-white. Irregular pillow forms. Natural fiber rug in jute or seagrass.",
    lighting: "Soft natural window light as primary source. Paper lantern or handmade ceramic lamp at warm 2700K, low intensity. Organic shadow patterns on walls.",
    decor: "Dried botanicals, handmade ceramic vessels, a single sculptural branch or wabi plant. Imperfect handmade objects with soul. One raw-edge or unframed art piece.",
    window: "Unlined raw natural linen panel with raw hem. Allow natural light to filter unevenly. No metal hardware visible.",
    render: "Soft diffused natural light, slightly desaturated film-like color grading with subtle grain. 24mm lens, eye-level, quiet and contemplative editorial interior photography."
  }
];

function buildImagePrompt(style: StyleConfig): string {
  return `${IMAGE_PROMPT_SYSTEM}

---
STYLE VARIABLES (STRICTLY APPLY)

Style: ${style.name}

Design Direction:
${style.designDirection}

Color Transformation:
${style.color}

Furniture Upgrade:
${style.furniture}

Textile Layering:
${style.textile}

Lighting System:
${style.lighting}

Decor Styling:
${style.decor}

Window Treatment:
${style.window}

Rendering Settings:
${style.render}
---`;
}

export const INTERIOR_STYLE_PROMPTS: InteriorStylePrompt[] = STYLE_CONFIGS.map((style) => ({
  id: style.id,
  name: style.name,
  description: style.description,
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

export function buildImagePromptForStyle(styleId: string): string {
  return getInteriorStylePrompt(styleId).imagePrompt;
}

export const FULL_STRUCTURE_LOCK_PREAMBLE = `

---
CRITICAL STRUCTURE CONSTRAINTS (non-negotiable, override any conflicting instruction above):
- Preserve the EXACT camera angle, focal length, and framing of the input image. Do not re-compose, re-frame, or change perspective.
- Preserve the EXACT architectural shell: every wall, window, door, ceiling, floor, column, and built-in element stays in its original position, proportion, and orientation.
- Preserve the EXACT floor pattern, wall surfaces, and ceiling geometry. Only change their material/color finish, never their position or shape.
- Preserve EVERY piece of existing furniture in its EXACT original position. Do not move, rotate, swap, add, or remove furniture items.
- Allowed changes ONLY: materials, colors, textures, finishes, hardware, lighting fixtures, decor/styling objects, textiles, window treatments, and clutter removal.
- Forbidden: redesign, transform, reimagine, move windows or doors, change room shape, alter camera, add new architectural elements.`;

export const SHELL_LOCK_PREAMBLE = `

---
CRITICAL STRUCTURE CONSTRAINTS (non-negotiable, override any conflicting instruction above):
- Preserve the EXACT camera angle, focal length, and framing of the input image. Do not re-compose, re-frame, or change perspective.
- Preserve the EXACT architectural shell: every wall, window, door, ceiling, floor, and column stays in its original position, proportion, and orientation.
- Furniture may be refined, swapped, or repositioned per the user's instruction, but the architectural shell and camera MUST remain untouched.
- Forbidden: changing camera angle, moving walls/windows/doors, altering room shape, adding new architectural elements.`;
