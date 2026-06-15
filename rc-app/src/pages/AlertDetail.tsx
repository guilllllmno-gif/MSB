import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardHeader, CardBody, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Progress } from "@heroui/react";
import { ArrowLeft, ClipboardCheck, Sparkles, Check } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, SoftChip, Initials, RiskBadge, toneVar } from "@/components/bits";
import { ReviewDialog } from "@/components/ReviewDialog";
import { alerts, RC_STATES, sevMeta, type Tone } from "@/lib/data";
import { alertStore, useAlertVersion } from "@/lib/store";

const PIPE: [string, string][] = [["new", "待认领"], ["progress", "处理中"], ["escalated", "已升级"], ["done", "已结"]];
const ME = { i: "JL", n: "你 (JL)", c: "var(--brand)" };
const slaColor: Record<Tone, "default" | "primary" | "success" | "warning" | "danger"> = { amber: "warning", blue: "primary", red: "danger", green: "success", grey: "default", violet: "primary" };

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2 text-[12.5px]"><span className="text-default-500">{label}</span><span className="text-right font-semibold">{children}</span></div>;
}

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
  const sevLabel = sev.label === "高危" ? "高风险" : sev.label === "中危" ? "中风险" : "低风险";
  const gaugeCol = a.sev === "high" ? "var(--danger)" : a.sev === "mid" ? "var(--warning)" : "var(--success)";
  const sancTone: Tone = a.sanctions.status === "直接命中" ? "red" : a.sanctions.status === "间接命中" ? "amber" : "green";
  const events = alertStore.eventsOf(a.id);
  const tl = a.timeline.concat(events.map((e) => [e.t, e.text + (e.reason ? "：" + e.reason : ""), "done"] as [string, string, string]));
  const stage = state === "new" ? "new" : ["progress", "pending", "pending_l2"].includes(state) ? "progress" : state === "escalated" ? "escalated" : "done";
  const ci = ["new", "progress", "escalated", "done"].indexOf(stage);

  const claim = () => { alertStore.set(a.id, "progress", { assignee: ME, event: "认领工单" }); toast.success("已认领工单"); };
  const reopen = () => { alertStore.set(a.id, "progress", { assignee: assignee || ME, event: "重新打开告警" }); toast.success("已重新打开"); };

  return (
    <Shell crumb={["风控", "监控运营", "交易警报", a.order]}>
      <button onClick={() => nav("/alerts")} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回告警工作台</button>

      <Card shadow="sm" className="mb-[18px] border border-divider"><CardBody className="py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-mono text-[23px] font-extrabold tracking-tight">{a.order}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SoftChip>{a.type}</SoftChip><Pill tone={sd.cls}>{sd.label}</Pill><RiskBadge tone={sev.tone}>{sevLabel}</RiskBadge>
              <span className="text-[12px] text-default-400 tnum">命中评分 {a.score} · {a.level}</span>
            </div>
            <div className="mt-2.5 text-[13px] text-default-500">{a.title} · <b className="text-foreground">{a.merchant}</b> · 提交于 {a.submitted} · 告警 <b className="text-foreground">{a.id}</b> · SLA <b className="text-foreground">{a.sla.text}</b></div>
          </div>
          <div className="flex items-center gap-4">
            {assignee ? <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="text-[11px] font-normal text-default-400">处理人</span><Initials p={assignee} size={28} />{assignee.n}</span> : <Pill tone="grey">未认领</Pill>}
            {sd.active && <Button color="primary" startContent={<ClipboardCheck className="h-4 w-4" />} onPress={() => setOpen(true)}>做出审核决定</Button>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center border-t border-divider pt-4">
          {PIPE.map(([, label], i) => (
            <div key={i} className="flex items-center">
              <div className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 text-[10.5px] font-extrabold"
                  style={i < ci ? { background: "var(--success)", borderColor: "var(--success)", color: "#fff" } : i === ci ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--text-3)" }}>
                  {i < ci ? <Check className="h-3 w-3" /> : i + 1}</span>
                <span className="text-[12px]" style={i === ci ? { color: "var(--brand)", fontWeight: 700 } : i < ci ? { color: "var(--text-2)" } : { color: "var(--text-3)" }}>{label}</span>
              </div>
              {i < PIPE.length - 1 && <span className="mx-2 h-0.5 w-8" style={{ background: i < ci ? "var(--success)" : "var(--line)" }} />}
            </div>
          ))}
        </div>
      </CardBody></Card>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_372px]">
        {/* left */}
        <div className="flex flex-col gap-[18px]">
          <Card shadow="sm" className="border border-divider"><CardHeader className="flex items-center justify-between"><div><div className="text-[15px] font-bold">交易信息</div><div className="text-[12px] text-default-400">{a.type}订单明细</div></div><SoftChip net>◈ {a.network}</SoftChip></CardHeader>
            <CardBody className="pt-0"><div className="grid grid-cols-2 gap-x-8">
              <Kv label="金额"><span className="tnum">{a.amount}</span></Kv><Kv label="资产">{a.asset}</Kv>
              <Kv label="发送方"><span className="font-mono" style={{ color: "var(--brand)" }}>{a.sender}</span></Kv><Kv label="收款方"><span className="font-mono">{a.receiver}</span></Kv>
              <Kv label="交易哈希"><span className="font-mono" style={{ color: "var(--brand)" }}>{a.txHash}</span></Kv><Kv label="区块确认">{a.confirmations}</Kv>
              <Kv label="提交时间"><span className="tnum">{a.submitted}</span></Kv><Kv label="告警ID"><span className="font-mono">{a.id}</span></Kv>
            </div></CardBody>
          </Card>

          <Card shadow="sm" className="border border-divider"><CardHeader><div className="text-[15px] font-bold">命中规则 · {a.rules.length} 条</div></CardHeader>
            <CardBody className="pt-0"><Table aria-label="命中规则" removeWrapper classNames={{ th: "bg-default-50 text-default-500 text-[11.5px]" }}>
              <TableHeader><TableColumn>规则</TableColumn><TableColumn>类别</TableColumn><TableColumn>阈值 / 条件</TableColumn><TableColumn>命中值</TableColumn><TableColumn>权重</TableColumn></TableHeader>
              <TableBody>{a.rules.map((r, i) => (
                <TableRow key={i}><TableCell className="font-semibold">{r.name}</TableCell><TableCell className="text-[12px]">{r.cat}</TableCell><TableCell className="text-[12px]">{r.cond}</TableCell><TableCell className="font-semibold" style={{ color: "var(--danger)" }}>{r.hit}</TableCell><TableCell><Pill tone="red" dot={false}>{r.weight}</Pill></TableCell></TableRow>
              ))}</TableBody>
            </Table></CardBody>
          </Card>

          <Card shadow="sm" className="border border-divider"><CardHeader><div><div className="text-[15px] font-bold">链上资金溯源</div><div className="text-[12px] text-default-400">来源/去向路径 · Chainalysis</div></div></CardHeader>
            <CardBody className="pt-0">
              <div className="flex flex-wrap items-center gap-1.5">{a.trace.map((t, i) => (<span key={i} className="flex items-center gap-1.5"><Pill tone={t[1]} dot={false}>{t[0]}</Pill>{i < a.trace.length - 1 && <span className="text-[11px] text-default-400">→</span>}</span>))}</div>
              <p className="mt-3 text-[12px] leading-relaxed text-default-500">{a.traceNote}</p>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
            <Card shadow="sm" className="border border-divider"><CardHeader><div className="text-[15px] font-bold">对手地址情报</div></CardHeader><CardBody className="flex flex-col gap-2 pt-0 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">地址链龄</span><span className="font-semibold">{a.addrIntel.age}</span></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">链上标签</span><span className="flex flex-wrap justify-end gap-1">{a.addrIntel.labels.map((l) => <SoftChip key={l}>{l}</SoftChip>)}</span></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">网络共享</span><span className="font-semibold">{a.addrIntel.networkSeen}</span></div>
              <div className="flex items-baseline justify-between gap-3 py-2"><span className="text-default-500">历史拦截</span><span className="font-semibold">{a.addrIntel.priorBlocks}</span></div>
            </CardBody></Card>
            <Card shadow="sm" className="border border-divider"><CardHeader><div className="text-[15px] font-bold">商户 / 客户画像</div></CardHeader><CardBody className="flex flex-col gap-2 pt-0 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">商户</span><span className="font-semibold">{a.merchant} <span className="font-normal text-default-400">· {a.country}</span></span></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">分级</span><Pill tone={a.merchantTier[1]}>{a.merchantTier[0]}</Pill></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">KYB</span><span className="font-semibold">{a.kyb} · 账龄 {a.accountAge}</span></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">历史订单</span><span className="font-semibold">{a.custHistory.orders} · 违规 {a.custHistory.violations}</span></div>
              <div className="flex items-baseline justify-between gap-3 py-2"><span className="text-default-500">30日交易额</span><span className="font-semibold tnum">{a.custHistory.vol30}</span></div>
            </CardBody></Card>
          </div>

          <Card shadow="sm" className="border border-divider"><CardHeader><div className="text-[15px] font-bold">处理时间线</div></CardHeader><CardBody className="pt-0">
            <ol className="relative ml-2 border-l border-default-200 pl-6">
              {tl.map((t, i) => (<li key={i} className="relative pb-4 last:pb-0"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-[var(--brand)]" style={{ background: t[2] === "done" ? "var(--brand)" : "var(--surface)" }} /><div className="text-[11px] text-default-400 tnum">{t[0]}</div><div className="mt-0.5 text-[12.5px] font-semibold">{t[1]}</div></li>))}
            </ol>
          </CardBody></Card>
        </div>

        {/* right */}
        <div className="flex flex-col gap-[18px]">
          <Card shadow="sm" className="border border-divider"><CardHeader className="flex items-center justify-between"><div className="text-[15px] font-bold">审核决定</div><Pill tone={sev.tone}>{sevLabel} · {a.level}</Pill></CardHeader>
            <CardBody className="pt-0">
              <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--violet-bd)", background: "linear-gradient(180deg,var(--violet-bg),var(--surface))" }}>
                <div className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--violet)" }}><Sparkles className="h-4 w-4" />AI 风险预判</div>
                <div className="mt-3 flex items-center gap-3.5">
                  <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${gaugeCol} ${a.score}%, var(--track) 0)` }}>
                    <div className="absolute rounded-full bg-content1" style={{ inset: 9 }} />
                    <div className="relative text-center"><div className="text-[22px] font-extrabold tnum" style={{ color: gaugeCol }}>{a.score}</div><div className="text-[10px] text-default-400">/ 100</div></div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2">{a.factors.map((fc, i) => (<div key={i} className="flex items-start gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px]" style={{ background: fc.bg, color: fc.fg }}>{fc.emoji}</span><div><div className="text-[12px] font-semibold leading-tight">{fc.title}</div><div className="text-[11px] text-default-400">{fc.desc}</div></div></div>))}</div>
                </div>
                <p className="mt-3 border-t pt-2.5 text-[12px] text-default-500" style={{ borderColor: "var(--violet-bd)" }}><b className="text-foreground">模型建议：</b>{a.recommendation}</p>
              </div>

              <div className="mt-3.5 flex items-center justify-between rounded-lg border border-divider bg-default-50 px-3 py-2.5">
                <span className="flex items-center gap-2"><span className="text-[12px] text-default-500">制裁筛查</span><Pill tone={sancTone}>{a.sanctions.status}</Pill></span>
                <span className="text-[12px] text-default-400">{a.sanctions.list}</span>
              </div>

              <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-default-400">审核清单</div>
              {a.checklist.map(([txt, done], i) => (<div key={i} className="flex items-start gap-2.5 py-1.5"><span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md text-[11px]" style={done ? { background: "var(--success)", color: "#fff" } : { border: "1.5px solid var(--line)" }}>{done ? "✓" : ""}</span><span className="text-[12px]" style={done ? undefined : { color: "var(--text-2)" }}>{txt}</span></div>))}

              <div className="mb-2.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-default-400">处置</div>
              <div className="flex flex-col gap-2.5">
                {!sd.active ? (
                  <>
                    <div className="rounded-lg border border-divider bg-default-50 p-3 text-center text-[12.5px] text-default-500">✓ 本告警已关闭 · <b>{sd.label.replace("已结 · ", "")}</b></div>
                    {state === "closed_case" && <Button variant="bordered" onPress={() => nav("/cases")}>前往案件管理</Button>}
                    <Button variant="bordered" onPress={reopen}>重新打开</Button>
                  </>
                ) : (
                  <>
                    {state === "new" && <Button color="primary" onPress={claim}>认领工单</Button>}
                    {state === "pending_l2" && <div className="rounded-lg border p-2.5 text-center text-[12.5px]" style={{ background: "var(--brand-soft)", color: "var(--brand)", borderColor: "var(--brand-bd)" }}>⏳ L1 已提交建议 · 待 L2 复核</div>}
                    <Button color="primary" startContent={<ClipboardCheck className="h-4 w-4" />} onPress={() => setOpen(true)}>做出审核决定</Button>
                  </>
                )}
              </div>
            </CardBody>
          </Card>

          <Card shadow="sm" className="border border-divider"><CardHeader><div className="text-[15px] font-bold">SLA</div></CardHeader><CardBody className="pt-0">
            <div className="flex items-center justify-between text-[13px]"><span className="text-default-500">处理时限</span><span className="font-semibold tnum">{a.sla.text}</span></div>
            <Progress aria-label="SLA" value={a.sla.pct} color={slaColor[a.sla.color]} size="sm" className="mt-2" />
            <p className="mt-2 text-[11.5px] text-default-400">高风险工单 SLA 为 48 小时，超时自动升级。</p>
          </CardBody></Card>
        </div>
      </div>

      <ReviewDialog alertId={a.id} open={open} onOpenChange={setOpen} />
    </Shell>
  );
}
