// 案件管理:事中冻结/驳回·告警升级·事后转案件·团伙转案件 形成的合规案件 + 案件状态机。
// 状态/owner/事件存 store.ts 的 caseStore(内存)。结案·转报送喂入报告报送。
import { FileText, FilePen, UserCheck, Send, CheckCircle2, GitMerge, FolderPlus, Inbox, ShieldQuestion, ShieldCheck, FileQuestion, Snowflake, AlertCircle, XCircle, PlayCircle, HelpCircle, Flag, Share2, Link2 } from "lucide-react";
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

// ── 审核抽屉操作集(分组:处置决定 / 流程操作 / 案件管理)—— 与 ReviewDialog / FindingReviewDialog 同款 ──
export interface CaseOp { k: string; label: string; icon: typeof Send; to?: CState; tone: Tone; impact: string; archive?: boolean; dual?: boolean; merge?: boolean; materials?: boolean; reasonReq?: boolean }
export const CASE_OP_GROUPS: { title: string; ops: CaseOp[] }[] = [
  { title: "处置决定", ops: [
    { k: "suspicious", label: "确认可疑", icon: AlertCircle, to: "str_draft", tone: "amber", impact: "定性为可疑交易(合理怀疑即可),生成 STR 草稿并转 MLRO 评估;案件状态转「STR 草稿」。", reasonReq: true },
    { k: "violation", label: "确认违规", icon: XCircle, to: "str_draft", tone: "red", impact: "已坐实违规:起草 STR 的同时对涉案主体止损(限制 / 列名单);案件状态转「STR 草稿」。", reasonReq: true },
    { k: "fp", label: "误报放行", icon: PlayCircle, to: "closed", tone: "green", impact: "排除可疑,案件结案放行;误报放行需双签(L1 + L2)复核。", dual: true, archive: true, reasonReq: true },
  ] },
  { title: "流程操作", ops: [
    { k: "reqinfo", label: "请求信息", icon: HelpCircle, tone: "blue", impact: "向涉案主体 / 商户发起补充材料请求,案件维持调查中,SLA 暂缓;资料回补后重新研判。", materials: true },
    { k: "l2", label: "升级至 L2", icon: Flag, tone: "violet", impact: "移交 L2 高级审核员复核,L1 结论与依据一并提交,由 L2 作出最终结论。" },
    { k: "mlro", label: "转 MLRO", icon: Share2, to: "mlro", tone: "violet", impact: "升级 MLRO 评估(超出 L1 权限);案件状态转「MLRO 评估」。" },
  ] },
  { title: "案件管理", ops: [
    { k: "archive", label: "结案归档", icon: CheckCircle2, to: "closed", tone: "grey", impact: "在定性结论执行完成后将案件归档,状态转为「已结案」。", archive: true, reasonReq: true },
    { k: "merge", label: "合并案件", icon: GitMerge, to: "merged", tone: "grey", impact: "将本案并入同主体 / 同团伙的在办案件,本案转「已合并」,后续在主案统一处置。", merge: true, reasonReq: true },
    { k: "relate", label: "关联案件", icon: Link2, tone: "grey", impact: "不合并、仅建立交叉引用:各案仍独立审核。具体在页面「关联案件 · 串并」卡中就地纳入 / 解除。" },
  ] },
];
export const CASE_OPS: CaseOp[] = CASE_OP_GROUPS.flatMap((g) => g.ops);
export const ARCHIVE_REASONS = ["已放行(误报)· 结案", "已上报 STR · 结案归档", "无需报送 · 调查排除可疑", "已移交执法 · 结案", "其它(见备注)"];
export const MATERIALS = ["KYB 主体证明", "资金来源证明", "交易用途说明", "受益所有人(UBO)信息", "银行流水 / 对账单"];
// 系统建议 rec.disp → 审核操作 key 映射
export const recToOp: Record<string, string> = { draft: "suspicious", restrict: "reqinfo", freeze: "violation", mlro: "mlro", merge: "merge", fp: "fp" };

// ── 案卷(研判工作台证据)—— 支撑四问事实 + 决策支持 + 系统建议处置 ──
export interface CasePathHop { label: string; role: string; tone: Tone; meta?: string }
// 资金链路网络图(分层有向:源头→分散→多跳→归集→平台→出口;dividerAfter 列后为法币世界)
export type GNodeKind = "mixer" | "mule" | "hub" | "platform" | "exit" | "normal";
export interface GraphNode { id: string; label: string; sub?: string; col: number; kind: GNodeKind }
export interface GraphEdge { from: string; to: string; w?: string }
export interface CaseGraph { cols: string[]; dividerAfter: number; nodes: GraphNode[]; edges: GraphEdge[]; stats: { label: string; value: string }[]; leftWorld?: string; rightWorld?: string }
export const GKIND: Record<GNodeKind, { tone: Tone; glyph: string; label: string }> = {
  mixer: { tone: "red", glyph: "🌀", label: "高危源头 / 混币器" },
  mule: { tone: "amber", glyph: "👤", label: "中转 mule" },
  hub: { tone: "red", glyph: "🎯", label: "归集节点" },
  platform: { tone: "blue", glyph: "🏦", label: "平台账户" },
  exit: { tone: "grey", glyph: "↗", label: "外部出口" },
  normal: { tone: "green", glyph: "✓", label: "正常 / 已核实" },
};
// 加权评分因子:raw 为该因子 0–100 原始分,weight 为权重(同团伙识别口径),contrib = raw×weight
export interface ScoreFactor { key: string; label: string; cat: string; weight: number; raw: number; tone: Tone; evidence: string[] }
export interface RelatedCase { id: string; subject: string; relType: string; relTone: Tone; conf: string; state: string; amount: string; score: number; basis: string; by: string; at: string }
export interface BaselinePair { label: string; norm: string; current: string; abnormal?: boolean }
export interface CaseAlert { id: string; sev: Tone; sevLabel: string; desc: string; rule: string; time: string }
export interface CaseDossier {
  // Q1 这案子有多可疑(加权瀑布评分 + 硬规则托底 + 关联告警)
  factors: ScoreFactor[]; floor?: { label: string; bonus: number; note: string }; evidence: string[]; alerts: CaseAlert[];
  // 交易 / 资金状态
  tx: { id: string; network: string; type: string; frozen: string; destination: string; duration: string };
  // Q2 主体什么来头(商户画像 + 行为基线本次 vs 历史)
  profile: { kyc: string; country: string; sanctions: string; pep: string; vol30: string; limit: string; tier: Tone };
  baseline: BaselinePair[]; priorDisp: string;
  // Q3 钱从哪到哪
  path?: CasePathHop[]; chainRisk: string[]; fundNature: string;
  // Q4 有没有同伙(简版链接 + 富卡:类型 / 置信度 / 关联依据 / 归属)
  rings: { id: string; name: string; to: string }[]; relatedCases: { id: string; name: string; to: string }[];
  mergeInfo?: { count: number; total: string; strength: string; ring: string };
  relatedRich?: RelatedCase[];
  // 证据材料 + STR 草稿(⑦ 证据与留痕)
  files?: { name: string; ext: string; size: string; note: string }[];
  str?: { type: string; indicators: string; drafter: string; narrative: string };
  graph?: CaseGraph;
  // ⑤ 决策锚点(相似案件处置基准)
  anchor: { similar: number; release: number; strRate: number; note: string };
  // 系统建议处置(弱建议)—— 收敛信号成决策起点;分析师同意 / 推翻并留痕
  rec: { disp: string; label: string; risk: Tone; riskLabel: string; basis: string[] };
}
export const factorContrib = (f: ScoreFactor) => Math.round(f.raw * f.weight * 10) / 10;
export const caseScore = (d: CaseDossier) => Math.round((d.factors.reduce((a, f) => a + factorContrib(f), 0) + (d.floor?.bonus || 0)) * 10) / 10;

export const CASE_DOSSIER: Record<string, CaseDossier> = {
  "CASE-20260318-001": {
    factors: [
      { key: "mixer", label: "混币器接触", cat: "KYW · 链上", weight: 0.40, raw: 95, tone: "red", evidence: ["92% 入金资产溯源至 Tornado Cash(OFAC 制裁混币器)", "KYW 风险评分 95 / 100", "资金 ≤2 跳触及制裁混币器"] },
      { key: "passthrough", label: "过水模式", cat: "行为", weight: 0.30, raw: 82, tone: "red", evidence: ["入账后 14 分钟内即发起全额提现", "经 3 个中转地址 36h 内归集", "快进快出 layering 特征"] },
      { key: "sanction", label: "制裁关联", cat: "名单", weight: 0.20, raw: 70, tone: "amber", evidence: ["间接命中 OFAC(经混币器)", "对手地址历史关联制裁实体"] },
      { key: "history", label: "账户历史", cat: "账户库", weight: 0.10, raw: 45, tone: "grey", evidence: ["商户注册 5 天 · KYB 未完成", "首充无历史基线", "网络内关联 3 笔历史违规"] },
    ],
    floor: { label: "混币器硬指标托底", bonus: 5.9, note: "命中混币器硬指标触发托底规则(最低 85),累计 81.1 追加 +5.9,最终 87。" },
    evidence: ["92% 入金资产链上可溯源至 Tornado Cash(OFAC 制裁混币器)", "经 3 个中转地址在 36h 内归集 —— 典型过水分层", "商户首充且 KYB 未完成,主体未充分核验"],
    alerts: [
      { id: "ALT-50231", sev: "red", sevLabel: "高", desc: "充值地址与混币器 Tornado Cash 存在 1 跳关联,链上来源极近混币器。涉 0.21 BTC(约 CAD 8,200)。", rule: "R-CHAIN-07", time: "2026-03-15 09:30" },
      { id: "ALT-50231", sev: "amber", sevLabel: "中", desc: "入金到账后 14 分钟内即发起全额提现,呈典型「过水」模式(转入即兑换即提现)。", rule: "R-XSYS-03", time: "2026-03-15 09:44" },
    ],
    tx: { id: "DEP-20260315-001", network: "ERC-20", type: "充值", frozen: "8,180 USDT · CAD 8,200", destination: "0x7a…dE2(外部)", duration: "1d 18h · 自动暂缓" },
    profile: { kyc: "高风险", country: "🇺🇸 美国", sanctions: "间接命中(经混币器)", pep: "非 PEP", vol30: "CAD 8,200", limit: "CAD 5,000", tier: "red" },
    baseline: [
      { label: "单笔金额", norm: "均值 CAD 1,150", current: "CAD 8,200(×7)", abnormal: true },
      { label: "常用对手方", norm: "Coinbase / Kraken", current: "全新混币关联地址", abnormal: true },
      { label: "活跃时段", norm: "09:00–18:00 EST", current: "22:10 · 异常", abnormal: true },
      { label: "历史交易(90天)", norm: "18 笔", current: "首充" },
      { label: "历史处置", norm: "2 次告警 · 均放行无前科", current: "本次首违" },
    ],
    priorDisp: "关联 3 笔历史违规(同网络其它商户)· 本商户无前科",
    mergeInfo: { count: 2, total: "CAD 26,400", strength: "强", ring: "G-2026-014" },
    relatedRich: [
      { id: "CASE-20260317-009", subject: "BlockTrade Corp.", relType: "同团伙", relTone: "red", conf: "高置信", state: "STR 草稿", amount: "CAD 12,400", score: 91, basis: "共用提现地址 0x7a…dE2,资金链下游汇于同一归集节点 3FZbgi…7Ax", by: "Sarah Chen(风险)", at: "2026-03-02 11:48 · 系统共用地址自动建议" },
      { id: "CASE-20260301-051", subject: "J. Morrison", relType: "同设备", relTone: "amber", conf: "中置信", state: "调查中", amount: "CAD 5,800", score: 64, basis: "同设备指纹 fp_9a3c…,同 IP 198.51.100.x,登录时间窗重叠", by: "Sarah Chen(风险)", at: "2026-03-02 11:48 · 手动关联" },
    ],
    files: [
      { name: "KYT 链上分析报告", ext: "PDF", size: "3.07 MB", note: "第三方 KYT 服务返回的地址风险评分与资金溯源路径" },
      { name: "主体 KYC 资料快照", ext: "PNG", size: "1.24 MB", note: "注册信息、UBO 结构、风险等级评定记录" },
      { name: "关联交易流水", ext: "XLSX", size: "0.86 MB", note: "近 90 天关联主体全部入金 / 兑换 / 提现明细" },
      { name: "OFAC 名单筛查记录", ext: "DOCX", size: "0.32 MB", note: "来源地址簇与 OFAC SDN 名单的间接关联比对结果" },
    ],
    str: { type: "STR(可疑交易报告)", indicators: "混币器接触 · 过水模式", drafter: "Sarah Chen(风控)", narrative: "本案账户于 2026-03-15 接收来自混币器 Tornado Cash 钱包地址的 0.21 BTC,经层跳中转后入金平台并即时兑换为 CAD 8,200,且于 14 分钟内发起全额提现,符合分层(layering)与过水特征。建议作为可疑交易上报。" },
    graph: {
      cols: ["源头", "分散", "多跳中转", "归集", "平台", "出口"], dividerAfter: 3,
      nodes: [
        { id: "mx1", label: "混币器源头 A", sub: "bc1q…3r5", col: 0, kind: "mixer" },
        { id: "mx2", label: "混币器源头 B", sub: "bc1p…mk2", col: 0, kind: "mixer" },
        { id: "mA", label: "mule A", sub: "1A9x…c2", col: 1, kind: "mule" },
        { id: "mB", label: "mule B", sub: "1A9x…c2", col: 1, kind: "mule" },
        { id: "mC", label: "mule C", sub: "1A9x…c2", col: 1, kind: "mule" },
        { id: "mD", label: "mule D", sub: "1A9x…c2", col: 1, kind: "mule" },
        { id: "mE", label: "mule E", sub: "1A9x…c2", col: 1, kind: "mule" },
        { id: "h1", label: "mule · 2 跳", sub: "1A9x…c2", col: 2, kind: "mule" },
        { id: "h2", label: "mule · 2 跳", sub: "1A9x…c2", col: 2, kind: "mule" },
        { id: "hub", label: "归集节点", sub: "3FZbgi…7Ax", col: 3, kind: "hub" },
        { id: "plat", label: "平台入金", sub: "NovaPay 托管", col: 4, kind: "platform" },
        { id: "ex1", label: "出口 · 连结", sub: "0x7a…dE2", col: 5, kind: "exit" },
        { id: "ex2", label: "出口 · 直结", sub: "1A9x…c2", col: 5, kind: "exit" },
      ],
      edges: [
        { from: "mx1", to: "mA", w: "0.06" }, { from: "mx1", to: "mB", w: "0.02" }, { from: "mx1", to: "mC" },
        { from: "mx2", to: "mC", w: "0.13" }, { from: "mx2", to: "mD", w: "0.09" }, { from: "mx2", to: "mE" },
        { from: "mA", to: "h1" }, { from: "mB", to: "h1" }, { from: "mC", to: "h1" }, { from: "mD", to: "h2" }, { from: "mE", to: "h2" },
        { from: "h1", to: "hub" }, { from: "h2", to: "hub" },
        { from: "hub", to: "plat", w: "0.41 BTC" },
        { from: "plat", to: "ex1" }, { from: "plat", to: "ex2" },
      ],
      stats: [
        { label: "节点总数", value: "13" }, { label: "入金总额", value: "0.41 BTC ≈ CAD 16,000" },
        { label: "归集节点", value: "1" }, { label: "出口", value: "2 · CAD 5,000" }, { label: "距离 ≤2 跳高危", value: "5" },
      ],
    },
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
    factors: [
      { key: "kyw", label: "KYW 超阈值", cat: "评分", weight: 0.40, raw: 88, tone: "red", evidence: ["收款钱包 KYW 88 > 阈值 70", "关联高风险辖区交易所"] },
      { key: "amount", label: "大额偏离", cat: "金额", weight: 0.30, raw: 72, tone: "amber", evidence: ["单笔 CAD 21,400 为限额 7×"] },
      { key: "counterparty", label: "对手风险", cat: "行为", weight: 0.20, raw: 64, tone: "amber", evidence: ["新对手地址 · FATF 灰名单辖区"] },
      { key: "history", label: "账户历史", cat: "账户库", weight: 0.10, raw: 20, tone: "green", evidence: ["342 笔无违规 · 信誉良好"] },
    ],
    evidence: ["收款钱包 KYW 风险评分 88,远超阈值 70", "关联高风险司法管辖区交易所(FATF 灰名单)", "单笔 CAD 21,400,为限额 7×"],
    alerts: [{ id: "ALT-50229", sev: "red", sevLabel: "高", desc: "出金收款钱包 KYW 风险评分 88,超阈值 70,关联高风险辖区交易所。", rule: "R-SCORE-02", time: "2026-03-14 08:54" }],
    tx: { id: "WD-20260314-058", network: "BTC", type: "提现", frozen: "0.34 BTC · CAD 21,400", destination: "bc1q…7h2k(外部)", duration: "出金暂缓" },
    profile: { kyc: "中风险", country: "🇺🇸 美国", sanctions: "未命中", pep: "非 PEP", vol30: "CAD 96,000", limit: "CAD 3,000", tier: "amber" },
    baseline: [
      { label: "单笔金额", norm: "限额 CAD 3,000", current: "CAD 21,400(×7)", abnormal: true },
      { label: "收款对手", norm: "历史固定地址", current: "全新 · KYW 88", abnormal: true },
      { label: "历史记录", norm: "342 笔无违规", current: "信誉良好" },
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
    factors: [
      { key: "fanin", label: "扇入聚类", cat: "统计聚合", weight: 0.40, raw: 90, tone: "red", evidence: ["6 商户 → 1 归集地址", "扇入图聚类显著"] },
      { key: "collusion", label: "多商户协同", cat: "行为", weight: 0.30, raw: 85, tone: "amber", evidence: ["6 商户此前互无关联突现协同", "72h 内集中归集"] },
      { key: "layering", label: "分层归集", cat: "链上", weight: 0.20, raw: 80, tone: "amber", evidence: ["归集后 2 中转分发 3 出口"] },
      { key: "amount", label: "金额异常", cat: "金额", weight: 0.10, raw: 70, tone: "amber", evidence: ["归集 CAD 124,000"] },
    ],
    evidence: ["6 商户分散入金 → 同一归集地址 0x71Be(CAD 124,000)", "归集后经 2 中转分发 3 出口 —— 分层混淆", "6 商户此前互无关联,突现协同扇入"],
    alerts: [{ id: "PM-2026-020", sev: "red", sevLabel: "高", desc: "事后回溯:6 商户分散入金归集至同一地址 0x71Be,归集后分层分发,疑似第三方资金集中过账。", rule: "R-AGG-05", time: "2026-03-16 10:33" }],
    tx: { id: "PM-2026-020", network: "多链", type: "事后回溯", frozen: "CAD 124,000(归集)", destination: "出口地址 ×3", duration: "已出账 · 追溯中" },
    profile: { kyc: "网络主体", country: "多辖区", sanctions: "未命中", pep: "—", vol30: "CAD 124,000", limit: "—", tier: "red" },
    baseline: [
      { label: "扇入主体数", norm: "独立商户各自入金", current: "6 商户 → 1 地址", abnormal: true },
      { label: "归集时间窗", norm: "分散随机", current: "72h 内集中", abnormal: true },
      { label: "商户关联", norm: "互无关联", current: "突现协同", abnormal: true },
    ],
    priorDisp: "PM-2026-020 事后命中转入本案 · 商户个体此前无单独违规",
    graph: {
      cols: ["商户来源", "归集", "中转", "出口"], dividerAfter: 0, leftWorld: "法币世界 · 商户入金", rightWorld: "链上世界 · Chainalysis KYT",
      nodes: [
        { id: "m1", label: "RapidPay", sub: "商户", col: 0, kind: "platform" },
        { id: "m2", label: "Eastwind", sub: "商户", col: 0, kind: "platform" },
        { id: "m3", label: "SwiftRemit", sub: "商户", col: 0, kind: "platform" },
        { id: "m4", label: "商户 D", sub: "商户", col: 0, kind: "platform" },
        { id: "m5", label: "商户 E", sub: "商户", col: 0, kind: "platform" },
        { id: "m6", label: "商户 F", sub: "商户", col: 0, kind: "platform" },
        { id: "hub", label: "归集地址", sub: "0x71Be…F0", col: 1, kind: "hub" },
        { id: "t1", label: "中转钱包", sub: "1A9x…c2", col: 2, kind: "mule" },
        { id: "t2", label: "中转钱包", sub: "1A9x…c2", col: 2, kind: "mule" },
        { id: "e1", label: "出口地址", sub: "1A9x…c2", col: 3, kind: "exit" },
        { id: "e2", label: "出口地址", sub: "1A9x…c2", col: 3, kind: "exit" },
        { id: "e3", label: "出口地址", sub: "1A9x…c2", col: 3, kind: "exit" },
      ],
      edges: [
        { from: "m1", to: "hub", w: "38,400" }, { from: "m2", to: "hub", w: "27,100" }, { from: "m3", to: "hub", w: "22,500" },
        { from: "m4", to: "hub" }, { from: "m5", to: "hub" }, { from: "m6", to: "hub" },
        { from: "hub", to: "t1" }, { from: "hub", to: "t2" },
        { from: "t1", to: "e1" }, { from: "t1", to: "e2" }, { from: "t2", to: "e3" },
      ],
      stats: [
        { label: "节点总数", value: "12" }, { label: "归集金额", value: "CAD 124,000" },
        { label: "扇入主体", value: "6 商户" }, { label: "归集节点", value: "1" }, { label: "出口", value: "3" },
      ],
    },
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
    factors: [
      { key: "sdn", label: "OFAC SDN 直接命中", cat: "名单", weight: 0.50, raw: 100, tone: "red", evidence: ["收款地址 0x7F4a 直接命中 OFAC SDN", "制裁实体 · 禁止交易"] },
      { key: "offshore", label: "离岸高风险商户", cat: "账户库", weight: 0.30, raw: 78, tone: "amber", evidence: ["离岸高风险 · 历史 2 笔违规", "离岸结构不透明"] },
      { key: "frozen", label: "出金即冻结", cat: "行为", weight: 0.20, raw: 70, tone: "red", evidence: ["系统自动冻结 · 已阻断"] },
    ],
    floor: { label: "制裁直接命中托底", bonus: 11.6, note: "OFAC SDN 直接命中触发强制托底(最低 99),累计 87.4 追加 +11.6,最终 99。" },
    evidence: ["收款地址 0x7F4a 直接命中 OFAC SDN 制裁名单", "系统已自动冻结资金", "离岸高风险商户,历史 2 笔违规"],
    alerts: [{ id: "ALT-50218", sev: "red", sevLabel: "高", desc: "出金收款地址 0x7F4a 直接命中 OFAC SDN 制裁名单,系统已自动冻结并升级 MLRO。", rule: "R-LIST-01", time: "2026-03-13 06:20" }],
    tx: { id: "WD-20260313-021", network: "ERC-20", type: "提现", frozen: "0.19 BTC · CAD 11,900", destination: "0x7F4a…9c21(OFAC · 已冻结)", duration: "已冻结" },
    profile: { kyc: "高风险", country: "离岸", sanctions: "直接命中 OFAC SDN", pep: "未知", vol30: "CAD 88,000", limit: "CAD 3,000", tier: "red" },
    baseline: [
      { label: "制裁命中", norm: "无", current: "OFAC SDN 直接", abnormal: true },
      { label: "商户风险", norm: "—", current: "离岸 · 高风险", abnormal: true },
      { label: "历史记录", norm: "2 笔违规", current: "惯犯特征" },
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
    factors: [
      { key: "device", label: "设备 / IP 聚类", cat: "设备", weight: 0.40, raw: 90, tone: "red", evidence: ["3 商户共享设备群 #D7 与 IP 段"] },
      { key: "ubo", label: "共同 UBO", cat: "主体", weight: 0.30, raw: 82, tone: "amber", evidence: ["Chen Wei 疑控 · Li Ming 共同 UBO"] },
      { key: "layering", label: "资金分层归集", cat: "链上", weight: 0.20, raw: 78, tone: "amber", evidence: ["分层归集后集中出金 CAD 38,400"] },
      { key: "watchlist", label: "关注名单关联", cat: "名单", weight: 0.10, raw: 60, tone: "amber", evidence: ["关联关注名单群组"] },
    ],
    evidence: ["3 商户共享设备指纹群 #D7 与 IP 段", "Chen Wei 疑为实际控制人,Li Ming 为共同 UBO", "资金分层归集后集中出金 CAD 38,400"],
    alerts: [{ id: "RING-2026-031", sev: "red", sevLabel: "高", desc: "团伙识别:3 商户共享设备 / IP 聚类成团,存在共同受益所有人,资金分层归集集中出金。", rule: "R-RING-01", time: "2026-03-15 16:30" }],
    tx: { id: "RING-2026-031", network: "多链", type: "团伙归集", frozen: "CAD 38,400", destination: "集中出金", duration: "调查中" },
    profile: { kyc: "团伙主体", country: "多辖区", sanctions: "未命中", pep: "Chen Wei 待查", vol30: "CAD 38,400", limit: "—", tier: "red" },
    baseline: [
      { label: "设备指纹", norm: "各商户独立设备", current: "3 商户 → 设备群 #D7", abnormal: true },
      { label: "受益所有人", norm: "各自独立 UBO", current: "2 共同受益人", abnormal: true },
      { label: "注册时间", norm: "分散", current: "集中于近期", abnormal: true },
    ],
    priorDisp: "RING-2026-031 团伙识别转入 · 关注名单群组关联",
    graph: {
      cols: ["养卡商户", "归集", "中转", "出金"], dividerAfter: 0, leftWorld: "法币世界 · 商户", rightWorld: "链上世界",
      nodes: [
        { id: "m1", label: "RapidPay", sub: "团伙核心", col: 0, kind: "platform" },
        { id: "m2", label: "QuickWallet", sub: "关联商户", col: 0, kind: "platform" },
        { id: "m3", label: "PayFlow", sub: "关联商户", col: 0, kind: "platform" },
        { id: "hub", label: "归集钱包", sub: "0x..养卡", col: 1, kind: "hub" },
        { id: "t1", label: "中转 mule", sub: "1A9x…c2", col: 2, kind: "mule" },
        { id: "t2", label: "中转 mule", sub: "1A9x…c2", col: 2, kind: "mule" },
        { id: "out", label: "集中出金", sub: "分层后出金", col: 3, kind: "exit" },
      ],
      edges: [
        { from: "m1", to: "hub", w: "14,200" }, { from: "m2", to: "hub", w: "12,000" }, { from: "m3", to: "hub", w: "12,200" },
        { from: "hub", to: "t1" }, { from: "hub", to: "t2" },
        { from: "t1", to: "out" }, { from: "t2", to: "out" },
      ],
      stats: [
        { label: "节点总数", value: "7" }, { label: "涉案总额", value: "CAD 38,400" },
        { label: "共同 UBO", value: "2" }, { label: "共享设备群", value: "#D7" }, { label: "出金", value: "1" },
      ],
    },
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
  const hi = c.priority === "高";
  const raw = hi ? 84 : c.priority === "中" ? 62 : 44;
  const isChain = c.sub.includes("链上") || c.sub.includes("网络");
  return {
    factors: [
      { key: "main", label: c.type, cat: "主因子", weight: 0.5, raw, tone: hi ? "red" : "amber", evidence: [c.risk, `来源 ${c.src}`] },
      { key: "risk", label: c.risk, cat: "风险类型", weight: 0.3, raw: Math.max(0, raw - 10), tone: "amber", evidence: [`涉及 ${c.amount}`] },
      { key: "subject", label: "主体 / 对手", cat: "账户库", weight: 0.2, raw: Math.max(0, raw - 20), tone: "blue", evidence: [`关联 ${c.linkIds}`] },
    ],
    evidence: [`${c.type} —— ${c.risk}`, `涉及金额 ${c.amount} · 关联 ${c.linkIds}`, `来源:${c.src}`],
    alerts: [{ id: c.linkIds.split(" ")[0] || c.id, sev: hi ? "red" : "amber", sevLabel: hi ? "高" : "中", desc: `${c.type} —— ${c.risk}。来源 ${c.src}。`, rule: "—", time: c.submitted }],
    tx: { id: c.linkIds.split(" · ")[0] || c.id, network: "—", type: "—", frozen: c.amount, destination: "—", duration: c.sla.text },
    profile: { kyc: isChain ? "链上主体" : "商户", country: c.sub.split(" · ")[0] || "—", sanctions: "未评估", pep: "—", vol30: c.amount, limit: "—", tier: hi ? "red" : "amber" },
    baseline: [
      { label: "涉及金额", norm: "—", current: c.amount, abnormal: true },
      { label: "关联项", norm: "—", current: c.linkIds },
      { label: "风险类型", norm: "—", current: c.risk },
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
