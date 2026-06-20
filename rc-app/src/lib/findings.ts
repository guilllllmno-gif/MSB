// 事后监控:回溯命中(findings)数据 + 命中项状态机 + 批次历史。状态/处置存 store.ts 的 findingStore(内存)。
import { Layers, Network, Zap, Repeat, Coins, Shuffle, UserPlus, FileQuestion, RotateCcw, ArrowUpCircle, XCircle, Send, FolderPlus, Store, Wallet } from "lucide-react";
import type { Tone, Person } from "./data";

// 检测维度 —— 事后监控是批量回溯,主体维度不统一(不像事中/告警的单笔单商户)
export type FDim = "merchant" | "address" | "network";
export const FDIM: Record<FDim, { label: string; icon: typeof Layers; profileTitle: string }> = {
  merchant: { label: "商户主体", icon: Store, profileTitle: "商户画像" },
  address: { label: "链上地址", icon: Wallet, profileTitle: "地址画像" },
  network: { label: "多商户网络", icon: Network, profileTitle: "网络画像" },
};

export type FState = "new" | "progress" | "pending" | "escalated" | "tracing" | "closed_fp" | "closed_str" | "closed_case";
export const FSTATES: Record<FState, { label: string; tone: Tone; active: boolean }> = {
  new: { label: "新建·待认领", tone: "grey", active: true },          // ①
  progress: { label: "处理中", tone: "amber", active: true },          // ②
  pending: { label: "待补充材料", tone: "blue", active: true },        // ③
  escalated: { label: "已升级", tone: "violet", active: true },        // ④
  tracing: { label: "已出账·追溯中", tone: "red", active: true },      // ⑧ 确认可疑后进入(资金已出,追溯/损失评估)
  closed_fp: { label: "已结·误报", tone: "grey", active: false },       // ⑤
  closed_str: { label: "已结·确认可疑·转报送", tone: "red", active: false }, // ⑥
  closed_case: { label: "已结·转案件", tone: "violet", active: false }, // ⑦
};

// 步进动作 → 目标状态(认领 / 补料 / 升级 等;确认可疑、规则回填走详情页特殊处置)
export const STEP = {
  claim: { label: "认领", icon: UserPlus, to: "progress" as FState, tip: "认领 · 开始回溯调查" },
  reqinfo: { label: "补料", icon: FileQuestion, to: "pending" as FState, tip: "请求补充材料(发 RFI)" },
  resume: { label: "材料已回", icon: RotateCcw, to: "progress" as FState, tip: "材料已回 · 继续调查" },
  escalate: { label: "升级", icon: ArrowUpCircle, to: "escalated" as FState, tip: "升级 L2 / MLRO" },
  fp: { label: "误报关闭", icon: XCircle, to: "closed_fp" as FState, tip: "结案 · 误报(当时放行无误)" },
  str: { label: "转报送", icon: Send, to: "closed_str" as FState, tip: "确认可疑 · 补 STR 报送" },
  case: { label: "转案件", icon: FolderPlus, to: "closed_case" as FState, tip: "并入案件深查" },
};
export type StepKey = keyof typeof STEP;
export const STEP_FLOW: Record<FState, StepKey[]> = {
  new: ["claim"],
  progress: ["reqinfo", "escalate", "fp"],
  pending: ["resume", "fp"],
  escalated: ["fp"],
  tracing: ["str", "case"], // ⑧ 追溯中 → 终态;规则回填(⑨)为独立动作
  closed_fp: [], closed_str: [], closed_case: [],
};
export const CAN_CONFIRM: FState[] = ["progress", "pending", "escalated"]; // 可「确认可疑」→ 追溯中

// 终态处置结论的必填理由(记审计日志)—— 转报送 / 转案件 / 误报关闭
export const FREASONS: Record<string, string[]> = {
  str: ["确认结构化拆分 · 规避申报阈值", "确认分层归集 · 洗钱网络", "链上溯源切断 · 隐私币 / 跨链", "确认可疑且无合理解释", "其他(见调查依据)"],
  case: ["需多笔 / 跨主体关联深查", "并入既有案件", "涉及团伙 / 网络", "需执法 / 外部协作", "其他(见调查依据)"],
  fp: ["回看为正常业务波动(如促销)", "已有合理解释 · 资料充分", "规则误命中 · 需调优", "其他(见调查依据)"],
};

// 资金追溯三档 —— 选哪档,给「追回组」一个**默认建议**(不互斥、不禁止;另一项仍可手动补登)
export interface TraceTier { label: string; tone: Tone; recovery: "freeze" | "track" | "loss"; guide: string }
export const TRACE_TIERS: TraceTier[] = [
  { label: "可追溯 · 已冻结下游账户", tone: "green", recovery: "freeze", guide: "资金已定位到可触达的下游账户并冻结 —— 追回有望。默认登记「请求下游冻结」;若仍有部分资金已流失,可在追溯工作台补登「上报已发生损失」。" },
  { label: "部分可追溯 · 持续追踪", tone: "amber", recovery: "track", guide: "链路部分中断 —— 以止损与持续追踪为主,不预设冻结 / 损失;冻结与损失均可按实际在工作台登记。" },
  { label: "不可追溯 · 上报已发生损失", tone: "red", recovery: "loss", guide: "链路已断、资金不可逆 —— 默认登记「上报已发生损失」,重心转向止损与规则回填;如仍有部分可触达,也可补登「请求下游冻结」。" },
];
export const TRACE = TRACE_TIERS.map((t) => t.label);
export const traceTier = (label?: string) => TRACE_TIERS.find((t) => t.label === label);
// 追溯档位 → 追回组**默认建议**:只「加」对应默认动作,不清除另一项(两者非互斥,可并存);部分可追溯不预设
export const traceRecovery = (label?: string): { frozen?: boolean; lossReported?: boolean } => {
  const r = traceTier(label)?.recovery;
  if (r === "freeze") return { frozen: true };
  if (r === "loss") return { lossReported: true };
  return {};
};

export interface Finding { id: string; pattern: string; icon: typeof Layers; dim: FDim; subject: string; sub: string; period: string; hit: string; amount: string; risk: "red" | "amber"; status: FState; batch: string; txns: number; rule: string; sla: { text: string; tone: Tone }; owner: Person | null; trace?: string; backfill?: boolean }
const JL: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const MK: Person = { i: "MK", n: "Mae Koh", c: "var(--success)" };
export const FINDINGS: Finding[] = [
  { id: "PM-2026-031", pattern: "结构化拆分(累计)", icon: Layers, dim: "merchant", subject: "RapidPay", sub: "商户 · 加拿大", period: "近 7 天", hit: "14 笔均 < CAD 1,000、合计 CAD 12,600,疑似规避大额申报阈值", amount: "CAD 12,600", risk: "red", status: "new", batch: "#20260619-02", txns: 14, rule: "高频拆分交易(累计阈值)", sla: { text: "剩 2d", tone: "amber" }, owner: null },
  { id: "PM-2026-030", pattern: "多账户归集(扇入)", icon: Network, dim: "network", subject: "归集地址 0x9Df2…A4c0", sub: "链上地址 · ERC-20", period: "近 14 天", hit: "6 个商户向同一归集地址集中转入,典型分层归集", amount: "CAD 86,400", risk: "red", status: "tracing", batch: "#20260619-02", txns: 23, rule: "扇入归集模式", sla: { text: "剩 9h", tone: "amber" }, owner: SC },
  { id: "PM-2026-029", pattern: "休眠后突发", icon: Zap, dim: "merchant", subject: "BlockTrade Corp.", sub: "商户 · 美国", period: "近 24h", hit: "账户休眠 90 天后单日 8 笔高额出金,行为突变", amount: "CAD 41,200", risk: "amber", status: "progress", batch: "#20260619-02", txns: 8, rule: "休眠激活异常", sla: { text: "剩 1d 04h", tone: "amber" }, owner: JL },
  { id: "PM-2026-028", pattern: "币币链跳(回溯)", icon: Shuffle, dim: "address", subject: "0x5078…Ec8c", sub: "链上地址 · 多链", period: "近 30 天", hit: "多笔兑入隐私币后跨链提走,切断溯源链路", amount: "CAD 52,000", risk: "red", status: "escalated", batch: "#20260618-02", txns: 11, rule: "隐私币 / 跨链溯源", sla: { text: "剩 6h", tone: "red" }, owner: SC },
  { id: "PM-2026-027", pattern: "交易速度骤增", icon: Repeat, dim: "merchant", subject: "NovaPay Technologies", sub: "商户 · 美国", period: "近 48h", hit: "笔频较 30 天基线 5.2×,远超同业商户群", amount: "CAD 18,900", risk: "amber", status: "pending", batch: "#20260618-02", txns: 46, rule: "速度 / 峰值偏离", sla: { text: "已暂停", tone: "grey" }, owner: MK },
  { id: "PM-2026-026", pattern: "对手集中度异常", icon: Coins, dim: "merchant", subject: "SwiftRemit Inc.", sub: "商户 · 离岸", period: "近 30 天", hit: "80% 出金流向单一高风险司法管辖区交易所", amount: "CAD 33,500", risk: "amber", status: "new", batch: "#20260619-02", txns: 19, rule: "对手集中度", sla: { text: "剩 2d 06h", tone: "amber" }, owner: null },
  // 已结案历史(让「已结案」分桶有数据)
  { id: "PM-2026-022", pattern: "结构化拆分(累计)", icon: Layers, dim: "merchant", subject: "QuickWallet Ltd.", sub: "商户 · 美国", period: "近 7 天", hit: "拆分入金规避阈值,确认漏判,已补 STR", amount: "CAD 9,800", risk: "red", status: "closed_str", batch: "#20260618-02", txns: 11, rule: "高频拆分交易(累计阈值)", sla: { text: "已完结", tone: "grey" }, owner: JL, trace: "部分可追溯 · 持续追踪", backfill: true },
  { id: "PM-2026-021", pattern: "交易速度骤增", icon: Repeat, dim: "merchant", subject: "PayFlow Systems", sub: "商户 · 加拿大", period: "近 48h", hit: "促销活动导致笔频上升,回看为正常业务波动", amount: "CAD 6,400", risk: "amber", status: "closed_fp", batch: "#20260617-02", txns: 28, rule: "速度 / 峰值偏离", sla: { text: "已完结", tone: "grey" }, owner: MK },
  { id: "PM-2026-020", pattern: "多账户归集(扇入)", icon: Network, dim: "network", subject: "归集地址 0x71Be…F0", sub: "链上地址 · ERC-20", period: "近 14 天", hit: "确认洗钱归集网络,并入案件深查", amount: "CAD 124,000", risk: "red", status: "closed_case", batch: "#20260615-02", txns: 31, rule: "扇入归集模式", sla: { text: "已完结", tone: "grey" }, owner: SC, trace: "不可追溯 · 上报已发生损失", backfill: true },
];
export const findingOf = (id?: string) => FINDINGS.find((f) => f.id === id) || FINDINGS[0];

// 命中详情证据(供详情页审研判 / 给结论)
export interface TxRow { id?: string; t: string; party: string; amount: string; note: string } // id = 订单号 / 交易ID;归集/汇总类逐笔不适用则留空
export interface Factor { emoji: string; title: string; desc: string; tone: Tone }
// 资金路径节点:角色(来源/归集/中转/混淆/跨链/出口/失联)+ 风险色 + 每跳金额/说明
export interface PathNode { label: string; role: string; tone: Tone; meta?: string }
// 分布构成(对手集中度等)—— 用占比条而非逐笔表格更直观
export interface DistSeg { label: string; pct: number; amount: string; tone: Tone }
export interface Detail { factors: Factor[]; profile: { country: string; kyc: string; registered: string; history: string; tags?: string[] }; txList: TxRow[]; gap: string; rec: string; path?: PathNode[]; dist?: DistSeg[]; distLabel?: string }
export const DETAIL: Record<string, Detail> = {
  "PM-2026-031": {
    factors: [
      { emoji: "🧩", title: "14 笔均 < CAD 1,000,单笔都不触阈", desc: "刻意压在大额申报线下", tone: "red" },
      { emoji: "📈", title: "7 日累计 CAD 12,600,超阈 26%", desc: "跨日累计才显形", tone: "red" },
      { emoji: "⏱", title: "集中在 3 个交易日完成", desc: "节奏接近自动化拆分", tone: "amber" },
    ],
    profile: { country: "加拿大", kyc: "完成", registered: "1.4 年", history: "近 30 天 42 笔 · 无历史违规" },
    txList: [
      { id: "DEP-20260612-0142", t: "06-12 09:14", party: "0x5078…Ec8c", amount: "CAD 980", note: "充值" },
      { id: "DEP-20260612-0188", t: "06-12 13:02", party: "0x5078…Ec8c", amount: "CAD 920", note: "充值" },
      { id: "DEP-20260613-0091", t: "06-13 10:31", party: "0x77a1…b2D9", amount: "CAD 950", note: "充值" },
      { id: "DEP-20260614-0235", t: "06-14 16:48", party: "0x5078…Ec8c", amount: "CAD 990", note: "充值" },
    ],
    gap: "事中按单笔阈值(≥CAD 1,000)判定,14 笔每笔都压在线下,逐笔放行;拆分只有在 7 日累计维度才显形 —— 事中缺累计/滑窗规则。",
    rec: "确认结构化拆分,补 STR;回填「同主体 7 日累计 ≥ CAD 10,000」累计规则,使事中实时拦截同类。",
  },
  "PM-2026-030": {
    factors: [
      { emoji: "🕸", title: "6 个商户向同一地址归集", desc: "扇入(fan-in)归集结构", tone: "red" },
      { emoji: "💰", title: "14 天归集 CAD 86,400", desc: "归集后疑似统一中转", tone: "red" },
      { emoji: "🔗", title: "归集地址非任一商户托管", desc: "第三方控制,典型分层", tone: "amber" },
    ],
    profile: { country: "—(链上地址)", kyc: "不适用", registered: "地址活跃 22 天", history: "关联 6 商户 · 网络内高频", tags: ["扇入归集", "第三方控制", "多商户关联", "高风险"] },
    txList: [
      { t: "06-05 ~ 06-18", party: "RapidPay 等 6 商户", amount: "CAD 86,400", note: "汇入归集地址 0x9Df2" },
      { t: "06-16 21:10", party: "中转钱包 ×2", amount: "CAD 40,200", note: "归集后过账" },
      { t: "06-18 02:33", party: "出口地址 ×3", amount: "CAD 38,000", note: "分发出口" },
    ],
    gap: "事中按单商户单笔评估,看不到「多商户 → 同一地址」的跨主体归集关系;扇入只有图聚类/跨账户维度才显形。",
    rec: "确认分层归集网络,转案件 + 并入团伙;回填「多主体扇入同一地址」图关系规则。",
    path: [
      { label: "6 商户账户", role: "来源", tone: "amber", meta: "分散入金" },
      { label: "归集 0x9Df2", role: "归集", tone: "red", meta: "CAD 86,400" },
      { label: "中转钱包 ×2", role: "中转", tone: "amber", meta: "归集后过账" },
      { label: "出口地址 ×3", role: "出口", tone: "grey", meta: "分发出口" },
    ],
  },
  "PM-2026-029": {
    factors: [
      { emoji: "😴", title: "休眠 90 天后突然激活", desc: "行为基线突变", tone: "amber" },
      { emoji: "⚡", title: "单日 8 笔高额出金", desc: "激活即大额提走", tone: "red" },
      { emoji: "🌐", title: "出金集中高风险地区", desc: "去向风险偏高", tone: "amber" },
    ],
    profile: { country: "美国", kyc: "完成", registered: "2.1 年", history: "休眠 90 天 · 激活前均值 CAD 1,200/日" },
    txList: [
      { id: "WD-20260619-0712", t: "06-19 08:02", party: "bc1q…7h2k", amount: "CAD 6,400", note: "提现" },
      { id: "WD-20260619-0744", t: "06-19 09:30", party: "bc1q…7h2k", amount: "CAD 5,800", note: "提现" },
      { id: "WD-20260619-0779", t: "06-19 11:15", party: "0x3Ab…9F1", amount: "CAD 5,200", note: "提现" },
      { id: "WD-20260619-0821", t: "06-19 14:40", party: "0x3Ab…9F1", amount: "CAD 4,900", note: "提现" },
    ],
    gap: "事中无「与自身历史基线对比」,单笔金额未超绝对阈值;休眠后突变只有时序/基线模型才能识别。",
    rec: "调查账户是否被盗用 / 易主;视结果转报送或案件;回填「休眠 N 天后激活 + 日出金突增」行为规则。",
  },
  "PM-2026-028": {
    factors: [
      { emoji: "🔀", title: "兑入隐私币后跨链提走", desc: "BTC→XMR 切断链上溯源", tone: "red" },
      { emoji: "🧱", title: "多笔分散兑换", desc: "规避单笔大额识别", tone: "amber" },
      { emoji: "🚫", title: "去向不可追溯", desc: "进入隐私链后失联", tone: "red" },
    ],
    profile: { country: "—(链上地址)", kyc: "不适用", registered: "多链活跃", history: "30 天 11 笔 · 关联混币器", tags: ["隐私币兑换", "跨链桥", "溯源切断", "高风险"] },
    txList: [
      { t: "05-22 ~ 06-15", party: "XMR 网络", amount: "CAD 31,000", note: "多笔兑入隐私币(分散)" },
      { id: "0x7c91…3aF2", t: "06-10 03:21", party: "跨链桥 Bridge", amount: "CAD 21,000", note: "跨链转出" },
    ],
    gap: "事中按交易时点的链上风险打分,隐私币/跨链是在「事后回看资金去向」才暴露;实时无法预知后续链跳。",
    rec: "确认溯源切断,转报送 + 案件;回填「兑入隐私币 / 跨链桥」typology 提高链上规则权重。",
    path: [
      { label: "来源充值", role: "来源", tone: "grey", meta: "BTC 入金" },
      { label: "兑入 XMR", role: "混淆", tone: "red", meta: "隐私币" },
      { label: "跨链桥", role: "跨链", tone: "red", meta: "切断溯源" },
      { label: "失联", role: "失联", tone: "red", meta: "去向不可追" },
    ],
  },
  "PM-2026-027": {
    factors: [
      { emoji: "📊", title: "笔频较 30 天基线 5.2×", desc: "远超自身常态", tone: "amber" },
      { emoji: "👥", title: "高于同业商户群 P95", desc: "群体对比离群", tone: "amber" },
    ],
    profile: { country: "美国", kyc: "完成", registered: "8 个月", history: "基线 9 笔/日 · 当前 46 笔/48h" },
    txList: [
      { t: "06-17 ~ 06-19", party: "多对手", amount: "CAD 18,900", note: "46 笔(48h)" },
    ],
    gap: "事中无速度/峰值与基线及同业群的对比;速度异常需统计基线,逐笔看不出。",
    rec: "核实是否营销活动等正常波动;正常则误报关闭,异常则升级;视情回填速度偏离规则。",
  },
  "PM-2026-026": {
    factors: [
      { emoji: "🎯", title: "80% 出金流向单一交易所", desc: "对手高度集中", tone: "amber" },
      { emoji: "🌐", title: "对手位于高风险辖区", desc: "FATF 关注地区", tone: "amber" },
    ],
    profile: { country: "离岸", kyc: "完成", registered: "1.1 年", history: "30 天 19 笔 · 对手集中" },
    txList: [],
    distLabel: "近 30 天出金对手分布",
    dist: [
      { label: "高风险交易所 X(单一对手)", pct: 80, amount: "CAD 26,800", tone: "amber" },
      { label: "其它对手(合计)", pct: 20, amount: "CAD 6,700", tone: "grey" },
    ],
    gap: "事中按单笔评估,看不到「30 天对手集中度」分布;集中度需聚合统计。",
    rec: "核实业务合理性;异常则升级 / 加强监控;回填对手集中度规则。",
  },
  "PM-2026-022": {
    factors: [{ emoji: "🧩", title: "拆分入金规避阈值", desc: "确认漏判,已补 STR", tone: "red" }],
    profile: { country: "美国", kyc: "完成", registered: "10 个月", history: "已结案 · 转报送" },
    txList: [{ t: "06-11", party: "多笔", amount: "CAD 9,800", note: "11 笔拆分" }],
    gap: "同结构化拆分:事中缺累计维度。已回填累计规则。",
    rec: "已补 STR · 已回填规则 · 部分可追溯。",
  },
  "PM-2026-021": {
    factors: [{ emoji: "📊", title: "促销致笔频上升", desc: "回看为正常波动", tone: "amber" }],
    profile: { country: "加拿大", kyc: "完成", registered: "2.3 年", history: "已结案 · 误报" },
    txList: [{ t: "06-16", party: "多对手", amount: "CAD 6,400", note: "28 笔(促销)" }],
    gap: "速度上升由促销活动解释,非可疑。",
    rec: "误报关闭,加入复盘样本以校准速度基线。",
  },
  "PM-2026-020": {
    factors: [{ emoji: "🕸", title: "确认洗钱归集网络", desc: "并入案件深查", tone: "red" }],
    profile: { country: "—(链上地址)", kyc: "不适用", registered: "已结案 · 转案件", history: "不可追溯 · 已上报损失", tags: ["扇入归集", "洗钱网络", "已列黑名单"] },
    txList: [{ t: "近 14 天", party: "多商户 → 0x71Be", amount: "CAD 124,000", note: "31 笔归集" }],
    gap: "扇入归集,事中缺跨主体图关系。已回填规则。",
    rec: "已并入案件 · 已上报损失 · 已回填规则。",
  },
};
export const detailOf = (id: string): Detail | undefined => DETAIL[id];

// 回溯批次历史(每日跑批)
export interface Batch { id: string; window: string; done: string; scanned: string; hits: number; confirmed: number; fp: number; status: "已完成" | "扫描中" }
export const BATCHES: Batch[] = [
  { id: "#20260619-02", window: "06-18 00:00 ～ 24:00", done: "06-19 02:14", scanned: "1.27M", hits: 6, confirmed: 1, fp: 0, status: "已完成" },
  { id: "#20260618-02", window: "06-17 00:00 ～ 24:00", done: "06-18 02:11", scanned: "1.19M", hits: 5, confirmed: 2, fp: 1, status: "已完成" },
  { id: "#20260617-02", window: "06-16 00:00 ～ 24:00", done: "06-17 02:09", scanned: "1.24M", hits: 7, confirmed: 1, fp: 2, status: "已完成" },
  { id: "#20260616-02", window: "06-15 00:00 ～ 24:00", done: "06-16 02:16", scanned: "1.08M", hits: 4, confirmed: 0, fp: 1, status: "已完成" },
  { id: "#20260615-02", window: "06-14 00:00 ～ 24:00", done: "06-15 02:07", scanned: "1.31M", hits: 9, confirmed: 3, fp: 2, status: "已完成" },
  { id: "#20260614-02", window: "06-13 00:00 ～ 24:00", done: "06-14 02:12", scanned: "1.15M", hits: 5, confirmed: 1, fp: 1, status: "已完成" },
];
