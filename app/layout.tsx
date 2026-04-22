import type { Metadata } from "next";
import Navbar from "./components/Navbar";
import { createServerClient } from "@/lib/supabase/server";
import "./styles.css";

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
    <html lang="en">
      <body>
        <Navbar initialUser={user} />
        {children}
      </body>
    </html>
  );
}
