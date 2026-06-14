import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Check, FolderOpen, Shield, FileQuestion, ArrowUpCircle, DoorOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pill, Avatar, SectionLabel, toneVar } from "./bits";
import { alerts, RC_STATES, sevMeta, DISP, PROC, REASONS, IMPACT, ITONE, FIELDS, SUBMIT, aiRec, type Tone } from "@/lib/data";
import { alertStore } from "@/lib/store";

const L1 = { i: "JL", n: "James Liu", c: "var(--brand)" };
const DISP_ICON: Record<string, typeof Check> = { release: Check, case: FolderOpen, watch: Shield };
const PROC_ICON: Record<string, typeof Check> = { reqinfo: FileQuestion, l2: ArrowUpCircle };

export function ReviewDialog({ alertId, open, onOpenChange, onDone }: { alertId: string | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const a = alerts.find((x) => x.id === alertId) || null;
  const [disp, setDisp] = useState<string | null>(null);
  const [proc, setProc] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [basis, setBasis] = useState("");
  const [fieldVals, setFieldVals] = useState<Record<string, string[]>>({});
  const [errs, setErrs] = useState<Set<string>>(new Set());

  const state = a ? alertStore.stateOf(a.id, a.state) : "new";
  const active = a ? RC_STATES[state].active : false;
  const choice = disp || proc;

  useEffect(() => {
    if (open && a) {
      const rec = active ? aiRec(a).k : null;
      setDisp(rec); setProc(null); setReason(""); setBasis(""); setFieldVals({}); setErrs(new Set());
    }
  }, [open, alertId]); // eslint-disable-line

  if (!a) return null;
  const sev = sevMeta[a.sev];
  const rec = aiRec(a);
  const recLabel = DISP.find((d) => d.k === rec.k)?.label;

  const toggleField = (k: string, val: string, multi: boolean) => {
    setFieldVals((p) => {
      const cur = p[k] || [];
      if (multi) return { ...p, [k]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
      return { ...p, [k]: [val] };
    });
  };

  const submit = () => {
    if (!choice) { toast.error("请选择处置结论或流程操作"); return; }
    const e = new Set<string>();
    if (!reason) e.add("reason");
    if (reason.startsWith("其他") && !basis.trim()) e.add("basis");
    (FIELDS[choice] || []).forEach((fd) => { if (fd.required && !(fieldVals[fd.k] || []).length) e.add(fd.k); });
    setErrs(e);
    if (e.size) { toast.error("请补全所需信息"); return; }
    const cfg = SUBMIT[choice];
    const summary = (FIELDS[choice] || []).map((fd) => { const v = fieldVals[fd.k] || []; return v.length ? `${fd.label}：${v.join("、")}` : ""; }).filter(Boolean).join(" · ");
    const full = [reason, summary, basis.trim()].filter(Boolean).join(" · ");
    alertStore.set(a.id, cfg.state, { assignee: L1, event: `${cfg.label}（L1 ${L1.n}）`, reason: full });
    toast.success("已提交 · " + cfg.label);
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-[560px]">
        <DialogHeader><DialogTitle>告警研判 · 处置结论</DialogTitle></DialogHeader>

        {/* AI 风险研判 */}
        <div className="mt-2 rounded-xl border p-3.5" style={{ borderColor: "var(--violet-bd)", background: "linear-gradient(180deg,var(--violet-bg),#fff)" }}>
          <div className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--violet)" }}>
            <Sparkles className="h-4 w-4" />AI 风险研判
            <span className="ml-auto"><Pill tone={sev.tone}>{sev.label === "高危" ? "高风险" : sev.label === "中危" ? "中风险" : "低风险"}</Pill></span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{a.factors.map((x) => x.title).join(" · ")}</p>
          <p className="mt-2.5 border-t pt-2.5 text-[12.5px]" style={{ borderColor: "var(--violet-bd)" }}><b>建议结论：</b><span style={{ color: "var(--brand)", fontWeight: 700 }}>{recLabel}</span> <span className="text-muted-foreground">（置信度 {rec.conf}%）</span></p>
        </div>

        {/* 关联在途订单 */}
        <div className="mt-3.5 flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--warning-bd)", background: "var(--warning-bg)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card" style={{ borderColor: "var(--warning-bd)", color: "var(--warning)" }}><DoorOpen className="h-4 w-4" /></span>
          <div className="flex-1 text-[12.5px]"><b>关联在途订单 {a.order}</b><div className="text-[11px] text-muted-foreground">资金暂缓中 · 实际放行/拒绝在事中监控闸口执行</div></div>
          <span className="text-[12px] font-semibold" style={{ color: "var(--warning)" }}>前往闸口 →</span>
        </div>

        {/* who */}
        <div className="mt-3.5 flex items-center gap-2.5 text-[13px] font-semibold"><Avatar p={L1} size={26} />{L1.n} 研判操作<span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">L1 调查</span></div>

        {!active ? (
          <div className="mt-3.5 rounded-lg border bg-secondary/50 p-3 text-[12.5px] text-muted-foreground">本告警已关闭 · <b>{RC_STATES[state].label.replace("已结 · ", "")}</b>。如需变更请重新打开。</div>
        ) : (
          <>
            <div className="mt-4"><SectionLabel>处置结论</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {DISP.map((d) => { const Icon = DISP_ICON[d.k]; const on = disp === d.k; return (
                  <button key={d.k} onClick={() => { setDisp(on ? null : d.k); setProc(null); }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12.5px] font-semibold transition-all"
                    style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)", boxShadow: "0 0 0 3px var(--brand-soft)" } : { color: "var(--muted-foreground)" }}>
                    <Icon className="h-[18px] w-[18px]" />{d.label}
                  </button>
                ); })}
              </div>
            </div>

            <div className="mt-4"><SectionLabel>流程操作</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {PROC.map((p) => { const Icon = PROC_ICON[p.k]; const on = proc === p.k; return (
                  <button key={p.k} onClick={() => { setProc(on ? null : p.k); setDisp(null); }}
                    className="flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2.5 text-[12px] font-medium transition-all"
                    style={on ? { borderColor: "var(--violet)", background: "var(--violet-bg)", color: "var(--violet)" } : { color: "var(--muted-foreground)" }}>
                    <Icon className="h-4 w-4" />{p.label}
                  </button>
                ); })}
              </div>
            </div>

            {choice && (
              <div className="mt-3 flex items-start gap-2.5 rounded-lg border p-3 text-[12px] leading-relaxed"
                style={{ background: `var(--${ITONE[choice] === "green" ? "success" : ITONE[choice] === "amber" ? "warning" : ITONE[choice] === "red" ? "danger" : ITONE[choice] === "violet" ? "violet" : "brand"}-bg)`, borderColor: toneVar(ITONE[choice]) }}>
                <span dangerouslySetInnerHTML={{ __html: IMPACT[choice](a) }} />
              </div>
            )}

            {choice && (
              <div className="mt-3.5">
                <label className="mb-1.5 block text-[12.5px] font-semibold">{DISP.concat(PROC).find((x) => x.k === choice)?.label} · 原因 <span style={{ color: "var(--danger)" }}>*</span></label>
                <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
                  <SelectTrigger className={`w-full ${errs.has("reason") ? "border-[var(--danger)]" : ""}`}><SelectValue placeholder="请选择…" /></SelectTrigger>
                  <SelectContent>{(REASONS[choice] || []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* dynamic fields */}
            {choice && (FIELDS[choice] || []).map((fd) => (
              <div key={fd.k} className="mt-3.5">
                <label className="mb-1.5 block text-[12.5px] font-semibold">{fd.label} {fd.required ? <span style={{ color: "var(--danger)" }}>*</span> : <span className="font-normal text-muted-foreground">· 选填</span>}</label>
                {fd.type === "multi" ? (
                  <div className={`flex flex-wrap gap-1.5 ${errs.has(fd.k) ? "rounded-lg p-1 outline outline-2 outline-[var(--danger-bg)]" : ""}`}>
                    {fd.options.map((o) => { const on = (fieldVals[fd.k] || []).includes(o); return (
                      <button key={o} onClick={() => toggleField(fd.k, o, true)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-all"
                        style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" } : { color: "var(--muted-foreground)" }}>
                        <span style={{ color: on ? "var(--brand)" : "var(--text-3)" }}>{on ? "✓" : "+"}</span>{o}
                      </button>
                    ); })}
                  </div>
                ) : (
                  <Select value={(fieldVals[fd.k] || [])[0] || ""} onValueChange={(v) => toggleField(fd.k, v ?? "", false)}>
                    <SelectTrigger className={`w-full ${errs.has(fd.k) ? "border-[var(--danger)]" : ""}`}><SelectValue placeholder="请选择…" /></SelectTrigger>
                    <SelectContent>{fd.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            ))}

            <div className="mt-3.5">
              <label className="mb-1.5 block text-[12.5px] font-semibold">研判依据 <span className="font-normal text-muted-foreground">· 选填</span></label>
              <Textarea value={basis} onChange={(e) => setBasis(e.target.value)} className={`min-h-[70px] ${errs.has("basis") ? "border-[var(--danger)]" : ""}`} placeholder="描述链上溯源、证据与补充材料如何支撑该结论，以及与历史订单的对比…（记入审计日志）" />
            </div>

            <div className="mt-4"><SectionLabel>关联证据材料 · L2 复核重点</SectionLabel>
              <label className="mt-1 flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5"><Checkbox defaultChecked={a.kyb === "完成"} className="mt-0.5" /><span><div className="text-[12.5px] font-semibold">商户补充材料</div><div className="text-[11px] text-muted-foreground">{a.merchant} · KYB {a.kyb}</div></span></label>
              <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5"><Checkbox defaultChecked className="mt-0.5" /><span><div className="text-[12.5px] font-semibold">历史订单参考</div><div className="text-[11px] text-muted-foreground">类似订单放行率 68% · 历史违规 {a.custHistory.violations}</div></span></label>
            </div>
          </>
        )}

        <DialogFooter className="mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          {active && <Button style={{ background: "var(--brand)" }} onClick={submit}>提交决定</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}