import Navbar from "@/app/components/Navbar";
import { getServerUser } from "@/lib/auth/session";

// Session-aware shell for the signed-in surfaces (home workspace, job pages).
// Reading the session lives here, not in the root layout, so every route
// outside this group (auth pages, library) can stay statically rendered.
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getServerUser();

  return (
    <>
      <Navbar initialUser={user} />
      {children}
    </>
  );
}
