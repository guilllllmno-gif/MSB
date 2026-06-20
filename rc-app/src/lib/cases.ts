// 案件管理:事中冻结/驳回·告警升级·事后转案件·团伙转案件 形成的合规案件 + 案件状态机。
// 状态/owner/事件存 store.ts 的 caseStore(内存)。结案·转报送喂入报告报送。
import { FileText, FilePen, UserCheck, Send, CheckCircle2, GitMerge, FolderPlus, Inbox, ShieldQuestion } from "lucide-react";
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

export interface Case {
  id: string; subject: string; sub: string; type: string; risk: string; priority: Priority;
  amount: string; links: number; linkIds: string; linkTo?: string; state: CState;
  owner: Person | null; sla: { text: string; tone: Tone }; submitted: string; src: string;
}

const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const JL: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const EZ: Person = { i: "EZ", n: "Emma Zhang", c: "var(--success)" };
const DW: Person = { i: "DW", n: "David Wu", c: "#0ea5e9" };

export const CASES: Case[] = [
  { id: "CASE-20260318-001", subject: "NovaPay Technologies Ltd.", sub: "美国 · 商户", type: "混币器关联 · 制裁溯源", risk: "可疑洗钱", priority: "高", amount: "CAD 8,200.00", links: 2, linkIds: "ALT-50231 · DEP-20260315-001", linkTo: "/alert?id=ALT-50231", state: "mlro", owner: null, sla: { text: "剩 1d 02h", tone: "amber" }, submitted: "2026-03-18 09:30", src: "告警升级" },
  { id: "CASE-20260317-014", subject: "GlobalRemit Ltd.", sub: "离岸 · 商户", type: "大额分层归集", risk: "可疑洗钱", priority: "高", amount: "CAD 48,000.00", links: 3, linkIds: "WD-20260317-188 等 3 项", state: "queued", owner: EZ, sla: { text: "今日报送", tone: "red" }, submitted: "2026-03-17 15:12", src: "告警升级" },
  { id: "CASE-20260317-009", subject: "BlockTrade Corp.", sub: "美国 · 商户", type: "KYW 超阈值", risk: "欺诈交易", priority: "中", amount: "CAD 21,400.00", links: 2, linkIds: "ALT-50229 · WD-20260314-058", linkTo: "/alert?id=ALT-50229", state: "str_draft", owner: SC, sla: { text: "剩 2d 06h", tone: "amber" }, submitted: "2026-03-17 11:05", src: "事中驳回" },
  { id: "CASE-20260316-021", subject: "归集地址 0x71Be…F0", sub: "链上 · 多商户网络", type: "扇入归集网络", risk: "团伙网络", priority: "高", amount: "CAD 124,000.00", links: 6, linkIds: "PM-2026-020 · 6 主体", linkTo: "/finding?id=PM-2026-020", state: "investigating", owner: SC, sla: { text: "剩 18h", tone: "amber" }, submitted: "2026-03-16 10:33", src: "事后转案件" },
  { id: "CASE-20260318-018", subject: "OffshoreFX Ltd.", sub: "离岸 · 商户", type: "OFAC SDN 直接命中", risk: "制裁规避", priority: "高", amount: "CAD 11,900.00", links: 2, linkIds: "ALT-50218 · WD-20260313-021", linkTo: "/alert?id=ALT-50218", state: "filed", owner: EZ, sla: { text: "已报送", tone: "grey" }, submitted: "2026-03-13 06:20", src: "制裁冻结" },
  { id: "CASE-20260315-007", subject: "RapidPay", sub: "加拿大 · 商户", type: "众包养卡团伙", risk: "团伙网络", priority: "高", amount: "CAD 38,400.00", links: 6, linkIds: "RING-2026-031 · 6 主体", linkTo: "/ring?id=RING-2026-031", state: "investigating", owner: DW, sla: { text: "剩 1d 12h", tone: "amber" }, submitted: "2026-03-15 16:30", src: "团伙转案件" },
  { id: "CASE-20260312-003", subject: "QuickWallet Ltd.", sub: "美国 · 商户", type: "结构化拆分", risk: "结构化拆分", priority: "中", amount: "CAD 9,800.00", links: 1, linkIds: "PM-2026-022", linkTo: "/finding?id=PM-2026-022", state: "closed", owner: JL, sla: { text: "已完结", tone: "grey" }, submitted: "2026-03-12 14:20", src: "事后转案件" },
  { id: "CASE-20260310-002", subject: "HavenPay Inc.", sub: "离岸 · 商户", type: "混币器关联", risk: "可疑洗钱", priority: "中", amount: "CAD 33,500.00", links: 2, linkIds: "WD-20260316-256 等", state: "merged", owner: DW, sla: { text: "已合并", tone: "grey" }, submitted: "2026-03-10 17:20", src: "告警升级" },
];

export const caseOf = (id?: string) => CASES.find((c) => c.id === id);
export const CASE_ICON = { FileText, FolderPlus, ShieldQuestion };
