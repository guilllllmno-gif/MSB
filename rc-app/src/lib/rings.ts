// ── 关联团伙识别 dataset ──
// Model: shared attributes become weighted edges between entities; accumulated
// strength → confidence. Weights reflect 区分度 (discriminative power):
// funds/address (hard to fake) ≫ device > ip (easily coincidental).
import type { Tone, Person } from "./data";

export type RingDim = "funds" | "address" | "device" | "ip";

export const DIM_META: Record<RingDim, { label: string; short: string; color: string; weight: number }> = {
  funds: { label: "资金路径", short: "资金", color: "var(--danger)", weight: 40 },
  address: { label: "链上地址", short: "地址", color: "var(--violet)", weight: 30 },
  device: { label: "设备指纹", short: "设备", color: "var(--warning)", weight: 20 },
  ip: { label: "IP / 网络", short: "IP", color: "var(--brand)", weight: 10 },
};
export const DIM_ORDER: RingDim[] = ["funds", "address", "device", "ip"];

// ── ring lifecycle states ──
export type RingStateKey = "pending" | "watching" | "investigating" | "cased" | "listed" | "escalated" | "closed_fp";
export interface RingStateDef { label: string; tone: Tone; bucket: string; active: boolean }
export const RING_STATES: Record<RingStateKey, RingStateDef> = {
  pending: { label: "待研判", tone: "blue", bucket: "pending", active: true },
  watching: { label: "观察中", tone: "grey", bucket: "watching", active: true },
  investigating: { label: "调查中", tone: "amber", bucket: "investigating", active: true },
  cased: { label: "已聚案", tone: "violet", bucket: "handled", active: false },
  listed: { label: "已列名单", tone: "green", bucket: "handled", active: false },
  escalated: { label: "已升级 MLRO", tone: "red", bucket: "handled", active: false },
  closed_fp: { label: "已关闭 · 误报", tone: "grey", bucket: "closed", active: false },
};
export const RING_TILES: { f: string; label: string }[] = [
  { f: "all", label: "全部团伙" },
  { f: "pending", label: "待研判" },
  { f: "watching", label: "观察中" },
  { f: "investigating", label: "调查中" },
  { f: "handled", label: "已处置" },
  { f: "closed", label: "已关闭" },
];
export const matchRingTile = (f: string, state: RingStateKey) => (f === "all" ? true : RING_STATES[state].bucket === f);
// 研判处置 action key → resulting state
export const DISP_STATE: Record<string, RingStateKey> = { case: "cased", watch: "listed", escalate: "escalated", fp: "closed_fp" };

export interface RingMember { id: string; name: string; sub: string; kind: "商户" | "地址" | "群组"; i: string; c: string; alerts: number; role: string }
export interface RingEdge { a: number; b: number; dims: RingDim[]; strength: number; note: string } // a,b = member index
export interface SharedDim { dim: RingDim; count: number; contrib: number } // contrib = points toward confidence

export interface Ring {
  id: string; name: string; typology: string; typologyEn: string;
  confidence: number; risk: Tone;
  shared: SharedDim[];
  members: RingMember[];
  edges: RingEdge[];
  amount: string; alertCount: number; span: string;
  state: RingStateKey; caseRef?: string;
  owner?: Person | null; sla?: { text: string; pct: number; tone: Tone };
  recommendation: string;
  hubNote?: string; // excluded super-node (avoids cluster collapse)
}

export const confTone = (c: number): Tone => (c >= 80 ? "red" : c >= 60 ? "amber" : "grey");
export const confLabel = (c: number): string => (c >= 80 ? "高置信" : c >= 60 ? "中置信" : "弱关联");

export const rings: Ring[] = [
  {
    id: "RING-2026-014", name: "混币器归集网络", typology: "分层洗钱", typologyEn: "Layering",
    confidence: 92, risk: "red",
    shared: [
      { dim: "funds", count: 6, contrib: 40 },
      { dim: "address", count: 4, contrib: 30 },
      { dim: "device", count: 2, contrib: 14 },
      { dim: "ip", count: 3, contrib: 8 },
    ],
    members: [
      { id: "M1", name: "NovaPay Technologies", sub: "商户 · 美国", kind: "商户", i: "NP", c: "var(--brand)", alerts: 3, role: "入金商户" },
      { id: "M2", name: "0x5078…Ec8c", sub: "发送方地址", kind: "地址", i: "0x", c: "var(--violet)", alerts: 2, role: "归集源" },
      { id: "M3", name: "中转钱包 ×3", sub: "资金在 3 个钱包间短暂过账后归集，用于打散、切断链上溯源", kind: "群组", i: "⛓", c: "var(--warning)", alerts: 1, role: "资金中转 · 分层" },
      { id: "M4", name: "BlockTrade Corp.", sub: "商户 · 美国", kind: "商户", i: "BT", c: "var(--success)", alerts: 1, role: "出金商户" },
    ],
    edges: [
      { a: 1, b: 2, dims: ["funds", "address"], strength: 70, note: "资金 2 跳归集 + 复用收款地址" },
      { a: 2, b: 0, dims: ["funds", "address"], strength: 65, note: "归集后注入 NovaPay 托管钱包" },
      { a: 0, b: 3, dims: ["device", "ip"], strength: 32, note: "共享 2 个设备指纹 + 出口 IP" },
      { a: 1, b: 3, dims: ["funds"], strength: 28, note: "同一资金来源" },
    ],
    amount: "CAD 38,400", alertCount: 5, span: "近 14 天",
    state: "cased", caseRef: "CASE-2026-014", owner: { i: "DW", n: "David Wu", c: "var(--violet)" },
    recommendation: "资金链路触及 OFAC 制裁混币器，4 主体经资金+地址强关联。建议升级 MLRO，起草 STR 上报 FINTRAC，对手地址簇批量列入黑名单。",
    hubNote: "已剔除超级节点：Tornado Cash 合约地址（网络内 7+ 商户共用，不计入聚类）",
  },
  {
    id: "RING-2026-021", name: "拆分入金群组 #A7", typology: "结构化拆分", typologyEn: "Structuring",
    confidence: 87, risk: "red",
    shared: [
      { dim: "funds", count: 7, contrib: 36 },
      { dim: "address", count: 3, contrib: 24 },
      { dim: "device", count: 4, contrib: 18 },
      { dim: "ip", count: 5, contrib: 9 },
    ],
    members: [
      { id: "M1", name: "Eastwind Exchange", sub: "商户 · 新加坡", kind: "商户", i: "EE", c: "var(--brand)", alerts: 4, role: "收款商户" },
      { id: "M2", name: "发送方群组 #A7", sub: "关注名单 · 5 地址", kind: "群组", i: "A7", c: "var(--warning)", alerts: 2, role: "拆分源" },
      { id: "M3", name: "TQ5n…9wEx", sub: "发送方地址", kind: "地址", i: "TQ", c: "var(--violet)", alerts: 1, role: "拆分节点" },
    ],
    edges: [
      { a: 0, b: 1, dims: ["funds", "device", "ip"], strength: 62, note: "24h 内 7 笔相近金额 + 共享设备/IP" },
      { a: 1, b: 2, dims: ["address", "funds"], strength: 48, note: "同属群组 #A7，地址复用" },
      { a: 0, b: 2, dims: ["device"], strength: 22, note: "共享 1 设备指纹" },
    ],
    amount: "CAD 42,000", alertCount: 7, span: "近 7 天",
    state: "investigating", owner: { i: "SC", n: "Sarah Chen", c: "var(--brand)" }, sla: { text: "剩 16h", pct: 70, tone: "amber" },
    recommendation: "四维全命中（地址+设备+IP+资金），高置信结构化拆分。建议对群组 #A7 全部地址列入加强监控名单，对 Eastwind 入金加严阈值并人工复核。",
  },
  {
    id: "RING-2026-033", name: "快进快出过账链", typology: "资金过账", typologyEn: "Pass-through",
    confidence: 66, risk: "amber",
    shared: [
      { dim: "funds", count: 4, contrib: 40 },
      { dim: "device", count: 1, contrib: 16 },
      { dim: "ip", count: 6, contrib: 10 },
    ],
    members: [
      { id: "M1", name: "BlockTrade Corp.", sub: "商户 · 美国", kind: "商户", i: "BT", c: "var(--success)", alerts: 2, role: "过账商户" },
      { id: "M2", name: "TQ8m…2kFa", sub: "收款方地址", kind: "地址", i: "TQ", c: "var(--violet)", alerts: 1, role: "中转钱包" },
      { id: "M3", name: "bc1q…7h2k", sub: "下游地址", kind: "地址", i: "bc", c: "var(--brand)", alerts: 1, role: "下游" },
    ],
    edges: [
      { a: 0, b: 1, dims: ["funds", "ip"], strength: 44, note: "入金后 1h 内转出 86% + 共享出口 IP" },
      { a: 1, b: 2, dims: ["funds"], strength: 30, note: "资金继续下游过账" },
    ],
    amount: "CAD 19,500", alertCount: 3, span: "近 10 天",
    state: "pending", sla: { text: "剩 1d 04h", pct: 38, tone: "blue" },
    recommendation: "资金过账特征明显，但设备维度仅 1 项、关联偏中等。建议要求商户说明资金用途，补充材料后再判定是否聚案。",
  },
  {
    id: "RING-2026-040", name: "新商户首充簇", typology: "疑似养号", typologyEn: "Account farming",
    confidence: 26, risk: "grey",
    shared: [
      { dim: "device", count: 2, contrib: 16 },
      { dim: "ip", count: 3, contrib: 10 },
    ],
    members: [
      { id: "M1", name: "Acme Pay Ltd.", sub: "商户 · 加拿大", kind: "商户", i: "AP", c: "var(--brand)", alerts: 1, role: "新商户" },
      { id: "M2", name: "新注册商户 ×2", sub: "KYB 审核中", kind: "群组", i: "+2", c: "var(--warning)", alerts: 1, role: "新商户" },
    ],
    edges: [
      { a: 0, b: 1, dims: ["ip", "device"], strength: 17, note: "仅共享出口 IP（疑似同一 NAT）+ 1 设备" },
    ],
    amount: "CAD 14,000", alertCount: 2, span: "近 5 天",
    state: "watching",
    recommendation: "仅 IP/设备弱关联，可能为共享网络环境导致的误聚。暂不处置，纳入观察名单，若后续出现资金/地址关联再升级。",
    hubNote: "提示：共享 IP 为公共出口段（高频公共节点），区分度低，已对其权重做衰减处理",
  },
  {
    id: "RING-2026-050", name: "代付资金归集网络", typology: "资金归集", typologyEn: "Funneling",
    confidence: 79, risk: "amber",
    shared: [
      { dim: "funds", count: 5, contrib: 40 },
      { dim: "address", count: 3, contrib: 30 },
      { dim: "ip", count: 4, contrib: 9 },
    ],
    members: [
      { id: "M1", name: "PayBridge Inc.", sub: "商户 · 加拿大", kind: "商户", i: "PB", c: "var(--brand)", alerts: 2, role: "代付商户" },
      { id: "M2", name: "0x4c9a…71Bd", sub: "归集地址", kind: "地址", i: "0x", c: "var(--violet)", alerts: 1, role: "归集源" },
      { id: "M3", name: "收款地址 ×4", sub: "4 个收款钱包 · 多账户代付集中归集", kind: "群组", i: "✦", c: "var(--success)", alerts: 1, role: "代付出口" },
    ],
    edges: [
      { a: 0, b: 1, dims: ["funds", "address"], strength: 60, note: "多笔代付资金集中归集 + 复用归集地址" },
      { a: 1, b: 2, dims: ["funds", "ip"], strength: 38, note: "归集后分发至 4 个收款钱包 · 共享出口 IP" },
    ],
    amount: "CAD 27,600", alertCount: 4, span: "近 12 天",
    state: "listed", owner: { i: "ML", n: "Mike Lin", c: "var(--success)" },
    recommendation: "多账户代付集中归集特征明显。成员地址已批量列入加强监控名单，后续同类代付按名单规则自动加严。",
  },
  {
    id: "RING-2026-055", name: "制裁实体关联网络", typology: "制裁规避", typologyEn: "Sanctions evasion",
    confidence: 96, risk: "red",
    shared: [
      { dim: "funds", count: 4, contrib: 40 },
      { dim: "address", count: 3, contrib: 30 },
      { dim: "device", count: 2, contrib: 16 },
      { dim: "ip", count: 2, contrib: 10 },
    ],
    members: [
      { id: "M1", name: "OffshoreFX Ltd.", sub: "商户 · 离岸", kind: "商户", i: "OF", c: "var(--brand)", alerts: 3, role: "高风险商户" },
      { id: "M2", name: "0x7F4a…9c21", sub: "OFAC SDN 制裁地址", kind: "地址", i: "0x", c: "var(--danger)", alerts: 2, role: "制裁实体" },
      { id: "M3", name: "中转钱包 ×2", sub: "资金经 2 个钱包过账以规避制裁筛查", kind: "群组", i: "⛓", c: "var(--warning)", alerts: 1, role: "资金中转 · 规避" },
    ],
    edges: [
      { a: 0, b: 1, dims: ["funds", "address"], strength: 78, note: "资金 2 跳触及 OFAC SDN 制裁地址" },
      { a: 0, b: 2, dims: ["device", "ip"], strength: 30, note: "共享 2 设备指纹 + 出口 IP" },
      { a: 1, b: 2, dims: ["funds"], strength: 28, note: "经中转钱包过账规避筛查" },
    ],
    amount: "CAD 56,000", alertCount: 6, span: "近 9 天",
    state: "escalated", owner: { i: "DW", n: "David Wu", c: "var(--violet)" },
    recommendation: "资金链直接关联 OFAC SDN 制裁地址，构成制裁规避高风险。已升级 MLRO，STR 草稿移交合规报送 FINTRAC，相关地址全部冻结。",
    hubNote: "已剔除超级节点：公共桥接合约（网络内多商户共用，不计入聚类）",
  },
  {
    id: "RING-2026-060", name: "共用设备登录簇", typology: "疑似关联", typologyEn: "Shared-device",
    confidence: 22, risk: "grey",
    shared: [
      { dim: "device", count: 1, contrib: 14 },
      { dim: "ip", count: 2, contrib: 8 },
    ],
    members: [
      { id: "M1", name: "Maple Pay Co.", sub: "商户 · 加拿大", kind: "商户", i: "MP", c: "var(--brand)", alerts: 1, role: "商户" },
      { id: "M2", name: "Northwind Ltd.", sub: "商户 · 加拿大", kind: "商户", i: "NW", c: "var(--success)", alerts: 1, role: "商户" },
    ],
    edges: [
      { a: 0, b: 1, dims: ["device", "ip"], strength: 16, note: "仅共享办公网络 IP 段 + 1 设备，疑似同园区办公" },
    ],
    amount: "CAD 9,800", alertCount: 2, span: "近 6 天",
    state: "closed_fp",
    recommendation: "仅设备/IP 弱关联，经核实两商户位于同一共享办公空间，属正常网络环境巧合。判定误聚，已关闭并将该 IP 段加入可信白名单。",
    hubNote: "提示：共享 IP 为共享办公出口段（高频公共节点），区分度低，已降权处理",
  },
];

// per-disposition form fields for the 研判处置 drawer
export interface RField { k: string; label: string; type: "select" | "multi"; required: boolean; options: string[] }
export const RING_FIELDS: Record<string, RField[]> = {
  case: [
    { k: "casetype", label: "案件类型", type: "select", required: true, options: ["可疑洗钱（分层）", "制裁规避", "结构化拆分", "资金过账", "其他"] },
    { k: "priority", label: "案件优先级", type: "select", required: true, options: ["高", "中", "低"] },
    { k: "scope", label: "调查范围", type: "multi", required: true, options: ["本团伙全部成员", "对手地址簇", "关联群组", "下游地址"] },
    { k: "investigator", label: "指派调查员", type: "select", required: false, options: ["自动分配", "David Wu (L2)", "Emma Zhang (L2)"] },
  ],
  watch: [
    { k: "listtype", label: "名单类型", type: "select", required: true, options: ["黑名单", "加强监控名单", "关注名单", "观察名单"] },
    { k: "entities", label: "列入对象", type: "multi", required: true, options: ["全部成员地址", "商户主体", "关联群组", "对手地址簇"] },
    { k: "duration", label: "有效期", type: "select", required: true, options: ["永久", "1 年", "180 天", "90 天"] },
  ],
  escalate: [
    { k: "reason", label: "升级理由", type: "select", required: true, options: ["资金链触及制裁实体", "风险超 L1 处置权限", "疑似分层洗钱", "需多笔关联调查", "其他"] },
    { k: "urgency", label: "紧急度", type: "select", required: true, options: ["常规", "加急"] },
    { k: "str", label: "STR 处理", type: "multi", required: false, options: ["起草 STR 草稿", "移交合规复核"] },
  ],
  fp: [
    { k: "fpreason", label: "误报原因", type: "select", required: true, options: ["共享公共网络 / NAT", "关联强度不足", "业务合理可解释", "规则误聚", "其他"] },
    { k: "adjust", label: "模型调整", type: "multi", required: false, options: ["降低该维度权重", "加入可信白名单", "规则调优复盘"] },
  ],
};

// ── manual ring creation ──
export const RING_TYPOLOGIES = ["分层洗钱", "结构化拆分", "资金过账", "资金归集", "制裁规避", "疑似关联"];
export const RING_CANDIDATES: RingMember[] = [
  { id: "C1", name: "NovaPay Technologies", sub: "商户 · 美国", kind: "商户", i: "NP", c: "var(--brand)", alerts: 0, role: "商户" },
  { id: "C2", name: "BlockTrade Corp.", sub: "商户 · 美国", kind: "商户", i: "BT", c: "var(--success)", alerts: 0, role: "商户" },
  { id: "C3", name: "Eastwind Exchange", sub: "商户 · 新加坡", kind: "商户", i: "EE", c: "var(--brand)", alerts: 0, role: "商户" },
  { id: "C4", name: "OffshoreFX Ltd.", sub: "商户 · 离岸", kind: "商户", i: "OF", c: "var(--danger)", alerts: 0, role: "商户" },
  { id: "C5", name: "0x5078…Ec8c", sub: "链上地址", kind: "地址", i: "0x", c: "var(--violet)", alerts: 0, role: "地址" },
  { id: "C6", name: "群组 #A7", sub: "关注名单", kind: "群组", i: "A7", c: "var(--warning)", alerts: 0, role: "群组" },
];
// build a ring from analyst input (confidence = sum of selected dimension weights)
export function buildRing(input: { name: string; typology: string; members: RingMember[]; dims: RingDim[] }, seq: number): Ring {
  const dims = DIM_ORDER.filter((d) => input.dims.includes(d));
  const confidence = Math.min(100, dims.reduce((s, d) => s + DIM_META[d].weight, 0));
  const shared: SharedDim[] = dims.map((d) => ({ dim: d, count: 1, contrib: DIM_META[d].weight }));
  const edges: RingEdge[] = input.members.slice(1).map((_, idx) => ({ a: 0, b: idx + 1, dims, strength: confidence, note: "手动建立 · 关联待核实" }));
  return {
    id: "RING-NEW-" + String(seq).padStart(3, "0"),
    name: input.name, typology: input.typology, typologyEn: "Manual",
    confidence, risk: confidence >= 80 ? "red" : confidence >= 60 ? "amber" : "grey",
    shared, members: input.members, edges,
    amount: "—", alertCount: 0, span: "手动新增",
    state: confidence >= 60 ? "pending" : "watching",
    sla: confidence >= 60 ? { text: "剩 2d", pct: 15, tone: "blue" } : undefined,
    recommendation: "分析师手动建立的关联团伙，关联依据待核实；建议补充资金 / 地址等强维度证据后再处置。",
  };
}

export const ringOf = (id?: string) => rings.find((r) => r.id === id) || rings[0];
// rings a given merchant participates in (for alert-detail integration)
export const ringsForMerchant = (merchant: string) => rings.filter((r) => r.members.some((m) => m.name.includes(merchant.split(" ")[0])));
