import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Select, SelectItem, Textarea, Checkbox } from "@heroui/react";
import { Sparkles, Check, FolderOpen, Shield, FileQuestion, ArrowUpCircle, DoorOpen } from "lucide-react";
import { Pill, Initials, SectionLabel } from "./bits";
import { alerts, RC_STATES, sevMeta, DISP, PROC, REASONS, IMPACT, ITONE, FIELDS, SUBMIT, aiRec } from "@/lib/data";
import { alertStore } from "@/lib/store";

const L1 = { i: "JL", n: "James Liu", c: "var(--brand)" };
const DISP_ICON: Record<string, typeof Check> = { release: Check, case: FolderOpen, watch: Shield };
const PROC_ICON: Record<string, typeof Check> = { reqinfo: FileQuestion, l2: ArrowUpCircle };
const toneCol = (t: string) => `var(--${t === "green" ? "success" : t === "amber" ? "warning" : t === "red" ? "danger" : t === "violet" ? "violet" : "brand"})`;

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
    if (open && a) { setDisp(active ? aiRec(a).k : null); setProc(null); setReason(""); setBasis(""); setFieldVals({}); setErrs(new Set()); }
  }, [open, alertId]); // eslint-disable-line

  if (!a) return null;
  const sev = sevMeta[a.sev];
  const rec = aiRec(a);
  const recLabel = DISP.find((d) => d.k === rec.k)?.label;

  const toggleField = (k: string, val: string, multi: boolean) => setFieldVals((p) => {
    const cur = p[k] || [];
    if (multi) return { ...p, [k]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
    return { ...p, [k]: [val] };
  });

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
    alertStore.set(a.id, cfg.state, { assignee: L1, event: `${cfg.label}（L1 ${L1.n}）`, reason: [reason, summary, basis.trim()].filter(Boolean).join(" · ") });
    toast.success("已提交 · " + cfg.label);
    onOpenChange(false); onDone?.();
  };

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>告警研判 · 处置结论</ModalHeader>
        <ModalBody className="pb-2">
          {/* AI 研判 */}
          <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--violet-bd)", background: "linear-gradient(180deg,var(--violet-bg),#fff)" }}>
            <div className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--violet)" }}><Sparkles className="h-4 w-4" />AI 风险研判<span className="ml-auto"><Pill tone={sev.tone}>{sev.label === "高危" ? "高风险" : sev.label === "中危" ? "中风险" : "低风险"}</Pill></span></div>
            <p className="mt-2 text-[12px] leading-relaxed text-default-500">{a.factors.map((x) => x.title).join(" · ")}</p>
            <p className="mt-2.5 border-t pt-2.5 text-[12.5px]" style={{ borderColor: "var(--violet-bd)" }}><b>建议结论：</b><span style={{ color: "var(--brand)", fontWeight: 700 }}>{recLabel}</span> <span className="text-default-400">（置信度 {rec.conf}%）</span></p>
          </div>

          {/* related order */}
          <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--warning-bd)", background: "var(--warning-bg)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-content1" style={{ borderColor: "var(--warning-bd)", color: "var(--warning)" }}><DoorOpen className="h-4 w-4" /></span>
            <div className="flex-1 text-[12.5px]"><b>关联在途订单 {a.order}</b><div className="text-[11px] text-default-500">资金暂缓中 · 实际放行/拒绝在事中监控闸口执行</div></div>
            <span className="text-[12px] font-semibold" style={{ color: "var(--warning)" }}>前往闸口 →</span>
          </div>

          <div className="flex items-center gap-2.5 text-[13px] font-semibold"><Initials p={L1} size={26} />{L1.n} 研判操作<span className="ml-auto rounded-full bg-default-100 px-2 py-0.5 text-[11px] font-semibold text-default-500">L1 调查</span></div>

          {!active ? (
            <div className="rounded-lg border bg-default-50 p-3 text-[12.5px] text-default-500">本告警已关闭 · <b>{RC_STATES[state].label.replace("已结 · ", "")}</b>。如需变更请重新打开。</div>
          ) : (
            <>
              <div><SectionLabel>处置结论</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {DISP.map((d) => { const Icon = DISP_ICON[d.k]; const on = disp === d.k; return (
                    <button key={d.k} onClick={() => { setDisp(on ? null : d.k); setProc(null); }} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12.5px] font-semibold transition-all"
                      style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)", boxShadow: "0 0 0 3px var(--brand-soft)" } : { color: "var(--text-2)", borderColor: "#e8eaed" }}>
                      <Icon className="h-[18px] w-[18px]" />{d.label}</button>
                  ); })}
                </div>
              </div>
              <div><SectionLabel>流程操作</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {PROC.map((p) => { const Icon = PROC_ICON[p.k]; const on = proc === p.k; return (
                    <button key={p.k} onClick={() => { setProc(on ? null : p.k); setDisp(null); }} className="flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2.5 text-[12px] font-medium transition-all"
                      style={on ? { borderColor: "var(--violet)", background: "var(--violet-bg)", color: "var(--violet)" } : { color: "var(--text-2)", borderColor: "#e8eaed" }}>
                      <Icon className="h-4 w-4" />{p.label}</button>
                  ); })}
                </div>
              </div>

              {choice && (
                <div className="flex items-start gap-2.5 rounded-lg border p-3 text-[12px] leading-relaxed" style={{ background: `var(--${ITONE[choice] === "green" ? "success" : ITONE[choice] === "amber" ? "warning" : ITONE[choice] === "red" ? "danger" : ITONE[choice] === "violet" ? "violet" : "brand"}-bg)`, borderColor: toneCol(ITONE[choice]) }}>
                  <span dangerouslySetInnerHTML={{ __html: IMPACT[choice](a) }} />
                </div>
              )}

              {choice && (
                <Select size="sm" label={`${DISP.concat(PROC).find((x) => x.k === choice)?.label} · 原因`} labelPlacement="outside" placeholder="请选择…" isRequired aria-label="原因"
                  selectedKeys={reason ? [reason] : []} isInvalid={errs.has("reason")}
                  onSelectionChange={(keys) => setReason(Array.from(keys as Set<string>)[0] ?? "")}>
                  {(REASONS[choice] || []).map((r) => <SelectItem key={r}>{r}</SelectItem>)}
                </Select>
              )}

              {choice && (FIELDS[choice] || []).map((fd) => fd.type === "select" ? (
                <Select key={fd.k} size="sm" label={fd.label} labelPlacement="outside" placeholder="请选择…" isRequired={fd.required} aria-label={fd.label}
                  selectedKeys={(fieldVals[fd.k] || []).length ? [fieldVals[fd.k][0]] : []} isInvalid={errs.has(fd.k)}
                  onSelectionChange={(keys) => toggleField(fd.k, Array.from(keys as Set<string>)[0] ?? "", false)}>
                  {fd.options.map((o) => <SelectItem key={o}>{o}</SelectItem>)}
                </Select>
              ) : (
                <div key={fd.k}>
                  <label className="mb-1.5 block text-[12.5px] font-semibold">{fd.label} {fd.required ? <span style={{ color: "var(--danger)" }}>*</span> : <span className="font-normal text-default-400">· 选填</span>}</label>
                  <div className={`flex flex-wrap gap-1.5 ${errs.has(fd.k) ? "rounded-lg p-1 ring-2 ring-[var(--danger-bg)]" : ""}`}>
                    {fd.options.map((o) => { const on = (fieldVals[fd.k] || []).includes(o); return (
                      <button key={o} onClick={() => toggleField(fd.k, o, true)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-all"
                        style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" } : { color: "var(--text-2)", borderColor: "#e8eaed" }}>
                        <span>{on ? "✓" : "+"}</span>{o}</button>
                    ); })}
                  </div>
                </div>
              ))}

              <Textarea label="研判依据" labelPlacement="outside" value={basis} onValueChange={setBasis} minRows={3} isInvalid={errs.has("basis")} placeholder="描述链上溯源、证据与补充材料如何支撑该结论…（记入审计日志）" />

              <div><SectionLabel>关联证据材料 · L2 复核重点</SectionLabel>
                <div className="flex flex-col gap-2">
                  <Checkbox defaultSelected={a.kyb === "完成"} classNames={{ base: "max-w-full m-0 inline-flex w-full items-start rounded-lg border border-divider p-2.5", label: "text-[12.5px]" }}>
                    <span className="font-semibold">商户补充材料</span><span className="block text-[11px] text-default-400">{a.merchant} · KYB {a.kyb}</span>
                  </Checkbox>
                  <Checkbox defaultSelected classNames={{ base: "max-w-full m-0 inline-flex w-full items-start rounded-lg border border-divider p-2.5", label: "text-[12.5px]" }}>
                    <span className="font-semibold">历史订单参考</span><span className="block text-[11px] text-default-400">类似订单放行率 68% · 历史违规 {a.custHistory.violations}</span>
                  </Checkbox>
                </div>
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          {active && <Button color="primary" onPress={submit}>提交决定</Button>}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
