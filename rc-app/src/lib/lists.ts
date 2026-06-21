// 名单管理 —— 实时筛查名单库(制裁 / 内部黑名单 / 关注 / 白名单)。名单是事中筛查的数据底座:
// 制裁=法定硬拦截,黑名单=确认主体拦截,关注=升级监控不拦截,白名单=放行豁免。
// 名单项有生命周期:待复核 → 复核生效 → 生效中 →(到期 / 暂停 / 移除)。来源可链到案件 / 团伙 / 事后命中。
// 状态 / 经手 / 事件存 store.ts 的 listStore。
import { ShieldBan, Ban, Eye, ShieldCheck } from "lucide-react";
import type { Tone, Person } from "./data";

// ── 名单类别 ──
export type ListCat = "sanctions" | "block" | "watch" | "allow";
export const LCAT: Record<ListCat, { label: string; full: string; tone: Tone; icon: typeof ShieldBan }> = {
  sanctions: { label: "制裁名单", full: "OFAC SDN / UN / 加拿大 SEMA · 法定硬拦截", tone: "red", icon: ShieldBan },
  block: { label: "内部黑名单", full: "已确认欺诈 / 洗钱主体及地址 · 直接拦截", tone: "violet", icon: Ban },
  watch: { label: "关注名单", full: "升级监控 · 不直接拦截", tone: "amber", icon: Eye },
  allow: { label: "白名单", full: "已核验 / 豁免 · 跳过指定规则", tone: "green", icon: ShieldCheck },
};
export const LCATS: ListCat[] = ["sanctions", "block", "watch", "allow"];

// ── 状态机 ──
export type LStatus = "pending" | "active" | "paused" | "expired" | "removed";
export const LSTATE: Record<LStatus, { label: string; tone: Tone; active: boolean }> = {
  pending: { label: "待复核", tone: "amber", active: true },
  active: { label: "生效中", tone: "green", active: true },
  paused: { label: "已暂停", tone: "grey", active: false },
  expired: { label: "已过期", tone: "grey", active: false },
  removed: { label: "已移除", tone: "grey", active: false },
};

// ── 主体类型 → tone ──
export type EntryType = "商户" | "个人" | "链上地址" | "钱包" | "IP" | "设备";
export const LENTRY_TYPE_TONE: Record<EntryType, Tone> = {
  商户: "blue", 个人: "amber", 链上地址: "violet", 钱包: "violet", IP: "grey", 设备: "grey",
};

// ── 状态门控动作 ──
export interface LAction { k: string; label: string; to: LStatus; icon: typeof Ban; tip: string; tone?: Tone }
export const LFLOW: Record<LStatus, LAction[]> = {
  pending: [
    { k: "approve", label: "复核生效", to: "active", icon: ShieldCheck, tip: "复核通过 · 名单项即时纳入事中筛查", tone: "green" },
    { k: "reject", label: "退回 / 驳回", to: "removed", icon: Ban, tip: "证据不足 · 退回不予列入", tone: "grey" },
  ],
  active: [
    { k: "pause", label: "暂停", to: "paused", icon: Eye, tip: "暂停筛查 · 临时不参与拦截 / 监控", tone: "amber" },
    { k: "remove", label: "移除", to: "removed", icon: Ban, tip: "移除名单项 · 事中不再据此处置", tone: "red" },
    { k: "renew", label: "续期", to: "active", icon: ShieldCheck, tip: "临近到期 · 复核后续期延长有效期", tone: "blue" },
    { k: "escalate", label: "升级为制裁", to: "active", icon: ShieldBan, tip: "升级为制裁 / 硬拦截类别(记入审计)", tone: "violet" },
  ],
  paused: [
    { k: "resume", label: "恢复生效", to: "active", icon: ShieldCheck, tip: "恢复筛查 · 重新参与事中处置", tone: "green" },
    { k: "remove", label: "移除", to: "removed", icon: Ban, tip: "移除名单项", tone: "red" },
  ],
  expired: [
    { k: "renew", label: "续期", to: "active", icon: ShieldCheck, tip: "复核后续期 · 重新生效", tone: "green" },
    { k: "remove", label: "移除", to: "removed", icon: Ban, tip: "确认失效 · 移除名单项", tone: "grey" },
  ],
  removed: [],
};

// ── 名单项 ──
export type ListSource = "制裁筛查" | "案件" | "团伙" | "事后监控" | "手动";
export interface ListEntry {
  id: string; value: string; entryType: EntryType; cat: ListCat; risk: string;
  source: ListSource; srcId?: string; to?: string;
  addedBy: Person; addedAt: string; reason: string;
  hits30: number; scope: string; expiry?: string; status: LStatus;
}

const EZ: Person = { i: "EZ", n: "Emma Zhang", c: "var(--success)" };
const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const JL: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const DW: Person = { i: "DW", n: "David Wu", c: "var(--violet)" };
const ML: Person = { i: "ML", n: "Mike Lin", c: "var(--success)" };

// ── 名单库 seed ──
export const LISTS: ListEntry[] = [
  // 制裁名单 sanctions(法定 · 出生即生效)
  { id: "LE-2026-0142", value: "0x7F4a…9c21", entryType: "链上地址", cat: "sanctions", risk: "制裁地址", source: "制裁筛查", srcId: "OFAC-SDN", addedBy: EZ, addedAt: "2026-02-20", reason: "OFAC SDN 制裁名单直接命中,法定禁止交易。", hits30: 3, scope: "全业务线", expiry: "长期有效", status: "active" },
  { id: "LE-2026-0143", value: "OffshoreFX Ltd.", entryType: "商户", cat: "sanctions", risk: "制裁规避", source: "案件", srcId: "CASE-20260318-018", to: "/case?id=CASE-20260318-018", addedBy: EZ, addedAt: "2026-03-18", reason: "案件确认为制裁规避主体,经 MLRO 批准列入制裁硬拦截。", hits30: 5, scope: "全业务线", expiry: "长期有效", status: "active" },
  { id: "LE-2026-0151", value: "0x5078…Ec8c", entryType: "链上地址", cat: "sanctions", risk: "混币器关联", source: "制裁筛查", srcId: "OFAC-SDN", addedBy: SC, addedAt: "2026-05-03", reason: "Tornado Cash 关联地址,经混币器溯源命中 OFAC 制裁实体。", hits30: 12, scope: "充值 / 链上交易", expiry: "长期有效", status: "active" },
  // 内部黑名单 block(确认主体 / 地址 · 拦截)
  { id: "LE-2026-0160", value: "众包养卡团伙成员 #07", entryType: "个人", cat: "block", risk: "确认洗钱", source: "团伙", srcId: "RING-2026-031", to: "/ring?id=RING-2026-031", addedBy: DW, addedAt: "2026-05-12", reason: "团伙研判确认的养卡团伙核心成员,涉结构化拆分洗钱。", hits30: 8, scope: "全业务线", expiry: "长期有效", status: "active" },
  { id: "LE-2026-0162", value: "bc1q…7h2k", entryType: "钱包", cat: "block", risk: "确认欺诈", source: "案件", srcId: "CASE-20260318-018", to: "/case?id=CASE-20260318-018", addedBy: DW, addedAt: "2026-04-08", reason: "案件确认的欺诈受益钱包,资金归集出账地址。", hits30: 4, scope: "提现 / 链上交易", expiry: "长期有效", status: "active" },
  { id: "LE-2026-0170", value: "0x9a1c…44Bd", entryType: "链上地址", cat: "block", risk: "欺诈", source: "事后监控", srcId: "PM-2026-020", to: "/finding?id=PM-2026-020", addedBy: ML, addedAt: "2026-06-15", reason: "事后监控命中扇入归集 typology,确认为多账户归集中心地址。", hits30: 6, scope: "全业务线", expiry: "长期有效", status: "pending" },
  // 关注名单 watch(升级监控 · 不拦截 · 有复核日)
  { id: "LE-2026-0181", value: "发送方群组 #A7", entryType: "个人", cat: "watch", risk: "结构化拆分嫌疑", source: "案件", srcId: "CASE-20260318-018", to: "/case?id=CASE-20260318-018", addedBy: JL, addedAt: "2026-03-13", reason: "高频拆分入金关联群组,纳入升级监控待进一步研判。", hits30: 19, scope: "充值", expiry: "2026-09-13", status: "active" },
  { id: "LE-2026-0185", value: "Eastwind Exchange", entryType: "商户", cat: "watch", risk: "观察", source: "事后监控", srcId: "PM-2026-020", to: "/finding?id=PM-2026-020", addedBy: ML, addedAt: "2026-06-01", reason: "速度偏离 typology 命中,纳入加强监控观察 90 天。", hits30: 14, scope: "全业务线", expiry: "2026-08-30", status: "active" },
  { id: "LE-2026-0188", value: "203.0.113.0/24", entryType: "IP", cat: "watch", risk: "异常登录", source: "手动", addedBy: JL, addedAt: "2026-05-20", reason: "高风险辖区 IP 段,多账户共用登录,纳入关注。", hits30: 22, scope: "登录 / 充值", expiry: "2026-08-20", status: "paused" },
  { id: "LE-2026-0190", value: "DEV-8841ac2f", entryType: "设备", cat: "watch", risk: "多账户共用", source: "团伙", srcId: "RING-2026-031", to: "/ring?id=RING-2026-031", addedBy: DW, addedAt: "2026-04-22", reason: "养卡团伙共用设备指纹,纳入关注名单。", hits30: 11, scope: "全业务线", expiry: "2026-05-22", status: "expired" },
  // 白名单 allow(已核验 / 豁免 · 放行)
  { id: "LE-2026-0201", value: "0x91Ad…77F2", entryType: "钱包", cat: "allow", risk: "可信托管", source: "手动", addedBy: SC, addedAt: "2026-02-10", reason: "已核验商户托管钱包,跳过链上溯源加分规则减少误报。", hits30: 41, scope: "充值 / 提现", expiry: "长期有效", status: "active" },
  { id: "LE-2026-0205", value: "NovaPay Technologies Ltd.", entryType: "商户", cat: "allow", risk: "已核验主体", source: "手动", addedBy: JL, addedAt: "2026-01-15", reason: "KYB 完整且历史良好的低风险商户,豁免新商户首充规则。", hits30: 28, scope: "全业务线", expiry: "2026-12-31", status: "active" },
];

export const entryOf = (id?: string) => LISTS.find((e) => e.id === id);

// ── 详情:命中历史 + 关联告警 / 案件(hero 条目) ──
export interface HitRow { date: string; txn: string; action: string; amount: string }
export interface MatchRow { kind: "告警" | "案件" | "团伙"; id: string; label: string; to: string }
export interface ListDetailData { hits: HitRow[]; matched: MatchRow[] }

export const LDETAIL: Record<string, ListDetailData> = {
  "LE-2026-0142": {
    hits: [
      { date: "2026-06-18 06:20", txn: "WD-20260313-021", action: "直接拦截 · 冻结", amount: "CAD 11,900.00" },
      { date: "2026-05-12 14:02", txn: "WD-20260512-088", action: "直接拦截 · 冻结", amount: "CAD 6,400.00" },
      { date: "2026-04-09 09:31", txn: "WD-20260409-012", action: "直接拦截 · 冻结", amount: "CAD 3,200.00" },
    ],
    matched: [
      { kind: "告警", id: "ALT-50218", label: "制裁地址命中", to: "/alerts" },
      { kind: "案件", id: "CASE-20260318-018", label: "OffshoreFX 制裁规避", to: "/case?id=CASE-20260318-018" },
    ],
  },
  "LE-2026-0143": {
    hits: [
      { date: "2026-06-15 11:08", txn: "WD-20260615-031", action: "直接拦截 · 冻结", amount: "CAD 18,200.00" },
      { date: "2026-05-30 16:44", txn: "DEP-20260530-204", action: "直接拦截", amount: "CAD 9,000.00" },
    ],
    matched: [
      { kind: "案件", id: "CASE-20260318-018", label: "OffshoreFX 制裁规避", to: "/case?id=CASE-20260318-018" },
      { kind: "告警", id: "ALT-50218", label: "制裁地址命中", to: "/alerts" },
    ],
  },
  "LE-2026-0160": {
    hits: [
      { date: "2026-06-12 08:12", txn: "DEP-20260313-204", action: "评分 +60 · 转研判", amount: "CAD 3,150.00" },
      { date: "2026-06-05 19:50", txn: "DEP-20260605-077", action: "评分 +60 · 转研判", amount: "CAD 2,980.00" },
    ],
    matched: [
      { kind: "团伙", id: "RING-2026-031", label: "众包养卡团伙", to: "/ring?id=RING-2026-031" },
      { kind: "告警", id: "ALT-50224", label: "高频拆分入金", to: "/alerts" },
    ],
  },
  "LE-2026-0181": {
    hits: [
      { date: "2026-06-13 08:12", txn: "DEP-20260313-204", action: "加强监控 · 标记", amount: "CAD 3,150.00" },
      { date: "2026-06-02 10:31", txn: "DEP-20260602-119", action: "加强监控 · 标记", amount: "CAD 2,800.00" },
    ],
    matched: [
      { kind: "案件", id: "CASE-20260318-018", label: "结构化拆分研判", to: "/case?id=CASE-20260318-018" },
    ],
  },
};

// 无显式详情时合成确定性的命中历史 + 关联
export function detailOf(entry: ListEntry): ListDetailData {
  const hero = LDETAIL[entry.id];
  if (hero) return hero;
  const seed = [...entry.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = Math.min(entry.hits30, 5);
  const act = entry.cat === "sanctions" ? "直接拦截 · 冻结" : entry.cat === "block" ? "直接拦截" : entry.cat === "watch" ? "加强监控 · 标记" : "放行 · 跳过规则";
  const hits: HitRow[] = entry.hits30
    ? Array.from({ length: Math.max(1, n) }, (_, i) => ({
        date: `2026-06-${String(18 - i * 3).padStart(2, "0")} ${String(8 + ((seed + i) % 10)).padStart(2, "0")}:${String((seed + i * 7) % 60).padStart(2, "0")}`,
        txn: `${entry.entryType === "钱包" || entry.entryType === "链上地址" ? "WD" : "DEP"}-20260${6 - (i % 2)}${String(10 + i).padStart(2, "0")}-${String(100 + ((seed + i) % 99)).padStart(3, "0")}`,
        action: act,
        amount: `CAD ${(1500 + ((seed + i * 311) % 18) * 500).toLocaleString()}.00`,
      }))
    : [];
  const matched: MatchRow[] = entry.to && entry.srcId
    ? [{ kind: entry.source === "团伙" ? "团伙" : entry.source === "事后监控" ? "案件" : "案件", id: entry.srcId, label: entry.risk, to: entry.to }]
    : [];
  return { hits, matched };
}
