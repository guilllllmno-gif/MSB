import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { Button } from "@heroui/react";
import { Moon, Sun } from "lucide-react";
import { TONE, type Tone } from "@/lib/data";

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

// mono = 中性灰头像(主体 / 商户头像不承载状态,统一灰,避免列表里一排彩色圆点抢视觉)
export function Initials({ p, size = 24, mono = false }: { p: { i: string; c: string }; size?: number; mono?: boolean }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold" style={{ width: size, height: size, fontSize: size * 0.42, background: mono ? "var(--track)" : p.c, color: mono ? "var(--text-2)" : "#fff" }}>{p.i}</span>;
}

// theme switch for the app header — guards against pre-mount theme mismatch
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // 首帧 resolvedTheme 为 undefined → 默认 Moon,主题解析后自动纠正(SPA 无 SSR,无需 mounted 守卫)
  const dark = resolvedTheme === "dark";
  return (
    <Button isIconOnly size="sm" variant="light" aria-label="切换深色模式"
      onPress={() => setTheme(dark ? "light" : "dark")}>
      {dark
        ? <Sun className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} />
        : <Moon className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} />}
    </Button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">{children}</div>;
}
export function Mono({ children }: { children: ReactNode }) { return <span className="text-[12px]">{children}</span>; }
export function KvRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2 text-[12.5px]"><span className="text-default-500">{label}</span><span className="text-right font-semibold">{children}</span></div>;
}
