import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Button } from "@heroui/react";
import { LayoutDashboard, Bell, Search, ListChecks, SlidersHorizontal, Shield, FolderOpen, FileText, Clock, Settings, ChevronDown } from "lucide-react";
import { Initials } from "./bits";

type Item = { to: string; label: string; icon: typeof Bell; tag?: string };
const NAV: ({ group: string } | Item)[] = [
  { to: "/dashboard", label: "风控仪表盘", icon: LayoutDashboard },
  { group: "监控运营" },
  { to: "/alerts", label: "交易警报", icon: Bell, tag: "128" },
  { to: "/monitoring", label: "事中监控", icon: Search, tag: "10" },
  { group: "检测策略" },
  { to: "/rules", label: "监控规则", icon: ListChecks },
  { to: "/strategy", label: "全局策略", icon: SlidersHorizontal },
  { group: "治理与合规" },
  { to: "/lists", label: "名单管理", icon: Shield },
  { to: "/cases", label: "案件管理", icon: FolderOpen },
  { to: "/reports", label: "报告报送", icon: FileText },
  { to: "/audit", label: "审计日志", icon: Clock },
];

export function Shell({ crumb, children }: { crumb: string[]; children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--page)]">
      <aside className="flex w-[236px] shrink-0 flex-col overflow-y-auto border-r border-divider bg-content1">
        <div className="flex h-14 items-center gap-2.5 border-b border-divider px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,var(--brand),#4f8ef7)" }}>F</div>
          <div className="text-[15px] font-bold tracking-tight">Future<span style={{ color: "var(--brand)" }}>Pay</span>CA</div>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.map((n, i) =>
            "group" in n ? (
              <div key={i} className="px-2.5 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-default-400">{n.group}</div>
            ) : (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) => `flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-colors ${isActive ? "font-semibold" : "text-default-600 hover:bg-default-100"}`}
                style={({ isActive }) => (isActive ? { background: "var(--brand-soft)", color: "var(--brand)" } : undefined)}>
                <n.icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
                {n.label}
                {n.tag && <span className="ml-auto rounded-full bg-default-100 px-[7px] py-px text-[10.5px] font-bold text-default-500">{n.tag}</span>}
              </NavLink>
            )
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-divider bg-content1 px-7">
          <div className="flex items-center gap-1.5 text-[13px] text-default-500">
            {crumb.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-default-300">/</span>}
                <span className={i === crumb.length - 1 ? "font-semibold text-foreground" : ""}>{c}</span>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <Button size="sm" variant="bordered" endContent={<ChevronDown className="h-3.5 w-3.5" />}>风控 · L1</Button>
            <Button isIconOnly size="sm" variant="light" className="relative"><Bell className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} /><span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-content1" style={{ background: "var(--danger)" }} /></Button>
            <Button isIconOnly size="sm" variant="light"><Settings className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} /></Button>
            <Initials p={{ i: "JL", c: "var(--brand)" }} size={32} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-7 py-6"><div className="mx-auto max-w-[1180px]">{children}</div></main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-[18px] flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-[820px] text-[13px] leading-relaxed text-default-500">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
