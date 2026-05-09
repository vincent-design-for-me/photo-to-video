"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type NavbarProps = {
  initialUser?: User | null;
};

export default function Navbar({ initialUser = null }: NavbarProps) {
  const supabaseRef = useRef(createClient());
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(initialUser);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    supabaseRef.current.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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
  }, [pathname, user]);

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (pathname !== "/") { setScrolled(false); return; }
    function onScroll() {
      const target = document.getElementById("how-it-works");
      if (!target) return;
      setScrolled(target.getBoundingClientRect().top <= 70);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password");
  if (isAuth) return null;

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "?";

  async function handleSignOut() {
    await supabaseRef.current.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navItems = [
    { href: "/", label: "Home" },
    ...(user ? [{ href: "/history", label: "History" }] : []),
  ];

  return (
    <>
      <header className={`site-header${scrolled ? " site-header--scrolled" : ""}`}>
        <a href="/" className="logo">Photo to Video</a>
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
                <Link href="/history" onClick={() => setOpen(false)}>My Videos</Link>
                <button className="danger" onClick={handleSignOut}>Sign Out</button>
              </div>
            )}
          </div>
        ) : null}
      </header>
    </>
  );
}
