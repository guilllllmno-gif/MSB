import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Snowflake, CheckCircle2, Unlock, SplitSquareHorizontal, Lock, Undo2, TriangleAlert, Users, FileText } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, KV, Mono, SectionLabel } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { frozenItem, unfreezeSteps, unfreezeTrail, type Tone } from "@/lib/data";

const DECISIONS: { key: string; label: string; desc: string; icon: typeof Unlock; tone: Tone }[] = [
  { key: "release", label: "批准解冻 · 全额放行", desc: "资金全额放行入账", icon: Unlock, tone: "green" },
  { key: "partial", label: "部分解冻", desc: "放行部分,余额维持冻结", icon: SplitSquareHorizontal, tone: "amber" },
  { key: "maintain", label: "维持冻结", desc: "证据不足以解除,继续冻结", icon: Lock, tone: "red" },
  { key: "return", label: "退回补充材料", desc: "要求商户补充资金来源证明", icon: Undo2, tone: "violet" },
];

const REASONS: Record<string, string[]> = {
  release: ["资金来源已澄清,风险解除", "误报,无可疑活动", "其他(见说明)"],
  partial: ["部分金额来源可查", "高风险部分维持冻结", "其他(见说明)"],
  maintain: ["链上溯源仍命中混币器", "资金来源证明不充分", "其他(见说明)"],
  return: ["资金来源证明缺失", "材料与链上记录矛盾", "其他(见说明)"],
};

function StepIcon({ state }: { state: string }) {
  if (state === "done") return <CheckCircle2 className="h-4 w-4 text-white" />;
  return null;
}

export default function Unfreeze() {
  const [decision, setDecision] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    if (!decision) return toast.error("请选择处置决定");
    if (!reason) return toast.error("请选择处置原因");
    const lbl = DECISIONS.find((d) => d.key === decision)?.label;
    toast.success("已提交 L2 复核意见 · " + lbl + " → 待 MLRO 批准");
  };

  return (
    <Shell crumb={["风控", "治理与合规", "解冻处置"]}>
      <Link to="/merchant" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回商户 360</Link>
      <PageHead
        title="解冻处置 · 资金生命周期闭环"
        sub="冻结资金的复核与放行路径:商户申诉 → L2 复核 → MLRO 批准 → 执行。双人复核(maker-checker),全程留痕。"
        actions={<Pill tone="red"><Snowflake className="mr-0.5 h-3 w-3" />已冻结 {frozenItem.daysHeld} 天</Pill>}
      />

      {/* frozen item */}
      <Card className="mb-[18px]">
        <CardHeader><CardTitle className="text-[15px]">冻结标的</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
            <KV label="订单号"><Mono>{frozenItem.id}</Mono></KV>
            <KV label="商户">{frozenItem.merchant}</KV>
            <KV label="资产">{frozenItem.asset}</KV>
            <KV label="冻结金额"><span className="tnum">{frozenItem.cad}</span></KV>
            <KV label="冻结时间"><span className="tnum">{frozenItem.frozenAt}</span></KV>
            <KV label="关联案件"><Link to="/evidence" className="font-mono text-[12px] font-semibold" style={{ color: "var(--brand)" }}>{frozenItem.case}</Link></KV>
            <div className="col-span-2"><KV label="冻结原因"><span style={{ color: "var(--danger)" }}>{frozenItem.reason}</span></KV></div>
          </div>
        </CardContent>
      </Card>

      {/* stepper */}
      <Card className="mb-[18px]">
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center">
            {unfreezeSteps.map((s, i) => {
              const color = s.state === "done" ? "var(--success)" : s.state === "active" ? "var(--brand)" : undefined;
              return (
                <div key={s.key} className="flex items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 text-[11px] font-extrabold"
                      style={{ background: color || "var(--card)", borderColor: color || "var(--border)", color: s.state === "todo" ? "var(--muted-foreground)" : "#fff" }}>
                      {s.state === "done" ? <StepIcon state="done" /> : i + 1}
                    </span>
                    <div>
                      <div className="text-[12.5px] font-semibold" style={{ color: s.state === "todo" ? "var(--muted-foreground)" : undefined }}>{s.label}</div>
                      {s.by && <div className="text-[10.5px] text-muted-foreground">{s.by}{s.at ? ` · ${s.at}` : ""}</div>}
                    </div>
                  </div>
                  {i < unfreezeSteps.length - 1 && <div className="mx-3 h-0.5 w-10 shrink-0" style={{ background: s.state === "done" ? "var(--success)" : "var(--border)" }} />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.6fr_1fr]">
        {/* decision panel */}
        <Card>
          <CardHeader><CardTitle className="text-[15px]">L2 复核决定</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border p-3 text-[12px]" style={{ background: "var(--brand-softer)", borderColor: "#bcd4ff" }}>
              <Users className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--brand)" }} />
              <span><b>职责分离</b> · 解冻需 L2 受理 + MLRO 批准双人复核;L1 / 发起调查人不可自行解冻。当前由 <b>Emma Zhang (L2)</b> 处置。</span>
            </div>

            <SectionLabel>处置决定</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {DECISIONS.map((d) => {
                const on = decision === d.key;
                return (
                  <button key={d.key} onClick={() => { setDecision(d.key); setReason(""); }}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${on ? "ring-2" : "hover:bg-secondary/40"}`}
                    style={on ? { borderColor: "var(--brand)", boxShadow: "0 0 0 2px var(--brand-soft)" } : undefined}>
                    <d.icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: `var(--${d.tone === "green" ? "success" : d.tone === "amber" ? "warning" : d.tone === "red" ? "danger" : "violet"})` }} />
                    <div>
                      <div className="text-[13px] font-semibold">{d.label}</div>
                      <div className="text-[11px] text-muted-foreground">{d.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {decision && (
              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <SectionLabel>处置原因 <span style={{ color: "var(--danger)" }}>*</span></SectionLabel>
                  <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="请选择…" /></SelectTrigger>
                    <SelectContent>{(REASONS[decision] || []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <SectionLabel>复核意见 · 记入审计</SectionLabel>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="陈述复核依据…选择「其他」时必填" className="min-h-[70px]" />
                </div>
              </div>
            )}
          </CardContent>
          <div className="flex gap-2.5 border-t p-4">
            <Button variant="outline" className="flex-1" onClick={() => toast("已退回上一步")}>退回</Button>
            <Button className="flex-1" style={{ background: "var(--brand)" }} onClick={submit}>提交复核意见 → MLRO</Button>
          </div>
        </Card>

        {/* right: impact + appeal + trail */}
        <div className="flex flex-col gap-[18px]">
          <div className="flex items-start gap-2.5 rounded-xl border p-3.5 text-[12px]" style={{ background: "var(--warning-bg)", borderColor: "var(--warning-bd)", color: "#7a4a08" }}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--warning)" }} />
            <div><b>处置影响</b> · 批准解冻后资金约 12 分钟到账,<b>不可撤销</b>,并记入合规处置记录。</div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-[15px]">商户申诉材料</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <Link to="/evidence" className="text-[13px] font-semibold" style={{ color: "var(--brand)" }}>资金来源证明_NovaPay.pdf</Link>
                <div className="text-[11px] text-muted-foreground">客户代理 · 06-12 10:30 · 待核实</div>
              </div>
              <Pill tone="amber" dot={false}>待核实</Pill>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-[15px]">处置审计</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative ml-2 border-l pl-6">
                {unfreezeTrail.map((t, i) => (
                  <li key={i} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 bg-card" style={{ borderColor: "var(--brand)" }} />
                    <div className="text-[11px] text-muted-foreground tnum">{t.time}</div>
                    <div className="mt-0.5 text-[12.5px]"><b>{t.actor}</b> · {t.text}</div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
