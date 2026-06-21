// 案件管理:事中冻结/驳回·告警升级·事后转案件·团伙转案件 形成的合规案件 + 案件状态机。
// 状态/owner/事件存 store.ts 的 caseStore(内存)。结案·转报送喂入报告报送。
import { FileText, FilePen, UserCheck, Send, CheckCircle2, GitMerge, FolderPlus, Inbox, ShieldQuestion, ShieldCheck, FileQuestion, Snowflake } from "lucide-react";
import type { Tone, Person } from "./data";

export type CState = "investigating" | "str_draft" | "mlro" | "queued" | "filed" | "closed" | "merged";
export const CSTATE: Record<CState, { label: string; tone: Tone; active: boolean }> = {
  investigating: { label: "调查中", tone: "violet", active: true },
  str_draft: { label: "STR 草稿", tone: "blue", active: true },
  mlro: { label: "MLRO 评估", tone: "amber", active: true },
  queued: { label: "待报送", tone: "amber", active: true },
  filed: { label: "已报送", tone: "green", active: true },
  closed: { label: "已结案", tone: "grey", active: false },
  merged: { label: "已合并", tone: "grey", active: false },
};

// STR 关联进展(列展示,跳报告报送)
export const strLabel = (s: CState): { text: string; tone: Tone; link: boolean } => {
  switch (s) {
    case "investigating": return { text: "未起草", tone: "grey", link: false };
    case "str_draft": return { text: "草稿中", tone: "blue", link: true };
    case "mlro": return { text: "MLRO 评估", tone: "amber", link: true };
    case "queued": return { text: "待报送", tone: "amber", link: true };
    case "filed": return { text: "已报送", tone: "green", link: true };
    case "closed": return { text: "已报送", tone: "grey", link: true };
    default: return { text: "—", tone: "grey", link: false };
  }
};

export type Priority = "高" | "中" | "低";
export const PRIO_TONE: Record<Priority, Tone> = { 高: "red", 中: "amber", 低: "green" };
export const RISK_TYPES = ["可疑洗钱", "制裁规避", "欺诈交易", "结构化拆分", "团伙网络"];

export interface CaseAction { k: string; label: string; to: CState; icon: typeof Send; tip: string; tone?: Tone }
export const CFLOW: Record<CState, CaseAction[]> = {
  investigating: [
    { k: "draft", label: "起草 STR", to: "str_draft", icon: FilePen, tip: "确认可疑 · 起草 STR 报送材料", tone: "blue" },
    { k: "close", label: "无需报送 · 结案", to: "closed", icon: CheckCircle2, tip: "调查后排除可疑 / 无需报送,直接结案", tone: "grey" },
    { k: "merge", label: "合并到关联案件", to: "merged", icon: GitMerge, tip: "并入同主体 / 同团伙的在办案件", tone: "grey" },
  ],
  str_draft: [
    { k: "mlro", label: "提交 MLRO 评估", to: "mlro", icon: UserCheck, tip: "STR 草稿完成 · 提交合规官复核", tone: "amber" },
    { k: "merge", label: "合并到关联案件", to: "merged", icon: GitMerge, tip: "并入关联案件", tone: "grey" },
  ],
  mlro: [
    { k: "approve", label: "评估通过 · 入报送队列", to: "queued", icon: CheckCircle2, tip: "MLRO 签发 · 进入报送队列", tone: "green" },
    { k: "back", label: "退回起草", to: "str_draft", icon: FilePen, tip: "材料不足 · 退回补充", tone: "blue" },
  ],
  queued: [
    { k: "file", label: "标记已报送 FINTRAC", to: "filed", icon: Send, tip: "已通过 FINTRAC 电子报送", tone: "green" },
  ],
  filed: [
    { k: "close", label: "结案归档", to: "closed", icon: Inbox, tip: "报送完成 · 案件结案归档", tone: "grey" },
  ],
  closed: [], merged: [],
};

// 涉案主体:一个案件可含多商户 / 多主体(地址 / 个人 / UBO),各有在案角色
export type SubjType = "商户" | "链上地址" | "个人" | "UBO";
export const SUBJ_TONE: Record<SubjType, Tone> = { 商户: "blue", 链上地址: "violet", 个人: "amber", UBO: "grey" };
export interface CaseSubject { name: string; type: SubjType; role: string; amount?: string; kyc?: string }

export interface Case {
  id: string; subject: string; sub: string; type: string; risk: string; priority: Priority;
  amount: string; links: number; linkIds: string; linkTo?: string; state: CState;
  owner: Person | null; sla: { text: string; tone: Tone }; submitted: string; src: string; subjects?: CaseSubject[];
}

const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const JL: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const EZ: Person = { i: "EZ", n: "Emma Zhang", c: "var(--success)" };
const DW: Person = { i: "DW", n: "David Wu", c: "#0ea5e9" };

export const CASES: Case[] = [
  { id: "CASE-20260318-001", subject: "NovaPay Technologies Ltd.", sub: "美国 · 商户", type: "混币器关联 · 制裁溯源", risk: "可疑洗钱", priority: "高", amount: "CAD 8,200.00", links: 2, linkIds: "ALT-50231 · DEP-20260315-001", linkTo: "/alert?id=ALT-50231", state: "mlro", owner: null, sla: { text: "剩 1d 02h", tone: "amber" }, submitted: "2026-03-18 09:30", src: "告警升级",
    subjects: [
      { name: "NovaPay Technologies Ltd.", type: "商户", role: "收款商户", amount: "CAD 8,200", kyc: "KYB 未完成" },
      { name: "0x5078…Ec8c", type: "链上地址", role: "混币器关联来源", amount: "CAD 8,200" },
      { name: "Tornado Cash", type: "链上地址", role: "制裁混币器(OFAC)" },
    ] },
  { id: "CASE-20260317-014", subject: "GlobalRemit Ltd.", sub: "离岸 · 商户", type: "大额分层归集", risk: "可疑洗钱", priority: "高", amount: "CAD 48,000.00", links: 3, linkIds: "WD-20260317-188 等 3 项", state: "queued", owner: EZ, sla: { text: "今日报送", tone: "red" }, submitted: "2026-03-17 15:12", src: "告警升级" },
  { id: "CASE-20260317-009", subject: "BlockTrade Corp.", sub: "美国 · 商户", type: "KYW 超阈值", risk: "欺诈交易", priority: "中", amount: "CAD 21,400.00", links: 2, linkIds: "ALT-50229 · WD-20260314-058", linkTo: "/alert?id=ALT-50229", state: "str_draft", owner: SC, sla: { text: "剩 2d 06h", tone: "amber" }, submitted: "2026-03-17 11:05", src: "事中驳回",
    subjects: [
      { name: "BlockTrade Corp.", type: "商户", role: "出金商户", amount: "CAD 21,400", kyc: "完成" },
      { name: "bc1q…7h2k", type: "链上地址", role: "高风险收款钱包(KYW 88)" },
    ] },
  { id: "CASE-20260316-021", subject: "归集地址 0x71Be…F0", sub: "链上 · 多商户网络", type: "扇入归集网络", risk: "团伙网络", priority: "高", amount: "CAD 124,000.00", links: 6, linkIds: "PM-2026-020 · 6 主体", linkTo: "/finding?id=PM-2026-020", state: "investigating", owner: SC, sla: { text: "剩 18h", tone: "amber" }, submitted: "2026-03-16 10:33", src: "事后转案件",
    subjects: [
      { name: "归集地址 0x71Be…F0", type: "链上地址", role: "资金归集(核心)", amount: "CAD 124,000" },
      { name: "RapidPay", type: "商户", role: "资金来源", amount: "CAD 38,400", kyc: "完成" },
      { name: "Eastwind Exchange", type: "商户", role: "资金来源", amount: "CAD 27,100", kyc: "完成" },
      { name: "SwiftRemit Inc.", type: "商户", role: "资金来源", amount: "CAD 22,500", kyc: "完成" },
      { name: "中转钱包 ×2", type: "链上地址", role: "归集后过账" },
      { name: "出口地址 ×3", type: "链上地址", role: "分发出口" },
    ] },
  { id: "CASE-20260318-018", subject: "OffshoreFX Ltd.", sub: "离岸 · 商户", type: "OFAC SDN 直接命中", risk: "制裁规避", priority: "高", amount: "CAD 11,900.00", links: 2, linkIds: "ALT-50218 · WD-20260313-021", linkTo: "/alert?id=ALT-50218", state: "filed", owner: EZ, sla: { text: "已报送", tone: "grey" }, submitted: "2026-03-13 06:20", src: "制裁冻结",
    subjects: [
      { name: "OffshoreFX Ltd.", type: "商户", role: "出金商户", amount: "CAD 11,900", kyc: "完成" },
      { name: "0x7F4a…9c21", type: "链上地址", role: "OFAC SDN 制裁实体(收款)" },
    ] },
  { id: "CASE-20260315-007", subject: "众包养卡团伙(RING-2026-031)", sub: "团伙 · 6 主体", type: "众包养卡团伙", risk: "团伙网络", priority: "高", amount: "CAD 38,400.00", links: 6, linkIds: "RING-2026-031 · 6 主体", linkTo: "/ring?id=RING-2026-031", state: "investigating", owner: DW, sla: { text: "剩 1d 12h", tone: "amber" }, submitted: "2026-03-15 16:30", src: "团伙转案件",
    subjects: [
      { name: "RapidPay", type: "商户", role: "团伙核心商户", amount: "CAD 14,200", kyc: "完成" },
      { name: "QuickWallet Ltd.", type: "商户", role: "关联商户", amount: "CAD 12,000", kyc: "完成" },
      { name: "PayFlow Systems", type: "商户", role: "关联商户", amount: "CAD 12,200", kyc: "完成" },
      { name: "设备指纹群 #D7", type: "链上地址", role: "设备 / IP 共享聚类" },
      { name: "Chen Wei", type: "个人", role: "疑似实际控制人(UBO)" },
      { name: "Li Ming", type: "UBO", role: "多商户共同受益所有人" },
    ] },
  { id: "CASE-20260312-003", subject: "QuickWallet Ltd.", sub: "美国 · 商户", type: "结构化拆分", risk: "结构化拆分", priority: "中", amount: "CAD 9,800.00", links: 1, linkIds: "PM-2026-022", linkTo: "/finding?id=PM-2026-022", state: "closed", owner: JL, sla: { text: "已完结", tone: "grey" }, submitted: "2026-03-12 14:20", src: "事后转案件" },
  { id: "CASE-20260310-002", subject: "HavenPay Inc.", sub: "离岸 · 商户", type: "混币器关联", risk: "可疑洗钱", priority: "中", amount: "CAD 33,500.00", links: 2, linkIds: "WD-20260316-256 等", state: "merged", owner: DW, sla: { text: "已合并", tone: "grey" }, submitted: "2026-03-10 17:20", src: "告警升级" },
];

export const caseOf = (id?: string) => CASES.find((c) => c.id === id);
export const CASE_ICON = { FileText, FolderPlus, ShieldQuestion };

// ── Layer-3 决策动作集(可处置动作 + 权限约束)—— 把分散信号收敛成一个处置 ──
// investigating 态用这套六动作;后续态(STR草稿 / MLRO / 待报送 / 已报送)回退到 CFLOW。
export interface DecideAction { k: string; label: string; desc: string; icon: typeof Send; to?: CState; tone: Tone; perm: string; dualSign?: boolean; needMerge?: boolean }
export const DECIDE: DecideAction[] = [
  { k: "fp", label: "误报放行", desc: "排除可疑 · 结案放行", icon: ShieldCheck, to: "closed", tone: "green", perm: "需双签(L1 + L2)", dualSign: true },
  { k: "restrict", label: "限制 / 补材料", desc: "暂限账户 + 发起补料,维持调查", icon: FileQuestion, tone: "amber", perm: "L1 可执行" },
  { k: "freeze", label: "冻结深查", desc: "冻结资金 · 深入链上溯源", icon: Snowflake, tone: "red", perm: "L1 执行 · 通知 MLRO" },
  { k: "draft", label: "定性可疑 · 起草 STR", desc: "确认可疑 · 起草 STR 转 MLRO", icon: FilePen, to: "str_draft", tone: "blue", perm: "L1 起草 · MLRO 签发" },
  { k: "mlro", label: "转 MLRO / 改派", desc: "超出权限 · 升级 MLRO 或改派", icon: UserCheck, tone: "violet", perm: "需 MLRO" },
  { k: "merge", label: "合并 / 关联团伙", desc: "并入同主体 / 同团伙在办案件", icon: GitMerge, tone: "grey", perm: "L1 可执行", needMerge: true },
];
const toDecide = (a: CaseAction): DecideAction => ({ k: a.k, label: a.label, desc: a.tip, icon: a.icon, to: a.to, tone: a.tone || "grey", perm: a.to === "queued" || a.to === "filed" ? "MLRO / 报送" : "L1 可执行", needMerge: a.k === "merge" });
export const decideActions = (st: CState): DecideAction[] => (st === "investigating" ? DECIDE : CFLOW[st].map(toDecide));

// ── 案卷(研判工作台证据)—— 支撑四问事实 + 决策支持 + 系统建议处置 ──
export interface CasePathHop { label: string; role: string; tone: Tone; meta?: string }
export interface CaseDossier {
  // Q1 这案子有多可疑
  score: number; scoreParts: { label: string; pts: number; tone: Tone }[]; hitRules: { name: string; detail: string }[]; evidence: string[];
  // Q2 主体什么来头
  kyc: { country: string; kyb: string; registered: string; ubo: string };
  baseline: { label: string; value: string; critical?: boolean }[]; priorDisp: string;
  // Q3 钱从哪到哪
  path?: CasePathHop[]; chainRisk: string[]; fundNature: string;
  // Q4 有没有同伙
  rings: { id: string; name: string; to: string }[]; relatedCases: { id: string; name: string; to: string }[];
  // ⑤ 决策锚点(相似案件处置基准)
  anchor: { similar: number; release: number; strRate: number; note: string };
  // 系统建议处置(弱建议)—— 收敛信号成决策起点;分析师同意 / 推翻并留痕
  rec: { disp: string; label: string; risk: Tone; riskLabel: string; basis: string[] };
}

export const CASE_DOSSIER: Record<string, CaseDossier> = {
  "CASE-20260318-001": {
    score: 92,
    scoreParts: [
      { label: "链上溯源 · 混币器接触", pts: 35, tone: "red" },
      { label: "大额偏离基线(5.5×)", pts: 22, tone: "amber" },
      { label: "KYB 未完成 · 新商户", pts: 18, tone: "amber" },
      { label: "制裁实体间接命中", pts: 17, tone: "red" },
    ],
    hitRules: [
      { name: "混币器关联", detail: "资金 ≤2 跳触及制裁地址 → Tornado Cash" },
      { name: "大额充值监控", detail: "单笔 ≥ CAD 5,000 → 命中 CAD 8,200" },
    ],
    evidence: ["92% 入金资产链上可溯源至 Tornado Cash(OFAC 制裁混币器)", "经 3 个中转地址在 36h 内归集 —— 典型过水分层", "商户首充且 KYB 未完成,主体未充分核验"],
    kyc: { country: "美国", kyb: "未完成", registered: "5 天(新商户)", ubo: "未申报" },
    baseline: [
      { label: "单笔金额", value: "CAD 8,200 · 商户均值 5.5×", critical: true },
      { label: "充值频率", value: "首笔充值 · 无历史基线" },
      { label: "资金来源", value: "新建地址 · 混币器 ≤2 跳" },
    ],
    priorDisp: "关联 3 笔历史违规(同网络其它商户)· 本商户无前科",
    path: [
      { label: "Tornado Cash", role: "来源", tone: "red", meta: "92% 溯源命中" },
      { label: "中转地址 ×3", role: "中转", tone: "amber", meta: "36h 内归集" },
      { label: "发送方 0x5078", role: "归集", tone: "amber", meta: "首充来源" },
      { label: "商户托管钱包", role: "出口", tone: "blue", meta: "NovaPay 入账" },
    ],
    chainRisk: ["Tornado Cash 混币器(OFAC)", "中转地址链上无 KYC", "资金 36h 快速归集"],
    fundNature: "入金(充值)· 疑似制裁资金经混币后注入",
    rings: [], relatedCases: [],
    anchor: { similar: 17, release: 5, strRate: 71, note: "近 90 天 17 起「混币器关联充值」同类案件:71% 上报 STR、24% 加强监控后放行、5% 误报。" },
    rec: { disp: "draft", label: "定性可疑 · 起草 STR(转 MLRO)", risk: "red", riskLabel: "高风险", basis: ["链上溯源 92% 触及 Tornado Cash 制裁混币器", "资金经 3 跳 36h 过水归集 —— 典型分层", "同类案件 71% 最终上报 STR"] },
  },
  "CASE-20260317-009": {
    score: 76,
    scoreParts: [
      { label: "收款钱包 KYW 评分 88", pts: 34, tone: "red" },
      { label: "大额提现偏离(7×)", pts: 24, tone: "amber" },
      { label: "高风险辖区对手", pts: 18, tone: "amber" },
    ],
    hitRules: [
      { name: "KYW 评分超阈值", detail: "收款钱包 KYW > 70 → 命中 88" },
      { name: "大额提现监控", detail: "单笔 ≥ CAD 3,000 → 命中 CAD 21,400" },
    ],
    evidence: ["收款钱包 KYW 风险评分 88,远超阈值 70", "关联高风险司法管辖区交易所(FATF 灰名单)", "单笔 CAD 21,400,为限额 7×"],
    kyc: { country: "美国", kyb: "完成", registered: "1.2 年", ubo: "已核验" },
    baseline: [
      { label: "单笔金额", value: "CAD 21,400 · 限额 7×", critical: true },
      { label: "历史记录", value: "342 笔无违规 · 信誉良好" },
      { label: "收款对手", value: "新对手 · KYW 88" },
    ],
    priorDisp: "商户历史 342 笔无违规 —— 主体信誉良好,风险集中在本笔对手",
    path: [
      { label: "商户托管钱包", role: "来源", tone: "blue", meta: "出金发起" },
      { label: "bc1q…7h2k", role: "中转", tone: "red", meta: "KYW 88" },
      { label: "高风险交易所", role: "出口", tone: "red", meta: "FATF 灰名单辖区" },
    ],
    chainRisk: ["收款钱包 KYW 88(高)", "对手交易所位于高风险辖区"],
    fundNature: "出金(提现)· 大额转入高风险对手钱包",
    rings: [], relatedCases: [],
    anchor: { similar: 22, release: 41, strRate: 32, note: "近 90 天 22 起同类 KYW 超阈值提现:41% 补充用途说明后放行、32% 上报 STR、其余加强监控。" },
    rec: { disp: "restrict", label: "限制 / 补材料(要求用途说明)", risk: "amber", riskLabel: "中风险", basis: ["商户历史良好(342 笔无违规),非惯犯", "风险集中于单笔对手 KYW,可经补料澄清", "同类 41% 补充说明后放行"] },
  },
  "CASE-20260316-021": {
    score: 90,
    scoreParts: [
      { label: "扇入归集图聚类", pts: 32, tone: "red" },
      { label: "多商户协同", pts: 24, tone: "amber" },
      { label: "归集后集中出金", pts: 20, tone: "amber" },
      { label: "跨主体金额异常", pts: 14, tone: "amber" },
    ],
    hitRules: [
      { name: "多主体扇入同一地址", detail: "事后回溯 6 商户 → 1 归集地址" },
      { name: "分层归集", detail: "归集后经 2 中转分发 3 出口" },
    ],
    evidence: ["6 商户分散入金 → 同一归集地址 0x71Be(CAD 124,000)", "归集后经 2 中转分发 3 出口 —— 分层混淆", "6 商户此前互无关联,突现协同扇入"],
    kyc: { country: "多辖区", kyb: "3 商户均完成", registered: "商户 8 个月–2 年", ubo: "疑似共同 UBO 待查" },
    baseline: [
      { label: "扇入主体数", value: "6 商户 → 1 地址", critical: true },
      { label: "归集金额", value: "CAD 124,000" },
      { label: "时间窗", value: "72h 内集中归集" },
    ],
    priorDisp: "PM-2026-020 事后命中转入本案 · 商户个体此前无单独违规",
    path: [
      { label: "6 商户账户", role: "来源", tone: "amber", meta: "分散入金" },
      { label: "归集 0x71Be", role: "归集", tone: "red", meta: "CAD 124,000" },
      { label: "中转钱包 ×2", role: "中转", tone: "amber", meta: "归集后过账" },
      { label: "出口地址 ×3", role: "出口", tone: "grey", meta: "分发出口" },
    ],
    chainRisk: ["归集地址链上扇入特征显著", "出口地址疑似跨所分发"],
    fundNature: "多商户入金归集 · 疑似第三方资金集中过账",
    rings: [{ id: "RING-2026-082", name: "大型扇入团伙网络", to: "/ring?id=RING-2026-082" }],
    relatedCases: [{ id: "CASE-20260315-007", name: "众包养卡团伙", to: "/case?id=CASE-20260315-007" }],
    anchor: { similar: 9, release: 0, strRate: 78, note: "近 90 天 9 起扇入归集网络案件:78% 上报 STR、22% 并入团伙案件,无放行。" },
    rec: { disp: "draft", label: "定性可疑 · 起草 STR + 关联并案", risk: "red", riskLabel: "高风险", basis: ["6 商户扇入同一归集地址,协同特征显著", "归集后分层出金 —— 典型洗钱结构", "同类案件 78% 上报 STR、22% 并入团伙"] },
  },
  "CASE-20260318-018": {
    score: 99,
    scoreParts: [
      { label: "OFAC SDN 直接命中", pts: 60, tone: "red" },
      { label: "离岸高风险商户", pts: 22, tone: "amber" },
      { label: "出金即冻结", pts: 17, tone: "red" },
    ],
    hitRules: [{ name: "制裁地址命中", detail: "收款地址命中 OFAC SDN → 自动冻结" }],
    evidence: ["收款地址 0x7F4a 直接命中 OFAC SDN 制裁名单", "系统已自动冻结资金", "离岸高风险商户,历史 2 笔违规"],
    kyc: { country: "离岸", kyb: "完成", registered: "4 个月", ubo: "离岸结构 · 不透明" },
    baseline: [
      { label: "制裁命中", value: "OFAC SDN 直接命中", critical: true },
      { label: "商户风险", value: "离岸 · 高风险" },
      { label: "历史记录", value: "2 笔违规" },
    ],
    priorDisp: "已按制裁财产立即上报 FINTRAC(TPR)· 案件报送结案中",
    path: [
      { label: "商户托管钱包", role: "来源", tone: "blue", meta: "出金发起" },
      { label: "0x7F4a…9c21", role: "失联", tone: "red", meta: "OFAC SDN · 已冻结" },
    ],
    chainRisk: ["收款地址 OFAC SDN 黑名单", "资金已冻结阻断"],
    fundNature: "出金(提现)· 直接流向制裁实体,已阻断",
    rings: [], relatedCases: [],
    anchor: { similar: 4, release: 0, strRate: 100, note: "制裁名单直接命中:100% 立即上报(TPR / STR),无放行空间。" },
    rec: { disp: "draft", label: "已制裁命中 · 上报并结案", risk: "red", riskLabel: "高风险", basis: ["收款地址直接命中 OFAC SDN", "资金已自动冻结阻断", "制裁命中无放行空间,强制上报"] },
  },
  "CASE-20260315-007": {
    score: 88,
    scoreParts: [
      { label: "设备 / IP 共享聚类", pts: 30, tone: "red" },
      { label: "多商户共同 UBO", pts: 24, tone: "amber" },
      { label: "资金分层归集", pts: 20, tone: "amber" },
      { label: "关注名单关联", pts: 14, tone: "amber" },
    ],
    hitRules: [
      { name: "设备指纹聚类", detail: "3 商户共享设备群 #D7 与 IP 段" },
      { name: "共同受益所有人", detail: "Chen Wei(疑控)/ Li Ming(共同 UBO)" },
    ],
    evidence: ["3 商户共享设备指纹群 #D7 与 IP 段", "Chen Wei 疑为实际控制人,Li Ming 为共同 UBO", "资金分层归集后集中出金 CAD 38,400"],
    kyc: { country: "多辖区", kyb: "3 商户完成", registered: "商户均 <1 年", ubo: "Chen Wei(疑)/ Li Ming(共同)" },
    baseline: [
      { label: "设备共享", value: "3 商户 → 设备群 #D7", critical: true },
      { label: "UBO 重叠", value: "2 共同受益人" },
      { label: "注册时间", value: "集中于近期" },
    ],
    priorDisp: "RING-2026-031 团伙识别转入 · 关注名单群组关联",
    path: [
      { label: "3 关联商户", role: "来源", tone: "amber", meta: "众包养卡" },
      { label: "归集钱包", role: "归集", tone: "red", meta: "CAD 38,400" },
      { label: "集中出金", role: "出口", tone: "amber", meta: "分层后出金" },
    ],
    chainRisk: ["设备 / IP 聚类强关联", "归集出金链路"],
    fundNature: "多商户协同 · 养卡套现资金归集",
    rings: [{ id: "RING-2026-031", name: "众包养卡关联团伙", to: "/ring?id=RING-2026-031" }],
    relatedCases: [{ id: "CASE-20260316-021", name: "扇入归集网络", to: "/case?id=CASE-20260316-021" }],
    anchor: { similar: 6, release: 0, strRate: 67, note: "近 90 天 6 起养卡团伙案件:67% 上报 STR、33% 并入更大团伙案件。" },
    rec: { disp: "draft", label: "定性可疑 · 起草 STR(团伙)", risk: "red", riskLabel: "高风险", basis: ["设备 / IP 共享聚类成团,非偶发", "存在共同 UBO,主体关联确凿", "同类 67% 上报 STR"] },
  },
};

// 兜底案卷:无显式案卷的案件从案件字段派生(够撑起四问骨架)
export function dossierOf(c: Case): CaseDossier {
  const ex = CASE_DOSSIER[c.id];
  if (ex) return ex;
  const score = c.priority === "高" ? 82 : c.priority === "中" ? 61 : 43;
  const isChain = c.sub.includes("链上") || c.sub.includes("网络");
  return {
    score,
    scoreParts: [
      { label: c.type, pts: Math.round(score * 0.5), tone: c.priority === "高" ? "red" : "amber" },
      { label: c.risk, pts: Math.round(score * 0.3), tone: "amber" },
      { label: "主体 / 对手风险", pts: score - Math.round(score * 0.5) - Math.round(score * 0.3), tone: "blue" },
    ],
    hitRules: [{ name: c.type, detail: `${c.risk} · 来源 ${c.src}` }],
    evidence: [`${c.type} —— ${c.risk}`, `涉及金额 ${c.amount} · 关联 ${c.linkIds}`, `来源:${c.src}`],
    kyc: { country: c.sub.split(" · ")[0] || "—", kyb: isChain ? "—" : "完成", registered: "—", ubo: "待核验" },
    baseline: [
      { label: "涉及金额", value: c.amount, critical: true },
      { label: "关联项", value: c.linkIds },
      { label: "风险类型", value: c.risk },
    ],
    priorDisp: `来源 ${c.src} · 经研判转入本案`,
    chainRisk: [c.type, c.risk],
    fundNature: c.risk,
    rings: [], relatedCases: [],
    anchor: { similar: 8, release: c.priority === "高" ? 12 : 38, strRate: c.priority === "高" ? 64 : 28, note: `近 90 天 8 起「${c.risk}」同类案件的处置基准(供决策参考)。` },
    rec: c.priority === "高"
      ? { disp: "draft", label: "定性可疑 · 起草 STR", risk: "red", riskLabel: "高风险", basis: [`${c.type} 风险特征显著`, `涉及金额 ${c.amount}`, "同类案件多数上报 STR"] }
      : { disp: "restrict", label: "限制 / 补材料", risk: "amber", riskLabel: "中风险", basis: [`${c.type} 需进一步核实`, "主体风险可经补料澄清", "同类多数补充说明后放行"] },
  };
}
