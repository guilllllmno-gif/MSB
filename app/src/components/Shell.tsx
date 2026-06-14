import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Users, ClipboardList, FolderOpen, Snowflake, Bell, Settings, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { to: "/merchants", label: "商户列表", icon: Users },
  { to: "/orders", label: "订单管理", icon: ClipboardList },
  { to: "/evidence", label: "案件证据", icon: FolderOpen },
  { to: "/unfreeze", label: "解冻处置", icon: Snowflake },
];

export function Shell({ crumb, children }: { crumb: string[]; children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* sidebar */}
      <aside className="flex w-[236px] shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg,var(--brand),#4f8ef7)" }}>F</div>
          <div className="text-[15px] font-bold tracking-tight">Future<span style={{ color: "var(--brand)" }}>Pay</span>CA</div>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          <div className="px-2.5 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">调查工具</div>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  isActive ? "font-semibold" : "text-[#4a5160] hover:bg-[#f5f7fa]"
                }`
              }
              style={({ isActive }) => (isActive ? { background: "var(--brand-soft)", color: "var(--brand)" } : undefined)}
            >
              <n.icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              {n.label}
            </NavLink>
          ))}
          <div className="mt-1 px-2.5 text-[11px] text-muted-foreground/70">演示切片 · 三个待建页面</div>
        </nav>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-7">
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {crumb.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground/50">/</span>}
                <span className={i === crumb.length - 1 ? "font-semibold text-foreground" : ""}>{c}</span>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3.5">
            <button className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-semibold">
              风控 · L1 <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary">
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />
              <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-card" style={{ background: "var(--danger)" }} />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary">
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </button>
            <Avatar className="h-8 w-8"><AvatarFallback style={{ background: "var(--brand)", color: "#fff" }} className="text-[12px] font-bold">JL</AvatarFallback></Avatar>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

// page heading
export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-[18px] flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-[760px] text-[13px] text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
