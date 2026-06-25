import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem } from "@heroui/react";
import { ListFilter, ShieldCheck, ArrowRight, Trash2, Plus, Ban, Search, Eye, FileText, Sparkles, FlaskConical } from "lucide-react";
import { CATS, VENUE, venueOf, RULE_FIELDS, RULE_OPS, RULE_ELSE, RULE_TEMPLATES, condText, ruleFieldDiffs, ruleChangeSummary, type RuCat, type Venue, type Rule, type Clause, type RuleTemplate } from "@/lib/rules";
import { ruleStore } from "@/lib/store";

const RH = { i: "RH", n: "Raj Hota", c: "#0ea5e9" };
const VENUES: Venue[] = ["gate", "batch", "both"];

// 结果优先(借鉴 Fireblocks ALLOW / BLOCK / 2-TIER):处置是头等选择,评分类内联权重
type OutcomeKey = "block" | "score_inv" | "score_mon" | "rfi";
const OUTCOMES: { k: OutcomeKey; label: string; desc: string; icon: typeof Ban; color: string; scored: boolean; suffix?: string; fixed?: string }[] = [
  { k: "block", label: "拦截 · 冻结", desc: "命中即拦下 / 冻结,不进评分", icon: Ban, color: "var(--danger)", scored: false, fixed: "直接拦截 · 冻结" },
  { k: "score_inv", label: "评分 · 转研判", desc: "计入风险分,转人工研判", icon: Search, color: "var(--brand)", scored: true, suffix: "转研判" },
  { k: "score_mon", label: "评分 · 加强监控", desc: "计入风险分,加强监控不拦", icon: Eye, color: "var(--warning)", scored: true, suffix: "加强监控" },
  { k: "rfi", label: "待补料 / 待核验", desc: "暂缓,要求补充材料 / 核验", icon: FileText, color: "var(--text-3)", scored: false, fixed: "待补料 / 待核验" },
];
const actionToOutcome = (action: string): OutcomeKey => {
  if (/拦截|冻结|拒绝/.test(action)) return "block";
  if (/补料|核验/.test(action)) return "rfi";
  if (/加强监控/.test(action)) return "score_mon";
  return "score_inv";
};
const normW = (w: string) => { const n = w.replace(/[^0-9]/g, ""); return n ? `+${n}` : ""; };

const FIELD_HINT: Record<string, string> = {
  "单笔金额 (CAD)": "如 10,000", "7 日累计金额 (CAD)": "如 10,000", "24h 笔数": "如 20",
  "30 日对手集中度 (%)": "如 75", "扇入主体数": "如 4", "KYW 评分": "0–100", "综合风险评分": "0–100",
  "账户休眠天数": "如 60", "账户年龄 (天)": "如 30", "地址风险标签": "如 混币器 / 隐私币",
  "名单": "如 制裁名单 / 黑名单", "跨链 / 隐私币": "如 跨链桥 / 隐私币", "KYB 状态": "如 未完成 / 已过期",
};

// 句子摘要里的描边 token
function Tok({ children, color }: { children: ReactNode; color?: string }) {
  return <span className="rounded-md border border-divider bg-content1 px-1.5 py-0.5 text-[11.5px] font-semibold" style={color ? { color } : undefined}>{children}</span>;
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
  const pickCat = (c: RuCat | "") => { setCat(c); if (c && !venueTouched) setVenue(venueOf({ cat: c })); };
  const applyTemplate = (t: RuleTemplate) => {
    setTplKey(t.key); setName(t.name); setCat(t.cat); setVenue(t.venue); setVenueTouched(true);
    setClauses(t.clauses.map((c) => ({ ...c }))); setOutcomeK(actionToOutcome(t.action)); setWeight(t.weight); setErrs(new Set());
  };

  const validClauses = clauses.filter((c) => c.field && c.op && c.value);
  const cond = condText(validClauses);
  const oc = OUTCOMES.find((o) => o.k === outcomeK);
  const scored = !!oc?.scored;
  const action = !oc ? "" : oc.scored ? `评分 ${normW(weight) || "+N"} · ${oc.suffix}` : oc.fixed!;
  const storeWeight = scored ? normW(weight) || "+30" : oc?.k === "block" ? "+50" : "+15";
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

  const submitLabel = editing ? (requiresApproval ? "提交变更审批" : "保存修改") : "创建 · 进回测";

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange} scrollBehavior="inside" classNames={{ base: "max-w-[1080px] h-[90vh]", body: "p-0", header: "border-b border-divider", footer: "border-t border-divider" }}>
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-0.5 pr-12">
          {/* 内联命名(借鉴 ClickUp「Name this automation rule…」)*/}
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="规则名称"
            placeholder={editing ? "规则名称" : "为这条规则命名…"}
            className={`w-full bg-transparent text-[17px] font-bold text-foreground outline-none placeholder:font-semibold ${errs.has("name") ? "placeholder:text-danger" : "placeholder:text-default-300"}`} />
          <span className="text-[11.5px] font-normal text-default-400">监控规则 · {editing ? (requiresApproval ? `${editRule!.id} · 改动提交审批,原版照常生效` : `${editRule!.id} · 修改条件 / 处置 / 场景`) : "新规则先进回测,达标审批后上线"}</span>
        </ModalHeader>

        <ModalBody className="flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* 模板快速起步 —— 仅新建态 */}
            {!editing && (
              <div className="mb-5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-default-500"><Sparkles className="h-3.5 w-3.5 text-default-400" />从典型模式起步</div>
                <div className="flex flex-wrap gap-2">
                  {RULE_TEMPLATES.map((t) => {
                    const on = tplKey === t.key;
                    return (
                      <button key={t.key} onClick={() => applyTemplate(t)} title={t.desc}
                        className={`rounded-full border-[1.5px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:border-[var(--brand)]"}`}>{t.key}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 两栏:触发条件 → 命中处置(借鉴 ClickUp Trigger → Action)*/}
            <div className="grid gap-4 lg:grid-cols-[1fr_44px_1fr]">
              {/* 左:触发条件 */}
              <div className="rounded-2xl border border-divider bg-content1 p-4 shadow-soft">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[14.5px] font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><ListFilter className="h-4 w-4" /></span>触发条件</div>
                  {/* 执行场景 = 作用域选择(对应 ClickUp 右上 Tasks ▾)*/}
                  <Select aria-label="执行场景" size="sm" placeholder="场景" selectedKeys={venue ? [venue] : []} isInvalid={errs.has("venue")} className="w-[116px]" classNames={{ trigger: "h-8 min-h-8 bg-default-100" }}
                    onSelectionChange={(k) => { setVenue((Array.from(k as Set<string>)[0] as Venue) ?? ""); setVenueTouched(true); }}>
                    {VENUES.map((v) => <SelectItem key={v}>{VENUE[v].short}</SelectItem>)}
                  </Select>
                </div>

                <Select size="sm" label="规则类别" labelPlacement="outside" placeholder="请选择…" isRequired aria-label="规则类别"
                  selectedKeys={cat ? [cat] : []} isInvalid={errs.has("cat")}
                  onSelectionChange={(k) => pickCat((Array.from(k as Set<string>)[0] as RuCat) ?? "")}>
                  {CATS.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
                </Select>
                {venue && <p className="mt-1.5 text-[11px] leading-relaxed text-default-400">{cat && !venueTouched && <span className="font-semibold text-default-500">已按类别建议 · </span>}{VENUE[venue].hint}</p>}

                {/* 条件子卡:当交易满足全部(AND)*/}
                <div className="mt-3 text-[11.5px] font-semibold text-default-500">当交易满足以下全部条件:</div>
                <div className="mt-2 flex flex-col gap-2">
                  {clauses.map((c, i) => (
                    <div key={i}>
                      {i > 0 && <div className="mb-2 ml-1 text-[11px] font-bold text-default-400">并且</div>}
                      <div className={`rounded-xl border bg-default-50 p-3 ${errs.has("cond") && !(c.field && c.op && c.value) ? "border-danger/40" : "border-divider"}`}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-default-400">条件 {i + 1}</span>
                          {clauses.length > 1 && <button onClick={() => delClause(i)} className="text-default-300 transition-colors hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                        <Select size="sm" label="字段" labelPlacement="outside" aria-label="字段" placeholder="选择字段" selectedKeys={c.field ? [c.field] : []}
                          onSelectionChange={(k) => setClause(i, { field: Array.from(k as Set<string>)[0] ?? "" })}>
                          {RULE_FIELDS.map((fld) => <SelectItem key={fld}>{fld}</SelectItem>)}
                        </Select>
                        <div className="mt-2 grid grid-cols-[88px_1fr] gap-2">
                          <Select size="sm" label="运算符" labelPlacement="outside" aria-label="运算符" placeholder="op" selectedKeys={c.op ? [c.op] : []}
                            onSelectionChange={(k) => setClause(i, { op: Array.from(k as Set<string>)[0] ?? "" })}>
                            {RULE_OPS.map((op) => <SelectItem key={op}>{op}</SelectItem>)}
                          </Select>
                          <Input size="sm" label="取值" labelPlacement="outside" aria-label="取值" placeholder={c.field ? FIELD_HINT[c.field] ?? "值" : "值"} value={c.value} onValueChange={(v) => setClause(i, { value: v })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addClause} className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:opacity-80"><Plus className="h-3.5 w-3.5" />添加条件(且 AND)</button>
              </div>

              {/* 中:箭头 + 分隔 */}
              <div className="hidden flex-col items-center lg:flex">
                <span className="w-px flex-1 bg-divider" />
                <span className="my-1 flex h-9 w-9 items-center justify-center rounded-xl border border-divider bg-content1 shadow-soft"><ArrowRight className="h-4 w-4 text-default-400" /></span>
                <span className="w-px flex-1 bg-divider" />
              </div>

              {/* 右:命中处置 */}
              <div className="rounded-2xl border border-divider bg-content1 p-4 shadow-soft">
                <div className="mb-3 flex items-center gap-2 text-[14.5px] font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><ShieldCheck className="h-4 w-4" /></span>命中处置</div>

                <div className={`rounded-xl border bg-default-50 p-3 ${errs.has("outcome") ? "border-danger/40" : "border-divider"}`}>
                  <Select size="sm" label="命中后" labelPlacement="outside" aria-label="命中处置" placeholder="选择处置动作" isInvalid={errs.has("outcome")}
                    selectedKeys={outcomeK ? [outcomeK] : []} onSelectionChange={(k) => setOutcomeK((Array.from(k as Set<string>)[0] as OutcomeKey) ?? "")}
                    renderValue={(items) => items.map((it) => { const o = OUTCOMES.find((x) => x.k === it.key); return o ? <span key={it.key} className="flex items-center gap-1.5" style={{ color: o.color }}><o.icon className="h-3.5 w-3.5" />{o.label}</span> : it.textValue; })}>
                    {OUTCOMES.map((o) => (
                      <SelectItem key={o.k} description={o.desc} startContent={<span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${o.color} 14%, transparent)`, color: o.color }}><o.icon className="h-3.5 w-3.5" /></span>}>{o.label}</SelectItem>
                    ))}
                  </Select>
                  {scored && (
                    <div className="mt-2">
                      <Input size="sm" label="评分权重" labelPlacement="outside" aria-label="评分权重" placeholder="+40" value={weight} onValueChange={setWeight} isInvalid={errs.has("weight")} className="w-[140px]"
                        startContent={<span className="text-[12px] text-default-400">+</span>} description="计入综合风险分,越高越接近升级 MLRO" />
                    </div>
                  )}
                </div>

                {/* 否则 */}
                <div className="mt-3 text-[11.5px] font-semibold text-default-500">否则(不满足条件时):</div>
                <div className="mt-2 rounded-xl border border-divider bg-default-50 p-3">
                  <Select size="sm" aria-label="否则" labelPlacement="outside" placeholder="放行 · 继续监控(默认)" selectedKeys={otherwise ? [otherwise] : []}
                    onSelectionChange={(k) => setOtherwise(Array.from(k as Set<string>)[0] ?? "")}>
                    {RULE_ELSE.map((a) => <SelectItem key={a}>{a}</SelectItem>)}
                  </Select>
                </div>

                {/* 回测预估 */}
                {validClauses.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-divider bg-content1 p-2.5 text-[11px]">
                    <span className="flex items-center gap-1 font-semibold text-[var(--brand)]"><FlaskConical className="h-3.5 w-3.5" />回测预估 · 近90天</span>
                    <span className="text-default-500">命中 <b className="text-foreground tnum">~{estHit}</b> 笔</span>
                    <span className="text-default-500">误报 <b className="tnum" style={{ color: estFp >= 12 ? "var(--warning)" : "var(--text-3)" }}>~{estFp}%</b></span>
                    <span className="w-full text-[10.5px] text-default-400">演示态估计 · 真实重放见「回测模拟」调阈值</span>
                  </div>
                )}
              </div>
            </div>

            {/* 治理提示 */}
            {!editing && <p className="mt-4 rounded-xl border border-divider bg-default-100 p-3 text-[11.5px] leading-relaxed text-default-500">新建规则<b>不直接上线</b> —— 进入「回测中」,回测命中 / 误报达标后提交审批,审批通过才在所选场景生效。</p>}
            {editing && requiresApproval && <p className="mt-4 rounded-xl border border-divider bg-default-100 p-3 text-[11.5px] leading-relaxed text-default-500">该规则<b>已上线生效</b> —— 改动<b>不直接套到线上</b>,而是提交一份<b>拟议变更</b>交风控总管审批;原版在审批期间照常拦截,批准后才切换并记入版本历史。</p>}
          </div>

          {/* 成品句子条 —— 常驻底部(对应 ClickUp 底部 When…then… 摘要)*/}
          <div className="shrink-0 border-t border-divider bg-default-50 px-6 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] leading-relaxed">
              <span className="rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--brand)]">当</span>
              {validClauses.length ? validClauses.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5">{i > 0 && <span className="text-[11px] font-bold text-default-400">且</span>}<Tok>{c.field} {c.op} {c.value}</Tok></span>
              )) : <span className="text-default-300">…设触发条件</span>}
              <span className="rounded-md bg-[var(--success-bg)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--success)]">则</span>
              {action ? <Tok color={oc?.color}>{action}</Tok> : <span className="text-default-300">…选处置</span>}
              <span className="rounded-md bg-default-100 px-1.5 py-0.5 text-[10.5px] font-bold text-default-500">否则</span>
              <Tok>{otherwise || "放行 · 继续监控"}</Tok>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          <Button color="primary" onPress={submit}>{submitLabel}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
