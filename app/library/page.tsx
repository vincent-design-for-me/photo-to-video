import type { Metadata } from "next";
import LibraryClient from "./LibraryClient";
import prompts from "@/data/prompts.json";

export const metadata: Metadata = {
  title: "Prompt Library — GPT-Image2 Prompt Gallery",
  description: "459+ reverse-engineered GPT-Image2 prompt cases — copyable, filterable, free to browse.",
};

export default function LibraryPage() {
  return <LibraryClient prompts={prompts} />;
}
