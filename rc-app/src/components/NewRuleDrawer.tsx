import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Textarea, Select, SelectItem, Checkbox, CheckboxGroup, Slider } from "@heroui/react";
import { Zap, History, Layers, GripVertical, Trash2, Plus, Info, RefreshCw, Search, Bell, ListFilter, ShieldCheck, ArrowRight } from "lucide-react";
import {
  CATS, VENUE, venueOf, RULE_FIELDS, RULE_OPS, OP_LABEL, isAmountField, RULE_SCOPES, RULE_NETWORKS, RULE_ESCALATIONS, RULE_DISPOSITIONS, SEVERITIES,
  ruleFieldDiffs, ruleChangeSummary, type RuCat, type Venue, type Rule, type Clause, type RuleMode, type Severity, type Joiner,
} from "@/lib/rules";
import { ruleStore } from "@/lib/store";

const RH = { i: "RH", n: "Raj Hota", c: "#0ea5e9" };
const VENUE_ICON: Record<Venue, typeof Zap> = { gate: Zap, batch: History, both: Layers };
const VENUES: Venue[] = ["gate", "batch", "both"];
const OP_CN: Record<string, string> = { "≥": "大于等于", "≤": "小于等于", ">": "大于", "<": "小于", "=": "等于", "≠": "不等于", "命中": "命中", "包含": "包含" };

const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

// 句首小标签 + 摘要 token
function Cap({ children, tone = "grey" }: { children: ReactNode; tone?: "brand" | "success" | "grey" }) {
  const c = tone === "brand" ? "bg-[var(--brand-soft)] text-[var(--brand)]" : tone === "success" ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-default-100 text-default-500";
  return <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${c}`}>{children}</span>;
}
function Tok({ children, color }: { children: ReactNode; color?: string }) {
  return <span className="rounded-md border border-divider bg-content1 px-1.5 py-0.5 text-[11.5px] font-semibold" style={color ? { color } : undefined}>{children}</span>;
}
// 区块小标题(局部,带 * 选项)
function Lbl({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-wider text-default-400">{children}</div>;
}

export function NewRuleDrawer({ open, onOpenChange, onDone, editRule, requiresApproval = false }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: (id?: string) => void; editRule?: Rule | null; requiresApproval?: boolean }) {
  const editing = !!editRule;
  const [name, setName] = useState("");
  const [cat, setCat] = useState<RuCat | "">("");
  const [scope, setScope] = useState("");
  const [network, setNetwork] = useState("全部网络");
  const [venue, setVenue] = useState<Venue | "">("");
  const [venueTouched, setVenueTouched] = useState(false);
  const [desc, setDesc] = useState("");
  const [mode, setMode] = useState<RuleMode>("alert");
  const [stopScan, setStopScan] = useState(true);
  const [clauses, setClauses] = useState<Clause[]>([{ field: "", op: "", value: "" }]);
  const [joiner, setJoiner] = useState<Joiner>("AND");
  const [actions, setActions] = useState<string[]>([]);
  const [escalation, setEscalation] = useState("");
  const [severity, setSeverity] = useState<Severity>("中");
  const [weight, setWeight] = useState(40);
  const [errs, setErrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setErrs(new Set());
    if (editRule) {
      setName(editRule.name); setCat(editRule.cat); setVenue(editRule.venue || venueOf(editRule)); setVenueTouched(true);
      setScope(editRule.scope || RULE_SCOPES[0]); setNetwork(editRule.network || "全部网络"); setDesc(editRule.desc || "");
      setMode(editRule.mode || "alert"); setStopScan(editRule.stopScan ?? true);
      setClauses(editRule.clauses?.length ? editRule.clauses.map((c) => ({ ...c })) : [{ field: "", op: "", value: "" }]); setJoiner(editRule.joiner || "AND");
      setActions(editRule.actions?.length ? editRule.actions : (editRule.action ? [editRule.action] : []));
      setEscalation(editRule.escalation || RULE_ESCALATIONS[0]); setSeverity(editRule.severity || "中");
      setWeight(Math.abs(parseInt(editRule.weight.replace(/[^0-9]/g, ""), 10)) || 30);
    } else {
      setName(""); setCat(""); setScope(""); setNetwork("全部网络"); setVenue(""); setVenueTouched(false); setDesc("");
      setMode("alert"); setStopScan(true); setClauses([{ field: "", op: "", value: "" }]); setJoiner("AND");
      setActions([]); setEscalation(""); setSeverity("中"); setWeight(40);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editRule]);

  const setClause = (i: number, patch: Partial<Clause>) => setClauses((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addClause = () => setClauses((cs) => [...cs, { field: "", op: "", value: "" }]);
  const delClause = (i: number) => setClauses((cs) => (cs.length > 1 ? cs.filter((_, j) => j !== i) : cs));
  const pickCat = (c: RuCat | "") => { setCat(c); if (c && !venueTouched) setVenue(venueOf({ cat: c })); };

  const validClauses = clauses.filter((c) => c.field && c.op && c.value);
  const join = joiner === "AND" ? " 且 " : " 或 ";
  const cond = validClauses.map((c) => `${c.field} ${c.op} ${c.value}`).join(join);
  const condReadable = validClauses.map((c) => `${c.field} ${OP_CN[c.op] ?? c.op} ${c.value}${isAmountField(c.field) ? " CAD" : ""}`).join(join);
  const w = `+${weight}`;
  const usedActions = mode === "alert" ? actions : [];
  const action = usedActions.length ? usedActions.join(" · ") : mode === "score" ? `评分 ${w}` : "生成告警";
  const h = [...cond].reduce((a, c) => a + c.charCodeAt(0), 0);
  const estHit = validClauses.length ? (h % 34) + 12 : 0;
  const estFp = validClauses.length ? (h % 12) + 4 : 0;

  const runRule = () => { if (!validClauses.length) { toast.error("请先至少配置一条完整条件"); return; } toast.success(`已运行 · 近90天预估命中 ~${estHit} 笔 · 误报 ~${estFp}%`); };

  const submit = () => {
    const e = new Set<string>();
    if (!name.trim()) e.add("name");
    if (!cat) e.add("cat");
    if (!scope) e.add("scope");
    if (!network) e.add("network");
    if (!venue) e.add("venue");
    if (!validClauses.length) e.add("cond");
    if (mode === "alert" && !usedActions.length) e.add("actions");
    if (!escalation) e.add("escalation");
    setErrs(e);
    if (e.size) { toast.error("请补全带 * 的必填项(元数据 / 至少一条完整条件 / 处置动作 / 升级路径)"); return; }

    const fields: Partial<Rule> = {
      name: name.trim(), cat: cat as RuCat, venue: venue as Venue, scope, network, desc: desc || undefined,
      mode, stopScan, cond, clauses: validClauses, joiner, actions: usedActions, escalation, severity, action, weight: w,
    };
    if (editing && editRule) {
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
      state: "backtest", hits30: 0, fp30: "—", src: "手动新建", owner: RH, updated: "2026-06-25", weight: w,
    } as Rule;
    ruleStore.add(rule);
    toast.success(`已新建规则「${rule.name}」· 进入回测`);
    toast(`执行场景:${VENUE[rule.venue!].label} · 待回测达标后审批上线`);
    onOpenChange(false); onDone?.(rule.id);
  };

  const submitLabel = editing ? (requiresApproval ? "提交变更审批" : "保存修改") : "保存并提交";

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange} scrollBehavior="inside" classNames={{ base: "max-w-[1080px] h-[92vh]", header: "border-b border-divider", footer: "border-t border-divider" }}>
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-0.5 pr-10">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="规则名称" placeholder={editing ? "规则名称" : "为这条规则命名…"}
            className={`w-full bg-transparent text-[17px] font-bold text-foreground outline-none placeholder:font-semibold ${errs.has("name") ? "placeholder:text-danger" : "placeholder:text-default-300"}`} />
          <span className="text-[11.5px] font-normal text-default-400">{editing && requiresApproval ? "改动提交审批,原版照常生效" : "定义触发条件、命中动作与风险校验,创建后进入「回测模拟」验证,审批生效后才生效。"}</span>
        </ModalHeader>

        <ModalBody className="flex flex-col gap-0 p-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* ── 规则元数据(全宽)── */}
            <div className="mb-5">
              <Lbl>规则元数据</Lbl>
              <div className="mt-2.5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Select size="sm" label="规则类别" labelPlacement="outside" isRequired aria-label="规则类别" placeholder="请选择…" selectedKeys={cat ? [cat] : []} isInvalid={errs.has("cat")}
                  onSelectionChange={(k) => pickCat((Array.from(k as Set<string>)[0] as RuCat) ?? "")}>
                  {CATS.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
                </Select>
                <Select size="sm" label="适用场景" labelPlacement="outside" isRequired aria-label="适用场景" placeholder="请选择…" selectedKeys={scope ? [scope] : []} isInvalid={errs.has("scope")}
                  onSelectionChange={(k) => setScope(Array.from(k as Set<string>)[0] ?? "")}>
                  {RULE_SCOPES.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
                </Select>
                <Select size="sm" label="适用网络" labelPlacement="outside" isRequired aria-label="适用网络" placeholder="请选择…" selectedKeys={network ? [network] : []} isInvalid={errs.has("network")}
                  onSelectionChange={(k) => setNetwork(Array.from(k as Set<string>)[0] ?? "")}>
                  {RULE_NETWORKS.map((nw) => <SelectItem key={nw}>{nw}</SelectItem>)}
                </Select>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                <div>
                  <div className="mb-1.5 text-[12px] font-medium text-default-600">执行场景 <span className="text-danger">*</span>{cat && !venueTouched && venue && <span className="ml-1 font-normal text-default-400">· 按类别建议</span>}</div>
                  <div className={`flex gap-2 ${errs.has("venue") ? "rounded-xl p-1 ring-2 ring-danger/40" : ""}`}>
                    {VENUES.map((v) => { const Icon = VENUE_ICON[v]; const on = venue === v; return (
                      <button key={v} onClick={() => { setVenue(v); setVenueTouched(true); }} className="flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-3 py-2 text-[12.5px] font-semibold transition-colors" style={on ? onStyle : offStyle}>
                        <Icon className="h-4 w-4" />{VENUE[v].short}</button>
                    ); })}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1.5 text-[12px] font-medium text-default-600">规则描述</div>
                  <Textarea size="sm" aria-label="规则描述" minRows={1} placeholder="描述本规则的监控内容及重要原则" value={desc} onValueChange={setDesc} />
                </div>
              </div>
              {venue && <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-default-400"><Info className="mt-px h-3.5 w-3.5 shrink-0" />{VENUE[venue].hint}</p>}
            </div>

            {/* ── 两栏:触发条件(IF) → 命中动作(THEN)── */}
            <div className="grid gap-4 lg:grid-cols-[1fr_44px_1fr]">
              {/* 左:触发条件 */}
              <div className="rounded-2xl border border-divider bg-content1 p-4 shadow-soft">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[14.5px] font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><ListFilter className="h-4 w-4" /></span>触发条件(IF)</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] text-default-400">组内逻辑</span>
                    <div className="flex items-center rounded-lg bg-default-100 p-0.5 text-[11px] font-bold">
                      {(["AND", "OR"] as const).map((j) => (
                        <button key={j} onClick={() => setJoiner(j)} className={`rounded-md px-2 py-0.5 transition-colors ${joiner === j ? "bg-content1 text-[var(--brand)] shadow-soft" : "text-default-400"}`}>{j}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl border bg-default-50 p-3 ${errs.has("cond") ? "border-danger/50 ring-2 ring-danger/30" : "border-divider"}`}>
                  <div className="flex flex-col gap-2">
                    {clauses.map((c, i) => (
                      <div key={i}>
                        {i > 0 && <div className="mb-2 flex items-center gap-2"><span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand)]">{joiner}</span><span className="h-px flex-1 bg-divider" /></div>}
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-default-300" />
                          <Select size="sm" aria-label="字段" placeholder="选择字段" selectedKeys={c.field ? [c.field] : []} className="flex-[2]" classNames={{ trigger: "h-9 min-h-9 bg-content1" }}
                            onSelectionChange={(k) => setClause(i, { field: Array.from(k as Set<string>)[0] ?? "" })}>
                            {RULE_FIELDS.map((fld) => <SelectItem key={fld}>{fld}</SelectItem>)}
                          </Select>
                          <Select size="sm" aria-label="运算符" placeholder="运算" selectedKeys={c.op ? [c.op] : []} className="w-[116px] shrink-0" classNames={{ trigger: "h-9 min-h-9 bg-content1" }}
                            onSelectionChange={(k) => setClause(i, { op: Array.from(k as Set<string>)[0] ?? "" })}>
                            {RULE_OPS.map((op) => <SelectItem key={op}>{OP_LABEL[op]}</SelectItem>)}
                          </Select>
                          <Input size="sm" aria-label="取值" placeholder="值" value={c.value} onValueChange={(v) => setClause(i, { value: v })} className="flex-1 min-w-[96px]" classNames={{ inputWrapper: "h-9 min-h-9 bg-content1" }}
                            startContent={isAmountField(c.field) ? <span className="text-[12px] text-default-400">$</span> : undefined}
                            endContent={isAmountField(c.field) ? <span className="text-[11px] text-default-400">CAD</span> : undefined} />
                          <button onClick={() => delClause(i)} disabled={clauses.length === 1} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-default-400 transition-colors hover:bg-default-100 hover:text-danger disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <button onClick={addClause} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:opacity-80"><Plus className="h-3.5 w-3.5" />添加条件</button>
                      <button onClick={() => toast("演示态:子组(嵌套 AND/OR)接后端规则引擎后开放")} className="inline-flex items-center gap-1 text-[12px] font-semibold text-default-400 hover:text-default-600"><Plus className="h-3.5 w-3.5" />添加子组</button>
                    </div>
                    <Button size="sm" color="primary" variant="flat" className="h-7 font-semibold" onPress={runRule}>运行规则</Button>
                  </div>
                </div>

                {/* 预览规则 */}
                <div className="mt-3 rounded-xl border border-divider p-3" style={{ background: "var(--brand-soft)" }}>
                  <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--brand)]"><Info className="h-3.5 w-3.5" />预览规则</div>
                  {validClauses.length ? (
                    <div className="mt-1.5 text-[12px] leading-relaxed text-default-600">
                      当一笔交易满足以下情况时,系统会触发{mode === "score" ? "评分" : "预警"}:
                      <div className="mt-1.5 rounded-lg bg-content1 p-2.5">
                        <div className="text-[11px] font-bold text-default-400">情况 1 · {joiner === "AND" ? `同时满足以下 ${validClauses.length} 条` : `满足以下任一条(共 ${validClauses.length} 条)`}</div>
                        <div className="mt-1 text-[12.5px] font-semibold text-foreground">{condReadable}</div>
                      </div>
                    </div>
                  ) : <p className="mt-1.5 text-[12px] text-default-400">配置至少一条完整条件后,这里实时生成可读的规则预览。</p>}
                </div>
              </div>

              {/* 中:箭头 + 分隔 */}
              <div className="hidden flex-col items-center lg:flex">
                <span className="w-px flex-1 bg-divider" />
                <span className="my-1 flex h-9 w-9 items-center justify-center rounded-xl border border-divider bg-content1 shadow-soft"><ArrowRight className="h-4 w-4 text-default-400" /></span>
                <span className="w-px flex-1 bg-divider" />
              </div>

              {/* 右:命中动作 */}
              <div className="rounded-2xl border border-divider bg-content1 p-4 shadow-soft">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[14.5px] font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><ShieldCheck className="h-4 w-4" /></span>命中动作(THEN)</div>
                  <span className="text-[10.5px] text-default-400">命中后系统自动执行</span>
                </div>

                {/* 规则操作:仅评分 / 生成告警 */}
                <div className="grid grid-cols-2 gap-2">
                  {([["score", "仅评分", "累加分数,不告警", Search], ["alert", "生成告警", "告警 + 触发动作", Bell]] as const).map(([k, label, d, Icon]) => {
                    const on = mode === k;
                    return (
                      <button key={k} onClick={() => setMode(k)} className="flex items-start gap-2 rounded-xl border-[1.5px] p-2.5 text-left transition-colors" style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : offStyle}>
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: on ? "color-mix(in srgb, var(--brand) 16%, transparent)" : "var(--default-100)", color: on ? "var(--brand)" : "var(--text-3)" }}><Icon className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-bold" style={on ? { color: "var(--brand)" } : undefined}>{label}</span>
                          <span className="block text-[10.5px] leading-snug text-default-400">{d}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <Checkbox size="sm" isSelected={stopScan} onValueChange={setStopScan} className="mt-2.5" classNames={{ label: "text-[12px]" }}>命中即停止扫描该交易(不再匹配后续规则)</Checkbox>

                {/* 处置动作 */}
                <div className="mt-4">
                  <Lbl>处置动作 <span className="text-danger">*</span></Lbl>
                  <CheckboxGroup value={actions} onValueChange={setActions} isDisabled={mode === "score"} className={`mt-2 ${errs.has("actions") ? "rounded-xl p-1 ring-2 ring-danger/40" : ""}`} classNames={{ wrapper: "gap-y-2" }}>
                    {RULE_DISPOSITIONS.map((d) => <Checkbox key={d} value={d} size="sm" classNames={{ label: "text-[12.5px]" }}>{d}</Checkbox>)}
                  </CheckboxGroup>
                  {mode === "score" && <p className="mt-1 text-[11px] text-default-400">「仅评分」模式不执行处置动作,仅按权重累加风险分。</p>}
                </div>

                {/* 升级路径 + 严重度 */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select size="sm" label="升级路径" labelPlacement="outside" isRequired aria-label="升级路径" placeholder="请选择…" selectedKeys={escalation ? [escalation] : []} isInvalid={errs.has("escalation")}
                    onSelectionChange={(k) => setEscalation(Array.from(k as Set<string>)[0] ?? "")}>
                    {RULE_ESCALATIONS.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
                  </Select>
                  <div>
                    <div className="mb-1.5 text-[12px] font-medium text-default-600">严重度 <span className="text-danger">*</span></div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {SEVERITIES.map((s) => { const on = severity === s; return (
                        <button key={s} onClick={() => setSeverity(s)} className="rounded-lg border-[1.5px] py-1.5 text-[12px] font-semibold transition-colors" style={on ? onStyle : offStyle}>{s}</button>
                      ); })}
                    </div>
                  </div>
                </div>

                {/* 风险权重 */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-[12px] font-medium text-default-600">风险权重(累加至评分)<span className="text-danger">*</span></div>
                    <span className="text-[13px] font-extrabold tnum text-[var(--brand)]">+{weight}</span>
                  </div>
                  <Slider aria-label="风险权重" size="sm" minValue={0} maxValue={100} step={5} value={weight} onChange={(v) => setWeight(Array.isArray(v) ? v[0] : v)} classNames={{ track: "bg-default-200", filler: "bg-primary" }} />
                  <div className="mt-0.5 flex justify-between text-[10px] text-default-400"><span>0 · 低敏</span><span>{weight >= 50 ? "高权重 → 易升级 MLRO" : "中低权重"}</span><span>100 · 强拦</span></div>
                </div>
              </div>
            </div>

            {/* 治理提示 */}
            {!editing && <p className="mt-4 rounded-xl border border-divider bg-default-100 p-3 text-[11.5px] leading-relaxed text-default-500">新建规则<b>不直接上线</b> —— 进入「回测中」,回测命中 / 误报达标后提交审批,审批通过才在所选场景生效。</p>}
            {editing && requiresApproval && <p className="mt-4 rounded-xl border border-divider bg-default-100 p-3 text-[11.5px] leading-relaxed text-default-500">该规则<b>已上线生效</b> —— 改动<b>不直接套到线上</b>,而是提交一份<b>拟议变更</b>交风控总管审批;原版在审批期间照常拦截,批准后才切换并记入版本历史。</p>}
          </div>

          {/* 成品句子条 —— 常驻底部(对应 ClickUp 底部 When…then… 摘要)*/}
          <div className="shrink-0 border-t border-divider bg-default-50 px-6 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] leading-relaxed">
              <Cap tone="brand">当</Cap>
              {validClauses.length ? validClauses.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5">{i > 0 && <span className="text-[11px] font-bold text-default-400">{joiner === "AND" ? "且" : "或"}</span>}<Tok>{c.field} {c.op} {c.value}</Tok></span>
              )) : <span className="text-default-300">…设触发条件</span>}
              <Cap tone="success">则</Cap>
              <Tok>{action}</Tok>
              <Cap>严重度</Cap><Tok>{severity}</Tok>
              <Cap>权重</Cap><Tok color="var(--brand)">+{weight}</Tok>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="bordered" startContent={<RefreshCw className="h-4 w-4" />} onPress={runRule}>运行 30 天回测</Button>
          <Button color="primary" onPress={submit}>{submitLabel}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
