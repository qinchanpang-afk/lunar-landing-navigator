/** Small scroll-effect building blocks for the landing page (no dependencies). All respect prefers-reduced-motion. */
import { useEffect, useRef, useState, type ReactNode } from "react";

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Fades/slides its children in the first time they enter the viewport. */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !("IntersectionObserver" in window)) return setShown(true);
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (setShown(true), io.disconnect())),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={`reveal ${shown ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** Counts from 0 to `to` when first visible. */
export function CountUp({ to, decimals = 0, suffix = "", ms = 1400 }: { to: number; decimals?: number; suffix?: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [v, setV] = useState(reducedMotion() ? to : 0);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let raf = 0;
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        setV(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => (io.disconnect(), cancelAnimationFrame(raf));
  }, [to, ms]);
  return (
    <span ref={ref}>
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Thin progress bar across the top showing how far the page is scrolled. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      setP(h > 0 ? scrollY / h : 0);
    };
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => (removeEventListener("scroll", on), removeEventListener("resize", on));
  }, []);
  return <div aria-hidden className="fixed left-0 top-0 z-30 h-[3px] bg-gradient-to-r from-sun via-amber-200 to-sky-400" style={{ width: `${p * 100}%` }} />;
}

/** 0 → 1 as the element travels through the viewport (0 when its top hits the bottom of the screen). */
export function useScrollProgress<T extends HTMLElement>(sticky = false) {
  const ref = useRef<T | null>(null);
  const [p, setP] = useState(sticky ? 0 : 0.5);
  useEffect(() => {
    let raf = 0;
    const calc = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const v = sticky ? -r.top / Math.max(1, r.height - innerHeight) : (innerHeight - r.top) / (innerHeight + r.height);
      setP(Math.min(1, Math.max(0, v)));
    };
    const on = () => (raf ||= requestAnimationFrame(calc));
    calc();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => (removeEventListener("scroll", on), removeEventListener("resize", on), cancelAnimationFrame(raf));
  }, [sticky]);
  return [ref, p] as const;
}

/** Horizontal ticker that drifts slowly and speeds up with the user's scrolling (direction follows the scroll). */
export function Ticker({ items }: { items: string[] }) {
  const track = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = track.current;
    if (!el || reducedMotion()) return;
    let x = 0, last = scrollY, boost = 0, raf = 0;
    const onScroll = () => {
      boost += (scrollY - last) * 0.6;
      last = scrollY;
    };
    const tick = () => {
      boost *= 0.92;
      x -= 0.45 + boost * 0.12;
      const w = el.scrollWidth / 2;
      if (w > 0) x = ((x % w) - w) % w;
      el.style.transform = `translate3d(${x}px,0,0)`;
      raf = requestAnimationFrame(tick);
    };
    addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => (removeEventListener("scroll", onScroll), cancelAnimationFrame(raf));
  }, []);
  const row = items.map((t, i) => (
    <span key={i} className="flex shrink-0 items-center gap-6 pr-6">
      <span className="whitespace-nowrap">{t}</span>
      <span className="text-sun/70">✦</span>
    </span>
  ));
  return (
    <div className="relative overflow-hidden border-y border-space-700 bg-space-900/60 py-3 text-sm text-slate-300 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div ref={track} className="flex w-max will-change-transform" aria-hidden>
        {row}
        {row}
      </div>
      <p className="sr-only">{items.join(". ")}</p>
    </div>
  );
}

/** Twinkling starfield canvas with a slight scroll parallax; pauses when off-screen. */
export function Starfield({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    let w = 0, h = 0, raf = 0, visible = true;
    const stars = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.3, s: Math.random() * 2 + 0.5, d: Math.random() * 0.6 + 0.2 }));
    const size = () => {
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const sy = scrollY;
      for (const s of stars) {
        const a = reducedMotion() ? 0.7 : 0.45 + 0.4 * Math.sin(t / 1000 * s.s + s.x * 20);
        const y = (((s.y * h - sy * s.d * 0.35) % h) + h) % h;
        ctx.globalAlpha = a;
        ctx.fillStyle = s.r > 1.2 ? "#ffe7a8" : "#cfe3ff";
        ctx.beginPath();
        ctx.arc(s.x * w, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visible && !reducedMotion()) raf = requestAnimationFrame(draw);
    };
    size();
    raf = requestAnimationFrame(draw);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(draw);
    });
    io.observe(c);
    addEventListener("resize", size);
    return () => (cancelAnimationFrame(raf), io.disconnect(), removeEventListener("resize", size));
  }, []);
  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
