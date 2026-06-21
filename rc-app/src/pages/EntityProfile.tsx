import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button, Input } from "@heroui/react";
import { Fingerprint, Search, Bell, History, Network, FolderOpen, FileText, ArrowUpRight, ShieldAlert, Store, Link2, Layers } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, SoftChip, SectionLabel, Initials, RiskBadge, toneVar } from "@/components/bits";
import { directory, footprint, totalExposure, fmtCAD, entityType, ENTITY_TONE, caseStr, sameEntity, type EntityType } from "@/lib/entity360";
import { RC_STATES, type Tone } from "@/lib/data";
import { FSTATES, FDIM } from "@/lib/findings";
import { CSTATE, type CState } from "@/lib/cases";
import { RSTATE } from "@/lib/reports";
import { RING_STATES } from "@/lib/rings";
import { alertStore, useAlertVersion, findingStore, useFindingVersion, caseStore, useCaseVersion, reportStore, useReportVersion, ringStore, useRingVersion } from "@/lib/store";

const MOD_ICON: Record<string, typeof Bell> = { alerts: Bell, findings: History, rings: Network, cases: FolderOpen, reports: FileText };
const MOD_LABEL: Record<string, string> = { alerts: "告警", findings: "事后", rings: "团伙", cases: "案件", reports: "报送" };

// ── 模块覆盖点阵(目录 + 横幅共用)──
function ModDots({ on }: { on: Record<string, number> }) {
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

  // 关联主体 —— 同团伙成员 + 同案件涉案主体(去掉自己)
  const related = useMemo(() => {
    const set = new Map<string, { name: string; via: string }>();
    fp.rings.forEach((rh) => rh.ring.members.forEach((m) => { if (!sameEntity(m.name, name) && m.kind !== "群组") set.set(m.name, { name: m.name, via: `同团伙 ${rh.ring.id}` }); }));
    fp.cases.forEach((c) => (c.subjects || []).forEach((s) => { if (!sameEntity(s.name, name)) set.set(s.name, { name: s.name, via: `同案 ${c.id}` }); }));
    return [...set.values()].slice(0, 12);
  }, [fp, name]);

  return (
    <Shell crumb={["主体档案", name]} wide>
      <PageHead title={name} sub="跨模块主体360 · 一个主体在 事中 / 事后 / 告警 / 团伙 / 案件 / 报送 的全部足迹聚到一张视图,避免同主体被各模块割裂、重复立案。" actions={
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

// ── 主体目录(无 name 参数)──
function Directory() {
  useAlertVersion(); useFindingVersion(); useCaseVersion(); useRingVersion();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const all = useMemo(() => directory(), []);
  const list = all.filter((e) => !q.trim() || e.name.toLowerCase().includes(q.toLowerCase()));
  const crossMod = all.filter((e) => e.span >= 2).length;

  return (
    <Shell crumb={["主体档案"]} wide>
      <PageHead title="主体档案 · 360" sub="按归一化键聚合全站主体 —— 一个商户 / 地址在 告警 / 事后 / 团伙 / 案件 / 报送 的全部足迹。点任一主体进 360 视图。" />
      <div className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <Stat label="已识别主体" value={all.length} />
        <Stat label="跨 ≥2 模块" value={crossMod} tone="amber" />
        <Stat label="在办案件主体" value={all.filter((e) => e.cases > 0).length} tone="violet" />
        <div className="ml-auto w-full max-w-[280px]">
          <Input size="sm" radius="lg" placeholder="搜索主体名 / 地址" value={q} onValueChange={setQ}
            startContent={<Search className="h-4 w-4 text-default-400" />} classNames={{ inputWrapper: "bg-default-100 shadow-none" }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-default-100 text-[11px] font-bold uppercase tracking-wider text-default-400">
              <th className="px-4 py-2.5 text-left">主体</th>
              <th className="px-3 py-2.5 text-left">类型</th>
              <th className="px-3 py-2.5 text-left">模块覆盖</th>
              <th className="px-3 py-2.5 text-right">告警</th>
              <th className="px-3 py-2.5 text-right">事后</th>
              <th className="px-3 py-2.5 text-right">团伙</th>
              <th className="px-3 py-2.5 text-right">案件</th>
              <th className="px-3 py-2.5 text-right">报送</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.key} onClick={() => nav(`/entity?name=${encodeURIComponent(e.name)}`)}
                className="cursor-pointer border-b border-default-50 transition-colors hover:bg-default-50">
                <td className="px-4 py-3 font-semibold">{e.name}</td>
                <td className="px-3 py-3"><Pill tone={ENTITY_TONE[e.type as EntityType]} dot={false}>{e.type}</Pill></td>
                <td className="px-3 py-3"><div className="flex items-center gap-2"><ModDots on={e} /><span className="text-[11px] font-bold text-default-400">{e.span}/5</span></div></td>
                <td className="px-3 py-3 text-right tabular-nums">{e.alerts || "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums">{e.findings || "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums">{e.rings || "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums font-bold" style={e.cases ? { color: "var(--violet)" } : undefined}>{e.cases || "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums">{e.reports || "—"}</td>
                <td className="px-4 py-3 text-right"><ArrowUpRight className="ml-auto h-4 w-4 text-default-300" /></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-[12.5px] text-default-400">无匹配主体</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
