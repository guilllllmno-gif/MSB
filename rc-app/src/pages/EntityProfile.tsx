import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button, Input, Select, SelectItem, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Fingerprint, Search, Bell, History, Network, FolderOpen, FileText, ArrowUpRight, ShieldAlert, Store, Link2, Layers, Building2, Lock, AlertOctagon, TrendingUp, TrendingDown, Minus, UserPlus, Send, Clock3, Sparkles, GitMerge } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, SoftChip, SectionLabel, Initials, RiskBadge, toneVar } from "@/components/bits";
import { directory, footprint, totalExposure, fmtCAD, entityType, ENTITY_TONE, sameEntity, linkedAddresses, type DirEntry, type Pending } from "@/lib/entity360";
import { RC_STATES, type Tone } from "@/lib/data";
import { FSTATES, FDIM } from "@/lib/findings";
import { CSTATE, type CState } from "@/lib/cases";
import { RSTATE } from "@/lib/reports";
import { RING_STATES } from "@/lib/rings";
import { alertStore, useAlertVersion, findingStore, useFindingVersion, caseStore, useCaseVersion, reportStore, useReportVersion, ringStore, useRingVersion } from "@/lib/store";

const MOD_ICON: Record<string, typeof Bell> = { alerts: Bell, findings: History, rings: Network, cases: FolderOpen, reports: FileText };
const MOD_LABEL: Record<string, string> = { alerts: "告警", findings: "事后", rings: "团伙", cases: "案件", reports: "报送" };

// ── 模块命中(中性、带计数:命中=深灰填充 chip,未命中=淡灰)──
type ModCount = { alerts: number; findings: number; rings: number; cases: number; reports: number };
function ModCoverage({ on }: { on: ModCount }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {(["alerts", "findings", "rings", "cases", "reports"] as const).map((m) => {
        const n = on[m] || 0; const lit = n > 0;
        return (
          <span key={m} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium"
            style={lit ? { background: "var(--track)", color: "var(--text-2)" } : { color: "var(--text-3)" }}>
            {MOD_LABEL[m]}<span className="tnum font-bold">{lit ? n : "–"}</span>
          </span>
        );
      })}
    </div>
  );
}

// 统一足迹列表里的模块标签(全部视图用,标明该条来自哪个模块)
function ModTag({ mod }: { mod: string }) {
  const Icon = MOD_ICON[mod];
  return <span className="inline-flex items-center gap-1 rounded-md bg-default-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-default-500"><Icon className="h-3 w-3" />{MOD_LABEL[mod]}</span>;
}

// 案件推进度序(取最推进的在办案件作串并主案)
const CASE_ORDER: Record<string, number> = { investigating: 0, str_draft: 1, mlro: 2, queued: 3, filed: 4 };

export default function EntityProfile() {
  const [params] = useSearchParams();
  const name = params.get("name") || "";
  return name ? <Profile name={name} /> : <Directory />;
}

function Profile({ name }: { name: string }) {
  useAlertVersion(); useFindingVersion(); useCaseVersion(); useReportVersion(); useRingVersion();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const fp = useMemo(() => footprint(name), [name]);
  const type = entityType(name);
  const exposure = totalExposure(fp);

  // 在办案件(取实时状态)—— 同商户多个在办案件 = 重复立案 / 可串并信号
  const activeCases = fp.cases.map((c) => ({ c, st: caseStore.stateOf(c.id, c.state) as CState })).filter((x) => CSTATE[x.st]?.active);
  const mergeable = activeCases.length >= 2;
  const primary = mergeable ? activeCases.reduce((a, b) => ((CASE_ORDER[b.st] ?? 0) > (CASE_ORDER[a.st] ?? 0) ? b : a)) : activeCases[0];
  // 一键串并:被并案件转「已合并」,统一并入最推进的主案(消除重复立案 / 重复 STR)
  const doMerge = () => {
    let n = 0;
    activeCases.forEach(({ c }) => { if (c.id !== primary.c.id) { caseStore.set(c.id, "merged", { event: `串并到主案 ${primary.c.id} · 主体360 发起` }); n++; } });
    caseStore.set(primary.c.id, primary.st, { event: `串并并入 ${n} 个关联案件(主体360 发起)` });
    toast.success(`已串并 ${n} 个案件到主案 ${primary.c.id}`);
  };
  useEffect(() => { if (params.get("merge") === "1" && mergeable) setTimeout(() => document.getElementById("merge-banner")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80); }, [params, mergeable]);

  // 综合风险标签 —— 由跨模块足迹推导(有案件/团伙=高,纯告警/事后=中)
  const hasCase = fp.cases.some((c) => CSTATE[(caseStore.stateOf(c.id, c.state)) as CState]?.active);
  const hasRing = fp.rings.length > 0;
  const sanc = fp.alerts.some((a) => a.sanctions?.status?.includes("命中")) || fp.cases.some((c) => /制裁/.test(c.risk + c.type));
  const riskTone: Tone = sanc || hasCase ? "red" : hasRing ? "amber" : "blue";
  const riskLabel = sanc ? "制裁关联 · 高风险" : hasCase ? "在办案件 · 高风险" : hasRing ? "团伙关联 · 关注" : fp.alerts.length || fp.findings.length ? "有命中 · 观察" : "暂无命中";

  const modCount = { alerts: fp.alerts.length, findings: fp.findings.length, rings: fp.rings.length, cases: fp.cases.length, reports: fp.reports.length };
  const strCount = fp.cases.filter((c) => ["str_draft", "mlro", "queued", "filed"].includes(caseStore.stateOf(c.id, c.state))).length + fp.reports.length;

  // 画像信息 —— 从最丰富的来源拼(告警 merchantTier/kyb/accountAge,否则案件/事后)
  const a0 = fp.alerts[0];
  const TypeIcon = type === "链上地址" ? Link2 : type === "团伙" ? Network : Store;

  // 关联商户 —— 同团伙成员 + 同案件涉案主体里的「其它商户」(主体=商户维度,地址不作关联主体,见下方属性卡)
  const related = useMemo(() => {
    const set = new Map<string, { name: string; via: string }>();
    const add = (n: string, via: string) => { if (!sameEntity(n, name) && entityType(n) === "商户") set.set(n, { name: n, via }); };
    fp.rings.forEach((rh) => rh.ring.members.forEach((m) => { if (m.kind !== "群组") add(m.name, `同团伙 ${rh.ring.id}`); }));
    // 案件子主体只取声明为「商户」的(剔除 Tornado Cash 等链上地址 / 个人 / UBO,它们不作关联主体)
    fp.cases.forEach((c) => (c.subjects || []).forEach((s) => { if (s.type === "商户") add(s.name, `同案 ${c.id}`); }));
    return [...set.values()].slice(0, 12);
  }, [fp, name]);

  // 商户 → 关联链上地址(从告警交易对手反推:托管钱包 + 入金来源 / 出金去向对手)
  const addrs = useMemo(() => (type === "商户" ? linkedAddresses(name) : []), [name, type]);

  // 跨模块足迹 → 统一列表项(每条带 mod,可按 tab 过滤;全部视图显模块标签)
  type FI = { mod: "alerts" | "findings" | "rings" | "cases" | "reports"; key: string; to: string; lead: React.ReactNode; title: React.ReactNode; sub: React.ReactNode; right: React.ReactNode };
  const footItems: FI[] = [
    ...fp.alerts.map((a): FI => { const st = RC_STATES[alertStore.stateOf(a.id, a.state)] || RC_STATES.new; return { mod: "alerts", key: a.id, to: `/alert?id=${a.id}`, lead: <RiskBadge tone={a.sev === "high" ? "red" : a.sev === "mid" ? "amber" : "blue"}>{a.score}</RiskBadge>, title: <><span>{a.title}</span><span className="text-default-400">· {a.id}</span></>, sub: `${a.type} · ${a.amount} · ${a.ruleShort}`, right: <Pill tone={st.cls} dot={false}>{st.label}</Pill> }; }),
    ...fp.findings.map((f): FI => { const st = FSTATES[findingStore.statusOf(f.id, f.status) as keyof typeof FSTATES] || FSTATES.new; return { mod: "findings", key: f.id, to: `/finding?id=${f.id}`, lead: <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--track)" }}><f.icon className="h-[15px] w-[15px] text-default-500" /></span>, title: <><span>{f.pattern}</span><span className="text-default-400">· {f.id}</span></>, sub: `${FDIM[f.dim].label} · ${f.hit}`, right: <Pill tone={st.tone} dot={false}>{st.label}</Pill> }; }),
    ...fp.rings.map(({ ring, member }): FI => { const st = RING_STATES[ringStore.stateOf(ring.id, ring.state) as keyof typeof RING_STATES]; return { mod: "rings", key: ring.id, to: `/ring?id=${ring.id}`, lead: <Initials p={{ i: member.i, c: member.c }} size={28} />, title: <><span>{ring.name}</span><span className="text-default-400">· {ring.id}</span></>, sub: `本主体角色:${member.role} · ${ring.typology} · ${ring.members.length} 主体`, right: st ? <Pill tone={st.tone} dot={false}>{st.label}</Pill> : null }; }),
    ...fp.cases.map((c): FI => { const cs = caseStore.stateOf(c.id, c.state) as CState; const st = CSTATE[cs]; return { mod: "cases", key: c.id, to: `/case?id=${c.id}`, lead: <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--violet-bg)", color: "var(--violet)" }}><FolderOpen className="h-[15px] w-[15px]" /></span>, title: <><span>{c.type}</span><span className="text-default-400">· {c.id}</span></>, sub: `${c.risk} · ${c.amount} · 来源 ${c.src}`, right: <Pill tone={st.tone} dot={false}>{st.label}</Pill> }; }),
    ...fp.reports.map((r): FI => { const st = RSTATE[reportStore.statusOf(r.id, r.status) as keyof typeof RSTATE]; return { mod: "reports", key: r.id, to: r.to || "/reports", lead: <SoftChip net>{r.type}</SoftChip>, title: <><span>{r.summary.slice(0, 28)}…</span><span className="text-default-400">· {r.id}</span></>, sub: `${r.sub} · ${r.amount}`, right: st ? <Pill tone={st.tone} dot={false}>{st.label}</Pill> : null }; }),
  ];
  const [tab, setTab] = useState<string>("all");
  useEffect(() => { setTab("all"); }, [name]); // 切换主体时回到全部
  const shown = tab === "all" || tab === "profile" ? footItems : footItems.filter((i) => i.mod === tab);

  const FOOT_TABS = ([["alerts", modCount.alerts], ["findings", modCount.findings], ["rings", modCount.rings], ["cases", modCount.cases], ["reports", modCount.reports]] as const).filter(([, n]) => n > 0);

  return (
    <Shell crumb={["主体档案", name]} wide>
      <PageHead title={name} sub="商户主体360 · 一个商户(法律实体)在 事中 / 事后 / 告警 / 团伙 / 案件 / 报送 的全部足迹聚到一张视图。地址 / 行为是该商户名下的属性与记录,不另作主体。" actions={
        <Button size="sm" variant="flat" className="bg-default-100" startContent={<Fingerprint className="h-4 w-4" />} onPress={() => nav("/entity")}>主体目录</Button>
      } />

      {/* 风险横幅 —— 综合标签 + 累计敞口 + 模块命中(中性) */}
      <div className="card mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-l-[3px] p-4" style={{ borderLeftColor: toneVar(riskTone) }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><TypeIcon className="h-[18px] w-[18px]" strokeWidth={2} /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={ENTITY_TONE[type]} dot={false}>{type}</Pill>
            <Pill tone={riskTone} icon={<ShieldAlert className="h-3 w-3" />}>{riskLabel}</Pill>
          </div>
          <div className="mt-1.5 text-[12px] text-default-500">累计涉及 <b style={{ color: toneVar(riskTone) }}>{fmtCAD(exposure)}</b> · 跨 <b className="text-foreground">{Object.values(modCount).filter((n) => n > 0).length}</b> / 5 个模块{strCount ? <> · STR/报送 <b className="text-foreground">{strCount}</b></> : null}</div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-default-300">模块命中</span>
          <ModCoverage on={modCount} />
        </div>
      </div>

      {/* 串并横幅 —— 同商户多个在办案件 = 重复立案 / 可串并(从总览 ·N案 直达) */}
      {mergeable && (
        <div id="merge-banner" className="card mb-5 border-l-[3px] p-4" style={{ borderLeftColor: "var(--violet)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--violet-bg)", color: "var(--violet)" }}><GitMerge className="h-[18px] w-[18px]" /></span>
            <div>
              <div className="text-[14px] font-bold">疑似重复立案 · 该商户有 {activeCases.length} 个在办案件</div>
              <div className="text-[11.5px] text-default-400">案件 = 单一容器。建议串并为一案,一次审核、一份 STR,消除重复立案 / 重复 STR。</div>
            </div>
            <Button size="sm" color="secondary" className="ml-auto" startContent={<GitMerge className="h-4 w-4" />} onPress={doMerge}>一键串并到 {primary.c.id}</Button>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {activeCases.map(({ c, st }) => (
              <button key={c.id} onClick={() => nav(`/case?id=${c.id}`)} className="card-hover group flex items-center gap-2 rounded-xl border border-default-200 px-3 py-2 text-left">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--violet-bg)", color: "var(--violet)" }}><FolderOpen className="h-[15px] w-[15px]" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold"><span className="truncate">{c.type}</span><span className="text-default-400">· {c.id}</span>{c.id === primary.c.id && <Pill tone="violet" dot={false}>主案</Pill>}</div>
                  <div className="truncate text-[11.5px] text-default-400">{c.risk} · {c.amount} · 来源 {c.src}</div>
                </div>
                <Pill tone={CSTATE[st].tone} dot={false}>{CSTATE[st].label}</Pill>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-default-300 group-hover:text-brand" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 跨模块足迹 —— 整合为单卡 + tab 切换;全部足迹为统一列表(每行带模块标签) */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-default-100 px-4 pt-4">
          {([["all", "全部足迹", footItems.length], ...FOOT_TABS.map(([k, n]) => [k, MOD_LABEL[k], n] as [string, string, number]), ["profile", "画像与关联", null]] as [string, string, number | null][]).map(([k, label, n]) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${on ? "" : "text-default-500 hover:bg-default-50"}`} style={on ? { background: "var(--brand-soft)", color: "var(--brand)" } : undefined}>
                {label}{n != null && <span className="tnum rounded-full px-1.5 text-[10.5px] font-bold" style={on ? { background: "color-mix(in srgb,var(--brand) 16%,transparent)", color: "var(--brand)" } : { background: "var(--track)", color: "var(--text-3)" }}>{n}</span>}
              </button>
            );
          })}
        </div>

        {tab === "profile" ? (
          <div className="flex flex-col gap-5 p-4">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <SectionLabel>主体画像</SectionLabel>
                  <div className="flex flex-col gap-2 text-[12.5px]">
                    <KV label="类型">{type}</KV>
                    {a0 && <KV label="注册地">{a0.country}</KV>}
                    {a0 && <KV label="商户分级"><Pill tone={a0.merchantTier[1]} dot={false}>{a0.merchantTier[0]}</Pill></KV>}
                    {a0 && <KV label="KYB">{a0.kyb}</KV>}
                    {a0 && <KV label="账龄">{a0.accountAge}</KV>}
                    {a0?.sanctions && <KV label="制裁筛查"><span style={{ color: a0.sanctions.status.includes("命中") ? "var(--danger)" : undefined }}>{a0.sanctions.status}</span></KV>}
                    {a0?.custHistory && <KV label="30日交易额">{a0.custHistory.vol30}</KV>}
                    {!a0 && <div className="py-2 text-[11.5px] text-default-400">该主体未在事中告警出现,画像取自事后 / 案件维度。</div>}
                  </div>
                </div>
                <div className="flex flex-col gap-5">
                  {addrs.length > 0 && (
                    <div>
                      <SectionLabel>关联链上地址 · 该商户属性</SectionLabel>
                      <div className="flex flex-col gap-1.5">
                        {addrs.map((a) => (
                          <div key={a.addr} className="flex items-center gap-2 rounded-lg border border-default-200 px-2.5 py-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--violet-bg)", color: "var(--violet)" }}><Link2 className="h-3.5 w-3.5" /></span>
                            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{a.addr}</span>
                            <Pill tone={a.role === "商户托管" ? "blue" : "violet"} dot={false}>{a.role}</Pill>
                            <span className="shrink-0 text-[10.5px] text-default-400">{a.dir}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-default-400">从该商户告警 sender / receiver 反推,作商户<b>属性</b>展示(地址不另作主体)。<b>商户托管</b>=本方钱包,<b>交易对手</b>=入金来源 / 出金去向。</p>
                    </div>
                  )}
                  {related.length > 0 && (
                    <div>
                      <SectionLabel>关联主体 · 同团伙 / 同案</SectionLabel>
                      <div className="flex flex-col gap-1.5">
                        {related.map((r) => (
                          <button key={r.name} onClick={() => nav(`/entity?name=${encodeURIComponent(r.name)}`)} className="card-hover group flex items-center gap-2 rounded-lg border border-default-200 px-2.5 py-2 text-left">
                            <Pill tone={ENTITY_TONE[entityType(r.name)]} dot={false}>{entityType(r.name)}</Pill>
                            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{r.name}</span>
                            <span className="shrink-0 text-[10.5px] text-default-400">{r.via}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-default-300 group-hover:text-brand" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <p className="flex items-start gap-1.5 rounded-xl border-l-[3px] border-l-brand bg-default-50 p-3 text-[12px] leading-relaxed text-default-500">
                <Layers className="mt-px h-4 w-4 shrink-0 text-default-400" />同一主体常被事中、事后、团伙、案件各自命中一次,分散在不同队列里看不全。主体360 按归一化键把它们聚到一起 —— 一眼看清全部敞口、是否已立案、有没有重复 STR,支撑「并案而非重复立案」。
              </p>
            </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <Layers className="h-7 w-7 text-default-300" />
              <div className="text-[13px] font-semibold text-default-500">{footItems.length === 0 ? "该主体暂无跨模块命中记录" : "该模块下无记录"}</div>
              <div className="text-[11.5px] text-default-400">{footItems.length === 0 ? "名字写法可能与各模块不一致,可回主体目录选取已聚合的主体。" : "切到「全部足迹」查看其它模块。"}</div>
            </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-y border-default-100 text-[11px] font-bold uppercase tracking-wider text-default-400">
                <th className="px-4 py-2.5 text-left font-bold">模块</th>
                <th className="px-3 py-2.5 text-left font-bold">记录</th>
                <th className="px-3 py-2.5 text-left font-bold">详情</th>
                <th className="px-3 py-2.5 text-left font-bold">状态</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={`${i.mod}-${i.key}`} onClick={() => nav(i.to)} className="cursor-pointer border-b border-default-50 align-middle transition-colors hover:bg-default-50">
                  <td className="px-4 py-3"><ModTag mod={i.mod} /></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2.5"><span className="shrink-0">{i.lead}</span><div className="min-w-0 text-[12.5px] font-semibold leading-tight">{i.title}</div></div></td>
                  <td className="px-3 py-3 text-[12px] text-default-500">{i.sub}</td>
                  <td className="px-3 py-3"><div className="flex flex-wrap items-center gap-1.5">{i.right}</div></td>
                  <td className="px-4 py-3 text-right"><ArrowUpRight className="ml-auto h-4 w-4 text-default-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-1.5"><span className="text-default-500">{label}</span><span className="text-right font-semibold">{children}</span></div>;
}

// ── 商户头像(确定性配色 + 缩写)──
const AV_COLORS = ["var(--brand)", "var(--violet)", "var(--success)", "var(--warning)", "#e1556d", "#0ea5e9", "#8b5cf6"];
function avHash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function initialsOf(name: string): string {
  const toks = name.replace(/[（(].*$/, "").trim().split(/[\s\-]+|(?<=[a-z])(?=[A-Z])/).filter(Boolean);
  const s = toks.length >= 2 ? (toks[0][0] || "") + (toks[1][0] || "") : (toks[0] || name).slice(0, 2);
  return s.toUpperCase();
}

// ── KPI 卡 ──
function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Store; label: string; value: React.ReactNode; sub: string; tone?: Tone }) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-default-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: tone ? toneSoft(tone) : "var(--track)", color: tone ? toneVar(tone) : "var(--text-3)" }}><Icon className="h-[15px] w-[15px]" strokeWidth={2} /></span>
        {label}
      </div>
      <div className="text-[30px] font-extrabold leading-none tracking-tight" style={tone ? { color: toneVar(tone) } : undefined}>{value}</div>
      <div className="text-[11.5px] text-default-400">{sub}</div>
    </div>
  );
}
const toneSoft = (t: Tone) => `color-mix(in srgb, ${toneVar(t)} 14%, transparent)`;

// ── 风险分徽标 ──
function RiskNum({ n }: { n: number }) {
  const tone: Tone = n >= 80 ? "red" : n >= 60 ? "amber" : "green";
  return <span className="tnum inline-flex h-7 min-w-[34px] items-center justify-center rounded-lg px-2 text-[13px] font-extrabold" style={{ background: toneSoft(tone), color: toneVar(tone) }}>{n}</span>;
}

// ── 犯事记录 chips ──
function RecordChips({ e }: { e: DirEntry }) {
  if (e.total === 0) return <span className="text-[12px] text-default-300">无记录</span>;
  const clean = e.cases === 0 && e.str === 0 && e.rings === 0 && e.findings === 0 && e.alerts > 0 && e.risk < 50;
  if (clean) return <span className="text-[11.5px] text-default-400">告警 {e.alerts} · 均误报</span>;
  const chip = (label: string, n: number, tone: Tone) => n > 0 && (
    <span key={label} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: toneSoft(tone), color: toneVar(tone) }}>{label} {n}</span>
  );
  return <div className="flex flex-wrap items-center gap-1.5">{chip("告警", e.alerts, "amber")}{chip("案件", e.cases, "violet")}{chip("STR", e.str, "red")}{chip("团伙", e.rings, "blue")}</div>;
}

// ── 风险趋势 ▲▼(对比 30 天前)──
function TrendTag({ n }: { n: number }) {
  if (Math.abs(n) < 1) return <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-default-300"><Minus className="h-3 w-3" />持平</span>;
  const up = n > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold" style={{ color: up ? "var(--danger)" : "var(--success)" }} title={`相对 30 天前${up ? "恶化" : "缓和"} ${Math.abs(n)} 分`}><Icon className="h-3 w-3" />{up ? "+" : ""}{n}</span>;
}

// ── 可解释风险分:点击展开「风险驱动因素」──
function RiskCell({ e }: { e: DirEntry }) {
  return (
    <Popover placement="bottom-start" showArrow>
      <PopoverTrigger>
        <button onClick={(ev) => ev.stopPropagation()} className="flex items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-80">
          <RiskNum n={e.risk} />
          <TrendTag n={e.trend} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-[268px] items-start p-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold"><Sparkles className="h-3.5 w-3.5 text-default-400" />风险驱动因素</div>
        <div className="flex w-full flex-col gap-1.5">
          {e.factors.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: toneVar(f.tone) }} />
              <span className="text-default-600">{f.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 w-full border-t border-default-100 pt-2 text-[11px] text-default-400">
          趋势 {e.trend > 0 ? `恶化 +${e.trend}` : e.trend < 0 ? `缓和 ${e.trend}` : "持平"} · 对比 30 天前{e.ringMates > 0 && <> · <span style={{ color: "var(--warning)" }}>同团伙 {e.ringMates} 个商户,可并案</span></>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 处置进展单元格:工作流阶段(flow)+ 紧急待办角标(pending)+ 可并案 ──
const PEND_ICON: Record<Pending["kind"], typeof Bell> = { claim: UserPlus, sla: Clock3 };
function FlowCell({ e }: { e: DirEntry }) {
  const nav = useNavigate();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {e.flow.key === "done" ? <span className="text-[12px] text-default-300">—</span> : <Pill tone={e.flow.tone}>{e.flow.label}</Pill>}
      {e.activeCases > 1 && <button onClick={(ev) => { ev.stopPropagation(); nav(`/entity?name=${encodeURIComponent(e.name)}&merge=1`); }} title={`在办 ${e.activeCases} 个案件 · 点击串并`} className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-bold transition-opacity hover:opacity-75" style={{ background: toneSoft("violet"), color: toneVar("violet") }}><GitMerge className="h-3 w-3" />{e.activeCases} 案</button>}
      {e.pending && (() => { const Icon = PEND_ICON[e.pending.kind]; return (
        <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: toneSoft(e.pending.tone), color: toneVar(e.pending.tone) }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneVar(e.pending.tone) }} /><Icon className="h-3 w-3" />{e.pending.label}
        </span>
      ); })()}
    </div>
  );
}

// ── 需关注分诊条:把待办紧迫的主体聚成一行可点筛选 ──
type PendFilter = "all" | "claim" | "str" | "sla" | "triage" | "rising";
const matchPend = (k: PendFilter, e: DirEntry): boolean =>
  k === "claim" ? e.pending?.kind === "claim"
    : k === "sla" ? e.pending?.kind === "sla"
    : k === "str" ? e.flow.key === "queued" || e.flow.key === "report" // 待报送阶段(案件 queued / 仅报告)
    : k === "triage" ? e.flow.key === "triage"
    : k === "rising" ? e.trend >= 8
    : true;
function TriageStrip({ all, value, onPick }: { all: DirEntry[]; value: PendFilter; onPick: (k: PendFilter) => void }) {
  const items: { k: PendFilter; label: string; n: number; icon: typeof Bell; tone: Tone }[] = [
    { k: "claim", label: "待认领案件", n: all.filter((e) => matchPend("claim", e)).length, icon: UserPlus, tone: "violet" },
    { k: "str", label: "STR 待报送", n: all.filter((e) => matchPend("str", e)).length, icon: Send, tone: "red" },
    { k: "sla", label: "案件 SLA 临期", n: all.filter((e) => matchPend("sla", e)).length, icon: Clock3, tone: "amber" },
    { k: "triage", label: "告警待研判", n: all.filter((e) => matchPend("triage", e)).length, icon: Bell, tone: "amber" },
    { k: "rising", label: "风险恶化中", n: all.filter((e) => matchPend("rising", e)).length, icon: TrendingUp, tone: "red" },
  ];
  const shown = items.filter((i) => i.n > 0);
  if (!shown.length) return null;
  const total = all.filter((e) => e.pending?.urgent || e.flow.key === "report").length;
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-2 p-3 pl-4">
      <span className="mr-1 flex items-center gap-1.5 text-[12.5px] font-bold"><ShieldAlert className="h-4 w-4" style={{ color: "var(--danger)" }} />需关注<span className="text-default-400">· {total} 项待办</span></span>
      {shown.map((i) => {
        const on = value === i.k;
        const Icon = i.icon;
        return (
          <button key={i.k} onClick={() => onPick(on ? "all" : i.k)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
            style={on ? { borderColor: toneVar(i.tone), background: toneSoft(i.tone), color: toneVar(i.tone) } : { borderColor: "var(--line)", color: "var(--text-2)" }}>
            <Icon className="h-3.5 w-3.5" style={{ color: toneVar(i.tone) }} />{i.label}
            <span className="tnum rounded-full px-1.5 text-[10.5px] font-bold" style={{ background: toneSoft(i.tone), color: toneVar(i.tone) }}>{i.n}</span>
          </button>
        );
      })}
      {value !== "all" && <button onClick={() => onPick("all")} className="ml-auto text-[11.5px] font-medium text-default-400 hover:text-default-600">清除筛选 ✕</button>}
    </div>
  );
}

// ── 主体目录 · 商户风险总览(无 name 参数)──
const DIR_TABS = [
  { k: "all", label: "全部" },
  { k: "high", label: "高风险" },
  { k: "cases", label: "有在办案件" },
  { k: "restricted", label: "受限 / 冻结" },
  { k: "watch", label: "名单观察" },
] as const;
type DirTab = (typeof DIR_TABS)[number]["k"];
const inTab = (tab: DirTab, e: DirEntry): boolean =>
  tab === "all" ? true
    : tab === "high" ? e.risk >= 80
    : tab === "cases" ? e.cases > 0
    : tab === "restricted" ? e.acct.key === "frozen" || e.acct.key === "restricted"
    : /* watch */ e.acct.key === "watch";

function Directory() {
  useAlertVersion(); useFindingVersion(); useCaseVersion(); useRingVersion(); useReportVersion();
  const nav = useNavigate();
  const all = useMemo(() => directory(), []);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<DirTab>("all");
  const [risk, setRisk] = useState("all");   // all | high(≥80) | mid(60-79) | low(<60)
  const [stat, setStat] = useState("all");
  const [country, setCountry] = useState("all");
  const [pend, setPend] = useState<PendFilter>("all");

  const countries = useMemo(() => [...new Set(all.map((e) => e.country).filter((c) => c && c !== "—"))], [all]);
  const tabCount = (k: DirTab) => all.filter((e) => inTab(k, e)).length;

  const list = all.filter((e) => {
    if (!inTab(tab, e)) return false;
    if (pend !== "all" && !matchPend(pend, e)) return false;
    if (q.trim()) { const s = q.toLowerCase(); if (!e.name.toLowerCase().includes(s) && !e.merchantNo.includes(q.trim())) return false; }
    if (risk === "high" && e.risk < 80) return false;
    if (risk === "mid" && (e.risk < 60 || e.risk >= 80)) return false;
    if (risk === "low" && e.risk >= 60) return false;
    if (stat !== "all" && e.acct.key !== stat) return false;
    if (country !== "all" && e.country !== country) return false;
    return true;
  });

  const restricted = all.filter((e) => e.acct.key === "frozen" || e.acct.key === "restricted").length;
  const active = all.length - restricted;
  const highRisk = all.filter((e) => e.risk >= 80).length;
  const caseSubj = all.filter((e) => e.cases > 0).length;
  const caseTotal = all.reduce((n, e) => n + e.cases, 0);

  return (
    <Shell crumb={["主体档案"]} wide>
      <PageHead title="商户总览" sub="全部商户主体的风险总览 · 按「需关注度」(风险 × 待办 × 趋势)排序,优先顶上正在恶化、有待办的主体。点击任意商户进入其 360° 档案。" />

      {/* 需关注分诊条 —— 谁需要我、为什么 */}
      <TriageStrip all={all} value={pend} onPick={setPend} />

      {/* KPI */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Building2} label="总商户数" value={all.length.toLocaleString()} sub={`活跃 ${active} · 受限 ${restricted}`} />
        <Kpi icon={AlertOctagon} label="高风险主体" value={highRisk} sub="风险分 ≥ 80" tone="red" />
        <Kpi icon={FolderOpen} label="有在办案件" value={caseTotal} sub={`涉及 ${caseSubj} 个主体`} tone="violet" />
        <Kpi icon={Lock} label="当前受限 / 冻结" value={restricted} sub="提现或交易受限" tone="amber" />
      </div>

      <div className="card overflow-hidden">
        {/* tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-default-100 px-4 pt-4">
          {DIR_TABS.map((t) => {
            const on = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${on ? "" : "text-default-500 hover:bg-default-50"}`}
                style={on ? { background: "var(--brand-soft)", color: "var(--brand)" } : undefined}>
                {t.label}
                <span className="tnum rounded-full px-1.5 text-[10.5px] font-bold" style={on ? { background: "color-mix(in srgb, var(--brand) 16%, transparent)", color: "var(--brand)" } : { background: "var(--track)", color: "var(--text-3)" }}>{tabCount(t.k)}</span>
              </button>
            );
          })}
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3.5">
          <div className="min-w-[240px] flex-1">
            <Input size="sm" radius="lg" placeholder="搜索商户名 / 商户号…" value={q} onValueChange={setQ}
              startContent={<Search className="h-4 w-4 text-default-400" />} classNames={{ inputWrapper: "bg-default-100 shadow-none" }} />
          </div>
          <Select size="sm" radius="lg" aria-label="风险分" selectedKeys={[risk]} className="w-[130px]" classNames={{ trigger: "bg-default-100 shadow-none" }}
            onSelectionChange={(k) => setRisk([...k][0] as string)} renderValue={() => <span className="text-[12.5px]">{({ all: "风险分", high: "≥ 80", mid: "60–79", low: "< 60" } as Record<string, string>)[risk]}</span>}>
            <SelectItem key="all">全部风险分</SelectItem><SelectItem key="high">≥ 80 高风险</SelectItem><SelectItem key="mid">60–79 中</SelectItem><SelectItem key="low">&lt; 60 低</SelectItem>
          </Select>
          <Select size="sm" radius="lg" aria-label="账户状态" selectedKeys={[stat]} className="w-[130px]" classNames={{ trigger: "bg-default-100 shadow-none" }}
            onSelectionChange={(k) => setStat([...k][0] as string)} renderValue={() => <span className="text-[12.5px]">{stat === "all" ? "账户状态" : ({ frozen: "冻结", restricted: "受限", watch: "观察", white: "白名单", normal: "正常" } as Record<string, string>)[stat]}</span>}>
            {[["all", "全部账户状态"], ["frozen", "冻结"], ["restricted", "受限"], ["watch", "观察"], ["white", "白名单"], ["normal", "正常"]].map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)}
          </Select>
          <Select size="sm" radius="lg" aria-label="注册地" selectedKeys={[country]} className="w-[120px]" classNames={{ trigger: "bg-default-100 shadow-none" }}
            onSelectionChange={(k) => setCountry([...k][0] as string)} renderValue={() => <span className="text-[12.5px]">{country === "all" ? "注册地" : country}</span>}>
            {[<SelectItem key="all">全部注册地</SelectItem>, ...countries.map((c) => <SelectItem key={c}>{c}</SelectItem>)]}
          </Select>
        </div>

        {/* table */}
        <table className="w-full">
          <thead>
            <tr className="border-y border-default-100 text-[11px] font-bold uppercase tracking-wider text-default-400">
              <th className="px-4 py-2.5 text-left font-bold">商户</th>
              <th className="px-3 py-2.5 text-left font-bold">风险分 · 趋势</th>
              <th className="px-3 py-2.5 text-left font-bold">账户状态</th>
              <th className="px-3 py-2.5 text-left font-bold">处置进展</th>
              <th className="px-3 py-2.5 text-left font-bold">犯事记录</th>
              <th className="px-3 py-2.5 text-right font-bold">30 日交易额</th>
              <th className="px-3 py-2.5 text-left font-bold">最近事件</th>
              <th className="px-4 py-2.5 text-right font-bold">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.key} onClick={() => nav(`/entity?name=${encodeURIComponent(e.name)}`)}
                className="cursor-pointer border-b border-default-50 transition-colors hover:bg-default-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Initials p={{ i: initialsOf(e.name), c: AV_COLORS[avHash(e.key) % AV_COLORS.length] }} size={38} />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-bold">{e.name}</div>
                      <div className="tnum text-[11px] text-default-400">{e.merchantNo}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3"><RiskCell e={e} /></td>
                <td className="px-3 py-3"><Pill tone={e.acct.tone}>{e.acct.label}</Pill></td>
                <td className="px-3 py-3"><FlowCell e={e} /></td>
                <td className="px-3 py-3"><RecordChips e={e} /></td>
                <td className="px-3 py-3 text-right tnum text-[12.5px] font-semibold">{e.vol30}</td>
                <td className="px-3 py-3 text-[12px] text-default-500">{e.lastEvent.label}{e.lastEvent.date && <span className="text-default-300"> · {e.lastEvent.date}</span>}</td>
                <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--brand)" }}>查看档案<ArrowUpRight className="h-3.5 w-3.5" /></span></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-[12.5px] text-default-400">无匹配商户</td></tr>}
          </tbody>
        </table>

        <p className="border-t border-default-100 px-4 py-3 text-[11.5px] leading-relaxed text-default-400">
          「犯事记录」是该商户历史累计的 告警 / 案件 / STR 数量汇总,一眼判断案底厚薄。点击任意行进入主体 360° 档案查看完整事件记录。
        </p>
      </div>
    </Shell>
  );
}
