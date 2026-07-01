import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Select, SelectItem, Slider } from "@heroui/react";
import {
  Download, AlertTriangle, Clock, Snowflake, SendHorizontal, ShieldX,
  ArrowRight, CheckCircle2, Sparkles, TrendingUp, TrendingDown, SlidersHorizontal, Network, ChevronRight, Zap, BarChart3,
  Stamp, Users, ShieldCheck, User,
} from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { SectionLabel, Initials } from "@/components/bits";
import { LineChart, AnalystLoad } from "@/components/charts";
import { AnalystQueueDrawer } from "@/components/AnalystQueueDrawer";
import { queueHealth, DAYS14, QUEUE, type Analyst } from "@/lib/opsMetrics";
import { rings, RING_STATES, confTone, slaOfRing, type RingStateKey } from "@/lib/rings";
import { alerts, INVESTIGATION_STATES } from "@/lib/data";
import { CASES, CSTATE, type CState } from "@/lib/cases";
import { RSTATE } from "@/lib/reports";
import { allReports, liveStatus } from "@/lib/reportsAll";
import { RULES } from "@/lib/rules";
import { LISTS } from "@/lib/lists";
import {
  ringStore, useRingVersion, alertStore, useAlertVersion,
  caseStore, useCaseVersion, useReportVersion, listStore, useListVersion,
  ruleStore, useRuleVersion, useRoleVersion, roleStore, PERSONS,
} from "@/lib/store";

const BRAND = "var(--brand)";
const GREY = "var(--text-3)";
const ME = PERSONS.analyst;   // 一线分析师视角(James Liu)
const HEAD = PERSONS.head;    // 风控总管(兼 MLRO)视角(Emma Zhang)

// ── MSB business lines: every product the system runs, each with its own risk posture today ──
const LINES: { name: string; en: string; flow: string; vol: number; amt: string; alerts: number; pass: number; risk: "red" | "amber" | "green"; note: string; to: string }[] = [
  { name: "On-ramp · 法币买币", en: "On-ramp", flow: "法币 → 加密", vol: 3210, amt: "CAD 2.81M", alerts: 42, pass: 93.4, risk: "amber", note: "新用户首笔入金误报偏高", to: "/monitoring" },
  { name: "Off-ramp · 卖币出金", en: "Off-ramp", flow: "加密 → 法币", vol: 1107, amt: "CAD 1.94M", alerts: 28, pass: 92.1, risk: "amber", note: "提币地址与来源风险区背离", to: "/monitoring" },
  { name: "虚拟货币兑换 · 币币", en: "VC exchange", flow: "加密 ↔ 加密", vol: 2480, amt: "CAD 3.20M", alerts: 35, pass: 94.0, risk: "red", note: "链跳 / 隐私币兑换切断溯源", to: "/monitoring" },
  { name: "充值 · 入金", en: "Deposit", flow: "法币 / 加密 充入", vol: 4600, amt: "CAD 5.10M", alerts: 18, pass: 96.2, risk: "green", note: "整体低危,大额集中入金待观察", to: "/monitoring" },
  { name: "提现 · 出金", en: "Withdrawal", flow: "法币 / 加密 提出", vol: 2150, amt: "CAD 3.42M", alerts: 24, pass: 91.5, risk: "amber", note: "快进快出 / 过账提现", to: "/monitoring" },
];

// ── unified risk-processing funnel: every transaction across all lines passes these gates ──
const FLOW = {
  start: 13547, sanction: 64, hold: 712, auto: 12771, manualPass: 643, reqinfo: 47, reject: 22,
  releasedAmt: "CAD 16.5M", frozenAmt: "CAD 200K", frictionAmt: "CAD 117K",
};

// 14-day series for the two mandate charts
const D14 = {
  alerts: [96, 104, 99, 112, 108, 120, 116, 122, 118, 124, 120, 126, 121, 128],
  blocked: [14, 18, 16, 20, 17, 23, 19, 21, 18, 24, 20, 22, 19, 22],
  pass: [91.8, 92.1, 92.5, 92.3, 92.8, 93.0, 92.6, 93.2, 93.4, 93.1, 93.6, 93.5, 93.7, 93.9],
  fp: [34, 33.5, 33, 33.2, 32.5, 32, 32.4, 31.8, 31.5, 31.6, 31.2, 31.4, 31.1, 31],
};

const NETWORKS: { name: string; pct: number }[] = [
  { name: "ERC-20", pct: 64 },
  { name: "BTC", pct: 22 },
  { name: "TRC-20", pct: 11 },
  { name: "SOL", pct: 3 },
];

// 跨业务线的高风险交易信号 —— On/Off-ramp、兑换、充提共有的洗钱形态
const EXSIGNALS: { name: string; desc: string; n: number; amt: string; tone: "red" | "amber" | "blue" }[] = [
  { name: "快进快出 · 过账交易", desc: "入金后 <10min 兑换 / 提走,资金不留存", n: 18, amt: "CAD 96K", tone: "red" },
  { name: "法币侧 ↔ 链上去向背离", desc: "资金来源国与提币地址风险区域不匹配", n: 7, amt: "CAD 41K", tone: "amber" },
  { name: "币币链跳 · 隐私币", desc: "兑入隐私币 / 跨链(BTC→XMR)切断溯源", n: 11, amt: "CAD 52K", tone: "red" },
  { name: "异常价差 · 套利对敲", desc: "偏离市价的单边大额交易,疑似对敲", n: 5, amt: "CAD 23K", tone: "blue" },
];

const OPPS: { lever: string; evidence: string; uplift: string; cta: string; to: string; icon: typeof SlidersHorizontal }[] = [
  { lever: "收紧「新商户首充」规则条件", evidence: "误报率 26% · 全站最高 · 误伤合规交易约 CAD 33K/月", uplift: "FP 26%→16%,预计每月找回合规交易 ~CAD 18K · 首笔交易直通率 +9pt", cta: "去规则编辑器调优", to: "/rules", icon: SlidersHorizontal },
  { lever: "扩大「绿色通道」自动放行范围", evidence: "低危(评分<40)且来源为可信交易所热钱包的交易仍走人工", uplift: "纳入自动放行 → 直通率 +3.2pt · 人工工时 −15% · 好客户更快成交", cta: "配置全局策略", to: "/strategy", icon: Zap },
  { lever: "解除观察中团伙的误聚", evidence: "2 个正常商户因共享公共 IP 被弱关联聚入「观察中」", uplift: "判定误报 + 加白名单 → 减少正常交易被误拦 · 回流模型降噪", cta: "去团伙识别", to: "/rings", icon: Network },
];

// ── multi-series line chart with hover tooltip (vertical guide + per-series dot + value popover) ──
// one mandate as a chart panel: headline numbers (legend) + trend lines + a slim secondary strip
function Panel({ title, legend, series, foot, valueFmt }: {
  title: string;
  legend: { name: string; value: string; delta?: string; color: string }[];
  series: { data: number[]; color: string }[];
  foot: { label: string; value: string }[];
  valueFmt?: (n: number) => string;
}) {
  return (
    <div className="card p-5">
      <SectionLabel>{title}</SectionLabel>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        {legend.map((l) => (
          <div key={l.name}>
            <div className="flex items-center gap-1.5 text-[12px] text-default-500"><i className="h-2 w-2 rounded-full" style={{ background: l.color }} />{l.name}</div>
            <div className="mt-1 flex items-baseline gap-1.5"><span className="text-[24px] font-extrabold leading-none tnum">{l.value}</span>{l.delta && <span className="text-[11.5px] text-default-400">{l.delta}</span>}</div>
          </div>
        ))}
      </div>
      <div className="mt-3"><LineChart series={series.map((s, i) => ({ ...s, name: legend[i]?.name }))} labels={DAYS14} valueFmt={valueFmt} /></div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-divider pt-3">
        {foot.map((f) => (
          <div key={f.label}>
            <div className="text-[11px] leading-snug text-default-400">{f.label}</div>
            <div className="mt-0.5 text-[15px] font-bold tnum">{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stripe Radar–style risk score distribution: txns bucketed by score, shaded into
// review-threshold bands. Surfaces the conversion ↔ risk tradeoff of where to set thresholds.
// editable(总管):阈值双滑块可拖,实时重算三区占比 + 直通率;非 editable(分析师):只读。
const SD_BUCKETS = [760, 680, 520, 360, 240, 160, 110, 64, 30, 18]; // score 0–9 … 90–99
const SD_TOTAL = SD_BUCKETS.reduce((a, b) => a + b, 0);
const SD_MAX = Math.max(...SD_BUCKETS);
// 跨桶按比例插值:落在 [0,T) 的笔数(桶覆盖 [i*10, i*10+10))
const countBelow = (T: number) =>
  SD_BUCKETS.reduce((c, b, i) => { const lo = i * 10, hi = lo + 10; return c + (hi <= T ? b : lo >= T ? 0 : b * (T - lo) / 10); }, 0);

function ScoreDistribution({ editable = false }: { editable?: boolean }) {
  const [th, setTh] = useState<[number, number]>([40, 70]); // [自动放行阈值, 拦截阈值]
  const [t0, t1] = th;
  const autoN = countBelow(t0);
  const blockN = SD_TOTAL - countBelow(t1);
  const manualN = SD_TOTAL - autoN - blockN;
  const passRate = (autoN / SD_TOTAL) * 100;
  const basePass = (countBelow(40) / SD_TOTAL) * 100; // 基线阈值 40 的直通率,用于显示增量
  const passDelta = passRate - basePass;
  const zoneCol = { auto: "color-mix(in srgb, var(--brand) 30%, var(--track))", manual: "color-mix(in srgb, var(--brand) 62%, var(--track))", block: "var(--brand)" };
  const zoneOfMid = (i: number) => { const m = i * 10 + 5; return m < t0 ? "auto" : m < t1 ? "manual" : "block"; };
  const zones = [
    { k: "自动放行", range: `评分 < ${t0}`, n: autoN, col: zoneCol.auto },
    { k: "人工审核", range: `${t0} – ${t1}`, n: manualN, col: zoneCol.manual },
    { k: "拦截 · 升级", range: `≥ ${t1}`, n: blockN, col: zoneCol.block },
  ];
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><BarChart3 className="h-4 w-4" /></span>
          <div>
            <div className="text-[15px] font-bold">风险评分分布</div>
            <div className="text-[12px] text-default-400">今日全业务线交易按风险评分分桶 · {editable ? "拖动阈值即时预览放行 / 人工 / 拦截的变化" : "阈值决定放行 / 人工 / 拦截的分界"}</div>
          </div>
        </div>
        <span className="text-[11.5px] text-default-400 tnum">共 {SD_TOTAL.toLocaleString()} 笔</span>
      </div>

      {/* zone summary headers, widths proportional to current thresholds */}
      <div className="mt-4 flex gap-1.5">
        {zones.map((z, i) => (
          <div key={z.k} style={{ flex: Math.max(0.6, (i === 0 ? t0 : i === 1 ? t1 - t0 : 100 - t1)) }} className="min-w-0 text-[11px]">
            <div className="flex items-center gap-1 font-semibold text-default-600"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: z.col }} /><span className="truncate">{z.k}</span> <span className="tnum text-default-400">{((z.n / SD_TOTAL) * 100).toFixed(1)}%</span></div>
            <div className="truncate text-default-400">{z.range} · {Math.round(z.n).toLocaleString()} 笔</div>
          </div>
        ))}
      </div>

      {/* histogram + threshold guide lines */}
      <div className="relative mt-2 h-[140px]">
        <div className="flex h-full items-stretch gap-1.5">
          {SD_BUCKETS.map((b, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`评分 ${i * 10}–${i * 10 + 9} · ${b.toLocaleString()} 笔`}>
              <div className="w-full rounded-t-[3px] transition-colors" style={{ height: `${Math.max(2, (b / SD_MAX) * 100)}%`, background: zoneCol[zoneOfMid(i)] }} />
            </div>
          ))}
        </div>
        {[t0, t1].map((t, i) => (
          <div key={i} className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-default-400" style={{ left: `${t}%` }}>
            <span className="absolute -top-0.5 ml-1 rounded bg-default-100 px-1 text-[9px] font-bold text-default-500 tnum">{t}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9.5px] text-default-300 tnum"><span>0</span><span>50</span><span>100</span></div>

      {editable ? (
        <div className="mt-3 rounded-xl border border-divider bg-default-50 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-default-600"><SlidersHorizontal className="h-3.5 w-3.5 text-default-400" />调整阈值</span>
            <span className="text-[11px] text-default-400">自动放行 <b className="text-foreground tnum">{t0}</b> · 拦截 <b className="text-foreground tnum">{t1}</b></span>
          </div>
          <Slider aria-label="评分阈值" size="sm" minValue={0} maxValue={100} step={5} value={th}
            onChange={(v) => { if (Array.isArray(v)) setTh([Math.min(v[0], v[1] - 5), Math.max(v[1], v[0] + 5)] as [number, number]); }}
            classNames={{ track: "bg-default-200", filler: "bg-primary" }} />
          <p className="mt-2 text-[11.5px] leading-relaxed text-default-500">
            当前直通率 <b className="text-foreground tnum">{passRate.toFixed(1)}%</b>
            {Math.abs(passDelta) >= 0.05 && <> · 较基线(40)<b style={{ color: passDelta > 0 ? "var(--success)" : "var(--danger)" }}>{passDelta > 0 ? "+" : ""}{passDelta.toFixed(1)}pt</b>(约 {Math.abs(Math.round(autoN - countBelow(40))).toLocaleString()} 笔{passDelta > 0 ? "转直通" : "转人工"})</>}
            。阈值即转化与风险的权衡点 —— 放得越宽直通越多、敞口越大。
            <button onClick={() => setTh([40, 70])} className="ml-1 font-semibold text-primary hover:opacity-80">重置</button>
          </p>
        </div>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">
          <SlidersHorizontal className="mt-px h-3.5 w-3.5 shrink-0 text-default-400" />
          横轴 = 可疑评分(0–100),越往右越可疑;柱子 = 该分段交易笔数。当前自动放行阈值 <b className="text-foreground tnum">{t0}</b>、拦截阈值 <b className="text-foreground tnum">{t1}</b>,直通率 <b className="text-foreground tnum">{passRate.toFixed(1)}%</b>。阈值调整由风控总管在「全局策略」操作。
        </p>
      )}
    </div>
  );
}

function Funnel() {
  const d = FLOW;
  const passed = d.auto + d.manualPass;
  const blocked = d.sanction + d.reject;
  const autoRate = ((d.auto / d.start) * 100).toFixed(1);
  const passRate = ((passed / d.start) * 100).toFixed(1);
  const verb = "交易";
  const nodes = [
    { t: "① 交易发起", sub: "全业务线 · On/Off-ramp · 兑换 · 充提", n: d.start, drop: "今日全量" },
    { t: "② 制裁 / 名单筛查", sub: "OFAC / UN · 内部名单", n: d.start - d.sanction, drop: `−${d.sanction} 命中` },
    { t: "③ 规则引擎评分", sub: "风险评分 · 阈值分流", n: d.start - d.sanction - d.hold, drop: `−${d.hold} 暂缓转人工` },
    { t: "④ 自动放行", sub: "直通成交", n: d.auto, drop: `直通 ${autoRate}%`, hi: true },
  ];
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-bold">交易风控处置漏斗</div>
          <div className="text-[12px] text-default-400">全业务线交易经过的统一风险闸口与放行 / 拦截分布 · 今日全量</div>
        </div>
      </div>

      <div className="mt-4 flex items-stretch gap-1">
        {nodes.map((nd, i) => (
          <div key={i} className="flex flex-1 items-center gap-1">
            <div className={`flex-1 rounded-xl border p-3 text-center ${nd.hi ? "border-default-300 bg-default-50" : "border-divider"}`}>
              <div className="text-[13px] font-bold">{nd.t}</div>
              <div className="text-[10.5px] leading-tight text-default-400">{nd.sub}</div>
              <div className="mt-1 text-[20px] font-extrabold tnum">{nd.n.toLocaleString()}</div>
              <div className="mt-0.5 text-[11px] font-semibold text-default-400">{nd.drop}</div>
            </div>
            {i < nodes.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-default-300" />}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-default-400">每笔交易从左到右依次过闸口,逐级筛掉风险;数字一级级变小,最后「自动放行」占比就是<b className="text-default-500">直通率</b>。</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { k: "放行 · 成交", icon: CheckCircle2, big: `${passed.toLocaleString()} · ${passRate}%`, note: `自动放行 ${d.auto.toLocaleString()} + 人工放行 ${d.manualPass} · 交易额 ${d.releasedAmt}` },
          { k: "在途 / 摩擦", icon: Clock, big: `${d.reqinfo} 笔`, note: `补材料待客户 · 约 ${d.frictionAmt} 合规交易被延迟` },
          { k: "拦截", icon: ShieldX, big: `${blocked} 笔`, note: `制裁/名单 ${d.sanction} + 人工驳回 ${d.reject} · 冻结 ${d.frozenAmt}` },
        ].map((s) => (
          <div key={s.k} className="rounded-xl border border-divider p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-default-600"><s.icon className="h-3.5 w-3.5 text-default-400" />{s.k}</div>
            <div className="mt-1 text-[17px] font-extrabold tnum">{s.big}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-default-400">{s.note}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-default-500">
        风控的价值不止于拦下 <b className="text-foreground">{blocked}</b> 笔风险,更在于让 <b className="text-foreground">{passRate}%</b> 的合规{verb}安全、快速放行 —— 误报越低、暂缓越少,被误伤 / 延迟的好客户就越少。
      </p>
    </div>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const role = useRoleVersion(); // 全局操作员身份(与顶栏共享):分析师 ↔ 风控总管,切换全站联动
  const [sel, setSel] = useState<Analyst | null>(null); // 总管下钻:某分析师的队列
  const isHead = role === "head";
  const who = isHead ? HEAD : ME;
  // subscribe to every store so the dashboard reconciles live with the list pages
  useRingVersion(); useAlertVersion(); useCaseVersion(); useReportVersion(); useListVersion(); useRuleVersion();

  // ── 关联团伙 — live from ringStore ──
  const allRings = [...ringStore.created(), ...rings];
  const stOf = (id: string, base: string) => ringStore.stateOf(id, base) as RingStateKey;
  const ringPending = allRings.filter((r) => stOf(r.id, r.state) === "pending").length;
  const ringInvestigating = allRings.filter((r) => stOf(r.id, r.state) === "investigating").length;
  const ringHighConf = allRings.filter((r) => r.confidence >= 80).length;
  const topRings = [...allRings].sort((a, b) => b.confidence - a.confidence).slice(0, 3);

  // ── live cross-module aggregates (mirror each list page's own predicates so the numbers match) ──
  const allCases = [...caseStore.created(), ...CASES];
  const caseStOf = (c: typeof allCases[number]) => caseStore.stateOf(c.id, c.state) as CState;
  const reports = allReports();

  // 告警研判:调查车道里已超 SLA 的件(AlertList 同口径:INVESTIGATION_STATES + sla 红)
  const alertsOverSla = alerts.filter((a) => INVESTIGATION_STATES.includes(alertStore.stateOf(a.id, a.state)) && a.sla.color === "red").length;
  // 报告报送:待 MLRO 复核 + 被退回需补正(ReportFiling「需立即处理」同口径)
  const reportsNeedAction = reports.filter((r) => ["review", "returned"].includes(liveStatus(r))).length;
  // 案件管理:active 且未分配 = 待认领(CaseList 显「认领」的件)
  const casesToClaim = allCases.filter((c) => CSTATE[caseStOf(c)].active && !caseStore.ownerOf(c.id, c.owner)).length;

  // 需立即处理 — 团队级紧急,每项从 store 派生,零计数自动隐去。
  // role-aware:总管版只留「需我亲自介入、且未被专门卡片覆盖」的项 —— 报送已在「待我审批」、待认领已并入「团队负荷·待派单」,
  // 故总管横幅只保留团队 SLA 告急;分析师版为团队态势全量。
  const urgentBase: { n: number; label: string; icon: typeof Clock; to: string }[] = isHead
    ? [
        { n: alertsOverSla, label: `${alertsOverSla} 笔告警超 SLA · 团队需介入`, icon: Clock, to: "/alerts" },
      ]
    : [
        { n: alertsOverSla, label: `${alertsOverSla} 笔告警超 SLA`, icon: Clock, to: "/alerts" },
        { n: reportsNeedAction, label: `FINTRAC 报送待处理 ${reportsNeedAction} 件`, icon: SendHorizontal, to: "/reports" },
        { n: casesToClaim, label: `案件待认领 ${casesToClaim} 件`, icon: Snowflake, to: "/cases" },
        { n: ringPending, label: `待认领团伙 ${ringPending} 个`, icon: Network, to: "/rings" },
      ];
  const urgent = urgentBase.filter((u) => u.n > 0);
  const urgentClearMsg = isHead
    ? "团队暂无超时告警 —— 待审批见下方「待我审批」,待派单见「团队负荷」"
    : "需立即处理项已全部清空 —— 暂无超时告警、待报送或待认领";

  // ── 待我处理 — the current analyst's (我 = James Liu) personal queue, built from real records
  //    (assigned to me OR unassigned & claimable) so every item deep-links to a live detail page ──
  type Task = { kind: string; subject: string; meta: string; due: string; overdue?: boolean; to: string; icon: typeof Clock };
  const mine = (p?: { n: string } | null) => !p || p.n === ME.n; // 已分配给我 或 未分配(待认领)

  // 团伙:我拥有的、仍有未决处置的
  const myRings: Task[] = allRings
    .filter((r) => ringStore.ownerOf(r.id, r.owner)?.n === ME.n && ["pending", "investigating", "watching"].includes(stOf(r.id, r.state)))
    .map((r) => {
      const sla = slaOfRing(r, stOf(r.id, r.state));
      return {
        kind: "团伙", subject: r.name, meta: `${r.id} · ${r.members.length} 主体 · 置信 ${r.confidence}%`,
        due: sla?.text ?? "无时限", overdue: sla?.overdue ?? false, to: `/ring?id=${r.id}`, icon: Network,
      };
    });
  // 告警:未结案、归我 / 待认领,深链到真实告警
  const myAlerts: Task[] = alerts
    .filter((a) => !alertStore.stateOf(a.id, a.state).startsWith("closed") && mine(alertStore.assigneeOf(a.id, a.assignee)))
    .map((a) => ({
      kind: "告警", subject: `${a.merchant} · ${a.title}`, meta: `${a.id} · 评分 ${a.score} · 命中 ${a.rules.length} 规则`,
      due: a.sla.text, overdue: a.sla.color === "red", to: `/alert?id=${a.id}`,
      icon: a.sev === "high" ? AlertTriangle : Clock,
    }));
  // 案件:active、归我 / 待认领
  const myCases: Task[] = allCases
    .filter((c) => CSTATE[caseStOf(c)].active && mine(caseStore.ownerOf(c.id, c.owner)))
    .map((c) => ({
      kind: "案件", subject: `${c.subject} · ${c.type}`, meta: `${c.id} · ${c.amount} · ${CSTATE[caseStOf(c)].label}`,
      due: c.sla.text, overdue: c.sla.tone === "red", to: `/case?id=${c.id}`, icon: Snowflake,
    }));
  // 报送:active、由我起草,深链到真实报告
  const myReports: Task[] = reports
    .filter((r) => RSTATE[liveStatus(r)].active && r.officer.n === ME.n)
    .map((r) => ({
      kind: "报送", subject: `${r.type} · ${r.subject}`, meta: `${r.id} · ${RSTATE[liveStatus(r)].label}`,
      due: r.due.text, overdue: liveStatus(r) === "returned", to: `/report?id=${r.id}`, icon: SendHorizontal,
    }));
  const myTasks = [...myRings, ...myAlerts, ...myCases, ...myReports]
    .sort((a, b) => Number(b.overdue ?? false) - Number(a.overdue ?? false));
  const myOverdue = myTasks.filter((t) => t.overdue).length;

  // ── 待我审批(总管专属)—— 只有风控总管能拍板的决策,四类全部从真实 store 派生,与各自列表页同口径 ──
  const pendingRules = RULES.filter((r) => r.state === "pending");                                   // 规则:回测达标·提交审批
  const proposedChanges = ruleStore.allPending();                                                     // 规则:已上线规则的拟议变更(编辑→待审批)
  const ruleName = (id: string) => RULES.find((r) => r.id === id)?.name ?? id;
  const reviewReports = reports.filter((r) => liveStatus(r) === "review");                            // 报送:待 MLRO 复核签发
  const mlroCases = allCases.filter((c) => caseStOf(c) === "mlro");                                   // 案件:升级至 MLRO 评估
  const allLists = [...listStore.created(), ...LISTS];
  const pendingLists = allLists.filter((e) => listStore.statusOf(e.id, e.status) === "pending");      // 名单:待复核生效
  const approvals: { kind: string; subject: string; meta: string; icon: typeof Clock; to: string }[] = [
    ...proposedChanges.map((c) => ({ kind: "规则变更", subject: ruleName(c.id), meta: `${c.id} · ${c.summary} · ${c.by.n} 提交`, icon: SlidersHorizontal, to: `/rule?id=${c.id}` })),
    ...pendingRules.map((r) => ({ kind: "规则上线", subject: r.name, meta: `${r.id} · 回测 ${r.backtest?.estFp ?? "—"} · ${r.owner.n} 提交`, icon: SlidersHorizontal, to: `/rule?id=${r.id}` })),
    ...mlroCases.map((c) => ({ kind: "案件升级", subject: `${c.subject} · ${c.type}`, meta: `${c.id} · ${c.amount} · MLRO 评估`, icon: Snowflake, to: `/case?id=${c.id}` })),
    ...reviewReports.map((r) => ({ kind: "报送签发", subject: `${r.type} · ${r.subject}`, meta: `${r.id} · 待 MLRO 复核签发`, icon: SendHorizontal, to: `/report?id=${r.id}` })),
    ...pendingLists.map((e) => ({ kind: "名单复核", subject: `${e.value} · ${e.risk}`, meta: `${e.id} · 复核后纳入事中筛查`, icon: ShieldCheck, to: `/list-entry?id=${e.id}` })),
  ];
  // 团队负荷(总管):超载人数 + 待派单(待认领的件,需总管分配)
  const teamOver = QUEUE.analysts.filter((a) => a.open > a.cap).length;
  const unassignedAlerts = alerts.filter((a) => !alertStore.stateOf(a.id, a.state).startsWith("closed") && !alertStore.assigneeOf(a.id, a.assignee)).length;
  const toAssign = unassignedAlerts + casesToClaim + ringPending;

  // ── Top 命中规则 — derived from the live rule library (/rules), sorted by 30-day hits ──
  const fpNum = (s: string) => parseInt(s, 10) || 0;
  const dispOf = (action: string) => { const parts = action.split("·").map((s) => s.trim()).filter(Boolean); return parts.length > 1 ? parts[parts.length - 1] : action.includes("拦截") ? "拦截" : "评分"; };
  const liveRules = RULES.filter((r) => r.state === "live");
  const topRules = [...liveRules].sort((a, b) => b.hits30 - a.hits30).slice(0, 4);
  const worstFp = [...liveRules].sort((a, b) => fpNum(b.fp30) - fpNum(a.fp30))[0];

  return (
    <Shell crumb={["风控", "风控仪表盘"]} wide>
      <PageHead
        title="MSB 风控仪表盘"
        sub="全业务线风险总览 · 覆盖 On-ramp · Off-ramp · 虚拟货币兑换 · 充值 · 提现 · 风控的目标不止拦下风险,更在于在风险敞口可控的前提下,让合规交易放得更多、更快、误伤更少 —— 把风控做成增长引擎。"
        actions={
          <>
            {/* 演示态角色切换 —— 同一仪表盘按角色换内容 */}
            <div className="flex items-center rounded-full bg-default-100 p-0.5 text-[12.5px] font-semibold">
              {([["analyst", "分析师", User], ["head", "风控总管", ShieldCheck]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => roleStore.set(k)} aria-pressed={role === k}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${role === k ? "bg-content1 text-foreground shadow-soft" : "text-default-500 hover:text-default-700"}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
            <Select aria-label="时间范围" size="sm" radius="full" defaultSelectedKeys={["today"]} className="w-[120px]"
              classNames={{ trigger: "bg-default-100 shadow-none h-9 min-h-9" }}>
              <SelectItem key="today">今日</SelectItem>
              <SelectItem key="7d">近 7 日</SelectItem>
              <SelectItem key="30d">近 30 日</SelectItem>
            </Select>
            <Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<Download className="h-3.5 w-3.5" />}>导出</Button>
          </>
        }
      />

      {/* 职责分工条 —— 当前视角是谁、能做什么(随角色切换) */}
      <div className="card mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-[3px] border-l-default-200 p-3.5 pl-4">
        <Initials p={who} size={28} />
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-bold">{who.n}</span>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--track)", color: "var(--text-2)" }}>{isHead ? "风控总管 · 兼 MLRO" : "一线分析师"}</span>
        </div>
        <span className="text-[12px] leading-snug text-default-500">
          {isHead
            ? "职责:团队派单与负荷管理 · 决策审批(规则上线 · 案件升级 MLRO 评估 · STR 复核签发 · 名单复核生效)· 规则与策略调整。可改派他人、调阈值、批规则、签报告、批名单。"
            : "职责:研判归我 / 待认领的告警 · 案件 · 报送。团队风险态势可见,规则与策略仅供查看(只读,变更需总管审批)。"}
        </span>
      </div>


      {/* 需立即处理 — single red accent for urgency; green & calm when the queue is clear */}
      <div className="card mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-[3px] p-3.5 pl-4" style={{ borderLeftColor: urgent.length ? "var(--danger)" : "var(--success)" }}>
        {urgent.length ? (
          <>
            <span className="flex items-center gap-1.5 text-[13px] font-bold"><AlertTriangle className="h-4 w-4 text-danger" />需立即处理</span>
            {urgent.map((u) => (
              <button key={u.label} onClick={() => nav(u.to)} className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-2.5 py-1 text-[12px] font-semibold text-default-600 transition-colors hover:bg-default-200">
                <u.icon className="h-3.5 w-3.5 text-default-400" />{u.label}<ChevronRight className="h-3 w-3 text-default-400" />
              </button>
            ))}
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-default-600"><CheckCircle2 className="h-4 w-4 text-success" />{urgentClearMsg}</span>
        )}
      </div>

      {/* 待我审批 —— 总管专属:只有风控总管能拍板的决策(规则上线 / 报送签发) */}
      {isHead && (
        <div className="card mb-5 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><Stamp className="h-4 w-4" /></span>
              <span className="text-[15px] font-bold">待我审批</span>
              <span className="rounded-full bg-default-100 px-2 py-0.5 text-[11.5px] font-semibold text-default-500 tnum">{approvals.length} 项待决策</span>
            </div>
            <span className="text-[11.5px] text-default-400">仅风控总管可处理 —— 分析师看不到此卡</span>
          </div>
          {approvals.length ? (
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {approvals.map((a, i) => (
                <button key={i} onClick={() => nav(a.to)} className="flex items-center gap-2.5 rounded-xl border border-divider p-2.5 text-left transition-colors hover:bg-default-50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-default-100 text-default-500"><a.icon className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--track)", color: "var(--text-2)" }}>{a.kind}</span>
                      <span className="truncate text-[12.5px] font-semibold">{a.subject}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-default-400">{a.meta}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-default-300" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-default-600"><CheckCircle2 className="h-4 w-4 text-success" />暂无待审批事项 —— 规则变更与报送均已处理</div>
          )}
        </div>
      )}

      {/* 业务线风控总览 — every MSB business line at a glance (the headline of an all-business dashboard) */}
      <div className="card mb-5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold">业务线风控总览</div>
            <div className="text-[12px] text-default-400">MSB 各业务线今日交易量、风险敞口与直通率 · 点击进入对应业务监控</div>
          </div>
          <button onClick={() => nav("/monitoring")} className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-primary hover:opacity-80">实时监控 <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr className="border-b border-divider text-[11.5px] text-default-400">
              <th className="pb-2 text-left font-medium">业务线</th><th className="pb-2 text-left font-medium">资金流向</th>
              <th className="pb-2 text-right font-medium">今日笔数</th><th className="pb-2 text-right font-medium">金额</th>
              <th className="pb-2 text-right font-medium">告警</th><th className="pb-2 text-right font-medium">直通率</th>
              <th className="pb-2 pl-6 text-left font-medium">关键风险</th>
            </tr></thead>
            <tbody>
              {LINES.map((l) => (
                <tr key={l.en} className="cursor-pointer border-b border-default-100 transition-colors last:border-0 hover:bg-default-50" onClick={() => nav(l.to)}>
                  <td className="py-2.5"><span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap"><span className="h-1.5 w-1.5 rounded-full" style={{ background: l.risk === "red" ? "var(--danger)" : l.risk === "amber" ? "var(--warning)" : "var(--success)" }} />{l.name}</span></td>
                  <td className="py-2.5 text-default-500 whitespace-nowrap">{l.flow}</td>
                  <td className="py-2.5 text-right tnum text-default-600">{l.vol.toLocaleString()}</td>
                  <td className="py-2.5 text-right tnum font-semibold">{l.amt}</td>
                  <td className="py-2.5 text-right tnum text-default-600">{l.alerts}</td>
                  <td className="py-2.5 text-right tnum font-semibold" style={l.pass < 92 ? { color: "var(--danger)" } : undefined}>{l.pass}%</td>
                  <td className="py-2.5 pl-6 text-default-400">{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* dual mandate — two chart panels instead of tiled KPI cards */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="风险防御 · 拦下风险"
          legend={[
            { name: "今日告警", value: "128", delta: "↑ 12% · 24 待认领", color: BRAND },
            { name: "命中拦截", value: "22", delta: "制裁 / 名单", color: GREY },
          ]}
          series={[{ data: D14.alerts, color: BRAND }, { data: D14.blocked, color: GREY }]}
          foot={[
            { label: "冻结资金 · 6 笔待处置", value: "CAD 142K" },
            { label: "升级报送 · FINTRAC 临期 2", value: "5 件" },
          ]}
        />
        <Panel
          title="业务转化 · 放行价值"
          legend={[
            { name: "直通放行率", value: "93.9%", delta: "↑ 1.4pt", color: BRAND },
            { name: "误报率", value: "31%", delta: "误伤来源", color: GREY },
          ]}
          series={[{ data: D14.pass, color: BRAND }, { data: D14.fp, color: GREY }]}
          valueFmt={(v) => `${v}%`}
          foot={[
            { label: "交易放行额 · 今日成交", value: "CAD 16.5M" },
            { label: "平均放行时效 · ↓ 18%", value: "6.2 min" },
          ]}
        />
      </div>

      {/* 个人队列(分析师)/ 团队负荷(总管)beside the risk-score distribution */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {isHead ? (
          /* 团队负荷概览 + 下钻 —— 总管的派单视角,取代分析师的「待我处理」 */
          <div className="card flex flex-col p-5 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><Users className="h-4 w-4" /></span>
                <span className="text-[15px] font-bold">团队负荷</span>
                <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold tnum" style={teamOver > 0 ? { background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" } : { background: "color-mix(in srgb, var(--foreground) 8%, transparent)", color: "var(--text-3)" }}>{teamOver} 人超载 · 待派单 {toAssign}</span>
              </div>
              <button onClick={() => nav("/ops")} className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-primary hover:opacity-80">运营总览 <ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex-1">
              <AnalystLoad analysts={QUEUE.analysts} onSelect={setSel} />
            </div>
            <p className="mt-3 text-[10.5px] leading-snug text-default-400">点任意柱 → 查看该分析师手头的件,把超载的人的活儿<b>改派</b>给有余力的同事。</p>
          </div>
        ) : (
          /* 待我处理(个人队列)—— 分析师视角 */
          <div className="card flex flex-col p-5 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Initials p={ME} size={24} />
                <span className="text-[15px] font-bold">待我处理</span>
                <span className="rounded-full bg-default-100 px-2 py-0.5 text-[11.5px] font-semibold text-default-500 tnum">{myTasks.length} 项{myOverdue > 0 ? ` · ${myOverdue} 超时` : ""}</span>
              </div>
              <button onClick={() => nav("/alerts")} className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-primary hover:opacity-80">我的工作台 <ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {myTasks.map((t, i) => (
                <button key={i} onClick={() => nav(t.to)} className="flex items-center gap-2.5 rounded-xl border border-divider p-2.5 text-left transition-colors hover:bg-default-50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-default-100 text-default-500"><t.icon className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-default-100 px-1.5 py-0.5 text-[10px] font-bold text-default-500">{t.kind}</span>
                      <span className="truncate text-[12.5px] font-semibold">{t.subject}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-default-400">{t.meta}</div>
                  </div>
                  <span className="shrink-0 text-[11.5px] font-semibold tnum" style={{ color: t.overdue ? "var(--danger)" : "var(--text-3)" }}>{t.due}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="lg:col-span-7"><ScoreDistribution editable={isHead} /></div>
      </div>

      {/* 告警队列健康度 — 一行摘要(完整图表见运营总览 /ops) */}
      {(() => {
        const h = queueHealth();
        const toneC = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : "var(--success)");
        const slaTone = h.sla >= 95 ? "green" : h.sla >= 90 ? "amber" : "red";
        const cells = [
          { k: "待处理积压", v: `${h.open}`, sub: `今日净 ${h.net > 0 ? "−" : "+"}${Math.abs(h.net)} · ${h.net > 0 ? "队列在消" : "队列在涨"}`, subTone: h.net > 0 ? "green" : "red" },
          { k: "SLA 达成率", v: `${h.sla}%`, sub: "目标 95%", subTone: slaTone },
          { k: "平均处理时长", v: h.mttr, sub: "MTTR", subTone: "green" },
          { k: "超 SLA 待处理", v: `${h.overSla} 件`, sub: "需优先清理", subTone: h.overSla > 0 ? "red" : "green" },
          { k: "团队负荷", v: `${h.teamOver}/${h.teamN}`, sub: h.teamOver > 0 ? "人忙不过来" : "全员有余力", subTone: h.teamOver > 0 ? "amber" : "green" },
        ];
        return (
          <button onClick={() => nav("/ops")} className="card mb-5 block w-full p-5 text-left transition-colors hover:border-default-300">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="text-[15px] font-bold">告警队列健康度</div>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: `color-mix(in srgb, ${toneC(h.status.tone)} 14%, transparent)`, color: toneC(h.status.tone) }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneC(h.status.tone) }} />{h.status.label}
                </span>
              </div>
              <span className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-primary">运营总览 <ArrowRight className="h-3.5 w-3.5" /></span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {cells.map((m) => (
                <div key={m.k} className="rounded-xl border border-divider p-3">
                  <div className="text-[11.5px] text-default-500">{m.k}</div>
                  <div className="mt-1 text-[22px] font-extrabold leading-none tnum">{m.v}</div>
                  <div className="mt-1.5 text-[11px] font-semibold" style={{ color: toneC(m.subTone) }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </button>
        );
      })()}

      {/* lifecycle funnel */}
      <div className="mb-5"><Funnel /></div>

      {/* 收入提升机会 — prescriptive: where to optimize → how much revenue recovered */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><Sparkles className="h-4 w-4" /></span>
            <div>
              <div className="text-[15px] font-bold">收入提升机会 · 系统建议</div>
              <div className="text-[12px] text-default-400">系统从误报、摩擦与误聚中抓取关键优化点,量化规则调优可找回的合规收入</div>
            </div>
          </div>
          <span className="rounded-full bg-default-100 px-2.5 py-1 text-[11.5px] font-semibold text-default-600">预计合计 +CAD 18K/月 · 直通率 +12.2pt</span>
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          {OPPS.map((o, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-divider p-3.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-default-100 text-[11px] font-bold text-default-500">{i + 1}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default-100 text-default-500"><o.icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold">{o.lever}</div>
                <div className="mt-0.5 text-[11.5px] text-default-400">{o.evidence}</div>
                <div className="mt-1 flex items-start gap-1.5 text-[12px] font-semibold text-default-600"><TrendingUp className="mt-px h-3.5 w-3.5 shrink-0 text-default-400" />{o.uplift}</div>
              </div>
              <Button size="sm" variant="flat" className="bg-default-100" endContent={<ArrowRight className="h-3.5 w-3.5" />} onPress={() => nav(o.to)}>{o.cta}</Button>
            </div>
          ))}
        </div>
      </div>

      {/* top rules + ring overview */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15px] font-bold">Top 命中规则</div>
            <button onClick={() => nav("/rules")} className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-primary hover:opacity-80">规则列表 <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
          <table className="w-full text-[12.5px]">
            <thead><tr className="border-b border-divider text-[11.5px] text-default-400">
              <th className="pb-2 text-left font-medium">规则</th><th className="pb-2 text-right font-medium">近30天命中</th>
              <th className="pb-2 text-right font-medium">误报率</th><th className="pb-2 text-right font-medium">命中处置</th>
            </tr></thead>
            <tbody>
              {topRules.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-default-100 transition-colors last:border-0 hover:bg-default-50" onClick={() => nav(`/rule?id=${r.id}`)}>
                  <td className="py-2.5 font-semibold">{r.name}</td>
                  <td className="py-2.5 text-right tnum text-default-600">{r.hits30}</td>
                  <td className="py-2.5 text-right tnum font-semibold" style={fpNum(r.fp30) >= 20 ? { color: "var(--danger)" } : undefined}>{r.fp30}</td>
                  <td className="py-2.5 text-right"><span className="rounded-md bg-default-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-default-500">{dispOf(r.action)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {worstFp && (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">
              <TrendingDown className="mt-px h-3.5 w-3.5 shrink-0 text-default-400" />「{worstFp.name}」误报 {worstFp.fp30} 最高 —— 收紧条件,预计每月找回合规交易 ~CAD 18K,把降噪变成创收。
            </p>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15px] font-bold">关联团伙概览</div>
            <button onClick={() => nav("/rings")} className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-primary hover:opacity-80">团伙识别 <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "待认领", v: ringPending },
              { k: "调查中", v: ringInvestigating },
              { k: "高置信", v: ringHighConf },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-divider p-3 text-center">
                <div className="text-[22px] font-extrabold tnum">{s.v}</div>
                <div className="mt-0.5 text-[11.5px] text-default-500">{s.k}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {topRings.map((r) => {
              const st = stOf(r.id, r.state);
              const ct = confTone(r.confidence);
              return (
                <button key={r.id} onClick={() => nav(`/ring?id=${r.id}`)} className="flex items-center gap-2.5 rounded-xl border border-divider p-2.5 text-left transition-colors hover:bg-default-50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-default-100 text-default-500"><Network className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">{r.name}</div>
                    <div className="text-[11px] text-default-400">{r.id} · {r.members.length} 主体 · {r.typology}</div>
                  </div>
                  <span className="tnum shrink-0 text-[12.5px] font-bold" style={{ color: ct === "red" ? "var(--danger)" : ct === "amber" ? "var(--warning)" : "var(--text-2)" }}>{r.confidence}%</span>
                  <span className="shrink-0 rounded-md bg-default-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-default-500">{RING_STATES[st].label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* exchange-specific risk signals beside chain distribution */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><Zap className="h-4 w-4" /></span>
            <div>
              <div className="text-[15px] font-bold">高风险交易信号</div>
              <div className="text-[12px] text-default-400">跨业务线(On/Off-ramp · 兑换 · 充提)的可疑洗钱形态</div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {EXSIGNALS.map((s) => (
              <div key={s.name} className="flex items-center gap-3 rounded-xl border border-divider p-3">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.tone === "red" ? "var(--danger)" : s.tone === "amber" ? "var(--warning)" : "var(--text-3)" }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{s.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-default-400">{s.desc}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[15px] font-extrabold tnum leading-none">{s.n} 笔</div>
                  <div className="mt-0.5 text-[11px] text-default-400 tnum">{s.amt}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-[15px] font-bold">链网络风险分布</div><div className="text-[12px] text-default-400">充提 / 兑换 链上交易按公链统计</div></div>
          </div>
          <div className="mt-3 flex flex-col">
            {NETWORKS.map((nw) => (
              <div key={nw.name} title={`${nw.name} · 占比 ${nw.pct}%`} className="flex items-center gap-3 border-b border-divider py-2.5 last:border-0">
                <span className="flex w-[88px] shrink-0 items-center gap-1.5 text-[12px] font-semibold">{nw.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-default-100"><div className="h-full rounded-full" style={{ width: `${nw.pct}%`, background: "var(--brand)" }} /></div>
                <span className="tnum w-10 text-right text-[12.5px] font-bold">{nw.pct}%</span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">
            <TrendingUp className="mt-px h-3.5 w-3.5 shrink-0 text-default-400" />ERC-20 混币器关联占比最高,建议加强该网络链上交易的溯源规则权重。
          </p>
        </div>
      </div>

      {/* 总管下钻:某分析师的队列 + 改派 */}
      <AnalystQueueDrawer analyst={sel} open={!!sel} onOpenChange={(o) => { if (!o) setSel(null); }} />
    </Shell>
  );
}
