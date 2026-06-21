// 报告报送(FINTRAC 合规上报)· MLRO 工作台数据 + 报告状态机 + 报告类型。
// 报告来源:告警研判(转合规)/ 事后监控(转报送)/ 团伙识别(转案件)/ 制裁筛查 / 系统自动(LVCTR)。
// 状态 / MLRO 经手 / 事件存 store.ts 的 reportStore(内存)。
import { Send, CheckCircle2, RotateCcw, Ban, FileCheck2, Inbox } from "lucide-react";
import type { Tone, Person } from "./data";

// ── FINTRAC 报告类型(加密 MSB 口径)──
export type RType = "STR" | "LVCTR" | "TPR";
export const RTYPE: Record<RType, { label: string; full: string; tone: Tone; deadline: string }> = {
  STR: { label: "STR", full: "可疑交易报告", tone: "red", deadline: "确定可疑后 30 日内" },
  LVCTR: { label: "LVCTR", full: "大额虚拟货币交易报告", tone: "blue", deadline: "交易后 5 个工作日内" },
  TPR: { label: "TPR", full: "恐怖分子 / 制裁财产报告", tone: "violet", deadline: "立即 · 无延迟" },
};

// ── 报告状态机:草稿 →(提交)→ 待MLRO复核 →(复核通过)→ 待报送 →(报送)→ 已报送 →(回执)→ FINTRAC已接收 ──
export type RState = "draft" | "review" | "queued" | "filed" | "ack" | "returned" | "void";
export const RSTATE: Record<RState, { label: string; tone: Tone; active: boolean }> = {
  draft: { label: "草稿", tone: "grey", active: true },
  review: { label: "待MLRO复核", tone: "amber", active: true },
  queued: { label: "待报送", tone: "blue", active: true },
  filed: { label: "已报送·待回执", tone: "violet", active: true },
  ack: { label: "FINTRAC已接收", tone: "green", active: false },
  returned: { label: "被退回·需补正", tone: "red", active: true },
  void: { label: "已作废", tone: "grey", active: false },
};

// 状态门控动作(MLRO 复核 / 报送 / 回执)
export interface RAction { k: string; label: string; to: RState; icon: typeof Send; tip: string; tone?: Tone }
export const RFLOW: Record<RState, RAction[]> = {
  draft: [
    { k: "submit", label: "提交 MLRO 复核", to: "review", icon: Send, tip: "起草完成 · 提交合规官复核" },
    { k: "void", label: "作废", to: "void", icon: Ban, tip: "无需报送 · 作废留档", tone: "grey" },
  ],
  review: [
    { k: "approve", label: "复核通过 · 入报送队列", to: "queued", icon: CheckCircle2, tip: "MLRO 签发 · 进入报送队列", tone: "blue" },
    { k: "return", label: "退回起草人", to: "draft", icon: RotateCcw, tip: "信息不足 · 退回补充", tone: "amber" },
    { k: "void", label: "作废", to: "void", icon: Ban, tip: "嫌疑排除 · 作废留档", tone: "grey" },
  ],
  queued: [
    { k: "file", label: "标记已报送 FINTRAC", to: "filed", icon: FileCheck2, tip: "已通过 FINTRAC 电子报送", tone: "violet" },
  ],
  filed: [
    { k: "ack", label: "登记 FINTRAC 回执", to: "ack", icon: Inbox, tip: "已收到 FINTRAC 接收回执", tone: "green" },
    { k: "returned", label: "登记退回 · 需补正", to: "returned", icon: RotateCcw, tip: "FINTRAC 退回 · 字段需补正", tone: "red" },
  ],
  returned: [
    { k: "resubmit", label: "补正后重新复核", to: "review", icon: Send, tip: "补正完成 · 重新提交复核", tone: "amber" },
    { k: "void", label: "作废", to: "void", icon: Ban, tip: "作废留档", tone: "grey" },
  ],
  ack: [],
  void: [],
};

// FINTRAC 报告必填字段清单(复核重点)— 按类型自适应
export const RFIELDS: Record<RType, { label: string; sub: string }[]> = {
  STR: [
    { label: "报告主体信息", sub: "报送机构 + 责任合规官" },
    { label: "交易明细", sub: "逐笔金额 / 时间 / 钱包地址 / 链" },
    { label: "可疑理由叙述", sub: "为何构成「合理怀疑」(自由文本)" },
    { label: "涉事人 / 受益所有人", sub: "KYC / KYB / UBO 信息" },
    { label: "资金处置", sub: "冻结 / 放行 / 退回 / 已出账" },
  ],
  LVCTR: [
    { label: "报告主体信息", sub: "报送机构 + 责任人" },
    { label: "大额交易明细", sub: "≥ CAD 10,000 虚拟货币交易逐笔" },
    { label: "交易对手信息", sub: "发起人 / 收款人 / 第三方" },
    { label: "虚拟货币类型与价值", sub: "币种 / 数量 / CAD 折算" },
  ],
  TPR: [
    { label: "报告主体信息", sub: "报送机构 + 责任合规官" },
    { label: "财产明细", sub: "受控资产 / 钱包 / 金额" },
    { label: "制裁 / 名单依据", sub: "OFAC / UN / FINTRAC 列名" },
    { label: "处置措施", sub: "冻结 / 阻断 / 上报执法" },
  ],
};

export interface Report {
  id: string; type: RType; status: RState;
  src: string; srcId?: string; to?: string; // 来源 + 关联记录(可跳转)
  subject: string; sub: string;             // 涉事主体
  amount: string; summary: string;          // 金额 + 报送摘要
  officer: Person; mlro: Person | null;     // 起草人 + MLRO
  due: { text: string; tone: Tone };        // 报送时限剩余
  filedAt?: string;                          // 报送时间(已报送 / 已接收)
  ref?: string;                              // FINTRAC 受理回执号
}

const JL: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const DW: Person = { i: "DW", n: "David Wu", c: "#0ea5e9" };
const EZ: Person = { i: "EZ", n: "Emma Zhang", c: "var(--success)" }; // MLRO
const SYS: Person = { i: "⚙", n: "系统自动", c: "var(--chip-fg)" };
export const MLRO: Person = EZ;

// 静态报告样本。STR 一律由案件管理派生(案件 = STR 唯一发起点,见 page);
// 此处只保留 非可疑判定 的客观报告:LVCTR(系统阈值)/ TPR(制裁即时,历史已接收)。
export const REPORTS: Report[] = [
  { id: "TPR-20260313-0021", type: "TPR", status: "ack", src: "制裁筛查", srcId: "ALT-50218", to: "/alert?id=ALT-50218",
    subject: "OffshoreFX Ltd. · 0x7F4a…9c21", sub: "提现 · OFAC SDN 直接命中", amount: "CAD 11,900", summary: "收款地址直接命中 OFAC SDN 制裁名单,资金已自动冻结,按制裁财产立即上报(无需可疑判定)。",
    officer: DW, mlro: EZ, due: { text: "已报送", tone: "grey" }, filedAt: "2026-03-13 07:05", ref: "FINTRAC #TPR-CA-2603-10882" },
  { id: "LVCTR-20260619-0143", type: "LVCTR", status: "queued", src: "系统自动", subject: "大额虚拟货币交易批次", sub: "06-18 当日 · 12 笔 ≥ CAD 10,000",
    amount: "CAD 246,800", summary: "系统自动归集当日 ≥ CAD 10,000 虚拟货币交易,客观阈值触发,无需可疑判定,批量报送。",
    officer: SYS, mlro: null, due: { text: "剩 2 工作日", tone: "amber" } },
  { id: "LVCTR-20260616-0138", type: "LVCTR", status: "ack", src: "系统自动", subject: "大额虚拟货币交易批次", sub: "06-15 当日 · 9 笔 ≥ CAD 10,000",
    amount: "CAD 181,500", summary: "当日大额虚拟货币交易批量报送,已获 FINTRAC 接收回执。",
    officer: SYS, mlro: null, due: { text: "已报送", tone: "grey" }, filedAt: "2026-06-16 10:05", ref: "FINTRAC #LVCTR-CA-2206-55190" },
];

export const reportOf = (id?: string) => REPORTS.find((r) => r.id === id);

// 案件 → STR 报告状态映射(案件管理 = STR 唯一发起点;在 ReportFiling 实时派生)。
export const caseStrState = (cs: string): RState =>
  cs === "str_draft" ? "draft" : cs === "mlro" ? "review" : cs === "queued" ? "queued" : cs === "filed" ? "filed" : "ack";