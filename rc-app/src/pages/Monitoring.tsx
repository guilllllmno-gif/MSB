import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tooltip, Tabs, Tab, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { Clock, ClipboardCheck, Eye } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill } from "@/components/bits";
import { ReviewDialog } from "@/components/ReviewDialog";
import { alerts, RC_STATES, GATE_STATES, urgencyColor, slaOfAlert, type Alert } from "@/lib/data";
import { alertStore, useAlertVersion } from "@/lib/store";

const toneCss = (t: string) => (t === "green" ? "var(--success)" : urgencyColor(t, "var(--brand)")); // 见 lib/data
const sevShort = (s: string) => (s === "high" ? "高" : s === "mid" ? "中" : "低");

export default function Monitoring() {
  const nav = useNavigate();
  useAlertVersion();
  const [tab, setTab] = useState<"充值" | "提现">("充值");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const openReview = (id: string) => { setReviewId(id); setReviewOpen(true); };

  const stOf = (a: Alert) => alertStore.stateOf(a.id, a.state);
  // 事中 = 实时闸口:只看 gate 车道(待决 / 补料待回),按 SLA 紧迫度排序
  const queue = alerts.filter((a) => GATE_STATES.includes(stOf(a))).sort((x, y) => slaOfAlert(x, stOf(x)).pct - slaOfAlert(y, stOf(y)).pct);
  const depositN = queue.filter((a) => a.type === "充值").length;
  const withdrawN = queue.filter((a) => a.type === "提现").length;
  const rows = queue.filter((a) => a.type === tab);

  const stats = [
    { k: "当前待审", v: queue.length, sub: "在途暂缓中", tone: "amber" },
    { k: "本时段放行", v: 1107, sub: "直通 + 人工", tone: "green" },
    { k: "本时段拒绝", v: 22, sub: "制裁 / 高危", tone: "red" },
    { k: "本时段转研判", v: 14, sub: "移交告警研判", tone: "blue" },
  ];

  return (
    <Shell crumb={["交易", "交易监控", "事中监控"]} wide>
      <PageHead title="事中监控" sub="实时风控闸口 · 回答「这笔钱放不放」—— 命中规则的在途交易在此暂缓;进入详情审核,当场放行 / 拒绝,拿不准就转研判移交告警研判。" />

      {/* live stats */}
      <div className="card mb-5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span>
          <span className="text-[13px] font-bold">实时闸口</span>
          <span className="text-[12px] text-default-400">每 10s 自动刷新 · 今日时段累计</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.k} className="rounded-xl border border-divider p-3">
              <div className="text-[11.5px] text-default-500">{s.k}</div>
              <div className="mt-1 text-[24px] font-extrabold leading-none tnum" style={{ color: toneCss(s.tone) }}>{typeof s.v === "number" ? s.v.toLocaleString() : s.v}</div>
              <div className="mt-1 text-[11px] text-default-400">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 在途待审 — tabs + table; 审核进详情页(放行/拒绝/补料/转研判) */}
      <div className="mb-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Tabs aria-label="交易类型" selectedKey={tab} onSelectionChange={(k) => setTab(k as "充值" | "提现")} variant="underlined" color="primary" classNames={{ tabList: "gap-6 p-0", cursor: "w-full", tab: "px-0 h-9 max-w-fit" }}>
            <Tab key="充值" title={<span className="flex items-center gap-1.5 text-[13px] font-semibold">充值入金 <span className="rounded-full bg-default-100 px-1.5 text-[11px] tnum">{depositN}</span></span>} />
            <Tab key="提现" title={<span className="flex items-center gap-1.5 text-[13px] font-semibold">提现出金 <span className="rounded-full bg-default-100 px-1.5 text-[11px] tnum">{withdrawN}</span></span>} />
          </Tabs>
          <span className="text-[11.5px] text-default-400">按 SLA 紧迫度排序 · 越靠上越急</span>
        </div>
        <Table aria-label="在途待审" radius="lg" classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] whitespace-nowrap", tr: "border-b border-default-100 last:border-0 transition-colors data-[hover=true]:bg-default-50 hover:bg-default-50" }}>
          <TableHeader>
            <TableColumn>商户名称/交易ID</TableColumn><TableColumn>风险评分</TableColumn><TableColumn>命中规则</TableColumn>
            <TableColumn>交易金额</TableColumn><TableColumn>状态</TableColumn><TableColumn>SLA剩余</TableColumn><TableColumn align="end">操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent={`${tab}当前无待审在途交易 · 闸口通畅`}>
            {rows.map((a) => {
              const sd = RC_STATES[stOf(a)];
              return (
                <TableRow key={a.id}>
                  <TableCell><button onClick={() => nav(`/alert?id=${a.id}`)} className="text-left"><div className="font-semibold">{a.merchant}</div><div className="text-[11px] text-default-400">{a.id} · {a.order}</div></button></TableCell>
                  <TableCell><span className="rounded-md bg-default-100 px-2 py-0.5 text-[12px] font-semibold text-default-700">{sevShort(a.sev)} {a.score}</span></TableCell>
                  <TableCell><span className="text-default-700">{a.title}</span></TableCell>
                  <TableCell><span className="font-semibold tnum">{a.amount}</span></TableCell>
                  <TableCell><Pill tone={sd.cls}>{sd.label}</Pill></TableCell>
                  <TableCell>{(() => { const sla = slaOfAlert(a, stOf(a)); return <span className="inline-flex items-center gap-1" style={{ color: toneCss(sla.tone) }}><Clock className="h-3.5 w-3.5" />{sla.text}</span>; })()}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <Tooltip content="查看详情" size="sm" delay={300}>
                        <Button isIconOnly aria-label="查看告警详情" size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => nav(`/alert?id=${a.id}`)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button>
                      </Tooltip>
                      <Tooltip content="审核 · 放行 / 拒绝 / 补料 / 转研判" size="sm" delay={300}>
                        <Button size="sm" radius="full" color="primary" variant="flat" startContent={<ClipboardCheck className="h-3.5 w-3.5" />} onPress={() => openReview(a.id)}>审核</Button>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 审核抽屉(行内,与告警研判 / 事后监控一致;gate 车道 → 放行 / 拒绝 / 补料 / 转研判)*/}
      <ReviewDialog alertId={reviewId} open={reviewOpen} onOpenChange={setReviewOpen} />
    </Shell>
  );
}
