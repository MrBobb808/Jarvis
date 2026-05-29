"use client";

import { useEffect, useRef } from "react";
import type { JarvisState } from "@/lib/types";

interface Props {
  state: JarvisState;
  level: number; // 0..1 live mic level
  onClick?: () => void;
  size?: number;
}

const PALETTES: Record<JarvisState, { core: string; ring: string; glow: string }> = {
  idle: { core: "#38bdf8", ring: "#22d3ee", glow: "rgba(56,189,248,0.55)" },
  listening: { core: "#34d399", ring: "#22d3ee", glow: "rgba(45,212,191,0.65)" },
  thinking: { core: "#818cf8", ring: "#a78bfa", glow: "rgba(129,140,248,0.6)" },
  speaking: { core: "#38bdf8", ring: "#7dd3fc", glow: "rgba(56,189,248,0.7)" },
  error: { core: "#f87171", ring: "#fb7185", glow: "rgba(248,113,113,0.6)" },
};

/**
 * Arc-reactor style voice orb. Pure canvas so it can react fluidly to the
 * assistant's state and the live microphone level. Doubles as the push-to-talk
 * button.
 */
export function VoiceOrb({ state, level, onClick, size = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const base = size * 0.26;
    let raf = 0;
    let t = 0;
    let smooth = 0;

    const draw = () => {
      t += 0.016;
      const st = stateRef.current;
      const pal = PALETTES[st];
      smooth += (levelRef.current - smooth) * 0.2;

      // Animated energy depending on state.
      const pulse =
        st === "speaking"
          ? 0.5 + 0.5 * Math.abs(Math.sin(t * 6))
          : st === "thinking"
            ? 0.4 + 0.2 * Math.sin(t * 4)
            : st === "listening"
              ? Math.min(1, smooth * 1.2)
              : 0.25 + 0.1 * Math.sin(t * 1.6);

      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = "lighter";

      // Outer glow halo.
      const haloR = base * (1.6 + pulse * 0.5);
      const halo = ctx.createRadialGradient(cx, cy, base * 0.3, cx, cy, haloR);
      halo.addColorStop(0, pal.glow);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // Rotating HUD arcs.
      const arcs = [
        { r: base * 1.35, speed: 0.5, span: 1.1, width: 2 },
        { r: base * 1.18, speed: -0.8, span: 0.7, width: 1.5 },
        { r: base * 1.0, speed: st === "thinking" ? 2.4 : 1.0, span: 1.6, width: 2.5 },
      ];
      ctx.strokeStyle = pal.ring;
      arcs.forEach((a, i) => {
        ctx.globalAlpha = 0.7 - i * 0.12;
        ctx.lineWidth = a.width;
        const start = t * a.speed + i * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, a.r, start, start + a.span);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, a.r, start + Math.PI, start + Math.PI + a.span * 0.6);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Reactive listening ring.
      if (st === "listening") {
        ctx.strokeStyle = pal.core;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(cx, cy, base * (1.0 + smooth * 0.7), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Core sphere.
      const coreR = base * (0.7 + pulse * 0.18);
      const core = ctx.createRadialGradient(
        cx - coreR * 0.25,
        cy - coreR * 0.25,
        coreR * 0.1,
        cx,
        cy,
        coreR,
      );
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.35, pal.core);
      core.addColorStop(1, "rgba(2,6,23,0.2)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Inner ticks.
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 1;
      const ticks = 48;
      for (let i = 0; i < ticks; i++) {
        const ang = (i / ticks) * Math.PI * 2 + t * 0.2;
        const inner = base * 0.82;
        const outer = inner + 4 + (i % 4 === 0 ? 5 : 0) * pulse;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
        ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Talk to Jarvis"
      className="group relative flex items-center justify-center rounded-full outline-none transition-transform active:scale-95"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </button>
  );
}
