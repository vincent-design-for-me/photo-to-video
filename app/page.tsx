"use client";

import { AuthenticatedHome } from "./components/home/AuthenticatedHome";
import { LandingPage } from "./components/home/landing/LandingPage";
import { useAuthStatus } from "./components/home/useAuthStatus";

export default function HomePage() {
  const isAuthenticated = useAuthStatus();

  // Wait for the auth check before rendering anything.
  if (isAuthenticated === null) return null;

  return isAuthenticated ? <AuthenticatedHome /> : <LandingPage />;
}
