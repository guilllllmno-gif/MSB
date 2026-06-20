import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Input, Select, SelectItem } from "@heroui/react";
import { RISK_TYPES, type Priority, type Case } from "@/lib/cases";
import { caseStore } from "@/lib/store";

const ME = { i: "JL", n: "James Liu", c: "var(--brand)" };
const PRIOS: Priority[] = ["高", "中", "低"];
const SRCS = ["手动新建", "告警升级", "事中驳回", "事后转案件", "团伙转案件", "制裁冻结"];

export function NewCaseDrawer({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: (id?: string) => void }) {
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("");
  const [risk, setRisk] = useState("");
  const [prio, setPrio] = useState<Priority | "">("");
  const [amount, setAmount] = useState("");
  const [src, setSrc] = useState("手动新建");
  const [links, setLinks] = useState("");
  const [errs, setErrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setSubject(""); setType(""); setRisk(""); setPrio(""); setAmount(""); setSrc("手动新建"); setLinks(""); setErrs(new Set()); }
  }, [open]);

  const submit = () => {
    const e = new Set<string>();
    if (!subject.trim()) e.add("subject");
    if (!type.trim()) e.add("type");
    if (!risk) e.add("risk");
    if (!prio) e.add("prio");
    setErrs(e);
    if (e.size) { toast.error("请补全案件信息(主体 / 类型 / 风险类型 / 优先级)"); return; }
    const n = caseStore.created().length + 1;
    const c: Case = {
      id: `CASE-20260620-${String(n).padStart(3, "0")}`, subject: subject.trim(), sub: "—", type: type.trim(), risk, priority: prio as Priority,
      amount: amount.trim() || "—", links: links.trim() ? links.split(/[、,，]/).length : 0, linkIds: links.trim() || "—",
      state: "investigating", owner: ME, sla: { text: "剩 3d", tone: "amber" }, submitted: "2026-06-20 10:00", src,
    };
    caseStore.add(c);
    toast.success(`已新建案件 ${c.id} · 进入调查`);
    onOpenChange(false); onDone?.(c.id);
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[46vw] !min-w-[440px] !max-w-[760px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">新增案件</span>
          <span className="text-[11.5px] font-normal text-default-400">手动建案 · 默认进入「调查中」并认领给当前调查员</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <Input size="sm" label="涉案主体" labelPlacement="outside" placeholder="商户 / 地址 / 团伙" isRequired value={subject} onValueChange={setSubject} isInvalid={errs.has("subject")} />
          <Input size="sm" label="案件类型" labelPlacement="outside" placeholder="如:混币器关联 · 制裁溯源" isRequired value={type} onValueChange={setType} isInvalid={errs.has("type")} />
          <div className="grid grid-cols-2 gap-3">
            <Select size="sm" label="风险类型" labelPlacement="outside" placeholder="请选择…" isRequired aria-label="风险类型" selectedKeys={risk ? [risk] : []} isInvalid={errs.has("risk")} onSelectionChange={(k) => setRisk(Array.from(k as Set<string>)[0] ?? "")}>
              {RISK_TYPES.map((r) => <SelectItem key={r}>{r}</SelectItem>)}
            </Select>
            <Select size="sm" label="优先级" labelPlacement="outside" placeholder="请选择…" isRequired aria-label="优先级" selectedKeys={prio ? [prio] : []} isInvalid={errs.has("prio")} onSelectionChange={(k) => setPrio((Array.from(k as Set<string>)[0] as Priority) ?? "")}>
              {PRIOS.map((p) => <SelectItem key={p}>{p}</SelectItem>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input size="sm" label="涉及金额(选填)" labelPlacement="outside" placeholder="CAD 8,200.00" value={amount} onValueChange={setAmount} />
            <Select size="sm" label="来源" labelPlacement="outside" aria-label="来源" selectedKeys={[src]} onSelectionChange={(k) => setSrc(Array.from(k as Set<string>)[0] ?? "手动新建")}>
              {SRCS.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
            </Select>
          </div>
          <Input size="sm" label="关联告警 / 订单(选填)" labelPlacement="outside" placeholder="ALT-50231、DEP-2026…(顿号分隔)" value={links} onValueChange={setLinks} />
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          <Button color="primary" onPress={submit}>创建案件</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
