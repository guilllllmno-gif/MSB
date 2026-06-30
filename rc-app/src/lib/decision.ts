// ─────────────────────────────────────────────────────────────────────────────
// 风控事中决策引擎(纯函数 · 可测)
// 实现 /strategy（全局策略 · 系统兜底）文档的决策管线,与原型数据同源:
//   规则 = lib/rules.ts 的已上线 gate 规则;名单 = lib/lists.ts(仅 active 生效);
//   基线阈值 = strategy 默认基线(拦截 80 / 研判 60 / 留痕 40)。
// 管线顺序(层级:法定 > 名单 > 模型 > 规则 > 基线;最严生效 most-restrictive):
//   ① 数据源健康检查 → 降级兜底(fail-safe / fail-closed / 熔断保守)
//   ② 制裁筛查(命中即冻结 + TPR,白名单不可豁免)
//   ③ 名单筛查(制裁 > 黑 > 关注 > 白;白名单仅豁免评分类规则)
//   ④ LVCTR 法定阈值(≥ CAD 10,000 自动报送,不改动作只加报送)
//   ⑤ 加权规则评分(CRR = Σ 命中评分规则权重)
//   ⑥ 决策基线矩阵(≥80 拦截+人工 / 60–79 放行+研判 / 40–59 放行+留痕 / <40 放行)
//   ⑦ 最严生效:在 名单/规则/基线/降级 各路动作里取最严
// 无 mock、无 TODO:规则谓词为真实可执行逻辑,名单取自真实种子(active)。
// ─────────────────────────────────────────────────────────────────────────────
import { LISTS, type ListCat } from "./lists";

// ── 决策动作(严重度从高到低)──
export type Action = "freeze" | "block" | "hold" | "review" | "allow";
const SEVERITY: Record<Action, number> = { freeze: 5, block: 4, hold: 3, review: 2, allow: 1 };
/** 最严生效:取两个动作里更严的那个 */
export const mostRestrictive = (a: Action, b: Action): Action => (SEVERITY[a] >= SEVERITY[b] ? a : b);

export type ReportKind = "STR" | "LVCTR" | "TPR";

export interface Reason { code: string; rule?: string; detail: string }

export interface Decision {
  action: Action;
  score: number;              // CRR 加权评分(0–100,封顶)
  band: "block" | "review" | "log" | "pass" | "n/a"; // 基线矩阵落档
  reports: ReportKind[];      // 触发的法定报送
  reasons: Reason[];          // 处置依据(可解释)
  degraded: string[];         // 生效的降级兜底(数据源故障)
  manualReview: boolean;      // 是否强制转人工 / 研判
}

// ── 交易输入(事中可得字段)──
export interface Txn {
  id: string;
  merchant: string;
  direction: "deposit" | "withdraw" | "onramp" | "offramp" | "exchange";
  amount: number;                 // CAD
  sender?: string;                // 发送方地址 / 钱包
  receiver?: string;              // 收款方地址 / 钱包
  kyw?: number;                   // 收款钱包 KYW 链上风险评分 0–100(评分服务)
  mixerHops?: number;             // 到制裁混币器跳数(链上溯源);undefined = 未溯源
  addressTags?: string[];         // 发送方风险标签(链上溯源)
  privacyCoinOrBridge?: boolean;  // 隐私币 / 跨链桥
  kybComplete?: boolean;          // 商户 KYB 是否完成;undefined = KYC/KYB 缺失
  firstTransaction?: boolean;     // 商户首笔
  device?: string;
  ip?: string;
  window?: {                      // 上游预聚合的滑窗特征(事中可得)
    count24h?: number;            // 24h 入金笔数
    similarAmountRun?: boolean;   // 金额相近(拆分特征)
    outflowRatio1h?: number;      // 入金后 1h 转出比例 0–1
  };
  jurisdictionHighRisk?: boolean;
}

// ── 数据源健康(降级兜底入参)──
export interface DataHealth {
  sanctionsSource?: "ok" | "down";  // 制裁名单源
  scoring?: "ok" | "timeout" | "down"; // 评分服务(KYW 等)
  chainTrace?: "ok" | "down";       // 链上溯源
}

// ── 决策基线(strategy 默认;可被预设档调整,这里取默认 80/60/40)──
export const THRESHOLDS = { block: 80, review: 60, log: 40 };
export const LVCTR_LIMIT = 10_000;       // 法定大额报送阈值
const LARGE_HOLD = 10_000;               // 评分降级时「大额暂缓」起点

// ── 名单筛查索引(仅 active 生效;按类别归类,名称归一化松匹配,与原型一致)──
const norm = (s: string) => s.trim().toLowerCase();
const ACTIVE_LIST: { value: string; cat: ListCat }[] = LISTS
  .filter((e) => e.status === "active")
  .map((e) => ({ value: e.value, cat: e.cat }));

/** 某个值(主体名 / 地址 / 设备 / IP)命中的最严名单类别;松匹配(含子串),与原型口径一致 */
function screenValue(value: string | undefined): ListCat | null {
  if (!value) return null;
  const v = norm(value);
  let best: ListCat | null = null;
  const rank: Record<ListCat, number> = { sanctions: 4, block: 3, watch: 2, allow: 1 };
  for (const e of ACTIVE_LIST) {
    const lv = norm(e.value);
    if (v === lv || v.includes(lv) || lv.includes(v)) {
      if (!best || rank[e.cat] > rank[best]) best = e.cat;
    }
  }
  return best;
}

/** 交易涉及的所有值里命中的最严名单类别(制裁 > 黑 > 关注 > 白)*/
function screenTxn(t: Txn): { sanctions: boolean; block: boolean; watch: boolean; allow: boolean; hits: { value: string; cat: ListCat }[] } {
  const vals = [t.merchant, t.sender, t.receiver, t.device, t.ip].filter(Boolean) as string[];
  const hits: { value: string; cat: ListCat }[] = [];
  for (const v of vals) {
    const cat = screenValue(v);
    if (cat) hits.push({ value: v, cat });
  }
  return {
    sanctions: hits.some((h) => h.cat === "sanctions"),
    block: hits.some((h) => h.cat === "block"),
    watch: hits.some((h) => h.cat === "watch"),
    allow: hits.some((h) => h.cat === "allow"),
    hits,
  };
}

// ── 已上线 gate 评分规则(可执行谓词,id/权重/条件与 lib/rules.ts 同源)──
interface RuleDef {
  id: string; name: string; weight: number;
  needsScoring?: boolean; // 依赖评分服务(KYW)
  needsChain?: boolean;   // 依赖链上溯源
  freeze?: boolean;       // 命中即冻结(而非仅评分)
  test: (t: Txn) => boolean;
}
export const SCORING_RULES: RuleDef[] = [
  { id: "R-AMT-001", name: "大额充值监控", weight: 60, test: (t) => t.direction === "deposit" && t.amount >= 5_000 },
  { id: "R-AMT-002", name: "大额提现监控", weight: 55, test: (t) => t.direction === "withdraw" && t.amount >= 3_000 },
  { id: "R-CHN-001", name: "混币器关联", weight: 35, needsChain: true, freeze: true, test: (t) => t.mixerHops !== undefined && t.mixerHops <= 2 },
  { id: "R-SCR-001", name: "KYW 评分超阈值", weight: 50, needsScoring: true, test: (t) => t.kyw !== undefined && t.kyw > 70 },
  { id: "R-BHV-001", name: "高频拆分入金(单笔)", weight: 30, test: (t) => (t.window?.count24h ?? 0) >= 5 && !!t.window?.similarAmountRun },
  { id: "R-BHV-002", name: "快进快出钱包", weight: 28, test: (t) => (t.window?.outflowRatio1h ?? 0) > 0.8 },
  { id: "R-BHV-003", name: "新商户首充", weight: 20, test: (t) => !!t.firstTransaction && t.kybComplete === false },
  { id: "R-CHN-002", name: "高风险地址检测", weight: 25, needsChain: true, test: (t) => (t.addressTags?.length ?? 0) > 0 },
];

/** 评分落档:基线矩阵 */
function band(score: number): Decision["band"] {
  if (score >= THRESHOLDS.block) return "block";
  if (score >= THRESHOLDS.review) return "review";
  if (score >= THRESHOLDS.log) return "log";
  return "pass";
}

// ── 主决策函数 ──────────────────────────────────────────────────────────────
export function decide(t: Txn, health: DataHealth = {}): Decision {
  const reasons: Reason[] = [];
  const reports: ReportKind[] = [];
  const degraded: string[] = [];
  let action: Action = "allow";
  let manualReview = false;

  // ── ① 输入合法性(字段异常 fail-safe:金额非有限 / 负数 → 暂缓转人工,不放行)──
  if (!Number.isFinite(t.amount) || t.amount < 0) {
    reasons.push({ code: "INVALID_AMOUNT", detail: `金额异常(${t.amount}) · 暂缓转人工核验,拒绝自动放行` });
    return { action: "hold", score: 0, band: "n/a", reports, reasons, degraded, manualReview: true };
  }

  // ── ② 制裁筛查(法定,最高优先;白名单不可豁免)──
  // 降级:制裁名单源不可达 → fail-closed,暂停放行(锁定)。
  if (health.sanctionsSource === "down") {
    degraded.push("制裁名单源不可达 · fail-closed 暂停放行");
    reasons.push({ code: "DEGRADE_SANCTIONS_DOWN", detail: "制裁筛查不可用,按 fail-closed 暂缓,人工核验后放行" });
    action = mostRestrictive(action, "hold");
    manualReview = true;
  }
  const listed = screenTxn(t);
  if (health.sanctionsSource !== "down" && listed.sanctions) {
    action = mostRestrictive(action, "freeze");
    manualReview = true;
    reasons.push({ code: "SANCTIONS_HIT", rule: "R-LST-001", detail: `制裁名单命中:${listed.hits.filter((h) => h.cat === "sanctions").map((h) => h.value).join("、")} · 冻结 + 升级 MLRO` });
    if (!reports.includes("TPR")) reports.push("TPR"); // 制裁财产报告
  }

  // ── ③ 名单筛查:黑名单(确认欺诈/洗钱)→ 拦截 ──
  if (listed.block) {
    action = mostRestrictive(action, "block");
    manualReview = true;
    reasons.push({ code: "BLOCKLIST_HIT", detail: `内部黑名单命中:${listed.hits.filter((h) => h.cat === "block").map((h) => h.value).join("、")} · 拦截` });
  }
  // 关注名单:不拦,升级监控(动作下限抬到 review)
  if (listed.watch) {
    reasons.push({ code: "WATCHLIST_HIT", detail: `关注名单命中:${listed.hits.filter((h) => h.cat === "watch").map((h) => h.value).join("、")} · 加强监控(不拦截)` });
    action = mostRestrictive(action, "review");
    manualReview = true;
  }
  // 白名单:仅豁免评分类规则(不豁免制裁/黑)
  const whitelisted = listed.allow && !listed.sanctions && !listed.block;
  if (whitelisted) reasons.push({ code: "ALLOWLIST_EXEMPT", detail: "白名单主体 · 豁免评分类规则(制裁/黑名单仍生效)" });

  // ── ④ LVCTR 法定阈值 ──
  if (t.amount >= LVCTR_LIMIT) {
    reports.push("LVCTR");
    reasons.push({ code: "LVCTR", detail: `单笔 ${t.amount} ≥ CAD ${LVCTR_LIMIT} · 法定大额交易自动报送` });
  }

  // ── ⑤ 加权规则评分(CRR)──
  // 降级:链上溯源 / 评分服务故障时,依赖该数据的规则无法评估 → 转人工暂缓(从严,不放行)。
  const chainDown = health.chainTrace === "down";
  const scoringDown = health.scoring === "down" || health.scoring === "timeout";
  if (chainDown) degraded.push("链上溯源失败 · 链上规则转人工暂缓");
  if (scoringDown) degraded.push(`评分服务${health.scoring === "timeout" ? "超时" : "故障"} · 熔断 · 全局保守模式`);

  let score = 0;
  const hitRules: string[] = [];
  for (const r of SCORING_RULES) {
    // 白名单豁免评分类(冻结类如混币器不豁免)
    if (whitelisted && !r.freeze) continue;
    // 数据源不可用 → 跳过该规则评分,但记降级 + 抬动作(不当作未命中放行)
    if (r.needsChain && chainDown) { reasons.push({ code: "DEGRADE_CHAIN_SKIP", rule: r.id, detail: `${r.name} 依赖链上溯源,当前不可用 · 转人工暂缓` }); action = mostRestrictive(action, "hold"); manualReview = true; continue; }
    if (r.needsScoring && scoringDown) { reasons.push({ code: "DEGRADE_SCORING_SKIP", rule: r.id, detail: `${r.name} 依赖评分服务,当前不可用 · 按保守处理` }); continue; }
    if (r.test(t)) {
      score += r.weight;
      hitRules.push(r.id);
      reasons.push({ code: "RULE_HIT", rule: r.id, detail: `${r.name} 命中 · 评分 +${r.weight}` });
      if (r.freeze) { action = mostRestrictive(action, "freeze"); manualReview = true; reasons.push({ code: "RULE_FREEZE", rule: r.id, detail: `${r.name} · 命中即冻结` }); }
    }
  }
  score = Math.min(100, score);

  // ── ⑥ 决策基线矩阵 ──
  let bnd: Decision["band"];
  if (scoringDown) {
    // 评分缺失 / 超时 → 默认按「偏高 · 转研判」(从严);大额暂缓
    bnd = "n/a";
    reasons.push({ code: "DEGRADE_SCORING_CONSERVATIVE", detail: "评分不可用 · 默认按偏高转研判(从严)" });
    action = mostRestrictive(action, "review");
    manualReview = true;
    if (t.amount >= LARGE_HOLD) { action = mostRestrictive(action, "hold"); reasons.push({ code: "DEGRADE_LARGE_HOLD", detail: `评分降级且大额 ${t.amount} ≥ CAD ${LARGE_HOLD} · 暂缓` }); }
  } else {
    bnd = band(score);
    if (bnd === "block") { action = mostRestrictive(action, "block"); manualReview = true; reasons.push({ code: "BASELINE_BLOCK", detail: `综合风险分 ${score} ≥ ${THRESHOLDS.block} · 拦截 + 强制人工` }); }
    else if (bnd === "review") { action = mostRestrictive(action, "review"); manualReview = true; reasons.push({ code: "BASELINE_REVIEW", detail: `综合风险分 ${score} 在 ${THRESHOLDS.review}–${THRESHOLDS.block - 1} · 放行转研判` }); }
    else if (bnd === "log") { reasons.push({ code: "BASELINE_LOG", detail: `综合风险分 ${score} 在 ${THRESHOLDS.log}–${THRESHOLDS.review - 1} · 放行 + 留痕` }); }
    else reasons.push({ code: "BASELINE_PASS", detail: `综合风险分 ${score} < ${THRESHOLDS.log} · 放行` });
  }

  // ── KYC/KYB 缺失 → 按最高风险档(从严,不放行)──
  if (t.kybComplete === undefined) {
    degraded.push("KYC/KYB 缺失 · 按最高风险档处理");
    reasons.push({ code: "DEGRADE_KYC_MISSING", detail: "KYC/KYB 信息缺失 · 默认最高风险档,不自动放行" });
    action = mostRestrictive(action, "review");
    manualReview = true;
  }

  return { action, score, band: bnd, reports, reasons, degraded, manualReview };
}
