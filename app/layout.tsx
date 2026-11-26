import type { Metadata } from "next";
import { EB_Garamond, Instrument_Serif, Inter } from "next/font/google";
import "./styles.css";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-display",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Photo to Video — AI Interior Video Studio",
  description: "Turn room photos into cinematic AI-restyled property videos in minutes."
};

// Keep this layout free of request-time data (cookies, headers, session):
// anything dynamic here opts every route in the app out of static rendering.
// Session-aware chrome lives in app/(app)/layout.tsx.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${ebGaramond.variable} ${inter.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
