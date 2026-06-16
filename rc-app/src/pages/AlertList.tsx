import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Input, Pagination } from "@heroui/react";
import { Search, SlidersHorizontal, Tag, Clock, CheckCircle2, AlertTriangle, CircleArrowUp, CircleDot, UserRound, FolderOpen, XCircle, Check, Users } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { ReviewDialog } from "@/components/ReviewDialog";
import { alerts, RC_STATES, sevMeta } from "@/lib/data";
import { alertStore, useAlertVersion } from "@/lib/store";

const TILES: { f: string; label: string }[] = [
  { f: "all", label: "全部警报" },
  { f: "unclaimed", label: "待认领" },
  { f: "progress", label: "处理中" },
  { f: "pending", label: "待补充材料" },
  { f: "escalated", label: "已升级" },
  { f: "done", label: "已结案" },
];
const matchTile = (f: string, state: string) =>
  f === "all" ? true
    : f === "unclaimed" ? state === "new"
    : f === "progress" ? state === "progress" || state === "pending_l2"
    : f === "pending" ? state === "pending"
    : f === "escalated" ? state === "escalated"
    : f === "done" ? state.startsWith("closed") : false;

const STATUS_ICON: Record<string, typeof Clock> = {
  new: Clock, progress: CircleDot, pending_l2: Clock, pending: AlertTriangle,
  escalated: CircleArrowUp, closed_done: CheckCircle2, closed_case: FolderOpen, closed_fp: XCircle,
};
const sevShort = (s: string) => (s === "high" ? "高" : s === "mid" ? "中" : "低");

function fundStatus(a: typeof alerts[number], state: string): string {
  if (state === "escalated" || a.sanctions.status === "直接命中") return "账户冻结";
  if (state === "pending") return "审核拒绝";
  if (state.startsWith("closed")) return a.sev === "low" ? "审核入账" : "审核拒绝";
  return a.type === "提现" ? "暂缓出金" : "暂缓入账";
}

export default function AlertList() {
  const nav = useNavigate();
  useAlertVersion();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const count = (f: string) => alerts.filter((a) => matchTile(f, alertStore.stateOf(a.id, a.state))).length;
  const rows = alerts.filter((a) => {
    const st = alertStore.stateOf(a.id, a.state);
    const okQ = !q.trim() || (a.id + a.order + a.merchant).toLowerCase().includes(q.toLowerCase());
    return matchTile(filter, st) && okQ;
  });
  const openReview = (id: string) => { setReviewId(id); setReviewOpen(true); };

  return (
    <Shell crumb={["交易", "交易监控", "交易警报"]} wide>
      <PageHead
        title="交易警报"
        sub="规则引擎与链上监控产生的实时告警，点击任意告警查看详情与处置。"
        actions={<>
          <Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<Check className="h-3.5 w-3.5" />}>批量认领</Button>
          <Button size="sm" radius="full" color="primary" startContent={<Users className="h-3.5 w-3.5" />}>分配</Button>
        </>}
      />

      {/* lifecycle filter tiles — soft floating cards, active = blue accent */}
      <div className="mb-5 grid grid-cols-3 gap-3.5 md:grid-cols-6">
        {TILES.map((t) => {
          const on = filter === t.f;
          return (
            <button key={t.f} onClick={() => setFilter(t.f)}
              className={`card card-hover px-4 py-3.5 text-left ${on ? "outline outline-2 -outline-offset-2 outline-[var(--brand)]" : ""}`}>
              <div className="text-[12.5px] text-default-500">{t.label}</div>
              <div className="mt-1.5 text-[26px] font-extrabold leading-none tnum" style={{ color: on ? "var(--brand)" : undefined }}>{count(t.f)}</div>
            </button>
          );
        })}
      </div>

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input size="sm" radius="full" value={q} onValueChange={setQ} placeholder="搜索告警ID、订单号或商户…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="max-w-[360px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<SlidersHorizontal className="h-3.5 w-3.5" />}>风险等级</Button>
          <Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<Tag className="h-3.5 w-3.5" />}>交易类型</Button>
        </div>
      </div>

      {/* table — soft floating card, borderless */}
      <Table aria-label="交易警报" radius="lg"
        classNames={{ wrapper: "card p-0 rounded-[18px] overflow-x-auto", th: "bg-transparent text-default-400 text-[11.5px] font-medium border-b border-divider whitespace-nowrap first:rounded-tl-none", td: "py-4 text-[13px] whitespace-nowrap", tr: "border-b border-default-100/70 last:border-0" }}>
        <TableHeader>
          <TableColumn>警报ID</TableColumn><TableColumn>商户名称/交易ID</TableColumn><TableColumn>类型</TableColumn>
          <TableColumn>风险评分</TableColumn><TableColumn>命中告警</TableColumn><TableColumn>交易金额</TableColumn>
          <TableColumn>状态</TableColumn><TableColumn>资金状态</TableColumn><TableColumn>经手人</TableColumn>
          <TableColumn>SLA剩余</TableColumn><TableColumn>触发时间</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="没有符合条件的告警">
          {rows.map((a) => {
            const st = alertStore.stateOf(a.id, a.state);
            const sd = RC_STATES[st];
            const assignee = alertStore.assigneeOf(a.id, a.assignee);
            const Icon = STATUS_ICON[st] || Clock;
            return (
              <TableRow key={a.id}>
                <TableCell><span className="font-mono text-[12.5px] font-medium">{a.id}</span></TableCell>
                <TableCell><div className="font-semibold">{a.merchant}</div><div className="font-mono text-[11px] text-default-400">{a.order}</div></TableCell>
                <TableCell><span className="text-default-600">{a.type}</span></TableCell>
                <TableCell><span className="rounded-md bg-default-100 px-2 py-0.5 text-[12px] font-semibold text-default-700">{sevShort(a.sev)} {a.score}</span></TableCell>
                <TableCell><span className="text-default-700">{a.title}</span></TableCell>
                <TableCell><span className="font-semibold tnum">{a.amount}</span></TableCell>
                <TableCell><Pill tone={sd.cls} icon={<Icon className="h-3 w-3" />}>{sd.label}</Pill></TableCell>
                <TableCell><span className="text-default-500">{fundStatus(a, st)}</span></TableCell>
                <TableCell>{assignee ? <span className="inline-flex items-center gap-1.5"><Initials p={assignee} size={22} />{assignee.n}</span> : <span className="inline-flex items-center gap-1.5 text-default-400"><UserRound className="h-3.5 w-3.5" />未分配</span>}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1 text-default-500"><Clock className="h-3.5 w-3.5" />{a.sla.text.replace("剩 ", "")}</span></TableCell>
                <TableCell><span className="text-default-500 tnum">{a.submitted}</span></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Button size="sm" radius="full" variant="light" className="min-w-0 text-default-600" onPress={() => openReview(a.id)}>认领</Button>
                    {st === "new"
                      ? <Button size="sm" radius="full" color="primary" variant="flat" onPress={() => openReview(a.id)}>审核</Button>
                      : <Button size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => nav(`/alert?id=${a.id}`)}>查看</Button>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="mt-4 flex items-center justify-between text-[12.5px] text-default-500">
        <span>显示 1-10 · 全部 120 条</span>
        <Pagination size="sm" total={10} initialPage={1} showControls variant="light" />
      </div>

      <ReviewDialog alertId={reviewId} open={reviewOpen} onOpenChange={setReviewOpen} />
    </Shell>
  );
}