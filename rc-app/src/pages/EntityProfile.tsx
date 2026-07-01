import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button, Input, Select, SelectItem, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Search, Bell, Network, FolderOpen, ArrowUpRight, ArrowLeft, ShieldAlert, Store, Layers, Building2, Lock, AlertOctagon, TrendingUp, TrendingDown, Minus, UserPlus, Send, Clock3, Sparkles, GitMerge, Globe, IdCard, X } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { Timeline } from "@/components/Timeline";
import { directory, footprint, totalExposure, fmtCAD, entityType, sameEntity, linkedAddresses, applicableRules, merchantTags, suggestTags, type DirEntry, type Pending } from "@/lib/entity360";
import { RC_STATES, toneVar, type Tone } from "@/lib/data";
import { type Rule } from "@/lib/rules";
import { FSTATES, FDIM } from "@/lib/findings";
import { CSTATE, type CState } from "@/lib/cases";
import { RSTATE } from "@/lib/reports";
import { RING_STATES } from "@/lib/rings";
import { alertStore, useAlertVersion, findingStore, useFindingVersion, caseStore, useCaseVersion, reportStore, useReportVersion, ringStore, useRingVersion, tagStore, useTagVersion } from "@/lib/store";

const MOD_LABEL: Record<string, string> = { alerts: "告警", findings: "事后", rings: "团伙", cases: "案件", reports: "报送" };
type ModCount = { alerts: number; findings: number; rings: number; cases: number; reports: number };
type ModKey = keyof ModCount;

// 案件推进度序(取最推进的在办案件作串并主案)
const CASE_ORDER: Record<string, number> = { investigating: 0, str_draft: 1, mlro: 2, queued: 3, filed: 4 };

export default function EntityProfile() {
  const [params] = useSearchParams();
  const name = params.get("name") || "";
  return name ? <Profile name={name} /> : <Directory />;
}

function Profile({ name }: { name: string }) {
  useAlertVersion(); useFindingVersion(); useCaseVersion(); useReportVersion(); useRingVersion();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const fp = useMemo(() => footprint(name), [name]);
  const type = entityType(name);
  const exposure = totalExposure(fp);

  // 在办案件(取实时状态)—— 同商户多个在办案件 = 重复立案 / 可串并信号
  const activeCases = fp.cases.map((c) => ({ c, st: caseStore.stateOf(c.id, c.state) as CState })).filter((x) => CSTATE[x.st]?.active);
  const mergeable = activeCases.length >= 2;
  const primary = mergeable ? activeCases.reduce((a, b) => ((CASE_ORDER[b.st] ?? 0) > (CASE_ORDER[a.st] ?? 0) ? b : a)) : activeCases[0];
  // 一键串并:被并案件转「已合并」,统一并入最推进的主案(消除重复立案 / 重复 STR)
  const doMerge = () => {
    let n = 0;
    activeCases.forEach(({ c }) => { if (c.id !== primary.c.id) { caseStore.set(c.id, "merged", { event: `串并到主案 ${primary.c.id} · 主体360 发起` }); n++; } });
    caseStore.set(primary.c.id, primary.st, { event: `串并并入 ${n} 个关联案件(主体360 发起)` });
    toast.success(`已串并 ${n} 个案件到主案 ${primary.c.id}`);
  };
  useEffect(() => { if (params.get("merge") === "1" && mergeable) setTimeout(() => document.getElementById("merge-banner")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80); }, [params, mergeable]);

  // 账户状态 / 风险词 / 商户号 / 注册地 —— 复用目录派生(directory),保持与总览口径一致
  const dir = useMemo(() => directory().find((e) => sameEntity(e.name, name)), [name]);
  const riskNum = dir?.risk ?? 0;
  const riskWord = riskNum >= 80 ? "高风险" : riskNum >= 60 ? "中风险" : "低风险";
  const riskTone: Tone = riskNum >= 80 ? "red" : riskNum >= 60 ? "amber" : "green";

  const modCount = { alerts: fp.alerts.length, findings: fp.findings.length, rings: fp.rings.length, cases: fp.cases.length, reports: fp.reports.length };
  const strCount = fp.cases.filter((c) => ["str_draft", "mlro", "queued", "filed"].includes(caseStore.stateOf(c.id, c.state))).length + fp.reports.length;

  // 画像信息 —— 取自最丰富来源(告警 merchantTier/kyb/accountAge),缺则合成
  const a0 = fp.alerts[0];
  const merchantNo = dir?.merchantNo ?? "—";
  const legalForm = name.match(/\b(Ltd|Inc|Corp|LLC|PLC|GmbH|Pte|Co)\b\.?/i)?.[1]; // 从名称派生法律形式(Ltd./Inc./Corp.…)
  const country = a0?.country ?? dir?.country ?? "—";
  const vol30 = a0?.custHistory?.vol30 ?? dir?.vol30 ?? "—";

  // 业务模式标签:种子 + 人工确认(tagStore);模型自动识别给「建议标签(待确认)」
  useTagVersion();
  const confirmedTags = useMemo(() => [...new Set([...merchantTags(name), ...tagStore.confirmedOf(name)])], [name]);
  const suggestions = useMemo(
    () => (type === "商户" ? suggestTags(name).filter((s) => !confirmedTags.includes(s.tag) && !tagStore.dismissedOf(name).includes(s.tag)) : []),
    [type, name, confirmedTags],
  );
  // 适用规则:这个商户实际跑哪些规则 —— 法定核心(恒跑)+ 定向命中(audience 匹配)+ 不适用(定向未中)
  const applic = useMemo(
    () => (type === "商户" ? applicableRules({ name, risk: riskNum, country, white: dir?.acct.key === "white", kybIncomplete: !!a0?.kyb?.includes("未完成"), tags: confirmedTags }) : null),
    [type, name, riskNum, country, dir, a0, confirmedTags],
  );

  // 关联主体(带关联强度 + 硬证据依据)—— 同团伙成员(取两者共享边的具体 note,即"凭什么是一伙")+ 同案商户子主体
  const related = useMemo(() => {
    const set = new Map<string, { name: string; strength: string; tone: Tone; detail: string }>();
    const add = (n: string, strength: string, tone: Tone, detail: string) => { if (!sameEntity(n, name) && entityType(n) === "商户" && !set.has(n)) set.set(n, { name: n, strength, tone, detail }); };
    fp.rings.forEach((rh) => {
      const [s, t]: [string, Tone] = rh.ring.confidence >= 80 ? ["强", "red"] : rh.ring.confidence >= 60 ? ["中", "amber"] : ["弱", "grey"];
      const i = rh.ring.members.indexOf(rh.member); // 本主体在团伙中的下标
      rh.ring.members.forEach((m, j) => {
        if (m.kind === "群组") return;
        const edge = rh.ring.edges.find((e) => (e.a === i && e.b === j) || (e.a === j && e.b === i)); // 两者之间的共享边
        add(m.name, s, t, edge ? `同伙 · ${edge.note}` : `同伙 · ${rh.ring.typology}`);
      });
    });
    fp.cases.forEach((c) => (c.subjects || []).forEach((s) => { if (s.type === "商户") add(s.name, "中", "amber", `同案 · ${c.type}`); }));
    return [...set.values()].slice(0, 8);
  }, [fp, name]);

  // 商户 → 关联链上地址(从告警交易对手反推:托管钱包 + 入金来源 / 出金去向对手)
  const addrs = useMemo(() => (type === "商户" ? linkedAddresses(name) : []), [name, type]);

  // 完整事件记录 —— 跨模块统一事件流(类型 / 事件 / 记录·单号 / 时间 / 状态)
  type EV = { mod: ModKey; key: string; to: string; event: string; recLabel: string; recId: string; time: string; right: React.ReactNode };
  const events: EV[] = [
    ...fp.alerts.map((a): EV => { const st = RC_STATES[alertStore.stateOf(a.id, a.state)] || RC_STATES.new; return { mod: "alerts", key: a.id, to: `/alert?id=${a.id}`, event: `${a.title}(评分 ${a.score})`, recLabel: `${a.type} · 命中 ${a.ruleShort}`, recId: a.id, time: evtTime(a.id), right: <Pill tone={st.cls} dot>{st.label}</Pill> }; }),
    ...fp.findings.map((f): EV => { const st = FSTATES[findingStore.statusOf(f.id, f.status) as keyof typeof FSTATES] || FSTATES.new; return { mod: "findings", key: f.id, to: `/finding?id=${f.id}`, event: f.hit, recLabel: `${f.pattern} · ${FDIM[f.dim].label}`, recId: f.id, time: evtTime(f.id), right: <Pill tone={st.tone} dot>{st.label}</Pill> }; }),
    ...fp.rings.map(({ ring, member }): EV => { const st = RING_STATES[ringStore.stateOf(ring.id, ring.state) as keyof typeof RING_STATES]; return { mod: "rings", key: ring.id, to: `/ring?id=${ring.id}`, event: `与 ${ring.members.length} 个主体共享标识聚类成团 · ${ring.typology}`, recLabel: `本主体角色 ${member.role}`, recId: ring.id, time: evtTime(ring.id), right: st ? <Pill tone={st.tone} dot>{st.label}</Pill> : null }; }),
    ...fp.cases.map((c): EV => { const cs = caseStore.stateOf(c.id, c.state) as CState; const st = CSTATE[cs]; return { mod: "cases", key: c.id, to: `/case?id=${c.id}`, event: `${c.risk} · 来源 ${c.src}`, recLabel: c.type, recId: c.id, time: evtTime(c.id), right: <Pill tone={st.tone} dot>{st.label}</Pill> }; }),
    ...fp.reports.map((r): EV => { const st = RSTATE[reportStore.statusOf(r.id, r.status) as keyof typeof RSTATE]; return { mod: "reports", key: r.id, to: r.to || "/reports", event: r.summary, recLabel: `${r.type} · ${r.sub}`, recId: r.id, time: evtTime(r.id), right: st ? <Pill tone={st.tone} dot>{st.label}</Pill> : null }; }),
  ].sort((x, y) => y.time.localeCompare(x.time)); // 时间倒序

  // 活动日志 = 真实操作审计轨迹(每条记录的生命周期基线 + 各 store 的实时操作事件:认领/处置/串并…)
  const auditLog = useMemo(() => {
    const items: { time: string; text: string; mod: ModKey }[] = [];
    const push = (time: string, mod: ModKey, text: string) => items.push({ time, text, mod });
    fp.alerts.forEach((a) => { push(evtTime(a.id), "alerts", `告警生成 · ${a.title} · 命中 ${a.ruleShort}`); alertStore.eventsOf(a.id).forEach((e) => push(e.t, "alerts", `${a.id} · ${e.text}`)); });
    fp.findings.forEach((f) => { push(evtTime(f.id), "findings", `事后检测命中 · ${f.pattern}`); findingStore.eventsOf(f.id).forEach((e) => push(e.t, "findings", `${f.id} · ${e.text}`)); });
    fp.rings.forEach(({ ring }) => { push(evtTime(ring.id), "rings", `系统聚类识别成团 · ${ring.typology} · 置信度 ${ring.confidence}%`); ringStore.eventsOf(ring.id).forEach((e) => push(e.t, "rings", `${ring.id} · ${e.text}`)); });
    fp.cases.forEach((c) => { push(evtTime(c.id), "cases", `立案 · ${c.type} · 来源 ${c.src}`); caseStore.eventsOf(c.id).forEach((e) => push(e.t, "cases", `${c.id} · ${e.text}`)); });
    fp.reports.forEach((r) => { push(evtTime(r.id), "reports", `报告起草 · ${r.type}`); reportStore.eventsOf(r.id).forEach((e) => push(e.t, "reports", `${r.id} · ${e.text}`)); });
    return items.sort((a, b) => b.time.localeCompare(a.time));
  }, [fp]);

  const [tab, setTab] = useState<"info" | "log">("info");
  const [evFilter, setEvFilter] = useState<string>("all");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换主体时重置 tab/筛选,刻意同步重置
  useEffect(() => { setTab("info"); setEvFilter("all"); }, [name]);
  const evShown = evFilter === "all" ? events : events.filter((e) => e.mod === evFilter);
  const EV_TABS = ([["alerts", modCount.alerts], ["findings", modCount.findings], ["rings", modCount.rings], ["cases", modCount.cases], ["reports", modCount.reports]] as const).filter(([, n]) => n > 0);

  const acctPill = dir?.acct && dir.acct.key !== "normal" ? dir.acct : null;
  const uboCount = 1 + (avHash(name + "ubo") % 3);

  return (
    <Shell crumb={["风控", "主体档案", name]} wide>
      <button onClick={() => nav("/entity")} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回主体档案</button>

      {/* 页头 */}
      <div className="mb-5">
        <h1 className="flex flex-wrap items-center gap-2.5 text-[23px] font-bold tracking-tight">
          {name}
          {acctPill && <Pill tone={acctPill.tone} dot={false}>{acctPill.label}</Pill>}
          <Pill tone={riskTone} dot={false}>{riskWord}</Pill>
        </h1>
        <div className="mt-2 text-[13px] text-default-500">商户号 <span className="tnum">{merchantNo}</span> · 注册国家 {country} · 入网时间 {synthReg(name)}</div>
      </div>

      {/* tabs */}
      <div className="mb-5 flex items-center gap-6 border-b border-divider">
        {([["info", "基本信息"], ["log", "活动日志"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`relative -mb-px pb-3 text-[14px] font-semibold transition-colors ${tab === k ? "text-foreground" : "text-default-400 hover:text-default-600"}`}>
            {label}{tab === k && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <div className="card p-5">
          <div className="mb-1 text-[15px] font-bold">活动日志 · 操作审计轨迹</div>
          <div className="mb-3 text-[12px] text-default-400">记录生命周期 + 分析师操作(认领 / 处置 / 串并…),按时间倒序;与「完整事件记录」(记录清单)互补。</div>
          <Timeline items={auditLog.map((e) => ({ time: e.time, text: `[${MOD_LABEL[e.mod]}] ${e.text}`, done: true }))} />
        </div>
      ) : (
      <div className="flex flex-col gap-5">
        {/* 串并横幅 —— 同商户多个在办案件 = 重复立案 / 可串并 */}
        {mergeable && (
          <div id="merge-banner" className="card border-l-[3px] p-4" style={{ borderLeftColor: "var(--violet)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--violet-bg)", color: "var(--violet)" }}><GitMerge className="h-[18px] w-[18px]" /></span>
              <div>
                <div className="text-[14px] font-bold">疑似重复立案 · 该商户有 {activeCases.length} 个在办案件</div>
                <div className="text-[11.5px] text-default-400">案件 = 单一容器。建议串并为一案,一次审核、一份 STR,消除重复立案 / 重复 STR。</div>
              </div>
              <Button size="sm" color="secondary" className="ml-auto" startContent={<GitMerge className="h-4 w-4" />} onPress={doMerge}>一键串并到 {primary.c.id}</Button>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {activeCases.map(({ c, st }) => (
                <button key={c.id} onClick={() => nav(`/case?id=${c.id}`)} className="card-hover group flex items-center gap-2 rounded-xl border border-default-200 px-3 py-2 text-left">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--violet-bg)", color: "var(--violet)" }}><FolderOpen className="h-[15px] w-[15px]" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12.5px] font-semibold"><span className="truncate">{c.type}</span><span className="text-default-400">· {c.id}</span>{c.id === primary.c.id && <Pill tone="violet" dot={false}>主案</Pill>}</div>
                    <div className="truncate text-[11.5px] text-default-400">{c.risk} · {c.amount} · 来源 {c.src}</div>
                  </div>
                  <Pill tone={CSTATE[st].tone} dot={false}>{CSTATE[st].label}</Pill>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-default-300 group-hover:text-brand" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniKpi label="累计涉及金额" value={fmtCAD(exposure)} tone={riskTone} />
          <MiniKpi label="累计告警" value={modCount.alerts} />
          <MiniKpi label="事后命中" value={modCount.findings} />
          <MiniKpi label="立案调查" value={modCount.cases} tone={modCount.cases ? "violet" : undefined} />
          <MiniKpi label="STR / 报送" value={strCount} tone={strCount ? "red" : undefined} />
          <MiniKpi label="关联团伙" value={modCount.rings} tone={modCount.rings ? "amber" : undefined} />
        </div>

        {/* 主体档案 + 关联网络 */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* 主体档案 */}
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2 text-[15px] font-bold"><IdCard className="h-[18px] w-[18px] text-default-400" />主体档案</div>
            <div className="flex items-center gap-3 border-b border-default-100 pb-4">
              <Initials p={{ i: initialsOf(name), c: AV_COLORS[avHash(name) % AV_COLORS.length] }} size={44} mono />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold">{name}</div>
                <div className="tnum text-[12px] text-default-400">{merchantNo}</div>
              </div>
              <Button size="sm" variant="bordered" endContent={<ArrowUpRight className="h-3.5 w-3.5" />} onPress={() => a0 && nav(`/alert?id=${a0.id}`)}>尽调档案</Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="KYC 准入评级">{a0?.merchantTier?.[0] ?? "—"}</Field>
              <Field label="注册地">{country}</Field>
              <Field label="类型">{legalForm ? `企业 (${legalForm}.)` : "企业法律实体"} · MSB</Field>
              <Field label="账户年龄">{a0?.accountAge ?? "—"}</Field>
              <Field label="制裁 / PEP" danger={!!a0?.sanctions?.status?.includes("命中")}>{a0?.sanctions?.status ?? "主体未命中"}</Field>
              <Field label="UBO">{uboCount} 人</Field>
              <Field label="30 日交易额">{vol30}</Field>
              <Field label="KYB">{a0?.kyb ?? "—"}</Field>
            </div>
            {applic && (
              <div className="mt-4 border-t border-default-100 pt-3">
                <div className="mb-2 text-[11px] font-semibold text-default-400">业务模式标签</div>
                {confirmedTags.length
                  ? <div className="flex flex-wrap gap-1.5">{confirmedTags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--violet)_14%,transparent)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--violet)]">{t}
                        <button onClick={() => tagStore.remove(name, t)} aria-label="移除标签" className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                      </span>
                    ))}</div>
                  : <p className="text-[11.5px] text-default-400">未分类(业务模式靠开户分类 / 模型识别打标签;风险 / KYC / 辖区为派生,不打)</p>}
                {suggestions.length > 0 && (
                  <div className="mt-2.5 rounded-xl border border-dashed border-[var(--violet)]/40 bg-[color-mix(in_srgb,var(--violet)_5%,transparent)] p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[var(--violet)]"><Sparkles className="h-3.5 w-3.5" />模型识别 · 建议标签(待确认)</div>
                    <div className="flex flex-col gap-1.5">
                      {suggestions.map((s) => (
                        <div key={s.tag} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[12px] font-semibold"><span className="truncate">{s.tag}</span><span className="shrink-0 rounded bg-default-100 px-1 text-[10px] font-medium text-default-500">置信 {s.conf}</span></div>
                            <div className="truncate text-[10.5px] text-default-400">{s.reason}</div>
                          </div>
                          <Button size="sm" variant="flat" color="secondary" className="h-7 shrink-0 text-[11px]" onPress={() => { tagStore.confirm(name, s.tag); toast.success(`已确认标签「${s.tag}」`); }}>确认</Button>
                          <button onClick={() => tagStore.dismiss(name, s.tag)} className="shrink-0 text-[11px] text-default-400 hover:text-default-600">忽略</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 关联网络 */}
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2 text-[15px] font-bold"><Network className="h-[18px] w-[18px] text-default-400" />关联网络</div>
            {addrs.length > 0 && (
              <>
                <div className="mb-2 text-[12px] font-semibold text-default-400">关联链上地址</div>
                <div className="flex flex-col gap-2">
                  {addrs.map((a) => (
                    <div key={a.addr} className="flex items-center gap-2.5 rounded-xl border border-default-200 px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--track)", color: "var(--text-3)" }}><Globe className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold"><span className="tnum">{a.addr}</span><span style={{ color: a.role === "商户托管" ? "var(--brand)" : "var(--violet)" }}>· {a.role}</span></div>
                        <div className="text-[11px] text-default-400">{a.dir}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {related.length > 0 && (
              <>
                <div className="mb-2 mt-4 text-[12px] font-semibold text-default-400">关联主体 · 同团伙 / 同案</div>
                <div className="flex flex-col gap-2">
                  {related.map((r) => (
                    <button key={r.name} onClick={() => nav(`/entity?name=${encodeURIComponent(r.name)}`)} className="card-hover group flex items-center gap-2.5 rounded-xl border border-default-200 px-3 py-2.5 text-left">
                      <Initials p={{ i: initialsOf(r.name), c: AV_COLORS[avHash(r.name) % AV_COLORS.length] }} size={32} mono />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold"><span className="truncate">{r.name}</span><span className="shrink-0" style={{ color: toneVar(r.tone) }}>· {r.strength}</span></div>
                        <div className="truncate text-[11px] text-default-400">{r.detail}</div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-default-300 group-hover:text-brand" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {addrs.length === 0 && related.length === 0 && <div className="py-8 text-center text-[12px] text-default-400">暂无关联地址 / 关联主体</div>}
          </div>
        </div>

        {/* 适用规则:这个商户实际跑哪些规则 —— 法定核心 + 定向命中 + 不适用 */}
        {applic && (
          <div className="card p-5">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[15px] font-bold"><ShieldAlert className="h-[18px] w-[18px] text-default-400" />适用规则
              <span className="text-[12px] font-medium text-default-400">法定核心 {applic.core.length} 条 · 定向命中 {applic.targeted.length} 条 · 不适用 {applic.excluded.length} 条</span>
            </div>
            <p className="mb-3 text-[11.5px] text-default-400">并非所有商户都跑所有规则:法定核心对全部商户恒生效;其余按规则「适用对象」定向到匹配的商户。</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <RuleBucket title="法定核心 · 恒跑" tone="red" rules={applic.core} nav={nav} note="制裁 / 名单硬规则 + LVCTR,所有商户不可豁免" />
              <RuleBucket title="定向命中 · 适用" tone="green" rules={applic.targeted} nav={nav} note="audience 为「全部」或匹配本商户" />
              <RuleBucket title="不适用 · 未定向到" tone="grey" rules={applic.excluded} nav={nav} note="规则定向到其它商户分群,本商户不跑" />
            </div>
          </div>
        )}

        {/* 完整事件记录 */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <div className="flex items-center gap-2 text-[15px] font-bold"><Layers className="h-[18px] w-[18px] text-default-400" />完整事件记录</div>
            <div className="text-[12px] text-default-400">按时间倒序 · 共 {events.length} 条</div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3 pt-3">
            {([["all", "全部", events.length], ...EV_TABS.map(([k, n]) => [k, MOD_LABEL[k], n] as [string, string, number])] as [string, string, number][]).map(([k, label, n]) => {
              const on = evFilter === k;
              return (
                <button key={k} onClick={() => setEvFilter(k)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors ${on ? "" : "text-default-500 hover:bg-default-100"}`} style={on ? { background: "var(--brand-soft)", color: "var(--brand)" } : { background: "var(--track)" }}>
                  {label} {n}
                </button>
              );
            })}
          </div>
          {evShown.length === 0 ? (
            <div className="px-5 py-12 text-center text-[12.5px] text-default-400">该类型下无事件</div>
          ) : (
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-y border-default-100 text-[11px] font-bold uppercase tracking-wider text-default-400">
                <th className="w-[88px] px-5 py-2.5 text-left font-bold">类型</th>
                <th className="px-3 py-2.5 text-left font-bold">事件</th>
                <th className="w-[28%] px-3 py-2.5 text-left font-bold">记录 / 关联单号</th>
                <th className="w-[148px] px-3 py-2.5 text-left font-bold">时间</th>
                <th className="w-[116px] px-5 py-2.5 text-left font-bold">记录现状</th>
              </tr>
            </thead>
            <tbody>
              {evShown.map((e) => (
                <tr key={`${e.mod}-${e.key}`} onClick={() => nav(e.to)} className="cursor-pointer border-b border-default-50 align-top transition-colors hover:bg-default-50">
                  <td className="px-5 py-3.5"><span className="inline-block rounded-md bg-default-100 px-2 py-0.5 text-[11px] font-medium text-default-600">{MOD_LABEL[e.mod]}</span></td>
                  <td className="px-3 py-3.5 text-[12.5px] leading-snug text-default-700">{e.event}</td>
                  <td className="px-3 py-3.5"><div className="truncate text-[12px] font-semibold">{e.recLabel}</div><div className="tnum text-[11px] text-default-400">{e.recId}</div></td>
                  <td className="tnum px-3 py-3.5 text-[12px] text-default-500">{e.time}</td>
                  <td className="px-5 py-3.5">{e.right}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
      )}
    </Shell>
  );
}

// KPI 小卡(基本信息顶部)
function MiniKpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-default-200 p-3.5">
      <div className="text-[11.5px] font-medium text-default-400">{label}</div>
      <div className="mt-1.5 text-[20px] font-extrabold leading-none tracking-tight" style={tone ? { color: toneVar(tone) } : undefined}>{value}</div>
    </div>
  );
}

// 档案字段(标签在上、值在下)
function Field({ label, children, danger }: { label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div>
      <div className="text-[11.5px] text-default-400">{label}</div>
      <div className="mt-1 text-[13px] font-semibold" style={danger ? { color: "var(--danger)" } : undefined}>{children}</div>
    </div>
  );
}

// ── 商户头像(确定性配色 + 缩写)──
const AV_COLORS = ["var(--brand)", "var(--violet)", "var(--success)", "var(--warning)", "#e1556d", "#0ea5e9", "#8b5cf6"];
function avHash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const pad2 = (n: number) => String(n).padStart(2, "0");
// 确定性合成:入网时间 / 事件时间戳(刷新稳定)
function synthReg(name: string): string { const h = avHash(name + "reg"); return `2026-${pad2(1 + (h % 11))}-${pad2(1 + ((h >> 4) % 27))}`; }
function evtTime(key: string): string { const h = avHash(key + "ts"); return `2026-${pad2(2 + (h % 4))}-${pad2(1 + ((h >> 3) % 27))} ${pad2((h >> 6) % 24)}:${pad2((h >> 11) % 60)}`; }
function initialsOf(name: string): string {
  const toks = name.replace(/[（(].*$/, "").trim().split(/[\s-]+|(?<=[a-z])(?=[A-Z])/).filter(Boolean);
  const s = toks.length >= 2 ? (toks[0][0] || "") + (toks[1][0] || "") : (toks[0] || name).slice(0, 2);
  return s.toUpperCase();
}

// ── KPI 卡 ──
function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Store; label: string; value: React.ReactNode; sub: string; tone?: Tone }) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-default-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: tone ? toneSoft(tone) : "var(--track)", color: tone ? toneVar(tone) : "var(--text-3)" }}><Icon className="h-[15px] w-[15px]" strokeWidth={2} /></span>
        {label}
      </div>
      <div className="text-[30px] font-extrabold leading-none tracking-tight" style={tone ? { color: toneVar(tone) } : undefined}>{value}</div>
      <div className="text-[11.5px] text-default-400">{sub}</div>
    </div>
  );
}
const toneSoft = (t: Tone) => `color-mix(in srgb, ${toneVar(t)} 14%, transparent)`;

// ── 适用规则分桶(法定核心 / 定向命中 / 不适用)──
function RuleBucket({ title, tone, rules, nav, note }: { title: string; tone: Tone; rules: Rule[]; nav: (to: string) => void; note: string }) {
  return (
    <div className="rounded-xl border border-default-200 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-bold"><span className="h-2 w-2 rounded-full" style={{ background: toneVar(tone) }} />{title}<span className="text-default-400">({rules.length})</span></div>
      <p className="mb-2 text-[10.5px] leading-snug text-default-400">{note}</p>
      {rules.length ? (
        <div className="flex flex-col gap-1">
          {rules.map((r) => (
            <button key={r.id} onClick={() => nav(`/rule?id=${r.id}`)} className="card-hover flex items-center justify-between gap-2 rounded-lg border border-default-100 px-2.5 py-1.5 text-left text-[11.5px]">
              <span className="truncate font-medium">{r.name}</span><span className="shrink-0 text-default-400">{r.cat}</span>
            </button>
          ))}
        </div>
      ) : <p className="text-[11px] text-default-300">—</p>}
    </div>
  );
}

// ── 风险分徽标 ──
function RiskNum({ n }: { n: number }) {
  const tone: Tone = n >= 80 ? "red" : n >= 60 ? "amber" : "green";
  return <span className="tnum inline-flex h-7 min-w-[34px] items-center justify-center rounded-lg px-2 text-[13px] font-extrabold" style={{ background: toneSoft(tone), color: toneVar(tone) }}>{n}</span>;
}

// ── 犯事记录 chips ──
function RecordChips({ e }: { e: DirEntry }) {
  if (e.total === 0) return <span className="text-[12px] text-default-300">无记录</span>;
  const clean = e.cases === 0 && e.str === 0 && e.rings === 0 && e.findings === 0 && e.alerts > 0 && e.risk < 50;
  if (clean) return <span className="text-[11.5px] text-default-400">告警 {e.alerts} · 均误报</span>;
  const chip = (label: string, n: number, tone: Tone) => n > 0 && (
    <span key={label} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: toneSoft(tone), color: toneVar(tone) }}>{label} {n}</span>
  );
  return <div className="flex flex-wrap items-center gap-1.5">{chip("告警", e.alerts, "amber")}{chip("案件", e.cases, "violet")}{chip("STR", e.str, "red")}{chip("团伙", e.rings, "blue")}</div>;
}

// ── 风险趋势 ▲▼(对比 30 天前)──
function TrendTag({ n }: { n: number }) {
  if (Math.abs(n) < 1) return <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-default-300"><Minus className="h-3 w-3" />持平</span>;
  const up = n > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold" style={{ color: up ? "var(--danger)" : "var(--success)" }} title={`相对 30 天前${up ? "恶化" : "缓和"} ${Math.abs(n)} 分`}><Icon className="h-3 w-3" />{up ? "+" : ""}{n}</span>;
}

// ── 可解释风险分:点击展开「风险驱动因素」──
function RiskCell({ e }: { e: DirEntry }) {
  return (
    <Popover placement="bottom-start" showArrow>
      <PopoverTrigger>
        <button onClick={(ev) => ev.stopPropagation()} className="flex items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-80">
          <RiskNum n={e.risk} />
          <TrendTag n={e.trend} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-[268px] items-start p-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold"><Sparkles className="h-3.5 w-3.5 text-default-400" />风险驱动因素</div>
        <div className="flex w-full flex-col gap-1.5">
          {e.factors.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: toneVar(f.tone) }} />
              <span className="text-default-600">{f.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 w-full border-t border-default-100 pt-2 text-[11px] text-default-400">
          趋势 {e.trend > 0 ? `恶化 +${e.trend}` : e.trend < 0 ? `缓和 ${e.trend}` : "持平"} · 对比 30 天前{e.ringMates > 0 && <> · <span style={{ color: "var(--warning)" }}>同团伙 {e.ringMates} 个商户,可并案</span></>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 处置进展单元格:工作流阶段(flow)+ 紧急待办角标(pending)+ 可并案 ──
const PEND_ICON: Record<Pending["kind"], typeof Bell> = { claim: UserPlus, sla: Clock3 };
function FlowCell({ e }: { e: DirEntry }) {
  const nav = useNavigate();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {e.flow.key === "done" ? <span className="text-[12px] text-default-300">—</span> : <Pill tone={e.flow.tone}>{e.flow.label}</Pill>}
      {e.activeCases > 1 && <button onClick={(ev) => { ev.stopPropagation(); nav(`/entity?name=${encodeURIComponent(e.name)}&merge=1`); }} title={`在办 ${e.activeCases} 个案件 · 点击串并`} className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-bold transition-opacity hover:opacity-75" style={{ background: toneSoft("violet"), color: toneVar("violet") }}><GitMerge className="h-3 w-3" />{e.activeCases} 案</button>}
      {e.pending && (() => { const Icon = PEND_ICON[e.pending.kind]; return (
        <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: toneSoft(e.pending.tone), color: toneVar(e.pending.tone) }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneVar(e.pending.tone) }} /><Icon className="h-3 w-3" />{e.pending.label}
        </span>
      ); })()}
    </div>
  );
}

// ── 需关注分诊条:把待办紧迫的主体聚成一行可点筛选 ──
type PendFilter = "all" | "claim" | "str" | "sla" | "triage" | "rising";
const matchPend = (k: PendFilter, e: DirEntry): boolean =>
  k === "claim" ? e.pending?.kind === "claim"
    : k === "sla" ? e.pending?.kind === "sla"
    : k === "str" ? e.flow.key === "queued" || e.flow.key === "report" // 待报送阶段(案件 queued / 仅报告)
    : k === "triage" ? e.flow.key === "triage"
    : k === "rising" ? e.trend >= 8
    : true;
function TriageStrip({ all, value, onPick }: { all: DirEntry[]; value: PendFilter; onPick: (k: PendFilter) => void }) {
  const items: { k: PendFilter; label: string; n: number; icon: typeof Bell; tone: Tone }[] = [
    { k: "claim", label: "待认领案件", n: all.filter((e) => matchPend("claim", e)).length, icon: UserPlus, tone: "violet" },
    { k: "str", label: "STR 待报送", n: all.filter((e) => matchPend("str", e)).length, icon: Send, tone: "red" },
    { k: "sla", label: "案件 SLA 临期", n: all.filter((e) => matchPend("sla", e)).length, icon: Clock3, tone: "amber" },
    { k: "triage", label: "告警待研判", n: all.filter((e) => matchPend("triage", e)).length, icon: Bell, tone: "amber" },
    { k: "rising", label: "风险恶化中", n: all.filter((e) => matchPend("rising", e)).length, icon: TrendingUp, tone: "red" },
  ];
  const shown = items.filter((i) => i.n > 0);
  if (!shown.length) return null;
  const total = all.filter((e) => e.pending?.urgent || e.flow.key === "report").length;
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-2 p-3 pl-4">
      <span className="mr-1 flex items-center gap-1.5 text-[12.5px] font-bold"><ShieldAlert className="h-4 w-4" style={{ color: "var(--danger)" }} />需关注<span className="text-default-400">· {total} 项待办</span></span>
      {shown.map((i) => {
        const on = value === i.k;
        const Icon = i.icon;
        return (
          <button key={i.k} onClick={() => onPick(on ? "all" : i.k)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
            style={on ? { borderColor: toneVar(i.tone), background: toneSoft(i.tone), color: toneVar(i.tone) } : { borderColor: "var(--line)", color: "var(--text-2)" }}>
            <Icon className="h-3.5 w-3.5" style={{ color: toneVar(i.tone) }} />{i.label}
            <span className="tnum rounded-full px-1.5 text-[10.5px] font-bold" style={{ background: toneSoft(i.tone), color: toneVar(i.tone) }}>{i.n}</span>
          </button>
        );
      })}
      {value !== "all" && <button onClick={() => onPick("all")} className="ml-auto text-[11.5px] font-medium text-default-400 hover:text-default-600">清除筛选 ✕</button>}
    </div>
  );
}

// ── 主体目录 · 商户风险总览(无 name 参数)──
const DIR_TABS = [
  { k: "all", label: "全部" },
  { k: "high", label: "高风险" },
  { k: "cases", label: "有在办案件" },
  { k: "restricted", label: "受限 / 冻结" },
  { k: "watch", label: "名单观察" },
] as const;
type DirTab = (typeof DIR_TABS)[number]["k"];
const inTab = (tab: DirTab, e: DirEntry): boolean =>
  tab === "all" ? true
    : tab === "high" ? e.risk >= 80
    : tab === "cases" ? e.cases > 0
    : tab === "restricted" ? e.acct.key === "frozen" || e.acct.key === "restricted"
    : /* watch */ e.acct.key === "watch";

function Directory() {
  useAlertVersion(); useFindingVersion(); useCaseVersion(); useRingVersion(); useReportVersion();
  const nav = useNavigate();
  const all = useMemo(() => directory(), []);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<DirTab>("all");
  const [risk, setRisk] = useState("all");   // all | high(≥80) | mid(60-79) | low(<60)
  const [stat, setStat] = useState("all");
  const [country, setCountry] = useState("all");
  const [pend, setPend] = useState<PendFilter>("all");

  const countries = useMemo(() => [...new Set(all.map((e) => e.country).filter((c) => c && c !== "—"))], [all]);
  const tabCount = (k: DirTab) => all.filter((e) => inTab(k, e)).length;

  const list = all.filter((e) => {
    if (!inTab(tab, e)) return false;
    if (pend !== "all" && !matchPend(pend, e)) return false;
    if (q.trim()) { const s = q.toLowerCase(); if (!e.name.toLowerCase().includes(s) && !e.merchantNo.includes(q.trim())) return false; }
    if (risk === "high" && e.risk < 80) return false;
    if (risk === "mid" && (e.risk < 60 || e.risk >= 80)) return false;
    if (risk === "low" && e.risk >= 60) return false;
    if (stat !== "all" && e.acct.key !== stat) return false;
    if (country !== "all" && e.country !== country) return false;
    return true;
  });

  const restricted = all.filter((e) => e.acct.key === "frozen" || e.acct.key === "restricted").length;
  const active = all.length - restricted;
  const highRisk = all.filter((e) => e.risk >= 80).length;
  const caseSubj = all.filter((e) => e.cases > 0).length;
  const caseTotal = all.reduce((n, e) => n + e.cases, 0);

  return (
    <Shell crumb={["主体档案"]} wide>
      <PageHead title="商户总览" sub="全部商户主体的风险总览 · 按「需关注度」(风险 × 待办 × 趋势)排序,优先顶上正在恶化、有待办的主体。点击任意商户进入其 360° 档案。" />

      {/* 需关注分诊条 —— 谁需要我、为什么 */}
      <TriageStrip all={all} value={pend} onPick={setPend} />

      {/* KPI */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Building2} label="总商户数" value={all.length.toLocaleString()} sub={`活跃 ${active} · 受限 ${restricted}`} />
        <Kpi icon={AlertOctagon} label="高风险主体" value={highRisk} sub="风险分 ≥ 80" tone="red" />
        <Kpi icon={FolderOpen} label="有在办案件" value={caseTotal} sub={`涉及 ${caseSubj} 个主体`} tone="violet" />
        <Kpi icon={Lock} label="当前受限 / 冻结" value={restricted} sub="提现或交易受限" tone="amber" />
      </div>

      <div className="card overflow-hidden">
        {/* tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-default-100 px-4 pt-4">
          {DIR_TABS.map((t) => {
            const on = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${on ? "" : "text-default-500 hover:bg-default-50"}`}
                style={on ? { background: "var(--brand-soft)", color: "var(--brand)" } : undefined}>
                {t.label}
                <span className="tnum rounded-full px-1.5 text-[10.5px] font-bold" style={on ? { background: "color-mix(in srgb, var(--brand) 16%, transparent)", color: "var(--brand)" } : { background: "var(--track)", color: "var(--text-3)" }}>{tabCount(t.k)}</span>
              </button>
            );
          })}
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3.5">
          <div className="min-w-[240px] flex-1">
            <Input size="sm" radius="lg" placeholder="搜索商户名 / 商户号…" value={q} onValueChange={setQ}
              startContent={<Search className="h-4 w-4 text-default-400" />} classNames={{ inputWrapper: "bg-default-100 shadow-none" }} />
          </div>
          <Select size="sm" radius="lg" aria-label="风险分" selectedKeys={[risk]} className="w-[130px]" classNames={{ trigger: "bg-default-100 shadow-none" }}
            onSelectionChange={(k) => setRisk([...k][0] as string)} renderValue={() => <span className="text-[12.5px]">{({ all: "风险分", high: "≥ 80", mid: "60–79", low: "< 60" } as Record<string, string>)[risk]}</span>}>
            <SelectItem key="all">全部风险分</SelectItem><SelectItem key="high">≥ 80 高风险</SelectItem><SelectItem key="mid">60–79 中</SelectItem><SelectItem key="low">&lt; 60 低</SelectItem>
          </Select>
          <Select size="sm" radius="lg" aria-label="账户状态" selectedKeys={[stat]} className="w-[130px]" classNames={{ trigger: "bg-default-100 shadow-none" }}
            onSelectionChange={(k) => setStat([...k][0] as string)} renderValue={() => <span className="text-[12.5px]">{stat === "all" ? "账户状态" : ({ frozen: "冻结", restricted: "受限", watch: "观察", white: "白名单", normal: "正常" } as Record<string, string>)[stat]}</span>}>
            {[["all", "全部账户状态"], ["frozen", "冻结"], ["restricted", "受限"], ["watch", "观察"], ["white", "白名单"], ["normal", "正常"]].map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)}
          </Select>
          <Select size="sm" radius="lg" aria-label="注册地" selectedKeys={[country]} className="w-[120px]" classNames={{ trigger: "bg-default-100 shadow-none" }}
            onSelectionChange={(k) => setCountry([...k][0] as string)} renderValue={() => <span className="text-[12.5px]">{country === "all" ? "注册地" : country}</span>}>
            {[<SelectItem key="all">全部注册地</SelectItem>, ...countries.map((c) => <SelectItem key={c}>{c}</SelectItem>)]}
          </Select>
        </div>

        {/* table */}
        <table className="w-full">
          <thead>
            <tr className="border-y border-default-100 text-[11px] font-bold uppercase tracking-wider text-default-400">
              <th className="px-4 py-2.5 text-left font-bold">商户</th>
              <th className="px-3 py-2.5 text-left font-bold">风险分 · 趋势</th>
              <th className="px-3 py-2.5 text-left font-bold">账户状态</th>
              <th className="px-3 py-2.5 text-left font-bold">处置进展</th>
              <th className="px-3 py-2.5 text-left font-bold">犯事记录</th>
              <th className="px-3 py-2.5 text-right font-bold">30 日交易额</th>
              <th className="px-3 py-2.5 text-left font-bold">最近事件</th>
              <th className="px-4 py-2.5 text-right font-bold">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.key} onClick={() => nav(`/entity?name=${encodeURIComponent(e.name)}`)}
                className="cursor-pointer border-b border-default-50 transition-colors hover:bg-default-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Initials p={{ i: initialsOf(e.name), c: AV_COLORS[avHash(e.key) % AV_COLORS.length] }} size={38} mono />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-bold">{e.name}</div>
                      <div className="tnum text-[11px] text-default-400">{e.merchantNo}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3"><RiskCell e={e} /></td>
                <td className="px-3 py-3"><Pill tone={e.acct.tone}>{e.acct.label}</Pill></td>
                <td className="px-3 py-3"><FlowCell e={e} /></td>
                <td className="px-3 py-3"><RecordChips e={e} /></td>
                <td className="px-3 py-3 text-right tnum text-[12.5px] font-semibold">{e.vol30}</td>
                <td className="px-3 py-3 text-[12px] text-default-500">{e.lastEvent.label}{e.lastEvent.date && <span className="text-default-300"> · {e.lastEvent.date}</span>}</td>
                <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--brand)" }}>查看档案<ArrowUpRight className="h-3.5 w-3.5" /></span></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-[12.5px] text-default-400">无匹配商户</td></tr>}
          </tbody>
        </table>

        <p className="border-t border-default-100 px-4 py-3 text-[11.5px] leading-relaxed text-default-400">
          「犯事记录」是该商户历史累计的 告警 / 案件 / STR 数量汇总,一眼判断案底厚薄。点击任意行进入主体 360° 档案查看完整事件记录。
        </p>
      </div>
    </Shell>
  );
}
