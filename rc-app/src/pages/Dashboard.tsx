import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button, Select, SelectItem } from "@heroui/react";
import {
  Download, AlertTriangle, Clock, Snowflake, SendHorizontal, ShieldX,
  ArrowRight, CheckCircle2, Sparkles, TrendingUp, TrendingDown, SlidersHorizontal, Network, ChevronRight, Zap, BarChart3,
} from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { SectionLabel, Initials } from "@/components/bits";
import { PipelineMap } from "@/components/PipelineMap";
import { rings, RING_STATES, confTone, type RingStateKey } from "@/lib/rings";
import { ringStore, useRingVersion } from "@/lib/store";

const BRAND = "var(--brand)";
const GREY = "var(--text-3)";
const ME = { i: "JL", n: "James Liu", c: "var(--brand)" };
const DAYS14 = ["13日前", "12日前", "11日前", "10日前", "9日前", "8日前", "7日前", "6日前", "5日前", "4日前", "3日前", "前天", "昨天", "今日"];

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

// ── alert-queue health: the daily ops pulse an analyst opens first (backlog · aging · burn-down · load) ──
const QUEUE = {
  open: 218, newToday: 128, clearedToday: 141, // cleared > new ⇒ backlog shrinking by 13
  sla: 94.5, slaDelta: "+1.2pt", mttr: "4.2h", mttrDelta: "−0.5h", // SLA 达成率 · 平均处理时长(MTTR)
  trend: { // 14-day burn-down: daily inflow vs outflow
    newD: [120, 132, 118, 126, 122, 130, 125, 119, 128, 124, 131, 121, 126, 128],
    clearedD: [112, 120, 124, 118, 128, 122, 130, 126, 133, 129, 138, 132, 140, 141],
  },
  aging: [ // sums to open (218)
    { k: "0–4h", n: 96, over: false },
    { k: "4–24h", n: 74, over: false },
    { k: "1–3d", n: 36, over: false },
    { k: "超 SLA", n: 12, over: true },
  ],
  analysts: [ // open caseload vs target capacity (sorted in the UI; supports many)
    { p: { i: "SC", n: "Sarah Chen", c: "var(--violet)" }, open: 52, cap: 45 },
    { p: { i: "RA", n: "Raj Anand", c: "#0ea5e9" }, open: 49, cap: 45 },
    { p: { i: "AL", n: "Ana Lopez", c: "var(--brand)" }, open: 47, cap: 45 },
    { p: { i: "BT", n: "Bo Tan", c: "var(--success)" }, open: 46, cap: 45 },
    { p: { i: "JL", n: "James Liu", c: "var(--brand)" }, open: 44, cap: 45 },
    { p: { i: "MK", n: "Mae Koh", c: "var(--success)" }, open: 41, cap: 45 },
    { p: { i: "CY", n: "Chen Yu", c: "var(--violet)" }, open: 39, cap: 45 },
    { p: { i: "DN", n: "Dia Naidu", c: "#0ea5e9" }, open: 38, cap: 45 },
    { p: { i: "EM", n: "Eli Moss", c: "var(--brand)" }, open: 36, cap: 45 },
    { p: { i: "FK", n: "Fay Kim", c: "var(--success)" }, open: 34, cap: 45 },
    { p: { i: "GP", n: "Gus Park", c: "var(--violet)" }, open: 32, cap: 45 },
    { p: { i: "HW", n: "Hana Wu", c: "#0ea5e9" }, open: 30, cap: 45 },
    { p: { i: "IV", n: "Ivo Reyes", c: "var(--brand)" }, open: 28, cap: 45 },
    { p: { i: "JX", n: "Jo Xu", c: "var(--success)" }, open: 26, cap: 45 },
    { p: { i: "KO", n: "Kit Ono", c: "var(--violet)" }, open: 24, cap: 45 },
    { p: { i: "LZ", n: "Lev Zane", c: "#0ea5e9" }, open: 22, cap: 45 },
  ],
};

// 14-day series for the two mandate charts
const D14 = {
  alerts: [96, 104, 99, 112, 108, 120, 116, 122, 118, 124, 120, 126, 121, 128],
  blocked: [14, 18, 16, 20, 17, 23, 19, 21, 18, 24, 20, 22, 19, 22],
  pass: [91.8, 92.1, 92.5, 92.3, 92.8, 93.0, 92.6, 93.2, 93.4, 93.1, 93.6, 93.5, 93.7, 93.9],
  fp: [34, 33.5, 33, 33.2, 32.5, 32, 32.4, 31.8, 31.5, 31.6, 31.2, 31.4, 31.1, 31],
};

const NETWORKS: { sym: string; name: string; pct: number }[] = [
  { sym: "◈", name: "ERC-20", pct: 64 },
  { sym: "₿", name: "BTC", pct: 22 },
  { sym: "◎", name: "TRC-20", pct: 11 },
  { sym: "◎", name: "SOL", pct: 3 },
];

// 跨业务线的高风险交易信号 —— On/Off-ramp、兑换、充提共有的洗钱形态
const EXSIGNALS: { name: string; desc: string; n: number; amt: string; tone: "red" | "amber" | "blue" }[] = [
  { name: "快进快出 · 过账交易", desc: "入金后 <10min 兑换 / 提走,资金不留存", n: 18, amt: "CAD 96K", tone: "red" },
  { name: "法币侧 ↔ 链上去向背离", desc: "资金来源国与提币地址风险区域不匹配", n: 7, amt: "CAD 41K", tone: "amber" },
  { name: "币币链跳 · 隐私币", desc: "兑入隐私币 / 跨链(BTC→XMR)切断溯源", n: 11, amt: "CAD 52K", tone: "red" },
  { name: "异常价差 · 套利对敲", desc: "偏离市价的单边大额交易,疑似对敲", n: 5, amt: "CAD 23K", tone: "blue" },
];

const RULES: { name: string; hit: number; fp: number; leak: string; disp: string }[] = [
  { name: "大额交易监控", hit: 312, fp: 38, leak: "CAD 41K", disp: "暂缓" },
  { name: "新用户首笔交易", hit: 158, fp: 52, leak: "CAD 33K", disp: "人工" },
  { name: "高频拆分交易", hit: 96, fp: 19, leak: "CAD 9K", disp: "补材料" },
  { name: "混币器来源关联", hit: 47, fp: 4, leak: "CAD 1K", disp: "冻结+升级" },
];

const OPPS: { lever: string; evidence: string; uplift: string; cta: string; to: string; icon: typeof SlidersHorizontal }[] = [
  { lever: "收紧「新用户首笔交易」规则条件", evidence: "误报率 52% · 全站最高 · 误伤合规交易约 CAD 33K/月", uplift: "FP 52%→30%,预计每月找回合规交易 ~CAD 18K · 首笔交易直通率 +9pt", cta: "去规则编辑器调优", to: "/rules", icon: SlidersHorizontal },
  { lever: "扩大「绿色通道」自动放行范围", evidence: "低危(评分<40)且来源为可信交易所热钱包的交易仍走人工", uplift: "纳入自动放行 → 直通率 +3.2pt · 人工工时 −15% · 好客户更快成交", cta: "配置全局策略", to: "/strategy", icon: Zap },
  { lever: "解除观察中团伙的误聚", evidence: "2 个正常商户因共享公共 IP 被弱关联聚入「观察中」", uplift: "判定误报 + 加白名单 → 减少正常交易被误拦 · 回流模型降噪", cta: "去团伙识别", to: "/rings", icon: Network },
];

// ── multi-series line chart with hover tooltip (vertical guide + per-series dot + value popover) ──
function LineChart({ series, labels, valueFmt }: { series: { data: number[]; color: string; name?: string }[]; labels?: string[]; valueFmt?: (n: number) => string }) {
  const W = 320, H = 124, padT = 8, padB = 16;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all), min = Math.min(...all), rng = max - min || 1;
  const n = series[0].data.length;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => padT + (1 - (v - min) / rng) * (H - padT - padB);
  const yPct = (v: number) => (y(v) / H) * 100;
  const xPct = (i: number) => (i / (n - 1)) * 100;
  const fmt = valueFmt ?? ((v: number) => `${v}`);
  const grid = [0, 0.5, 1];
  const [hi, setHi] = useState<number | null>(null);
  return (
    <div className="relative w-full" style={{ height: H }}
      onMouseLeave={() => setHi(null)}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const f = (e.clientX - r.left) / r.width; setHi(Math.max(0, Math.min(n - 1, Math.round(f * (n - 1))))); }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
        {grid.map((g) => { const gy = padT + g * (H - padT - padB); return <line key={g} x1={0} x2={W} y1={gy} y2={gy} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />; })}
        {series.map((s, si) => {
          const line = s.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          const li = s.data.length - 1;
          return (
            <g key={si}>
              {si === 0 && <polygon points={`0,${H - padB} ${line} ${W},${H - padB}`} fill={s.color} opacity={0.07} />}
              <polyline points={line} fill="none" stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <circle cx={x(li)} cy={y(s.data[li])} r={2.6} fill={s.color} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
      {hi !== null && (
        <>
          <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-default-300" style={{ left: `${xPct(hi)}%` }} />
          {series.map((s, si) => (
            <div key={si} className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-content1" style={{ left: `${xPct(hi)}%`, top: `${yPct(s.data[hi])}%`, background: s.color }} />
          ))}
          <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-divider bg-content1 px-2 py-1 shadow-soft" style={{ left: `${Math.min(82, Math.max(18, xPct(hi)))}%` }}>
            {labels && <div className="mb-0.5 text-[10px] font-semibold text-default-500">{labels[hi]}</div>}
            {series.map((s, si) => (
              <div key={si} className="flex items-center gap-1.5 whitespace-nowrap text-[10.5px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.name && <span className="text-default-400">{s.name}</span>}
                <span className="font-bold tnum">{fmt(s.data[hi])}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
function ScoreDistribution() {
  const buckets = [760, 680, 520, 360, 240, 160, 110, 64, 30, 18]; // score 0–9 … 90–99
  const total = buckets.reduce((a, b) => a + b, 0);
  const max = Math.max(...buckets);
  const zoneOf = (i: number) => (i < 4 ? "auto" : i < 7 ? "manual" : "block");
  const zoneCol: Record<string, string> = {
    auto: "color-mix(in srgb, var(--brand) 30%, var(--track))",
    manual: "color-mix(in srgb, var(--brand) 62%, var(--track))",
    block: "var(--brand)",
  };
  const sum = (lo: number, hi: number) => buckets.slice(lo, hi).reduce((a, b) => a + b, 0);
  const zones = [
    { k: "自动放行", range: "评分 < 40", n: sum(0, 4), flex: 4 },
    { k: "人工审核", range: "40 – 70", n: sum(4, 7), flex: 3 },
    { k: "拦截 · 升级", range: "≥ 70", n: sum(7, 10), flex: 3 },
  ];
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><BarChart3 className="h-4 w-4" /></span>
          <div>
            <div className="text-[15px] font-bold">风险评分分布</div>
            <div className="text-[12px] text-default-400">今日全业务线交易按风险评分分桶 · 阈值决定放行 / 人工 / 拦截的分界</div>
          </div>
        </div>
        <span className="text-[11.5px] text-default-400 tnum">共 {total.toLocaleString()} 笔</span>
      </div>

      {/* zone summary headers, widths proportional to score range */}
      <div className="mt-4 flex gap-1.5">
        {zones.map((z) => (
          <div key={z.k} style={{ flex: z.flex }} className="text-[11px]">
            <div className="font-semibold text-default-600">{z.k} <span className="tnum text-default-400">{((z.n / total) * 100).toFixed(1)}%</span></div>
            <div className="text-default-400">{z.range} · {z.n.toLocaleString()} 笔</div>
          </div>
        ))}
      </div>

      {/* histogram */}
      <div className="mt-2 flex h-[140px] items-stretch gap-1.5">
        {buckets.map((b, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`评分 ${i * 10}–${i * 10 + 9} · ${b.toLocaleString()} 笔`}>
            <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(2, (b / max) * 100)}%`, background: zoneCol[zoneOf(i)] }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9.5px] text-default-300 tnum"><span>0</span><span>40</span><span>70</span><span>100</span></div>
      <p className="mt-2 text-[10.5px] leading-snug text-default-400">横轴 = 可疑评分(0–100),越往右越可疑;柱子 = 该分数段的交易笔数。<b className="text-default-500">左段放行 · 中段人工 · 右段拦截</b>。</p>

      <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">
        <SlidersHorizontal className="mt-px h-3.5 w-3.5 shrink-0 text-default-400" />
        自动放行阈值现设在 40。上调至 45 可让约 <b className="text-foreground">6%</b> 的中段低危交易转入直通,在风险敞口可控的前提下提升放行率 —— 阈值即转化与风险的权衡点。
      </p>
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

// analyst caseload vs capacity — vertical columns, top-N + overflow, hover popover for detail
function AnalystLoad({ analysts }: { analysts: { p: { i: string; n: string; c: string }; open: number; cap: number }[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const sorted = [...analysts].sort((a, b) => b.open - a.open);
  const cap = analysts[0].cap;
  const N = sorted.length;
  const avg = Math.round(sorted.reduce((s, a) => s + a.open, 0) / N);
  const overCnt = sorted.filter((a) => a.open > a.cap).length;
  const TOP = 6;
  const top = sorted.slice(0, TOP);
  const rest = sorted.slice(TOP);
  const restAvg = rest.length ? Math.round(rest.reduce((s, a) => s + a.open, 0) / rest.length) : 0;
  const scaleMax = Math.max(...sorted.map((a) => a.open), cap) * 1.15;
  const cols = top.length + (rest.length ? 1 : 0);
  const expand = () => toast(`展开团队负荷 · 全部 ${N} 人`);
  const tip = hi === null ? null
    : hi < top.length
      ? (() => { const a = top[hi]; const d = a.open - cap; return { left: ((hi + 0.5) / cols) * 100, over: d > 0, lines: [a.p.n, `手头 ${a.open} 件`, d > 0 ? `超出上限 ${d} 件 · 需分流` : `还能接 ${-d} 件`] }; })()
      : { left: ((top.length + 0.5) / cols) * 100, over: false, lines: [`其余 ${rest.length} 人`, `人均手头 ${restAvg} 件`] };
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-default-400">分析师工作量</span>
        <span className="text-[11px] text-default-400">团队 {N} 人 · 人均手头 {avg} 件 · <span style={{ color: "var(--danger)", fontWeight: 600 }}>{overCnt} 人忙不过来</span></span>
      </div>
      <div className="relative flex h-[104px] items-end gap-2">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-default-300" style={{ bottom: `${(cap / scaleMax) * 100}%` }}>
          <span className="absolute -top-3.5 right-0 rounded bg-default-100 px-1 text-[9px] font-semibold text-default-500">正常上限 {cap}</span>
        </div>
        {top.map((a, i) => {
          const isOver = a.open > a.cap;
          const over = Math.max(0, a.open - a.cap), base = Math.min(a.open, a.cap);
          return (
            <div key={a.p.n} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className="flex h-full flex-1 flex-col justify-end">
              <span className="mb-1 text-center text-[10px] font-bold tnum" style={isOver ? { color: "var(--danger)" } : undefined}>{a.open}</span>
              {over > 0 && <div className="w-full rounded-t-[3px]" style={{ height: `${(over / scaleMax) * 100}%`, background: "var(--danger)" }} />}
              <div className={over > 0 ? "w-full" : "w-full rounded-t-[3px]"} style={{ height: `${(base / scaleMax) * 100}%`, background: isOver ? "color-mix(in srgb, var(--danger) 35%, var(--track))" : "var(--brand)" }} />
            </div>
          );
        })}
        {rest.length > 0 && (
          <button onMouseEnter={() => setHi(top.length)} onMouseLeave={() => setHi(null)} onClick={expand} className="flex h-full flex-1 flex-col justify-end">
            <span className="mb-1 text-center text-[10px] font-semibold tnum text-default-400">{restAvg}</span>
            <div className="w-full rounded-t-[3px] bg-default-200" style={{ height: `${(restAvg / scaleMax) * 100}%` }} />
          </button>
        )}
        {tip && (
          <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-divider bg-content1 px-2 py-1 shadow-soft" style={{ left: `${Math.min(82, Math.max(18, tip.left))}%` }}>
            {tip.lines.map((l, i) => <div key={i} className={`whitespace-nowrap text-[10.5px] ${i === 0 ? "font-bold" : "text-default-500"}`} style={i > 0 && tip.over ? { color: "var(--danger)" } : undefined}>{l}</div>)}
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        {top.map((a) => (
          <div key={a.p.n} className="flex flex-1 flex-col items-center gap-1">
            <Initials p={a.p} size={20} />
            <span className="w-full truncate text-center text-[9.5px] text-default-400">{a.p.n.split(" ")[0]}</span>
          </div>
        ))}
        {rest.length > 0 && (
          <button onClick={expand} className="flex flex-1 flex-col items-center gap-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-default-100 text-[9px] font-bold text-default-500">+{rest.length}</span>
            <span className="text-[9.5px] text-default-400">其余</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-default-400">柱子越高 = 手头任务越多;虚线是正常上限,<b style={{ color: "var(--danger)" }}>冒红 = 忙不过来</b>,该把任务分给有余力的人。</p>
    </>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  useRingVersion();

  const allRings = [...ringStore.created(), ...rings];
  const stOf = (id: string, base: string) => ringStore.stateOf(id, base) as RingStateKey;
  const ringPending = allRings.filter((r) => stOf(r.id, r.state) === "pending").length;
  const ringInvestigating = allRings.filter((r) => stOf(r.id, r.state) === "investigating").length;
  const ringHighConf = allRings.filter((r) => r.confidence >= 80).length;
  const topRings = [...allRings].sort((a, b) => b.confidence - a.confidence).slice(0, 3);

  const urgent: { label: string; icon: typeof Clock; to: string }[] = [
    { label: "2 笔告警超 SLA", icon: Clock, to: "/alerts" },
    { label: "FINTRAC 报送临期 2 件", icon: SendHorizontal, to: "/reports" },
    { label: "冻结资金待处置 6 笔", icon: Snowflake, to: "/cases" },
    { label: `待认领团伙 ${ringPending} 个`, icon: Network, to: "/rings" },
  ];

  // ── 待我处理 — the current analyst's (我 = James Liu) personal work queue ──
  type Task = { kind: string; subject: string; meta: string; due: string; overdue?: boolean; to: string; icon: typeof Clock };
  // rings I own and still own an open disposition on — pulled live from the store
  const myRings: Task[] = allRings
    .filter((r) => ringStore.ownerOf(r.id, r.owner)?.n === ME.n && ["pending", "investigating", "watching"].includes(stOf(r.id, r.state)))
    .map((r) => ({
      kind: "团伙", subject: r.name, meta: `${r.id} · ${r.members.length} 主体 · 置信 ${r.confidence}%`,
      due: r.sla?.text ?? "无时限", overdue: r.sla?.tone === "red", to: `/ring?id=${r.id}`, icon: Network,
    }));
  const staticTasks: Task[] = [
    { kind: "告警", subject: "RapidPay · Off-ramp 大额可疑提现", meta: "ALT-2418 · 评分 87 · 命中 4 规则", due: "超时 1.2h", overdue: true, to: "/alerts", icon: AlertTriangle },
    { kind: "报送", subject: "STR 草稿待提交 · QuickWallet", meta: "RPT-0091 · MLRO 已退回补充", due: "临期 6h", to: "/reports", icon: SendHorizontal },
    { kind: "告警", subject: "On-ramp 新用户首笔买币复核 · NovaPay", meta: "ALT-2451 · 评分 58 · 补材料已回", due: "剩 1d", to: "/alerts", icon: Clock },
    { kind: "案件", subject: "冻结资金处置审批 · CASE-2026-014", meta: "CAD 58K · 待我确认放行 / 维持", due: "剩 18h", to: "/cases", icon: Snowflake },
  ];
  const myTasks = [...myRings, ...staticTasks];
  const myOverdue = myTasks.filter((t) => t.overdue).length;

  return (
    <Shell crumb={["风控", "风控仪表盘"]} wide>
      <PageHead
        title="MSB 风控仪表盘"
        sub="全业务线风险总览 · 覆盖 On-ramp · Off-ramp · 虚拟货币兑换 · 充值 · 提现 · 风控的目标不止拦下风险,更在于在风险敞口可控的前提下,让合规交易放得更多、更快、误伤更少 —— 把风控做成增长引擎。"
        actions={
          <>
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

      {/* 风控流水线总览 — 给第一次用的人一张流程地图 */}
      <PipelineMap />

      {/* 需立即处理 — single red accent for urgency */}
      <div className="card mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-[3px] p-3.5 pl-4" style={{ borderLeftColor: "var(--danger)" }}>
        <span className="flex items-center gap-1.5 text-[13px] font-bold"><AlertTriangle className="h-4 w-4 text-danger" />需立即处理</span>
        {urgent.map((u) => (
          <button key={u.label} onClick={() => nav(u.to)} className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-2.5 py-1 text-[12px] font-semibold text-default-600 transition-colors hover:bg-default-200">
            <u.icon className="h-3.5 w-3.5 text-default-400" />{u.label}<ChevronRight className="h-3 w-3 text-default-400" />
          </button>
        ))}
      </div>

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

      {/* 待我处理 (personal queue, compact) beside the risk-score distribution */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
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
        <div className="lg:col-span-7"><ScoreDistribution /></div>
      </div>

      {/* 告警队列健康度 — backlog · aging · burn-down · analyst load (the daily ops pulse) */}
      {(() => {
        const net = QUEUE.clearedToday - QUEUE.newToday; // >0 ⇒ backlog shrinking
        const agingTotal = QUEUE.aging.reduce((s, a) => s + a.n, 0);
        // true burn-down: remaining backlog per day, back-computed from today's open so it reconciles
        const backlog = (() => {
          const { newD, clearedD } = QUEUE.trend; const days = newD.length; const b = new Array(days);
          b[days - 1] = QUEUE.open;
          for (let i = days - 2; i >= 0; i--) b[i] = b[i + 1] - (newD[i + 1] - clearedD[i + 1]);
          return b;
        })();
        const peak = Math.max(...backlog);
        const overSla = QUEUE.aging.find((a) => a.over)?.n ?? 0;
        const teamN = QUEUE.analysts.length;
        const teamOver = QUEUE.analysts.filter((a) => a.open > a.cap).length;
        const toneC = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : "var(--success)");
        const slaTone = QUEUE.sla >= 95 ? "green" : QUEUE.sla >= 90 ? "amber" : "red";
        // one-line verdict synthesised from SLA + overload + backlog trend
        const status = QUEUE.sla < 90 || teamOver / teamN > 0.4 ? { label: "超负荷", tone: "red" }
          : overSla > 0 || teamOver / teamN > 0.2 ? { label: "偏紧", tone: "amber" }
          : { label: "健康", tone: "green" };
        const vitals = [
          { k: "待处理积压", v: `${QUEUE.open}`, sub: `今日净 ${net > 0 ? "−" : "+"}${Math.abs(net)} · ${net > 0 ? "队列在消" : "队列在涨"}`, subTone: net > 0 ? "green" : "red" },
          { k: "SLA 达成率", v: `${QUEUE.sla}%`, sub: `较昨日 ${QUEUE.slaDelta}`, subTone: slaTone },
          { k: "平均处理时长", v: QUEUE.mttr, sub: `MTTR · ${QUEUE.mttrDelta}`, subTone: "green" },
          { k: "超 SLA 待处理", v: `${overSla} 件`, sub: "需优先清理", subTone: overSla > 0 ? "red" : "green" },
        ];
        return (
          <div className="card mb-5 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="text-[15px] font-bold">告警队列健康度</div>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: `color-mix(in srgb, ${toneC(status.tone)} 14%, transparent)`, color: toneC(status.tone) }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneC(status.tone) }} />{status.label}
                </span>
              </div>
              <button onClick={() => nav("/alerts")} className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-primary hover:opacity-80">告警队列 <ArrowRight className="h-3.5 w-3.5" /></button>
            </div>

            {/* vitals — the at-a-glance health read */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {vitals.map((m) => (
                <div key={m.k} className="rounded-xl border border-divider p-3">
                  <div className="text-[11.5px] text-default-500">{m.k}</div>
                  <div className="mt-1 text-[22px] font-extrabold leading-none tnum">{m.v}</div>
                  <div className="mt-1.5 text-[11px] font-semibold" style={{ color: toneC(m.subTone) }}>{m.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* burn-down trend — daily inflow vs outflow over 14 days */}
              <div className="lg:col-span-5">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel>燃尽趋势 · 积压余量(近 14 日)</SectionLabel>
                  <span className="text-[11px] text-default-400">峰值 <b className="text-foreground tnum">{peak}</b> → 现 <b className="text-foreground tnum">{QUEUE.open}</b> · 已燃尽 <b className="tnum" style={{ color: "var(--success)" }}>−{peak - QUEUE.open}</b></span>
                </div>
                <div className="mt-2"><LineChart series={[{ data: backlog, color: BRAND, name: "积压余量" }]} labels={DAYS14} /></div>
                <p className="mt-1.5 text-[10.5px] leading-snug text-default-400">线往下 = 积压在被消化(好);往上 = 越积越多。</p>
              </div>
              {/* aging — donut by time-in-queue (brand ramp, 超SLA red) */}
              <div className="lg:col-span-3">
                <SectionLabel>停留时长分布</SectionLabel>
                <div className="flex items-center gap-3">
                  <div className="relative h-[96px] w-[96px] shrink-0">
                    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                      {(() => { let acc = 0; const C = 2 * Math.PI * 50; return QUEUE.aging.map((a, i) => {
                        const f = a.n / agingTotal; const off = -acc * C; acc += f;
                        return <circle key={a.k} cx={60} cy={60} r={50} fill="none" strokeWidth={16}
                          stroke={a.over ? "var(--danger)" : `color-mix(in srgb, var(--brand) ${32 + i * 22}%, var(--track))`}
                          strokeDasharray={`${f * C} ${C}`} strokeDashoffset={off}><title>{`${a.k} · ${a.n} 笔 · ${((a.n / agingTotal) * 100).toFixed(1)}%`}</title></circle>;
                      }); })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[18px] font-extrabold leading-none tnum">{agingTotal}</span>
                      <span className="text-[9px] text-default-400">积压</span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    {QUEUE.aging.map((a, i) => (
                      <div key={a.k} className="flex items-center gap-1.5 text-[11px]">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.over ? "var(--danger)" : `color-mix(in srgb, var(--brand) ${32 + i * 22}%, var(--track))` }} />
                        <span className="flex-1" style={a.over ? { color: "var(--danger)", fontWeight: 600 } : undefined}>{a.k}</span>
                        <span className="font-bold tnum">{a.n}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] leading-snug text-default-400">按等待时长把积压分段,<b style={{ color: "var(--danger)" }}>红色 = 已超时</b>,占比越大越糟。</p>
              </div>
              {/* analyst load — see AnalystLoad: columns + capacity line + hover popover */}
              <div className="lg:col-span-4"><AnalystLoad analysts={QUEUE.analysts} /></div>
            </div>
          </div>
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
              <th className="pb-2 text-left font-medium">规则</th><th className="pb-2 text-right font-medium">命中</th>
              <th className="pb-2 text-right font-medium">误报率</th><th className="pb-2 text-right font-medium">误伤金额</th><th className="pb-2 text-right font-medium">处置</th>
            </tr></thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.name} className="border-b border-default-100 last:border-0">
                  <td className="py-2.5 font-semibold">{r.name}</td>
                  <td className="py-2.5 text-right tnum text-default-600">{r.hit}</td>
                  <td className="py-2.5 text-right tnum font-semibold">{r.fp}%</td>
                  <td className="py-2.5 text-right tnum text-default-600">{r.leak}</td>
                  <td className="py-2.5 text-right"><span className="rounded-md bg-default-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-default-500">{r.disp}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">
            <TrendingDown className="mt-px h-3.5 w-3.5 shrink-0 text-default-400" />「新用户首笔交易」误报 52% 最高 —— 收紧条件至 30%,预计每月找回合规交易 ~CAD 18K,把降噪变成创收。
          </p>
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
                <span className="flex w-[88px] shrink-0 items-center gap-1.5 text-[12px] font-semibold"><span className="text-default-400">{nw.sym}</span>{nw.name}</span>
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
    </Shell>
  );
}
