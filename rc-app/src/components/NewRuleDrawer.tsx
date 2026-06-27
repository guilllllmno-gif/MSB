import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, Checkbox, Slider, Radio, RadioGroup } from "@heroui/react";
import { Zap, History, Layers, Trash2, Plus, Info, ListFilter, ShieldCheck, ArrowRight, Clock, CalendarClock, PlayCircle, CheckCircle2, XCircle, MinusCircle, Users, FlaskConical } from "lucide-react";
import { REPLAY_TXNS, evalRule, type RuleEval } from "@/lib/replay";
import {
  CATS, VENUE, venueOf, RULE_FIELDS, RULE_OPS, OP_LABEL, isAmountField, isWindowedField, WINDOW_OPTS, CUSTOM_WINDOW, isCustomWindow, isNumericField, RULE_BASES, clauseText, groupsText, isTiered, TIER_DIMS, TIER_KEYS, RULE_SCOPES, RULE_AUDIENCES, RULE_DISPOSITIONS, RULE_SIDE_ACTIONS,
  ACTION_BYS, actionTiersText, strictestDisposition, ruleFieldDiffs, ruleChangeSummary, type RuCat, type Venue, type Rule, type Clause, type ClauseGroup, type ClauseTiers, type Basis, type RuleMode, type Joiner,
} from "@/lib/rules";
import { ruleStore } from "@/lib/store";

const RH = { i: "RH", n: "Raj Hota", c: "#0ea5e9" };
const VENUE_ICON: Record<Venue, typeof Zap> = { gate: Zap, batch: History, both: Layers };
const VENUES: Venue[] = ["gate", "batch", "both"];

// 句首小标签 + 摘要 token
function Cap({ children, tone = "grey" }: { children: ReactNode; tone?: "brand" | "success" | "grey" }) {
  const c = tone === "brand" ? "bg-[var(--brand-soft)] text-[var(--brand)]" : tone === "success" ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-default-100 text-default-500";
  return <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${c}`}>{children}</span>;
}
function Tok({ children, color }: { children: ReactNode; color?: string }) {
  return <span className="rounded-md border border-divider bg-content1 px-1.5 py-0.5 text-[11.5px] font-semibold" style={color ? { color } : undefined}>{children}</span>;
}
// 列头卡(图标 + 标题 + 右侧附件)
function CardHd({ icon: Icon, title, right }: { icon: typeof Zap; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-divider bg-content1 px-4 py-3 shadow-soft">
      <div className="flex items-center gap-2.5 text-[15px] font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Icon className="h-4 w-4" /></span>{title}
      </div>
      {right}
    </div>
  );
}
// 内容子卡(白底 + 标题在内)
function SecCard({ label, required, error, children, className }: { label?: ReactNode; required?: boolean; error?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border bg-content1 p-4 shadow-soft ${error ? "border-danger/50 ring-2 ring-danger/30" : "border-divider"} ${className ?? ""}`}>
      {label && <div className="mb-3 text-[13px] font-bold text-foreground">{label}{required && <span className="ml-0.5 text-danger">*</span>}</div>}
      {children}
    </div>
  );
}
// 卡片间的虚线连接
function Connector() {
  return <div className="flex justify-center py-1.5"><span className="h-4 border-l border-dashed border-default-300" /></div>;
}
// AND / OR 胶囊切换(子句内 / 子组间共用)
function JoinerToggle({ value, onChange }: { value: Joiner; onChange: (j: Joiner) => void }) {
  return (
    <div className="flex items-center rounded-lg bg-default-100 p-0.5 text-[11px] font-bold">
      {(["AND", "OR"] as const).map((j) => (
        <button key={j} onClick={() => onChange(j)} className={`rounded-md px-2.5 py-0.5 transition-colors ${value === j ? "bg-[var(--brand)] text-white" : "text-default-400"}`}>{j}</button>
      ))}
    </div>
  );
}

export function NewRuleDrawer({ open, onOpenChange, onDone, editRule, requiresApproval = false }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: (id?: string) => void; editRule?: Rule | null; requiresApproval?: boolean }) {
  const editing = !!editRule;
  const [name, setName] = useState("");
  const [cat, setCat] = useState<RuCat | "">("");
  const [scope, setScope] = useState("");
  const [audience, setAudience] = useState<string[]>([]);
  const [venue, setVenue] = useState<Venue | "">("");
  const [venueTouched, setVenueTouched] = useState(false);
  const [desc, setDesc] = useState("");
  const [mode, setMode] = useState<RuleMode>("alert");
  const [stopScan, setStopScan] = useState(true);
  // 触发条件 = 一层嵌套子组:groups[gi].clauses 内以 group.joiner 连接,子组之间以 outerJoiner 连接
  const [groups, setGroups] = useState<ClauseGroup[]>([{ joiner: "AND", clauses: [{ field: "", op: "", value: "" }] }]);
  const [outerJoiner, setOuterJoiner] = useState<Joiner>("OR");
  const [actions, setActions] = useState<string[]>([]);   // 终态处置(单选,存数组首项)
  const [sideActions, setSideActions] = useState<string[]>([]); // 附带动作(多选)
  // ⑥ 阶梯处置(动作按金额/风险分分档)
  const [actionTiered, setActionTiered] = useState(false);
  const [actionBy, setActionBy] = useState<"金额" | "风险分">("金额");
  const [actionRows, setActionRows] = useState<{ from: string; action: string }[]>([{ from: "", action: "" }]);
  const [weight, setWeight] = useState(40);
  // ⑤ 上线策略
  const [shadow, setShadow] = useState(false);
  const [rollout, setRollout] = useState(100);
  const [expiry, setExpiry] = useState("");
  // ⑦ 单笔回放
  const [replayId, setReplayId] = useState(REPLAY_TXNS[0].id);
  const [replay, setReplay] = useState<RuleEval | null>(null);
  const [replayAction, setReplayAction] = useState("");
  // 30 天回测结果(点页脚「运行 30 天回测」生成)
  const [backtest, setBacktest] = useState<{ scanned: string; hits: number; fp: number; eff: number; escalated: number; daily: number[]; ok: boolean } | null>(null);
  const [errs, setErrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setErrs(new Set()); setReplay(null); setReplayAction(""); setReplayId(REPLAY_TXNS[0].id); setBacktest(null);
    if (editRule) {
      setName(editRule.name); setCat(editRule.cat); setVenue(editRule.venue || venueOf(editRule)); setVenueTouched(true);
      setScope(editRule.scope || RULE_SCOPES[0]); setAudience(editRule.audience || []); setDesc(editRule.desc || "");
      setMode(editRule.mode || "alert"); setStopScan(editRule.stopScan ?? true);
      setGroups(editRule.groups?.length ? editRule.groups.map((g) => ({ joiner: g.joiner, clauses: g.clauses.map((c) => ({ ...c })) }))
        : [{ joiner: editRule.joiner || "AND", clauses: editRule.clauses?.length ? editRule.clauses.map((c) => ({ ...c })) : [{ field: "", op: "", value: "" }] }]);
      setOuterJoiner(editRule.outerJoiner || "OR");
      // 终态单选;旧多选规则按严格度收敛为唯一终态结果
      setActions(editRule.actions?.length ? [strictestDisposition(editRule.actions)] : []);
      setSideActions(editRule.sideActions || []);
      setActionTiered(!!editRule.actionTiers); setActionBy(editRule.actionTiers?.by || "金额");
      setActionRows(editRule.actionTiers?.rows.length ? editRule.actionTiers.rows.map((r) => ({ ...r })) : [{ from: "", action: "" }]);
      setWeight(Math.abs(parseInt(editRule.weight.replace(/[^0-9]/g, ""), 10)) || 30);
      setShadow(editRule.shadow ?? false); setRollout(editRule.rollout ?? 100); setExpiry(editRule.expiry || "");
    } else {
      setName(""); setCat(""); setScope(""); setAudience([]); setVenue(""); setVenueTouched(false); setDesc("");
      setMode("alert"); setStopScan(true); setGroups([{ joiner: "AND", clauses: [{ field: "", op: "", value: "" }] }]); setOuterJoiner("OR");
      setActions([]); setSideActions([]); setActionTiered(false); setActionBy("金额"); setActionRows([{ from: "", action: "" }]);
      setWeight(40);
      setShadow(false); setRollout(100); setExpiry("");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editRule]);

  // 子组 / 子句的增删改(gi = 子组下标,ci = 子句下标)
  const mutClauses = (gi: number, fn: (cs: Clause[]) => Clause[]) => setGroups((gs) => gs.map((g, j) => (j === gi ? { ...g, clauses: fn(g.clauses) } : g)));
  const setClause = (gi: number, ci: number, patch: Partial<Clause>) => mutClauses(gi, (cs) => cs.map((c, j) => (j === ci ? { ...c, ...patch } : c)));
  const addClause = (gi: number) => mutClauses(gi, (cs) => [...cs, { field: "", op: "", value: "" }]);
  const delClause = (gi: number, ci: number) => mutClauses(gi, (cs) => (cs.length > 1 ? cs.filter((_, j) => j !== ci) : cs));
  const setGroupJoiner = (gi: number, j: Joiner) => setGroups((gs) => gs.map((g, k) => (k === gi ? { ...g, joiner: j } : g)));
  const addGroup = () => setGroups((gs) => [...gs, { joiner: "AND", clauses: [{ field: "", op: "", value: "" }] }]);
  const delGroup = (gi: number) => setGroups((gs) => (gs.length > 1 ? gs.filter((_, j) => j !== gi) : gs));
  const pickCat = (c: RuCat | "") => { setCat(c); if (c && !venueTouched) setVenue(venueOf({ cat: c })); };

  // ③ 分层阈值:档位表的增删改(仅绝对值基准开放)
  const mutTiers = (gi: number, ci: number, fn: (t: ClauseTiers) => ClauseTiers) => mutClauses(gi, (cs) => cs.map((c, j) => (j === ci && c.tiers ? { ...c, tiers: fn(c.tiers) } : c)));
  const toggleTiers = (gi: number, ci: number, c: Clause, on: boolean) => setClause(gi, ci, { tiers: on ? { dim: TIER_DIMS[0], rows: [{ key: "默认", value: c.value || "" }, { key: "", value: "" }] } : undefined });
  const setTierDim = (gi: number, ci: number, dim: string) => mutTiers(gi, ci, (t) => ({ ...t, dim }));
  const setTierRow = (gi: number, ci: number, ri: number, patch: Partial<{ key: string; value: string }>) => mutTiers(gi, ci, (t) => ({ ...t, rows: t.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) }));
  const addTierRow = (gi: number, ci: number) => mutTiers(gi, ci, (t) => ({ ...t, rows: [...t.rows, { key: "", value: "" }] }));
  const delTierRow = (gi: number, ci: number, ri: number) => mutTiers(gi, ci, (t) => (t.rows.length > 1 ? { ...t, rows: t.rows.filter((_, j) => j !== ri) } : t));

  // 比较基准:取值框的前/后缀与占位随基准变化(绝对金额→$…CAD;×基线 / 同业群 P / 偏离 σ)
  const baseOf = (c: Clause) => RULE_BASES.find((b) => b.key === (c.basis ?? "abs"))!;
  const valStart = (c: Clause) => ((c.basis ?? "abs") === "abs" ? (isAmountField(c.field) ? "$" : "") : baseOf(c).unitPrefix);
  const valEnd = (c: Clause) => ((c.basis ?? "abs") === "abs" ? (isAmountField(c.field) ? "CAD" : "") : baseOf(c).unitSuffix);

  // 窗口型指标必须配窗口才算完整;分层阈值则至少一档完整(否则「累计 ≥$9k」无界、无意义)
  const hasValue = (c: Clause) => (isTiered(c) ? c.tiers!.rows.some((r) => r.key && r.value) : !!c.value);
  const clauseOk = (c: Clause) => !!c.field && !!c.op && hasValue(c) && (!isWindowedField(c.field) || (!!c.window && c.window !== CUSTOM_WINDOW));
  const validGroups = groups.map((g) => ({ joiner: g.joiner, clauses: g.clauses.filter(clauseOk) })).filter((g) => g.clauses.length);
  const multiGroup = validGroups.length > 1;
  const flatValid = validGroups.flatMap((g) => g.clauses);
  const cond = groupsText(groups, outerJoiner);
  const w = `+${weight}`;
  // ⑥ 阶梯处置:仅「生成告警」模式可分档;校验需至少一档完整(from + action)
  const tiersOn = mode === "alert" && actionTiered;
  const validActionRows = actionRows.filter((r) => r.from && r.action);
  const actionTiers = tiersOn && validActionRows.length ? { by: actionBy, rows: validActionRows } : undefined;
  const usedActions = mode === "alert" && !actionTiered ? actions : [];
  const sides = mode === "alert" ? sideActions : [];
  const dispBase = actionTiers ? actionTiersText(actionTiers) : usedActions.length ? usedActions.join(" · ") : mode === "score" ? `评分 ${w}` : "生成告警";
  const action = sides.length ? `${dispBase} · 附带 ${sides.join(" / ")}` : dispBase;
  const h = [...cond].reduce((a, c) => a + c.charCodeAt(0), 0);

  // 30 天回测:从条件确定性派生一份可信的回测估算(演示态;真实重放走「回测模拟」调阈值)
  const runBacktest = () => {
    if (!flatValid.length) { toast.error("请先至少配置一条完整条件再回测"); return; }
    const hits = (h % 280) + 40;
    const fp = (h % 12) + 4;
    const eff = Math.max(60, 100 - fp - (h % 6));
    const escalated = Math.round(hits * (0.12 + (h % 8) / 100));
    const scanned = `${(1.0 + (h % 22) / 10).toFixed(1)}M`;
    const daily = Array.from({ length: 30 }, (_, i) => 2 + (((h >>> (i % 13)) ^ (i * 7 + 3)) % 9));
    setBacktest({ scanned, hits, fp, eff, escalated, daily, ok: fp <= 9 && hits >= 20 });
  };
  const runReplay = () => {
    if (!flatValid.length) { toast.error("请先至少配置一条完整条件"); return; }
    const tx = REPLAY_TXNS.find((t) => t.id === replayId)!;
    const r = evalRule(groups, outerJoiner, tx);
    // 命中后这笔实际落哪个处置:阶梯→按本笔金额/分数命中的最高档;否则单一终态/评分
    let disp = "";
    if (r.hit) {
      if (tiersOn && validActionRows.length) {
        const metric = actionBy === "金额" ? (tx.vals["单笔金额 (CAD)"] ?? 0) : (tx.vals["综合风险评分"] ?? 0);
        const n = (s: string) => parseFloat(s.replace(/,/g, "")) || 0;
        const sat = validActionRows.filter((x) => n(x.from) <= metric);
        const band = (sat.length ? sat : validActionRows).reduce((best, x) => (n(x.from) > n(best.from) ? x : best));
        disp = `${band.action} · 命中 ≥${actionBy === "金额" ? "$" : ""}${band.from}${actionBy === "风险分" ? " 分" : ""} 档`;
      } else if (mode === "score") disp = `评分 ${w}`;
      else disp = actions[0] || "";
      if (disp && mode === "alert" && sideActions.length) disp += ` · 附带 ${sideActions.join(" / ")}`;
    }
    setReplay(r); setReplayAction(disp);
  };

  const submit = () => {
    const e = new Set<string>();
    if (!name.trim()) e.add("name");
    if (!cat) e.add("cat");
    if (!scope) e.add("scope");
    if (!venue) e.add("venue");
    if (!flatValid.length) e.add("cond");
    if (mode === "alert" && (actionTiered ? !validActionRows.length : !usedActions.length)) e.add("actions");
    setErrs(e);
    if (e.size) { toast.error("请补全带 * 的必填项(元数据 / 至少一条完整条件 / 处置动作)"); return; }

    const fields: Partial<Rule> = {
      name: name.trim(), cat: cat as RuCat, venue: venue as Venue, scope, audience: audience.length ? audience : undefined, desc: desc || undefined,
      mode, stopScan, cond, clauses: flatValid, groups: multiGroup ? validGroups : undefined, outerJoiner: multiGroup ? outerJoiner : undefined,
      joiner: validGroups[0]?.joiner ?? "AND", actions: usedActions, sideActions: sides.length ? sides : undefined, actionTiers, action, weight: w,
      shadow, rollout, expiry: expiry || undefined,
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

  const submitLabel = editing ? (requiresApproval ? "提交变更审批" : "保存修改") : "创建规则";

  return (
    <>
      <Modal isOpen={open} onOpenChange={onOpenChange} scrollBehavior="inside" classNames={{ base: "max-w-[1080px] h-[92vh]", header: "border-b border-divider", footer: "border-t border-divider" }}>
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1 pr-10">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="规则名称" placeholder={editing ? "规则名称" : "为这条规则命名…"}
            className={`w-full bg-transparent text-[17px] font-bold text-foreground outline-none placeholder:font-semibold ${errs.has("name") ? "placeholder:text-danger" : "placeholder:text-default-300"}`} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="规则描述" placeholder="添加规则描述…"
            className="w-full bg-transparent text-[12px] font-normal text-default-500 outline-none placeholder:text-default-300" />
        </ModalHeader>

        <ModalBody className="flex flex-col gap-0 p-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* ── 两栏:触发条件 → 命中动作,各列为 头卡 + 虚线连接 + 内容子卡 ── */}
            <div className="grid gap-2 lg:grid-cols-[1fr_56px_1fr]">
              {/* ═══ 左:触发条件 ═══ */}
              <div className="flex flex-col">
                <CardHd icon={ListFilter} title="触发条件" right={
                  <Select aria-label="执行场景" size="sm" variant="bordered" placeholder="场景" selectedKeys={venue ? [venue] : []} isInvalid={errs.has("venue")}
                    className="w-[148px]" classNames={{ trigger: "h-8 min-h-8 border-default-200 bg-content1" }}
                    renderValue={() => venue ? <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">{(() => { const I = VENUE_ICON[venue as Venue]; return <I className="h-3.5 w-3.5" />; })()}{VENUE[venue as Venue].short}</span> : undefined}
                    onSelectionChange={(k) => { setVenue((Array.from(k as Set<string>)[0] as Venue) ?? ""); setVenueTouched(true); }}>
                    {VENUES.map((v) => { const I = VENUE_ICON[v]; return <SelectItem key={v} startContent={<I className="h-3.5 w-3.5 text-default-400" />}>{VENUE[v].short}</SelectItem>; })}
                  </Select>
                } />
                {venue && <p className="mt-1.5 flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-default-400"><Info className="mt-px h-3.5 w-3.5 shrink-0" />{VENUE[venue].hint}{cat && !venueTouched && <span className="font-medium">（按类别建议）</span>}</p>}

                <Connector />

                {/* 规则元数据 */}
                <SecCard label="规则元数据">
                  <Select size="sm" aria-label="规则类别" placeholder="规则类别" startContent={<Layers className="h-4 w-4 text-default-400" />} selectedKeys={cat ? [cat] : []} isInvalid={errs.has("cat")}
                    classNames={{ trigger: "h-10 min-h-10 bg-default-50" }} onSelectionChange={(k) => pickCat((Array.from(k as Set<string>)[0] as RuCat) ?? "")}>
                    {CATS.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
                  </Select>
                  <div className="mt-2.5">
                    <Select size="sm" aria-label="适用场景" placeholder="适用场景" startContent={<ListFilter className="h-4 w-4 text-default-400" />} selectedKeys={scope ? [scope] : []} isInvalid={errs.has("scope")}
                      classNames={{ trigger: "h-10 min-h-10 bg-default-50" }} onSelectionChange={(k) => setScope(Array.from(k as Set<string>)[0] ?? "")}>
                      {RULE_SCOPES.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
                    </Select>
                  </div>
                  {/* 适用对象:定向到哪类商户(空 = 全部);派生群组 + 业务模式标签混选 */}
                  <Select size="sm" aria-label="适用对象" placeholder="适用对象:全部商户(不限)" selectionMode="multiple" startContent={<Users className="h-4 w-4 text-default-400" />}
                    selectedKeys={new Set(audience)} className="mt-2.5" classNames={{ trigger: "min-h-10 bg-default-50" }}
                    renderValue={() => <span className="text-[12.5px]">{audience.length ? `适用对象:${audience.join(" · ")}` : "适用对象:全部商户(不限)"}</span>}
                    onSelectionChange={(k) => setAudience(Array.from(k as Set<string>))}>
                    {RULE_AUDIENCES.map((a) => <SelectItem key={a}>{a}</SelectItem>)}
                  </Select>
                  <p className="mt-1 flex items-start gap-1 px-0.5 text-[10.5px] leading-snug text-default-400"><Info className="mt-px h-3 w-3 shrink-0" />不选 = 全部商户都跑;选定后仅命中所选群组的商户触发。法定核心(制裁筛查 / LVCTR)对所有商户恒生效,不受此限。</p>
                </SecCard>

                <Connector />

                {/* 条件标题行(单子组时内联 AND/OR;多子组时 AND/OR 移到各子组头) */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="text-[12.5px] font-semibold text-default-600">当交易满足{groups.length > 1 ? "以下任一子组" : `以下${groups[0].joiner === "AND" ? "全部" : "任一"}条件`}</span>
                  {groups.length === 1 && <JoinerToggle value={groups[0].joiner} onChange={(j) => setGroupJoiner(0, j)} />}
                </div>

                {/* 子组(每组内子句以 AND/OR 连;组间以 outerJoiner 连)*/}
                <div className={`mt-2.5 flex flex-col gap-2.5 ${errs.has("cond") ? "rounded-2xl p-1 ring-2 ring-danger/30" : ""}`}>
                  {groups.map((g, gi) => (
                    <div key={gi} className="flex flex-col gap-2.5">
                      {/* 子组之间的 OR/AND 连接器 */}
                      {gi > 0 && (
                        <div className="flex items-center gap-2 py-0.5">
                          <span className="h-px flex-1 bg-default-200" />
                          <JoinerToggle value={outerJoiner} onChange={setOuterJoiner} />
                          <span className="text-[10.5px] font-medium text-default-400">子组之间</span>
                          <span className="h-px flex-1 bg-default-200" />
                        </div>
                      )}
                      {/* 多子组时给每组套一层卡 + 头(子组号 / 内连接 / 删除);单组时无额外卡壳 */}
                      <div className={groups.length > 1 ? "rounded-2xl border border-divider bg-default-50/60 p-2.5" : "flex flex-col gap-2.5"}>
                        {groups.length > 1 && (
                          <div className="mb-2 flex items-center justify-between px-1">
                            <span className="flex items-center gap-2 text-[12px] font-bold text-default-600">子组 {gi + 1}<span className="text-[10.5px] font-medium text-default-400">组内</span><JoinerToggle value={g.joiner} onChange={(j) => setGroupJoiner(gi, j)} /></span>
                            <button onClick={() => delGroup(gi)} className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-default-400 transition-colors hover:bg-danger/10 hover:text-danger"><Trash2 className="h-3.5 w-3.5" />删除子组</button>
                          </div>
                        )}
                        <div className="flex flex-col gap-2.5">
                          {g.clauses.map((c, ci) => (
                            <SecCard key={ci}>
                              <div className="mb-2.5 flex items-center justify-between">
                                <span className="text-[12.5px] font-bold text-foreground">条件 {ci + 1}</span>
                                <button onClick={() => delClause(gi, ci)} disabled={g.clauses.length === 1} className="flex h-6 w-6 items-center justify-center rounded-lg text-default-400 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                              <Select size="sm" aria-label="运算字段" placeholder="运算字段" selectedKeys={c.field ? [c.field] : []} classNames={{ trigger: "h-10 min-h-10 bg-default-50" }}
                                onSelectionChange={(k) => { const f = (Array.from(k as Set<string>)[0] as string) ?? ""; setClause(gi, ci, { field: f, window: isWindowedField(f) ? (c.window || "24 小时") : undefined, basis: isNumericField(f) ? (c.basis ?? "abs") : undefined, tiers: undefined }); }}>
                                {RULE_FIELDS.map((fld) => <SelectItem key={fld}>{fld}</SelectItem>)}
                              </Select>
                              {/* 滑动窗口:仅窗口型指标出现 —— 指标与窗口解耦,同一指标可配任意窗口(含自定义) */}
                              {isWindowedField(c.field) && (() => {
                                const custom = c.window === CUSTOM_WINDOW || isCustomWindow(c.window);
                                return (
                                  <div className="mt-2.5 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-2.5 py-2">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
                                      <span className="shrink-0 text-[11.5px] font-semibold text-default-600">滑动窗口内</span>
                                      <Select size="sm" aria-label="滑动窗口" placeholder="选窗口" selectedKeys={custom ? ["自定义"] : (c.window ? [c.window] : [])} className="flex-1"
                                        classNames={{ trigger: "h-8 min-h-8 bg-content1" }}
                                        onSelectionChange={(k) => { const v = Array.from(k as Set<string>)[0] as string; setClause(gi, ci, { window: v === "自定义" ? CUSTOM_WINDOW : (v ?? "") }); }}>
                                        {[...WINDOW_OPTS, "自定义"].map((w) => <SelectItem key={w}>{w === "自定义" ? "自定义…" : w}</SelectItem>)}
                                      </Select>
                                    </div>
                                    {custom && (
                                      <Input size="sm" aria-label="自定义窗口" placeholder="如 36 小时 / 10 天" value={c.window === CUSTOM_WINDOW ? "" : (c.window ?? "")}
                                        onValueChange={(v) => setClause(gi, ci, { window: v || CUSTOM_WINDOW })}
                                        className="mt-2" classNames={{ inputWrapper: "h-8 min-h-8 bg-content1" }} startContent={<span className="text-[11px] text-default-400">窗口</span>} />
                                    )}
                                  </div>
                                );
                              })()}
                              {/* 比较基准:数值型指标可选 —— 绝对值 / × 自身历史基线 / 同业群 P 百分位 / 偏离均值 σ */}
                              {isNumericField(c.field) && (
                                <div className="mt-2.5 flex items-center gap-2">
                                  <span className="shrink-0 text-[11.5px] font-semibold text-default-500">比较基准</span>
                                  <Select size="sm" aria-label="比较基准" selectedKeys={[c.basis ?? "abs"]} className="flex-1" classNames={{ trigger: "h-9 min-h-9 bg-default-50" }}
                                    onSelectionChange={(k) => { const b = (Array.from(k as Set<string>)[0] as Basis) ?? "abs"; setClause(gi, ci, { basis: b, tiers: b === "abs" ? c.tiers : undefined }); }}>
                                    {RULE_BASES.map((b) => <SelectItem key={b.key}>{b.label}</SelectItem>)}
                                  </Select>
                                </div>
                              )}
                              {isNumericField(c.field) && (c.basis ?? "abs") !== "abs" && <p className="mt-1 px-1 text-[10.5px] leading-snug text-default-400">{baseOf(c).hint}</p>}
                              {/* ③ 分层阈值开关:仅数值 + 绝对值基准可分档 */}
                              {isNumericField(c.field) && (c.basis ?? "abs") === "abs" && (
                                <Checkbox size="sm" isSelected={isTiered(c)} onValueChange={(on) => toggleTiers(gi, ci, c, on)} className="mt-2" classNames={{ label: "text-[11.5px] text-default-500" }}>按 KYC 等级 / 业务线 / 注册地分档取阈值</Checkbox>
                              )}
                              {isTiered(c) ? (
                                <>
                                  <div className="mt-2.5 flex items-center gap-2.5">
                                    <Select size="sm" aria-label="运算符" placeholder="运算符" selectedKeys={c.op ? [c.op] : []} className="w-[140px]" classNames={{ trigger: "h-10 min-h-10 bg-default-50" }}
                                      onSelectionChange={(k) => setClause(gi, ci, { op: Array.from(k as Set<string>)[0] ?? "" })}>
                                      {RULE_OPS.map((op) => <SelectItem key={op}>{OP_LABEL[op]}</SelectItem>)}
                                    </Select>
                                    <span className="text-[11.5px] text-default-400">按下表分档取阈值</span>
                                  </div>
                                  <div className="mt-2 rounded-xl border border-divider bg-default-50 p-2.5">
                                    <div className="mb-2 flex items-center gap-2">
                                      <Layers className="h-3.5 w-3.5 shrink-0 text-default-400" />
                                      <span className="shrink-0 text-[11.5px] font-semibold text-default-600">分层维度</span>
                                      <Select size="sm" aria-label="分层维度" selectedKeys={[c.tiers!.dim]} className="flex-1" classNames={{ trigger: "h-8 min-h-8 bg-content1" }}
                                        onSelectionChange={(k) => setTierDim(gi, ci, (Array.from(k as Set<string>)[0] as string) ?? TIER_DIMS[0])}>
                                        {TIER_DIMS.map((d) => <SelectItem key={d}>{d}</SelectItem>)}
                                      </Select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                      {c.tiers!.rows.map((r, ri) => (
                                        <div key={ri} className="flex items-center gap-1.5">
                                          <Select size="sm" aria-label="档位" placeholder="档位" selectedKeys={r.key ? [r.key] : []} className="flex-1" classNames={{ trigger: "h-8 min-h-8 bg-content1" }}
                                            onSelectionChange={(k) => setTierRow(gi, ci, ri, { key: (Array.from(k as Set<string>)[0] as string) ?? "" })}>
                                            {TIER_KEYS[c.tiers!.dim].map((kk) => <SelectItem key={kk}>{kk}</SelectItem>)}
                                          </Select>
                                          <Input size="sm" aria-label="阈值" placeholder="阈值" value={r.value} onValueChange={(v) => setTierRow(gi, ci, ri, { value: v })} className="w-[120px]" classNames={{ inputWrapper: "h-8 min-h-8 bg-content1" }}
                                            startContent={isAmountField(c.field) ? <span className="text-[11px] text-default-400">$</span> : undefined} />
                                          <button onClick={() => delTierRow(gi, ci, ri)} disabled={c.tiers!.rows.length === 1} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-default-400 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </div>
                                      ))}
                                    </div>
                                    <button onClick={() => addTierRow(gi, ci)} className="mt-1.5 flex h-7 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-default-300 text-[11px] font-medium text-default-500 transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"><Plus className="h-3 w-3" />添加档位</button>
                                  </div>
                                </>
                              ) : (
                                <div className="mt-2.5 grid grid-cols-[140px_1fr] gap-2.5">
                                  <Select size="sm" aria-label="运算符" placeholder="运算符" selectedKeys={c.op ? [c.op] : []} classNames={{ trigger: "h-10 min-h-10 bg-default-50" }}
                                    onSelectionChange={(k) => setClause(gi, ci, { op: Array.from(k as Set<string>)[0] ?? "" })}>
                                    {RULE_OPS.map((op) => <SelectItem key={op}>{OP_LABEL[op]}</SelectItem>)}
                                  </Select>
                                  <Input size="sm" aria-label="取值" placeholder={baseOf(c).ph} value={c.value} onValueChange={(v) => setClause(gi, ci, { value: v })} classNames={{ inputWrapper: "h-10 min-h-10 bg-default-50" }}
                                    startContent={valStart(c) ? <span className="text-[12px] text-default-400">{valStart(c)}</span> : undefined}
                                    endContent={valEnd(c) ? <span className="text-[11px] text-default-400">{valEnd(c)}</span> : undefined} />
                                </div>
                              )}
                            </SecCard>
                          ))}
                          {/* 组内 + 添加条件 */}
                          <button onClick={() => addClause(gi)} className="flex h-8 items-center justify-center gap-1 rounded-xl border border-dashed border-default-300 text-[11.5px] font-medium text-default-500 transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"><Plus className="h-3.5 w-3.5" />添加条件</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* + 添加子组 */}
                <div className="mt-2.5 flex items-center justify-center">
                  <Button size="sm" variant="bordered" className="h-9 font-semibold" startContent={<Plus className="h-3.5 w-3.5" />} onPress={addGroup}>添加子组</Button>
                </div>

                {/* ⑦ 单笔回放:拿一笔真实历史交易跑当前条件 —— 命不命中?卡在哪个条件 */}
                <div className="mt-2.5 rounded-2xl border border-divider bg-content1 p-3 shadow-soft">
                  <div className="flex items-center gap-2 text-[12.5px] font-bold text-foreground"><PlayCircle className="h-4 w-4 text-[var(--brand)]" />单笔回放测试</div>
                  <p className="mb-2 mt-0.5 text-[10.5px] text-default-400">验逻辑:拿一笔真实交易看命不命中、卡在哪条(↔ 页脚「30 天回测」估影响:命中量 / 误报率)</p>
                  <div className="flex items-center gap-2">
                    <Select size="sm" aria-label="样本交易" selectedKeys={[replayId]} className="flex-1" classNames={{ trigger: "h-9 min-h-9 bg-default-50" }}
                      renderValue={() => { const t = REPLAY_TXNS.find((x) => x.id === replayId)!; return <span className="truncate text-[12px] font-medium">{t.label}</span>; }}
                      onSelectionChange={(k) => { setReplayId((Array.from(k as Set<string>)[0] as string) ?? REPLAY_TXNS[0].id); setReplay(null); }}>
                      {REPLAY_TXNS.map((t) => <SelectItem key={t.id} description={t.sub}>{t.label}</SelectItem>)}
                    </Select>
                    <Button size="sm" color="primary" variant="solid" className="h-9 font-semibold" onPress={runReplay}>回放</Button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-default-400">{REPLAY_TXNS.find((x) => x.id === replayId)!.sub}</p>

                  {replay && (
                    <div className="mt-3 border-t border-divider pt-3">
                      <div className={`mb-2.5 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-bold ${replay.hit ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                        {replay.hit ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {replay.hit ? "命中 · 此规则会对这笔交易触发处置" : "未命中 · 此规则不会触发"}
                      </div>
                      {replay.hit && replayAction && (
                        <p className="mb-2.5 text-[11.5px] text-default-600"><b>本规则终态处置:</b>{replayAction}<span className="mt-0.5 block text-[10.5px] text-default-400">多条规则同时命中时,跨规则取最严处置(本原型仅回放当前这条)。</span></p>
                      )}
                      <div className="flex flex-col gap-2">
                        {replay.groups.map((g, gi) => (
                          <div key={gi} className={replay.groups.length > 1 ? "rounded-xl border border-divider bg-default-50 p-2" : ""}>
                            {replay.groups.length > 1 && <div className="mb-1 text-[10.5px] font-bold text-default-400">子组 {gi + 1} · {g.joiner === "AND" ? "全部满足" : "任一满足"} → {g.status === "pass" ? "✓ 满足" : g.status === "skip" ? "— 跳过" : "✗ 不满足"}</div>}
                            <div className="flex flex-col gap-1">
                              {g.clauses.map((c, ci) => (
                                <div key={ci} className="flex items-start gap-1.5 text-[11.5px]">
                                  {c.status === "pass" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : c.status === "fail" ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" /> : <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-default-300" />}
                                  <span className="flex-1"><span className="font-medium text-default-700">{c.text}</span><span className="ml-1 text-default-400">— {c.detail}</span></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {!replay.hit && replay.blockers.length > 0 && (
                        <p className="mt-2 rounded-lg bg-default-100 px-2.5 py-1.5 text-[11px] leading-snug text-default-500"><b>卡在:</b>{replay.blockers.join(";")}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ 中:全高分隔线 + 箭头 ═══ */}
              <div className="relative hidden lg:block">
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-divider" />
                <span className="relative mx-auto mt-3.5 flex h-9 w-9 items-center justify-center rounded-xl border border-divider bg-content1 shadow-soft"><ArrowRight className="h-4 w-4 text-default-400" /></span>
              </div>

              {/* ═══ 右:命中动作 ═══ */}
              <div className="flex flex-col">
                <CardHd icon={ShieldCheck} title="命中动作" right={<span className="text-[11px] text-default-400">命中后自动执行</span>} />

                <Connector />

                {/* 事件操作 */}
                <SecCard label="事件操作">
                  <RadioGroup orientation="horizontal" value={mode} onValueChange={(v) => setMode(v as RuleMode)} classNames={{ wrapper: "gap-8" }}>
                    <Radio value="score" size="sm" classNames={{ label: "text-[13px]" }}>仅评分</Radio>
                    <Radio value="alert" size="sm" classNames={{ label: "text-[13px]" }}>生成告警</Radio>
                  </RadioGroup>
                  <p className="mt-1.5 text-[11px] text-default-400">{mode === "score" ? "只累加风险分、不生成告警,达阈值后由评分规则统一处置。" : "生成告警并执行下方处置动作。"}</p>
                  <div className="mt-3 border-t border-divider pt-3">
                    <Checkbox size="sm" isSelected={stopScan} onValueChange={setStopScan} classNames={{ label: "text-[12.5px]" }}>如果交易匹配此规则,则停止扫描交易(不再匹配后续规则)</Checkbox>
                  </div>
                </SecCard>

                <Connector />

                {/* 动作执行:处置动作 + 折入 升级路径/严重度/权重 */}
                <SecCard label="动作执行">
                  <div className="flex items-center justify-between">
                    <div className="text-[12.5px] font-semibold text-default-600">处置动作 <span className="text-danger">*</span></div>
                    {mode === "alert" && (
                      <Checkbox size="sm" isSelected={actionTiered} onValueChange={setActionTiered} classNames={{ label: "text-[11.5px] text-default-500" }}>按金额 / 风险分阶梯处置</Checkbox>
                    )}
                  </div>
                  {/* ⑥ 阶梯处置:按金额/风险分区间触发不同动作($9k 转研判、$50k 直接冻结升级)*/}
                  {tiersOn ? (
                    <div className={`mt-2 rounded-xl border border-divider bg-default-50 p-2.5 ${errs.has("actions") ? "ring-2 ring-danger/40" : ""}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="shrink-0 text-[11.5px] font-semibold text-default-600">分档依据</span>
                        <Select size="sm" aria-label="分档依据" selectedKeys={[actionBy]} className="flex-1" classNames={{ trigger: "h-8 min-h-8 bg-content1" }}
                          onSelectionChange={(k) => setActionBy((Array.from(k as Set<string>)[0] as "金额" | "风险分") ?? "金额")}>
                          {ACTION_BYS.map((b) => <SelectItem key={b}>{b}</SelectItem>)}
                        </Select>
                      </div>
                      {(() => {
                        const sym = actionBy === "金额" ? "$" : "";
                        const suf = actionBy === "风险分" ? "分" : "";
                        const bands = actionRows.map((r) => ({ ...r, n: parseFloat((r.from || "").replace(/,/g, "")) })).filter((b) => b.from && b.action && !isNaN(b.n)).sort((a, b) => a.n - b.n);
                        return (
                          <>
                            {/* 极简单行:阈值 → 处置 */}
                            <div className="flex flex-col">
                              {actionRows.map((r, ri) => (
                                <div key={ri} className="flex items-center gap-2 py-1.5">
                                  <span className="shrink-0 text-[11.5px] text-default-400">≥</span>
                                  <Input size="sm" aria-label="下限" placeholder={actionBy === "金额" ? "金额" : "分数"} value={r.from} className="w-[96px]" classNames={{ inputWrapper: "h-9 min-h-9 bg-default-50" }}
                                    startContent={actionBy === "金额" ? <span className="text-[11px] text-default-400">$</span> : undefined}
                                    onValueChange={(v) => setActionRows((rs) => rs.map((x, j) => (j === ri ? { ...x, from: v } : x)))} />
                                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-default-300" />
                                  <Select size="sm" aria-label="处置" placeholder="处置动作" selectedKeys={r.action ? [r.action] : []} className="flex-1" classNames={{ trigger: "h-9 min-h-9 bg-default-50" }}
                                    onSelectionChange={(k) => setActionRows((rs) => rs.map((x, j) => (j === ri ? { ...x, action: (Array.from(k as Set<string>)[0] as string) ?? "" } : x)))}>
                                    {RULE_DISPOSITIONS.map((d) => <SelectItem key={d}>{d}</SelectItem>)}
                                  </Select>
                                  <button onClick={() => setActionRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== ri) : rs))} disabled={actionRows.length === 1} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-default-300 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => setActionRows((rs) => [...rs, { from: "", action: "" }])} className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-[var(--brand)] hover:opacity-70"><Plus className="h-3.5 w-3.5" />加一档</button>
                            {bands.length > 0 && (
                              <p className="mt-2 text-[10.5px] leading-snug text-default-400">低于最低档 {sym}{bands[0].from}{suf} 不触发本规则;命中按{actionBy}升序取最高满足档执行。</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <RadioGroup value={actions[0] ?? ""} onValueChange={(v) => setActions([v])} isDisabled={mode === "score"}
                      className={`mt-2 ${errs.has("actions") ? "rounded-xl p-1 ring-2 ring-danger/40" : ""}`} classNames={{ wrapper: "grid grid-cols-2 gap-x-4 gap-y-2.5" }}>
                      {RULE_DISPOSITIONS.map((d) => <Radio key={d} value={d} size="sm" classNames={{ label: "text-[12.5px]" }}>{d}</Radio>)}
                    </RadioGroup>
                  )}
                  {mode === "score"
                    ? <p className="mt-1.5 text-[11px] text-default-400">「仅评分」模式不执行处置动作,仅按权重累加风险分。</p>
                    : !tiersOn && <p className="mt-1.5 text-[11px] text-default-400">终态单选(一笔只能落一个最终状态);跨规则取最严者。可在下方叠加附带动作。</p>}

                  {/* 附带动作:可多选的工作流副作用,叠加在终态处置之上 */}
                  {mode === "alert" && (
                    <div className="mt-3 border-t border-divider pt-3">
                      <div className="mb-1.5 text-[12px] font-medium text-default-600">附带动作 <span className="font-normal text-default-400">· 选填 · 可多选,叠加在终态处置之上</span></div>
                      <Select size="sm" aria-label="附带动作" placeholder="无附带动作" selectionMode="multiple" selectedKeys={new Set(sideActions)}
                        classNames={{ trigger: "min-h-9 bg-default-50" }} renderValue={() => <span className="text-[12.5px]">{sideActions.length ? sideActions.join(" / ") : "无附带动作"}</span>}
                        onSelectionChange={(k) => setSideActions(Array.from(k as Set<string>))}>
                        {RULE_SIDE_ACTIONS.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
                      </Select>
                    </div>
                  )}

                  {/* 风险权重(累加至评分,跨规则聚合裁决用)*/}
                  <div className="mt-4 border-t border-divider pt-4">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-[12px] font-medium text-default-600">风险权重(累加至评分)<span className="text-danger">*</span></div>
                      <span className="text-[13px] font-extrabold tnum text-[var(--brand)]">+{weight}</span>
                    </div>
                    <Slider aria-label="风险权重" size="sm" minValue={0} maxValue={100} step={5} value={weight} onChange={(v) => setWeight(Array.isArray(v) ? v[0] : v)} classNames={{ track: "bg-default-200", filler: "bg-primary" }} />
                    <div className="mt-0.5 flex justify-between text-[10px] text-default-400"><span>0 · 低敏</span><span>{weight >= 50 ? "高权重 → 易升级 MLRO" : "中低权重"}</span><span>100 · 强拦</span></div>
                  </div>
                </SecCard>

                <Connector />

                {/* ⑤ 上线策略:影子 / 灰度 / 到期(呼应回测→审批→上线治理链)*/}
                <SecCard label="上线策略">
                  <div className="flex items-start gap-2">
                    <Checkbox size="sm" isSelected={shadow} onValueChange={setShadow} classNames={{ label: "text-[12.5px]" }}>
                      <span className="font-semibold">影子模式</span> · 只告警不处置(评估期)
                    </Checkbox>
                  </div>
                  <p className="mt-1 pl-6 text-[11px] leading-snug text-default-400">{shadow ? "命中只记录 / 告警、不执行处置动作,跑一段时间确认误报率再切实拦。" : "关闭 = 命中即按上方处置动作生效。"}</p>

                  <div className="mt-3.5 border-t border-divider pt-3.5">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-[12px] font-medium text-default-600">灰度比例(按比例放量)</div>
                      <span className="text-[13px] font-extrabold tnum text-[var(--brand)]">{rollout}%</span>
                    </div>
                    <Slider aria-label="灰度比例" size="sm" minValue={10} maxValue={100} step={10} value={rollout} onChange={(v) => setRollout(Array.isArray(v) ? v[0] : v)} classNames={{ track: "bg-default-200", filler: "bg-primary" }} />
                    <div className="mt-0.5 flex justify-between text-[10px] text-default-400"><span>10% · 小流量试跑</span><span>{rollout < 100 ? `仅对 ${rollout}% 命中流量生效` : "全量生效"}</span><span>100% · 全量</span></div>
                  </div>

                  <div className="mt-3.5 border-t border-divider pt-3.5">
                    <Input size="sm" type="date" label="到期日(到点自动失效)" labelPlacement="outside" aria-label="到期日" value={expiry} onValueChange={setExpiry}
                      classNames={{ inputWrapper: "h-10 min-h-10 bg-default-50" }} startContent={<CalendarClock className="h-4 w-4 text-default-400" />} />
                    <p className="mt-1 text-[11px] text-default-400">{expiry ? `${expiry} 自动停用 —— 临时加严(交易所被盗 / 新制裁)用。` : "留空 = 永久生效。"}</p>
                  </div>
                </SecCard>
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
              {validGroups.length ? validGroups.map((g, gi) => (
                <span key={gi} className="flex flex-wrap items-center gap-1.5">
                  {gi > 0 && <span className="text-[11px] font-bold text-[var(--brand)]">{outerJoiner === "AND" ? "且" : "或"}</span>}
                  {multiGroup && <span className="text-[12px] font-bold text-default-400">(</span>}
                  {g.clauses.map((c, ci) => (
                    <span key={ci} className="flex items-center gap-1.5">{ci > 0 && <span className="text-[11px] font-bold text-default-400">{g.joiner === "AND" ? "且" : "或"}</span>}<Tok>{clauseText(c)}</Tok></span>
                  ))}
                  {multiGroup && <span className="text-[12px] font-bold text-default-400">)</span>}
                </span>
              )) : <span className="text-default-300">…设触发条件</span>}
              <Cap tone="success">则</Cap>
              <Tok>{action}</Tok>
              <Cap>权重</Cap><Tok color="var(--brand)">+{weight}</Tok>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="bordered" startContent={<FlaskConical className="h-4 w-4" />} onPress={runBacktest}>运行 30 天回测</Button>
          <Button color="primary" onPress={submit}>{submitLabel}</Button>
        </ModalFooter>
      </ModalContent>
      </Modal>

      {/* 30 天回测结果 · 弹窗(叠加在新建抽屉之上)*/}
      <Modal isOpen={!!backtest} onOpenChange={(o) => !o && setBacktest(null)} size="lg" placement="center" classNames={{ header: "border-b border-divider", footer: "border-t border-divider" }}>
        <ModalContent>
          {backtest && (
            <>
              <ModalHeader className="flex items-center gap-2.5 text-[16px]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><FlaskConical className="h-4 w-4" /></span>
                30 天回测 · 估影响
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${backtest.ok ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-[var(--warning-bg)] text-[var(--warning)]"}`}>{backtest.ok ? "达标 · 可提交审批" : "误报偏高 · 建议调阈值"}</span>
              </ModalHeader>
              <ModalBody className="gap-4 py-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {[["扫描交易", backtest.scanned], ["命中", `${backtest.hits} 笔`], ["误报率", `${backtest.fp}%`], ["命中有效率", `${backtest.eff}%`], ["升级转案", `${backtest.escalated} 件`]].map(([l, v]) => (
                    <div key={l} className="rounded-xl border border-divider bg-default-50 px-3 py-2.5">
                      <div className="text-[11px] text-default-400">{l}</div>
                      <div className="tnum text-[20px] font-extrabold leading-tight">{v}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-default-500"><span>近 30 日命中分布</span><span className="text-default-400">末 7 日标红</span></div>
                  <div className="flex h-16 items-end gap-1 rounded-xl border border-divider bg-default-50 px-2.5 py-2">
                    {backtest.daily.map((v, i) => (
                      <span key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(8, (v / 10) * 100)}%`, background: i >= 23 ? "var(--danger)" : "var(--brand)" }} />
                    ))}
                  </div>
                </div>
                <p className="text-[11.5px] leading-relaxed text-default-400">演示态确定性估算。达标后可「保存并提交审批」;上线后要调阈值看影响,进规则详情的「回测模拟」拖滑块实时重算召回↔精准权衡。</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={() => setBacktest(null)}>关闭</Button>
                <Button color="primary" isDisabled={!backtest.ok} onPress={() => { setBacktest(null); submit(); }}>{backtest.ok ? "达标 · 保存并提交" : "误报偏高 · 先调阈值"}</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
