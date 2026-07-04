// ── Risk Control System · 交易警报 dataset (ported from rc-alerts-data.js, faithful to the Figma) ──
export type Tone = "green" | "amber" | "red" | "blue" | "violet" | "grey";
import { slaOf, type SlaTier, type SlaView } from "./sla";

// tone → [底色, 主色, 描边] CSS 变量三元组。与 Tone 类型同处一源。
export const TONE: Record<Tone, [string, string, string]> = {
  green: ["var(--success-bg)", "var(--success)", "var(--success-bd)"],
  amber: ["var(--warning-bg)", "var(--warning)", "var(--warning-bd)"],
  red: ["var(--danger-bg)", "var(--danger)", "var(--danger-bd)"],
  blue: ["var(--brand-soft)", "var(--brand)", "var(--brand-bd)"],
  violet: ["var(--violet-bg)", "var(--violet)", "var(--violet-bd)"],
  grey: ["var(--chip-bg)", "var(--chip-fg)", "var(--chip-bd)"],
};
export const toneVar = (t: Tone) => TONE[t][1];

// tone → 前景色(完整映射,每个 tone 落自己的语义色;grey / 未知落静默灰 --text-3)。
// 取代散落各页的本地 `tc()` 副本(语义完全一致)。入参用 string 以兼容非 Tone 的取值。
export const toneColor = (t: string): string =>
  t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" :
  t === "green" ? "var(--success)" : t === "violet" ? "var(--violet)" :
  t === "blue" ? "var(--brand)" : "var(--text-3)";

// 紧迫度前景色:只有 red / amber 上色,其余(正常态)落 `fallback`。
// fallback 显式传参 —— 各处"正常态"用的静默色本就不同(--text-3 / --text-2 / --success / --brand),
// 保留其语义、不强行统一,只消除重复的三元副本。
export const urgencyColor = (t: string, fallback = "var(--text-3)"): string =>
  t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : fallback;

export interface Person { i: string; n: string; c: string }
export interface Rule { name: string; cat: string; cond: string; hit: string; weight: string }
export interface Factor { emoji: string; bg: string; fg: string; title: string; desc: string }
export interface Alert {
  id: string; state: string; order: string; sev: "high" | "mid" | "low"; score: number; level: string; type: string;
  title: string; ruleShort: string; ago: string; submitted: string;
  assignee: Person | null;
  amount: string; asset: string; network: string;
  txHash: string; confirmations: string; sender: string; receiver: string;
  merchant: string; country: string; merchantTier: [string, Tone]; kyb: string; accountAge: string;
  rules: Rule[]; trace: [string, Tone][]; traceNote: string; factors: Factor[];
  addrIntel: { age: string; labels: string[]; networkSeen: string; priorBlocks: string };
  sanctions: { status: string; list: string; note: string };
  custHistory: { orders: string; violations: string; vol30: string; limit: string };
  timeline: [string, string, string][]; recommendation: string; checklist: [string, boolean][];
}

const f = (emoji: string, bg: string, fg: string, title: string, desc: string): Factor => ({ emoji, bg, fg, title, desc });

export const alerts: Alert[] = [
  {
    id: "ALT-50231", state: "new", order: "DEP-20260315-001", sev: "high", score: 95, level: "Highest", type: "充值",
    title: "混币器关联充值", ruleShort: "混币器关联 / 大额充值", ago: "14 分钟前", submitted: "2026-03-15 09:30:15",
    assignee: null,
    amount: "CAD 8,200.00", asset: "8,180 USDT", network: "ERC-20",
    txHash: "0x9b3c…a01f", confirmations: "32 / 32", sender: "0x5078…Ec8c", receiver: "0x91Ad…77F2（商户托管）",
    merchant: "NovaPay Technologies Ltd.", country: "美国", merchantTier: ["中风险 · 新商户", "amber"], kyb: "未完成", accountAge: "5 天",
    rules: [
      { name: "大额充值监控", cat: "金额阈值", cond: "单笔 ≥ CAD 5,000", hit: "CAD 8,200", weight: "+60" },
      { name: "混币器关联", cat: "链上溯源", cond: "资金 ≤2 跳触及制裁地址", hit: "Tornado Cash", weight: "+35" },
    ],
    trace: [["Tornado Cash 92%", "red"], ["中转地址 ×3", "amber"], ["发送方 0x5078…", "grey"], ["商户托管钱包", "blue"]],
    traceNote: "92% 入金资产可溯源至 Tornado Cash 混币器（OFAC 制裁实体），经 3 个中转地址在 36 小时内归集至发送方。",
    factors: [
      f("⛓", "var(--danger-bg)", "var(--danger)", "链上溯源 92% 来自 Tornado Cash", "OFAC 制裁混币器"),
      f("💰", "var(--warning-bg)", "var(--warning)", "单笔 CAD 8,200，为商户均值 5.5×", "偏离基线"),
      f("🏷", "var(--warning-bg)", "var(--warning)", "商户首充且 KYB 未完成", "注册 < 7 天"),
    ],
    addrIntel: { age: "18 天", labels: ["混币器关联", "高风险"], networkSeen: "网络内 7 家商户出现", priorBlocks: "历史被拦截 3 次" },
    sanctions: { status: "间接命中", list: "OFAC（经混币器）", note: "非直接命中，但资金溯源触及制裁实体" },
    custHistory: { orders: "1（首笔）", violations: "关联 3 笔历史违规", vol30: "CAD 8,200", limit: "CAD 5,000 / 笔" },
    timeline: [
      ["2026-03-15 09:30:15", "订单提交 · 规则引擎命中 2 条", "done"],
      ["2026-03-15 09:30:16", "AI 风险预判完成 · 评分 95（Highest）", "done"],
      ["待处理", "等待审核决策", ""],
    ],
    recommendation: "驳回并冻结资金，升级至 MLRO 评估是否触发 STR 上报。链上溯源命中制裁混币器，放行风险极高。",
    checklist: [["核验链上溯源报告（Chainalysis）", true], ["确认商户 KYB 资料是否可补齐", false], ["评估是否需起草 STR 转合规", false]],
  },
  {
    id: "ALT-50229", state: "progress", order: "WD-20260314-058", sev: "high", score: 88, level: "Highest", type: "提现",
    title: "KYW 评分超阈值提现", ruleShort: "KYW 评分超过阈值", ago: "50 分钟前", submitted: "2026-03-14 08:54:02",
    assignee: { i: "SC", n: "Sarah Chen", c: "var(--brand)" },
    amount: "CAD 21,400.00", asset: "0.34 BTC", network: "BTC",
    txHash: "（待广播）", confirmations: "出金待审", sender: "商户托管钱包", receiver: "bc1q…7h2k",
    merchant: "BlockTrade Corp.", country: "美国", merchantTier: ["中风险", "amber"], kyb: "完成", accountAge: "1.2 年",
    rules: [
      { name: "KYW 评分超阈值", cat: "评分", cond: "收款钱包 KYW 评分 > 70", hit: "88", weight: "+50" },
      { name: "大额提现监控", cat: "金额阈值", cond: "单笔 ≥ CAD 3,000", hit: "CAD 21,400", weight: "+55" },
    ],
    trace: [["商户托管钱包", "blue"], ["接收方 bc1q…", "grey"], ["高风险地区交易所", "red"]],
    traceNote: "出金目标钱包 KYW 风险评分 88，关联高风险司法管辖区交易所，需核实提现合理性与资金用途。",
    factors: [
      f("📊", "var(--danger-bg)", "var(--danger)", "收款钱包 KYW 评分 88 > 阈值 70", "钱包级风险超限"),
      f("🌐", "var(--warning-bg)", "var(--warning)", "接收方位于高风险司法管辖区", "FATF 灰名单"),
      f("💰", "var(--warning-bg)", "var(--warning)", "单笔 CAD 21,400 大额提现", "超阈值 7×"),
    ],
    addrIntel: { age: "2 年+", labels: ["交易所", "高风险地区"], networkSeen: "网络内 2 家商户出现", priorBlocks: "无" },
    sanctions: { status: "未命中", list: "OFAC / UN", note: "收款地址未直接命中制裁名单" },
    custHistory: { orders: "342（历史良好）", violations: "无", vol30: "CAD 96,000", limit: "CAD 3,000 / 笔" },
    timeline: [
      ["2026-03-14 08:54:02", "提现发起 · 命中 KYW 评分规则", "done"],
      ["2026-03-14 09:10:11", "Sarah Chen (L1) 认领", "done"],
      ["处理中", "核实资金用途与收款方", ""],
    ],
    recommendation: "要求商户补充提现用途与收款方关系证明；资料合理则可放行，否则暂缓并升级。",
    checklist: [["核实收款钱包 KYW 报告", true], ["要求提现用途说明", false], ["确认商户历史无异常", true]],
  },
  {
    id: "ALT-50224", state: "progress", order: "DEP-20260313-204", sev: "mid", score: 62, level: "Elevated", type: "充值",
    title: "高频拆分入金", ruleShort: "高频拆分入金", ago: "1 小时前", submitted: "2026-03-13 08:12:40",
    assignee: { i: "ML", n: "Mike Lin", c: "var(--success)" },
    amount: "CAD 3,150.00", asset: "3,145 USDT", network: "TRC-20",
    txHash: "TQ5n…9wEx", confirmations: "20 / 20", sender: "TQ5n…9wEx", receiver: "商户托管钱包",
    merchant: "Eastwind Exchange", country: "新加坡", merchantTier: ["中风险 · 关注名单", "amber"], kyb: "完成", accountAge: "8 个月",
    rules: [{ name: "高频拆分入金", cat: "行为", cond: "24h 内 ≥5 笔且金额相近", hit: "7 笔 / 24h", weight: "+30" }],
    trace: [["发送方群组 #A7", "amber"], ["商户托管钱包", "blue"]],
    traceNote: "24 小时内 7 笔金额相近入金，关联关注名单群组 #A7，疑似结构化拆分以规避大额阈值。",
    factors: [
      f("🔁", "var(--warning-bg)", "var(--warning)", "24h 内 7 笔金额相近入金", "疑似结构化拆分"),
      f("👥", "var(--brand-soft)", "var(--brand)", "关联群组 #A7（关注名单）", "模型识别"),
    ],
    addrIntel: { age: "45 天", labels: ["关注名单"], networkSeen: "网络内 1 家商户出现", priorBlocks: "无" },
    sanctions: { status: "未命中", list: "OFAC / UN", note: "—" },
    custHistory: { orders: "128", violations: "1 笔（已结）", vol30: "CAD 42,000", limit: "CAD 5,000 / 笔" },
    timeline: [
      ["2026-03-13 08:12:40", "入金命中高频拆分规则", "done"],
      ["2026-03-13 08:40:02", "Mike Lin (L1) 认领", "done"],
      ["处理中", "核实拆分原因", ""],
    ],
    recommendation: "要求商户说明拆分原因；若为正常业务（如分批结算）可放行，否则纳入加强监控。",
    checklist: [["核查 24h 入金明细", true], ["要求拆分原因说明", false], ["确认群组 #A7 关联度", false]],
  },
  {
    id: "ALT-50220", state: "new", order: "DEP-20260313-188", sev: "mid", score: 55, level: "Elevated", type: "充值",
    title: "新商户大额首充", ruleShort: "新商户首充", ago: "2 小时前", submitted: "2026-03-13 07:48:11",
    assignee: null,
    amount: "CAD 6,000.00", asset: "5,985 USDT", network: "ERC-20",
    txHash: "0x9a1c…44Bd", confirmations: "32 / 32", sender: "0x9a1c…44Bd", receiver: "商户托管钱包",
    merchant: "Acme Pay Ltd.", country: "加拿大", merchantTier: ["中风险 · 新商户", "amber"], kyb: "审核中", accountAge: "3 天",
    rules: [
      { name: "新商户首充", cat: "行为", cond: "商户首笔 & KYB 未完成", hit: "首充 / KYB 审核中", weight: "+20" },
      { name: "大额充值监控", cat: "金额阈值", cond: "单笔 ≥ CAD 5,000", hit: "CAD 6,000", weight: "+35" },
    ],
    trace: [["发送方 0x9a1c…", "grey"], ["商户托管钱包", "blue"]],
    traceNote: "新注册商户首笔充值，金额偏高；发送方地址链上无负面标签，主要风险为 KYB 未完成。",
    factors: [
      f("🏷", "var(--warning-bg)", "var(--warning)", "商户注册 < 7 天，KYB 审核中", "主体未充分核验"),
      f("💰", "var(--brand-soft)", "var(--brand)", "首充 CAD 6,000，高于新商户基线", "基线 CAD 1,500"),
    ],
    addrIntel: { age: "120 天", labels: ["无负面标签"], networkSeen: "网络内未出现", priorBlocks: "无" },
    sanctions: { status: "未命中", list: "OFAC / UN", note: "—" },
    custHistory: { orders: "1（首笔）", violations: "无", vol30: "CAD 6,000", limit: "CAD 5,000 / 笔" },
    timeline: [
      ["2026-03-13 07:48:11", "首充命中新商户规则", "done"],
      ["待认领", "等待 L1 认领", ""],
    ],
    recommendation: "待 KYB 审核通过后放行；如 KYB 资料齐全可优先加速，避免新商户首充体验受损。",
    checklist: [["确认 KYB 审核进度", false], ["核验发送方地址无负面", true], ["评估是否纳入绿色通道", false]],
  },
  {
    id: "ALT-50218", state: "escalated", order: "WD-20260313-021", sev: "high", score: 99, level: "Highest", type: "提现",
    title: "制裁地址命中", ruleShort: "制裁地址命中", ago: "3 小时前", submitted: "2026-03-13 06:20:33",
    assignee: { i: "DW", n: "David Wu", c: "var(--violet)" },
    amount: "CAD 11,900.00", asset: "0.19 BTC", network: "ERC-20",
    txHash: "（已拦截）", confirmations: "出金已冻结", sender: "商户托管钱包", receiver: "0x7F4a…9c21",
    merchant: "OffshoreFX Ltd.", country: "离岸", merchantTier: ["高风险", "red"], kyb: "完成", accountAge: "4 个月",
    rules: [{ name: "制裁地址命中", cat: "名单", cond: "收/发方命中 OFAC/UN", hit: "OFAC SDN 直接命中", weight: "+100" }],
    trace: [["商户托管钱包", "blue"], ["接收方 0x7F4a…9c21", "red"]],
    traceNote: "收款地址 0x7F4a…9c21 直接命中 OFAC SDN 制裁名单，系统已自动冻结资金并升级 MLRO。",
    factors: [
      f("⛔", "var(--danger-bg)", "var(--danger)", "收款地址直接命中 OFAC SDN", "制裁实体"),
      f("🌐", "var(--danger-bg)", "var(--danger)", "离岸高风险商户", "主体风险高"),
    ],
    addrIntel: { age: "—", labels: ["OFAC SDN", "黑名单"], networkSeen: "网络黑名单", priorBlocks: "黑名单" },
    sanctions: { status: "直接命中", list: "OFAC SDN", note: "收款地址在制裁名单，禁止交易" },
    custHistory: { orders: "56", violations: "2 笔", vol30: "CAD 88,000", limit: "CAD 3,000 / 笔" },
    timeline: [
      ["2026-03-13 06:20:33", "提现命中制裁名单 · 系统自动冻结", "done"],
      ["2026-03-13 06:20:35", "自动升级 MLRO · 生成案件", "done"],
      ["处理中", "MLRO 评估 STR 上报", ""],
    ],
    recommendation: "禁止放行。资金已冻结，由 MLRO 完成 STR 上报 FINTRAC，按制裁合规流程处置。",
    checklist: [["确认制裁命中（OFAC SDN）", true], ["资金已冻结", true], ["起草 STR 草稿移交合规", false]],
  },
  {
    id: "ALT-50212", state: "closed_done", order: "DEP-20260312-512", sev: "low", score: 38, level: "Normal", type: "充值",
    title: "地址风险标签命中", ruleShort: "高风险地址检测", ago: "今日 06:30", submitted: "2026-03-12 06:30:55",
    assignee: { i: "SC", n: "Sarah Chen", c: "var(--brand)" },
    amount: "CAD 980.00", asset: "978 USDT", network: "SOL",
    txHash: "7xKp…Qz1", confirmations: "已确认", sender: "7xKp…Qz1", receiver: "商户托管钱包",
    merchant: "NovaPay Technologies Ltd.", country: "美国", merchantTier: ["低风险", "green"], kyb: "完成", accountAge: "2 年+",
    rules: [{ name: "高风险地址检测", cat: "链上溯源", cond: "发送方含风险标签", hit: "交易所热钱包（低）", weight: "+25" }],
    trace: [["交易所热钱包", "blue"], ["商户托管钱包", "blue"]],
    traceNote: "发送方为已知交易所热钱包标签，属低风险来源；金额小，已自动放行入账。",
    factors: [f("🏷", "var(--brand-soft)", "var(--brand)", "发送方含「交易所热钱包」标签", "低风险来源")],
    addrIntel: { age: "1 年+", labels: ["交易所热钱包"], networkSeen: "网络内常见", priorBlocks: "无" },
    sanctions: { status: "未命中", list: "OFAC / UN", note: "—" },
    custHistory: { orders: "410", violations: "无", vol30: "CAD 12,000", limit: "CAD 10,000 / 笔" },
    timeline: [
      ["2026-03-12 06:30:55", "入金命中地址标签规则", "done"],
      ["2026-03-12 06:31:02", "评分 38（Normal）· 自动放行", "done"],
      ["2026-03-12 06:31:02", "已入账", "done"],
    ],
    recommendation: "低风险，已放行入账。可将该交易所热钱包加入可信来源，减少后续误报。",
    checklist: [["确认地址标签为交易所", true], ["金额在自动放行区间", true], ["建议加入白名单", false]],
  },
  {
    id: "ALT-50205", state: "new", order: "WD-20260312-077", sev: "mid", score: 58, level: "Elevated", type: "提现",
    title: "快进快出钱包", ruleShort: "快进快出钱包", ago: "今日 05:12", submitted: "2026-03-12 05:12:18",
    assignee: { i: "ML", n: "Mike Lin", c: "var(--success)" },
    amount: "CAD 4,500.00", asset: "4,490 USDT", network: "TRC-20",
    txHash: "（待广播）", confirmations: "出金待审", sender: "商户托管钱包", receiver: "TQ8m…2kFa",
    merchant: "BlockTrade Corp.", country: "美国", merchantTier: ["中风险", "amber"], kyb: "完成", accountAge: "1.2 年",
    rules: [{ name: "快进快出钱包", cat: "行为", cond: "入金后 1h 内转出 > 80%", hit: "1h 内转出 86%", weight: "+28" }],
    trace: [["商户托管钱包", "blue"], ["接收方 TQ8m…", "grey"]],
    traceNote: "账户入金后 1 小时内转出 86%，呈快进快出特征，可能为资金过账，需核实业务实质。",
    factors: [
      f("⚡", "var(--warning-bg)", "var(--warning)", "入金后 1h 内转出 86%", "快进快出特征"),
      f("🔁", "var(--brand-soft)", "var(--brand)", "近 7 日多次类似行为", "资金过账嫌疑"),
    ],
    addrIntel: { age: "90 天", labels: ["无负面标签"], networkSeen: "网络内 1 家商户出现", priorBlocks: "无" },
    sanctions: { status: "未命中", list: "OFAC / UN", note: "—" },
    custHistory: { orders: "342", violations: "无", vol30: "CAD 96,000", limit: "CAD 3,000 / 笔" },
    timeline: [
      ["2026-03-12 05:12:18", "提现命中快进快出规则", "done"],
      ["2026-03-12 05:30:40", "Mike Lin (L1) 认领", "done"],
      ["处理中", "核实资金过账实质", ""],
    ],
    recommendation: "要求说明资金来源与用途；如为正常结算可放行，若无法解释则暂缓并加强监控。",
    checklist: [["核查入金/转出时间线", true], ["要求业务实质说明", false], ["评估是否过账行为", false]],
  },
];

// lane split: gate states live in 事中监控 (real-time), investigation states in 告警研判
export const GATE_STATES = ["new", "pending"];
export const INVESTIGATION_STATES = ["progress", "pending_l2", "escalated"];

export interface StateDef { label: string; cls: Tone; bucket: string; active: boolean }
export const RC_STATES: Record<string, StateDef> = {
  new: { label: "待认领", cls: "grey", bucket: "unclaimed", active: true },
  progress: { label: "处理中", cls: "amber", bucket: "progress", active: true },
  pending_l2: { label: "待L2复核", cls: "blue", bucket: "progress", active: true },
  pending: { label: "待补充材料", cls: "blue", bucket: "progress", active: true },
  escalated: { label: "已升级", cls: "violet", bucket: "escalated", active: true },
  closed_fp: { label: "已结 · 误报", cls: "grey", bucket: "done", active: false },
  closed_done: { label: "已结 · 已处置", cls: "green", bucket: "done", active: false },
  closed_case: { label: "已结 · 转案件", cls: "violet", bucket: "done", active: false },
};

// 告警 SLA(统一到 lib/sla.ts · B2)—— 严重度定档、live 状态定阶段:
//   待补充材料(pending)→ 暂停;已结(closed_*)→ 终态;其余(待认领 / 处理中 / L2 / 已升级)→ 跑表。
const alertSlaTier = (sev: Alert["sev"]): SlaTier => (sev === "high" ? "high" : sev === "mid" ? "medium" : "low");
export function slaOfAlert(a: Alert, state: string): SlaView {
  const def = RC_STATES[state];
  const phase = !def || !def.active ? "terminal" : state === "pending" ? "paused" : "active";
  return slaOf(a.id, alertSlaTier(a.sev), phase);
}

export const sevMeta: Record<string, { label: string; tone: Tone }> = {
  high: { label: "高危", tone: "red" },
  mid: { label: "中危", tone: "amber" },
  low: { label: "低危", tone: "blue" },
};

// ── decision modal config (告警研判 · 处置结论) ──
export const DISP = [
  { k: "release", label: "放行结案" },
  { k: "case", label: "建案调查" },
  { k: "watch", label: "加入名单" },
];
export const PROC = [
  { k: "reqinfo", label: "请求信息" },
  { k: "l2", label: "升级至L2" },
];
// 事中闸口处置集(放行决策)—— 与调查处置集区分;gate 状态走这套
export const GATE_DISP = [
  { k: "release", label: "放行" },
  { k: "reject", label: "拒绝" },
];
export const GATE_PROC = [
  { k: "reqinfo", label: "补料" },
  { k: "transfer", label: "转研判" },
];
export const REASONS: Record<string, string[]> = {
  release: ["证据充分，链上溯源风险可控", "商户补充材料已核实", "与历史交易模式一致", "信号为低风险，无需上报", "误报 · 规则需调优", "其他（见研判依据）"],
  case: ["需多笔交易关联调查", "商户主体存在结构性风险", "链上资金路径需深挖", "疑似分层洗钱 / 结构化拆分", "链上溯源触及制裁实体", "其他（见研判依据）"],
  watch: ["对手地址加入黑名单", "商户加入加强监控名单", "对手地址加入关注名单", "关联群组加入观察名单", "其他（见研判依据）"],
  reqinfo: ["要求补充 KYB / KYC 资料", "要求提供资金来源证明", "要求说明交易用途", "要求补充收款方关系证明", "其他（见研判依据）"],
  l2: ["风险超 L1 处置权限", "需高级别复核确认", "处置存在分歧，需二级研判", "其他（见研判依据）"],
  reject: ["制裁 / 名单命中", "链上溯源风险过高", "商户无法说明资金用途", "超出可放行风险阈值", "其他（见研判依据）"],
  transfer: ["链上溯源需深查", "疑似分层 / 结构化拆分", "需多笔关联调查", "商户主体存在结构性风险", "制裁 / 名单疑似命中需复核", "超出事中处置权限", "其他（见研判依据）"],
};
export const IMPACT: Record<string, (a: Alert) => string> = {
  release: (a) => `结案放行后本告警关闭，关联在途订单 <b>${a.order}</b> 解除风控标记 — 实际${a.type === "提现" ? "出金" : "入账"}由「事中监控」闸口执行。记入审计日志，供 L2 / 合规复核。`,
  case: (a) => `按商户聚合：并入 <b>${a.merchant}</b> 的在办案件（无则新建），关联本告警与在途订单 <b>${a.order}</b>。STR 起草与报送在「案件管理」中进行。`,
  watch: () => `对手地址 / 商户写入风控名单，后续同类交易将按名单规则自动处置；本告警据此结案。`,
  reqinfo: () => `向商户发起补充材料请求，告警转「待补充材料」，SLA 计时暂停；资料回补后重新进入研判。`,
  l2: () => `移交 L2 高级审核员复核，告警转「待 L2 复核」；L1 处置建议与依据一并提交，由 L2 作出最终结论。`,
  reject: (a) => `拒绝本笔，关联在途订单 <b>${a.order}</b> 资金<b>原路退回</b>；本警报据此结案并记入处置记录。`,
  transfer: (a) => `本笔<b>离开实时闸口</b>，转入<b>告警研判</b>由风控深度调查（可进一步转合规上报 STR）；关联订单 <b>${a.order}</b> 资金维持暂缓。`,
};
export const ITONE: Record<string, Tone> = { release: "green", case: "violet", watch: "amber", reqinfo: "blue", l2: "violet" };

export interface FieldDef { k: string; label: string; type: "select" | "multi"; required: boolean; options: string[] }
export const FIELDS: Record<string, FieldDef[]> = {
  release: [{ k: "followup", label: "后续监控", type: "multi", required: false, options: ["纳入加强监控", "列入复盘样本", "加入可信白名单"] }],
  case: [
    { k: "casetype", label: "案件类型", type: "select", required: true, options: ["可疑洗钱", "制裁规避", "欺诈交易", "结构化拆分", "其他"] },
    { k: "priority", label: "案件优先级", type: "select", required: true, options: ["高", "中", "低"] },
    { k: "scope", label: "调查范围", type: "multi", required: true, options: ["本订单", "该商户全部交易", "关联群组", "对手地址簇"] },
  ],
  watch: [
    { k: "listtype", label: "名单类型", type: "select", required: true, options: ["黑名单", "加强监控名单", "关注名单", "观察名单"] },
    { k: "entities", label: "列入对象", type: "multi", required: true, options: ["发送方地址", "收款方地址", "商户主体", "关联群组"] },
    { k: "duration", label: "有效期", type: "select", required: true, options: ["永久", "180 天", "90 天", "1 年"] },
  ],
  reqinfo: [
    { k: "materials", label: "需补充材料", type: "multi", required: true, options: ["KYB 主体证明", "资金来源证明", "交易用途说明", "收款方关系证明", "银行流水 / 对账单", "受益所有人 (UBO) 信息"] },
    { k: "deadline", label: "回复时限", type: "select", required: true, options: ["24 小时", "48 小时", "72 小时"] },
  ],
  l2: [
    { k: "assignee", label: "指派 L2 审核员", type: "select", required: true, options: ["自动分配", "David Wu (L2)", "Emma Zhang (L2)"] },
    { k: "urgency", label: "紧急度", type: "select", required: true, options: ["常规", "加急"] },
  ],
};
export const SUBMIT: Record<string, { state: string; label: string }> = {
  release: { state: "closed_done", label: "放行结案" },
  case: { state: "closed_case", label: "建案调查" },
  watch: { state: "closed_done", label: "加入监控名单" },
  reqinfo: { state: "pending", label: "请求补充信息" },
  l2: { state: "pending_l2", label: "升级至 L2 复核" },
  reject: { state: "closed_case", label: "拒绝 · 资金退回" },
  transfer: { state: "progress", label: "转研判 · 移交告警研判" },
};
export function aiRec(a: Alert): { k: string; conf: number } {
  if (a.sanctions.status === "直接命中") return { k: "case", conf: 97 };
  if (a.sev === "high") return { k: "case", conf: 88 };
  if (a.sev === "mid") return { k: "release", conf: 84 };
  return { k: "release", conf: 92 };
}