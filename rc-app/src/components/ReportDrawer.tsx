import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Textarea, Checkbox } from "@heroui/react";
import { ExternalLink } from "lucide-react";
import { Initials, SectionLabel, Pill, KvRow } from "./bits";
import { RTYPE, RSTATE, RFLOW, RFIELDS, MLRO, type Report, type RState } from "@/lib/reports";
import { reportStore, useReportVersion } from "@/lib/store";

const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

export function ReportDrawer({ report, open, onOpenChange, onDone }: { report: Report | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  useReportVersion();
  const nav = useNavigate();
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setChoice(null); setNote(""); }
  }, [open, report?.id]);

  if (!report) return null;
  const st = reportStore.statusOf(report.id, report.status) as RState;
  const sd = RSTATE[st];
  const ty = RTYPE[report.type];
  const mlro = reportStore.mlroOf(report.id, report.mlro);
  const ref = reportStore.refOf(report.id, report.ref);
  const actions = RFLOW[st];
  const action = actions.find((a) => a.k === choice) || null;

  const submit = () => {
    if (!action) { toast.error("请选择处置动作"); return; }
    // 报送 / 回执动作落 MLRO 经手 + FINTRAC 受理回执号
    const filing = action.to === "filed" || action.to === "ack";
    const newRef = action.to === "filed" && !ref ? `FINTRAC #${report.type}-CA-RCPT-${report.id.slice(-4)}` : undefined;
    reportStore.set(report.id, action.to, {
      mlro: action.to === "draft" ? mlro : MLRO,
      ref: newRef,
      event: `${action.label}（${filing ? "MLRO " + MLRO.n : MLRO.n}）`,
      reason: note.trim(),
    });
    toast.success(`${report.id} · ${action.label}`);
    onOpenChange(false); onDone?.();
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[50vw] !min-w-[460px] !max-w-[820px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">报告报送 · MLRO 复核</span>
          <span className="text-[11.5px] font-normal text-default-400">{report.id} · {ty.full} · {report.subject}</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold"><Initials p={MLRO} size={26} />{MLRO.n} 合规复核<span className="ml-auto rounded-full bg-default-100 px-2 py-0.5 text-[11px] font-semibold text-default-500">合规 · MLRO</span></div>

          {/* 报告摘要 */}
          <div className="card p-3.5">
            <div className="mb-1 flex items-center gap-2"><Pill tone={ty.tone} dot={false}>{ty.label}</Pill><Pill tone={sd.tone}>{sd.label}</Pill></div>
            <KvRow label="法定时限">{ty.deadline}</KvRow>
            <KvRow label="来源">{report.to ? <button onClick={() => nav(report.to!)} className="inline-flex items-center gap-1 text-primary hover:opacity-80">{report.src} · {report.srcId} <ExternalLink className="h-3 w-3" /></button> : report.src}</KvRow>
            <KvRow label="涉事主体">{report.subject}</KvRow>
            <KvRow label="涉及金额">{report.amount}</KvRow>
            {ref && <KvRow label="FINTRAC 回执">{ref}</KvRow>}
          </div>
          <p className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] leading-relaxed text-default-600">{report.summary}</p>

          {!sd.active ? (
            <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500">本报告已归档 · <b>{sd.label}</b>{ref ? ` · 回执 ${ref}` : ""}。</div>
          ) : (
            <>
              {/* FINTRAC 必填字段清单(复核重点) */}
              <div><SectionLabel>FINTRAC 必填字段 · 复核重点</SectionLabel>
                <div className="flex flex-col gap-2">
                  {RFIELDS[report.type].map((fd) => (
                    <Checkbox key={fd.label} defaultSelected classNames={{ base: "max-w-full m-0 inline-flex w-full items-start rounded-xl border border-divider p-2.5", label: "text-[12.5px]" }}>
                      <span className="font-semibold">{fd.label}</span><span className="block text-[11px] text-default-400">{fd.sub}</span>
                    </Checkbox>
                  ))}
                </div>
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

              <Textarea label="复核意见 / 备注" labelPlacement="outside" value={note} onValueChange={setNote} minRows={3} placeholder="复核结论、补正要求或报送说明…(记入审计日志)" />
            </>
          )}
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          {sd.active && <Button color="primary" onPress={submit}>提交</Button>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
