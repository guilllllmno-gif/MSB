import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@heroui/react";
import { Moon, Sun } from "lucide-react";
import type { Tone } from "@/lib/data";

const TONE: Record<Tone, [string, string, string]> = {
  green: ["var(--success-bg)", "var(--success)", "var(--success-bd)"],
  amber: ["var(--warning-bg)", "var(--warning)", "var(--warning-bd)"],
  red: ["var(--danger-bg)", "var(--danger)", "var(--danger-bd)"],
  blue: ["var(--brand-soft)", "var(--brand)", "var(--brand-bd)"],
  violet: ["var(--violet-bg)", "var(--violet)", "var(--violet-bd)"],
  grey: ["var(--chip-bg)", "var(--chip-fg)", "var(--chip-bd)"],
};
export const toneVar = (t: Tone) => TONE[t][1];

// soft colored pill — matches the Figma status/severity chips (theme-independent)
export function Pill({ tone = "grey", dot = true, icon, children }: { tone?: Tone; dot?: boolean; icon?: ReactNode; children: ReactNode }) {
  const [bg, fg, bd] = TONE[tone];
  return (
    <span style={{ background: bg, color: fg, borderColor: bd }} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap">
      {icon ? <span className="flex items-center" style={{ color: fg }}>{icon}</span> : dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} /> : null}
      {children}
    </span>
  );
}

export function SoftChip({ children, net }: { children: ReactNode; net?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
      style={net ? { background: "var(--brand-softer)", color: "var(--brand)", borderColor: "var(--brand-bd)" } : { background: "var(--chip-bg)", color: "var(--chip-fg)", borderColor: "var(--chip-bd)" }}>
      {children}
    </span>
  );
}

export function RiskBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const [bg, fg] = TONE[tone];
  return <span style={{ background: bg, color: fg }} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold">{children}</span>;
}

export function Initials({ p, size = 24 }: { p: { i: string; c: string }; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.42, background: p.c }}>{p.i}</span>;
}

// theme switch for the app header — guards against pre-mount theme mismatch
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = resolvedTheme === "dark";
  return (
    <Button isIconOnly size="sm" variant="light" aria-label="切换深色模式"
      onPress={() => setTheme(dark ? "light" : "dark")}>
      {mounted && dark
        ? <Sun className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} />
        : <Moon className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} />}
    </Button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">{children}</div>;
}
export function Mono({ children }: { children: ReactNode }) { return <span className="font-mono text-[12px]">{children}</span>; }
export function KvRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2 text-[12.5px]"><span className="text-default-500">{label}</span><span className="text-right font-semibold">{children}</span></div>;
}
