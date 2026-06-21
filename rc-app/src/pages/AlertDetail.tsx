import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardHeader, CardBody, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { ArrowLeft, ClipboardCheck, Clock, Info, Network, ArrowRight, Link2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Timeline } from "@/components/Timeline";
import { Pill, SoftChip, Initials, RiskBadge } from "@/components/bits";
import { ReviewDialog } from "@/components/ReviewDialog";
import { alerts, RC_STATES, GATE_STATES, sevMeta, type Tone } from "@/lib/data";
import { ringsForMerchant, DIM_META, DIM_ORDER, confTone, confLabel } from "@/lib/rings";
import { FINDINGS, FDIM } from "@/lib/findings";
import { CASES } from "@/lib/cases";
import { alertStore, useAlertVersion } from "@/lib/store";

const ME = { i: "JL", n: "你 (JL)", c: "var(--brand)" };

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-[12.5px] text-default-500">{label}</div>
      <div className="mt-2 text-[19px] font-extrabold tnum leading-none">{children}</div>
    </div>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2 text-[12.5px]"><span className="text-default-500">{label}</span><span className="text-right font-semibold">{children}</span></div>;
}

export default function AlertDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  useAlertVersion();
  const a = alerts.find((x) => x.id === sp.get("id")) || alerts[0];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"info" | "log">("info");

  const state = alertStore.stateOf(a.id, a.state);
  const gate = GATE_STATES.includes(state); // 事中闸口车道 vs 告警研判调查车道
  const sd = RC_STATES[state];
  const assignee = alertStore.assigneeOf(a.id, a.assignee);
  const sev = sevMeta[a.sev];
  const sevLabel = sev.label === "高危" ? "高风险" : sev.label === "中危" ? "中风险" : "低风险";
  const gaugeCol = a.sev === "high" ? "var(--danger)" : a.sev === "mid" ? "var(--warning)" : "var(--success)";
  const sancTone: Tone = a.sanctions.status === "直接命中" ? "red" : a.sanctions.status === "间接命中" ? "amber" : "green";
  const events = alertStore.eventsOf(a.id);
  const tl = a.timeline.concat(events.map((e) => [e.t, e.text + (e.reason ? "：" + e.reason : ""), "done"] as [string, string, string]));
  const crr = a.rules.reduce((s, r) => s + (parseInt(r.weight.replace(/[^0-9-]/g, ""), 10) || 0), 0);
  const ring = ringsForMerchant(a.merchant)[0];
  // 跨模块关联线索:同主体在事后监控 / 案件管理的命中
  const mkey = a.merchant.split(" ")[0];
  const relFindings = FINDINGS.filter((f) => f.subject.includes(mkey) || f.sub.includes(mkey)).slice(0, 3);
  const relCases = CASES.filter((c) => c.subject.includes(mkey) || (c.subjects || []).some((s) => s.name.includes(mkey))).slice(0, 3);

  const claim = () => { alertStore.set(a.id, "progress", { assignee: ME, event: "认领工单" }); toast.success("已认领工单"); };
  const reopen = () => { alertStore.set(a.id, "progress", { assignee: assignee || ME, event: "重新打开告警" }); toast.success("已重新打开"); };

  return (
    <Shell crumb={["风控", "监控运营", gate ? "事中监控" : "告警研判", a.order]}>
      <button onClick={() => nav(gate ? "/monitoring" : "/alerts")} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 hover:text-foreground"><ArrowLeft className="h-4 w-4" />{gate ? "返回事中监控" : "返回告警研判"}</button>

      {/* top action bar — flat, no box */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-[23px] font-bold tracking-tight">
            {a.order}
            <Pill tone={sd.cls}>{sd.label}</Pill>
            <RiskBadge tone={sev.tone}>{sevLabel}</RiskBadge>
          </h1>
          <div className="mt-2.5 text-[13px] text-default-500">
            商户 <b className="text-foreground">{a.merchant}</b> · 审核人 {assignee ? <b className="text-foreground">{assignee.n}</b> : <span className="text-default-400">未认领</span>} · 触发时间 <span className="tnum">{a.submitted}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Pill tone={a.sla.color} icon={<Clock className="h-3.5 w-3.5" />}>SLA 截止 {a.sla.text}</Pill>
          {state === "new" && <Button size="sm" variant="bordered" onPress={claim}>认领工单</Button>}
          <Button size="sm" variant="bordered">请求扫描</Button>
          {sd.active
            ? <Button size="sm" color="primary" startContent={<ClipboardCheck className="h-4 w-4" />} onPress={() => setOpen(true)}>审核</Button>
            : <Button size="sm" variant="bordered" onPress={reopen}>重新打开</Button>}
        </div>
      </div>

      {/* tabs */}
      <div className="mb-5 flex items-center gap-6 border-b border-divider">
        {([["info", "基本信息"], ["log", "活动日志"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`relative -mb-px pb-3 text-[14px] font-semibold transition-colors ${tab === k ? "text-foreground" : "text-default-400 hover:text-default-600"}`}>
            {label}
            {tab === k && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {tab === "info" ? (
        <div className="flex flex-col gap-5">
          {/* stat cards */}
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            <Stat label="风险评分"><span style={{ color: gaugeCol }}>{a.score}</span><span className="text-[13px] font-bold text-default-400">/100</span></Stat>
            <Stat label="交易金额">{a.amount}</Stat>
            <Stat label="同一客户（近30天）"><span className="text-[16px]">{a.custHistory.orders} 笔 · 合计 {a.custHistory.vol30}</span></Stat>
            <Stat label="制裁筛查"><span className="text-[16px]" style={{ color: `var(--${sancTone === "red" ? "danger" : sancTone === "amber" ? "warning" : "success"})` }}>{a.sanctions.status}</span><span className="ml-2 text-[12px] font-normal text-default-400">{a.sanctions.list}</span></Stat>
          </div>

          {/* related-order banner */}
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-[12.5px]" style={{ background: "var(--brand-softer)" }}>
            <Info className="h-4 w-4 shrink-0" style={{ color: "var(--brand)" }} />
            <span className="flex-1 text-default-600">关联在途订单 <b className="text-foreground">{a.order}</b> 资金暂缓中 · 实际放行 / 拒绝由「事中监控」闸口执行。本警报现需做出研判结论。</span>
            <button onClick={() => nav("/monitoring")} className="shrink-0 font-semibold text-primary">查看订单 →</button>
          </div>

          {/* 交易信息 | 商户画像 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_1fr]">
            <Card shadow="none" className="card"><CardHeader className="flex items-center justify-between"><div><div className="text-[15px] font-bold">交易信息</div><div className="text-[12px] text-default-400">{a.type}订单明细</div></div><SoftChip net>◈ {a.network}</SoftChip></CardHeader>
              <CardBody className="pt-0"><div className="grid grid-cols-2 gap-x-8">
                <Kv label="金额"><span className="tnum">{a.amount}</span></Kv><Kv label="资产">{a.asset}</Kv>
                <Kv label="发送方"><span style={{ color: "var(--brand)" }}>{a.sender}</span></Kv><Kv label="收款方"><span>{a.receiver}</span></Kv>
                <Kv label="交易哈希"><span style={{ color: "var(--brand)" }}>{a.txHash}</span></Kv><Kv label="区块确认">{a.confirmations}</Kv>
                <Kv label="提交时间"><span className="tnum">{a.submitted}</span></Kv><Kv label="告警ID">{a.id}</Kv>
              </div></CardBody>
            </Card>
            <Card shadow="none" className="card"><CardHeader><div className="text-[15px] font-bold">商户 / 客户画像</div></CardHeader><CardBody className="flex flex-col gap-2 pt-0 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">商户</span><span className="font-semibold">{a.merchant} <span className="font-normal text-default-400">· {a.country}</span></span></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">分级</span><Pill tone={a.merchantTier[1]}>{a.merchantTier[0]}</Pill></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">KYB</span><span className="font-semibold">{a.kyb} · 账龄 {a.accountAge}</span></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">历史订单</span><span className="font-semibold">{a.custHistory.orders} · 违规 {a.custHistory.violations}</span></div>
              <div className="flex items-baseline justify-between gap-3 py-2"><span className="text-default-500">30日交易额</span><span className="font-semibold tnum">{a.custHistory.vol30}</span></div>
            </CardBody></Card>
          </div>

          {/* 规则引擎触发明细 */}
          <Card shadow="none" className="card"><CardHeader className="flex items-center justify-between"><div className="text-[15px] font-bold">规则引擎触发明细 · {a.rules.length} 条</div><Pill tone="red" dot={false}>总CRR加分 +{crr}</Pill></CardHeader>
            <CardBody className="pt-0"><Table aria-label="命中规则" removeWrapper classNames={{ th: "bg-default-50 text-default-500 text-[11.5px]" }}>
              <TableHeader><TableColumn>规则</TableColumn><TableColumn>类别</TableColumn><TableColumn>阈值 / 条件</TableColumn><TableColumn>命中值</TableColumn><TableColumn align="end">权重</TableColumn></TableHeader>
              <TableBody>{a.rules.map((r, i) => (
                <TableRow key={i}><TableCell className="font-semibold">{r.name}</TableCell><TableCell className="text-[12px]">{r.cat}</TableCell><TableCell className="text-[12px]">{r.cond}</TableCell><TableCell className="font-semibold" style={{ color: "var(--danger)" }}>{r.hit}</TableCell><TableCell><div className="flex justify-end"><Pill tone="red" dot={false}>{r.weight}</Pill></div></TableCell></TableRow>
              ))}</TableBody>
            </Table></CardBody>
          </Card>

          {/* 链上溯源 | 对手地址情报 */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card shadow="none" className="card"><CardHeader><div><div className="text-[15px] font-bold">链上资金溯源</div><div className="text-[12px] text-default-400">来源/去向路径 · Chainalysis</div></div></CardHeader>
              <CardBody className="pt-0">
                <div className="flex flex-wrap items-center gap-1.5">{a.trace.map((t, i) => (<span key={i} className="flex items-center gap-1.5"><Pill tone={t[1]} dot={false}>{t[0]}</Pill>{i < a.trace.length - 1 && <span className="text-[11px] text-default-400">→</span>}</span>))}</div>
                <p className="mt-3 text-[12px] leading-relaxed text-default-500">{a.traceNote}</p>
              </CardBody>
            </Card>
            <Card shadow="none" className="card"><CardHeader><div className="text-[15px] font-bold">对手地址情报</div></CardHeader><CardBody className="flex flex-col gap-2 pt-0 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">地址链龄</span><span className="font-semibold">{a.addrIntel.age}</span></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">链上标签</span><span className="flex flex-wrap justify-end gap-1">{a.addrIntel.labels.map((l) => <SoftChip key={l}>{l}</SoftChip>)}</span></div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2"><span className="text-default-500">网络共享</span><span className="font-semibold">{a.addrIntel.networkSeen}</span></div>
              <div className="flex items-baseline justify-between gap-3 py-2"><span className="text-default-500">历史拦截</span><span className="font-semibold">{a.addrIntel.priorBlocks}</span></div>
            </CardBody></Card>
          </div>

          {/* 关联团伙 */}
          <Card shadow="none" className="card"><CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[15px] font-bold"><Network className="h-4 w-4 text-default-400" />关联团伙</div>
            {ring && <Pill tone={confTone(ring.confidence)}>{confLabel(ring.confidence)} {ring.confidence}%</Pill>}
          </CardHeader>
            <CardBody className="pt-0">
              {ring ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="font-semibold">{ring.name}</span><Pill tone={ring.risk} dot={false}>{ring.typology}</Pill></div>
                    <div className="mt-0.5 text-[11.5px] text-default-400">{ring.id} · {ring.members.length} 个主体 · 关联告警 {ring.alertCount} 条</div>
                  </div>
                  <div className="flex items-center">
                    {ring.members.slice(0, 4).map((m, i) => <span key={m.id} style={{ marginLeft: i ? -8 : 0, zIndex: 10 - i }} className="rounded-full ring-2 ring-content1"><Initials p={{ i: m.i, c: m.c }} size={26} /></span>)}
                  </div>
                  <div className="flex items-center gap-1">
                    {DIM_ORDER.filter((d) => ring.shared.some((s) => s.dim === d)).map((d) => <span key={d} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "color-mix(in srgb," + DIM_META[d].color + " 14%, transparent)", color: DIM_META[d].color }}>{DIM_META[d].short}</span>)}
                  </div>
                  <Button size="sm" variant="flat" className="ml-auto bg-default-100" endContent={<ArrowRight className="h-3.5 w-3.5" />} onPress={() => nav(`/ring?id=${ring.id}`)}>查看团伙图谱</Button>
                </div>
              ) : (
                <div className="text-[12.5px] text-default-400">未发现关联团伙 · 该主体当前无超阈值多维关联。</div>
              )}
            </CardBody>
          </Card>

          {/* 关联线索 · 跨模块(事后命中 / 案件)*/}
          <Card shadow="none" className="card"><CardHeader><div className="flex items-center gap-2 text-[15px] font-bold"><Link2 className="h-4 w-4 text-default-400" />关联线索 · 跨模块</div></CardHeader>
            <CardBody className="pt-0">
              {(relFindings.length || relCases.length) ? (
                <div className="flex flex-col gap-2">
                  {relFindings.map((f) => (
                    <button key={f.id} onClick={() => nav(`/finding?id=${f.id}`)} className="flex items-center gap-2.5 rounded-xl border border-divider p-2.5 text-left transition-colors hover:bg-default-50">
                      <Pill tone="violet" dot={false}>事后命中</Pill>
                      <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold">{f.pattern} · {f.subject}</div><div className="text-[11px] text-default-400">{f.id} · {FDIM[f.dim].label}</div></div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-default-300" />
                    </button>
                  ))}
                  {relCases.map((c) => (
                    <button key={c.id} onClick={() => nav("/cases")} className="flex items-center gap-2.5 rounded-xl border border-divider p-2.5 text-left transition-colors hover:bg-default-50">
                      <Pill tone="amber" dot={false}>案件</Pill>
                      <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold">{c.type} · {c.subject}</div><div className="text-[11px] text-default-400">{c.id} · {c.src}</div></div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-default-300" />
                    </button>
                  ))}
                  <p className="text-[11px] leading-relaxed text-default-400">同主体在事后监控 / 案件管理也有线索 —— 研判时一并考虑;<b className="text-default-600">升级 / 转研判 / 建案</b>可并入同一案件,避免重复立案与重复 STR。</p>
                </div>
              ) : <div className="text-[12.5px] text-default-400">未发现跨模块关联线索 · 该主体在事后 / 案件无其它命中。</div>}
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card shadow="none" className="card"><CardHeader><div className="text-[15px] font-bold">活动日志 · 处理时间线</div></CardHeader><CardBody className="pt-0">
          <Timeline items={tl.map((t) => ({ time: t[0], text: t[1], done: t[2] === "done" }))} />
        </CardBody></Card>
      )}

      <ReviewDialog alertId={a.id} open={open} onOpenChange={setOpen} />
    </Shell>
  );
}
