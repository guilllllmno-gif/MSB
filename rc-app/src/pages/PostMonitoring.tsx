import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tooltip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Drawer, DrawerContent, DrawerHeader, DrawerBody } from "@heroui/react";
import { History, ClipboardCheck, Eye, Clock, UserRound } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { FINDINGS, FSTATES, BATCHES, type Finding, type FState } from "@/lib/findings";
import { findingStore, useFindingVersion } from "@/lib/store";

const TILES: { f: string; label: string }[] = [
  { f: "all", label: "全部" },
  { f: "new", label: "待认领" },
  { f: "progress", label: "处理中" },
  { f: "pending", label: "待补材料" },
  { f: "escalated", label: "已升级" },
  { f: "tracing", label: "追溯中" },
  { f: "closed", label: "已结案" },
];
const matchTile = (f: string, st: FState) => f === "all" ? true : f === "closed" ? st.startsWith("closed") : st === f;

export default function PostMonitoring() {
  const nav = useNavigate();
  useFindingVersion();
  const [filter, setFilter] = useState("all");
  const [hist, setHist] = useState(false);

  const stOf = (f: Finding) => findingStore.statusOf(f.id, f.status) as FState;
  const count = (key: string) => FINDINGS.filter((f) => matchTile(key, stOf(f))).length;
  const rows = FINDINGS.filter((f) => matchTile(filter, stOf(f)));

  const batchHits = FINDINGS.filter((f) => f.batch === "#20260619-02").length;
  const pendingN = FINDINGS.filter((f) => !stOf(f).startsWith("closed")).length;

  return (
    <Shell crumb={["交易", "交易监控", "事后监控"]} wide>
      <PageHead title="事后监控" sub="交易完成后的回溯 / 批量监控 —— 资金已出账、事中已无法拦截;每个命中项进入详情认领回溯,确认可疑则进入追溯、补 STR / 转案件,并回填检测规则。" />

      {/* batch status — slim strip (no nested tiles; counts live in the status tiles below) */}
      <div className="card mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-default-100 text-default-500"><History className="h-4 w-4" /></span>
        <span className="text-[13px] font-bold">回溯扫描 · 批次 #20260619-02</span>
        <Pill tone="green">已完成</Pill>
        <span className="text-[12px] text-default-400">扫描区间 06-18 00:00 ～ 24:00 · 02:14 完成 · 下次 明日 02:00</span>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-default-500">
          <span>本批扫描 <b className="text-foreground tnum">1.27M</b></span>
          <span>命中 <b className="text-foreground tnum">{batchHits}</b></span>
          <span>待处理 <b className="tnum" style={{ color: "var(--danger)" }}>{pendingN}</b></span>
          <button onClick={() => setHist(true)} className="inline-flex items-center gap-0.5 font-semibold text-primary hover:opacity-80">批次历史 <History className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* status tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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

      {/* findings table — 审核进详情页 */}
      <Table aria-label="事后监控命中" radius="lg" classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] align-top", tr: "border-b border-default-100 last:border-0 transition-colors data-[hover=true]:bg-default-50 hover:bg-default-50" }}>
        <TableHeader>
          <TableColumn>风险模式</TableColumn><TableColumn>主体</TableColumn><TableColumn>命中说明</TableColumn>
          <TableColumn>涉及金额</TableColumn><TableColumn>状态</TableColumn><TableColumn>分配给</TableColumn><TableColumn>SLA剩余</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="没有符合条件的回溯命中">
          {rows.map((f) => {
            const st = stOf(f);
            const trace = findingStore.traceOf(f.id, f.trace);
            const backfill = findingStore.backfillOf(f.id, f.backfill);
            const owner = findingStore.ownerOf(f.id, f.owner);
            const Icon = f.icon;
            return (
              <TableRow key={f.id}>
                <TableCell><button onClick={() => nav(`/finding?id=${f.id}`)} className="text-left"><span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><Icon className="h-4 w-4" /></span>{f.pattern}</span><div className="ml-9 text-[11px] text-default-400">{f.id} · {f.period}</div></button></TableCell>
                <TableCell><span className="font-medium">{f.subject}</span></TableCell>
                <TableCell><span className="block max-w-[280px] text-[12.5px] leading-snug text-default-600">{f.hit}</span></TableCell>
                <TableCell><div className="font-semibold tnum whitespace-nowrap">{f.amount}</div><div className="mt-0.5 text-[10.5px] text-default-400">已出账</div></TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Pill tone={FSTATES[st].tone}>{FSTATES[st].label}</Pill>
                    {trace && <span className="text-[10.5px] text-default-400">{trace}</span>}
                    {backfill && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--success-bg)", color: "var(--success)" }}>已回填规则</span>}
                  </div>
                </TableCell>
                <TableCell>{owner ? <span className="inline-flex items-center gap-1.5"><Initials p={owner} size={22} />{owner.n}</span> : <span className="inline-flex items-center gap-1.5 text-default-400"><UserRound className="h-3.5 w-3.5" />未分配</span>}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1" style={{ color: f.sla.tone === "red" ? "var(--danger)" : f.sla.tone === "amber" ? "var(--warning)" : "var(--text-3)" }}><Clock className="h-3.5 w-3.5" />{f.sla.text}</span></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Tooltip content="查看详情" size="sm" delay={300}><Button isIconOnly size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => nav(`/finding?id=${f.id}`)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button></Tooltip>
                    <Tooltip content="进入详情审核" size="sm" delay={300}><Button size="sm" radius="full" color="primary" variant="flat" startContent={<ClipboardCheck className="h-3.5 w-3.5" />} onPress={() => nav(`/finding?id=${f.id}`)}>审核</Button></Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* 批次历史 drawer */}
      <Drawer isOpen={hist} onOpenChange={setHist} placement="right" size="lg">
        <DrawerContent>
          <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
            <span className="text-[15px] font-bold">回溯批次历史</span>
            <span className="text-[11.5px] font-normal text-default-400">每日 02:00 全量回扫 · 近 6 批</span>
          </DrawerHeader>
          <DrawerBody className="py-3">
            <Table aria-label="批次历史" radius="lg" removeWrapper classNames={{ th: "bg-default-50 text-default-500 text-[11.5px] font-medium h-10 whitespace-nowrap", td: "py-3 text-[12.5px] whitespace-nowrap" }}>
              <TableHeader>
                <TableColumn>批次</TableColumn><TableColumn>扫描区间</TableColumn><TableColumn>扫描量</TableColumn>
                <TableColumn>命中</TableColumn><TableColumn>确认可疑</TableColumn><TableColumn>误报</TableColumn><TableColumn>状态</TableColumn>
              </TableHeader>
              <TableBody>
                {BATCHES.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell><span className="font-semibold">{b.id}</span><div className="text-[10.5px] text-default-400">{b.done} 完成</div></TableCell>
                    <TableCell><span className="text-default-500">{b.window}</span></TableCell>
                    <TableCell><span className="tnum">{b.scanned}</span></TableCell>
                    <TableCell><span className="tnum font-semibold">{b.hits}</span></TableCell>
                    <TableCell><span className="tnum" style={{ color: b.confirmed ? "var(--danger)" : undefined }}>{b.confirmed}</span></TableCell>
                    <TableCell><span className="tnum text-default-500">{b.fp}</span></TableCell>
                    <TableCell><Pill tone="green">{b.status}</Pill></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Shell>
  );
}
