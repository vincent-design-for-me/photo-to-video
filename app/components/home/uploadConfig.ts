import { DEFAULT_INTERIOR_STYLE_ID, INTERIOR_STYLE_PROMPTS } from "@/lib/prompts/interiorStyles";

export { DEFAULT_INTERIOR_STYLE_ID };

export const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9" },
  { value: "1:1",  label: "1:1" },
  { value: "3:4",  label: "3:4" },
];

export const RESOLUTION_OPTIONS = [
  { value: "720p",  label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "4k",    label: "4K" },
];

export const STYLE_OPTIONS = INTERIOR_STYLE_PROMPTS.map(s => ({ value: s.id, label: s.name }));

export const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const COUNT_WORDS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
  "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];

export function photoCountLabel(n: number): string {
  const word = n <= 20 ? COUNT_WORDS[n] : String(n);
  return `${word} ${n === 1 ? "photo" : "photos"}`;
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
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}
