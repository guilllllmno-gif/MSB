// 审计日志 · 全量留痕 —— 把各模块「谁在何时对哪条记录做了什么、为什么」拍平成统一、可筛、可追溯的合规轨迹。
// 数据 = 静态种子(代表性历史轨迹,刷新稳定)+ 本会话实时事件(各 store allEvents() 聚合,与各列表页同源)。
// 配色克制:模块=属性中性灰;人物头像保留身份色;高敏动作仅一个中性标记。无 emoji,用 lucide。
import { ListChecks, FolderOpen, FileText, Shield, Network, History, Bell, SlidersHorizontal, Settings } from "lucide-react";
import type { Person } from "./data";
import { ruleStore, caseStore, reportStore, listStore, ringStore, findingStore, alertStore } from "./store";

export type AuditModule = "规则" | "案件" | "报送" | "名单" | "团伙" | "事后" | "告警" | "策略" | "系统";
// 动作类别(供筛选 + 合规视角分桶)
export type AuditCat = "审批" | "处置" | "创建变更" | "状态流转" | "访问导出";
export const AUDIT_CATS: AuditCat[] = ["审批", "处置", "创建变更", "状态流转", "访问导出"];

export const AUDIT_MOD: Record<AuditModule, { icon: typeof ListChecks; link?: (id: string) => string }> = {
  规则: { icon: ListChecks, link: (id) => `/rule?id=${id}` },
  案件: { icon: FolderOpen, link: (id) => `/case?id=${id}` },
  报送: { icon: FileText, link: (id) => `/report?id=${id}` },
  名单: { icon: Shield, link: (id) => `/list-entry?id=${id}` },
  团伙: { icon: Network, link: (id) => `/ring?id=${id}` },
  事后: { icon: History, link: (id) => `/finding?id=${id}` },
  告警: { icon: Bell, link: (id) => `/alert?id=${id}` },
  策略: { icon: SlidersHorizontal, link: () => `/strategy` },
  系统: { icon: Settings },
};

// 高敏动作 —— 合规重点关注(冻结资金 / 规则上线 / 报告签发报送 / 作废 / 制裁列名单 / 策略变更),列表打中性标记
const HI_KEYS = ["冻结", "上线", "签发", "报送", "作废", "制裁", "停用", "基线", "并案", "升级 MLRO"];
export const isHiSensitive = (action: string) => HI_KEYS.some((k) => action.includes(k));

export interface AuditEntry {
  date: string; time: string; live?: boolean;
  actor: Person; role: string;
  module: AuditModule; cat: AuditCat;
  action: string; target: string; targetId?: string; to?: string; reason?: string;
}

// 角色人物(与全站一致)
const JL: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };       // 一线分析师 L1
const EZ: Person = { i: "EZ", n: "Emma Zhang", c: "var(--violet)" };     // 风控总管 · 兼 MLRO
const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };     // L2 复核
const RH: Person = { i: "RH", n: "Raj Hota", c: "#0ea5e9" };            // 风控建模
const SYS: Person = { i: "系", n: "系统自动", c: "var(--chip-fg)" };

export const AUDIT_ACTORS: Person[] = [JL, EZ, SC, RH, SYS];

// 按动作文本推断类别(供实时事件归类)
export function catOf(text: string): AuditCat {
  if (/审批|通过|上线|退回|驳回|签发/.test(text)) return "审批";
  if (/处置|冻结|结案|误报|放行|拒绝|确认|追溯|报送|并案/.test(text)) return "处置";
  if (/新建|创建|复制|变更|编辑|提案|回填|新增/.test(text)) return "创建变更";
  if (/导出|查看|访问|下载/.test(text)) return "访问导出";
  return "状态流转";
}

// 实时事件的模块默认操作人(治理类归总管/MLRO,运营类归 L1)
const LIVE_ACTOR: Record<AuditModule, { p: Person; role: string }> = {
  规则: { p: EZ, role: "风控总管" }, 报送: { p: EZ, role: "MLRO" }, 名单: { p: EZ, role: "风控总管" }, 策略: { p: EZ, role: "风控总管" },
  案件: { p: JL, role: "一线分析师" }, 团伙: { p: JL, role: "一线分析师" }, 事后: { p: JL, role: "一线分析师" }, 告警: { p: JL, role: "一线分析师" },
  系统: { p: SYS, role: "系统" },
};

// ── 本会话实时事件聚合 —— 各 store allEvents() 拍平为审计条目(与各列表页同源,刷新重置)──
export function liveAudit(): AuditEntry[] {
  const out: AuditEntry[] = [];
  const add = (module: AuditModule, ev: { id: string; t: string; text: string; reason?: string }) => {
    const la = LIVE_ACTOR[module];
    out.push({ date: "今日", time: ev.t, live: true, actor: la.p, role: la.role, module, cat: catOf(ev.text), action: ev.text, target: ev.id, targetId: ev.id, to: AUDIT_MOD[module].link?.(ev.id), reason: ev.reason });
  };
  ruleStore.allEvents().forEach((e) => add("规则", e));
  caseStore.allEvents().forEach((e) => add("案件", e));
  reportStore.allEvents().forEach((e) => add("报送", e));
  listStore.allEvents().forEach((e) => add("名单", e));
  ringStore.allEvents().forEach((e) => add("团伙", e));
  findingStore.allEvents().forEach((e) => add("事后", e));
  alertStore.allEvents().forEach((e) => add("告警", e));
  // 本会话内,后发生的排前(allEvents 按插入序,翻转即最新在前)
  return out.reverse();
}

// ── 静态种子 · 代表性历史轨迹(最新在前;刷新稳定)──
const E = (date: string, time: string, actor: Person, role: string, module: AuditModule, action: string, target: string, targetId: string | undefined, reason?: string): AuditEntry =>
  ({ date, time, actor, role, module, cat: catOf(action), action, target, targetId, to: targetId ? AUDIT_MOD[module].link?.(targetId) : undefined, reason });

export const AUDIT_SEED: AuditEntry[] = [
  E("2026-06-30", "09:41", EZ, "风控总管", "策略", "调整处置基线为「标准 · 平衡」", "全局策略 · 决策基线", undefined, "季度校准 · 维持 ≥80 拦截 / ≥60 转研判"),
  E("2026-06-30", "09:12", EZ, "MLRO", "报送", "MLRO 签发并报送 STR 至 FINTRAC", "STR-CASE-20260318-001 · NovaPay", "STR-CASE-20260318-001", "可疑理由复核通过 · 必填字段齐备"),
  E("2026-06-29", "17:58", EZ, "风控总管", "规则", "审批通过 · 变更上线(v4)", "R-AGG-009 速度 / 峰值偏离", "R-AGG-009", "回测误报 7% 达标 · 灰度 50% 起量"),
  E("2026-06-29", "16:30", JL, "一线分析师", "案件", "升级至 MLRO 评估", "CASE-20260318-001 · NovaPay", "CASE-20260318-001", "混币器接触 + 过水 + 同类 71% 上报"),
  E("2026-06-29", "16:04", JL, "一线分析师", "事后", "确认可疑 · 转案件", "PM-2026-030 · 多账户扇入", "PM-2026-030", "6 商户扇入同一地址 · 已并入案件"),
  E("2026-06-29", "15:22", SC, "L2 复核", "告警", "升级 L2 · 转研判", "ALT-50231 · 混币器关联", "ALT-50231", "资金 1 跳触及 Tornado Cash"),
  E("2026-06-29", "14:47", SYS, "系统", "报送", "按客观阈值自动生成 LVCTR", "LVCTR-20260619-0143 · 12 笔批次", "LVCTR-20260619-0143", "日累计 ≥ CAD 10,000 · 无需可疑判定"),
  E("2026-06-29", "11:18", EZ, "风控总管", "名单", "复核生效 · 制裁地址入库", "LE-2026-0142 · OFAC 0x7F4a…9c21", "LE-2026-0142", "OFAC SDN 命中 · 长期有效"),
  E("2026-06-29", "10:05", JL, "一线分析师", "团伙", "认领 · 进入调查中", "RING-2026-014 · 混币器归集网络", "RING-2026-014", undefined),
  E("2026-06-28", "18:20", RH, "风控建模", "规则", "提交拟议变更 · 待审批", "R-SCR-001 KYW 评分超阈值", "R-SCR-001", "阈值 70→65 提升召回 · 待总管审批"),
  E("2026-06-28", "16:42", EZ, "风控总管", "规则", "退回拟议变更 · 维持现版", "R-BHV-003 新商户首充", "R-BHV-003", "误报上升风险未评估 · 需补回测样本"),
  E("2026-06-28", "15:10", JL, "一线分析师", "告警", "事中放行结案", "ALT-50220 · 新商户大额首充", "ALT-50220", "KYB 已补全 · 风险可接受"),
  E("2026-06-28", "14:33", SYS, "系统", "事后", "事后批量扫描完成 · 命中 8 项", "批次 #20260628-01", undefined, "结构化拆分 3 · 扇入 2 · 速度 3"),
  E("2026-06-28", "11:50", SC, "L2 复核", "案件", "请求补充材料(KYT 报告)", "CASE-20260317-009 · BlockTrade", "CASE-20260317-009", "需链上 KYT 佐证资金来源"),
  E("2026-06-27", "17:05", EZ, "MLRO", "报送", "上报 TPR · 即时报送", "TPR-20260313-0021 · OFAC 命中", "TPR-20260313-0021", "制裁实体命中 · 立即冻结 + 上报"),
  E("2026-06-27", "15:38", JL, "一线分析师", "事后", "误报关闭", "PM-2026-021 · 速度上升", "PM-2026-021", "促销活动致笔频上升 · 非可疑"),
  E("2026-06-27", "14:12", EZ, "风控总管", "名单", "升级为制裁名单", "LE-2026-0151 · 内部黑名单地址", "LE-2026-0151", "经案件确认 · 由黑名单升制裁"),
  E("2026-06-27", "10:26", RH, "风控建模", "规则", "新建规则 · 进入回测", "R-AGG-010 对手集中度", "R-AGG-010", "影子模式 · 到期 2026-08-31"),
  E("2026-06-26", "16:55", JL, "一线分析师", "事后", "确认可疑 · 追溯处置 · 规则回填", "PM-2026-022 · 拆分入金", "PM-2026-022", "部分可追溯 · 已请求下游冻结 · 回填累计规则"),
  E("2026-06-26", "15:20", EZ, "MLRO", "报送", "复核退回起草人 · 需补正", "STR-CASE-20260317-009", undefined, "可疑理由叙述不充分 · 补 KYT 证据"),
  E("2026-06-26", "11:40", JL, "一线分析师", "团伙", "团伙转案件 · 涉案主体并入", "RING-2026-031 · 制裁规避中转", "RING-2026-031", "触及 OFAC 中转钱包 · 升级深查"),
  E("2026-06-26", "09:33", SYS, "系统", "系统", "登录 · 多因子认证通过", "风控控制台", undefined, "James Liu · IP 198.51.100.23"),
  E("2026-06-25", "17:48", EZ, "风控总管", "策略", "开启「评分服务熔断 · 全局保守模式」", "全局策略 · 系统降级兜底", undefined, "评分服务演练 · 双人复核留痕"),
  E("2026-06-25", "16:10", SC, "L2 复核", "案件", "导出案件卷宗 PDF", "CASE-20260318-001 · NovaPay", "CASE-20260318-001", "MLRO 评估材料 · 含 KYT / OFAC 附件"),
];

// 全量(实时在前 + 种子)
export const allAudit = (): AuditEntry[] => [...liveAudit(), ...AUDIT_SEED];
