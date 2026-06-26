// ⑦ 单笔回放测试:拿一笔真实历史交易跑当前(尚未保存的)规则 —— 命不命中?不命中卡在哪个条件 / 子组?
// 给配规则的人单笔可解释性(取代只有聚合预估)。演示态:结构化样本交易 + 确定性求值,真实重放走后端引擎。
import { isNumericField, CATEGORICAL_FIELDS, clauseText, type Clause, type ClauseGroup, type Joiner } from "./rules";

// 每笔样本带:数值字段值(vals)、类别字段标签(tags)、分层维度归属(seg,供分层阈值取档)、
// 相对基线参照(base:自身均值 mean / 标准差 std / 同业群 P95)。
export interface ReplayTx {
  id: string; label: string; sub: string;
  vals: Record<string, number>;
  tags: Record<string, string[] | string>;
  seg: Partial<Record<string, string>>;
  base: Record<string, { mean: number; std: number; p95: number }>;
}

export const REPLAY_TXNS: ReplayTx[] = [
  {
    id: "ALT-50231", label: "混币器关联充值 · NovaPay", sub: "充值 · CAD 8,200 · 新商户 5 天 · KYB 未完成",
    vals: { "单笔金额 (CAD)": 8200, "综合风险评分": 95, "账户年龄 (天)": 5, "账户休眠天数": 0, "滑窗累计金额 (CAD)": 8200, "滑窗笔数": 1 },
    tags: { "地址风险标签": ["混币器关联", "高风险"], "名单": ["OFAC(经混币器)"], "跨链 / 隐私币": ["跨链桥"], "KYB 状态": "未完成" },
    seg: { "KYC 等级": "新户 / 未验证", "业务线": "On-ramp 入金", "注册地": "标准辖区" },
    base: { "单笔金额 (CAD)": { mean: 1490, std: 600, p95: 5200 }, "滑窗笔数": { mean: 1, std: 0.5, p95: 3 } },
  },
  {
    id: "ALT-50229", label: "KYW 评分超阈值提现 · BlockTrade", sub: "提现 · CAD 21,400 · KYW 88 · 账龄 1.2 年",
    vals: { "单笔金额 (CAD)": 21400, "KYW 评分": 88, "综合风险评分": 88, "账户年龄 (天)": 438, "账户休眠天数": 0, "对手集中度 (%)": 62 },
    tags: { "地址风险标签": ["交易所", "高风险地区"], "名单": [], "跨链 / 隐私币": [], "KYB 状态": "完成" },
    seg: { "KYC 等级": "VIP / 已验证", "业务线": "Off-ramp 出金", "注册地": "高风险辖区" },
    base: { "单笔金额 (CAD)": { mean: 7800, std: 4200, p95: 24000 }, "对手集中度 (%)": { mean: 35, std: 14, p95: 70 } },
  },
  {
    id: "TXN-STRUCT-01", label: "疑似结构化拆分 · RapidPay", sub: "48h 内 6 笔各 ~CAD 1,550 入金,合计 CAD 9,300",
    vals: { "单笔金额 (CAD)": 1550, "滑窗累计金额 (CAD)": 9300, "滑窗笔数": 6, "综合风险评分": 64, "账户年龄 (天)": 21, "账户休眠天数": 0, "对手集中度 (%)": 48 },
    tags: { "地址风险标签": [], "名单": [], "跨链 / 隐私币": [], "KYB 状态": "标准" },
    seg: { "KYC 等级": "标准", "业务线": "On-ramp 入金", "注册地": "标准辖区" },
    base: { "滑窗笔数": { mean: 1.2, std: 0.8, p95: 4 }, "单笔金额 (CAD)": { mean: 1500, std: 300, p95: 2100 } },
  },
  {
    id: "TXN-DORMANT-01", label: "休眠后突发出金 · Eastwind", sub: "休眠 92 天后 24h 内 8 笔出金",
    vals: { "单笔金额 (CAD)": 4200, "滑窗笔数": 8, "滑窗累计金额 (CAD)": 33600, "综合风险评分": 71, "账户年龄 (天)": 410, "账户休眠天数": 92, "对手集中度 (%)": 81 },
    tags: { "地址风险标签": ["新地址"], "名单": [], "跨链 / 隐私币": ["隐私币"], "KYB 状态": "完成" },
    seg: { "KYC 等级": "标准", "业务线": "Off-ramp 出金", "注册地": "标准辖区" },
    base: { "滑窗笔数": { mean: 1.5, std: 0.7, p95: 4 }, "单笔金额 (CAD)": { mean: 3800, std: 1500, p95: 7000 } },
  },
  {
    id: "TXN-BENIGN-01", label: "促销活动正常波动 · PayFlow", sub: "笔频上升但群内正常、风险分低(对照样本)",
    vals: { "单笔金额 (CAD)": 640, "滑窗笔数": 5, "滑窗累计金额 (CAD)": 3200, "综合风险评分": 28, "账户年龄 (天)": 900, "账户休眠天数": 0, "对手集中度 (%)": 22 },
    tags: { "地址风险标签": [], "名单": [], "跨链 / 隐私币": [], "KYB 状态": "完成" },
    seg: { "KYC 等级": "VIP / 已验证", "业务线": "On-ramp 入金", "注册地": "标准辖区" },
    base: { "滑窗笔数": { mean: 4.5, std: 1.5, p95: 8 }, "单笔金额 (CAD)": { mean: 700, std: 200, p95: 1100 } },
  },
];

const num = (s: string) => parseFloat((s || "").replace(/,/g, "")) || 0;
const cmp = (a: number, op: string, b: number) =>
  op === "≥" ? a >= b : op === "≤" ? a <= b : op === ">" ? a > b : op === "<" ? a < b : op === "=" ? a === b : op === "≠" ? a !== b : false;

export type ClauseStatus = "pass" | "fail" | "skip";
export interface ClauseEval { text: string; status: ClauseStatus; detail: string }
export interface GroupEval { joiner: Joiner; status: ClauseStatus; clauses: ClauseEval[] }
export interface RuleEval { hit: boolean; groups: GroupEval[]; blockers: string[] }

// 求一条子句在某交易上的阈值(考虑分层取档 / 相对基线),返回阈值 + 说明,或不可判定。
function thresholdOf(c: Clause, tx: ReplayTx): { thr: number; note: string } | { skip: string } {
  const field = c.field;
  if (c.tiers && c.tiers.rows.length) {
    const key = tx.seg[c.tiers.dim];
    const row = c.tiers.rows.find((r) => r.key === key) || c.tiers.rows.find((r) => r.key === "默认") || c.tiers.rows[0];
    if (!row || !row.value) return { skip: "分层阈值无匹配档位" };
    return { thr: num(row.value), note: `按${c.tiers.dim}取「${row.key}」档 = ${row.value}` };
  }
  const basis = c.basis ?? "abs";
  if (basis === "abs") return { thr: num(c.value), note: `固定阈值 ${c.value}` };
  const b = tx.base[field];
  if (!b) return { skip: "该交易无此指标的基线 / 群体参照,单笔回放无法判定" };
  if (basis === "self") return { thr: b.mean * num(c.value), note: `自身基线 ${b.mean} ×${c.value} = ${Math.round(b.mean * num(c.value))}` };
  if (basis === "peer") return { thr: b.p95, note: `同业群 P${c.value} ≈ ${b.p95}(演示参照)` };
  if (basis === "sigma") return { thr: b.mean + num(c.value) * b.std, note: `均值 ${b.mean} + ${c.value}σ(σ=${b.std}) = ${Math.round(b.mean + num(c.value) * b.std)}` };
  return { skip: "未知基准" };
}

function evalClause(c: Clause, tx: ReplayTx): ClauseEval {
  const text = clauseText(c);
  // 类别型:命中 / 包含 / 等于
  if (CATEGORICAL_FIELDS.includes(c.field)) {
    const raw = tx.tags[c.field];
    if (raw === undefined) return { text, status: "skip", detail: "该交易无此字段" };
    if (typeof raw === "string") {
      const hit = c.op === "≠" ? raw !== c.value : raw === c.value || raw.includes(c.value);
      return { text, status: hit ? "pass" : "fail", detail: `实际「${raw || "—"}」` };
    }
    const hit = raw.some((t) => t.includes(c.value) || c.value.includes(t)) || (raw.length > 0 && (c.value.trim() === "" || c.value.includes("/")));
    return { text, status: hit ? "pass" : "fail", detail: raw.length ? `实际标签:${raw.join(" / ")}` : "无标签" };
  }
  // 数值型
  if (!isNumericField(c.field)) return { text, status: "skip", detail: "字段不可在单笔回放求值" };
  const actual = tx.vals[c.field];
  if (actual === undefined) return { text, status: "skip", detail: "该交易无此指标数据" };
  const t = thresholdOf(c, tx);
  if ("skip" in t) return { text, status: "skip", detail: t.skip };
  const pass = cmp(actual, c.op, t.thr);
  return { text, status: pass ? "pass" : "fail", detail: `实际 ${actual} ${c.op} ${Math.round(t.thr)} · ${t.note}` };
}

// 子组内按 joiner 聚合(skip 视为不参与:AND 下不阻断、OR 下不贡献);子组间按 outerJoiner 聚合。
function combine(joiner: Joiner, statuses: ClauseStatus[]): ClauseStatus {
  const active = statuses.filter((s) => s !== "skip");
  if (!active.length) return "skip";
  return joiner === "AND" ? (active.every((s) => s === "pass") ? "pass" : "fail") : active.some((s) => s === "pass") ? "pass" : "fail";
}

export function evalRule(groups: ClauseGroup[], outerJoiner: Joiner, tx: ReplayTx): RuleEval {
  const ge: GroupEval[] = groups
    .map((g) => ({ joiner: g.joiner, clauses: g.clauses.filter((c) => c.field && c.op).map((c) => evalClause(c, tx)) }))
    .filter((g) => g.clauses.length)
    .map((g) => ({ ...g, status: combine(g.joiner, g.clauses.map((c) => c.status)) }));
  const overall = combine(outerJoiner, ge.map((g) => g.status));
  const hit = overall === "pass";
  // 不命中时:列出阻断项 —— OR 子组全失败时列各子组里的失败子句;AND 子组里列失败子句。
  const blockers: string[] = [];
  if (!hit) ge.forEach((g) => g.clauses.filter((c) => c.status === "fail").forEach((c) => blockers.push(`${c.text}(${c.detail})`)));
  return { hit, groups: ge, blockers };
}
