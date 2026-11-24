import {
  DEFAULT_INTERIOR_STYLE_ID,
  INTERIOR_STYLE_PROMPTS,
  type InteriorStyleId,
} from "@/lib/prompts/interiorStyles";

export { DEFAULT_INTERIOR_STYLE_ID };

export const MAX_PHOTOS = 6;

export const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9", hint: "Landscape" },
  { value: "1:1", label: "1:1", hint: "Square" },
  { value: "3:4", label: "3:4", hint: "Portrait" },
] as const;

export const RESOLUTION_OPTIONS = [
  { value: "720p", label: "720p", hint: "Fast" },
  { value: "1080p", label: "1080p", hint: "HD" },
  { value: "4k", label: "4K", hint: "Ultra" },
] as const;

export const STYLE_PREVIEW_IMAGES: Record<InteriorStyleId, string> = {
  "minimalist-calm": "/gallery/MODERN MINIMALIST.png",
  "modern-luxury": "/gallery/Luxury Modern.png",
  "japandi": "/gallery/Japandi.png",
  "industrial-soft-loft": "/gallery/Contemporary.png",
  "cozy-warm-retreat": "/gallery/SCANDINAVIAN.png",
  "futuristic-clean": "/gallery/MODERN MINIMALIST.png",
  "boutique-hotel-style": "/gallery/Luxury Modern.png",
  "wabi-sabi-organic": "/gallery/wabi-sabi.png",
};

export type StyleCardOption = {
  id: InteriorStyleId;
  name: string;
  description: string;
  previewImage: string;
};

export const STYLE_CARDS: StyleCardOption[] = INTERIOR_STYLE_PROMPTS.map((s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  previewImage: STYLE_PREVIEW_IMAGES[s.id] ?? "/gallery/Japandi.png",
}));

export const STYLE_OPTIONS = INTERIOR_STYLE_PROMPTS.map((s) => ({
  value: s.id,
  label: s.name,
}));

export const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const COUNT_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

export function photoCountLabel(n: number): string {
  const word = n <= 20 ? COUNT_WORDS[n] : String(n);
  return `${word} ${n === 1 ? "photo" : "photos"}`;
}

export function estimateVideoMinutes(photoCount: number, resolution: string): string {
  if (photoCount <= 0) return "0 min";
  const basePerPhoto = resolution === "4k" ? 1.5 : 1;
  const total = Math.max(1, Math.round(photoCount * basePerPhoto));
  return total <= 1 ? "~1–2 min" : `~${total}–${total + 1} min`;
}

export function detectAspectRatio(width: number, height: number): string {
  if (width > height) return "16:9";
  if (height > width) return "3:4";
  return "1:1";
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
