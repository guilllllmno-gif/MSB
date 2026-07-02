// ─────────────────────────────────────────────────────────────────────────────
// 链上风险情报(KYT · Know Your Transaction)
//
// 分层清楚:
//  · **情报源(买供应商)** —— 地址风险分 / 类别归属 / 资金敞口 / 对手方。原型内为 mock,
//    真集成时接 Chainalysis / TRM / Elliptic 类 API(见 FULLSTACK_MVP §6 外部集成,fail-closed)。
//  · **风险策略与处置(本系统自建 = 风控的活)** —— KYT_POLICY / policyVerdict:把供应商信号
//    映射成本系统处置(放行 / 复核 / 拒绝)。阈值是风险偏好,风控总管可调(占位待定)。
// ─────────────────────────────────────────────────────────────────────────────
import type { Tone } from "./data";
import type { Txn } from "./decision";

export type Chain = "BTC" | "ETH" | "TRON";

// 供应商类别归属(该地址"是什么")
export type RiskCat = "sanctioned" | "mixer" | "darknet" | "scam" | "stolen" | "gambling" | "exchange" | "defi" | "p2p" | "unknown";
export const CAT_META: Record<RiskCat, { label: string; severe: boolean }> = {
  sanctioned: { label: "被制裁实体", severe: true },
  mixer: { label: "混币器", severe: true },
  darknet: { label: "暗网市场", severe: true },
  scam: { label: "诈骗 / 钓鱼", severe: true },
  stolen: { label: "盗币 / 黑客", severe: true },
  gambling: { label: "博彩", severe: false },
  exchange: { label: "交易所 (VASP)", severe: false },
  defi: { label: "DeFi 协议", severe: false },
  p2p: { label: "P2P / OTC", severe: false },
  unknown: { label: "未归类", severe: false },
};

// 资金敞口:该地址的资金有多少 % 流向 / 来自某类别,最短几跳
export interface Exposure { cat: RiskCat; pct: number; hops: number; direction: "in" | "out" }
export interface Counterparty { name: string; kind: "VASP" | "service"; pct: number }
export interface SeenRef { kind: "商户" | "团伙" | "告警"; label: string; to: string }

export interface AddrRisk {
  address: string; chain: Chain;
  score: number;                 // 0-100 供应商风险分
  ownEntity?: string;            // 该地址本身归属(若已确认:如某交易所热钱包 / 某混币器)
  categories: RiskCat[];         // 供应商类别标注
  exposures: Exposure[];         // 敞口构成(按占比降序)
  counterparties: Counterparty[];
  firstSeen: string; lastScreened: string;
  seenIn: SeenRef[];             // 本系统里在哪见过(交叉回链)
}

// 供应商风险分 → 分级(供应商侧,与"我们的处置"分开)
export const scoreLevel = (s: number): { label: string; tone: Tone } =>
  s >= 75 ? { label: "高危", tone: "red" } : s >= 40 ? { label: "中风险", tone: "amber" } : { label: "低风险", tone: "green" };

// ── 风险策略(本系统自建)· 阈值 = 风险偏好,风控总管可调 · 占位待定 ──────────────
export const KYT_POLICY = {
  scoreBlock: 90,       // 风险分 ≥ 此值 → 拒绝
  scoreReview: 50,      // 风险分 ≥ 此值 → 转人工
  sanctionHops: 1,      // 距被制裁地址 ≤ 此跳数的敞口视为"直接" → 硬拒
  mixerReview: 15,      // 混币器敞口 ≥ 此 % → 转人工
  darknetReview: 5,     // 暗网敞口 ≥ 此 % → 转人工
  scamReview: 10,       // 诈骗敞口 ≥ 此 % → 转人工
  stolenReview: 10,     // 盗币敞口 ≥ 此 % → 转人工
};

export type Verdict = "block" | "review" | "pass";
export const VERDICT_META: Record<Verdict, { label: string; tone: Tone; hint: string }> = {
  block: { label: "拒绝 · 拦截", tone: "red", hint: "不放行,冻结 / 拒绝该笔,并转研判" },
  review: { label: "转人工复核", tone: "amber", hint: "暂缓,进告警研判由分析师定夺" },
  pass: { label: "放行", tone: "green", hint: "无显著风险敞口,正常放行" },
};

// 供应商信号 → 本系统处置(带命中的策略原因)。
// 策略默认取常量;传入 kytPolicyStore.current() 即用总管调过的实时阈值。
export function policyVerdict(a: AddrRisk, p: typeof KYT_POLICY = KYT_POLICY): { verdict: Verdict; reason: string } {
  const dirSanction = a.exposures.find((e) => e.cat === "sanctioned" && e.hops <= p.sanctionHops);
  if (dirSanction) return { verdict: "block", reason: `直接敞口到被制裁地址(${dirSanction.hops} 跳 · 硬红线)` };
  if (a.score >= p.scoreBlock) return { verdict: "block", reason: `供应商风险分 ${a.score} ≥ ${p.scoreBlock}` };
  const hit = (cat: RiskCat, th: number) => { const e = a.exposures.find((x) => x.cat === cat); return e && e.pct >= th ? e : null; };
  const m = hit("mixer", p.mixerReview); if (m) return { verdict: "review", reason: `混币器敞口 ${m.pct}% ≥ ${p.mixerReview}%` };
  const d = hit("darknet", p.darknetReview); if (d) return { verdict: "review", reason: `暗网敞口 ${d.pct}% ≥ ${p.darknetReview}%` };
  const s = hit("scam", p.scamReview); if (s) return { verdict: "review", reason: `诈骗敞口 ${s.pct}% ≥ ${p.scamReview}%` };
  const st = hit("stolen", p.stolenReview); if (st) return { verdict: "review", reason: `盗币敞口 ${st.pct}% ≥ ${p.stolenReview}%` };
  if (a.score >= p.scoreReview) return { verdict: "review", reason: `供应商风险分 ${a.score} ≥ ${p.scoreReview}` };
  return { verdict: "pass", reason: "无显著风险敞口" };
}

// ── mock 供应商数据集(原型内固定样本,确定性;真集成时来自 KYT API)──────────────
export const ADDRS: AddrRisk[] = [
  { address: "0x9f2a17c4e0b83d5f6a1c9e2b7d4088ff3c7dc7d1", chain: "ETH", score: 94,
    categories: ["mixer"], exposures: [{ cat: "sanctioned", pct: 8, hops: 1, direction: "in" }, { cat: "mixer", pct: 41, hops: 1, direction: "out" }, { cat: "exchange", pct: 22, hops: 2, direction: "out" }],
    counterparties: [{ name: "Tornado Cash", kind: "service", pct: 41 }, { name: "未知 OTC", kind: "service", pct: 18 }],
    firstSeen: "2026-05-14", lastScreened: "2026-07-02", seenIn: [{ kind: "团伙", label: "RING-2026-014 · 混币器归集网络", to: "/ring?id=RING-2026-014" }] },
  { address: "0xEEff2093a1b7c8d4e5061728394a5b6c7d8e9001", chain: "ETH", score: 99,
    ownEntity: "OFAC SDN 名单地址", categories: ["sanctioned"], exposures: [{ cat: "sanctioned", pct: 100, hops: 0, direction: "out" }],
    counterparties: [], firstSeen: "2026-04-02", lastScreened: "2026-07-02", seenIn: [{ kind: "告警", label: "制裁命中告警", to: "/alerts" }] },
  { address: "bc1q4k8m2p9x7va3n6t0e5r1w8y4u2i9o5a7s3d9xta", chain: "BTC", score: 83,
    categories: ["mixer", "darknet"], exposures: [{ cat: "mixer", pct: 55, hops: 1, direction: "out" }, { cat: "darknet", pct: 12, hops: 2, direction: "in" }, { cat: "p2p", pct: 20, hops: 1, direction: "in" }],
    counterparties: [{ name: "Wasabi CoinJoin", kind: "service", pct: 55 }], firstSeen: "2026-05-28", lastScreened: "2026-07-02", seenIn: [{ kind: "团伙", label: "RING-2026-021", to: "/ring?id=RING-2026-021" }] },
  { address: "0x3b8e5a1f9c2d7048b6e3a220ff17c94e0d2b6a11", chain: "ETH", score: 71,
    categories: ["gambling"], exposures: [{ cat: "darknet", pct: 9, hops: 2, direction: "out" }, { cat: "gambling", pct: 34, hops: 1, direction: "out" }, { cat: "exchange", pct: 40, hops: 1, direction: "in" }],
    counterparties: [{ name: "Stake.com", kind: "service", pct: 34 }, { name: "Kraken", kind: "VASP", pct: 40 }], firstSeen: "2026-06-03", lastScreened: "2026-07-02", seenIn: [{ kind: "商户", label: "RapidPay Solutions", to: "/entity?name=RapidPay%20Solutions" }] },
  { address: "TXk9mVb2Q7n4c8p1s6d3f0g5h2j9k4l7mQ2", chain: "TRON", score: 88,
    categories: ["scam"], exposures: [{ cat: "scam", pct: 30, hops: 1, direction: "in" }, { cat: "exchange", pct: 45, hops: 1, direction: "out" }],
    counterparties: [{ name: "Huobi", kind: "VASP", pct: 45 }], firstSeen: "2026-06-11", lastScreened: "2026-07-02", seenIn: [{ kind: "告警", label: "杀猪盘出金告警", to: "/alerts" }] },
  { address: "bc1qzz7h4t3e9r5w2y8u6i0o1p3a5s7d9f1g2h4t0p", chain: "BTC", score: 63,
    categories: ["stolen"], exposures: [{ cat: "stolen", pct: 18, hops: 1, direction: "in" }, { cat: "exchange", pct: 60, hops: 1, direction: "out" }],
    counterparties: [{ name: "Binance", kind: "VASP", pct: 60 }], firstSeen: "2026-06-20", lastScreened: "2026-07-02", seenIn: [] },
  { address: "0x55af1093d2c7e8b4a6091f3e5d7c9b1a2e8f1e9c", chain: "ETH", score: 45,
    categories: ["p2p"], exposures: [{ cat: "p2p", pct: 58, hops: 1, direction: "in" }, { cat: "gambling", pct: 14, hops: 2, direction: "out" }, { cat: "exchange", pct: 28, hops: 1, direction: "out" }],
    counterparties: [{ name: "LocalBitcoins 遗留", kind: "service", pct: 58 }], firstSeen: "2026-06-24", lastScreened: "2026-07-02", seenIn: [{ kind: "商户", label: "NovaPay Technologies", to: "/entity?name=NovaPay%20Technologies" }] },
  { address: "0x71c9e4b8d2a5f0a3671c8e9d4b7a2c5f8e1d0f0a", chain: "ETH", score: 12,
    ownEntity: "Binance 热钱包", categories: ["exchange"], exposures: [{ cat: "exchange", pct: 92, hops: 0, direction: "out" }],
    counterparties: [{ name: "Binance", kind: "VASP", pct: 92 }], firstSeen: "2026-03-09", lastScreened: "2026-07-02", seenIn: [{ kind: "商户", label: "NovaPay Technologies", to: "/entity?name=NovaPay%20Technologies" }] },
  { address: "0x08d2a7c1e9b4f0637b7c5a2d8e1f4906c3b6a77b", chain: "ETH", score: 28,
    categories: ["defi"], exposures: [{ cat: "defi", pct: 80, hops: 1, direction: "out" }, { cat: "exchange", pct: 15, hops: 2, direction: "in" }],
    counterparties: [{ name: "Uniswap V3", kind: "service", pct: 80 }], firstSeen: "2026-05-01", lastScreened: "2026-07-02", seenIn: [] },
];

// FNV-1a,确定性(演示态"筛查任意地址"用;无随机 / 时钟)
function h32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// 筛查任意地址:先查已知样本,否则由地址串确定性合成一条(模拟调 KYT API 返回)
export function screen(input: string): AddrRisk | null {
  const q = input.trim();
  if (!q) return null;
  const known = ADDRS.find((a) => a.address.toLowerCase() === q.toLowerCase());
  if (known) return known;
  const h = h32(q);
  const score = h % 100;
  const chain: Chain = q.startsWith("0x") ? "ETH" : q.startsWith("bc1") || q.startsWith("1") || q.startsWith("3") ? "BTC" : q.startsWith("T") ? "TRON" : "ETH";
  const cats: RiskCat[][] = [["exchange"], ["defi"], ["p2p"], ["gambling"], ["mixer"], ["scam"], ["darknet"], ["stolen"]];
  const cat = cats[h % cats.length];
  const primary = cat[0];
  const exposures: Exposure[] = [
    { cat: primary, pct: 20 + (h % 60), hops: 1 + (h % 2), direction: (h & 1) === 0 ? "out" : "in" },
    { cat: "exchange", pct: 10 + (h % 25), hops: 1 + ((h >> 3) % 2), direction: "out" },
  ];
  return { address: q, chain, score, categories: cat, exposures, counterparties: [{ name: "未知服务", kind: "service", pct: exposures[0].pct }], firstSeen: "2026-06-30", lastScreened: "2026-07-02", seenIn: [] };
}

// ── KYT 画像 → 事中交易的链上信号 ──────────────────────────────────────────────
// 把供应商地址画像转成决策引擎(lib/decision.ts)已有的链上字段,**不改引擎**:
//   kyw ← 风险分;mixerHops ← 到 制裁/混币器 的最短跳数(引擎 R-CHN-001 ≤2 即冻结);
//   addressTags ← severe 类别标签(引擎 R-CHN-002)。这样"接进事中闸口"= 补一个适配器。
export function kytToSignals(a: AddrRisk): Pick<Txn, "kyw" | "mixerHops" | "addressTags"> {
  const hopsCand = a.exposures.filter((e) => e.cat === "sanctioned" || e.cat === "mixer").map((e) => e.hops);
  // 风险标签取「自身类别 ∪ 敞口所及的高危类别」—— 让"敞口到暗网/诈骗/盗币"也进事中信号,不只看地址本身是什么
  const severe = new Set<RiskCat>([...a.categories, ...a.exposures.map((e) => e.cat)].filter((c) => CAT_META[c].severe));
  const tags = [...severe].map((c) => CAT_META[c].label);
  return {
    kyw: a.score,
    mixerHops: hopsCand.length ? Math.min(...hopsCand) : undefined,
    addressTags: tags.length ? tags : undefined,
  };
}

// 简写地址显示(不用 mono 字体,与全站一致)
export const shortAddr = (a: string): string => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
