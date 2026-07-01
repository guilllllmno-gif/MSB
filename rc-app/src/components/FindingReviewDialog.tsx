import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Select, SelectItem, Textarea, Checkbox } from "@heroui/react";
import { ShieldAlert, Link2 as LinkIcon } from "lucide-react";
import { Initials, SectionLabel } from "./bits";
import { toneVar } from "@/lib/data";
import { findingOf, STEP, STEP_FLOW, CAN_CONFIRM, FSTATES, FREASONS, TRACE, traceTier, traceRecovery, type FState, type StepKey } from "@/lib/findings";
import { intakeCase } from "@/lib/caseIntake";
import { findingStore, useFindingVersion } from "@/lib/store";

const ME = { i: "JL", n: "James Liu", c: "var(--brand)" };

// clean selection styles — a single primary accent, neutral otherwise (consistent with ReviewDialog)
const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

// 确认可疑 is a synthetic choice alongside the step keys
type Choice = StepKey | "confirm";
const DECISION: Choice[] = ["confirm", "case", "fp"]; // 处置结论;STR 一律经案件管理,事后确认可疑 → 转案件(不再直连转报送)
const PROCESS: StepKey[] = ["reqinfo", "resume", "escalate"]; // 流程操作(流转,不结案)
const LABEL: Record<Choice, string> = { confirm: "确认可疑", str: STEP.str.label, case: STEP.case.label, fp: STEP.fp.label, reqinfo: STEP.reqinfo.label, resume: STEP.resume.label, escalate: STEP.escalate.label, claim: STEP.claim.label };
const IMPACT: Record<Choice, string> = {
  confirm: "资金已出账 —— 转入「追溯中」:评估能否追回、是否上报已发生损失,再转案件。",
  str: "确认可疑 · 补 STR 报送,结案并喂入报告报送(来源 = 事后检测)。",
  case: "确认可疑 · 转案件:在案件管理生成案件深查,STR 由案件统一起草(案件 = 唯一发起点)。",
  fp: "判定误报关闭(当时放行无误),归档至处置记录。",
  reqinfo: "向主体 / 商户发起 RFI,状态转「待补充材料」,SLA 暂停计时。",
  resume: "材料已回,恢复调查,状态转「处理中」。",
  escalate: "升级至 L2 / MLRO 复核,状态转「已升级」。",
  claim: "认领该命中,状态转「处理中」,开始回溯调查。",
};

export function FindingReviewDialog({ findingId, open, onOpenChange, onDone }: { findingId: string | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  useFindingVersion();
  const f = findingOf(findingId || undefined);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [trace, setTrace] = useState("");
  const [backfill, setBackfill] = useState(true);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState(false);
  const [reasonErr, setReasonErr] = useState(false);

  const st = findingStore.statusOf(f.id, f.status) as FState;
  const sd = FSTATES[st];
  const active = sd.active;
  const decisions = DECISION.filter((c) => (c === "confirm" ? CAN_CONFIRM.includes(st) : STEP_FLOW[st].includes(c as StepKey)));
  const procs = PROCESS.filter((k) => STEP_FLOW[st].includes(k));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setChoice(null); setTrace(""); setBackfill(true); setNote(""); setReason(""); setErr(false); setReasonErr(false); }
  }, [open, findingId]);

  const submit = () => {
    if (!choice) { toast.error("请选择处置结论或流程操作"); return; }
    if (FREASONS[choice] && !reason) { setReasonErr(true); toast.error("请选择处置理由"); return; }
    if (choice === "confirm") {
      if (!trace) { setErr(true); toast.error("请评估资金追溯情况"); return; }
      const rec = traceRecovery(trace);
      const linked = rec.frozen ? "默认登记「请求下游冻结」" : rec.lossReported ? "默认登记「上报已发生损失」" : "持续追踪(不预设冻结 / 损失)";
      findingStore.set(f.id, { status: "tracing", trace, backfill, frozen: rec.frozen, lossReported: rec.lossReported, event: `确认可疑 · 进入追溯 · ${trace} · ${linked}${note.trim() ? " · " + note.trim() : ""}` });
      toast.success(`${f.id} · 确认可疑 → 进入追溯`);
      if (rec.frozen || rec.lossReported) toast(linked);
      if (backfill) toast(`已回填检测规则 · typology「${f.pattern}」事中即时拦截`);
    } else {
      const c = STEP[choice];
      findingStore.set(f.id, { status: c.to, owner: choice === "claim" ? ME : undefined, event: `${c.label}${reason ? " · " + reason : ""}${note.trim() ? " · " + note.trim() : ""}` });
      toast.success(`${f.id} · ${c.label}`);
      // 转案件 → 在案件管理生成 / 并入案件(STR 由案件统一起草)
      if (choice === "case") {
        const { id, attached } = intakeCase({ subject: f.subject, sub: `事后 · ${f.pattern}`, type: f.pattern, risk: "可疑洗钱", amount: f.amount, src: "事后转案件", linkIds: f.id, linkTo: `/finding?id=${f.id}`, addSubject: { name: f.subject, type: f.subject.includes("地址") || f.subject.includes("0x") ? "链上地址" : "商户", role: `事后命中 · ${f.pattern}`, amount: f.amount } });
        toast(attached ? `已并入在办案件 ${id} · 同主体统一调查` : `已转案件 ${id} · 在案件管理起草 STR`);
      }
    }
    onOpenChange(false); onDone?.();
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[50vw] !min-w-[460px] !max-w-[820px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">事后处置 · 命中研判</span>
          <span className="text-[11.5px] font-normal text-default-400">{f.id} · {f.pattern} · {f.subject}</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold"><Initials p={ME} size={26} />{ME.n} 回溯研判<span className="ml-auto rounded-full bg-default-100 px-2 py-0.5 text-[11px] font-semibold text-default-500">L1 · 事后检测</span></div>

          {!active ? (
            <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500">本命中已结案 · <b>{sd.label.replace("已结·", "")}</b>。</div>
          ) : (
            <>
              <p className="flex items-start gap-2 rounded-xl border border-divider p-3 text-[12px] leading-relaxed" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>资金<b>已出账</b> —— 本命中为交易完成后回溯发现,事中已无法拦截。研判结论以「能否追溯 / 报送 / 止损」为重。</span>
              </p>

              {decisions.length > 0 && (
                <div><SectionLabel>处置结论</SectionLabel>
                  <div className={`grid gap-2 ${decisions.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {decisions.map((c) => { const Icon = c === "confirm" ? ShieldAlert : STEP[c].icon; const on = choice === c; return (
                      <button key={c} onClick={() => setChoice(on ? null : c)} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12.5px] font-semibold transition-colors"
                        style={on ? onStyle : offStyle}>
                        <Icon className="h-[18px] w-[18px]" />{LABEL[c]}</button>
                    ); })}
                  </div>
                </div>
              )}

              {procs.length > 0 && (
                <div><SectionLabel>流程操作</SectionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {procs.map((k) => { const Icon = STEP[k].icon; const on = choice === k; return (
                      <button key={k} onClick={() => setChoice(on ? null : k)} className="flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-[12px] font-medium transition-colors"
                        style={on ? onStyle : offStyle}>
                        <Icon className="h-4 w-4" />{STEP[k].label}</button>
                    ); })}
                  </div>
                </div>
              )}

              {choice && (
                <div className="rounded-xl border border-divider bg-default-100 p-3 text-[12px] leading-relaxed text-default-600">{IMPACT[choice]}</div>
              )}

              {choice && FREASONS[choice] && (
                <Select size="sm" label={`${LABEL[choice]} · 处置理由`} labelPlacement="outside" placeholder="请选择…" isRequired aria-label="处置理由"
                  selectedKeys={reason ? [reason] : []} isInvalid={reasonErr}
                  onSelectionChange={(keys) => { setReason(Array.from(keys as Set<string>)[0] ?? ""); setReasonErr(false); }}>
                  {FREASONS[choice].map((r) => <SelectItem key={r}>{r}</SelectItem>)}
                </Select>
              )}

              {choice === "confirm" && (
                <>
                  <Select size="sm" label="资金追溯评估" labelPlacement="outside" placeholder="请评估…" isRequired aria-label="资金追溯评估"
                    selectedKeys={trace ? [trace] : []} isInvalid={err && !trace}
                    onSelectionChange={(keys) => { setTrace(Array.from(keys as Set<string>)[0] ?? ""); setErr(false); }}>
                    {TRACE.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
                  </Select>

                  {/* 追溯档位 → 联动处置(追回组自动;止损组手动) */}
                  {(() => { const ti = traceTier(trace); if (!ti) return null; const rec = traceRecovery(trace); return (
                    <div className="-mt-1 rounded-xl border border-divider bg-default-50 p-3 text-[12px] leading-relaxed">
                      <div className="mb-1.5 flex items-center gap-1.5 font-semibold" style={{ color: toneVar(ti.tone) }}><LinkIcon className="h-3.5 w-3.5" />联动处置</div>
                      <p className="text-default-600">{ti.guide}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: rec.frozen ? "var(--success-bg)" : "var(--chip-bg)", color: rec.frozen ? "var(--success)" : "var(--chip-fg)" }}>{rec.frozen ? "✓ 默认 · 请求下游冻结" : "请求下游冻结 · 可手动"}</span>
                        <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: rec.lossReported ? "var(--warning-bg)" : "var(--chip-bg)", color: rec.lossReported ? "var(--warning)" : "var(--chip-fg)" }}>{rec.lossReported ? "✓ 默认 · 上报已发生损失" : "上报已发生损失 · 可手动"}</span>
                        <span className="rounded-md bg-default-100 px-2 py-0.5 text-[11px] text-default-400">止损(封号 / 列名单)· 工作台手动</span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-default-400">默认项随档位自动登记;另一项与止损动作均可在追溯工作台按实际补登,<b>不互斥</b>。</p>
                    </div>
                  ); })()}
                  <Checkbox isSelected={backfill} onValueChange={setBackfill} classNames={{ base: "max-w-full m-0 inline-flex w-full items-start rounded-xl border border-divider p-2.5", label: "text-[12.5px]" }}>
                    <span className="font-semibold">规则回填</span>
                    <span className="block text-[11px] text-default-400">把 typology「{f.pattern}」回填到检测规则,使事中实时拦截同类(事后 → 规则优化闭环)</span>
                  </Checkbox>
                  {backfill && <p className="-mt-2 text-[11px] leading-relaxed text-default-400">操作后影响:生成检测规则草案 → 提交变更治理 → 回测评估误报 → 审批通过后由事中实时拦截;生效前不影响线上放行。</p>}
                </>
              )}

              <Textarea label="调查依据" labelPlacement="outside" value={note} onValueChange={setNote} minRows={3} placeholder="回溯结论、证据与追溯进展如何支撑该结论…(记入审计日志)" />
            </>
          )}
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          {active && <Button color="primary" onPress={submit}>提交决定</Button>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
