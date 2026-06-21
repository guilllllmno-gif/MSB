import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Tabs, Tab, Select, SelectItem, Textarea, Checkbox } from "@heroui/react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, UserPlus, ExternalLink, ArrowUpRight, Link2, Plus,
  Lightbulb, Check, X, ArrowRight, ArrowDownToLine, GitMerge, ArrowLeftRight, Shuffle, Waypoints, CircleOff, Coins,
  Gauge, ShieldAlert, CheckCircle2, Wallet, Landmark, BellRing, FileText, Eye, Download, FileSignature, Save, Send,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill } from "@/components/bits";
import { Timeline } from "@/components/Timeline";
import { CaseFundGraph } from "@/components/CaseFundGraph";
import { CASES, CSTATE, PRIO_TONE, SUBJ_TONE, decideActions, dossierOf, factorContrib, caseScore, type Case, type CState, type SubjType } from "@/lib/cases";
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

function Card({ icon: Icon, title, extra, children }: { icon: typeof Gauge; title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-default-400" />
        <span className="text-[13px] font-bold">{title}</span>
        {extra && <span className="ml-auto">{extra}</span>}
      </div>
      {children}
    </div>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12.5px]"><span className="shrink-0 text-default-500">{label}</span><span className="text-right font-semibold">{children}</span></div>;
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
  const [openF, setOpenF] = useState<Set<string>>(new Set());
  const [unlinked, setUnlinked] = useState<Set<string>>(new Set());
  const [narr, setNarr] = useState<string | null>(null);

  const c = resolve(sp.get("id"));
  const st = caseStore.stateOf(c.id, c.state) as CState;
  const sd = CSTATE[st];
  const owner = caseStore.ownerOf(c.id, c.owner);
  const events = caseStore.eventsOf(c.id);
  const d = dossierOf(c);
  const score = caseScore(d);
  const actions = decideActions(st);
  const action = actions.find((a) => a.k === choice) || null;

  const idx = CASES.findIndex((x) => x.id === c.id);
  const prev = idx > 0 ? CASES[idx - 1] : null;
  const next = idx >= 0 && idx < CASES.length - 1 ? CASES[idx + 1] : null;

  const baseSubs = c.subjects && c.subjects.length ? c.subjects : [{ name: c.subject, type: (c.sub.includes("链上") ? "链上地址" : "商户") as SubjType, role: "案由主体", amount: c.amount }];
  const subs = caseStore.subjectsOf(c.id, baseSubs);
  const candidates = FINDINGS.filter((fd) =>
    findingStore.statusOf(fd.id, fd.status) !== "closed_fp" &&
    !c.linkIds.includes(fd.id) &&
    !subs.some((s) => (s.role || "").includes(fd.pattern)) &&
    subs.some((s) => s.name.includes(fd.subject) || fd.subject.includes(s.name))
  ).slice(0, 3);
  const intake = (fd: typeof FINDINGS[number]) => { caseStore.addSubject(c.id, { name: fd.subject, type: dimSubjType(fd.dim), role: `${FDIM[fd.dim].label} · ${fd.pattern}`, amount: fd.amount }); caseStore.set(c.id, st, { event: `纳入关联命中 ${fd.id}（${fd.pattern}）` }); toast.success(`已纳入 ${fd.id} → 本案`); };

  const claim = () => { caseStore.set(c.id, st, { owner: ME, event: "认领案件 · 开始调查" }); toast.success(`${c.id} · 已认领`); };
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
    const to = action.to || st;
    caseStore.set(c.id, to, { owner: owner || ME, event: `${action.label}${extra}${action.dualSign ? " · 双签" : ""}`, reason: note.trim() });
    toast.success(`${c.id} · ${action.label}`);
    if (to === "queued" || to === "filed") toast("已联动报告报送 · STR 流程");
    setChoice(null); setNote(""); setMergeTo(""); setDual(false);
  };

  // 关联案件富卡(显式 or 从简版 rings/relatedCases 派生)+ 证据材料 + STR 草稿
  const relatedRich = (d.relatedRich || [
    ...d.rings.map((r) => ({ id: r.id, subject: r.name, relType: "同团伙", relTone: "violet" as const, conf: "高置信", state: "调查中", amount: "—", score: 0, basis: "团伙识别关联聚类", by: "团伙识别", at: "系统建议" })),
    ...d.relatedCases.map((r) => ({ id: r.id, subject: r.name, relType: "关联案件", relTone: "blue" as const, conf: "—", state: "—", amount: "—", score: 0, basis: "同主体 / 同网络", by: "系统", at: "" })),
  ]).filter((r) => !unlinked.has(r.id));
  const mergeInfo = d.mergeInfo || { count: relatedRich.length, total: "—", strength: relatedRich.length > 1 ? "强" : "中", ring: d.rings[0]?.id || "—" };
  const files = d.files || [
    { name: "KYT 链上分析报告", ext: "PDF", size: "2.10 MB", note: "地址风险评分与资金溯源路径" },
    { name: "主体 KYC 资料快照", ext: "PNG", size: "1.05 MB", note: "注册信息与风险等级评定" },
    { name: "关联交易流水", ext: "XLSX", size: "0.74 MB", note: "近 90 天关联主体交易明细" },
  ];
  const str = d.str || { type: "STR(可疑交易报告)", indicators: d.factors.slice(0, 2).map((f) => f.label).join(" · "), drafter: (owner || ME).n, narrative: `${c.subject}:${d.evidence.join(";")}。建议作为可疑交易上报 FINTRAC。` };
  const narrative = narr ?? str.narrative;
  const unlink = (id: string) => { setUnlinked((p) => new Set(p).add(id)); caseStore.set(c.id, st, { event: `解除关联 ${id}` }); toast.success(`已解除关联 ${id}`); };
  const submitMLRO = () => {
    if (st === "str_draft") { caseStore.set(c.id, "mlro", { owner: owner || ME, event: "提交 MLRO 评估 · STR 草稿" }); toast.success("已提交 MLRO 评估"); }
    else if (st === "investigating") toast("请先在下方「定性可疑 · 起草 STR」提交,再提交 MLRO 评估");
    else toast("当前状态无需提交 MLRO");
  };

  const otherCases = CASES.filter((x) => x.id !== c.id && x.state !== "merged" && x.state !== "closed");
  const scoreTone = score >= 80 ? "red" : score >= 60 ? "amber" : "blue";
  // 瀑布累计
  let cum = 0;
  const waterfall = d.factors.map((f) => { const ctb = factorContrib(f); const start = cum; cum += ctb; return { f, ctb, start, end: cum }; });
  const floorStart = cum;

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

      {/* 系统建议处置(弱建议)*/}
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
          {/* 风险评分构成 · 加权瀑布 */}
          <Card icon={Gauge} title="风险评分构成" extra={<span className="text-[11.5px] text-default-400">四项因子按权重累积贡献{d.floor ? `,命中硬指标触发托底,最终 ${score}` : ""}。点开因子看依据。</span>}>
            <div className="mb-3 flex items-end gap-2">
              <span className="text-[34px] font-extrabold leading-none tnum" style={{ color: tc(scoreTone) }}>{score}</span>
              <span className="mb-1 text-[11px] text-default-400">/ 100 加权累计</span>
              <Pill tone={scoreTone} dot={false}>{score >= 80 ? "高风险" : score >= 60 ? "中风险" : "低风险"}</Pill>
            </div>
            {/* 瀑布行 */}
            <div className="flex flex-col gap-2">
              {waterfall.map(({ f, ctb, start }) => (
                <div key={f.key} className="flex items-center gap-3">
                  <div className="w-[120px] shrink-0 text-[11.5px]"><span className="font-semibold">{f.label}</span><div className="text-[10px] text-default-400">{f.cat} · {Math.round(f.weight * 100)}%</div></div>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-default-100">
                    <div className="absolute inset-y-0 flex items-center justify-end rounded pr-1.5 text-[10px] font-bold text-white" style={{ left: `${start}%`, width: `${ctb}%`, background: tc(f.tone) }}>+{ctb}</div>
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11.5px] font-bold tnum text-default-500">{Math.round((start + ctb) * 10) / 10}</span>
                </div>
              ))}
              {d.floor && (
                <div className="flex items-center gap-3">
                  <div className="w-[120px] shrink-0 text-[11.5px]"><span className="font-semibold">{d.floor.label}</span><div className="text-[10px] text-default-400">硬规则托底</div></div>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-default-100">
                    <div className="absolute inset-y-0 flex items-center justify-end rounded pr-1.5 text-[10px] font-bold text-white" style={{ left: `${floorStart}%`, width: `${d.floor.bonus}%`, background: "var(--danger)" }}>+{d.floor.bonus}</div>
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11.5px] font-extrabold tnum" style={{ color: "var(--danger)" }}>{score}</span>
                </div>
              )}
            </div>
            {d.floor && <p className="mt-2.5 rounded-lg bg-[var(--danger-bg)] px-2.5 py-1.5 text-[11px] leading-snug" style={{ color: "var(--danger)" }}>{d.floor.note}</p>}
            {/* 可展开因子 */}
            <div className="mt-4 flex flex-col gap-1.5">
              {d.factors.map((f) => { const open = openF.has(f.key); return (
                <div key={f.key} className="rounded-xl border border-divider">
                  <button onClick={() => setOpenF((p) => { const n = new Set(p); n.has(f.key) ? n.delete(f.key) : n.add(f.key); return n; })} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-default-400 transition-transform ${open ? "" : "-rotate-90"}`} />
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tc(f.tone) }} />
                    <span className="text-[12.5px] font-semibold">{f.label}</span><span className="text-[11px] text-default-400">{f.cat}</span>
                    <span className="ml-auto text-[11.5px] text-default-500">权重 {Math.round(f.weight * 100)}% · 原始分 <b className="text-foreground tnum">{f.raw}</b> · 贡献 <b style={{ color: tc(f.tone) }} className="tnum">{factorContrib(f)}</b></span>
                  </button>
                  {open && (
                    <ul className="border-t border-divider px-3 py-2.5">
                      {f.evidence.map((e, i) => <li key={i} className="flex gap-1.5 py-0.5 text-[11.5px] leading-snug text-default-600"><span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ background: tc(f.tone) }} />{e}</li>)}
                    </ul>
                  )}
                </div>
              ); })}
            </div>
          </Card>

          {/* 关联告警 */}
          <Card icon={BellRing} title="关联告警">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead><tr className="border-b border-divider text-[11.5px] text-default-400"><th className="py-2 pr-3 text-left font-medium">优先级</th><th className="py-2 pr-3 text-left font-medium">告警 ID</th><th className="py-2 pr-3 text-left font-medium">描述</th><th className="py-2 pr-3 text-left font-medium">命中规则</th><th className="py-2 text-left font-medium">触发时间</th></tr></thead>
                <tbody>
                  {d.alerts.map((al, i) => (
                    <tr key={i} className="border-b border-default-100 last:border-0 align-top">
                      <td className="py-2.5 pr-3"><Pill tone={al.sev}>{al.sevLabel}</Pill></td>
                      <td className="py-2.5 pr-3"><button onClick={() => nav(c.linkTo || "/alerts")} className="font-semibold text-primary hover:opacity-80">{al.id}</button></td>
                      <td className="py-2.5 pr-3 text-default-600">{al.desc}</td>
                      <td className="py-2.5 pr-3"><span className="rounded bg-default-100 px-1.5 py-0.5 text-[11px] font-semibold text-default-600">{al.rule}</span></td>
                      <td className="py-2.5 tnum whitespace-nowrap text-default-500">{al.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 交易/资金状态 + 相似案件处置基准 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card icon={Wallet} title="交易 / 资金状态">
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <Kv label="关联交易"><button onClick={() => c.linkTo && nav(c.linkTo)} className="inline-flex items-center gap-1 text-primary hover:opacity-80">{d.tx.id}<ExternalLink className="h-3 w-3" /></button></Kv>
                <Kv label="网络 / 类型">{d.tx.network} · {d.tx.type}</Kv>
                <Kv label="冻结 / 涉及金额">{d.tx.frozen}</Kv>
                <Kv label="资金去向">{d.tx.destination}</Kv>
                <Kv label="冻结时长 / 状态">{d.tx.duration}</Kv>
              </div>
            </Card>
            <Card icon={Landmark} title="相似案件处置基准">
              <p className="mb-3 text-[11.5px] leading-snug text-default-500">{d.anchor.note}</p>
              <div className="mb-2.5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-divider py-2.5"><div className="text-[20px] font-extrabold leading-none tnum" style={{ color: "var(--danger)" }}>{d.anchor.strRate}%</div><div className="mt-1 text-[10px] text-default-400">上报 STR</div></div>
                <div className="rounded-xl border border-divider py-2.5"><div className="text-[20px] font-extrabold leading-none tnum" style={{ color: "var(--warning)" }}>{100 - d.anchor.strRate - d.anchor.release}%</div><div className="mt-1 text-[10px] text-default-400">限制 / 拒绝</div></div>
                <div className="rounded-xl border border-divider py-2.5"><div className="text-[20px] font-extrabold leading-none tnum" style={{ color: "var(--success)" }}>{d.anchor.release}%</div><div className="mt-1 text-[10px] text-default-400">放行</div></div>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-default-100">
                <div className="h-full" style={{ width: `${d.anchor.strRate}%`, background: "var(--danger)" }} />
                <div className="h-full" style={{ width: `${100 - d.anchor.strRate - d.anchor.release}%`, background: "var(--warning)" }} />
                <div className="h-full" style={{ width: `${d.anchor.release}%`, background: "var(--success)" }} />
              </div>
            </Card>
          </div>

          {/* 商户画像与行为基线(本次 vs 历史) */}
          <Card icon={Coins} title="商户画像与行为基线" extra={<Pill tone={d.profile.tier} dot={false}>KYC {d.profile.kyc}</Pill>}>
            <div className="grid grid-cols-1 gap-x-8 gap-y-1 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-default-400">商户档案</div>
                <Kv label="注册地 / 辖区">{d.profile.country}</Kv>
                <Kv label="制裁名单">{d.profile.sanctions}</Kv>
                <Kv label="PEP">{d.profile.pep}</Kv>
                <Kv label="30 日交易额">{d.profile.vol30}</Kv>
                <Kv label="限额">{d.profile.limit}</Kv>
              </div>
              <div>
                <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-default-400">行为基线偏离 · 本次 vs 历史常态</div>
                <div className="flex flex-col">
                  {d.baseline.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 border-b border-dashed border-default-200 py-1.5 text-[12px] last:border-0">
                      <span className="w-[88px] shrink-0 text-default-500">{b.label}</span>
                      <span className="text-default-400">{b.norm}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-default-300" />
                      <span className="font-semibold" style={{ color: b.abnormal ? "var(--danger)" : undefined }}>{b.current}</span>
                      {b.abnormal && <span className="ml-auto shrink-0 rounded bg-[var(--danger-bg)] px-1 py-px text-[9px] font-bold" style={{ color: "var(--danger)" }}>偏离</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-default-50 p-2.5 text-[11.5px] leading-snug text-default-500"><span className="font-semibold text-default-600">历史处置:</span> {d.priorDisp}</div>
          </Card>

          {/* 涉案主体 */}
          <Card icon={Coins} title={`涉案主体 · ${subs.length}`}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {subs.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-divider p-2.5">
                  <Pill tone={SUBJ_TONE[s.type]} dot={false}>{s.type}</Pill>
                  <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold">{s.name}</div><div className="text-[11px] text-default-400">{s.role}{s.kyc ? ` · ${s.kyc}` : ""}</div></div>
                  {s.amount && <span className="shrink-0 text-[12px] font-semibold tnum">{s.amount}</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* 关联案件 · 串并 */}
          <Card icon={Link2} title="关联案件 · 串并">
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["关联案件数", String(mergeInfo.count)], ["串并涉及总额", mergeInfo.total], ["最高关联强度", mergeInfo.strength], ["疑似团伙", mergeInfo.ring]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-divider p-2.5"><div className="text-[10.5px] text-default-400">{k}</div><div className="mt-0.5 text-[15px] font-extrabold tnum">{v}</div></div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {relatedRich.length ? relatedRich.map((r) => (
                <div key={r.id} className="rounded-xl border border-divider p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => nav(r.id.startsWith("CASE") ? `/case?id=${r.id}` : r.id.startsWith("RING") ? `/ring?id=${r.id}` : "/cases")} className="text-[13px] font-bold text-primary hover:opacity-80">{r.id}</button>
                    <Pill tone={r.relTone} dot={false}>{r.relType}</Pill>
                    {r.conf !== "—" && <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: tbg(r.relTone), color: tc(r.relTone) }}>{r.conf}</span>}
                    <span className="ml-auto text-[11.5px] text-default-500">主体 <b className="text-foreground">{r.subject}</b>{r.state !== "—" ? ` · 状态 ${r.state}` : ""}{r.amount !== "—" ? ` · 金额 ${r.amount}` : ""}{r.score ? ` · 风险分 ${r.score}` : ""}</span>
                    {sd.active && <button onClick={() => unlink(r.id)} className="shrink-0 rounded-full border border-divider px-2 py-0.5 text-[11px] font-semibold text-default-500 hover:bg-default-100">解除关联</button>}
                  </div>
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-default-50 p-2 text-[11.5px] leading-snug text-default-600"><Link2 className="mt-0.5 h-3 w-3 shrink-0 text-default-400" /><span><b className="text-default-700">关联依据:</b>{r.basis}</span></div>
                  {r.at && <div className="mt-1.5 text-[10.5px] text-default-400">{r.by} · {r.at}</div>}
                </div>
              )) : <p className="text-[11.5px] text-default-400">未发现关联案件 / 团伙。</p>}
            </div>
            {sd.active && candidates.length > 0 && (
              <div className="mt-3 rounded-xl border p-2.5" style={{ borderColor: "var(--brand-bd)", background: "var(--brand-softer)" }}>
                <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-[var(--brand)]"><Link2 className="h-3 w-3" />建议纳入(其它维度命中)</div>
                <div className="flex flex-col gap-1.5">
                  {candidates.map((fd) => { const DI = FDIM[fd.dim].icon; return (
                    <div key={fd.id} className="flex items-center gap-1.5 rounded-lg border border-divider bg-content1 p-1.5">
                      <Pill tone={FDIM[fd.dim].tone} dot={false} icon={<DI className="h-2.5 w-2.5" />}>{FDIM[fd.dim].label}</Pill>
                      <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{fd.pattern} · {fd.subject}</div><div className="text-[9.5px] text-default-400">{fd.id} · {fd.amount}</div></div>
                      <button onClick={() => intake(fd)} className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand)] hover:opacity-80"><Plus className="h-2.5 w-2.5" />纳入</button>
                    </div>
                  ); })}
                </div>
              </div>
            )}
          </Card>

          {/* 证据材料 + STR 草稿 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card icon={FileText} title="证据材料">
              <div className="flex flex-col gap-2">
                {files.map((fl, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl border border-divider p-2.5">
                    <span className="flex h-8 w-9 shrink-0 items-center justify-center rounded-lg text-[9px] font-extrabold" style={{ background: tbg(fl.ext === "PDF" ? "red" : fl.ext === "XLSX" ? "green" : fl.ext === "PNG" ? "violet" : "blue"), color: tc(fl.ext === "PDF" ? "red" : fl.ext === "XLSX" ? "green" : fl.ext === "PNG" ? "violet" : "blue") }}>{fl.ext}</span>
                    <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold">{fl.name}</div><div className="truncate text-[10.5px] text-default-400">{fl.size} · {fl.note}</div></div>
                    <button onClick={() => toast("预览(原型占位)")} className="shrink-0 rounded-lg p-1.5 text-default-400 hover:bg-default-100"><Eye className="h-3.5 w-3.5" /></button>
                    <button onClick={() => toast("下载(原型占位)")} className="shrink-0 rounded-lg p-1.5 text-default-400 hover:bg-default-100"><Download className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </Card>
            <Card icon={FileSignature} title="STR 草稿">
              <div className="mb-2.5 grid grid-cols-2 gap-x-6">
                <Kv label="报告类型">{str.type}</Kv>
                <Kv label="可疑指标">{str.indicators}</Kv>
                <Kv label="起草人">{str.drafter}</Kv>
                <Kv label="签发权">仅 MLRO 可签发报送</Kv>
              </div>
              <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-default-400">叙述摘要(草稿)</div>
              <Textarea size="sm" value={narrative} onValueChange={setNarr} minRows={4} aria-label="STR 叙述摘要" />
              <div className="mt-2.5 flex justify-end gap-2">
                <Button size="sm" variant="bordered" startContent={<Save className="h-3.5 w-3.5" />} onPress={() => toast.success("STR 草稿已保存")}>保存草稿</Button>
                <Button size="sm" color="primary" startContent={<Send className="h-3.5 w-3.5" />} onPress={submitMLRO}>提交 MLRO 评估</Button>
              </div>
            </Card>
          </div>

          {/* 资金链路分析(有图用分层网络图,否则线性逐跳) */}
          {d.graph ? (
            <Card icon={Waypoints} title="资金链路分析">
              <CaseFundGraph graph={d.graph} />
            </Card>
          ) : d.path && (
            <Card icon={Waypoints} title="资金链路">
              <div className="flex items-start gap-1 overflow-x-auto no-scrollbar pb-1">
                {d.path.map((n, i) => {
                  const RIcon = ROLE_ICON[n.role] || Coins;
                  const last = i === d.path!.length - 1;
                  const nextTone = last ? n.tone : d.path![i + 1].tone;
                  return (
                    <div key={i} className="flex items-start">
                      <div className="flex w-[112px] shrink-0 flex-col items-center text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-[1.5px]" style={{ borderColor: tc(n.tone), background: tbg(n.tone), color: tc(n.tone) }}><RIcon className="h-5 w-5" /></span>
                        <span className="mt-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: tbg(n.tone), color: tc(n.tone) }}>{n.role}</span>
                        <span className="mt-1 text-[12px] font-semibold leading-tight">{n.label}</span>
                        {n.meta && <span className="text-[10.5px] leading-tight text-default-400">{n.meta}</span>}
                      </div>
                      {!last && <div className="flex h-11 w-9 shrink-0 items-center justify-center"><ArrowRight className="h-4 w-4" style={{ color: tc(nextTone) }} /></div>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">{d.chainRisk.map((r, i) => <span key={i} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{r}</span>)}</div>
            </Card>
          )}

          {/* 做出决定 · 处置(混合:弱建议在顶,处置区按状态/角色自适应) */}
          <Card icon={ShieldAlert} title="做出决定 · 处置">
            <p className="mb-3 text-[11.5px] text-default-500">把上面的信号收敛成一个处置动作。{recResp === "agree" ? "已采纳系统建议,处置已预选——核对后提交。" : recResp === "overturn" ? "已推翻系统建议,请自行选择处置。" : "可先看顶部系统建议,再决定。"}</p>
            {!sd.active ? (
              <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500">本案件已 <b className="text-foreground">{sd.label}</b>,无需进一步处置。</div>
            ) : !owner ? (
              <div className="flex items-center justify-between rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500"><span>案件未认领 —— 认领后方可处置。</span><Button size="sm" color="primary" startContent={<UserPlus className="h-4 w-4" />} onPress={claim}>认领案件</Button></div>
            ) : actions.length === 0 ? (
              <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500">当前状态无可用推进动作。</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {actions.map((a) => { const AI = a.icon; const on = choice === a.k; const isRec = a.k === d.rec.disp; return (
                    <button key={a.k} onClick={() => { setChoice(on ? null : a.k); setErr(new Set()); }}
                      className="relative flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[11.5px] font-semibold transition-colors"
                      style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" } : { borderColor: "var(--line)", color: "var(--text-2)" }}>
                      {isRec && <span className="absolute -top-1.5 right-1.5 rounded-full px-1.5 py-px text-[8.5px] font-bold" style={{ background: "var(--brand)", color: "#fff" }}>建议</span>}
                      <AI className="h-[18px] w-[18px]" />{a.label}
                    </button>
                  ); })}
                </div>
                {action && <div className="mt-3 rounded-xl border border-divider bg-default-100 p-3 text-[12px] leading-relaxed text-default-600"><b className="text-foreground">{action.label}</b> —— {action.desc}。权限:<b className="text-primary">{action.perm}</b>。记入案件审计日志。{action.to === "queued" || action.to === "filed" ? "并联动报告报送 STR 流程。" : ""}</div>}
                {action?.needMerge && (
                  <Select size="sm" className="mt-3" label="合并目标案件" labelPlacement="outside" placeholder="选择在办案件…" isRequired aria-label="合并目标案件"
                    selectedKeys={mergeTo ? [mergeTo] : []} isInvalid={err.has("merge")}
                    onSelectionChange={(k) => { setMergeTo(Array.from(k as Set<string>)[0] ?? ""); setErr(new Set()); }}>
                    {otherCases.map((x) => <SelectItem key={x.id}>{x.id} · {x.subject}</SelectItem>)}
                  </Select>
                )}
                {action?.dualSign && (
                  <label className={`mt-3 flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-[12px] ${err.has("dual") ? "border-danger" : "border-divider"}`}>
                    <Checkbox isSelected={dual} onValueChange={(v) => { setDual(v); setErr(new Set()); }} size="sm" />
                    <span className="text-default-600"><b className="text-foreground">双签确认</b> —— 误报放行需第二名审核员(L2)复核签字,确认排除可疑后方可结案放行。</span>
                  </label>
                )}
                {action && <Textarea size="sm" className="mt-3" label={action.k === "fp" ? "结案理由(必填 · 记入审计)" : "处置说明"} labelPlacement="outside" value={note} onValueChange={(v) => { setNote(v); setErr(new Set()); }} minRows={2} isInvalid={err.has("note")} placeholder="调查结论、证据与下一步…(记入审计日志)" />}
                <div className="mt-4 flex justify-end"><Button color="primary" isDisabled={!action} onPress={submit}>提交处置决定</Button></div>
              </>
            )}
          </Card>
        </div>
      )}
    </Shell>
  );
}
