import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tooltip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input } from "@heroui/react";
import { FileText, Eye, Clock, Download, AlertTriangle, ArrowRight, Search, UserRound, Plus } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials, SoftChip } from "@/components/bits";
import { NewReportDrawer } from "@/components/NewReportDrawer";
import { RTYPE, RSTATE, type Report } from "@/lib/reports";
import { allReports, liveStatus } from "@/lib/reportsAll";
import { reportStore, useReportVersion, useCaseVersion } from "@/lib/store";
import { urgencyColor } from "@/lib/data";

const TILES: { f: string; label: string }[] = [
  { f: "all", label: "全部" },
  { f: "draft", label: "草稿" },
  { f: "review", label: "待复核" },
  { f: "queued", label: "待报送" },
  { f: "filed", label: "已报送" },
  { f: "ack", label: "已接收" },
  { f: "returned", label: "退回·补正" },
];
const TYPES: { f: string; label: string }[] = [
  { f: "all", label: "全部类型" },
  { f: "STR", label: "STR · 可疑交易" },
  { f: "LVCTR", label: "LVCTR · 大额虚拟货币" },
  { f: "TPR", label: "TPR · 制裁财产" },
];

export default function ReportFiling() {
  const nav = useNavigate();
  useReportVersion();
  useCaseVersion();
  const [filter, setFilter] = useState("all");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  // 报告全集 = 案件派生 STR + 手动新建 + 静态 LVCTR/TPR(口径见 lib/reportsAll)
  const all: Report[] = allReports();
  const stOf = liveStatus;

  const count = (key: string) => all.filter((r) => key === "all" || stOf(r) === key).length;
  const rows = all.filter((r) => {
    const okF = filter === "all" || stOf(r) === filter;
    const okT = type === "all" || r.type === type;
    const okQ = !q.trim() || (r.id + r.subject + r.summary + r.src).toLowerCase().includes(q.toLowerCase());
    return okF && okT && okQ;
  });

  // 需立即处理:被退回需补正 + 待MLRO复核 + 已报送待回执
  const returnedN = all.filter((r) => stOf(r) === "returned").length;
  const reviewN = all.filter((r) => stOf(r) === "review").length;
  const filedN = all.filter((r) => stOf(r) === "filed").length;
  const openN = all.filter((r) => RSTATE[stOf(r)].active).length;

  const review = (r: Report) => nav(`/report?id=${r.id}`);

  return (
    <Shell crumb={["治理与合规", "报告报送"]} wide>
      <PageHead
        title="报告报送"
        sub="FINTRAC 合规上报工作台(MLRO 视图)—— STR 一律由「案件管理」确认可疑后派生(单一发起点);LVCTR 系统按客观阈值自动归集、TPR 制裁命中即时上报。在此复核、报送并跟踪 FINTRAC 受理回执。"
        actions={<>
          <Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<Download className="h-3.5 w-3.5" />}>导出报送台账</Button>
          <Button size="sm" radius="full" color="primary" startContent={<Plus className="h-3.5 w-3.5" />} onPress={() => setNewOpen(true)}>新建报告</Button>
        </>}
      />

      {/* 需立即处理 —— 时限驱动 */}
      <div className="card mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--danger)" }}><AlertTriangle className="h-4 w-4" /></span>
        <span className="text-[13px] font-bold">报送时限 · 需立即处理</span>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-default-500">
          <span>被退回需补正 <b className="tnum" style={{ color: returnedN ? "var(--danger)" : undefined }}>{returnedN}</b></span>
          <span>待 MLRO 复核 <b className="tnum" style={{ color: reviewN ? "var(--warning)" : undefined }}>{reviewN}</b></span>
          <span>已报送待回执 <b className="tnum">{filedN}</b></span>
          <span>在办报告 <b className="text-foreground tnum">{openN}</b></span>
        </div>
      </div>

      {/* 状态分桶 tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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

      {/* 类型筛选 + 搜索 */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPES.map((t) => {
            const on = type === t.f;
            return (
              <button key={t.f} onClick={() => setType(t.f)} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:bg-default-100"}`}>{t.label}</button>
            );
          })}
        </div>
        <Input size="sm" radius="full" value={q} onValueChange={setQ} placeholder="搜索报告号、主体或来源…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="ml-auto max-w-[320px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
      </div>

      {/* 报送台账 */}
      <Table aria-label="报告报送台账" radius="lg" classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] align-top", tr: "border-b border-default-100 last:border-0 transition-colors data-[hover=true]:bg-default-50 hover:bg-default-50" }}>
        <TableHeader>
          <TableColumn>报告编号 / 类型</TableColumn><TableColumn>来源</TableColumn><TableColumn>涉事主体</TableColumn>
          <TableColumn>金额</TableColumn><TableColumn>报送摘要</TableColumn><TableColumn>状态</TableColumn>
          <TableColumn>MLRO</TableColumn><TableColumn>报送时限</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="没有符合条件的报告">
          {rows.map((r) => {
            const st = stOf(r);
            const ty = RTYPE[r.type];
            const mlro = reportStore.mlroOf(r.id, r.mlro);
            const ref = reportStore.refOf(r.id, r.ref);
            const active = RSTATE[st].active;
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <button onClick={() => review(r)} className="text-left">
                    <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><FileText className="h-4 w-4" /></span>{r.id}</span>
                    <div className="ml-9"><SoftChip>{ty.label} · {ty.full}</SoftChip></div>
                  </button>
                </TableCell>
                <TableCell>{r.to ? <button onClick={() => nav(r.to!)} className="text-left text-default-600 hover:text-primary"><span className="font-medium">{r.src}</span><div className="text-[11px] text-default-400">{r.srcId}</div></button> : <><span className="font-medium text-default-600">{r.src}</span>{r.srcId && <div className="text-[11px] text-default-400">{r.srcId}</div>}</>}</TableCell>
                <TableCell><span className="font-medium">{r.subject}</span><div className="text-[11px] text-default-400">{r.sub}</div></TableCell>
                <TableCell><span className="font-semibold tnum whitespace-nowrap">{r.amount}</span></TableCell>
                <TableCell><span className="block max-w-[280px] text-[12.5px] leading-snug text-default-600">{r.summary}</span></TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Pill tone={RSTATE[st].tone}>{RSTATE[st].label}</Pill>
                    {ref && <span className="text-[10.5px] text-default-400">{ref}</span>}
                  </div>
                </TableCell>
                <TableCell>{mlro ? <span className="inline-flex items-center gap-1.5"><Initials p={mlro} size={22} />{mlro.n}</span> : <span className="inline-flex items-center gap-1.5 text-default-400"><UserRound className="h-3.5 w-3.5" />待指派</span>}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1" style={{ color: urgencyColor(r.due.tone) }}><Clock className="h-3.5 w-3.5" />{r.due.text}</span></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Tooltip content="查看详情" size="sm" delay={300}><Button isIconOnly aria-label="查看详情" size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => review(r)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button></Tooltip>
                    {active && <Tooltip content="进详情复核 / 报送" size="sm" delay={300}><Button size="sm" radius="full" color="primary" variant="flat" endContent={<ArrowRight className="h-3.5 w-3.5" />} onPress={() => review(r)}>复核</Button></Tooltip>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <NewReportDrawer open={newOpen} onOpenChange={setNewOpen} />
    </Shell>
  );
}
