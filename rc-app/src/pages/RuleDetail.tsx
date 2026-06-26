import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Tabs, Tab, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Tooltip, Textarea } from "@heroui/react";
import { ArrowLeft, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, FlaskConical, Copy, Power, Trash2, ArrowRight, Download, AlertTriangle, History, RotateCcw, Stamp, Lock, Check, Undo2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { Timeline } from "@/components/Timeline";
import { NewRuleDrawer } from "@/components/NewRuleDrawer";
import { RuleBacktestDrawer } from "@/components/RuleBacktestDrawer";
import { RULES, RUSTATE, CAT_ICON, VENUE, venueOf, bfrMeta, bfrDefault, condText, groupsText, rolloutBadges, seedVersions, ruleFieldDiffs, type Rule, type RuState, type RuleVersion } from "@/lib/rules";
import { FINDINGS } from "@/lib/findings";
import { findingStore, ruleStore, useRuleVersion, useFindingVersion } from "@/lib/store";
import type { Person } from "@/lib/data";

const ME: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const HEAD: Person = { i: "EZ", n: "Emma Zhang", c: "var(--violet)" }; // 风控总管 · 审批人
const tc = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : t === "green" ? "var(--success)" : t === "violet" ? "var(--violet)" : t === "blue" ? "var(--brand)" : "var(--text-3)");

// 解析 id → 规则(内置 / 新建 / 回填派生)
function resolve(id: string | null): Rule {
  const created = ruleStore.created().find((r) => r.id === id);
  if (created) return created;
  const builtin = RULES.find((r) => r.id === id);
  if (builtin) return builtin;
  if (id && id.startsWith("R-BF-")) {
    const fid = id.slice(5);
    const f = FINDINGS.find((x) => x.id === fid);
    if (f) { const m = bfrMeta(f.pattern); return { id, name: m.name, cat: m.cat, venue: m.venue, cond: m.cond, action: m.action, state: bfrDefault(f.backfill), hits30: f.backfill ? 8 : 0, fp30: f.backfill ? "5%" : "—", src: "回填自", srcId: f.id, to: `/finding?id=${f.id}`, owner: findingStore.ownerOf(f.id, f.owner) || ME, updated: f.batch, weight: m.weight }; }
  }
  return RULES[0];
}

// 确定性命中趋势(近30天)
const trend = (seed: string) => { const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0); return Array.from({ length: 30 }, (_, i) => 5 + ((h + i * 13) % 9) + (i >= 23 ? (i - 22) * 2 : 0)); };
const riskOf = (w: string) => { const n = Math.abs(parseInt(w.replace(/[^0-9]/g, "")) || 0); return n >= 50 ? { label: "高风险", tone: "red" as const } : n >= 30 ? { label: "中风险", tone: "amber" as const } : { label: "低风险", tone: "blue" as const }; };

const MERCHS = ["NovaPay Tech.", "BlockTrade Corp.", "SwiftRemit Inc.", "RapidPay"];

export default function RuleDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  useRuleVersion();
  useFindingVersion();
  const [tab, setTab] = useState("basic");
  const [editOpen, setEditOpen] = useState(false);
  const [btOpen, setBtOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const id = sp.get("id");
  const base = resolve(id);
  const rule = { ...base, ...ruleStore.editsOf(base.id) } as Rule;
  if (ruleStore.isRemoved(base.id)) return (
    <Shell crumb={["检测策略", "监控规则", "已删除"]}>
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-default-100 text-default-400"><Trash2 className="h-6 w-6" /></span>
        <p className="text-[15px] font-bold">规则已删除</p>
        <Button color="primary" onPress={() => nav("/rules")}>返回监控规则</Button>
      </div>
    </Shell>
  );
  const st = ruleStore.stateOf(rule.id, rule.state) as RuState;
  const sd = RUSTATE[st];
  const owner = ruleStore.ownerOf(rule.id, rule.owner);
  const events = ruleStore.eventsOf(rule.id);
  // 版本历史:种子谱系(从 base 派生,稳定)懒初始化,叠加本会话回滚/变更;最新在前
  const versions = ruleStore.ensureVersions(base.id, seedVersions(base));
  const rollback = (ver: RuleVersion) => {
    ruleStore.update(base.id, { cond: ver.fields.cond, weight: ver.fields.weight, action: ver.fields.action });
    ruleStore.recordVersion(base.id, { by: ME, summary: `回滚到 v${ver.v} · ${ver.summary}`, fields: ver.fields });
    toast.success(`已回滚到 v${ver.v}（${ver.summary}）`);
  };
  // ── 变更治理 ──
  // 名单筛查 = 法定硬规则(命中即拦,不靠权重阈值),编辑锁定;已上线规则的编辑须经总管审批(走拟议变更),其余状态原地直改
  const isHard = rule.cat === "名单筛查";
  const governed = st === "live" && !isHard;
  const pending = ruleStore.pendingOf(base.id);
  const pendingDiffs = pending ? ruleFieldDiffs(rule, pending.fields) : [];
  const approveChange = () => { ruleStore.approveChange(base.id, HEAD); toast.success("拟议变更已审批上线 · 记入新版本"); };
  const rejectChange = () => {
    if (!rejectReason.trim()) { toast.error("请填写退回理由"); return; }
    ruleStore.rejectChange(base.id, HEAD, rejectReason.trim());
    setRejectOpen(false); setRejectReason("");
    toast.success("已退回拟议变更 · 线上规则维持现版");
  };
  const ven = VENUE[venueOf(rule)];
  const CIcon = CAT_ICON[rule.cat];
  const risk = riskOf(rule.weight);

  // prev / next over built-in catalog
  const idx = RULES.findIndex((r) => r.id === rule.id);
  const prev = idx > 0 ? RULES[idx - 1] : null;
  const next = idx >= 0 && idx < RULES.length - 1 ? RULES[idx + 1] : null;

  const fpNum = parseInt(rule.fp30.replace(/[^0-9]/g, "")) || 0;
  const tr = trend(rule.id);
  const trMax = Math.max(...tr);
  const hitTotal = st === "live" ? (rule.hits30 * 90 + 287) : 0; // 累计命中(mock,基于近30天)

  // 固定操作:编辑 / 回测 / 复制 / 禁用·启用 / 删除
  const toggle = () => { ruleStore.set(rule.id, st === "disabled" ? "live" : "disabled", { owner: owner || ME, event: st === "disabled" ? "重新启用规则" : "停用规则" }); toast.success(st === "disabled" ? "已重新启用" : "已停用"); };
  const doCopy = () => {
    const n = ruleStore.created().length + 1;
    const copy: Rule = { ...rule, id: `R-CP-${String(n).padStart(3, "0")}`, name: `${rule.name}（副本）`, state: "backtest", src: `复制自 ${rule.id}`, srcId: undefined, to: undefined, hits30: 0, fp30: "—", updated: "2026-06-20" };
    ruleStore.add(copy); toast.success(`已复制为「${copy.name}」· 进入回测`); nav(`/rule?id=${copy.id}`);
  };
  const doDelete = () => { ruleStore.remove(rule.id); setDelOpen(false); toast.success(`已删除「${rule.name}」`); nav("/rules"); };

  // 规则概要字段
  const summary: [string, React.ReactNode][] = [
    ["触发条件", <span className="text-right">{rule.cond}</span>],
    ["适用范围", rule.cat === "金额阈值" ? "充值 / 提现" : rule.action.includes("提现") ? "提现" : "全业务线"],
    ["执行场景", <Pill tone={ven.tone} dot={false}>{ven.short}</Pill>],
    ["命中动作", rule.action],
    ["升级路径", risk.tone === "red" ? "升级 MLRO" : "L1 研判"],
    ["处置策略", "告警工作台 · STR"],
    ["数据来源", "订单 + 行为 + KYW + 链上溯源 + 名单"],
    ["版本", rule.src === "手动新建" ? "v1.0（新建）" : "v4.0"],
  ];
  const effect: [string, number, string][] = [["命中有效率", 100 - fpNum, "green"], ["误报率", fpNum, "amber"], ["升级转案率", 17, "blue"]];

  return (
    <Shell crumb={["检测策略", "监控规则", rule.id]} wide>
      <div className="mb-3.5 flex items-center justify-between">
        <button onClick={() => nav("/rules")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回监控规则</button>
        <div className="flex items-center gap-3 text-[12.5px]">
          <button disabled={!prev} onClick={() => prev && nav(`/rule?id=${prev.id}`)} className="inline-flex items-center gap-0.5 font-medium text-default-500 hover:text-foreground disabled:opacity-30"><ChevronLeft className="h-4 w-4" />上一规则</button>
          <button disabled={!next} onClick={() => next && nav(`/rule?id=${next.id}`)} className="inline-flex items-center gap-0.5 font-medium text-default-500 hover:text-foreground disabled:opacity-30">下一规则<ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2.5 text-[22px] font-extrabold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100 text-default-500"><CIcon className="h-5 w-5" /></span>
            {rule.id} {rule.name}
            <Pill tone={sd.tone}>{sd.label}</Pill>
            <Pill tone={risk.tone} dot={false}>{risk.label}</Pill>
            {rolloutBadges(rule).map((b) => <Pill key={b.label} tone={b.tone} dot={false}>{b.label}</Pill>)}
          </h1>
          <div className="mt-2.5 text-[13px] text-default-500">{rule.cat} · {ven.label} · 创建 <span className="tnum">{rule.updated}</span> · 负责人 <b className="text-foreground">{(owner || ME).n}</b> · 来源 {rule.to ? <button onClick={() => nav(rule.to!)} className="text-primary hover:opacity-80">{rule.src} {rule.srcId}</button> : rule.src}</div>
        </div>
        <div className="flex items-center gap-2">
          {/* 固定操作 —— 不随状态变 */}
          {isHard ? (
            <Tooltip content="法定硬规则 · 命中即拦,不靠权重阈值 —— 灵敏度调整请在名单管理增删名单项" placement="bottom">
              <span className="inline-flex"><Button size="sm" color="primary" isDisabled startContent={<Lock className="h-4 w-4" />}>编辑规则</Button></span>
            </Tooltip>
          ) : (
            <Button size="sm" color="primary" startContent={<Pencil className="h-4 w-4" />} onPress={() => setEditOpen(true)}>{governed ? "提议变更" : "编辑规则"}</Button>
          )}
          <Dropdown placement="bottom-end">
            <DropdownTrigger><Button isIconOnly size="sm" variant="flat" className="bg-default-100"><MoreHorizontal className="h-4 w-4" /></Button></DropdownTrigger>
            <DropdownMenu aria-label="规则操作" onAction={(k) => { if (k === "disable") toggle(); else if (k === "backtest") setBtOpen(true); else if (k === "copy") doCopy(); else if (k === "delete") setDelOpen(true); }}>
              <DropdownItem key="backtest" startContent={<FlaskConical className="h-4 w-4" />}>回测模拟</DropdownItem>
              <DropdownItem key="copy" startContent={<Copy className="h-4 w-4" />}>复制规则</DropdownItem>
              <DropdownItem key="disable" startContent={<Power className="h-4 w-4" />}>{st === "disabled" ? "启用规则" : "禁用规则"}</DropdownItem>
              <DropdownItem key="delete" className="text-danger" color="danger" startContent={<Trash2 className="h-4 w-4" />}>删除规则</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {/* 拟议变更 · 待总管审批 —— 原版照常生效,批准后才切换并记版本 */}
      {pending && (
        <div className="card mb-5 border-l-[3px] p-4" style={{ borderLeftColor: "var(--violet)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, var(--violet) 12%, transparent)", color: "var(--violet)" }}><Stamp className="h-4 w-4" /></span>
              <div>
                <div className="flex items-center gap-2 text-[14px] font-bold">拟议变更 · 待风控总管审批
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "color-mix(in srgb, var(--violet) 12%, transparent)", color: "var(--violet)" }}>未生效</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-default-400"><Initials p={pending.by} size={16} />{pending.by.n} 提交 · {pending.at}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="flat" radius="full" className="bg-default-100 font-semibold" startContent={<Undo2 className="h-3.5 w-3.5" />} onPress={() => setRejectOpen(true)}>退回</Button>
              <Button size="sm" radius="full" className="bg-violet/10 font-semibold" style={{ background: "color-mix(in srgb, var(--violet) 12%, transparent)", color: "var(--violet)" }} startContent={<Check className="h-3.5 w-3.5" />} onPress={approveChange}>批准上线</Button>
            </div>
          </div>
          {/* 变更明细:线上现版 → 拟议 */}
          <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-divider bg-default-50 p-3">
            {pendingDiffs.length ? pendingDiffs.map((d, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                <span className="w-[60px] shrink-0 font-semibold text-default-500">{d.label}</span>
                <span className="text-default-400 line-through">{d.from}</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-default-300" />
                <span className="font-semibold text-foreground">{d.to}</span>
              </div>
            )) : <span className="text-[12px] text-default-400">无内容字段变更</span>}
          </div>
          <p className="mt-2 text-[10.5px] leading-snug text-default-400">线上规则当前仍按 <b className="text-default-500">现版</b> 拦截;批准后拟议字段即切换为线上版本、记入版本历史,退回则丢弃改动。审批人 = 风控总管(Emma Zhang)。</p>
        </div>
      )}

      <Tabs aria-label="规则详情" selectedKey={tab} onSelectionChange={(k) => setTab(k as string)} variant="underlined" color="primary" classNames={{ tabList: "gap-6 p-0 mb-5", cursor: "w-full", tab: "px-0 h-9 max-w-fit", tabContent: "text-[13px] font-semibold" }}>
        <Tab key="basic" title="基本信息" />
        <Tab key="version" title="版本历史" />
        <Tab key="log" title="活动日志" />
      </Tabs>

      {tab === "log" ? (
        <div className="card p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-default-400">活动日志</div>
          {events.length ? <Timeline items={[...events].reverse().map((e) => ({ time: e.t, text: e.text + (e.reason ? ` · ${e.reason}` : ""), done: true }))} /> : <p className="text-[12.5px] text-default-400">暂无变更记录。规则的禁用 / 启用 / 审批等变更将记入此处。</p>}
        </div>
      ) : tab === "version" ? (
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><History className="h-4 w-4" /></span>
            <span className="text-[15px] font-bold">版本历史</span>
            <span className="rounded-full bg-default-100 px-2 py-0.5 text-[11.5px] font-semibold text-default-500 tnum">{versions.length} 个版本</span>
          </div>
          <p className="mb-4 text-[12px] text-default-400">规则内容(触发条件 / 命中权重 / 处置)的每次变更都留痕,可回滚到任一历史版本。回滚不影响上线状态。</p>
          <div className="flex flex-col">
            {versions.map((ver, i) => {
              const prev = versions[i + 1]; // 更早的一版
              const diffs: string[] = [];
              if (prev) {
                if (ver.fields.cond !== prev.fields.cond) diffs.push(`触发条件:${prev.fields.cond} → ${ver.fields.cond}`);
                if (ver.fields.weight !== prev.fields.weight) diffs.push(`命中权重:${prev.fields.weight} → ${ver.fields.weight}`);
                if (ver.fields.action !== prev.fields.action) diffs.push(`处置:${prev.fields.action} → ${ver.fields.action}`);
              }
              const isHead = i === 0;
              return (
                <div key={`${ver.v}-${ver.date}`} className="flex gap-3 border-b border-divider/60 py-3 last:border-0">
                  {/* 版本节点 + 竖线 */}
                  <div className="flex flex-col items-center pt-0.5">
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold tnum" style={isHead ? { background: "var(--brand-soft)", color: "var(--brand)" } : { background: "var(--default-100)", color: "var(--text-3)" }}>v{ver.v}</span>
                    {i < versions.length - 1 && <span className="mt-1 w-px flex-1 bg-divider" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-bold">{ver.summary}</span>
                      {isHead && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)" }}>当前</span>}
                      <span className="flex items-center gap-1 text-[11px] text-default-400"><Initials p={ver.by} size={16} />{ver.by.n} · {ver.date}</span>
                    </div>
                    {/* 该版本内容 */}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-default-500">
                      <span>条件 <b className="font-medium text-default-700">{ver.fields.cond}</b></span>
                      <span>权重 <b className="font-medium text-default-700 tnum">{ver.fields.weight}</b></span>
                    </div>
                    {/* 相对上一版的变化 */}
                    {diffs.length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-0.5">
                        {diffs.map((d, j) => <div key={j} className="text-[11px] leading-snug text-default-400"><span className="text-[var(--brand)]">●</span> {d}</div>)}
                      </div>
                    )}
                  </div>
                  {/* 回滚 */}
                  {!isHead && (
                    <Button size="sm" variant="flat" radius="full" className="h-7 shrink-0 self-start bg-default-100 px-3 text-[11.5px] font-semibold" startContent={<RotateCcw className="h-3.5 w-3.5" />} onPress={() => rollback(ver)}>回滚到此版本</Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {[
              { k: "累计命中", v: hitTotal.toLocaleString(), sub: "上线以来", tone: "" },
              { k: "待复核", v: st === "live" ? 38 : 0, sub: "当前队列", tone: "amber" },
              { k: "误报率", v: rule.fp30, sub: "近 30 天", tone: fpNum > 15 ? "amber" : "green" },
              { k: "升级研判", v: st === "live" ? 9 : 0, sub: "近 30 天", tone: "violet" },
            ].map((s) => (
              <div key={s.k} className="card p-4">
                <div className="text-[12px] text-default-500">{s.k}</div>
                <div className="mt-1.5 text-[26px] font-extrabold leading-none tnum" style={{ color: s.tone ? tc(s.tone) : undefined }}>{s.v}</div>
                <div className="mt-1 text-[11px] text-default-400">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* 规则概要 + 实际效果 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">规则概要</div>
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {summary.map(([k, v]) => <div key={k} className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2 text-[12.5px]"><span className="shrink-0 text-default-500">{k}</span><span className="text-right font-semibold">{v}</span></div>)}
              </div>
            </div>
            <div className="card p-5">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-default-400">实际效果</div>
              <div className="flex flex-col gap-3.5">
                {effect.map(([k, v, t]) => (
                  <div key={k}>
                    <div className="mb-1 flex items-center justify-between text-[12px]"><span className="text-default-500">{k}</span><span className="font-bold tnum" style={{ color: tc(t) }}>{v}%</span></div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-default-100"><div className="h-full rounded-full" style={{ width: `${v}%`, background: tc(t) }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 命中趋势 */}
          <div className="card p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[13px] font-bold">命中趋势 · 近 30 天</div>
              <span className="text-[11.5px] text-default-400">{st === "live" ? `${tr.reduce((a, b) => a + b, 0)} 笔匹配` : "未上线 · 无命中"}</span>
            </div>
            {st === "live" ? (
              <div className="mt-3 flex h-28 items-end gap-[3px]">
                {tr.map((v, i) => <div key={i} className="flex-1 rounded-t" style={{ height: `${(v / trMax) * 100}%`, background: i >= 23 ? "var(--danger)" : "var(--brand)", opacity: i >= 23 ? 0.85 : 0.55 }} title={`第 ${i + 1} 天 · ${v} 笔`} />)}
              </div>
            ) : <p className="py-6 text-center text-[12.5px] text-default-400">规则在「{sd.label}」,上线后开始累计命中。</p>}
            <p className="mt-2 text-[11px] text-default-400">蓝=日常,红=近 7 天(命中升高需关注)。</p>
          </div>

          {/* 匹配交易 */}
          {st === "live" && (
            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-divider p-4"><span className="text-[13px] font-bold">匹配交易</span><Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<Download className="h-3.5 w-3.5" />}>下载</Button></div>
              <table className="w-full text-[12.5px]">
                <thead><tr className="border-b border-divider text-[11.5px] text-default-400"><th className="px-4 py-2 text-left font-medium">警报ID</th><th className="px-4 py-2 text-left font-medium">金额</th><th className="px-4 py-2 text-left font-medium">商户</th><th className="px-4 py-2 text-left font-medium">处置进展</th><th className="px-4 py-2 text-left font-medium">日期</th></tr></thead>
                <tbody>
                  {Array.from({ length: 8 }, (_, i) => (
                    <tr key={i} className="border-b border-default-100 last:border-0">
                      <td className="px-4 py-2.5"><button onClick={() => nav("/alerts")} className="font-semibold text-primary hover:opacity-80">ALT-2026-{String(231 - i)}</button></td>
                      <td className="px-4 py-2.5 font-semibold tnum">CAD {(8000 + i * 1500).toLocaleString()}.00</td>
                      <td className="px-4 py-2.5">{MERCHS[i % MERCHS.length]}</td>
                      <td className="px-4 py-2.5">{i % 3 === 0 ? <Pill tone="red">已阻止</Pill> : i % 3 === 1 ? <Pill tone="amber">待处理</Pill> : <Pill tone="violet">已升级</Pill>}</td>
                      <td className="px-4 py-2.5 text-default-500 tnum">2026-06-{String(11 + i).padStart(2, "0")} 11:33</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-divider px-4 py-2.5 text-[11.5px] text-default-400"><span>共 {hitTotal.toLocaleString()} 条</span><span className="flex gap-3"><button className="hover:text-foreground">上一页</button><button className="font-semibold text-primary">下一页</button></span></div>
            </div>
          )}

          {/* 触发条件 */}
          <div className="card p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">触发条件</div>
            <div className="mb-3 rounded-xl border border-divider bg-default-50 p-3 text-[12px] leading-relaxed">
              <span className="mr-1.5 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--brand)]">IF</span>
              <span className="font-medium text-default-700">{rule.groups?.length ? groupsText(rule.groups, rule.outerJoiner || "OR") : rule.clauses?.length ? condText(rule.clauses) : rule.cond}</span>
              <span className="ml-1.5 rounded bg-[var(--success-bg)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--success)]">THEN</span>
              <span className="font-medium text-default-700"> {rule.action}</span>
              {rule.otherwise && <><span className="ml-1.5 rounded bg-default-100 px-1.5 py-0.5 text-[10.5px] font-bold text-default-500">ELSE</span><span className="text-default-600"> {rule.otherwise}</span></>}
            </div>
            {rule.clauses?.length ? (
              <table className="w-full text-[12.5px]">
                <thead><tr className="border-b border-divider text-[11.5px] text-default-400"><th className="py-2 pr-4 text-left font-medium">字段</th><th className="py-2 pr-4 text-left font-medium">滑动窗口</th><th className="py-2 pr-4 text-left font-medium">运算符</th><th className="py-2 text-left font-medium">阈值 / 取值</th></tr></thead>
                <tbody>
                  {rule.clauses.map((c, i) => (
                    <tr key={i} className="border-b border-default-100 last:border-0">
                      <td className="py-2.5 pr-4 font-medium">{c.field}</td>
                      <td className="py-2.5 pr-4 text-default-500">{c.window || "—"}</td>
                      <td className="py-2.5 pr-4 text-primary">{c.op}</td>
                      <td className="py-2.5 font-semibold tnum">{c.tiers?.rows.length ? `按${c.tiers.dim}分档(${c.tiers.rows.filter((r) => r.key && r.value).map((r) => `${r.key}: ${r.value}`).join(" / ")})` : c.basis === "self" ? `自身基线 ×${c.value}` : c.basis === "peer" ? `同业群 P${c.value}` : c.basis === "sigma" ? `偏离均值 ${c.value}σ` : c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-[11.5px] text-default-400">内置规则的条件以上方表达式描述;新建 / 复合规则会展开字段 · 运算符 · 阈值明细表。</p>}
          </div>

          {/* 命中动作与下游处置 */}
          <div className="card p-5">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-default-400">命中动作与下游处置</div>
            {rule.actionTiers && (
              <div className="mb-3 rounded-xl border border-divider bg-default-50 p-3">
                <div className="mb-2 text-[11.5px] font-semibold text-default-600">阶梯处置 · 按{rule.actionTiers.by}分档(自高到低匹配)</div>
                <div className="flex flex-col gap-1.5">
                  {rule.actionTiers.rows.filter((r) => r.from && r.action).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px]">
                      <span className="tnum rounded-md bg-content1 px-2 py-0.5 font-semibold text-default-700">≥{rule.actionTiers!.by === "金额" ? "$" : ""}{r.from}{rule.actionTiers!.by === "风险分" ? " 分" : ""}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-default-300" />
                      <span className="font-medium text-default-700">{r.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {[`命中评分 ${rule.weight}`, rule.action, ven.short === "事后" ? "回溯命中 · 转研判" : "事中闸口处置", risk.tone === "red" ? "升级 MLRO · STR" : "L1 研判结案"].map((s, i, arr) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="rounded-lg border border-divider px-2.5 py-1.5 text-[12px] font-semibold text-default-700">{s}</span>
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-default-300" />}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-default-400">命中后按权重计入风险评分;达阈值触发对应处置,必要时升级 MLRO 并起草 STR。{venueOf(rule) === "gate" ? "事中即时拦截。" : venueOf(rule) === "batch" ? "事后批量回溯,资金已出账则转追溯。" : "事中近实时 + 事后复扫。"}</p>
          </div>
        </div>
      )}

      <NewRuleDrawer open={editOpen} onOpenChange={setEditOpen} editRule={rule} requiresApproval={governed} />
      <RuleBacktestDrawer rule={rule} open={btOpen} onOpenChange={setBtOpen} />
      <Modal isOpen={rejectOpen} onOpenChange={setRejectOpen} size="sm" placement="center">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-[15px]"><span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, var(--violet) 12%, transparent)", color: "var(--violet)" }}><Undo2 className="h-4 w-4" /></span>退回拟议变更</ModalHeader>
          <ModalBody className="gap-3 text-[13px] leading-relaxed text-default-600">
            退回 <b className="text-foreground">{rule.id} {rule.name}</b> 的拟议变更,线上维持现版。理由记入变更审计。
            <Textarea aria-label="退回理由" minRows={2} placeholder="退回理由(必填)· 如:误报上升风险未评估、需补回测样本…" value={rejectReason} onValueChange={setRejectReason} isInvalid={rejectOpen && !rejectReason.trim()} />
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => { setRejectOpen(false); setRejectReason(""); }}>取消</Button>
            <Button style={{ background: "color-mix(in srgb, var(--violet) 14%, transparent)", color: "var(--violet)" }} className="font-semibold" onPress={rejectChange}>确认退回</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={delOpen} onOpenChange={setDelOpen} size="sm" placement="center">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-[15px]"><span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}><AlertTriangle className="h-4 w-4" /></span>删除规则</ModalHeader>
          <ModalBody className="text-[13px] leading-relaxed text-default-600">确认删除规则 <b className="text-foreground">{rule.id} {rule.name}</b>?删除后将从规则库移除,事中 / 事后不再按此规则判定。此操作记入变更审计。</ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setDelOpen(false)}>取消</Button>
            <Button color="danger" onPress={doDelete}>确认删除</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Shell>
  );
}
