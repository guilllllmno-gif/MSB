import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Textarea } from "@heroui/react";
import { ExternalLink, Clock, ShieldCheck, Check, AlertTriangle, ScrollText, Gauge } from "lucide-react";
import { Initials, SectionLabel, Pill, KvRow } from "./bits";
import { RTYPE, RSTATE, RFLOW, RFIELDS, MLRO, reportDetail, type Report, type RState } from "@/lib/reports";
import { reportStore, useReportVersion } from "@/lib/store";

const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

export function ReportDrawer({ report, open, onOpenChange, onDone }: { report: Report | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  useReportVersion();
  const nav = useNavigate();
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [attested, setAttested] = useState(false);

  const fields = report ? RFIELDS[report.type] : [];
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setChoice(null); setNote(""); setAttested(false); setChecked(new Set(fields.map((f) => f.label))); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, report?.id]);

  const detail = useMemo(() => (report ? reportDetail(report) : null), [report]);
  if (!report || !detail) return null;

  const st = reportStore.statusOf(report.id, report.status) as RState;
  const sd = RSTATE[st];
  const ty = RTYPE[report.type];
  const ref = reportStore.refOf(report.id, report.ref);
  const actions = RFLOW[st];
  const action = actions.find((a) => a.k === choice) || null;
  const allChecked = checked.size === fields.length;
  // 签发 / 报送是法定动作 —— 需先核齐必填字段 + 勾选签发声明
  const needsSignoff = !!action && (action.to === "queued" || action.to === "filed");
  const isStr = report.type === "STR";

  const toggle = (label: string) => setChecked((p) => { const n = new Set(p); n.has(label) ? n.delete(label) : n.add(label); return n; });

  const submit = () => {
    if (!action) { toast.error("请选择处置动作"); return; }
    if (needsSignoff && !allChecked) { toast.error("仍有必填字段未核实,建议「退回起草人」补正后再签发"); return; }
    if (needsSignoff && !attested) { toast.error("签发前请勾选法定签发声明"); return; }
    const filing = action.to === "filed" || action.to === "ack";
    const newRef = action.to === "filed" && !ref ? `FINTRAC #${report.type}-CA-RCPT-${report.id.slice(-4)}` : undefined;
    reportStore.set(report.id, action.to, {
      mlro: action.to === "draft" ? reportStore.mlroOf(report.id, report.mlro) : MLRO,
      ref: newRef,
      event: `${action.label}（${filing ? "MLRO " + MLRO.n : MLRO.n}）`,
      reason: note.trim(),
    });
    toast.success(`${report.id} · ${action.label}`);
    onOpenChange(false); onDone?.();
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[52vw] !min-w-[480px] !max-w-[860px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">报告报送 · MLRO 复核</span>
          <span className="text-[11.5px] font-normal text-default-400">{report.id} · {ty.full} · {report.subject}</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          {/* MLRO + 法定时限 */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Initials p={MLRO} size={28} />
            <div className="text-[13px] font-semibold leading-tight">{MLRO.n}<div className="text-[11px] font-normal text-default-400">责任合规官 · MLRO 签发</div></div>
            <Pill tone={report.due.tone} icon={<Clock className="h-3.5 w-3.5" />}>法定时限 {report.due.text}</Pill>
            <span className="ml-auto rounded-full bg-default-100 px-2 py-0.5 text-[11px] font-semibold text-default-500">{ty.deadline}</span>
          </div>

          {/* 报告摘要 */}
          <div className="card p-3.5">
            <div className="mb-2 flex flex-wrap items-center gap-2"><Pill tone={ty.tone} dot={false}>{ty.label}</Pill><Pill tone={sd.tone}>{sd.label}</Pill></div>
            <KvRow label="涉事主体">{report.subject}</KvRow>
            <KvRow label="涉及金额">{report.amount}</KvRow>
            <KvRow label="起草人">{report.officer.n}</KvRow>
            <KvRow label="来源">{report.to ? <button onClick={() => nav(report.to!)} className="inline-flex items-center gap-1 text-primary hover:opacity-80">{report.src}{report.srcId ? ` · ${report.srcId}` : ""} <ExternalLink className="h-3 w-3" /></button> : report.src}</KvRow>
            {ref && <KvRow label="FINTRAC 回执">{ref}</KvRow>}
          </div>

          {/* 复核重点 · 按类型自适应 */}
          {report.type === "LVCTR" ? (
            <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--brand-bd)", background: "var(--brand-softer)" }}>
              <div className="flex items-center gap-1.5 text-[12.5px] font-bold"><Gauge className="h-4 w-4 text-primary" />客观阈值上报 · 无需可疑判定</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-default-600">{detail.batch ? `${detail.batch.trigger} · 触发阈值 ${detail.batch.threshold} · 合计 ${detail.batch.total}（${detail.batch.window}）。` : "达到 CAD 10,000 客观阈值,系统自动归集。"}MLRO 复核重点为金额折算与交易对手信息准确性,而非可疑性。</p>
            </div>
          ) : detail.reason ? (
            <div>
              <SectionLabel>{report.type === "TPR" ? "上报依据 · 制裁命中" : "可疑理由叙述 · 合理怀疑(Part F)"}</SectionLabel>
              <div className="rounded-xl border border-divider p-3.5">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-default-400"><ScrollText className="h-3.5 w-3.5" />{detail.reason.src}</span>
                  {detail.reason.tags.map((t) => <Pill key={t.label} tone={t.tone} dot={false}>{t.label}</Pill>)}
                </div>
                <p className="text-[12.5px] leading-relaxed text-default-700">{detail.strDoc?.grounds || detail.reason.body}</p>
              </div>
            </div>
          ) : null}

          {!sd.active ? (
            <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500">本报告已归档 · <b>{sd.label}</b>{ref ? ` · 回执 ${ref}` : ""}。</div>
          ) : (
            <>
              {/* FINTRAC 必填字段 · 完整性核验 */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <SectionLabel>FINTRAC 必填字段 · 完整性核验</SectionLabel>
                  <span className="text-[11px] font-semibold" style={{ color: allChecked ? "var(--success)" : "var(--warning)" }}>齐备 {checked.size}/{fields.length}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {fields.map((fd) => { const ok = checked.has(fd.label); return (
                    <button key={fd.label} onClick={() => toggle(fd.label)} className="flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors"
                      style={ok ? { borderColor: "var(--success-bd)", background: "var(--success-bg)" } : { borderColor: "var(--warning-bd)", background: "var(--warning-bg)" }}>
                      <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-md" style={{ background: ok ? "var(--success)" : "var(--warning)", color: "#fff" }}>{ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-2.5 w-2.5" />}</span>
                      <span className="min-w-0">
                        <span className="text-[12.5px] font-semibold">{fd.label}</span>
                        <span className="ml-2 text-[10.5px] font-medium" style={{ color: ok ? "var(--success)" : "var(--warning)" }}>{ok ? "齐备" : "待确认"}</span>
                        <span className="block text-[11px] text-default-400">{fd.sub}</span>
                      </span>
                    </button>
                  ); })}
                </div>
                {!allChecked && <p className="mt-1.5 text-[11px]" style={{ color: "var(--warning)" }}>有字段标记「待确认」—— 签发前需核齐,或「退回起草人」补正。</p>}
              </div>

              {/* 处置动作(状态门控) */}
              <div><SectionLabel>处置动作</SectionLabel>
                <div className={`grid gap-2 ${actions.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  {actions.map((a) => { const Icon = a.icon; const on = choice === a.k; return (
                    <button key={a.k} onClick={() => setChoice(on ? null : a.k)} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12px] font-semibold transition-colors"
                      style={on ? onStyle : offStyle}>
                      <Icon className="h-[18px] w-[18px]" />{a.label}</button>
                  ); })}
                </div>
              </div>

              {action && <div className="rounded-xl border border-divider bg-default-100 p-3 text-[12px] leading-relaxed text-default-600">{action.tip}。记入审计日志。</div>}

              {/* 法定签发声明(签发 / 报送前必勾) */}
              {needsSignoff && (
                <button onClick={() => setAttested((v) => !v)} className="flex items-start gap-2.5 rounded-xl border-[1.5px] p-3 text-left transition-colors"
                  style={attested ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : { borderColor: "var(--line)" }}>
                  <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-md border" style={attested ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" } : { borderColor: "var(--line)" }}>{attested && <Check className="h-3 w-3" />}</span>
                  <span className="text-[12px] leading-relaxed text-default-600"><span className="inline-flex items-center gap-1 font-semibold text-foreground"><ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--brand)" }} />法定签发声明</span><br />本人(MLRO {MLRO.n})确认已复核上述 FINTRAC 必填字段,报文真实、完整、准确,符合 PCMLTFA 报送要求,授权{isStr ? "向 FINTRAC 签发本 STR" : `提交本 ${report.type}`}。</span>
                </button>
              )}

              <Textarea label="复核意见 / 备注" labelPlacement="outside" value={note} onValueChange={setNote} minRows={3} placeholder="复核结论、补正要求或报送说明…(记入审计日志)" />
            </>
          )}
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          {sd.active && <Button color="primary" isDisabled={!action || (needsSignoff && (!allChecked || !attested))} onPress={submit}>{needsSignoff ? "签发 · 提交" : "提交"}</Button>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
