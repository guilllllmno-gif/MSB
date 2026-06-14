import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Input, Tabs, Tab, Pagination, Card } from "@heroui/react";
import { Search, Check, Users, Filter, MoreHorizontal } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, SoftChip, Initials, toneVar } from "@/components/bits";
import { ReviewDialog } from "@/components/ReviewDialog";
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
    const bucket = RC_STATES[alertStore.stateOf(a.id, a.state)].bucket;
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
          <Button size="sm" variant="bordered" startContent={<Check className="h-3.5 w-3.5" />}>批量认领</Button>
          <Button size="sm" variant="bordered" startContent={<Users className="h-3.5 w-3.5" />}>分配</Button>
        </>}
      />

      {/* stat tiles */}
      <Card shadow="sm" radius="lg" className="mb-[18px] border border-divider">
        <div className="grid grid-cols-7 divide-x divide-divider">
          {TILES.map((t) => {
            const on = filter === t.f;
            return (
              <button key={t.f} onClick={() => setFilter(t.f)} className="px-4 py-3.5 text-left transition-colors hover:bg-default-50"
                style={on ? { background: "var(--brand-softer)", boxShadow: "inset 0 -2px 0 var(--brand)" } : undefined}>
                <div className="flex items-center gap-1.5 text-[12px] text-default-500">{t.dot && <span className="h-[5px] w-[5px] rounded-full" style={{ background: toneVar(t.dot) }} />}{t.label}</div>
                <div className="mt-1.5 text-2xl font-bold tnum" style={on ? { color: "var(--brand)" } : undefined}>{t.num}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* toolbar */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <Input size="sm" radius="md" value={q} onValueChange={setQ} placeholder="搜索告警ID、订单号、地址或商户…" startContent={<Search className="h-4 w-4 text-default-400" />} className="max-w-[420px] flex-1" classNames={{ inputWrapper: "bg-content1 border border-divider shadow-none" }} />
        <Tabs size="sm" radius="md" selectedKey={SEG.includes(filter) ? filter : "all"} onSelectionChange={(k) => setFilter(String(k))} aria-label="severity" classNames={{ cursor: "bg-primary", tabContent: "group-data-[selected=true]:text-white" }}>
          <Tab key="all" title="全部" /><Tab key="high" title="高危" /><Tab key="mid" title="中危" /><Tab key="low" title="低危" />
        </Tabs>
        <Button size="sm" variant="bordered" startContent={<Filter className="h-3.5 w-3.5" />}>类型</Button>
      </div>

      {/* table */}
      <Table aria-label="交易警报" radius="lg" classNames={{ wrapper: "border border-divider shadow-sm p-0", th: "bg-default-50 text-default-500 text-[11.5px]", td: "py-3" }}>
        <TableHeader>
          <TableColumn>告警ID</TableColumn><TableColumn>风险等级</TableColumn><TableColumn>类型</TableColumn><TableColumn>命中告警</TableColumn>
          <TableColumn>商户 / 订单</TableColumn><TableColumn>金额</TableColumn><TableColumn>网络</TableColumn>
          <TableColumn>状态</TableColumn><TableColumn>分配给</TableColumn><TableColumn>时间</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="没有符合条件的告警">
          {rows.map((a) => {
            const sd = RC_STATES[alertStore.stateOf(a.id, a.state)];
            const assignee = alertStore.assigneeOf(a.id, a.assignee);
            const sev = sevMeta[a.sev];
            return (
              <TableRow key={a.id}>
                <TableCell><span className="font-mono text-[12px] font-semibold" style={{ color: "var(--brand)" }}>{a.id}</span></TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-full" style={{ background: toneVar(sev.tone) }} /><span className="font-semibold" style={{ color: toneVar(sev.tone) }}>{sev.label}</span><span className="text-[12px] text-default-400 tnum">{a.score}</span></span></TableCell>
                <TableCell><SoftChip>{a.type}</SoftChip></TableCell>
                <TableCell><div className="text-[13px] font-semibold">{a.title}</div><div className="text-[11px] text-default-400">{a.ruleShort}</div></TableCell>
                <TableCell><div className="text-[13px] font-semibold">{a.merchant}</div><div className="font-mono text-[11px] text-default-400">{a.order}</div></TableCell>
                <TableCell><span className="font-semibold tnum">{a.amount}</span></TableCell>
                <TableCell><SoftChip net>◈ {a.network}</SoftChip></TableCell>
                <TableCell><Pill tone={sd.cls}>{sd.label}</Pill></TableCell>
                <TableCell>{assignee ? <span className="inline-flex items-center gap-1.5"><Initials p={assignee} />{assignee.n}</span> : <span className="text-default-400">未分配</span>}</TableCell>
                <TableCell><span className="text-[12px] text-default-400">{a.ago}</span></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Button size="sm" color="primary" onPress={() => openReview(a.id)}>审核</Button>
                    <Button size="sm" variant="bordered" onPress={() => nav(`/alert?id=${a.id}`)}>详情</Button>
                    <Button isIconOnly size="sm" variant="bordered"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="mt-3.5 flex items-center justify-between text-[12.5px] text-default-500">
        <span>显示 {rows.length} · 全部 128 条</span>
        <Pagination size="sm" total={7} initialPage={1} showControls />
      </div>

      <ReviewDialog alertId={reviewId} open={reviewOpen} onOpenChange={setReviewOpen} />
    </Shell>
  );
}
