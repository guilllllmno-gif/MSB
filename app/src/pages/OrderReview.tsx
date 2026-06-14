import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Check, PauseCircle, XCircle, Snowflake, FileQuestion, Undo2, ArrowUpCircle } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, RiskBadge, RingScore, KV, Mono, SectionLabel } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { orders, orderTimelineSeed, riskLevel, type Tone } from "@/lib/data";

interface Dispo { key: string; label: string; to: string | null; tone: Tone; icon: typeof Check; desc: string; }
const DISPOS: Dispo[] = [
  { key: "pass", label: "入账 · 放行", to: "已通过", tone: "green", icon: Check, desc: "资金放行入账,约 12 分钟到账" },
  { key: "hold", label: "暂缓入账", to: "暂缓入账", tone: "amber", icon: PauseCircle, desc: "挂起待进一步核查,SLA 暂停" },
  { key: "reject", label: "拒绝 · 退款", to: "已拒绝", tone: "red", icon: XCircle, desc: "退回发送方,订单关闭" },
  { key: "freeze", label: "冻结并报告", to: "已冻结", tone: "red", icon: Snowflake, desc: "冻结资金并建案上报合规" },
];
const PROCESS: Dispo[] = [
  { key: "rfi", label: "请求信息", to: "待补充材料", tone: "blue", icon: FileQuestion, desc: "向商户索取补充材料" },
  { key: "return", label: "退回审核人", to: null, tone: "grey", icon: Undo2, desc: "退回上一审核人" },
  { key: "l3", label: "升级 L3", to: null, tone: "violet", icon: ArrowUpCircle, desc: "升级至高级合规复核" },
];
const REASONS: Record<string, string[]> = {
  pass: ["风险已核实,可放行", "误报,无可疑活动", "其他(见说明)"],
  hold: ["需等待 L2 复核", "等待商户补充材料", "其他(见说明)"],
  reject: ["链上溯源命中高风险", "超出风险偏好,退回", "其他(见说明)"],
  freeze: ["命中制裁/混币器,需上报", "达到 STR 报送门槛", "其他(见说明)"],
  rfi: ["需资金来源证明", "需 KYB 补充文件", "其他(见说明)"],
  return: ["依据不足,退回补充", "其他(见说明)"],
  l3: ["案情复杂,需 L3 判定", "金额重大", "其他(见说明)"],
};

export default function OrderReview() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const order = orders.find((o) => o.id === sp.get("id")) || orders[0];
  const lvl = riskLevel(order.risk);

  const [status, setStatus] = useState(order.status);
  const [tone, setTone] = useState<Tone>(order.statusTone);
  const [tl, setTl] = useState(orderTimelineSeed.map((x) => ({ ...x })));
  const [dlg, setDlg] = useState<Dispo | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [markStr, setMarkStr] = useState(false);

  const openDlg = (d: Dispo) => { setDlg(d); setReason(""); setNote(""); setMarkStr(d.key === "freeze"); };
  const submit = () => {
    if (!dlg) return;
    if (!reason) return toast.error("请选择处置原因");
    const full = [reason, note.trim()].filter(Boolean).join("；");
    if (dlg.to) { setStatus(dlg.to); setTone(dlg.tone); }
    setTl((p) => [{ time: "刚刚", text: `${dlg.label}：${full}${markStr ? " · 已标记 STR" : ""}`, by: "你 (JS)" }, ...p]);
    toast.success("已" + dlg.label + (markStr ? " · 已标记 STR" : ""));
    setDlg(null);
  };

  const active = !["已通过", "已拒绝", "已冻结"].includes(status);

  return (
    <Shell crumb={["审核", "订单管理", "订单审核"]}>
      <button onClick={() => nav("/orders")} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回订单管理</button>

      {/* header */}
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-extrabold font-mono">{order.id}</h1>
            <Pill tone={order.type === "充值" ? "blue" : order.type === "提现" ? "violet" : order.type === "兑换" ? "amber" : "grey"} dot={false}>{order.type}</Pill>
            <Pill tone={tone}>{status}</Pill>
            <RiskBadge tone={lvl.tone}>{lvl.label} {order.risk}</RiskBadge>
          </div>
          <div className="mt-1.5 text-[13px] text-muted-foreground">主体 <button onClick={() => nav("/merchant")} className="font-semibold" style={{ color: "var(--brand)" }}>{order.merchant}</button> · 金额 {order.cad} · 提交于 {order.submitted}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.6fr_1fr]">
        {/* left */}
        <div className="flex flex-col gap-[18px]">
          <Card><CardHeader><CardTitle className="text-[15px]">交易信息</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
              <KV label="订单号"><Mono>{order.id}</Mono></KV>
              <KV label="类型">{order.type}</KV>
              <KV label="资产">{order.asset}</KV>
              <KV label="数量"><span className="tnum">{order.amount}</span></KV>
              <KV label="折合 CAD"><span className="tnum">{order.cad}</span></KV>
              <KV label="提交时间"><span className="tnum">{order.submitted}</span></KV>
              <KV label="商户">{order.merchant}</KV>
              <KV label="分配给">{order.assignee}</KV>
              <KV label="SLA">{order.slaText}</KV>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-[15px]">匹配规则</CardTitle></CardHeader>
            <CardContent>
              {order.rule === "—" ? <p className="text-[13px] text-muted-foreground">未命中监控规则(低于自动放行阈值)。</p> :
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div><div className="text-[13px] font-semibold">{order.rule}</div><div className="text-[11.5px] text-muted-foreground">命中后动作 · 暂缓 / 升级</div></div>
                  <RiskBadge tone={lvl.tone}>{order.risk}</RiskBadge>
                </div>}
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-[15px]">处理时间线</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative ml-2 border-l pl-6">
                {tl.map((e, i) => (
                  <li key={i} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 bg-card" style={{ borderColor: "var(--brand)" }} />
                    <div className="text-[11px] text-muted-foreground tnum">{e.time}</div>
                    <div className="mt-0.5 text-[12.5px]"><b>{e.text}</b> <span className="text-muted-foreground">· {e.by}</span></div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* right: decision panel */}
        <div className="flex flex-col gap-[18px]">
          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-[15px]">审核决定</CardTitle><RiskBadge tone={lvl.tone}>{lvl.label} {order.risk}</RiskBadge></CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <RingScore score={order.risk} size={56} />
                <div className="text-[12px] text-muted-foreground">AI 风险评分 <b className="text-[15px] text-foreground tnum">{order.risk}</b> / 100<div className="mt-0.5">命中规则:{order.rule}</div></div>
              </div>

              {active ? (
                <>
                  <SectionLabel>处置</SectionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {DISPOS.map((d) => (
                      <button key={d.key} onClick={() => openDlg(d)} className="flex items-center gap-2 rounded-lg border p-2.5 text-left text-[13px] font-semibold transition-colors hover:bg-secondary/40">
                        <d.icon className="h-4 w-4 shrink-0" style={{ color: `var(--${d.tone === "green" ? "success" : d.tone === "amber" ? "warning" : d.tone === "red" ? "danger" : "brand"})` }} />{d.label}
                      </button>
                    ))}
                  </div>
                  <SectionLabel><span className="mt-4 block">流程操作</span></SectionLabel>
                  <div className="flex flex-col gap-2">
                    {PROCESS.map((d) => (
                      <button key={d.key} onClick={() => openDlg(d)} className="flex items-center gap-2 rounded-lg border p-2.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary/40">
                        <d.icon className="h-4 w-4 shrink-0" />{d.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border bg-secondary/40 p-3 text-center text-[12.5px] text-muted-foreground">本订单已处置 · <b>{status}</b></div>
              )}
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-[15px]">SLA</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">处理时限</span><span className="font-semibold tnum">{order.slaText}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${order.slaPct}%`, background: order.slaPct >= 75 ? "var(--danger)" : order.slaPct >= 50 ? "var(--warning)" : "var(--brand)" }} /></div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">高风险订单 SLA 48 小时,超时自动升级。</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* decision dialog */}
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg?.label}</DialogTitle>
            <DialogDescription>{dlg?.desc}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <SectionLabel>处置原因 <span style={{ color: "var(--danger)" }}>*</span></SectionLabel>
              <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="请选择…" /></SelectTrigger>
                <SelectContent>{(REASONS[dlg?.key || ""] || []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <SectionLabel>说明 · 记入审计</SectionLabel>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="陈述判断依据…选择「其他」时必填" className="min-h-[64px]" />
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={markStr} onCheckedChange={(v) => setMarkStr(!!v)} />标记为可疑交易报告(STR)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>取消</Button>
            <Button style={{ background: "var(--brand)" }} onClick={submit}>确认 · {dlg?.label}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
