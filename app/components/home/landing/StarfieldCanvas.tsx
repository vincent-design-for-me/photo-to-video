"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  speed: number;
  phase: number;
  vy: number;
  tint: string;
};

export function StarfieldCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const width = 974;
    const height = 340;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Deterministic seeded PRNG for subtle atmospheric dust/sparkle specks
    let seed = 4219;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const stars: Star[] = Array.from({ length: 64 }, () => ({
      x: rand() * width,
      y: rand() * height,
      r: 0.7 + rand() * 1.25,
      baseAlpha: 0.14 + rand() * 0.34,
      speed: 0.4 + rand() * 1.0,
      phase: rand() * Math.PI * 2,
      vy: 0.035 + rand() * 0.08,
      tint: rand() > 0.4 ? "41, 37, 36" : "180, 128, 72",
    }));

    let rafId = 0;

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = time * 0.001;

      for (const s of stars) {
        if (!prefersReduced) {
          s.y -= s.vy;
          if (s.y < -4) s.y = height + 4;
        }
        const edgeFadeX = Math.min(s.x / 120, (width - s.x) / 120, 1);
        const edgeFadeY = Math.min((height - s.y) / 90, 1);
        const twinkle = prefersReduced
          ? 1
          : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        const alpha = Math.max(0, s.baseAlpha * twinkle * edgeFadeX * edgeFadeY);

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.tint}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      if (!prefersReduced) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
