import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Tabs, Tab, Select, SelectItem, Textarea, Checkbox } from "@heroui/react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, UserPlus, ExternalLink, ArrowUpRight, Link2, Plus,
  Lightbulb, Check, X, ArrowRight, ArrowDownToLine, GitMerge, ArrowLeftRight, Shuffle, Waypoints, CircleOff, Coins,
  Gauge, IdCard, Route, Users, Anchor, ListChecks, FileSignature, ShieldAlert, CheckCircle2,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill } from "@/components/bits";
import { Timeline } from "@/components/Timeline";
import { CASES, CSTATE, strLabel, PRIO_TONE, SUBJ_TONE, decideActions, dossierOf, type Case, type CState, type SubjType } from "@/lib/cases";
import { FINDINGS, FDIM, dimSubjType } from "@/lib/findings";
import { caseStore, findingStore, useCaseVersion, useFindingVersion } from "@/lib/store";
import type { Person } from "@/lib/data";

const ME: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const tc = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : t === "green" ? "var(--success)" : t === "violet" ? "var(--violet)" : t === "blue" ? "var(--brand)" : "var(--text-3)");
const tbg = (t: string) => (t === "red" ? "var(--danger-bg)" : t === "amber" ? "var(--warning-bg)" : t === "green" ? "var(--success-bg)" : t === "violet" ? "var(--violet-bg)" : t === "blue" ? "var(--brand-soft)" : "var(--chip-bg)");
const ROLE_ICON: Record<string, typeof Coins> = { 来源: ArrowDownToLine, 归集: GitMerge, 中转: ArrowLeftRight, 混淆: Shuffle, 跨链: Waypoints, 出口: ArrowUpRight, 失联: CircleOff };

function resolve(id: string | null): Case {
  const created = caseStore.created().find((c) => c.id === id);
  if (created) return created;
  return CASES.find((c) => c.id === id) || CASES[0];
}

// 模块卡:标题 + 右上角覆盖度徽标(已覆盖)
function ModCard({ tag, icon: Icon, title, children, accent }: { tag: string; icon: typeof Gauge; title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="card flex flex-col p-4" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-default-100 text-[10px] font-extrabold text-default-500">{tag}</span>
        <Icon className="h-4 w-4 shrink-0 text-default-400" />
        <span className="text-[12.5px] font-bold leading-tight">{title}</span>
        <span className="ml-auto inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: "var(--success-bg)", color: "var(--success)" }}><Check className="h-2.5 w-2.5" />已覆盖</span>
      </div>
      {children}
    </div>
  );
}

function Kv({ label, children, critical }: { label: string; children: React.ReactNode; critical?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-1.5 text-[12px] last:border-0">
      <span className="shrink-0 text-default-500">{label}{critical && <span className="ml-1 rounded bg-[var(--danger-bg)] px-1 py-px text-[9px] font-bold text-[var(--danger)]">最关键</span>}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  );
}

export default function CaseDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  useCaseVersion();
  useFindingVersion();
  const [tab, setTab] = useState("desk");
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [dual, setDual] = useState(false);
  const [err, setErr] = useState<Set<string>>(new Set());
  const [recResp, setRecResp] = useState<null | "agree" | "overturn">(null);
  const [recReason, setRecReason] = useState("");

  const c = resolve(sp.get("id"));
  const st = caseStore.stateOf(c.id, c.state) as CState;
  const sd = CSTATE[st];
  const owner = caseStore.ownerOf(c.id, c.owner);
  const events = caseStore.eventsOf(c.id);
  const str = strLabel(st);
  const d = dossierOf(c);
  const actions = decideActions(st);
  const action = actions.find((a) => a.k === choice) || null;

  // prev / next over built-in catalog
  const idx = CASES.findIndex((x) => x.id === c.id);
  const prev = idx > 0 ? CASES[idx - 1] : null;
  const next = idx >= 0 && idx < CASES.length - 1 ? CASES[idx + 1] : null;

  // 涉案主体(基底 + 已纳入关联命中)
  const baseSubs = c.subjects && c.subjects.length ? c.subjects : [{ name: c.subject, type: (c.sub.includes("链上") ? "链上地址" : "商户") as SubjType, role: "案由主体", amount: c.amount }];
  const subs = caseStore.subjectsOf(c.id, baseSubs);
  // 建议关联命中:同主体 / 同网络、其它维度、尚未纳入
  const candidates = FINDINGS.filter((fd) =>
    findingStore.statusOf(fd.id, fd.status) !== "closed_fp" &&
    !c.linkIds.includes(fd.id) &&
    !subs.some((s) => (s.role || "").includes(fd.pattern)) &&
    subs.some((s) => s.name.includes(fd.subject) || fd.subject.includes(s.name))
  ).slice(0, 3);
  const intake = (fd: typeof FINDINGS[number]) => { caseStore.addSubject(c.id, { name: fd.subject, type: dimSubjType(fd.dim), role: `${FDIM[fd.dim].label} · ${fd.pattern}`, amount: fd.amount }); caseStore.set(c.id, st, { event: `纳入关联命中 ${fd.id}（${fd.pattern}）` }); toast.success(`已纳入 ${fd.id} → 本案`); };

  const claim = () => { caseStore.set(c.id, st, { owner: ME, event: "认领案件 · 开始调查" }); toast.success(`${c.id} · 已认领`); };

  // 系统建议:同意 → 预选建议动作并留痕;推翻 → 记录理由
  const agreeRec = () => {
    setRecResp("agree");
    if (actions.some((a) => a.k === d.rec.disp)) { setChoice(d.rec.disp); setErr(new Set()); }
    caseStore.set(c.id, st, { owner: owner || ME, event: `同意系统建议 · ${d.rec.label}` });
    toast.success("已采纳系统建议 · 已预选处置动作");
  };
  const overturnRec = () => {
    if (!recReason.trim()) { toast.error("推翻建议需填写理由"); return; }
    setRecResp("overturn");
    caseStore.set(c.id, st, { owner: owner || ME, event: "推翻系统建议", reason: recReason.trim() });
    toast.success("已记录推翻理由 · 请在下方自行选择处置");
  };

  const submit = () => {
    if (!action) { toast.error("请选择处置动作"); return; }
    const e = new Set<string>();
    if (action.needMerge && !mergeTo) e.add("merge");
    if (action.dualSign && !dual) e.add("dual");
    if ((action.k === "fp" || action.dualSign) && !note.trim()) e.add("note");
    setErr(e);
    if (e.size) { toast.error("请补全所需信息"); return; }
    const extra = action.needMerge ? ` → ${mergeTo}` : "";
    const to = action.to || st; // 无 to 的为过程动作(限制 / 冻结 / 升级),维持当前状态
    caseStore.set(c.id, to, { owner: owner || ME, event: `${action.label}${extra}${action.dualSign ? " · 双签" : ""}`, reason: note.trim() });
    toast.success(`${c.id} · ${action.label}`);
    if (to === "queued" || to === "filed") toast("已联动报告报送 · STR 流程");
    setChoice(null); setNote(""); setMergeTo(""); setDual(false);
  };

  const otherCases = CASES.filter((x) => x.id !== c.id && x.state !== "merged" && x.state !== "closed");
  const scoreTone = d.score >= 80 ? "red" : d.score >= 60 ? "amber" : "blue";

  return (
    <Shell crumb={["调查", "案件管理", c.id]} wide>
      <div className="mb-3.5 flex items-center justify-between">
        <button onClick={() => nav("/cases")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回案件管理</button>
        <div className="flex items-center gap-3 text-[12.5px]">
          <button disabled={!prev} onClick={() => prev && nav(`/case?id=${prev.id}`)} className="inline-flex items-center gap-0.5 font-medium text-default-500 hover:text-foreground disabled:opacity-30"><ChevronLeft className="h-4 w-4" />上一案件</button>
          <button disabled={!next} onClick={() => next && nav(`/case?id=${next.id}`)} className="inline-flex items-center gap-0.5 font-medium text-default-500 hover:text-foreground disabled:opacity-30">下一案件<ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2.5 text-[22px] font-extrabold">
            {c.id} {c.subject}
            <Pill tone={sd.tone}>{sd.label}</Pill>
            <Pill tone={PRIO_TONE[c.priority]} dot={false}>{c.priority}优先</Pill>
          </h1>
          <div className="mt-2.5 text-[13px] text-default-500">{c.type} · {c.risk} · 涉及 <b className="text-foreground">{c.amount}</b> · 分配给 {owner ? <b className="text-foreground">{owner.n}</b> : <span className="text-default-400">未分配</span>} · SLA {c.sla.text} · 来源 {c.linkTo ? <button onClick={() => nav(c.linkTo!)} className="text-primary hover:opacity-80">{c.src}</button> : c.src}</div>
        </div>
        <div className="flex items-center gap-2">
          {sd.active && !owner && <Button size="sm" color="primary" startContent={<UserPlus className="h-4 w-4" />} onPress={claim}>认领案件</Button>}
          <Button size="sm" variant="bordered" startContent={<ExternalLink className="h-4 w-4" />} onPress={() => nav("/reports")}>STR 报送</Button>
        </div>
      </div>

      {/* 系统建议处置(弱建议)—— 收敛信号成决策起点;同意 / 推翻并留痕 */}
      <div className="card mb-5 border-l-[3px] p-4" style={{ borderLeftColor: tc(d.rec.risk) }}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-default-400"><Lightbulb className="h-3.5 w-3.5 text-primary" />系统建议处置</span>
              <span className="rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase" style={{ background: "var(--chip-bg)", color: "var(--chip-fg)" }}>弱建议 · 供参考</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold">
              <Pill tone={d.rec.risk} dot={false}>{d.rec.riskLabel}</Pill>
              <span>建议:{d.rec.label}</span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {d.rec.basis.map((b, i) => <li key={i} className="flex items-center gap-1.5 text-[12px] text-default-600"><span className="h-1 w-1 rounded-full bg-default-400" />{b}</li>)}
            </ul>
          </div>
          {sd.active && (
            <div className="flex shrink-0 flex-col items-stretch gap-1.5">
              {recResp === "agree" ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold" style={{ background: "var(--success-bg)", color: "var(--success)" }}><CheckCircle2 className="h-4 w-4" />已采纳 · 见下方</span>
              ) : recResp === "overturn" ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}><X className="h-4 w-4" />已推翻 · 自行处置</span>
              ) : (
                <>
                  <Button size="sm" color="primary" startContent={<Check className="h-4 w-4" />} onPress={agreeRec}>同意建议</Button>
                  <Button size="sm" variant="bordered" startContent={<X className="h-4 w-4" />} onPress={() => setRecResp("overturn")}>推翻 · 写理由</Button>
                </>
              )}
            </div>
          )}
        </div>
        {recResp === "overturn" && (
          <div className="mt-3 border-t border-divider pt-3">
            <Textarea size="sm" label="推翻系统建议的理由(记入审计日志)" labelPlacement="outside" value={recReason} onValueChange={setRecReason} minRows={2} placeholder="为何不采纳系统建议?例如:补充材料已澄清资金用途、对手风险被高估…" />
            <Button size="sm" className="mt-2" color="warning" variant="flat" onPress={overturnRec}>确认推翻并留痕</Button>
          </div>
        )}
      </div>

      <Tabs aria-label="案件研判" selectedKey={tab} onSelectionChange={(k) => setTab(k as string)} variant="underlined" color="primary" classNames={{ tabList: "gap-6 p-0 mb-5", cursor: "w-full", tab: "px-0 h-9 max-w-fit", tabContent: "text-[13px] font-semibold" }}>
        <Tab key="desk" title="研判工作台" />
        <Tab key="log" title="活动日志" />
      </Tabs>

      {tab === "log" ? (
        <div className="card p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-default-400">活动日志</div>
          {events.length ? <Timeline items={[...events].reverse().map((e) => ({ time: e.t, text: e.text + (e.reason ? ` · ${e.reason}` : ""), done: true }))} /> : <p className="text-[12.5px] text-default-400">暂无调查记录。认领、纳入关联命中、推进处置等将记入此处。</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── 第一层 · 四问事实材料 ── */}
          <div>
            <div className="mb-2.5 flex items-baseline gap-2"><span className="text-[12px] font-extrabold">第一层 · 四问事实材料</span><span className="text-[11.5px] text-default-400">判断的依据 —— 把支撑研判的客观事实摊开</span></div>
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 xl:grid-cols-4">
              {/* Q1 这案子有多可疑 */}
              <ModCard tag="Q1" icon={Gauge} title="这案子有多可疑">
                <div className="mb-3 flex items-end gap-2">
                  <span className="text-[34px] font-extrabold leading-none tnum" style={{ color: tc(scoreTone) }}>{d.score}</span>
                  <span className="mb-1 text-[11px] text-default-400">/ 100 风险评分</span>
                </div>
                <div className="mb-3 flex flex-col gap-1.5">
                  {d.scoreParts.map((p, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-[11px]"><span className="text-default-500">{p.label}</span><span className="font-bold tnum" style={{ color: tc(p.tone) }}>+{p.pts}</span></div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-default-100"><div className="h-full rounded-full" style={{ width: `${p.pts}%`, background: tc(p.tone) }} /></div>
                    </div>
                  ))}
                </div>
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-default-400">命中规则</div>
                <div className="mb-2.5 flex flex-col gap-1">
                  {d.hitRules.map((r, i) => <div key={i} className="rounded-lg border border-divider px-2 py-1.5 text-[11.5px]"><span className="font-semibold">{r.name}</span><div className="text-[10.5px] text-default-400">{r.detail}</div></div>)}
                </div>
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-default-400">可疑证据</div>
                <ul className="flex flex-col gap-1">
                  {d.evidence.map((e, i) => <li key={i} className="flex gap-1.5 text-[11.5px] leading-snug text-default-600"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-default-400" />{e}</li>)}
                </ul>
              </ModCard>

              {/* Q2 主体什么来头 */}
              <ModCard tag="Q2" icon={IdCard} title="主体什么来头">
                <div className="mb-2.5">
                  <Kv label="注册地 / 辖区">{d.kyc.country}</Kv>
                  <Kv label="KYC / KYB">{d.kyc.kyb}</Kv>
                  <Kv label="注册时长">{d.kyc.registered}</Kv>
                  <Kv label="受益所有人">{d.kyc.ubo}</Kv>
                </div>
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-default-400">行为基线偏离</div>
                <div className="mb-2.5">
                  {d.baseline.map((b, i) => <Kv key={i} label={b.label} critical={b.critical}>{b.value}</Kv>)}
                </div>
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-default-400">涉案主体 · {subs.length}</div>
                <div className="mb-2.5 flex flex-col gap-1.5">
                  {subs.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-divider p-1.5">
                      <Pill tone={SUBJ_TONE[s.type]} dot={false}>{s.type}</Pill>
                      <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold">{s.name}</div><div className="text-[10px] text-default-400">{s.role}{s.kyc ? ` · ${s.kyc}` : ""}</div></div>
                      {s.amount && <span className="shrink-0 text-[11px] font-semibold tnum">{s.amount}</span>}
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-default-50 p-2 text-[11px] leading-snug text-default-500"><span className="font-semibold text-default-600">历史处置:</span> {d.priorDisp}</div>
              </ModCard>

              {/* Q3 钱从哪到哪 */}
              <ModCard tag="Q3" icon={Route} title="钱从哪到哪">
                {d.path && (
                  <>
                    <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-default-400">资金链路</div>
                    <div className="mb-3 flex items-start gap-0.5 overflow-x-auto no-scrollbar pb-1">
                      {d.path.map((n, i) => {
                        const RIcon = ROLE_ICON[n.role] || Coins;
                        const last = i === d.path!.length - 1;
                        const nextTone = last ? n.tone : d.path![i + 1].tone;
                        return (
                          <div key={i} className="flex items-start">
                            <div className="flex w-[78px] shrink-0 flex-col items-center text-center">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px]" style={{ borderColor: tc(n.tone), background: tbg(n.tone), color: tc(n.tone) }}><RIcon className="h-4 w-4" /></span>
                              <span className="mt-1 rounded-full px-1 py-px text-[9px] font-bold uppercase" style={{ background: tbg(n.tone), color: tc(n.tone) }}>{n.role}</span>
                              <span className="mt-0.5 text-[10.5px] font-semibold leading-tight">{n.label}</span>
                              {n.meta && <span className="text-[9.5px] leading-tight text-default-400">{n.meta}</span>}
                            </div>
                            {!last && <div className="flex h-9 w-5 shrink-0 items-center justify-center"><ArrowRight className="h-3.5 w-3.5" style={{ color: tc(nextTone) }} /></div>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-default-400">链上风险</div>
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {d.chainRisk.map((r, i) => <span key={i} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{r}</span>)}
                </div>
                <Kv label="资金性质">{d.fundNature}</Kv>
                <Kv label="涉及金额">{c.amount}</Kv>
              </ModCard>

              {/* Q4 有没有同伙 */}
              <ModCard tag="Q4" icon={Users} title="有没有同伙">
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-default-400">关联团伙</div>
                <div className="mb-2.5 flex flex-col gap-1.5">
                  {d.rings.length ? d.rings.map((r) => (
                    <button key={r.id} onClick={() => nav(r.to)} className="flex items-center gap-2 rounded-lg border border-divider p-2 text-left transition-colors hover:bg-default-50">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--violet)]" />
                      <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold">{r.name}</div><div className="text-[10px] text-default-400">{r.id}</div></div>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-default-300" />
                    </button>
                  )) : <p className="text-[11px] text-default-400">未发现关联团伙。</p>}
                </div>
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-default-400">关联案件</div>
                <div className="mb-2.5 flex flex-col gap-1.5">
                  {d.relatedCases.length ? d.relatedCases.map((r) => (
                    <button key={r.id} onClick={() => nav(r.to)} className="flex items-center gap-2 rounded-lg border border-divider p-2 text-left transition-colors hover:bg-default-50">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold">{r.name}</div><div className="text-[10px] text-default-400">{r.id}</div></div>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-default-300" />
                    </button>
                  )) : <p className="text-[11px] text-default-400">未发现关联案件。</p>}
                </div>
                {sd.active && candidates.length > 0 && (
                  <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--brand-bd)", background: "var(--brand-softer)" }}>
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-[var(--brand)]"><Link2 className="h-3 w-3" />建议纳入(其它维度命中)</div>
                    <div className="flex flex-col gap-1.5">
                      {candidates.map((fd) => { const DI = FDIM[fd.dim].icon; return (
                        <div key={fd.id} className="flex items-center gap-1.5 rounded-lg border border-divider bg-content1 p-1.5">
                          <Pill tone={FDIM[fd.dim].tone} dot={false} icon={<DI className="h-2.5 w-2.5" />}>{FDIM[fd.dim].label}</Pill>
                          <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{fd.pattern}</div><div className="text-[9.5px] text-default-400">{fd.id} · {fd.amount}</div></div>
                          <button onClick={() => intake(fd)} className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand)] hover:opacity-80"><Plus className="h-2.5 w-2.5" />纳入</button>
                        </div>
                      ); })}
                    </div>
                  </div>
                )}
              </ModCard>
            </div>
          </div>

          {/* ── 第二层 · 决策支持 ── */}
          <div>
            <div className="mb-2.5 flex items-baseline gap-2"><span className="text-[12px] font-extrabold">第二层 · 决策支持</span><span className="text-[11.5px] text-default-400">光有事实还不够 —— 给一个处置基准、动作清单与留痕入口</span></div>
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
              {/* ⑤ 决策锚点 */}
              <ModCard tag="⑤" icon={Anchor} title="决策锚点 · 相似案件基准">
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-[20px] font-extrabold leading-none tnum">{d.anchor.similar}</div><div className="mt-1 text-[10px] text-default-400">同类案件</div></div>
                  <div><div className="text-[20px] font-extrabold leading-none tnum" style={{ color: "var(--danger)" }}>{d.anchor.strRate}%</div><div className="mt-1 text-[10px] text-default-400">上报 STR</div></div>
                  <div><div className="text-[20px] font-extrabold leading-none tnum" style={{ color: "var(--success)" }}>{d.anchor.release}%</div><div className="mt-1 text-[10px] text-default-400">放行</div></div>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-default-100">
                  <div className="h-full" style={{ width: `${d.anchor.strRate}%`, background: "var(--danger)" }} />
                  <div className="h-full" style={{ width: `${100 - d.anchor.strRate - d.anchor.release}%`, background: "var(--warning)" }} />
                  <div className="h-full" style={{ width: `${d.anchor.release}%`, background: "var(--success)" }} />
                </div>
                <p className="mt-2.5 text-[11px] leading-snug text-default-500">{d.anchor.note}</p>
              </ModCard>

              {/* ⑥ 可处置动作 */}
              <ModCard tag="⑥" icon={ListChecks} title="可处置动作 · 权限约束">
                <div className="flex flex-col gap-1.5">
                  {actions.map((a) => { const AI = a.icon; return (
                    <div key={a.k} className="flex items-center gap-2 rounded-lg border border-divider p-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: tbg(a.tone), color: tc(a.tone) }}><AI className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold">{a.label}</div><div className="truncate text-[10px] text-default-400">{a.desc}</div></div>
                      <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold" style={{ background: "var(--chip-bg)", color: "var(--chip-fg)" }}>{a.perm}</span>
                    </div>
                  ); })}
                </div>
                <p className="mt-2 text-[10.5px] leading-snug text-default-400">动作受权限门控 —— 误报放行需双签、转报送 / 报送需 MLRO。下方「做出决定」据此执行。</p>
              </ModCard>

              {/* ⑦ 证据与留痕 */}
              <ModCard tag="⑦" icon={FileSignature} title="证据与留痕 · 起草 STR">
                <div className="mb-2.5 flex flex-col gap-1.5 text-[11.5px]">
                  <div className="flex items-center justify-between"><span className="text-default-500">STR 报告进展</span><button onClick={() => nav("/reports")} className="inline-flex items-center gap-1 font-semibold hover:opacity-80" style={{ color: str.link ? "var(--brand)" : "var(--text-3)" }}>{str.text}{str.link && <ExternalLink className="h-3 w-3" />}</button></div>
                  <div className="flex items-center justify-between"><span className="text-default-500">关联原始记录</span>{c.linkTo ? <button onClick={() => nav(c.linkTo!)} className="inline-flex items-center gap-1 font-semibold text-primary hover:opacity-80">{c.linkIds}<ExternalLink className="h-3 w-3" /></button> : <span className="font-semibold">{c.linkIds}</span>}</div>
                  <div className="flex items-center justify-between"><span className="text-default-500">审计事件</span><span className="font-semibold tnum">{events.length} 条</span></div>
                </div>
                <div className="rounded-lg bg-default-50 p-2.5 text-[11px] leading-snug text-default-500">所有研判动作、纳入并案、同意 / 推翻系统建议均记入<b className="text-default-600">活动日志</b>,作为 STR 叙述与 MLRO 复核的证据链。</div>
                <Button size="sm" variant="flat" className="mt-2.5 bg-default-100" startContent={<FileSignature className="h-3.5 w-3.5" />} onPress={() => { setChoice("draft"); setTab("desk"); toast("已定位「定性可疑 · 起草 STR」"); }}>起草 STR 报送材料</Button>
              </ModCard>
            </div>
          </div>

          {/* ── 第三层 · 做出决定(深色块)── */}
          <div className="rounded-2xl p-5" style={{ background: "#0f172a", color: "#e2e8f0" }}>
            <div className="mb-1 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-[#93c5fd]" /><span className="text-[13px] font-extrabold text-white">第三层 · 做出决定</span></div>
            <p className="mb-4 text-[11.5px] text-[#94a3b8]">把上面所有信号收敛成一个处置动作。{recResp === "agree" ? "已采纳系统建议,处置已预选——核对后提交。" : recResp === "overturn" ? "已推翻系统建议,请自行选择处置。" : "可先看顶部系统建议,再决定。"}</p>

            {!sd.active ? (
              <div className="rounded-xl bg-white/5 p-3 text-[12.5px] text-[#cbd5e1]">本案件已 <b className="text-white">{sd.label}</b>,无需进一步处置。</div>
            ) : !owner ? (
              <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-[12.5px] text-[#cbd5e1]"><span>案件未认领 —— 认领后方可处置。</span><Button size="sm" color="primary" startContent={<UserPlus className="h-4 w-4" />} onPress={claim}>认领案件</Button></div>
            ) : actions.length === 0 ? (
              <div className="rounded-xl bg-white/5 p-3 text-[12.5px] text-[#cbd5e1]">当前状态无可用推进动作。</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {actions.map((a) => { const AI = a.icon; const on = choice === a.k; const isRec = a.k === d.rec.disp; return (
                    <button key={a.k} onClick={() => { setChoice(on ? null : a.k); setErr(new Set()); }}
                      className="relative flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[11.5px] font-semibold transition-colors"
                      style={on ? { borderColor: "#60a5fa", background: "rgba(96,165,250,0.18)", color: "#fff" } : { borderColor: "rgba(255,255,255,0.14)", color: "#cbd5e1" }}>
                      {isRec && <span className="absolute -top-1.5 right-1.5 rounded-full px-1.5 py-px text-[8.5px] font-bold" style={{ background: "#60a5fa", color: "#0f172a" }}>建议</span>}
                      <AI className="h-[18px] w-[18px]" />{a.label}
                    </button>
                  ); })}
                </div>

                {action && (
                  <div className="mt-3 rounded-xl bg-white/5 p-3 text-[12px] leading-relaxed text-[#cbd5e1]">
                    <b className="text-white">{action.label}</b> —— {action.desc}。权限:<b className="text-[#93c5fd]">{action.perm}</b>。记入案件审计日志。{action.to === "queued" || action.to === "filed" ? "并联动报告报送 STR 流程。" : ""}
                  </div>
                )}

                {action?.needMerge && (
                  <div className="mt-3">
                    <Select size="sm" label="合并目标案件" labelPlacement="outside" placeholder="选择在办案件…" isRequired aria-label="合并目标案件"
                      selectedKeys={mergeTo ? [mergeTo] : []} isInvalid={err.has("merge")}
                      classNames={{ label: "text-[#94a3b8]", trigger: "bg-white/5 border-white/10 data-[hover=true]:bg-white/10" }}
                      onSelectionChange={(k) => { setMergeTo(Array.from(k as Set<string>)[0] ?? ""); setErr(new Set()); }}>
                      {otherCases.map((x) => <SelectItem key={x.id}>{x.id} · {x.subject}</SelectItem>)}
                    </Select>
                  </div>
                )}

                {action?.dualSign && (
                  <label className={`mt-3 flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-[12px] ${err.has("dual") ? "border-danger" : "border-white/10"}`}>
                    <Checkbox isSelected={dual} onValueChange={(v) => { setDual(v); setErr(new Set()); }} size="sm" />
                    <span className="text-[#cbd5e1]"><b className="text-white">双签确认</b> —— 误报放行需第二名审核员(L2)复核签字,确认排除可疑后方可结案放行。</span>
                  </label>
                )}

                {action && (
                  <div className="mt-3">
                    <Textarea size="sm" label={action.k === "fp" ? "结案理由(必填 · 记入审计)" : "处置说明"} labelPlacement="outside" value={note} onValueChange={(v) => { setNote(v); setErr(new Set()); }} minRows={2}
                      isInvalid={err.has("note")} placeholder="调查结论、证据与下一步…(记入审计日志)"
                      classNames={{ label: "text-[#94a3b8]", inputWrapper: "bg-white/5 border-white/10 data-[hover=true]:bg-white/10" }} />
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <Button color="primary" isDisabled={!action} onPress={submit}>提交处置决定</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
