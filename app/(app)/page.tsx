import { AuthenticatedHome } from "@/app/components/home/AuthenticatedHome";
import { LandingPage } from "@/app/components/home/landing/LandingPage";
import { getServerUser } from "@/lib/auth/session";

// The server already knows who is signed in, so pick the view here instead of
// shipping an empty shell and waiting for a client-side session round-trip.
export default async function HomePage() {
  const user = await getServerUser();
  return user ? <AuthenticatedHome /> : <LandingPage />;
}
