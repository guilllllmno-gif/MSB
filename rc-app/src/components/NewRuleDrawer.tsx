import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { Zap, History, Layers } from "lucide-react";
import { SectionLabel } from "./bits";
import { CATS, VENUE, type RuCat, type Venue, type Rule } from "@/lib/rules";
import { ruleStore } from "@/lib/store";

const RH = { i: "RH", n: "Raj Hota", c: "#0ea5e9" };
const ACTIONS = ["直接拦截 · 冻结", "评分 +N · 转研判", "评分 +N · 加强监控", "待补料 / 待核验"];
const VENUE_ICON: Record<Venue, typeof Zap> = { gate: Zap, batch: History, both: Layers };
const VENUES: Venue[] = ["gate", "batch", "both"];

const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

export function NewRuleDrawer({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState<RuCat | "">("");
  const [venue, setVenue] = useState<Venue | "">("");
  const [cond, setCond] = useState("");
  const [action, setAction] = useState("");
  const [weight, setWeight] = useState("");
  const [errs, setErrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setName(""); setCat(""); setVenue(""); setCond(""); setAction(""); setWeight(""); setErrs(new Set()); }
  }, [open]);

  const submit = () => {
    const e = new Set<string>();
    if (!name.trim()) e.add("name");
    if (!cat) e.add("cat");
    if (!venue) e.add("venue");
    if (!cond.trim()) e.add("cond");
    if (!action) e.add("action");
    setErrs(e);
    if (e.size) { toast.error("请补全规则信息(名称 / 类别 / 执行场景 / 条件 / 处置)"); return; }
    const n = ruleStore.created().length + 1;
    const rule: Rule = {
      id: `R-NEW-${String(n).padStart(3, "0")}`, name: name.trim(), cat: cat as RuCat, venue: venue as Venue,
      cond: cond.trim(), action, state: "backtest", hits30: 0, fp30: "—", src: "手动新建", owner: RH,
      updated: "2026-06-20", weight: weight.trim() || "+30",
    };
    ruleStore.add(rule);
    toast.success(`已新建规则「${rule.name}」· 进入回测`);
    toast(`执行场景:${VENUE[rule.venue!].label} · 待回测达标后审批上线`);
    onOpenChange(false); onDone?.();
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[50vw] !min-w-[460px] !max-w-[820px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">新建监控规则</span>
          <span className="text-[11.5px] font-normal text-default-400">新规则先进回测,达标审批后才上线生效</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <Input size="sm" label="规则名称" labelPlacement="outside" placeholder="如:同主体滑窗累计阈值" isRequired value={name} onValueChange={setName} isInvalid={errs.has("name")} />

          <Select size="sm" label="规则类别" labelPlacement="outside" placeholder="请选择…" isRequired aria-label="规则类别"
            selectedKeys={cat ? [cat] : []} isInvalid={errs.has("cat")}
            onSelectionChange={(k) => setCat((Array.from(k as Set<string>)[0] as RuCat) ?? "")}>
            {CATS.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
          </Select>

          {/* 执行场景 —— 关键:决定能否实时拦截 */}
          <div>
            <SectionLabel>执行场景 <span className="text-danger">*</span></SectionLabel>
            <div className={`grid grid-cols-3 gap-2 ${errs.has("venue") ? "rounded-xl p-1 ring-2 ring-danger/40" : ""}`}>
              {VENUES.map((v) => { const Icon = VENUE_ICON[v]; const on = venue === v; return (
                <button key={v} onClick={() => setVenue(v)} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12.5px] font-semibold transition-colors"
                  style={on ? onStyle : offStyle}>
                  <Icon className="h-[18px] w-[18px]" />{VENUE[v].short}</button>
              ); })}
            </div>
            {venue && <p className="mt-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">{VENUE[venue].hint}</p>}
            {!venue && <p className="mt-1.5 text-[11px] leading-relaxed text-default-400">事中=交易发生时能实时算出(单笔阈值/名单/地址/滑窗累计);事后=要跨时间跨主体聚合,实时算不出(扇入/速度/集中度/链跳)。</p>}
          </div>

          <Textarea label="触发条件" labelPlacement="outside" placeholder="如:同主体 7 日累计入金 ≥ CAD 10,000" isRequired value={cond} onValueChange={setCond} minRows={2} isInvalid={errs.has("cond")} />

          <Select size="sm" label="命中处置" labelPlacement="outside" placeholder="请选择…" isRequired aria-label="命中处置"
            selectedKeys={action ? [action] : []} isInvalid={errs.has("action")}
            onSelectionChange={(k) => setAction(Array.from(k as Set<string>)[0] ?? "")}>
            {ACTIONS.map((a) => <SelectItem key={a}>{a}</SelectItem>)}
          </Select>

          <Input size="sm" label="权重 / 评分(选填)" labelPlacement="outside" placeholder="如:+40" value={weight} onValueChange={setWeight} />

          <p className="rounded-xl border border-divider bg-default-100 p-3 text-[11.5px] leading-relaxed text-default-500">新建规则<b>不直接上线</b> —— 进入「回测中」,回测命中 / 误报达标后提交审批,审批通过才在所选场景生效。</p>
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          <Button color="primary" onPress={submit}>创建 · 进回测</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
