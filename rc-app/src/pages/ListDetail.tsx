import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Tabs, Tab } from "@heroui/react";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Trash2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, KvRow, SectionLabel } from "@/components/bits";
import { Timeline } from "@/components/Timeline";
import { LISTS, LCAT, LSTATE, LFLOW, entryOf, detailOf, type ListEntry, type LStatus } from "@/lib/lists";
import { listStore, useListVersion } from "@/lib/store";
import type { Person, Tone } from "@/lib/data";

const ME: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const tc = (t: Tone) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : t === "green" ? "var(--success)" : t === "violet" ? "var(--violet)" : t === "blue" ? "var(--brand)" : "var(--text-3)");

function resolve(id: string | null): ListEntry {
  const created = listStore.created().find((e) => e.id === id);
  if (created) return created;
  return entryOf(id || undefined) || LISTS[0];
}

export default function ListDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  useListVersion();
  const [tab, setTab] = useState("basic");

  const id = sp.get("id");
  const entry = resolve(id);
  const st = listStore.statusOf(entry.id, entry.status) as LStatus;
  const sd = LSTATE[st];
  const owner = listStore.ownerOf(entry.id, entry.addedBy) || entry.addedBy;
  const events = listStore.eventsOf(entry.id);
  const CIcon = LCAT[entry.cat].icon;
  const detail = detailOf(entry);

  // prev / next over built-in catalog
  const idx = LISTS.findIndex((e) => e.id === entry.id);
  const prev = idx > 0 ? LISTS[idx - 1] : null;
  const next = idx >= 0 && idx < LISTS.length - 1 ? LISTS[idx + 1] : null;

  const actions = LFLOW[st];
  const run = (a: (typeof actions)[number]) => {
    const label = a.k === "escalate" ? `${a.label} · ${entry.value}` : a.label;
    listStore.set(entry.id, a.to, { owner: owner || ME, event: label, reason: a.tip });
    toast.success(`已${a.label} · ${entry.value}`);
  };

  const hitTotal = st === "active" ? entry.hits30 * 6 + 11 : 0;

  return (
    <Shell crumb={["治理与合规", "名单管理", entry.id]} wide>
      <div className="mb-3.5 flex items-center justify-between">
        <button onClick={() => nav("/lists")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回名单管理</button>
        <div className="flex items-center gap-3 text-[12.5px]">
          <button disabled={!prev} onClick={() => prev && nav(`/list-entry?id=${prev.id}`)} className="inline-flex items-center gap-0.5 font-medium text-default-500 hover:text-foreground disabled:opacity-30"><ChevronLeft className="h-4 w-4" />上一名单项</button>
          <button disabled={!next} onClick={() => next && nav(`/list-entry?id=${next.id}`)} className="inline-flex items-center gap-0.5 font-medium text-default-500 hover:text-foreground disabled:opacity-30">下一名单项<ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2.5 text-[22px] font-extrabold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100 text-default-500"><CIcon className="h-5 w-5" /></span>
            {entry.value}
            <Pill tone="grey" dot={false}>{entry.entryType}</Pill>
            <Pill tone="grey" dot={false}>{LCAT[entry.cat].label}</Pill>
            <Pill tone={sd.tone}>{sd.label}</Pill>
          </h1>
          <div className="mt-2.5 text-[13px] text-default-500">{entry.id} · {LCAT[entry.cat].full} · 添加 <span className="tnum">{entry.addedAt}</span> · 添加人 <b className="text-foreground">{owner.n}</b> · 来源 {entry.to ? <button onClick={() => nav(entry.to!)} className="text-primary hover:opacity-80">{entry.source} {entry.srcId}</button> : entry.source}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions.length ? actions.map((a) => {
            const Icon = a.icon;
            return <Button key={a.k} size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<Icon className="h-4 w-4" style={{ color: a.tone ? tc(a.tone) : undefined }} />} onPress={() => run(a)}>{a.label}</Button>;
          }) : <span className="text-[12px] text-default-400">终态 · 无可执行操作</span>}
        </div>
      </div>

      <Tabs aria-label="名单项详情" selectedKey={tab} onSelectionChange={(k) => setTab(k as string)} variant="underlined" color="primary" classNames={{ tabList: "gap-6 p-0 mb-5", cursor: "w-full", tab: "px-0 h-9 max-w-fit", tabContent: "text-[13px] font-semibold" }}>
        <Tab key="basic" title="基本信息" />
        <Tab key="log" title="活动日志" />
      </Tabs>

      {tab === "log" ? (
        <div className="card p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-default-400">活动日志</div>
          {events.length ? <Timeline items={[...events].reverse().map((e) => ({ time: e.t, text: e.text + (e.reason ? ` · ${e.reason}` : ""), done: true }))} /> : <p className="text-[12.5px] text-default-400">暂无变更记录。名单项的复核生效 / 暂停 / 续期 / 移除等变更将记入此处。</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {[
              { k: "近30天命中", v: st === "active" ? entry.hits30 : 0, sub: "拦截 / 监控触发", tone: entry.hits30 > 15 ? "amber" : "" },
              { k: "状态", v: sd.label, sub: "当前生命周期", tone: sd.tone },
              { k: "来源", v: entry.source, sub: entry.srcId || "—", tone: "" },
              { k: "适用范围", v: entry.scope, sub: "事中筛查范围", tone: "" },
            ].map((s) => (
              <div key={s.k} className="card p-4">
                <div className="text-[12px] text-default-500">{s.k}</div>
                <div className="mt-1.5 text-[20px] font-extrabold leading-tight tnum" style={{ color: s.tone ? tc(s.tone as Tone) : undefined }}>{s.v}</div>
                <div className="mt-1 text-[11px] text-default-400">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* 名单项概要 + 关联 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <SectionLabel>名单项概要</SectionLabel>
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <KvRow label="类别"><Pill tone="grey" dot={false}>{LCAT[entry.cat].label}</Pill></KvRow>
                <KvRow label="类型"><Pill tone="grey" dot={false}>{entry.entryType}</Pill></KvRow>
                <KvRow label="来源">{entry.to ? <button onClick={() => nav(entry.to!)} className="inline-flex items-center gap-1 text-primary hover:opacity-80">{entry.source} {entry.srcId}<ExternalLink className="h-3 w-3" /></button> : entry.source}</KvRow>
                <KvRow label="适用范围">{entry.scope}</KvRow>
                <KvRow label="添加人">{owner.n}</KvRow>
                <KvRow label="添加时间"><span className="tnum">{entry.addedAt}</span></KvRow>
                <KvRow label="到期"><span className={entry.expiry === "长期有效" ? "" : "tnum"}>{entry.expiry || "—"}</span></KvRow>
                <KvRow label="风险标签">{entry.risk}</KvRow>
              </div>
              <p className="mt-3 rounded-xl border border-divider bg-default-50 p-3 text-[12px] leading-relaxed text-default-600"><span className="font-semibold text-default-700">列入理由 · </span>{entry.reason}</p>
            </div>

            <div className="card p-5">
              <SectionLabel>关联</SectionLabel>
              {detail.matched.length ? (
                <div className="flex flex-col gap-2">
                  {detail.matched.map((m) => (
                    <button key={m.id} onClick={() => nav(m.to)} className="flex items-center justify-between gap-2 rounded-xl border border-divider bg-default-50 px-3 py-2.5 text-left transition-colors hover:bg-default-100">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold"><Pill tone="grey" dot={false}>{m.kind}</Pill>{m.id}</span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-default-500">{m.label}</span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-default-400" />
                    </button>
                  ))}
                </div>
              ) : <p className="text-[12px] text-default-400">暂无关联告警 / 案件 / 团伙。</p>}
              <p className="mt-3 text-[11px] leading-relaxed text-default-400">名单项命中后,可回溯到产生它的研判结论与下游处置。</p>
            </div>
          </div>

          {/* 命中历史 */}
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-divider p-4">
              <span className="text-[13px] font-bold">命中历史</span>
              <span className="text-[11.5px] text-default-400">{st === "active" ? `累计 ${hitTotal.toLocaleString()} 次 · 近30天 ${entry.hits30}` : `${sd.label} · 当前不参与筛查`}</span>
            </div>
            {detail.hits.length ? (
              <table className="w-full text-[12.5px]">
                <thead><tr className="border-b border-divider text-[11.5px] text-default-400"><th className="px-4 py-2 text-left font-medium">时间</th><th className="px-4 py-2 text-left font-medium">交易 / 订单</th><th className="px-4 py-2 text-left font-medium">处置</th><th className="px-4 py-2 text-left font-medium">金额</th></tr></thead>
                <tbody>
                  {detail.hits.map((h, i) => (
                    <tr key={i} className="border-b border-default-100 last:border-0">
                      <td className="px-4 py-2.5 text-default-500 tnum">{h.date}</td>
                      <td className="px-4 py-2.5 font-semibold">{h.txn}</td>
                      <td className="px-4 py-2.5">{h.action.includes("拦截") || h.action.includes("冻结") ? <Pill tone="red" dot={false}>{h.action}</Pill> : h.action.includes("监控") ? <Pill tone="amber" dot={false}>{h.action}</Pill> : <Pill tone="green" dot={false}>{h.action}</Pill>}</td>
                      <td className="px-4 py-2.5 font-semibold tnum">{h.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="px-4 py-8 text-center text-[12.5px] text-default-400">暂无命中记录。名单项生效后,事中筛查命中将记入此处。</p>}
          </div>

          {/* 操作区:状态门控 */}
          <div className="card p-5">
            <SectionLabel>名单操作 · 当前「{sd.label}」</SectionLabel>
            {actions.length ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {actions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button key={a.k} onClick={() => run(a)} className="flex items-start gap-3 rounded-xl border border-divider bg-default-50 p-3.5 text-left transition-colors hover:bg-default-100">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: a.tone ? "var(--brand-soft)" : "var(--chip-bg)", color: a.tone ? tc(a.tone) : "var(--text-3)" }}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold">{a.label}</span>
                        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-default-500">{a.tip}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-divider bg-default-50 p-4 text-[12.5px] text-default-500">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default-100 text-default-400"><Trash2 className="h-4 w-4" /></span>
                名单项已处于终态「{sd.label}」,不再参与事中筛查,亦无可执行的状态变更。
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-default-400">状态变更即时影响事中筛查处置,并记入活动日志与审计。制裁名单的移除 / 升级需经 MLRO 复核。</p>
          </div>
        </div>
      )}
    </Shell>
  );
}
