import type { Metadata } from "next";
import { EB_Garamond, Inter } from "next/font/google";
import Navbar from "./components/Navbar";
import { createServerClient } from "@/lib/supabase/server";
import "./styles.css";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Interior Video Automator",
  description: "Nano Banana to Kling automated interior video workflow"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${ebGaramond.variable} ${inter.variable}`}>
      <body>
        <Navbar initialUser={user} />
        {children}
      </body>
    </html>
  );
}
