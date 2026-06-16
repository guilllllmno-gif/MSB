import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Button } from "@heroui/react";
import { LayoutDashboard, Bell, Search, ListChecks, SlidersHorizontal, Shield, FolderOpen, FileText, Clock, ChevronDown, ChevronsLeft, ChevronsRight, HelpCircle, LogOut } from "lucide-react";
import { Initials, ThemeToggle } from "./bits";

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

export function Shell({ crumb, wide, children }: { crumb: string[]; wide?: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--page)]">
      <aside className={`flex shrink-0 flex-col overflow-y-auto overflow-x-hidden px-3 py-4 transition-[width] duration-300 ease-in-out ${collapsed ? "w-[78px]" : "w-[252px]"}`}>
        {/* brand + collapse toggle */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,var(--brand),#7aa9ff)" }}>F</div>
            <button onClick={() => setCollapsed(false)} aria-label="展开侧边栏" className="flex h-9 w-9 items-center justify-center rounded-xl text-default-400 transition-colors hover:bg-content1 hover:text-default-600"><ChevronsRight className="h-[18px] w-[18px]" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,var(--brand),#7aa9ff)" }}>F</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold leading-tight tracking-tight">Future<span style={{ color: "var(--brand)" }}>Pay</span>CA</div>
              <div className="truncate text-[11px] leading-tight text-default-400">风控控制台</div>
            </div>
            <button onClick={() => setCollapsed(true)} aria-label="收起侧边栏" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-default-400 transition-colors hover:bg-content1 hover:text-default-600"><ChevronsLeft className="h-[18px] w-[18px]" /></button>
          </div>
        )}

        <nav className="mt-4 flex flex-1 flex-col gap-0.5">
          {NAV.map((n, i) =>
            "group" in n ? (
              collapsed
                ? <div key={i} className="mx-auto my-1.5 h-px w-7 bg-divider" />
                : <div key={i} className="px-2.5 pb-1 pt-4 text-[10.5px] font-bold uppercase tracking-wider text-default-400">{n.group}</div>
            ) : (
              <NavLink key={n.to} to={n.to} title={collapsed ? n.label : undefined}
                className={({ isActive }) => `group flex items-center rounded-2xl text-[13.5px] transition-colors ${collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-2.5 px-2.5 py-2.5"} ${isActive ? "card font-semibold text-foreground" : "font-medium text-default-500 hover:bg-content1/60 hover:text-default-700"}`}>
                <n.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
                {!collapsed && <>{n.label}<span className="ml-auto" />{n.tag && <span className="rounded-full bg-default-100 px-[7px] py-px text-[10.5px] font-bold text-default-500">{n.tag}</span>}</>}
              </NavLink>
            )
          )}
        </nav>

        <div className="mt-2 flex flex-col gap-0.5 border-t border-divider pt-3">
          <button title={collapsed ? "帮助与信息" : undefined} className={`flex items-center rounded-2xl text-[13.5px] font-medium text-default-500 transition-colors hover:bg-content1/60 hover:text-default-700 ${collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-2.5 px-2.5 py-2.5"}`}><HelpCircle className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />{!collapsed && "帮助与信息"}</button>
          <button title={collapsed ? "退出登录" : undefined} className={`flex items-center rounded-2xl text-[13.5px] font-medium text-default-500 transition-colors hover:bg-content1/60 hover:text-default-700 ${collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-2.5 px-2.5 py-2.5"}`}><LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />{!collapsed && "退出登录"}</button>
        </div>
      </aside>

      {/* white content panel */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden py-3 pr-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-content1 shadow-soft">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-divider px-7">
            <div className="flex items-center gap-1.5 text-[13px] text-default-500">
              {crumb.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-default-300">/</span>}
                  <span className={i === crumb.length - 1 ? "font-semibold text-foreground" : ""}>{c}</span>
                </span>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button isIconOnly size="sm" radius="full" variant="flat" className="bg-default-100"><Search className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} /></Button>
              <Button isIconOnly size="sm" radius="full" variant="flat" className="relative bg-default-100"><Bell className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} /><span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full ring-2 ring-content1" style={{ background: "var(--danger)" }} /></Button>
              <ThemeToggle />
              <Button size="sm" radius="full" variant="flat" className="bg-default-100" endContent={<ChevronDown className="h-3.5 w-3.5" />}>风控 · L1</Button>
              <Initials p={{ i: "JL", c: "var(--brand)" }} size={34} />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto px-7 pb-8 pt-5"><div className={`mx-auto ${wide ? "max-w-[1480px]" : "max-w-[1180px]"}`}>{children}</div></main>
        </div>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-1.5 max-w-[820px] text-[13px] leading-relaxed text-default-500">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}