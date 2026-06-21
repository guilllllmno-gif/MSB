import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tooltip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input } from "@heroui/react";
import { Eye, Plus, Search, Shield, ExternalLink, ShieldCheck } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, SoftChip } from "@/components/bits";
import { AddToListDrawer } from "@/components/AddToListDrawer";
import { LISTS, LCAT, LCATS, LSTATE, LENTRY_TYPE_TONE, type ListEntry, type ListCat, type LStatus } from "@/lib/lists";
import { listStore, useListVersion } from "@/lib/store";

const TILES: { f: string; label: string }[] = [
  { f: "all", label: "全部" },
  { f: "active", label: "生效中" },
  { f: "pending", label: "待复核" },
  { f: "paused", label: "已暂停" },
  { f: "expired", label: "已过期" },
  { f: "removed", label: "已移除" },
];

export default function ListsPage() {
  const nav = useNavigate();
  useListVersion();
  const [filter, setFilter] = useState("all");
  const [cat, setCat] = useState<"all" | ListCat>("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const all: ListEntry[] = [...listStore.created(), ...LISTS];
  const stOf = (e: ListEntry) => listStore.statusOf(e.id, e.status) as LStatus;

  const count = (key: string) => all.filter((e) => key === "all" || stOf(e) === key).length;
  const rows = all.filter((e) => {
    const okF = filter === "all" || stOf(e) === filter;
    const okC = cat === "all" || e.cat === cat;
    const okQ = !q.trim() || (e.id + e.value + e.risk + e.source).toLowerCase().includes(q.toLowerCase());
    return okF && okC && okQ;
  });

  // 概览
  const live = all.filter((e) => stOf(e) !== "removed");
  const catCount = (c: ListCat) => live.filter((e) => e.cat === c).length;
  const hitsSum = live.reduce((a, e) => a + e.hits30, 0);
  const pendingN = all.filter((e) => stOf(e) === "pending").length;

  const open = (e: ListEntry) => nav(`/list-entry?id=${e.id}`);

  return (
    <Shell crumb={["治理与合规", "名单管理"]} wide>
      <PageHead
        title="名单管理"
        sub="实时筛查名单库 —— 制裁(法定硬拦截)/ 内部黑名单(确认主体)/ 关注(升级监控)/ 白名单(放行豁免)。名单是事中筛查的数据底座;告警研判、案件、团伙、事后监控的结论在此沉淀,反哺实时拦截。"
        actions={<Button size="sm" radius="full" color="primary" variant="flat" startContent={<Plus className="h-3.5 w-3.5" />} onPress={() => setAddOpen(true)}>新增名单项</Button>}
      />

      {/* 名单概览 */}
      <div className="card mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Shield className="h-4 w-4" /></span>
        <span className="text-[13px] font-bold">名单概览</span>
        <span className="text-[12px] text-default-400">筛查结论沉淀 → 事中实时拦截 / 监控 / 放行</span>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-default-500">
          {LCATS.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: `var(${c === "sanctions" ? "--danger" : c === "block" ? "--violet" : c === "watch" ? "--warning" : "--success"})` }} />
              {LCAT[c].label} <b className="text-foreground tnum">{catCount(c)}</b>
            </span>
          ))}
          <span>近30天拦截命中 <b className="tnum" style={{ color: "var(--brand)" }}>{hitsSum.toLocaleString()}</b></span>
          <span>待复核 <b className="tnum" style={{ color: pendingN ? "var(--warning)" : undefined }}>{pendingN}</b></span>
        </div>
      </div>

      {/* 状态分桶 tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map((t) => {
          const on = filter === t.f;
          return (
            <button key={t.f} onClick={() => setFilter(t.f)} className={`card card-hover px-3.5 py-3 text-left ${on ? "outline outline-2 -outline-offset-2 outline-[var(--brand)]" : ""}`}>
              <div className="text-[12px] text-default-500">{t.label}</div>
              <div className="mt-1.5 text-[24px] font-extrabold leading-none tnum" style={{ color: on ? "var(--brand)" : undefined }}>{count(t.f)}</div>
            </button>
          );
        })}
      </div>

      {/* 类别筛选 + 搜索 */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setCat("all")} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${cat === "all" ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:bg-default-100"}`}>全部类别</button>
          {LCATS.map((c) => {
            const on = cat === c;
            const Icon = LCAT[c].icon;
            return <button key={c} onClick={() => setCat(c)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:bg-default-100"}`}><Icon className="h-3.5 w-3.5" />{LCAT[c].label}</button>;
          })}
        </div>
        <Input size="sm" radius="full" value={q} onValueChange={setQ} placeholder="搜索名单项值、风险或来源…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="ml-auto max-w-[300px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
      </div>

      {/* 名单库 */}
      <Table aria-label="名单管理" radius="lg" classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] align-top", tr: "border-b border-default-100 last:border-0 transition-colors data-[hover=true]:bg-default-50 hover:bg-default-50" }}>
        <TableHeader>
          <TableColumn>名单项 / 类型</TableColumn><TableColumn>类别</TableColumn><TableColumn>来源</TableColumn>
          <TableColumn>适用范围</TableColumn><TableColumn>近30天命中</TableColumn><TableColumn>状态</TableColumn>
          <TableColumn>添加人</TableColumn><TableColumn>到期</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="没有符合条件的名单项">
          {rows.map((e) => {
            const st = stOf(e);
            const owner = listStore.ownerOf(e.id, e.addedBy) || e.addedBy;
            const CIcon = LCAT[e.cat].icon;
            const quick = st === "active" || st === "pending";
            return (
              <TableRow key={e.id}>
                <TableCell>
                  <button onClick={() => open(e)} className="text-left">
                    <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><CIcon className="h-4 w-4" /></span>{e.value}</span>
                    <div className="ml-9 mt-0.5 flex items-center gap-1.5"><Pill tone={LENTRY_TYPE_TONE[e.entryType]} dot={false}>{e.entryType}</Pill><span className="text-[11px] text-default-400">{e.risk} · {e.id}</span></div>
                  </button>
                </TableCell>
                <TableCell><Pill tone={LCAT[e.cat].tone} dot={false}>{LCAT[e.cat].label}</Pill></TableCell>
                <TableCell>{e.to && e.srcId ? <button onClick={() => nav(e.to!)} className="inline-flex items-center gap-1 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--brand)] hover:opacity-80">{e.source} · {e.srcId} <ExternalLink className="h-3 w-3" /></button> : <span className="text-[12px] text-default-500">{e.source}</span>}</TableCell>
                <TableCell><span className="text-[12.5px] text-default-600">{e.scope}</span></TableCell>
                <TableCell>{st === "active" && e.hits30 ? <span className="tnum font-semibold">{e.hits30}</span> : <span className="text-default-400">—</span>}</TableCell>
                <TableCell><Pill tone={LSTATE[st].tone}>{LSTATE[st].label}</Pill></TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5"><span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: owner.c }}>{owner.i}</span>{owner.n}</span></TableCell>
                <TableCell><span className={`text-[12px] ${e.expiry === "长期有效" ? "text-default-500" : "tnum text-default-600"}`}>{e.expiry || "—"}</span></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Tooltip content="查看 / 管理" size="sm" delay={300}><Button isIconOnly size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => open(e)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button></Tooltip>
                    {quick && <Tooltip content={st === "pending" ? "复核生效" : "状态管理"} size="sm" delay={300}><Button size="sm" radius="full" color="primary" variant="flat" startContent={<ShieldCheck className="h-3.5 w-3.5" />} onPress={() => open(e)}>{st === "pending" ? "复核" : "管理"}</Button></Tooltip>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="mt-3 flex items-center gap-2 text-[11.5px] text-default-400">
        <SoftChip>提示</SoftChip>
        制裁名单为法定硬拦截、即时生效;其余类别先进「待复核」,复核生效后纳入事中筛查。
      </div>

      <AddToListDrawer open={addOpen} onOpenChange={setAddOpen} />
    </Shell>
  );
}
