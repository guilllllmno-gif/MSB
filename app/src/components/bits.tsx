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

export function Pill({ tone = "grey", dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  const [bg, fg, bd] = TONE[tone];
  return (
    <span
      style={{ background: bg, color: fg, borderColor: bd }}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap"
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />}
      {children}
    </span>
  );
}

export function RiskBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const [bg, fg] = TONE[tone];
  return (
    <span style={{ background: bg, color: fg }} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold">
      {children}
    </span>
  );
}

// circular score ring
export function RingScore({ score, size = 64 }: { score: number; size?: number }) {
  const color = score >= 70 ? "var(--danger)" : score >= 40 ? "var(--warning)" : "var(--success)";
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${color} ${score}%, var(--secondary) 0)` }}
    >
      <div className="absolute rounded-full bg-card" style={{ inset: 6 }} />
      <span className="relative text-[19px] font-extrabold tnum">{score}</span>
    </div>
  );
}

export function ExposureBars({ rows }: { rows: { label: string; pct: number; tone: Tone }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2.5 text-[11.5px]">
          <span className="w-20 shrink-0 text-muted-foreground">{r.label}</span>
          <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full" style={{ width: `${r.pct}%`, background: TONE[r.tone][1] }} />
          </span>
          <span className="w-9 text-right font-bold tnum text-muted-foreground">{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function StatTile({ icon, label, value, foot, tone = "blue" }: { icon: ReactNode; label: string; value: ReactNode; foot?: ReactNode; tone?: Tone }) {
  const [bg, fg] = TONE[tone];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: bg, color: fg }}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight tnum">{value}</div>
      {foot && <div className="mt-1 text-[11.5px] text-muted-foreground">{foot}</div>}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12px]">{children}</span>;
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[13.5px] font-semibold">{children}</div>
    </div>
  );
}
