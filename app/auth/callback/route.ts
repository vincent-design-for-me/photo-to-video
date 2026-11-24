import { NextResponse } from "next/server";
import { canonicalizeAuthPath } from "@/lib/auth/paths";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = canonicalizeAuthPath(searchParams.get("next") ?? "/");
  return NextResponse.redirect(`${origin}${next}`);
}
