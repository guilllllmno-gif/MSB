import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { LayoutDashboard, Bell, Search, ListChecks, SlidersHorizontal, Shield, FolderOpen, FileText, Clock, ChevronDown, ChevronsLeft, ChevronsRight, HelpCircle, LogOut, Network, FileCheck, History, Fingerprint, Activity, CheckCircle2, ChevronRight, Check, Link2 } from "lucide-react";
import { Initials, ThemeToggle } from "./bits";
import { liveNotifications } from "@/lib/notifications";
import { useAlertVersion, useCaseVersion, useReportVersion, useRingVersion, useRoleVersion, roleStore, PERSONS, ROLE_META, type Role } from "@/lib/store";
import logoIcon from "@/assets/logo-icon.svg";
import logoFull from "@/assets/logo-full.svg";

type Item = { to: string; label: string; icon: typeof Bell; tag?: string };
const NAV: ({ group: string } | Item)[] = [
  { to: "/dashboard", label: "风控仪表盘", icon: LayoutDashboard },
  { group: "监控运营" },
  { to: "/ops", label: "运营总览", icon: Activity },
  { to: "/monitoring", label: "事中监控", icon: Search, tag: "10" },
  { to: "/post-monitoring", label: "事后监控", icon: History },
  { to: "/alerts", label: "告警研判", icon: Bell, tag: "128" },
  { to: "/dispositions", label: "处置记录", icon: FileCheck },
  { to: "/entity", label: "主体档案", icon: Fingerprint },
  { group: "检测策略" },
  { to: "/rings", label: "团伙识别", icon: Network },
  { to: "/onchain", label: "链上情报", icon: Link2 },
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
  const [notifOpen, setNotifOpen] = useState(false);
  const nav = useNavigate();
  // 顶栏铃铛实时联动:任意模块的认领/处置/报送动作即时反映到通知数(与仪表盘「需立即处理」同源)
  useAlertVersion(); useCaseVersion(); useReportVersion(); useRingVersion();
  const role = useRoleVersion(); // 全局操作员身份(与仪表盘视角共享),切换即全站联动
  const who = roleStore.person();
  const meta = ROLE_META[role];
  const notifs = liveNotifications(role); // role-aware:总管只看团队 SLA 告急
  const notifTotal = notifs.reduce((s, n) => s + n.n, 0);
  const goNotif = (to: string) => { setNotifOpen(false); nav(to); };
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--page)]">
      <aside className={`no-scrollbar flex shrink-0 flex-col overflow-y-auto overflow-x-hidden px-3 py-4 transition-[width] duration-300 ease-in-out ${collapsed ? "w-[78px]" : "w-[252px]"}`}>
        {/* brand + collapse toggle */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2.5">
            <img src={logoIcon} alt="FuturePayCA" className="h-[60px] w-auto" />
            <button onClick={() => setCollapsed(false)} aria-label="展开侧边栏" className="flex h-9 w-9 items-center justify-center rounded-xl text-default-400 transition-colors hover:bg-content1 hover:text-default-600"><ChevronsRight className="h-[18px] w-[18px]" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-2.5">
            <div className="min-w-0 flex-1">
              <img src={logoFull} alt="FuturePayCA" className="h-[60px] w-auto" />
              <div className="mt-1.5 truncate text-[11px] leading-tight text-default-400">风控控制台</div>
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
                className={({ isActive }) => `group flex items-center rounded-xl text-[13.5px] transition-colors ${collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-2.5 px-2.5 py-2.5"} ${isActive ? "bg-content1 font-semibold text-foreground" : "font-medium text-default-500 hover:bg-content1/60 hover:text-default-700"}`}>
                <n.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
                {!collapsed && <>{n.label}<span className="ml-auto" />{n.tag && <span className="rounded-full bg-default-100 px-[7px] py-px text-[10.5px] font-bold text-default-500">{n.tag}</span>}</>}
              </NavLink>
            )
          )}
        </nav>

        <div className="mt-2 flex flex-col gap-0.5 border-t border-divider pt-3">
          <button title={collapsed ? "帮助与信息" : undefined} className={`flex items-center rounded-xl text-[13.5px] font-medium text-default-500 transition-colors hover:bg-content1/60 hover:text-default-700 ${collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-2.5 px-2.5 py-2.5"}`}><HelpCircle className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />{!collapsed && "帮助与信息"}</button>
          <button onClick={() => nav("/login")} title={collapsed ? "退出登录" : undefined} className={`flex items-center rounded-xl text-[13.5px] font-medium text-default-500 transition-colors hover:bg-content1/60 hover:text-default-700 ${collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-2.5 px-2.5 py-2.5"}`}><LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />{!collapsed && "退出登录"}</button>
        </div>
      </aside>

      {/* flat white content area — no rounded wrapper, no borders */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-content1">
        <header className="flex h-16 shrink-0 items-center gap-4 px-7">
          <div className="flex items-center gap-1.5 text-[13px] text-default-500">
            {crumb.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-default-300">/</span>}
                <span className={i === crumb.length - 1 ? "font-semibold text-foreground" : ""}>{c}</span>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button isIconOnly size="sm" radius="full" variant="flat" className="bg-default-100" aria-label="主体档案 360" onPress={() => nav("/entity")}><Search className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} /></Button>

            {/* 通知中心 — 团队级「需立即处理」实时派生,深链到各模块 */}
            <Popover placement="bottom-end" showArrow isOpen={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger>
                <Button isIconOnly size="sm" radius="full" variant="flat" className="relative bg-default-100" aria-label={notifTotal ? `通知 · ${notifTotal} 项待处理` : "通知 · 已清空"}>
                  <Bell className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} />
                  {notifTotal > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] text-[9.5px] font-bold leading-none text-white ring-2 ring-content1" style={{ background: "var(--danger)" }}>{notifTotal > 9 ? "9+" : notifTotal}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[316px] items-stretch p-0">
                <div className="flex items-center justify-between border-b border-default-100 px-3.5 py-2.5">
                  <span className="text-[12.5px] font-bold">需立即处理</span>
                  {notifTotal > 0 && <span className="rounded-full bg-default-100 px-2 py-0.5 text-[10.5px] font-bold text-default-500">{notifTotal} 项</span>}
                </div>
                {notifs.length ? (
                  <div className="flex flex-col">
                    {notifs.map((n) => (
                      <button key={n.to} onClick={() => goNotif(n.to)} className="flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-default-50">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-default-100"><n.icon className="h-4 w-4 text-default-500" strokeWidth={1.9} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold">{n.label}</span>
                          <span className="block truncate text-[11px] text-default-400">{n.sub}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-default-300" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 px-3.5 py-7 text-center">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                    <span className="text-[12.5px] font-semibold text-default-600">已全部清空</span>
                    <span className="text-[11px] text-default-400">暂无超时告警、待报送或待认领</span>
                  </div>
                )}
                <button onClick={() => goNotif("/ops")} className="border-t border-default-100 px-3.5 py-2.5 text-center text-[11.5px] font-semibold text-brand transition-colors hover:bg-default-50">查看运营总览 →</button>
              </PopoverContent>
            </Popover>

            <ThemeToggle />

            {/* 当前操作员 — 身份卡 + 切换身份(全局,与仪表盘视角共享)+ 入口 */}
            <Popover placement="bottom-end" showArrow>
              <PopoverTrigger>
                <button className="flex items-center gap-2 rounded-full py-1 pl-3 pr-1 outline-none transition-colors hover:bg-default-100">
                  <span className="text-[13px] font-medium text-default-600">{meta.chip}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-default-400" />
                  <Initials p={who} size={30} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[244px] items-stretch p-0">
                <div className="flex items-center gap-2.5 border-b border-default-100 px-3.5 py-3">
                  <Initials p={who} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{who.n}</span>
                    <span className="block truncate text-[11px] text-default-400">{meta.role} · {meta.tier}</span>
                  </span>
                </div>
                <div className="px-3.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-default-400">切换身份 · 演示</div>
                {(["analyst", "head"] as Role[]).map((r) => {
                  const p = PERSONS[r]; const m = ROLE_META[r]; const active = r === role;
                  return (
                    <button key={r} onClick={() => roleStore.set(r)} aria-pressed={active} className={`flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-default-50 ${active ? "bg-default-50" : ""}`}>
                      <Initials p={p} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold">{p.n}</span>
                        <span className="block truncate text-[10.5px] text-default-400">{m.role}</span>
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-brand" />}
                    </button>
                  );
                })}
                <button onClick={() => nav("/entity")} className="flex items-center gap-2.5 border-t border-default-100 px-3.5 py-2.5 text-left text-[12.5px] transition-colors hover:bg-default-50"><Fingerprint className="h-4 w-4 text-default-400" strokeWidth={1.9} />主体档案 360</button>
                <button onClick={() => nav("/login")} className="flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] text-danger transition-colors hover:bg-default-50"><LogOut className="h-4 w-4" strokeWidth={1.9} />退出登录</button>
              </PopoverContent>
            </Popover>
          </div>
        </header>
        <main className="no-scrollbar flex-1 overflow-y-auto px-7 pb-8 pt-2"><div className={`mx-auto ${wide ? "max-w-[1480px]" : "max-w-[1180px]"}`}>{children}</div></main>
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