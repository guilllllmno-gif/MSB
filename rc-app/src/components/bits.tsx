import type { ReactNode } from "react";
import type { Tone } from "@/lib/data";

const TONE: Record<Tone, [string, string, string]> = {
  green: ["var(--success-bg)", "var(--success)", "var(--success-bd)"],
  amber: ["var(--warning-bg)", "var(--warning)", "var(--warning-bd)"],
  red: ["var(--danger-bg)", "var(--danger)", "var(--danger-bd)"],
  blue: ["var(--brand-soft)", "var(--brand)", "#bcd4ff"],
  violet: ["var(--violet-bg)", "var(--violet)", "var(--violet-bd)"],
  grey: ["#f0f1f3", "#636c7b", "#e2e4e8"],
};
export const toneVar = (t: Tone) => TONE[t][1];

export function Pill({ tone = "grey", dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  const [bg, fg, bd] = TONE[tone];
  return (
    <span style={{ background: bg, color: fg, borderColor: bd }} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap">
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />}
      {children}
    </span>
  );
}

export function Chip({ children, net }: { children: ReactNode; net?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
      style={net ? { background: "var(--brand-softer)", color: "var(--brand)", borderColor: "#bcd4ff" } : { background: "#f3f4f6", color: "#636c7b", borderColor: "#e8eaed" }}>
      {children}
    </span>
  );
}

export function RiskBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const [bg, fg] = TONE[tone];
  return <span style={{ background: bg, color: fg }} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold">{children}</span>;
}

export function Avatar({ p, size = 24 }: { p: { i: string; c: string }; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.42, background: p.c }}>{p.i}</span>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</div>;
}
export function Mono({ children }: { children: ReactNode }) { return <span className="font-mono text-[12px]">{children}</span>; }
export function KV({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-2 text-[12.5px]"><span className="text-muted-foreground">{label}</span><span className="text-right font-semibold">{children}</span></div>;
}
