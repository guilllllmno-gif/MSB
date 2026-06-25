import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Select, SelectItem, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Zap, History, Layers, Plus, X, Ban, Search, Eye, FileText, Sparkles, FlaskConical, ChevronDown } from "lucide-react";
import { SectionLabel } from "./bits";
import { CATS, VENUE, venueOf, RULE_FIELDS, RULE_OPS, RULE_ELSE, RULE_TEMPLATES, condText, ruleFieldDiffs, ruleChangeSummary, type RuCat, type Venue, type Rule, type Clause, type RuleTemplate } from "@/lib/rules";
import { ruleStore } from "@/lib/store";

const RH = { i: "RH", n: "Raj Hota", c: "#0ea5e9" };
const VENUE_ICON: Record<Venue, typeof Zap> = { gate: Zap, batch: History, both: Layers };
const VENUES: Venue[] = ["gate", "batch", "both"];

const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

// 结果优先(借鉴 Fireblocks ALLOW / BLOCK / 2-TIER):处置是头等选择,评分类内联权重
type OutcomeKey = "block" | "score_inv" | "score_mon" | "rfi";
const OUTCOMES: { k: OutcomeKey; label: string; desc: string; icon: typeof Ban; color: string; scored: boolean; suffix?: string; fixed?: string }[] = [
  { k: "block", label: "拦截 · 冻结", desc: "命中即拦下 / 冻结,不进评分", icon: Ban, color: "var(--danger)", scored: false, fixed: "直接拦截 · 冻结" },
  { k: "score_inv", label: "评分 · 转研判", desc: "计入风险分,转人工研判", icon: Search, color: "var(--brand)", scored: true, suffix: "转研判" },
  { k: "score_mon", label: "评分 · 加强监控", desc: "计入风险分,加强监控不拦", icon: Eye, color: "var(--warning)", scored: true, suffix: "加强监控" },
  { k: "rfi", label: "待补料 / 待核验", desc: "暂缓,要求补充材料 / 核验", icon: FileText, color: "var(--text-3)", scored: false, fixed: "待补料 / 待核验" },
];
// 把已有规则的 action 文案反解回处置类型(供编辑预填)
const actionToOutcome = (action: string): OutcomeKey => {
  if (/拦截|冻结|拒绝/.test(action)) return "block";
  if (/补料|核验/.test(action)) return "rfi";
  if (/加强监控/.test(action)) return "score_mon";
  return "score_inv";
};
const normW = (w: string) => { const n = w.replace(/[^0-9]/g, ""); return n ? `+${n}` : ""; };

// 字段级取值提示(借鉴 Fireblocks 的 currency / 单位抽象 + 合理占位)
const FIELD_HINT: Record<string, string> = {
  "单笔金额 (CAD)": "如 10,000", "7 日累计金额 (CAD)": "如 10,000", "24h 笔数": "如 20",
  "30 日对手集中度 (%)": "如 75", "扇入主体数": "如 4", "KYW 评分": "0–100", "综合风险评分": "0–100",
  "账户休眠天数": "如 60", "账户年龄 (天)": "如 30", "地址风险标签": "如 混币器 / 隐私币",
  "名单": "如 制裁名单 / 黑名单", "跨链 / 隐私币": "如 跨链桥 / 隐私币", "KYB 状态": "如 未完成 / 已过期",
};

// 句首标签 若 / 且 / 则 / 否则(对齐固定宽,使整块读成一句话)
const LBL_TONE: Record<string, string> = { brand: "bg-[var(--brand-soft)] text-[var(--brand)]", success: "bg-[var(--success-bg)] text-[var(--success)]", grey: "bg-default-100 text-default-500" };
function Lbl({ tone, children }: { tone: keyof typeof LBL_TONE; children: ReactNode }) {
  return <span className={`mt-0.5 inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-[11.5px] font-bold ${LBL_TONE[tone]}`}>{children}</span>;
}

// 内联可点 chip(借鉴 ClickUp:句子里的可配置词,点开下拉)—— 字段 / 运算符 / 否则
function Chip({ value, placeholder, options, onSelect, invalid }: { value?: string; placeholder: string; options: readonly string[]; onSelect: (v: string) => void; invalid?: boolean }) {
  return (
    <Dropdown placement="bottom-start">
      <DropdownTrigger>
        <button className={`inline-flex h-8 items-center gap-1 rounded-lg border-[1.5px] px-2.5 text-[12.5px] font-semibold transition-colors hover:border-[var(--brand)] ${value ? "border-divider bg-content1 text-foreground" : invalid ? "border-danger/60 text-danger" : "border-dashed border-default-300 text-default-400"}`}>
          {value || placeholder}<ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label={placeholder} onAction={(k) => onSelect(String(k))} className="max-h-[320px] overflow-y-auto">
        {options.map((o) => <DropdownItem key={o}>{o}</DropdownItem>)}
      </DropdownMenu>
    </Dropdown>
  );
}

export function NewRuleDrawer({ open, onOpenChange, onDone, editRule, requiresApproval = false }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: (id?: string) => void; editRule?: Rule | null; requiresApproval?: boolean }) {
  const editing = !!editRule;
  const [name, setName] = useState("");
  const [cat, setCat] = useState<RuCat | "">("");
  const [venue, setVenue] = useState<Venue | "">("");
  const [venueTouched, setVenueTouched] = useState(false);
  const [clauses, setClauses] = useState<Clause[]>([{ field: "", op: "", value: "" }]);
  const [otherwise, setOtherwise] = useState("");
  const [outcomeK, setOutcomeK] = useState<OutcomeKey | "">("");
  const [weight, setWeight] = useState("");
  const [tplKey, setTplKey] = useState("");
  const [errs, setErrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    // 开抽屉时按当前规则(或空白)复位表单 —— 与外部 open/editRule 同步,刻意整体 setState
    /* eslint-disable react-hooks/set-state-in-effect */
    setErrs(new Set()); setTplKey("");
    if (editRule) {
      setName(editRule.name); setCat(editRule.cat); setVenue(editRule.venue || venueOf(editRule)); setVenueTouched(true);
      setOtherwise(editRule.otherwise || ""); setClauses(editRule.clauses?.length ? editRule.clauses.map((c) => ({ ...c })) : [{ field: "", op: "", value: "" }]);
      setOutcomeK(actionToOutcome(editRule.action)); setWeight(editRule.weight || "");
    } else {
      setName(""); setCat(""); setVenue(""); setVenueTouched(false); setClauses([{ field: "", op: "", value: "" }]); setOtherwise(""); setOutcomeK(""); setWeight("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editRule]);

  const setClause = (i: number, patch: Partial<Clause>) => setClauses((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addClause = () => setClauses((cs) => [...cs, { field: "", op: "", value: "" }]);
  const delClause = (i: number) => setClauses((cs) => (cs.length > 1 ? cs.filter((_, j) => j !== i) : cs));
  // 选类别 → 未手动改过场景就自动建议(借鉴 Fireblocks 合理默认 / 通配)
  const pickCat = (c: RuCat | "") => { setCat(c); if (c && !venueTouched) setVenue(venueOf({ cat: c })); };
  const pickVenue = (v: Venue) => { setVenue(v); setVenueTouched(true); };
  const applyTemplate = (t: RuleTemplate) => {
    setTplKey(t.key); setName(t.name); setCat(t.cat); setVenue(t.venue); setVenueTouched(true);
    setClauses(t.clauses.map((c) => ({ ...c }))); setOutcomeK(actionToOutcome(t.action)); setWeight(t.weight); setErrs(new Set());
  };

  const validClauses = clauses.filter((c) => c.field && c.op && c.value);
  const cond = condText(validClauses);
  const oc = OUTCOMES.find((o) => o.k === outcomeK);
  const scored = !!oc?.scored;
  // 由处置类型 + 权重派生最终 action 文案 / 入库权重
  const action = !oc ? "" : oc.scored ? `评分 ${normW(weight) || "+N"} · ${oc.suffix}` : oc.fixed!;
  const storeWeight = scored ? normW(weight) || "+30" : oc?.k === "block" ? "+50" : "+15";
  // 演示态命中 / 误报预估(新规则无基线,按条件确定性派生量级;真实回测在「回测模拟」)
  const h = [...cond].reduce((a, c) => a + c.charCodeAt(0), 0);
  const estHit = validClauses.length ? (h % 34) + 12 : 0;
  const estFp = validClauses.length ? (h % 12) + 4 : 0;

  const submit = () => {
    const e = new Set<string>();
    if (!name.trim()) e.add("name");
    if (!cat) e.add("cat");
    if (!venue) e.add("venue");
    if (!validClauses.length) e.add("cond");
    if (!outcomeK) e.add("outcome");
    if (scored && !normW(weight)) e.add("weight");
    setErrs(e);
    if (e.size) { toast.error("请补全规则信息(名称 / 类别 / 场景 / 至少一条完整条件 / 处置" + (scored ? " / 评分权重" : "") + ")"); return; }

    const fields: Partial<Rule> = { name: name.trim(), cat: cat as RuCat, venue: venue as Venue, cond, clauses: validClauses, otherwise: otherwise || undefined, action, weight: storeWeight };
    if (editing && editRule) {
      // 已上线规则:不直接动线上,落「拟议变更」待总管审批
      if (requiresApproval) {
        const diffs = ruleFieldDiffs(editRule, fields);
        if (!diffs.length) { toast.error("内容未变更,无需提交审批"); return; }
        ruleStore.proposeChange(editRule.id, fields, RH, ruleChangeSummary(diffs));
        toast.success("已提交拟议变更 · 待风控总管审批");
        toast("线上规则保持现版生效,审批通过后才切换");
        onOpenChange(false); onDone?.(editRule.id); return;
      }
      ruleStore.update(editRule.id, fields);
      toast.success(`已保存「${name.trim()}」`);
      onOpenChange(false); onDone?.(editRule.id); return;
    }
    const n = ruleStore.created().length + 1;
    const rule: Rule = {
      id: `R-NEW-${String(n).padStart(3, "0")}`, ...fields, name: name.trim(), cat: cat as RuCat, venue: venue as Venue, cond, action,
      state: "backtest", hits30: 0, fp30: "—", src: tplKey ? `模板 · ${tplKey}` : "手动新建", owner: RH, updated: "2026-06-25", weight: storeWeight,
    } as Rule;
    ruleStore.add(rule);
    toast.success(`已新建规则「${rule.name}」· 进入回测`);
    toast(`执行场景:${VENUE[rule.venue!].label} · 待回测达标后审批上线`);
    onOpenChange(false); onDone?.(rule.id);
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[50vw] !min-w-[480px] !max-w-[860px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-1 border-b border-divider">
          {/* 内联可编辑命名(借鉴 ClickUp「Name this automation rule…」)*/}
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="规则名称"
            placeholder={editing ? "规则名称" : "为这条规则命名…"}
            className={`w-full bg-transparent text-[16px] font-bold text-foreground outline-none placeholder:font-semibold ${errs.has("name") ? "placeholder:text-danger" : "placeholder:text-default-300"}`} />
          <span className="text-[11.5px] font-normal text-default-400">{editing ? `${editRule!.id} · ${requiresApproval ? "改动提交审批,原版照常生效" : "修改条件 / 处置 / 场景"}` : "选典型模式快速起步,或从空白自定义 —— 新规则先进回测,达标审批后上线"}</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          {/* 模板快速起步 —— 仅新建态 */}
          {!editing && (
            <div>
              <SectionLabel><Sparkles className="mr-1 inline h-3.5 w-3.5 text-default-400" />从典型模式起步</SectionLabel>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {RULE_TEMPLATES.map((t) => {
                  const on = tplKey === t.key;
                  return (
                    <button key={t.key} onClick={() => applyTemplate(t)} className="flex flex-col items-start gap-0.5 rounded-xl border-[1.5px] px-2.5 py-2 text-left transition-colors" style={on ? onStyle : offStyle}>
                      <span className="text-[12px] font-bold">{t.key}</span>
                      <span className="text-[10.5px] leading-snug text-default-400">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[10.5px] text-default-400">点模板预填名称 / 类别 / 场景 / 条件 / 处置,下方可继续微调。</p>
            </div>
          )}

          {/* 类别 + 场景同一行,紧凑 */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <Select size="sm" label="规则类别" labelPlacement="outside" placeholder="请选择…" isRequired aria-label="规则类别" className="sm:flex-1"
              selectedKeys={cat ? [cat] : []} isInvalid={errs.has("cat")}
              onSelectionChange={(k) => pickCat((Array.from(k as Set<string>)[0] as RuCat) ?? "")}>
              {CATS.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
            </Select>
            <div className="sm:flex-1">
              <SectionLabel>执行场景 <span className="text-danger">*</span>{cat && !venueTouched && venue && <span className="ml-1.5 font-normal text-default-400">· 按类别建议</span>}</SectionLabel>
              <div className={`mt-1 grid grid-cols-3 gap-1.5 ${errs.has("venue") ? "rounded-xl p-1 ring-2 ring-danger/40" : ""}`}>
                {VENUES.map((v) => { const Icon = VENUE_ICON[v]; const on = venue === v; return (
                  <button key={v} onClick={() => pickVenue(v)} className="flex items-center justify-center gap-1 rounded-lg border-[1.5px] px-1 py-2 text-[11.5px] font-semibold transition-colors"
                    style={on ? onStyle : offStyle}><Icon className="h-3.5 w-3.5" />{VENUE[v].short}</button>
                ); })}
              </div>
            </div>
          </div>
          {venue && <p className="-mt-1 rounded-xl border border-divider bg-default-50 p-2.5 text-[11px] leading-relaxed text-default-500">{VENUE[venue].hint}</p>}

          {/* ── 规则语句 —— 一句话内联编辑(借鉴 ClickUp When/Then,可点 chip 配置)── */}
          <div>
            <SectionLabel>规则语句 <span className="text-danger">*</span></SectionLabel>
            <div className={`mt-1.5 space-y-3 rounded-xl border p-3.5 ${errs.has("cond") || errs.has("outcome") ? "border-danger/50 ring-2 ring-danger/30" : "border-divider"}`} style={{ background: "var(--default-50, transparent)" }}>
              {/* 若 … 且 … */}
              <div className="flex gap-2">
                <Lbl tone="brand">若</Lbl>
                <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                  {clauses.map((c, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                      {i > 0 && <span className="text-[11px] font-bold text-default-400">且</span>}
                      <Chip value={c.field} placeholder="选择字段" options={RULE_FIELDS} invalid={errs.has("cond") && !c.field} onSelect={(v) => setClause(i, { field: v })} />
                      <Chip value={c.op} placeholder="运算" options={RULE_OPS} invalid={errs.has("cond") && !!c.field && !c.op} onSelect={(v) => setClause(i, { op: v })} />
                      <input value={c.value} onChange={(e) => setClause(i, { value: e.target.value })} placeholder={c.field ? FIELD_HINT[c.field] ?? "值" : "值"}
                        className="inline-flex h-8 w-[124px] rounded-lg border-[1.5px] border-divider bg-content1 px-2.5 text-[12.5px] font-semibold text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-default-300 focus:border-[var(--brand)]" />
                      {clauses.length > 1 && <button onClick={() => delClause(i)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-default-400 transition-colors hover:bg-default-100 hover:text-danger"><X className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                  <button onClick={addClause} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:opacity-80"><Plus className="h-3.5 w-3.5" />添加条件(且 AND)</button>
                </div>
              </div>

              {/* 则 … 处置(内联 chip,评分类带权重)*/}
              <div className="flex items-center gap-2">
                <Lbl tone="success">则</Lbl>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Dropdown placement="bottom-start">
                    <DropdownTrigger>
                      <button className={`inline-flex h-8 items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 text-[12.5px] font-semibold transition-colors ${oc ? "" : errs.has("outcome") ? "border-danger/60 text-danger" : "border-dashed border-default-300 text-default-400 hover:border-[var(--brand)]"}`}
                        style={oc ? { borderColor: oc.color, background: `color-mix(in srgb, ${oc.color} 10%, transparent)`, color: oc.color } : undefined}>
                        {oc ? <><oc.icon className="h-3.5 w-3.5" />{oc.label}</> : "选择处置"}<ChevronDown className="h-3.5 w-3.5 opacity-50" />
                      </button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="命中处置" onAction={(k) => setOutcomeK(k as OutcomeKey)}>
                      {OUTCOMES.map((o) => (
                        <DropdownItem key={o.k} description={o.desc} startContent={<span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${o.color} 14%, transparent)`, color: o.color }}><o.icon className="h-3.5 w-3.5" /></span>}>{o.label}</DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                  {scored && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-default-500">· 评分
                      <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="+40"
                        className={`inline-flex h-8 w-[68px] rounded-lg border-[1.5px] bg-content1 px-2.5 text-[12.5px] font-bold text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-default-300 focus:border-[var(--brand)] ${errs.has("weight") ? "border-danger/60" : "border-divider"}`} />
                    </span>
                  )}
                </div>
              </div>

              {/* 否则 … */}
              <div className="flex items-center gap-2">
                <Lbl tone="grey">否则</Lbl>
                <Chip value={otherwise} placeholder="放行 · 继续监控(默认)" options={RULE_ELSE} onSelect={setOtherwise} />
              </div>

              {/* 回测预估 —— 条件就绪即显(演示态估计)*/}
              {validClauses.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-divider pt-2.5 text-[11px]">
                  <span className="flex items-center gap-1 font-semibold text-[var(--brand)]"><FlaskConical className="h-3.5 w-3.5" />回测预估 · 近90天</span>
                  <span className="text-default-500">将额外命中 <b className="text-foreground tnum">~{estHit}</b> 笔</span>
                  <span className="text-default-500">预估误报 <b className="tnum" style={{ color: estFp >= 12 ? "var(--warning)" : "var(--text-3)" }}>~{estFp}%</b></span>
                  <span className="text-default-400">演示态估计 · 真实重放见「回测模拟」调阈值</span>
                </div>
              )}
            </div>
          </div>

          {!editing && <p className="rounded-xl border border-divider bg-default-100 p-3 text-[11.5px] leading-relaxed text-default-500">新建规则<b>不直接上线</b> —— 进入「回测中」,回测命中 / 误报达标后提交审批,审批通过才在所选场景生效。</p>}
          {editing && requiresApproval && <p className="rounded-xl border border-divider bg-default-100 p-3 text-[11.5px] leading-relaxed text-default-500">该规则<b>已上线生效</b> —— 改动<b>不直接套到线上</b>,而是提交一份<b>拟议变更</b>交风控总管审批;原版在审批期间照常拦截,批准后才切换并记入版本历史。</p>}
        </DrawerBody>

        {/* 成品句子条 —— 常驻底部,把配好的规则读成一句话(借鉴 ClickUp 底部 When…then… 摘要)*/}
        <div className="shrink-0 border-t border-divider bg-default-50 px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] leading-relaxed">
            <span className="font-semibold text-default-400">规则</span>
            <span className="rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--brand)]">若</span>
            {validClauses.length ? validClauses.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[11px] font-bold text-default-400">且</span>}
                <span className="rounded-md border border-divider bg-content1 px-1.5 py-0.5 text-[11.5px] font-semibold text-foreground">{c.field} {c.op} {c.value}</span>
              </span>
            )) : <span className="text-default-300">…设触发条件</span>}
            <span className="rounded-md bg-[var(--success-bg)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--success)]">则</span>
            {action ? <span className="rounded-md border border-divider bg-content1 px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ color: oc?.color }}>{action}</span> : <span className="text-default-300">…选处置</span>}
            <span className="rounded-md bg-default-100 px-1.5 py-0.5 text-[10.5px] font-bold text-default-500">否则</span>
            <span className="rounded-md border border-divider bg-content1 px-1.5 py-0.5 text-[11.5px] font-medium text-default-600">{otherwise || "放行 · 继续监控"}</span>
          </div>
        </div>

        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          <Button color="primary" onPress={submit}>{editing ? (requiresApproval ? "提交变更审批" : "保存修改") : "创建 · 进回测"}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
