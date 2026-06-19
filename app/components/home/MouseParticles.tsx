"use client";

import { useEffect, useRef } from "react";

/** Emits decorative particles that trail the cursor across the app page. */
export function MouseParticles() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const particlesEl = containerRef.current;
    let lastParticle = 0;
    function spawnParticle(x: number, y: number) {
      if (!particlesEl) return;
      const rect = particlesEl.getBoundingClientRect();
      const p = document.createElement("div");
      p.className = "mouse-particle";
      const size = Math.random() * 20 + 8;
      const dx = (Math.random() - 0.5) * 140;
      const dy = Math.random() * 90 + 40;
      p.style.cssText = `width:${size}px;height:${size}px;left:${x - rect.left}px;top:${y - rect.top}px;--dx:${dx}px;--dy:${dy}px`;
      particlesEl.appendChild(p);
      setTimeout(() => p.remove(), 2800);
    }
    function onMouseMove(e: MouseEvent) {
      const now = Date.now();
      if (now - lastParticle > 12) {
        spawnParticle(e.clientX, e.clientY);
        spawnParticle(e.clientX, e.clientY);
        lastParticle = now;
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return <div ref={containerRef} id="mouse-particles" aria-hidden="true" />;
}
