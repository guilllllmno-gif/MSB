import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Check, Users, Filter, MoreHorizontal } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Chip, Avatar, toneVar } from "@/components/bits";
import { ReviewDialog } from "@/components/ReviewDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { alerts, RC_STATES, sevMeta, type Tone } from "@/lib/data";
import { alertStore, useAlertVersion } from "@/lib/store";

const TILES: { f: string; label: string; dot?: Tone; num: number }[] = [
  { f: "all", label: "全部", num: 128 },
  { f: "high", label: "高危", dot: "red", num: 19 },
  { f: "mid", label: "中危", dot: "amber", num: 63 },
  { f: "low", label: "低危", dot: "blue", num: 46 },
  { f: "unclaimed", label: "待认领", dot: "grey", num: 24 },
  { f: "escalated", label: "已升级", dot: "violet", num: 5 },
  { f: "done", label: "今日已结", dot: "green", num: 87 },
];
const SEG = ["all", "high", "mid", "low"];

export default function AlertList() {
  const nav = useNavigate();
  useAlertVersion();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const rows = alerts.filter((a) => {
    const st = alertStore.stateOf(a.id, a.state);
    const bucket = RC_STATES[st].bucket;
    const okF = filter === "all" ? true : SEG.includes(filter) ? a.sev === filter : bucket === filter;
    const okQ = !q.trim() || (a.id + a.order + a.merchant).toLowerCase().includes(q.toLowerCase());
    return okF && okQ;
  });

  const openReview = (id: string) => { setReviewId(id); setReviewOpen(true); };

  return (
    <Shell crumb={["风控", "监控运营", "交易警报"]}>
      <PageHead
        title="交易警报"
        sub="调查规则引擎与链上监控产生的风险信号 — 研判后决定建案、STR 上报或加入名单；资金的实际放行/拒绝在「事中监控」闸口执行。"
        actions={<>
          <Button variant="outline" size="sm"><Check className="h-3.5 w-3.5" />批量认领</Button>
          <Button variant="outline" size="sm"><Users className="h-3.5 w-3.5" />分配</Button>
        </>}
      />

      {/* stat tiles */}
      <div className="mb-[18px] overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-7 divide-x">
          {TILES.map((t) => {
            const on = filter === t.f;
            return (
              <button key={t.f} onClick={() => setFilter(t.f)} className="px-4 py-3.5 text-left transition-colors hover:bg-secondary/40"
                style={on ? { background: "var(--brand-softer)", boxShadow: "inset 0 -2px 0 var(--brand)" } : undefined}>
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">{t.dot && <span className="h-[5px] w-[5px] rounded-full" style={{ background: toneVar(t.dot) }} />}{t.label}</div>
                <div className="mt-1.5 text-2xl font-bold tnum">{t.num}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* toolbar */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-9 min-w-[260px] max-w-[420px] flex-1 items-center gap-2 rounded-lg border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索告警ID、订单号、地址或商户…" className="flex-1 bg-transparent text-[13px] outline-none" />
        </div>
        <div className="flex items-center rounded-lg border bg-card p-0.5">
          {SEG.map((s) => (
            <button key={s} onClick={() => setFilter(s)} className="rounded-md px-3 py-1 text-[12.5px] font-semibold transition-colors"
              style={filter === s ? { background: "var(--brand)", color: "#fff" } : { color: "var(--muted-foreground)" }}>{s === "all" ? "全部" : sevMeta[s].label}</button>
          ))}
        </div>
        <Button variant="outline" size="sm"><Filter className="h-3.5 w-3.5" />类型</Button>
      </div>

      {/* table */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>告警ID</TableHead><TableHead>风险等级</TableHead><TableHead>类型</TableHead><TableHead>命中告警</TableHead>
            <TableHead>商户 / 订单</TableHead><TableHead className="text-right">金额</TableHead><TableHead>网络</TableHead>
            <TableHead>状态</TableHead><TableHead>分配给</TableHead><TableHead>时间</TableHead><TableHead className="text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((a) => {
              const st = alertStore.stateOf(a.id, a.state);
              const sd = RC_STATES[st];
              const assignee = alertStore.assigneeOf(a.id, a.assignee);
              const sev = sevMeta[a.sev];
              return (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => nav(`/alert?id=${a.id}`)}>
                  <TableCell><span className="font-mono text-[12px] font-semibold" style={{ color: "var(--brand)" }}>{a.id}</span></TableCell>
                  <TableCell><span className="inline-flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full" style={{ background: toneVar(sev.tone) }} /><span className="font-semibold" style={{ color: toneVar(sev.tone) }}>{sev.label}</span><span className="text-[12px] text-muted-foreground tnum">{a.score}</span></span></TableCell>
                  <TableCell><Chip>{a.type}</Chip></TableCell>
                  <TableCell><div className="text-[13px] font-semibold">{a.title}</div><div className="text-[11px] text-muted-foreground">{a.ruleShort}</div></TableCell>
                  <TableCell><div className="text-[13px] font-semibold">{a.merchant}</div><div className="font-mono text-[11px] text-muted-foreground">{a.order}</div></TableCell>
                  <TableCell className="text-right font-semibold tnum">{a.amount}</TableCell>
                  <TableCell><Chip net>◈ {a.network}</Chip></TableCell>
                  <TableCell><Pill tone={sd.cls}>{sd.label}</Pill></TableCell>
                  <TableCell>{assignee ? <span className="inline-flex items-center gap-1.5"><Avatar p={assignee} />{assignee.n}</span> : <span className="text-muted-foreground">未分配</span>}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{a.ago}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" style={{ background: "var(--brand)" }} onClick={() => openReview(a.id)}>审核</Button>
                      <Button size="sm" variant="outline" onClick={() => nav(`/alert?id=${a.id}`)}>详情</Button>
                      <Button size="icon" variant="outline" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-4 py-3 text-[12.5px] text-muted-foreground">
          <span>显示 {rows.length} · 全部 128 条</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline">上一页</Button>
            <Button size="sm" style={{ background: "var(--brand)" }} className="min-w-8">1</Button>
            <Button size="sm" variant="outline" className="min-w-8">2</Button>
            <Button size="sm" variant="outline" className="min-w-8">7</Button>
            <Button size="sm" variant="outline">下一页</Button>
          </div>
        </div>
      </Card>

      <ReviewDialog alertId={reviewId} open={reviewOpen} onOpenChange={setReviewOpen} />
    </Shell>
  );
}