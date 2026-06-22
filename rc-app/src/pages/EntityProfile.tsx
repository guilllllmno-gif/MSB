import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button, Input, Select, SelectItem, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Fingerprint, Search, Bell, History, Network, FolderOpen, FileText, ArrowUpRight, ShieldAlert, Store, Link2, Layers, Building2, Lock, AlertOctagon, TrendingUp, TrendingDown, Minus, UserPlus, Send, Clock3, Sparkles, GitMerge } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, SoftChip, SectionLabel, Initials, RiskBadge, toneVar } from "@/components/bits";
import { directory, footprint, totalExposure, fmtCAD, entityType, ENTITY_TONE, caseStr, sameEntity, linkedAddresses, type DirEntry, type Pending } from "@/lib/entity360";
import { RC_STATES, type Tone } from "@/lib/data";
import { FSTATES, FDIM } from "@/lib/findings";
import { CSTATE, type CState } from "@/lib/cases";
import { RSTATE } from "@/lib/reports";
import { RING_STATES } from "@/lib/rings";
import { alertStore, useAlertVersion, findingStore, useFindingVersion, caseStore, useCaseVersion, reportStore, useReportVersion, ringStore, useRingVersion } from "@/lib/store";

const MOD_ICON: Record<string, typeof Bell> = { alerts: Bell, findings: History, rings: Network, cases: FolderOpen, reports: FileText };
const MOD_LABEL: Record<string, string> = { alerts: "告警", findings: "事后", rings: "团伙", cases: "案件", reports: "报送" };

// ── 模块覆盖点阵(目录 + 横幅共用)──
type ModCount = { alerts: number; findings: number; rings: number; cases: number; reports: number };
function ModDots({ on }: { on: ModCount }) {
  return (
    <div className="flex items-center gap-1">
      {(["alerts", "findings", "rings", "cases", "reports"] as const).map((m) => {
        const Icon = MOD_ICON[m];
        const lit = (on[m] || 0) > 0;
        return (
          <span key={m} title={`${MOD_LABEL[m]} · ${on[m] || 0}`}
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{ background: lit ? "var(--brand-soft)" : "var(--track)", color: lit ? "var(--brand)" : "var(--default-300, #c4c4c8)" }}>
            <Icon className="h-[13px] w-[13px]" strokeWidth={2} />
          </span>
        );
      })}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="text-[19px] font-extrabold leading-none tracking-tight" style={tone ? { color: toneVar(tone) } : undefined}>{value}</div>
      <div className="mt-1 truncate text-[11px] font-medium text-default-400">{label}</div>
    </div>
  );
}

// ── 足迹分区:一个模块一张卡 ──
function FootSection({ icon: Icon, title, count, hint, children }: { icon: typeof Bell; title: string; count: number; hint?: string; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Icon className="h-[15px] w-[15px]" strokeWidth={2} /></span>
        <h3 className="text-[14px] font-bold tracking-tight">{title}</h3>
        <span className="rounded-full bg-default-100 px-[7px] py-px text-[10.5px] font-bold text-default-500">{count}</span>
        {hint && <span className="ml-auto text-[11.5px] text-default-400">{hint}</span>}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

// 单条足迹行 —— 可点跳转
function Row({ to, lead, title, sub, right }: { to: string; lead?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) {
  const nav = useNavigate();
  return (
    <button onClick={() => nav(to)} className="card-hover group flex w-full items-center gap-3 rounded-xl border border-default-200 px-3 py-2.5 text-left">
      {lead}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold">{title}</div>
        {sub && <div className="mt-0.5 truncate text-[11.5px] text-default-400">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}<ArrowUpRight className="h-3.5 w-3.5 text-default-300 transition-colors group-hover:text-brand" /></div>
    </button>
  );
}

export default function EntityProfile() {
  const [params] = useSearchParams();
  const name = params.get("name") || "";
  return name ? <Profile name={name} /> : <Directory />;
}

function Profile({ name }: { name: string }) {
  useAlertVersion(); useFindingVersion(); useCaseVersion(); useReportVersion(); useRingVersion();
  const nav = useNavigate();

  const fp = useMemo(() => footprint(name), [name]);
  const type = entityType(name);
  const exposure = totalExposure(fp);

  // 综合风险标签 —— 由跨模块足迹推导(有案件/团伙=高,纯告警/事后=中)
  const hasCase = fp.cases.some((c) => CSTATE[(caseStore.stateOf(c.id, c.state)) as CState]?.active);
  const hasRing = fp.rings.length > 0;
  const sanc = fp.alerts.some((a) => a.sanctions?.status?.includes("命中")) || fp.cases.some((c) => /制裁/.test(c.risk + c.type));
  const riskTone: Tone = sanc || hasCase ? "red" : hasRing ? "amber" : "blue";
  const riskLabel = sanc ? "制裁关联 · 高风险" : hasCase ? "在办案件 · 高风险" : hasRing ? "团伙关联 · 关注" : fp.alerts.length || fp.findings.length ? "有命中 · 观察" : "暂无命中";

  const modCount = { alerts: fp.alerts.length, findings: fp.findings.length, rings: fp.rings.length, cases: fp.cases.length, reports: fp.reports.length };
  const strCount = fp.cases.filter((c) => ["str_draft", "mlro", "queued", "filed"].includes(caseStore.stateOf(c.id, c.state))).length + fp.reports.length;

  // 画像信息 —— 从最丰富的来源拼(告警 merchantTier/kyb/accountAge,否则案件/事后)
  const a0 = fp.alerts[0];
  const TypeIcon = type === "链上地址" ? Link2 : type === "团伙" ? Network : Store;

  // 关联商户 —— 同团伙成员 + 同案件涉案主体里的「其它商户」(主体=商户维度,地址不作关联主体,见下方属性卡)
  const related = useMemo(() => {
    const set = new Map<string, { name: string; via: string }>();
    const add = (n: string, via: string) => { if (!sameEntity(n, name) && entityType(n) === "商户") set.set(n, { name: n, via }); };
    fp.rings.forEach((rh) => rh.ring.members.forEach((m) => { if (m.kind !== "群组") add(m.name, `同团伙 ${rh.ring.id}`); }));
    fp.cases.forEach((c) => (c.subjects || []).forEach((s) => add(s.name, `同案 ${c.id}`)));
    return [...set.values()].slice(0, 12);
  }, [fp, name]);

  // 商户 → 关联链上地址(从告警交易对手反推:托管钱包 + 入金来源 / 出金去向对手)
  const addrs = useMemo(() => (type === "商户" ? linkedAddresses(name) : []), [name, type]);

  return (
    <Shell crumb={["主体档案", name]} wide>
      <PageHead title={name} sub="商户主体360 · 一个商户(法律实体)在 事中 / 事后 / 告警 / 团伙 / 案件 / 报送 的全部足迹聚到一张视图。地址 / 行为是该商户名下的属性与记录,不另作主体。" actions={
        <Button size="sm" variant="flat" className="bg-default-100" startContent={<Fingerprint className="h-4 w-4" />} onPress={() => nav("/entity")}>主体目录</Button>
      } />

      {/* 风险横幅 —— 综合标签 + 模块覆盖 + 关键统计 */}
      <div className="card mb-5 border-l-[3px] p-4" style={{ borderLeftColor: toneVar(riskTone) }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><TypeIcon className="h-[18px] w-[18px]" strokeWidth={2} /></span>
          <div>
            <div className="flex items-center gap-2">
              <Pill tone={ENTITY_TONE[type]} dot={false}>{type}</Pill>
              <Pill tone={riskTone} icon={<ShieldAlert className="h-3 w-3" />}>{riskLabel}</Pill>
            </div>
            <div className="mt-1 text-[11.5px] text-default-400">跨 {Object.values(modCount).filter((n) => n > 0).length} / 5 个模块出现</div>
          </div>
          <div className="ml-auto"><ModDots on={modCount} /></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-default-100 pt-3.5 sm:grid-cols-6">
          <Stat label="累计涉及金额" value={fmtCAD(exposure)} tone={riskTone} />
          <Stat label="告警" value={modCount.alerts} />
          <Stat label="事后命中" value={modCount.findings} />
          <Stat label="关联团伙" value={modCount.rings} />
          <Stat label="案件" value={modCount.cases} tone={hasCase ? "violet" : undefined} />
          <Stat label="STR / 报送" value={strCount} tone={strCount ? "red" : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* 左:六模块足迹 */}
        <div className="flex flex-col gap-4">
          {modCount.alerts + modCount.findings + modCount.rings + modCount.cases + modCount.reports === 0 && (
            <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Layers className="h-7 w-7 text-default-300" />
              <div className="text-[13px] font-semibold text-default-500">该主体暂无跨模块命中记录</div>
              <div className="text-[11.5px] text-default-400">名字写法可能与各模块不一致,可回主体目录选取已聚合的主体。</div>
            </div>
          )}

          <FootSection icon={Bell} title="告警研判" count={modCount.alerts} hint="实时命中 → 研判车道">
            {fp.alerts.map((a) => {
              const st = RC_STATES[alertStore.stateOf(a.id, a.state)] || RC_STATES.new;
              return <Row key={a.id} to={`/alert?id=${a.id}`} lead={<RiskBadge tone={a.sev === "high" ? "red" : a.sev === "mid" ? "amber" : "blue"}>{a.score}</RiskBadge>}
                title={<><span>{a.title}</span><span className="text-default-400">· {a.id}</span></>} sub={`${a.type} · ${a.amount} · ${a.ruleShort}`}
                right={<Pill tone={st.cls} dot={false}>{st.label}</Pill>} />;
            })}
          </FootSection>

          <FootSection icon={History} title="事后监控命中" count={modCount.findings} hint="回溯 / 批量检测">
            {fp.findings.map((f) => {
              const st = FSTATES[findingStore.statusOf(f.id, f.status) as keyof typeof FSTATES] || FSTATES.new;
              const dim = FDIM[f.dim];
              return <Row key={f.id} to={`/finding?id=${f.id}`} lead={<span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--track)" }}><f.icon className="h-[15px] w-[15px] text-default-500" /></span>}
                title={<><span>{f.pattern}</span><span className="text-default-400">· {f.id}</span></>} sub={`${f.hit}`}
                right={<><SoftChip>{dim.label}</SoftChip><Pill tone={st.tone} dot={false}>{st.label}</Pill></>} />;
            })}
          </FootSection>

          <FootSection icon={Network} title="关联团伙" count={modCount.rings} hint="共享标识聚类">
            {fp.rings.map(({ ring, member }) => {
              const st = RING_STATES[ringStore.stateOf(ring.id, ring.state) as keyof typeof RING_STATES];
              return <Row key={ring.id} to={`/ring?id=${ring.id}`} lead={<Initials p={{ i: member.i, c: member.c }} size={28} />}
                title={<><span>{ring.name}</span><span className="text-default-400">· {ring.id}</span></>} sub={`本主体角色:${member.role} · ${ring.typology} · ${ring.members.length} 主体`}
                right={st ? <Pill tone={st.tone} dot={false}>{st.label}</Pill> : null} />;
            })}
          </FootSection>

          <FootSection icon={FolderOpen} title="关联案件" count={modCount.cases} hint="调查与 STR 唯一容器">
            {fp.cases.map((c) => {
              const cs = caseStore.stateOf(c.id, c.state) as CState;
              const st = CSTATE[cs];
              const str = caseStr(cs);
              return <Row key={c.id} to={`/case?id=${c.id}`} lead={<span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--violet-bg)", color: "var(--violet)" }}><FolderOpen className="h-[15px] w-[15px]" /></span>}
                title={<><span>{c.type}</span><span className="text-default-400">· {c.id}</span></>} sub={`${c.risk} · ${c.amount} · 来源 ${c.src}`}
                right={<><Pill tone={str.tone} dot={false}>STR {str.text}</Pill><Pill tone={st.tone} dot={false}>{st.label}</Pill></>} />;
            })}
          </FootSection>

          <FootSection icon={FileText} title="报告报送" count={modCount.reports} hint="FINTRAC 合规上报">
            {fp.reports.map((r) => {
              const st = RSTATE[reportStore.statusOf(r.id, r.status) as keyof typeof RSTATE];
              return <Row key={r.id} to={r.to || "/reports"} lead={<SoftChip net>{r.type}</SoftChip>}
                title={<><span>{r.summary.slice(0, 28)}…</span><span className="text-default-400">· {r.id}</span></>} sub={`${r.sub} · ${r.amount}`}
                right={st ? <Pill tone={st.tone} dot={false}>{st.label}</Pill> : null} />;
            })}
          </FootSection>
        </div>

        {/* 右:主体画像 + 关联主体 */}
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <SectionLabel>主体画像</SectionLabel>
            <div className="flex flex-col gap-2 text-[12.5px]">
              <KV label="类型">{type}</KV>
              {a0 && <KV label="注册地">{a0.country}</KV>}
              {a0 && <KV label="商户分级"><Pill tone={a0.merchantTier[1]} dot={false}>{a0.merchantTier[0]}</Pill></KV>}
              {a0 && <KV label="KYB">{a0.kyb}</KV>}
              {a0 && <KV label="账龄">{a0.accountAge}</KV>}
              {a0?.sanctions && <KV label="制裁筛查"><span style={{ color: a0.sanctions.status.includes("命中") ? "var(--danger)" : undefined }}>{a0.sanctions.status}</span></KV>}
              {a0?.custHistory && <KV label="30日交易额">{a0.custHistory.vol30}</KV>}
              {!a0 && <div className="py-2 text-[11.5px] text-default-400">该主体未在事中告警出现,画像取自事后 / 案件维度。{type === "链上地址" && "链上地址以行为标签为主。"}</div>}
            </div>
          </div>

          {addrs.length > 0 && (
            <div className="card p-4">
              <SectionLabel>关联链上地址 · 该商户属性</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {addrs.map((a) => (
                  <div key={a.addr} className="flex items-center gap-2 rounded-lg border border-default-200 px-2.5 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--violet-bg)", color: "var(--violet)" }}><Link2 className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{a.addr}</span>
                    <Pill tone={a.role === "商户托管" ? "blue" : "violet"} dot={false}>{a.role}</Pill>
                    <span className="shrink-0 text-[10.5px] text-default-400">{a.dir}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-default-400">从该商户告警 sender / receiver 反推,作为商户<b>属性</b>展示(地址不另作主体)。<b>商户托管</b>=本方钱包,<b>交易对手</b>=入金来源 / 出金去向。高风险外部地址归 <b>名单管理</b> / 案件子主体。</p>
            </div>
          )}

          {related.length > 0 && (
            <div className="card p-4">
              <SectionLabel>关联主体 · 同团伙 / 同案</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {related.map((r) => (
                  <button key={r.name} onClick={() => nav(`/entity?name=${encodeURIComponent(r.name)}`)}
                    className="card-hover group flex items-center gap-2 rounded-lg border border-default-200 px-2.5 py-2 text-left">
                    <Pill tone={ENTITY_TONE[entityType(r.name)]} dot={false}>{entityType(r.name)}</Pill>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{r.name}</span>
                    <span className="shrink-0 text-[10.5px] text-default-400">{r.via}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-default-300 group-hover:text-brand" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card border-l-[3px] border-l-brand p-4">
            <SectionLabel>为什么要主体360</SectionLabel>
            <p className="text-[12px] leading-relaxed text-default-500">
              同一主体常被事中、事后、团伙、案件各自命中一次,分散在不同队列里看不全。这张视图按归一化键把它们聚到一起 —— 一眼看清该主体的全部敞口、是否已立案、有没有重复 STR,支撑「并案而非重复立案」的决策。
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-1.5"><span className="text-default-500">{label}</span><span className="text-right font-semibold">{children}</span></div>;
}

// ── 商户头像(确定性配色 + 缩写)──
const AV_COLORS = ["var(--brand)", "var(--violet)", "var(--success)", "var(--warning)", "#e1556d", "#0ea5e9", "#8b5cf6"];
function avHash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function initialsOf(name: string): string {
  const toks = name.replace(/[（(].*$/, "").trim().split(/[\s\-]+|(?<=[a-z])(?=[A-Z])/).filter(Boolean);
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
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {e.flow.key === "done" ? <span className="text-[12px] text-default-300">—</span> : <Pill tone={e.flow.tone}>{e.flow.label}</Pill>}
      {e.activeCases > 1 && <span title={`在办 ${e.activeCases} 个案件 · 可串并`} className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-bold" style={{ background: toneSoft("violet"), color: toneVar("violet") }}><GitMerge className="h-3 w-3" />{e.activeCases} 案</span>}
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
                    <Initials p={{ i: initialsOf(e.name), c: AV_COLORS[avHash(e.key) % AV_COLORS.length] }} size={38} />
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
