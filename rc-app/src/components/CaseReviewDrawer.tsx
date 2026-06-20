import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Textarea, Select, SelectItem } from "@heroui/react";
import { ExternalLink, UserPlus } from "lucide-react";
import { Initials, SectionLabel, Pill, KvRow } from "./bits";
import { CSTATE, CFLOW, strLabel, PRIO_TONE, CASES, type Case, type CState } from "@/lib/cases";
import { caseStore, useCaseVersion } from "@/lib/store";

const ME = { i: "JL", n: "James Liu", c: "var(--brand)" };
const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

export function CaseReviewDrawer({ caseItem, open, onOpenChange, onDone }: { caseItem: Case | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  useCaseVersion();
  const nav = useNavigate();
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setChoice(null); setNote(""); setMergeTo(""); setErr(false); }
  }, [open, caseItem?.id]);

  if (!caseItem) return null;
  const c = caseItem;
  const st = caseStore.stateOf(c.id, c.state) as CState;
  const sd = CSTATE[st];
  const owner = caseStore.ownerOf(c.id, c.owner);
  const actions = CFLOW[st];
  const action = actions.find((a) => a.k === choice) || null;
  const str = strLabel(st);
  const otherCases = CASES.filter((x) => x.id !== c.id && x.state !== "merged" && x.state !== "closed");

  const claim = () => { caseStore.set(c.id, st, { owner: ME, event: "认领案件 · 开始调查" }); toast.success(`${c.id} · 已认领`); };

  const submit = () => {
    if (!action) { toast.error("请选择处置动作"); return; }
    if (action.k === "merge" && !mergeTo) { setErr(true); toast.error("请选择合并目标案件"); return; }
    const extra = action.k === "merge" ? ` → ${mergeTo}` : "";
    caseStore.set(c.id, action.to, { owner: owner || ME, event: `${action.label}${extra}`, reason: note.trim() });
    toast.success(`${c.id} · ${action.label}`);
    if (action.to === "queued" || action.to === "filed") toast("已联动报告报送 · STR 流程");
    onOpenChange(false); onDone?.();
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[50vw] !min-w-[460px] !max-w-[820px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">案件研判 · 推进</span>
          <span className="text-[11.5px] font-normal text-default-400">{c.id} · {c.subject}</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold">
            {owner ? <Initials p={owner} size={26} /> : <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-default-100 text-default-400"><UserPlus className="h-3.5 w-3.5" /></span>}
            {owner ? `${owner.n} 调查` : "未分配"}
            <Pill tone={sd.tone}>{sd.label}</Pill>
            <Pill tone={PRIO_TONE[c.priority]} dot={false}>{c.priority}优先</Pill>
          </div>

          <div className="card p-3.5">
            <KvRow label="案件类型">{c.type}</KvRow>
            <KvRow label="风险类型">{c.risk}</KvRow>
            <KvRow label="涉及金额">{c.amount}</KvRow>
            <KvRow label="关联项">{c.linkTo ? <button onClick={() => nav(c.linkTo!)} className="inline-flex items-center gap-1 text-primary hover:opacity-80">{c.linkIds} <ExternalLink className="h-3 w-3" /></button> : c.linkIds}</KvRow>
            <KvRow label="来源">{c.src}</KvRow>
            <KvRow label="STR 进展"><button onClick={() => nav("/reports")} className="inline-flex items-center gap-1 hover:opacity-80" style={{ color: str.link ? "var(--brand)" : "var(--text-3)" }}>{str.text}{str.link && <ExternalLink className="h-3 w-3" />}</button></KvRow>
          </div>

          {!owner && sd.active && (
            <Button color="primary" startContent={<UserPlus className="h-4 w-4" />} onPress={claim}>认领案件 · 开始调查</Button>
          )}

          {!sd.active ? (
            <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500">本案件已 <b>{sd.label}</b>。</div>
          ) : actions.length > 0 ? (
            <>
              <div><SectionLabel>推进动作</SectionLabel>
                <div className={`grid gap-2 ${actions.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  {actions.map((a) => { const Icon = a.icon; const on = choice === a.k; return (
                    <button key={a.k} onClick={() => setChoice(on ? null : a.k)} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12px] font-semibold transition-colors"
                      style={on ? onStyle : offStyle}>
                      <Icon className="h-[18px] w-[18px]" />{a.label}</button>
                  ); })}
                </div>
              </div>

              {action && <div className="rounded-xl border border-divider bg-default-100 p-3 text-[12px] leading-relaxed text-default-600">{action.tip}。记入案件审计日志。</div>}

              {action?.k === "merge" && (
                <Select size="sm" label="合并目标案件" labelPlacement="outside" placeholder="选择在办案件…" isRequired aria-label="合并目标案件"
                  selectedKeys={mergeTo ? [mergeTo] : []} isInvalid={err}
                  onSelectionChange={(k) => { setMergeTo(Array.from(k as Set<string>)[0] ?? ""); setErr(false); }}>
                  {otherCases.map((x) => <SelectItem key={x.id}>{x.id} · {x.subject}</SelectItem>)}
                </Select>
              )}

              <Textarea label="调查 / 推进说明" labelPlacement="outside" value={note} onValueChange={setNote} minRows={3} placeholder="调查结论、证据与下一步…(记入审计日志)" />
            </>
          ) : null}
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          {sd.active && actions.length > 0 && <Button color="primary" onPress={submit}>提交</Button>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
