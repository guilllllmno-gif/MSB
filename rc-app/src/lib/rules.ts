// 监控规则 + 规则回填闭环。规则有治理生命周期:回填/提案 → 回测 → 待审批 → 上线生效(事中拦截) / 驳回 / 停用。
// 事后监控「规则回填」(findingStore.backfill)的命中实时派生为规则草案汇入此处 —— 闭环可见。状态/经手/事件存 store.ts 的 ruleStore。
import { DollarSign, Link2, Activity, ShieldAlert, Gauge, Network, Power, FlaskConical, CheckCircle2, XCircle, RotateCcw, Ban } from "lucide-react";
import type { Tone, Person } from "./data";

export type RuState = "live" | "backtest" | "pending" | "rejected" | "disabled";
export const RUSTATE: Record<RuState, { label: string; tone: Tone; active: boolean }> = {
  live: { label: "已上线 · 生效", tone: "green", active: true },
  backtest: { label: "回测中", tone: "blue", active: true },
  pending: { label: "待审批", tone: "amber", active: true },
  rejected: { label: "已驳回", tone: "grey", active: false },
  disabled: { label: "已停用", tone: "grey", active: false },
};

export type RuCat = "金额阈值" | "链上溯源" | "行为模式" | "名单筛查" | "评分模型" | "统计聚合";
export const CATS: RuCat[] = ["金额阈值", "链上溯源", "行为模式", "名单筛查", "评分模型", "统计聚合"];

// 执行场景:事中(实时闸口)/ 事后(批量回溯)/ 两者 —— 决定规则能否实时拦截
export type Venue = "gate" | "batch" | "both";
export const VENUE: Record<Venue, { label: string; short: string; tone: Tone; hint: string }> = {
  gate: { label: "事中 · 实时闸口", short: "事中", tone: "blue", hint: "交易发生时即可实时判定 —— 单笔阈值 / 名单 / 地址风险 / 同主体滑窗累计。可当场放行 / 拒绝。" },
  batch: { label: "事后 · 批量回溯", short: "事后", tone: "violet", hint: "需跨时间 / 跨主体聚合,实时算不出 —— 扇入归集 / 速度偏离 / 对手集中度 / 链跳回溯。只能批量回扫。" },
  both: { label: "事中 + 事后", short: "事中+事后", tone: "green", hint: "事中先做近实时标记 / 拦截,事后批量复扫补全(如链上溯源、扇入图关联)。" },
};
// 未显式标场景时:统计聚合类默认事后,其余默认事中
export const venueOf = (r: { cat: RuCat; venue?: Venue }): Venue => r.venue || (r.cat === "统计聚合" ? "batch" : "gate");
export const CAT_ICON: Record<RuCat, typeof DollarSign> = {
  金额阈值: DollarSign, 链上溯源: Link2, 行为模式: Activity, 名单筛查: ShieldAlert, 评分模型: Gauge, 统计聚合: Network,
};

// 状态门控动作(变更治理:回测 / 审批 / 上线 / 停用)
export interface RuAction { k: string; label: string; to: RuState; icon: typeof Power; tip: string; tone?: Tone }
export const RUFLOW: Record<RuState, RuAction[]> = {
  backtest: [
    { k: "submit", label: "回测达标 · 提交审批", to: "pending", icon: FlaskConical, tip: "回测命中率 / 误报达标,提交变更审批", tone: "amber" },
    { k: "drop", label: "作废草案", to: "rejected", icon: Ban, tip: "回测不达标 · 作废草案", tone: "grey" },
  ],
  pending: [
    { k: "approve", label: "审批上线 · 事中生效", to: "live", icon: CheckCircle2, tip: "审批通过 · 由事中闸口实时拦截同类", tone: "green" },
    { k: "reject", label: "驳回 · 退回修订", to: "rejected", icon: XCircle, tip: "驳回 · 退回修订阈值", tone: "red" },
  ],
  live: [
    { k: "disable", label: "停用规则", to: "disabled", icon: Power, tip: "停用 · 事中不再按此规则拦截", tone: "grey" },
  ],
  disabled: [
    { k: "enable", label: "重新启用 · 上线", to: "live", icon: Power, tip: "重新上线生效", tone: "green" },
  ],
  rejected: [
    { k: "retest", label: "修订后重新回测", to: "backtest", icon: RotateCcw, tip: "调整阈值后重新回测", tone: "blue" },
  ],
};

export interface Backtest { window: string; scanned: string; wouldHit: number; estFp: string }

// 结构化条件:IF 子句(AND 连接)… THEN 处置 ELSE 否则
// window:滑动时间窗口 —— 指标(累计金额/笔数/对手集中度/扇入主体数)与窗口解耦,
// 同一指标可配任意窗口(48h 内累计 ≥$9k 抓拆分 / 24h 内笔数突增抓速度),不再把窗口焊死在字段名里。
// basis:比较基准 —— 不只绝对值,可对相对基线比较(× 自身历史基线 / 同业群 P 百分位 / 偏离均值 σ),
// 按「异常程度」抓而非写死固定阈值。复用案件详情已有的 BaselinePair「本次 vs 历史常态」语言。
export type Basis = "abs" | "self" | "peer" | "sigma";
// ③ 分层阈值:同一条件按维度(KYC 等级 / 业务线 / 注册地)取不同阈值 —— 一条规则一张档位表,
// 不必为「VIP $50k 正常、新户 $5k 就拦」写一堆近乎重复的规则。仅对绝对值基准开放(相对基线已按主体自适应)。
export interface ClauseTier { key: string; value: string }
export interface ClauseTiers { dim: string; rows: ClauseTier[] }
export interface Clause { field: string; op: string; value: string; window?: string; basis?: Basis; tiers?: ClauseTiers }
export const TIER_DIMS = ["KYC 等级", "业务线", "注册地"];
export const TIER_KEYS: Record<string, string[]> = {
  "KYC 等级": ["VIP / 已验证", "标准", "新户 / 未验证", "默认"],
  "业务线": ["Off-ramp 出金", "On-ramp 入金", "兑换 · 币币", "默认"],
  "注册地": ["高风险辖区", "标准辖区", "默认"],
};
export const isTiered = (c: Clause) => !!c.tiers && c.tiers.rows.length > 0;
export const RULE_FIELDS = ["单笔金额 (CAD)", "滑窗累计金额 (CAD)", "滑窗笔数", "对手集中度 (%)", "扇入主体数", "KYW 评分", "综合风险评分", "账户休眠天数", "账户年龄 (天)", "地址风险标签", "名单", "跨链 / 隐私币", "KYB 状态"];
// 窗口型指标:需配一个滑动窗口才有意义(跨时间聚合);其余为即时 / 单笔指标,无窗口。
export const WINDOWED_FIELDS = ["滑窗累计金额 (CAD)", "滑窗笔数", "对手集中度 (%)", "扇入主体数"];
export const isWindowedField = (f?: string) => !!f && WINDOWED_FIELDS.includes(f);
export const WINDOW_OPTS = ["1 小时", "24 小时", "48 小时", "7 天", "14 天", "30 天"];
// 自定义窗口:下拉选「自定义」时落此哨兵(未填完整,校验不通过),手填后存真实文本(如「36 小时」)。
export const CUSTOM_WINDOW = "__custom__";
export const isCustomWindow = (w?: string) => !!w && w !== CUSTOM_WINDOW && !WINDOW_OPTS.includes(w);
// 类别型指标只能「命中 / 包含」,不支持相对基线;其余数值指标可选比较基准。
export const CATEGORICAL_FIELDS = ["地址风险标签", "名单", "跨链 / 隐私币", "KYB 状态"];
export const isNumericField = (f?: string) => !!f && RULE_FIELDS.includes(f) && !CATEGORICAL_FIELDS.includes(f);
export const RULE_BASES: { key: Basis; label: string; hint: string; unitPrefix: string; unitSuffix: string; ph: string }[] = [
  { key: "abs", label: "绝对值", hint: "与固定 / 法定阈值比较 —— 抓 LVCTR 大额、Travel Rule、制裁命中", unitPrefix: "", unitSuffix: "", ph: "阈值" },
  { key: "self", label: "× 自身历史基线", hint: "倍于该主体历史常态(均单 / 均笔频)—— 抓休眠突发 / 账户接管(VIP 高基线不误报、新户低基线即触发)", unitPrefix: "", unitSuffix: "×", ph: "倍数" },
  { key: "peer", label: "同业群百分位 P", hint: "高于同业商户群的 P 分位(群体离群)—— 抓速度 / 峰值偏离、自身无历史可比的新户", unitPrefix: "P", unitSuffix: "", ph: "百分位" },
  { key: "sigma", label: "偏离均值 σ", hint: "偏离自身均值 N 个标准差(按波动自适应)—— 抓做市 / 促销等高波动账户的真异常,不被自身波动淹没", unitPrefix: "", unitSuffix: "σ", ph: "标准差数" },
];
export const RULE_OPS = ["≥", "≤", ">", "<", "=", "≠", "命中", "包含"];
export const RULE_ELSE = ["放行 · 无需处置", "继续监控", "加强监控", "转研判"];
// 单条子句可读文本:窗口型指标前缀「⟨窗口⟩内」;相对基准展开为 ×基线 / 同业群 P / 偏离均值 σ。
export const clauseText = (c: Clause) => {
  const win = c.window ? `${c.window}内 ` : "";
  if (c.tiers && c.tiers.rows.length) {
    const amt = isAmountField(c.field);
    const body = c.tiers.rows.filter((r) => r.key && r.value).map((r) => `${r.key}: ${amt ? "$" : ""}${r.value}`).join(" / ");
    return `${win}${c.field} ${c.op} 按${c.tiers.dim}分档(${body})`;
  }
  switch (c.basis) {
    case "self": return `${win}${c.field} ${c.op} 自身历史基线 ×${c.value}`;
    case "peer": return `${win}${c.field} ${c.op} 同业群 P${c.value}`;
    case "sigma": return `${win}${c.field} 偏离均值 ${c.op} ${c.value}σ`;
    default: return `${win}${c.field} ${c.op} ${c.value}`;
  }
};
export const condText = (cs: Clause[]) => cs.filter((c) => c.field && c.op && c.value).map(clauseText).join(" 且 ");

// ── ② AND/OR 一层嵌套子组:(A 且 B) 或 (C 且 D) —— 一条规则覆盖多条独立可疑路径,不必拆成多条规则 ──
// 单子组退化为普通 clauses(向后兼容);多子组时存 groups + outerJoiner,condText 自动加括号渲染。
export interface ClauseGroup { joiner: Joiner; clauses: Clause[] }
const joinZh = (j: Joiner) => (j === "AND" ? " 且 " : " 或 ");
export const groupText = (g: ClauseGroup) => g.clauses.filter((c) => c.field && c.op && c.value).map(clauseText).join(joinZh(g.joiner));
export const groupsText = (gs: ClauseGroup[], outer: Joiner) => {
  const live = gs.map((g) => ({ ...g, clauses: g.clauses.filter((c) => c.field && c.op && c.value) })).filter((g) => g.clauses.length);
  if (!live.length) return "";
  if (live.length === 1) return groupText(live[0]);
  return live.map((g) => `(${groupText(g)})`).join(joinZh(outer));
};

// ── 新建规则:典型 typology 模板(一键预填,从空白起步 → 有起点;借鉴 Fireblocks 的模板化配置)──
// 与回填闭环的 BFR typology 对齐,但带结构化 clauses(可直接进条件构造器编辑)。
export interface RuleTemplate { key: string; desc: string; name: string; cat: RuCat; venue: Venue; clauses: Clause[]; action: string; weight: string }
export const RULE_TEMPLATES: RuleTemplate[] = [
  { key: "大额单笔", desc: "单笔超阈值即评分转研判", name: "大额单笔阈值", cat: "金额阈值", venue: "gate", clauses: [{ field: "单笔金额 (CAD)", op: "≥", value: "10,000" }], action: "评分 +25 · 转研判", weight: "+25" },
  { key: "结构化拆分", desc: "滑动窗口内累计入金 + 笔数双达标(规避 LVCTR)", name: "滑窗结构化拆分", cat: "统计聚合", venue: "gate", clauses: [{ field: "滑窗累计金额 (CAD)", op: "≥", value: "9,000", window: "48 小时" }, { field: "滑窗笔数", op: "≥", value: "5", window: "48 小时" }], action: "评分 +40 · 转研判", weight: "+40" },
  { key: "多账户扇入", desc: "多主体短窗内汇入同一非托管地址", name: "多主体扇入同一地址", cat: "统计聚合", venue: "both", clauses: [{ field: "扇入主体数", op: "≥", value: "4", window: "14 天" }], action: "评分 +40 · 转研判", weight: "+40" },
  { key: "休眠后突发", desc: "长期休眠后短窗内出金笔频突破自身基线", name: "休眠激活异常", cat: "行为模式", venue: "gate", clauses: [{ field: "账户休眠天数", op: "≥", value: "60" }, { field: "滑窗笔数", op: "≥", value: "5", window: "24 小时", basis: "self" }], action: "评分 +30 · 加强监控", weight: "+30" },
  { key: "对手集中度", desc: "单一对手窗口内金额占比过高", name: "对手集中度异常", cat: "统计聚合", venue: "batch", clauses: [{ field: "对手集中度 (%)", op: "≥", value: "75", window: "30 天" }], action: "评分 +20 · 加强监控", weight: "+20" },
  { key: "币币链跳", desc: "兑入隐私币 / 经跨链桥转出", name: "隐私币 / 跨链跳转", cat: "链上溯源", venue: "both", clauses: [{ field: "跨链 / 隐私币", op: "命中", value: "隐私币 / 跨链桥" }], action: "评分 +45 · 转研判", weight: "+45" },
];

// ── 回测调阈值:从规则 cond 抠出「主阈值」(数值 + 单位 + 放宽方向),供回测台把真实参数做成可拖滑块 ──
// lowerLooser:降低该值 = 放宽(更多命中)。≥/> 型为 true;≤/< 型(如「≤2 跳」)为 false。
export interface ThParam { value: number; start: number; len: number; prefix: string; unit: string; lowerLooser: boolean; currency: boolean }
export function parseThreshold(cond: string): ThParam | null {
  let m = cond.match(/(CAD)\s*([\d,]+)/); // A. 货币(带千分位)
  if (m) {
    const numStr = m[2], start = m.index! + m[0].indexOf(numStr);
    return { value: parseFloat(numStr.replace(/,/g, "")), start, len: numStr.length, prefix: "CAD ", unit: "", lowerLooser: !/[≤<]\s*CAD/.test(cond), currency: true };
  }
  m = cond.match(/P(\d{1,3})\b/); // B. 百分位 P95
  if (m) return { value: parseFloat(m[1]), start: m.index! + 1, len: m[1].length, prefix: "P", unit: "", lowerLooser: true, currency: false };
  m = cond.match(/(≥|≤|>|<)\s*([\d][\d,.]*)\s*(%|×|x|倍|笔|跳|h|小时|天|次|分|主体)?/); // C. 比较运算符紧邻的数
  if (m) {
    const op = m[1], numStr = m[2], start = m.index! + m[0].indexOf(numStr);
    return { value: parseFloat(numStr.replace(/,/g, "")), start, len: numStr.length, prefix: "", unit: m[3] || "", lowerLooser: op === "≥" || op === ">", currency: false };
  }
  return null;
}
export const fmtThresh = (v: number, currency: boolean) => (currency ? Math.round(v).toLocaleString() : Number.isInteger(v) ? `${v}` : v.toFixed(1));
export const spliceThresh = (cond: string, p: ThParam, v: number) => cond.slice(0, p.start) + fmtThresh(v, p.currency) + cond.slice(p.start + p.len);

// ── 版本历史 / 回滚:回滚只还原「内容字段」(触发条件 / 权重 / 处置),不动状态机 ──
export interface RuleVersion { v: number; date: string; by: Person; summary: string; fields: { cond?: string; weight?: string; action?: string } }
function monthShift(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  let mm = m + n, yy = y;
  while (mm < 1) { mm += 12; yy--; }
  while (mm > 12) { mm -= 12; yy++; }
  return `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(d || 1, 28)).padStart(2, "0")}`;
}
// 演示态:从规则当前内容派生一条可信的版本谱系(初始 → 调整 → 当前),供版本历史 / 回滚展示。最新在前。
export function seedVersions(rule: Rule): RuleVersion[] {
  const p = parseThreshold(rule.cond);
  const curW = parseInt(rule.weight.replace(/[^0-9]/g, ""), 10) || 0;
  const prevW = Math.max(5, curW - 5), initW = Math.max(5, prevW - 5);
  const at = (k: number) => (p ? spliceThresh(rule.cond, p, Math.round(p.lowerLooser ? p.value * k : p.value * (2 - k))) : rule.cond);
  const ordered = [
    { date: monthShift(rule.updated, -5), by: rule.owner, summary: "初始上线", fields: { cond: at(1.3), weight: `+${initW}`, action: rule.action } },
    { date: monthShift(rule.updated, -2), by: RH, summary: p ? "放宽阈值 · 提升召回" : "上调命中权重", fields: { cond: at(1.15), weight: `+${prevW}`, action: rule.action } },
    { date: rule.updated, by: rule.owner, summary: "当前版本", fields: { cond: rule.cond, weight: rule.weight, action: rule.action } },
  ];
  return ordered.map((e, i) => ({ ...e, v: i + 1 })).reverse();
}

// ── 变更治理:比对「线上现版」与「拟议变更」的内容字段差异(供编辑抽屉摘要 / 详情横幅 / 审批箱复用)──
export interface FieldDiff { label: string; from: string; to: string }
export function ruleFieldDiffs(cur: Partial<Rule>, next: Partial<Rule>): FieldDiff[] {
  const out: FieldDiff[] = [];
  const cmp = (label: string, a?: string, b?: string) => { if (b !== undefined && a !== b) out.push({ label, from: a ?? "—", to: b ?? "—" }); };
  cmp("触发条件", cur.cond, next.cond);
  cmp("命中权重", cur.weight, next.weight);
  cmp("处置", cur.action, next.action);
  cmp("规则名称", cur.name, next.name);
  // ⑤ 上线策略也纳入变更治理(改线上规则的影子 / 灰度 / 到期同样需审批)
  const sh = (v?: boolean) => (v ? "影子模式" : "实拦");
  if (next.shadow !== undefined) cmp("处置模式", sh(cur.shadow), sh(next.shadow));
  const ro = (v?: number) => (typeof v === "number" ? `${v}%` : "100%");
  if (next.rollout !== undefined) cmp("灰度比例", ro(cur.rollout), ro(next.rollout));
  if (next.expiry !== undefined) cmp("到期日", cur.expiry || "永久", next.expiry || "永久");
  return out;
}
export const ruleChangeSummary = (diffs: FieldDiff[]) => (diffs.length ? diffs.map((d) => `${d.label} ${d.from} → ${d.to}`).join(" · ") : "无字段变更");

export interface Rule {
  id: string; name: string; cat: RuCat; venue?: Venue; cond: string; action: string; state: RuState;
  hits30: number; fp30: string; src: string; srcId?: string; to?: string;
  owner: Person; updated: string; weight: string; backtest?: Backtest; clauses?: Clause[]; groups?: ClauseGroup[]; outerJoiner?: Joiner; otherwise?: string;
  // 新增规则界面补充的可选元数据(向后兼容,内置规则可不填)
  scope?: string; network?: string; desc?: string; mode?: RuleMode; stopScan?: boolean;
  actions?: string[]; escalation?: string; severity?: Severity; joiner?: Joiner;
  // ⑤ 上线策略:影子模式(只告警不处置评估期)/ 到期日(到点自动失效)/ 灰度比例(按比例放量)
  shadow?: boolean; expiry?: string; rollout?: number;
}
// 上线策略摘要(供详情 / 列表显徽标);返回各项可读文案。rollout 100 / 留空 视为全量。
export interface RolloutBadge { label: string; tone: Tone }
export function rolloutBadges(r: { shadow?: boolean; expiry?: string; rollout?: number }): RolloutBadge[] {
  const out: RolloutBadge[] = [];
  if (r.shadow) out.push({ label: "影子模式 · 只告警不处置", tone: "violet" });
  if (typeof r.rollout === "number" && r.rollout < 100) out.push({ label: `灰度 ${r.rollout}%`, tone: "amber" });
  if (r.expiry) out.push({ label: `到期 ${r.expiry}`, tone: "blue" });
  return out;
}
export type RuleMode = "score" | "alert";  // 规则操作:仅评分 / 生成告警
export type Severity = "低" | "中" | "高" | "极高";
export type Joiner = "AND" | "OR";
// 新增规则界面的下拉选项
export const RULE_SCOPES = ["充值通用", "提现", "兑换 · 币币", "On-ramp · 法币买币", "Off-ramp · 卖币出金", "全部业务线"];
export const RULE_NETWORKS = ["全部网络", "Bitcoin", "Ethereum", "Tron", "Solana", "BSC", "Polygon"];
export const RULE_ESCALATIONS = ["L1 → L2 → MLRO", "L1 → MLRO", "直接 MLRO", "L1 研判结案"];
export const RULE_DISPOSITIONS = ["智能入账(转人工审核)", "冻结资金并升级 MLRO", "要求补充材料", "拒绝交易", "仅记录"];
export const SEVERITIES: Severity[] = ["低", "中", "高", "极高"];
// 运算符的中文标签(下拉里显示更直白)
export const OP_LABEL: Record<string, string> = { "≥": "≥ 大于等于", "≤": "≤ 小于等于", ">": "> 大于", "<": "< 小于", "=": "= 等于", "≠": "≠ 不等于", "命中": "命中", "包含": "包含" };
// 金额类字段(取值带 $ / CAD 装饰)
export const isAmountField = (f?: string) => !!f && f.includes("CAD");

const JL: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const EZ: Person = { i: "EZ", n: "Emma Zhang", c: "var(--success)" };
const RH: Person = { i: "RH", n: "Raj Hota", c: "#0ea5e9" }; // 风控建模 / 变更治理

// 内置(事中 / 告警长期生效)规则 + 治理流水线中的提案
export const RULES: Rule[] = [
  { id: "R-AMT-001", name: "大额充值监控", cat: "金额阈值", cond: "单笔充值 ≥ CAD 5,000", action: "评分 +60 · 转研判", state: "live", hits30: 142, fp30: "6%", src: "内置", owner: JL, updated: "2026-04-12", weight: "+60" },
  { id: "R-AMT-002", name: "大额提现监控", cat: "金额阈值", cond: "单笔提现 ≥ CAD 3,000", action: "评分 +55 · 转研判", state: "live", hits30: 98, fp30: "9%", src: "内置", owner: JL, updated: "2026-04-12", weight: "+55" },
  { id: "R-CHN-001", name: "混币器关联", cat: "链上溯源", venue: "both", cond: "资金 ≤2 跳触及制裁混币器", action: "评分 +35 · 冻结", state: "live", hits30: 12, fp30: "2%", src: "内置", owner: SC, updated: "2026-05-03", weight: "+35" },
  { id: "R-LST-001", name: "制裁地址命中", cat: "名单筛查", cond: "收 / 发方命中 OFAC / UN", action: "直接拦截 · 冻结 · 升级 MLRO", state: "live", hits30: 3, fp30: "0%", src: "内置", owner: EZ, updated: "2026-02-20", weight: "+100" },
  { id: "R-SCR-001", name: "KYW 评分超阈值", cat: "评分模型", cond: "收款钱包 KYW 评分 > 70", action: "评分 +50 · 转研判", state: "live", hits30: 27, fp30: "14%", src: "内置", owner: SC, updated: "2026-05-19", weight: "+50" },
  { id: "R-BHV-001", name: "高频拆分入金(单笔)", cat: "行为模式", cond: "24h 内 ≥5 笔且金额相近", action: "评分 +30 · 转研判", state: "live", hits30: 19, fp30: "21%", src: "内置", owner: JL, updated: "2026-03-28", weight: "+30" },
  { id: "R-BHV-002", name: "快进快出钱包", cat: "行为模式", cond: "入金后 1h 内转出 > 80%", action: "评分 +28 · 加强监控", state: "live", hits30: 15, fp30: "18%", src: "内置", owner: JL, updated: "2026-03-28", weight: "+28" },
  { id: "R-BHV-003", name: "新商户首充", cat: "行为模式", cond: "商户首笔 且 KYB 未完成", action: "评分 +20 · 待 KYB", state: "live", hits30: 33, fp30: "26%", src: "内置", owner: JL, updated: "2026-04-30", weight: "+20" },
  { id: "R-CHN-002", name: "高风险地址检测", cat: "链上溯源", cond: "发送方含风险标签", action: "评分 +25", state: "live", hits30: 64, fp30: "11%", src: "内置", owner: SC, updated: "2026-05-03", weight: "+25" },
  // 治理流水线中的提案(展示回测 / 待审批态)
  { id: "R-AGG-009", name: "速度 / 峰值偏离", cat: "统计聚合", cond: "笔频 > 同业群 P95 且 > 自身基线 5×", action: "评分 +25 · 转研判", state: "pending", hits30: 0, fp30: "回测 7%", src: "风控建模 · 提案", owner: RH, updated: "2026-06-18", weight: "+25", backtest: { window: "近 90 天", scanned: "108.4M", wouldHit: 41, estFp: "≈ 7%" } },
  { id: "R-AGG-010", name: "对手集中度", cat: "统计聚合", cond: "单一对手 30 日金额占比 ≥75% 且高风险辖区", action: "评分 +20 · 加强监控", state: "backtest", hits30: 0, fp30: "—", src: "风控建模 · 提案", owner: RH, updated: "2026-06-19", weight: "+20", backtest: { window: "回测中 …", scanned: "—", wouldHit: 0, estFp: "—" } },
];

export const ruleOf = (id?: string) => RULES.find((r) => r.id === id);

// 规则回填 → 派生规则草案(命中 backfill 的 typology)。历史回填(静态 backfill)默认已上线;本会话新回填的进回测。
export const BFR: Record<string, { name: string; cat: RuCat; venue: Venue; cond: string; action: string; weight: string }> = {
  "结构化拆分(累计)": { name: "同主体滑窗累计阈值", cat: "统计聚合", venue: "gate", cond: "同主体 7 日累计入金 ≥ CAD 10,000", action: "评分 +40 · 转研判", weight: "+40" },
  "多账户归集(扇入)": { name: "多主体扇入同一地址", cat: "统计聚合", venue: "both", cond: "≥4 主体 14 日内汇入同一非托管地址", action: "转研判 · 图关联标记", weight: "+40" },
  "休眠后突发": { name: "休眠激活异常", cat: "行为模式", venue: "gate", cond: "休眠 ≥60 天后单日出金笔数 ≥ 基线 5×", action: "评分 +30", weight: "+30" },
  "币币链跳(回溯)": { name: "隐私币 / 跨链跳转", cat: "链上溯源", venue: "both", cond: "兑入隐私币 或 经跨链桥转出", action: "评分 +45 · 转研判", weight: "+45" },
};
export const bfrMeta = (pattern: string) => BFR[pattern] || { name: `${pattern}（回填）`, cat: "统计聚合" as RuCat, venue: "gate" as Venue, cond: "回填 typology · 待补条件", action: "评分 +N", weight: "+30" };
export const bfrDefault = (staticBackfill?: boolean): RuState => (staticBackfill ? "live" : "backtest");
