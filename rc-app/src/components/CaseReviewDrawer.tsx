import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Select, SelectItem, Textarea, Checkbox } from "@heroui/react";
import { Initials, SectionLabel, Pill } from "./bits";
import { CASE_OP_GROUPS, CASE_OPS, ARCHIVE_REASONS, MATERIALS, CSTATE, CASES, type Case, type CState } from "@/lib/cases";
import { caseStore } from "@/lib/store";
import type { Person } from "@/lib/data";

const L1: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const tc = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : t === "green" ? "var(--success)" : t === "violet" ? "var(--violet)" : t === "blue" ? "var(--brand)" : "var(--text-3)");
const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

export function CaseReviewDrawer({ caseItem, open, onOpenChange, preselect, recOp, onDone }: { caseItem: Case | null; open: boolean; onOpenChange: (o: boolean) => void; preselect?: string | null; recOp?: string; onDone?: () => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [mats, setMats] = useState<string[]>([]);
  const [dual, setDual] = useState(false);
  const [errs, setErrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setChoice(preselect ?? null); setReason(""); setArchiveReason(""); setMergeTo(""); setMats([]); setDual(false); setErrs(new Set()); }
  }, [open, caseItem?.id, preselect]);

  if (!caseItem) return null;
  const c = caseItem;
  const st = caseStore.stateOf(c.id, c.state) as CState;
  const sd = CSTATE[st];
  const owner = caseStore.ownerOf(c.id, c.owner);
  const op = CASE_OPS.find((o) => o.k === choice) || null;
  const otherCases = CASES.filter((x) => x.id !== c.id && x.state !== "merged" && x.state !== "closed");

  const submit = () => {
    if (!op) { toast.error("请选择处置动作"); return; }
    const e = new Set<string>();
    if (op.reasonReq && !reason.trim()) e.add("reason");
    if (op.archive && !archiveReason) e.add("archive");
    if (op.merge && !mergeTo) e.add("merge");
    if (op.materials && !mats.length) e.add("mats");
    if (op.dual && !dual) e.add("dual");
    setErrs(e);
    if (e.size) { toast.error("请补全所需信息"); return; }
    const extra = op.merge ? ` → ${mergeTo}` : op.materials ? `(${mats.join("、")})` : "";
    const detail = [archiveReason, reason.trim()].filter(Boolean).join(" · ");
    const to = op.to || st; // 无 to 的为过程动作(请求信息 / 升级 / 关联)维持当前状态
    caseStore.set(c.id, to, { owner: owner || L1, event: `${op.label}${extra}${op.dual ? " · 双签" : ""}（L1 ${L1.n}）`, reason: detail });
    toast.success(`${c.id} · ${op.label}`);
    if (op.to === "str_draft" || to === "queued" || to === "filed") toast("已联动报告报送 · STR 流程");
    onOpenChange(false); onDone?.();
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[50vw] !min-w-[460px] !max-w-[820px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">案件操作 · {c.id}</span>
          <span className="text-[11.5px] font-normal text-default-400">{sd.label} · 处理方 风控 L1</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold"><Initials p={L1} size={26} />L1 审批人操作 <span className="font-normal text-default-400">{L1.n}</span><span className="ml-auto"><Pill tone={sd.tone}>{sd.label}</Pill></span></div>

          {!sd.active ? (
            <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500">本案件已 <b>{sd.label}</b>,无需进一步处置。</div>
          ) : !owner ? (
            <div className="flex items-center justify-between rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500"><span>案件未认领 —— 认领后方可处置。</span><Button size="sm" color="primary" onPress={() => { caseStore.set(c.id, st, { owner: L1, event: "认领案件 · 开始调查" }); toast.success(`${c.id} · 已认领`); }}>认领案件</Button></div>
          ) : (
            <>
              {CASE_OP_GROUPS.map((g) => (
                <div key={g.title}><SectionLabel>{g.title}</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {g.ops.map((o) => { const Icon = o.icon; const on = choice === o.k; const isRec = o.k === recOp; return (
                      <button key={o.k} onClick={() => { setChoice(on ? null : o.k); setErrs(new Set()); }}
                        className="relative flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12px] font-semibold transition-colors" style={on ? onStyle : offStyle}>
                        {isRec && <span className="absolute -top-1.5 right-1.5 rounded-full px-1.5 py-px text-[8.5px] font-bold" style={{ background: "var(--brand)", color: "#fff" }}>建议</span>}
                        <Icon className="h-[18px] w-[18px]" style={{ color: on ? "var(--brand)" : tc(o.tone) }} />{o.label}</button>
                    ); })}
                  </div>
                </div>
              ))}

              {op && <div className="rounded-xl border border-divider bg-default-100 p-3 text-[12px] leading-relaxed text-default-600"><b className="text-foreground">操作影响</b> · {op.impact}</div>}

              {op?.archive && (
                <Select size="sm" label="归档原因" labelPlacement="outside" placeholder="请选择…" isRequired aria-label="归档原因"
                  selectedKeys={archiveReason ? [archiveReason] : []} isInvalid={errs.has("archive")}
                  onSelectionChange={(k) => { setArchiveReason(Array.from(k as Set<string>)[0] ?? ""); setErrs(new Set()); }}>
                  {ARCHIVE_REASONS.map((r) => <SelectItem key={r}>{r}</SelectItem>)}
                </Select>
              )}
              {op?.merge && (
                <Select size="sm" label="合并目标案件" labelPlacement="outside" placeholder="选择在办案件…" isRequired aria-label="合并目标案件"
                  selectedKeys={mergeTo ? [mergeTo] : []} isInvalid={errs.has("merge")}
                  onSelectionChange={(k) => { setMergeTo(Array.from(k as Set<string>)[0] ?? ""); setErrs(new Set()); }}>
                  {otherCases.map((x) => <SelectItem key={x.id}>{x.id} · {x.subject}</SelectItem>)}
                </Select>
              )}
              {op?.materials && (
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-semibold">需补充材料 <span className="text-danger">*</span></label>
                  <div className={`flex flex-wrap gap-1.5 ${errs.has("mats") ? "rounded-xl p-1 ring-2 ring-danger/40" : ""}`}>
                    {MATERIALS.map((m) => { const on = mats.includes(m); return (
                      <button key={m} onClick={() => { setMats((p) => p.includes(m) ? p.filter((x) => x !== m) : [...p, m]); setErrs(new Set()); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors" style={on ? onStyle : offStyle}>
                        <span>{on ? "✓" : "+"}</span>{m}</button>
                    ); })}
                  </div>
                </div>
              )}
              {op?.dual && (
                <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-[12px] ${errs.has("dual") ? "border-danger" : "border-divider"}`}>
                  <Checkbox isSelected={dual} onValueChange={(v) => { setDual(v); setErrs(new Set()); }} size="sm" />
                  <span className="text-default-600"><b className="text-foreground">双签确认</b> —— 误报放行需第二名审核员(L2)复核签字,确认排除可疑后方可结案放行。</span>
                </label>
              )}

              {op && <Textarea label={op.archive ? "归档备注" : "处置说明"} labelPlacement="outside" value={reason} onValueChange={(v) => { setReason(v); setErrs(new Set()); }} minRows={3}
                isInvalid={errs.has("reason")} placeholder={op.reasonReq ? "调查结论、证据与依据…(必填 · 记入审计日志)" : "补充说明(可选)…(记入审计日志)"} />}
            </>
          )}
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          {sd.active && owner && <Button color="primary" onPress={submit}>提交决定</Button>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
