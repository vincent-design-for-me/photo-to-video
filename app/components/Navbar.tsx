"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import type { AuthUser } from "@/lib/auth/session";

type NavbarProps = {
  initialUser?: AuthUser | null;
};

export default function Navbar({ initialUser = null }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: sessionData, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});

  // Derived during render rather than mirrored into state, so the right header
  // is there on the first paint: the server-provided user covers the moment
  // before the client session resolves, then the client session takes over.
  const sessionUser = sessionData?.user;
  const user: AuthUser | null = isPending
    ? initialUser
    : sessionUser
      ? { id: sessionUser.id, email: sessionUser.email, name: sessionUser.name }
      : null;
  const signedIn = Boolean(user);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Move slider to the active nav item
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const active = pill.querySelector<HTMLElement>("a[aria-current='page']");
    if (!active) { setSliderStyle({ opacity: 0 }); return; }
    const pillRect = pill.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setSliderStyle({
      width: activeRect.width,
      transform: `translateX(${activeRect.left - pillRect.left - 4}px)`,
      opacity: 1,
    });
  }, [pathname, signedIn]);

  // The unauthenticated marketing landing page renders its own floating pill navigation.
  if (pathname === "/" && !user) return null;

  // Light-editorial studio surfaces (authenticated workspace) always use dark-ink header.
  const scrolled = pathname === "/";

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "?";

  async function handleSignOut() {
    await authClient.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/library", label: "Library" },
  ];

  return (
    <>
      <header className={`site-header${scrolled ? " site-header--scrolled" : ""}`}>
        <Link href="/" className="logo">Photo to Video</Link>
        <div className="nav-pill" ref={pillRef}>
          <span className="nav-pill-slider" style={sliderStyle} />
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
        {user ? (
          <div className="user-menu" ref={menuRef}>
            <button className="user-avatar" onClick={() => setOpen(!open)}>{initials}</button>
            {open && (
              <div className="user-dropdown">
                <div className="user-dropdown-email">{user.email}</div>
                <Link href="/" onClick={() => setOpen(false)}>My Videos</Link>
                <button className="danger" onClick={handleSignOut}>Sign Out</button>
              </div>
            )}
          </div>
        ) : null}
      </header>
    </>
  );
}
