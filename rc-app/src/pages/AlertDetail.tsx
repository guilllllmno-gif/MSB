import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCheck, Sparkles, Check } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, Chip, Avatar, RiskBadge, toneVar } from "@/components/bits";
import { ReviewDialog } from "@/components/ReviewDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { alerts, RC_STATES, sevMeta } from "@/lib/data";
import { alertStore, useAlertVersion } from "@/lib/store";

const PIPE: [string, string][] = [["new", "待认领"], ["progress", "处理中"], ["escalated", "已升级"], ["done", "已结"]];
const ME = { i: "JL", n: "你 (JL)", c: "var(--brand)" };

export default function AlertDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  useAlertVersion();
  const a = alerts.find((x) => x.id === sp.get("id")) || alerts[0];
  const [open, setOpen] = useState(false);

  const state = alertStore.stateOf(a.id, a.state);
  const sd = RC_STATES[state];
  const assignee = alertStore.assigneeOf(a.id, a.assignee);
  const sev = sevMeta[a.sev];
  const gaugeCol = a.sev === "high" ? "var(--danger)" : a.sev === "mid" ? "var(--warning)" : "var(--success)";
  const sancTone = a.sanctions.status === "直接命中" ? "red" : a.sanctions.status === "间接命中" ? "amber" : "green";
  const events = alertStore.eventsOf(a.id);
  const tl = a.timeline.concat(events.map((e) => [e.t, e.text + (e.reason ? "：" + e.reason : ""), "done"] as [string, string, string]));

  const stage = state === "new" ? "new" : ["progress", "pending", "pending_l2"].includes(state) ? "progress" : state === "escalated" ? "escalated" : "done";
  const ci = ["new", "progress", "escalated", "done"].indexOf(stage);

  const claim = () => { alertStore.set(a.id, "progress", { assignee: ME, event: "认领工单" }); toast.success("已认领工单"); };
  const reopen = () => { alertStore.set(a.id, "progress", { assignee: assignee || ME, event: "重新打开告警" }); toast.success("已重新打开"); };

  const KvGrid = ({ rows }: { rows: [string, React.ReactNode][] }) => (
    <div className="grid grid-cols-2 gap-x-8">
      {rows.map(([k, v], i) => <div key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed py-2 text-[12.5px]"><span className="text-muted-foreground">{k}</span><span className="text-right font-semibold">{v}</span></div>)}
    </div>
  );

  return (
    <Shell crumb={["风控", "监控运营", "交易警报", a.order]}>
      <button onClick={() => nav("/alerts")} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回告警工作台</button>

      {/* hero */}
      <Card className="mb-[18px]"><CardContent className="py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-mono text-[23px] font-extrabold tracking-tight">{a.order}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip>{a.type}</Chip>
              <Pill tone={sd.cls}>{sd.label}</Pill>
              <RiskBadge tone={sev.tone}>{sev.label === "高危" ? "高风险" : sev.label === "中危" ? "中风险" : "低风险"}</RiskBadge>
              <span className="text-[12px] text-muted-foreground tnum">命中评分 {a.score} · {a.level}</span>
            </div>
            <div className="mt-2.5 text-[13px] text-muted-foreground">{a.title} · <b className="text-foreground">{a.merchant}</b> · 提交于 {a.submitted} · 告警 <b className="text-foreground">{a.id}</b> · SLA <b className="text-foreground">{a.sla.text}</b></div>
          </div>
          <div className="flex items-center gap-4">
            {assignee ? <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="text-[11px] font-normal text-muted-foreground">处理人</span><Avatar p={assignee} size={28} />{assignee.n}</span> : <Pill tone="grey">未认领</Pill>}
            {sd.active && <Button style={{ background: "var(--brand)" }} onClick={() => setOpen(true)}><ClipboardCheck className="h-4 w-4" />做出审核决定</Button>}
          </div>
        </div>
        {/* stepper */}
        <div className="mt-4 flex flex-wrap items-center border-t pt-4">
          {PIPE.map(([, label], i) => (
            <div key={i} className="flex items-center">
              <div className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 text-[10.5px] font-extrabold"
                  style={i < ci ? { background: "var(--success)", borderColor: "var(--success)", color: "#fff" } : i === ci ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" } : { borderColor: "#e8eaed", color: "#8a92a3" }}>
                  {i < ci ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="text-[12px]" style={i === ci ? { color: "var(--brand)", fontWeight: 700 } : i < ci ? { color: "var(--text-2)" } : { color: "#8a92a3" }}>{label}</span>
              </div>
              {i < PIPE.length - 1 && <span className="mx-2 h-0.5 w-8" style={{ background: i < ci ? "var(--success)" : "#e8eaed" }} />}
            </div>
          ))}
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_368px]">
        {/* left */}
        <div className="flex flex-col gap-[18px]">
          <Card>
            <CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-[15px]">交易信息</CardTitle><div className="text-[12px] text-muted-foreground">{a.type}订单明细</div></div><Chip net>◈ {a.network}</Chip></CardHeader>
            <CardContent><KvGrid rows={[
              ["金额", <span className="tnum">{a.amount}</span>], ["资产", a.asset],
              ["发送方", <span className="font-mono" style={{ color: "var(--brand)" }}>{a.sender}</span>], ["收款方", <span className="font-mono">{a.receiver}</span>],
              ["交易哈希", <span className="font-mono" style={{ color: "var(--brand)" }}>{a.txHash}</span>], ["区块确认", a.confirmations],
              ["提交时间", <span className="tnum">{a.submitted}</span>], ["告警ID", <span className="font-mono">{a.id}</span>],
            ]} /></CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-[15px]">命中规则 · {a.rules.length} 条</CardTitle></CardHeader>
            <CardContent className="p-0"><Table>
              <TableHeader><TableRow><TableHead>规则</TableHead><TableHead>类别</TableHead><TableHead>阈值 / 条件</TableHead><TableHead>命中值</TableHead><TableHead>权重</TableHead></TableRow></TableHeader>
              <TableBody>{a.rules.map((r, i) => (
                <TableRow key={i}><TableCell className="font-semibold">{r.name}</TableCell><TableCell className="text-[12px]">{r.cat}</TableCell><TableCell className="text-[12px]">{r.cond}</TableCell><TableCell className="font-semibold" style={{ color: "var(--danger)" }}>{r.hit}</TableCell><TableCell><Pill tone="red" dot={false}>{r.weight}</Pill></TableCell></TableRow>
              ))}</TableBody>
            </Table></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-[15px]">链上资金溯源</CardTitle><div className="text-[12px] text-muted-foreground">来源/去向路径 · Chainalysis</div></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-1.5">{a.trace.map((t, i) => (<span key={i} className="flex items-center gap-1.5"><Pill tone={t[1]} dot={false}>{t[0]}</Pill>{i < a.trace.length - 1 && <span className="text-[11px] text-muted-foreground">→</span>}</span>))}</div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{a.traceNote}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-[15px]">对手地址情报</CardTitle></CardHeader><CardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-2"><span className="text-muted-foreground">地址链龄</span><span className="font-semibold">{a.addrIntel.age}</span></div>
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-2"><span className="text-muted-foreground">链上标签</span><span className="flex flex-wrap justify-end gap-1">{a.addrIntel.labels.map((l) => <Chip key={l}>{l}</Chip>)}</span></div>
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-2"><span className="text-muted-foreground">网络共享</span><span className="font-semibold">{a.addrIntel.networkSeen}</span></div>
                <div className="flex items-baseline justify-between gap-3 py-2"><span className="text-muted-foreground">历史拦截</span><span className="font-semibold">{a.addrIntel.priorBlocks}</span></div>
              </div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-[15px]">商户 / 客户画像</CardTitle></CardHeader><CardContent>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-2"><span className="text-muted-foreground">商户</span><span className="font-semibold">{a.merchant} <span className="font-normal text-muted-foreground">· {a.country}</span></span></div>
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-2"><span className="text-muted-foreground">分级</span><Pill tone={a.merchantTier[1]}>{a.merchantTier[0]}</Pill></div>
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-2"><span className="text-muted-foreground">KYB</span><span className="font-semibold">{a.kyb} · 账龄 {a.accountAge}</span></div>
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-2"><span className="text-muted-foreground">历史订单</span><span className="font-semibold">{a.custHistory.orders} · 违规 {a.custHistory.violations}</span></div>
                <div className="flex items-baseline justify-between gap-3 py-2"><span className="text-muted-foreground">30日交易额</span><span className="font-semibold tnum">{a.custHistory.vol30}</span></div>
              </div>
            </CardContent></Card>
          </div>

          <Card><CardHeader><CardTitle className="text-[15px]">处理时间线</CardTitle></CardHeader><CardContent>
            <ol className="relative ml-2 border-l pl-6">
              {tl.map((t, i) => (<li key={i} className="relative pb-4 last:pb-0"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 bg-card" style={{ borderColor: t[2] === "done" ? "var(--brand)" : "#e8eaed", background: t[2] === "done" ? "var(--brand)" : "var(--card)" }} /><div className="text-[11px] text-muted-foreground tnum">{t[0]}</div><div className="mt-0.5 text-[12.5px] font-semibold">{t[1]}</div></li>))}
            </ol>
          </CardContent></Card>
        </div>

        {/* right */}
        <div className="flex flex-col gap-[18px]">
          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-[15px]">审核决定</CardTitle><Pill tone={sev.tone}>{sev.label === "高危" ? "高风险" : sev.label === "中危" ? "中风险" : "低风险"} · {a.level}</Pill></CardHeader>
            <CardContent>
              {/* AI box */}
              <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--violet-bd)", background: "linear-gradient(180deg,var(--violet-bg),#fff)" }}>
                <div className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--violet)" }}><Sparkles className="h-4 w-4" />AI 风险预判</div>
                <div className="mt-3 flex items-center gap-3.5">
                  <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${gaugeCol} ${a.score}%, var(--secondary) 0)` }}>
                    <div className="absolute rounded-full bg-card" style={{ inset: 9 }} />
                    <div className="relative text-center"><div className="text-[22px] font-extrabold tnum" style={{ color: gaugeCol }}>{a.score}</div><div className="text-[10px] text-muted-foreground">/ 100</div></div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    {a.factors.map((fc, i) => (<div key={i} className="flex items-start gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px]" style={{ background: fc.bg, color: fc.fg }}>{fc.emoji}</span><div><div className="text-[12px] font-semibold leading-tight">{fc.title}</div><div className="text-[11px] text-muted-foreground">{fc.desc}</div></div></div>))}
                  </div>
                </div>
                <p className="mt-3 border-t pt-2.5 text-[12px] text-muted-foreground" style={{ borderColor: "var(--violet-bd)" }}><b className="text-foreground">模型建议：</b>{a.recommendation}</p>
              </div>

              {/* sanctions */}
              <div className="mt-3.5 flex items-center justify-between rounded-lg border bg-secondary/40 px-3 py-2.5">
                <span className="flex items-center gap-2"><span className="text-[12px] text-muted-foreground">制裁筛查</span><Pill tone={sancTone}>{a.sanctions.status}</Pill></span>
                <span className="text-[12px] text-muted-foreground">{a.sanctions.list}</span>
              </div>

              {/* checklist */}
              <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">审核清单</div>
              {a.checklist.map(([txt, done], i) => (<div key={i} className="flex items-start gap-2.5 py-1.5"><span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md text-[11px]" style={done ? { background: "var(--success)", color: "#fff" } : { border: "1.5px solid #e8eaed" }}>{done ? "✓" : ""}</span><span className="text-[12px]" style={done ? undefined : { color: "var(--text-2)" }}>{txt}</span></div>))}

              {/* 处置 */}
              <div className="mb-2.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">处置</div>
              <div className="flex flex-col gap-2.5">
                {!sd.active ? (
                  <>
                    <div className="rounded-lg border bg-secondary/50 p-3 text-center text-[12.5px] text-muted-foreground">✓ 本告警已关闭 · <b>{sd.label.replace("已结 · ", "")}</b></div>
                    {state === "closed_case" && <Button variant="outline" className="justify-center" onClick={() => nav("/cases")}>前往案件管理</Button>}
                    <Button variant="outline" className="justify-center" onClick={reopen}>重新打开</Button>
                  </>
                ) : (
                  <>
                    {state === "new" && <Button style={{ background: "var(--brand)" }} className="justify-center" onClick={claim}>认领工单</Button>}
                    {state === "pending_l2" && <div className="rounded-lg border p-2.5 text-center text-[12.5px]" style={{ background: "var(--brand-soft)", color: "var(--brand)", borderColor: "#bcd4ff" }}>⏳ L1 已提交建议 · 待 L2 复核</div>}
                    <Button style={{ background: "var(--brand)" }} className="justify-center" onClick={() => setOpen(true)}><ClipboardCheck className="h-4 w-4" />做出审核决定</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-[15px]">SLA</CardTitle></CardHeader><CardContent>
            <div className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">处理时限</span><span className="font-semibold tnum">{a.sla.text}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${a.sla.pct}%`, background: toneVar(a.sla.color) }} /></div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">高风险工单 SLA 为 48 小时，超时自动升级。</p>
          </CardContent></Card>
        </div>
      </div>

      <ReviewDialog alertId={a.id} open={open} onOpenChange={setOpen} />
    </Shell>
  );
}