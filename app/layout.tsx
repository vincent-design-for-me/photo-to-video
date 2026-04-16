import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Interior Video Automator",
  description: "Nano Banana to Kling automated interior video workflow"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
