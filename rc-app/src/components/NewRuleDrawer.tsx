import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Input, Select, SelectItem } from "@heroui/react";
import { Zap, History, Layers, Plus, X } from "lucide-react";
import { SectionLabel } from "./bits";
import { CATS, VENUE, RULE_FIELDS, RULE_OPS, RULE_ELSE, condText, type RuCat, type Venue, type Rule, type Clause } from "@/lib/rules";
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
  const [clauses, setClauses] = useState<Clause[]>([{ field: "", op: "", value: "" }]);
  const [otherwise, setOtherwise] = useState("");
  const [action, setAction] = useState("");
  const [weight, setWeight] = useState("");
  const [errs, setErrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setName(""); setCat(""); setVenue(""); setClauses([{ field: "", op: "", value: "" }]); setOtherwise(""); setAction(""); setWeight(""); setErrs(new Set()); }
  }, [open]);

  const setClause = (i: number, patch: Partial<Clause>) => setClauses((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addClause = () => setClauses((cs) => [...cs, { field: "", op: "", value: "" }]);
  const delClause = (i: number) => setClauses((cs) => (cs.length > 1 ? cs.filter((_, j) => j !== i) : cs));
  const validClauses = clauses.filter((c) => c.field && c.op && c.value);

  const submit = () => {
    const e = new Set<string>();
    if (!name.trim()) e.add("name");
    if (!cat) e.add("cat");
    if (!venue) e.add("venue");
    if (!validClauses.length) e.add("cond");
    if (!action) e.add("action");
    setErrs(e);
    if (e.size) { toast.error("请补全规则信息(名称 / 类别 / 执行场景 / 至少一条完整条件 / 处置)"); return; }
    const n = ruleStore.created().length + 1;
    const rule: Rule = {
      id: `R-NEW-${String(n).padStart(3, "0")}`, name: name.trim(), cat: cat as RuCat, venue: venue as Venue,
      cond: condText(validClauses), clauses: validClauses, otherwise: otherwise || undefined, action, state: "backtest", hits30: 0, fp30: "—", src: "手动新建", owner: RH,
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

          {/* 结构化条件:IF … 且(AND) … THEN … ELSE … */}
          <div>
            <SectionLabel>触发条件 <span className="text-danger">*</span></SectionLabel>
            <div className={`rounded-xl border p-3 ${errs.has("cond") ? "border-danger/50 ring-2 ring-danger/30" : "border-divider"}`} style={{ background: "var(--default-50, transparent)" }}>
              <div className="mb-2 flex items-center gap-2"><span className="rounded-md bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand)]">IF</span><span className="text-[11px] text-default-400">满足以下全部条件(AND)</span></div>
              <div className="flex flex-col gap-2">
                {clauses.map((c, i) => (
                  <div key={i}>
                    {i > 0 && <div className="mb-2 flex items-center gap-2"><span className="rounded bg-default-100 px-1.5 py-0.5 text-[10px] font-bold text-default-500">且 AND</span><span className="h-px flex-1 bg-divider" /></div>}
                    <div className="flex items-center gap-1.5">
                      <Select size="sm" aria-label="字段" placeholder="字段" selectedKeys={c.field ? [c.field] : []} className="flex-[2]" classNames={{ trigger: "h-9 min-h-9" }}
                        onSelectionChange={(k) => setClause(i, { field: Array.from(k as Set<string>)[0] ?? "" })}>
                        {RULE_FIELDS.map((fld) => <SelectItem key={fld}>{fld}</SelectItem>)}
                      </Select>
                      <Select size="sm" aria-label="运算符" placeholder="op" selectedKeys={c.op ? [c.op] : []} className="w-[74px] shrink-0" classNames={{ trigger: "h-9 min-h-9" }}
                        onSelectionChange={(k) => setClause(i, { op: Array.from(k as Set<string>)[0] ?? "" })}>
                        {RULE_OPS.map((op) => <SelectItem key={op}>{op}</SelectItem>)}
                      </Select>
                      <Input size="sm" aria-label="值" placeholder="值" value={c.value} onValueChange={(v) => setClause(i, { value: v })} className="flex-1" classNames={{ inputWrapper: "h-9 min-h-9" }} />
                      <button onClick={() => delClause(i)} disabled={clauses.length === 1} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-default-400 transition-colors hover:bg-default-100 hover:text-danger disabled:opacity-30"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addClause} className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:opacity-80"><Plus className="h-3.5 w-3.5" />添加条件(AND)</button>
            </div>
          </div>

          <div className="flex items-center gap-2"><span className="rounded-md bg-[var(--success-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--success)]">THEN</span>
            <Select size="sm" aria-label="命中处置" placeholder="命中处置…" isRequired selectedKeys={action ? [action] : []} isInvalid={errs.has("action")} className="flex-1"
              onSelectionChange={(k) => setAction(Array.from(k as Set<string>)[0] ?? "")}>
              {ACTIONS.map((a) => <SelectItem key={a}>{a}</SelectItem>)}
            </Select>
          </div>
          <div className="flex items-center gap-2"><span className="rounded-md bg-default-100 px-2 py-0.5 text-[11px] font-bold text-default-500">ELSE</span>
            <Select size="sm" aria-label="否则" placeholder="否则(选填)· 默认放行 / 继续监控" selectedKeys={otherwise ? [otherwise] : []} className="flex-1"
              onSelectionChange={(k) => setOtherwise(Array.from(k as Set<string>)[0] ?? "")}>
              {RULE_ELSE.map((a) => <SelectItem key={a}>{a}</SelectItem>)}
            </Select>
          </div>

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
