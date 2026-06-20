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
export interface Rule {
  id: string; name: string; cat: RuCat; cond: string; action: string; state: RuState;
  hits30: number; fp30: string; src: string; srcId?: string; to?: string;
  owner: Person; updated: string; weight: string; backtest?: Backtest;
}

const JL: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const EZ: Person = { i: "EZ", n: "Emma Zhang", c: "var(--success)" };
const RH: Person = { i: "RH", n: "Raj Hota", c: "#0ea5e9" }; // 风控建模 / 变更治理

// 内置(事中 / 告警长期生效)规则 + 治理流水线中的提案
export const RULES: Rule[] = [
  { id: "R-AMT-001", name: "大额充值监控", cat: "金额阈值", cond: "单笔充值 ≥ CAD 5,000", action: "评分 +60 · 转研判", state: "live", hits30: 142, fp30: "6%", src: "内置", owner: JL, updated: "2026-04-12", weight: "+60" },
  { id: "R-AMT-002", name: "大额提现监控", cat: "金额阈值", cond: "单笔提现 ≥ CAD 3,000", action: "评分 +55 · 转研判", state: "live", hits30: 98, fp30: "9%", src: "内置", owner: JL, updated: "2026-04-12", weight: "+55" },
  { id: "R-CHN-001", name: "混币器关联", cat: "链上溯源", cond: "资金 ≤2 跳触及制裁混币器", action: "评分 +35 · 冻结", state: "live", hits30: 12, fp30: "2%", src: "内置", owner: SC, updated: "2026-05-03", weight: "+35" },
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
export const BFR: Record<string, { name: string; cat: RuCat; cond: string; action: string; weight: string }> = {
  "结构化拆分(累计)": { name: "同主体滑窗累计阈值", cat: "统计聚合", cond: "同主体 7 日累计入金 ≥ CAD 10,000", action: "评分 +40 · 转研判", weight: "+40" },
  "多账户归集(扇入)": { name: "多主体扇入同一地址", cat: "统计聚合", cond: "≥4 主体 14 日内汇入同一非托管地址", action: "转研判 · 图关联标记", weight: "+40" },
  "休眠后突发": { name: "休眠激活异常", cat: "行为模式", cond: "休眠 ≥60 天后单日出金笔数 ≥ 基线 5×", action: "评分 +30", weight: "+30" },
  "币币链跳(回溯)": { name: "隐私币 / 跨链跳转", cat: "链上溯源", cond: "兑入隐私币 或 经跨链桥转出", action: "评分 +45 · 转研判", weight: "+45" },
};
export const bfrMeta = (pattern: string) => BFR[pattern] || { name: `${pattern}（回填）`, cat: "统计聚合" as RuCat, cond: "回填 typology · 待补条件", action: "评分 +N", weight: "+30" };
export const bfrDefault = (staticBackfill?: boolean): RuState => (staticBackfill ? "live" : "backtest");
