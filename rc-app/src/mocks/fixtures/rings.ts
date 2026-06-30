// 团伙 fixtures(≥8,ID 唯一)。状态覆盖认领状态机各档(pending 可认领 / disposed·closed·已分配 不可认领)。
// RingDetail 由 buildRingDetail 派生:成员取自 SUBJECTS(真实主体,§7.2 成员=主体非账户),图/资金路径确定性合成。
import type { Ring, RingDetail, RingMember, RingNode, RingEdge, FundFlowStage } from "@/schemas/ring";
import type { AssocEvidence, DimensionKey } from "@/schemas/common";
import { SUBJECTS } from "./subjects";

const ev = (dimension: DimensionKey, strength: "strong" | "weak", weight: number, note: string): AssocEvidence => ({ dimension, strength, weight, note });

export const RINGS: Ring[] = [
  { id: "RING-0001", name: "混币器归集网络", method: "分层洗钱", confidence: "high", confidenceScore: 92, memberCount: 2, accountCount: 5, totalAmountCad: 124000, overLctr: true, alertCount: 6, status: "investigating", assignee: { name: "Sarah Chen", initials: "SC" }, slaRemaining: "剩 18h", slaUrgent: false, submittedAt: "2026-03-16",
    hitDimensions: [ev("fund", "strong", 40, "资金 2 跳归集 + 复用收款地址"), ev("withdraw_addr", "strong", 30, "复用同一提现地址"), ev("device", "weak", 14, "共享 2 设备指纹"), ev("ip", "weak", 8, "同出口 IP")] },
  { id: "RING-0002", name: "众包养卡入金网络", method: "结构化拆分", confidence: "high", confidenceScore: 88, memberCount: 4, accountCount: 11, totalAmountCad: 38400, overLctr: true, alertCount: 9, status: "escalated", assignee: { name: "David Wu", initials: "DW" }, slaRemaining: "剩 6h", slaUrgent: true, submittedAt: "2026-03-15",
    hitDimensions: [ev("fund", "strong", 36, "拆分入金归集至同一地址"), ev("device", "strong", 18, "共享设备群 DV-7"), ev("ip", "weak", 9, "同 IP 段"), ev("withdraw_addr", "weak", 12, "出口地址复用")] },
  { id: "RING-0003", name: "跨境分层归集网络", method: "分层洗钱", confidence: "high", confidenceScore: 86, memberCount: 2, accountCount: 5, totalAmountCad: 124000, overLctr: true, alertCount: 5, status: "pending", assignee: null, slaRemaining: "剩 1d 02h", slaUrgent: false, submittedAt: "2026-03-17",
    hitDimensions: [ev("fund", "strong", 40, "归集后经中转分发出口"), ev("withdraw_addr", "weak", 20, "出口地址复用"), ev("device", "weak", 14, "设备群 DV-9")] },
  { id: "RING-0004", name: "拆分入金群组 #A7", method: "结构化拆分", confidence: "mid", confidenceScore: 66, memberCount: 3, accountCount: 7, totalAmountCad: 19800, overLctr: false, alertCount: 3, status: "watching", assignee: null, slaRemaining: null, slaUrgent: false, submittedAt: "2026-03-20",
    hitDimensions: [ev("fund", "weak", 24, "相近金额拆分入金"), ev("ip", "weak", 15, "同 IP 段登录")] },
  { id: "RING-0005", name: "快进快出过账链", method: "快速过水", confidence: "mid", confidenceScore: 71, memberCount: 3, accountCount: 6, totalAmountCad: 41200, overLctr: true, alertCount: 4, status: "pending", assignee: null, slaRemaining: "剩 20h", slaUrgent: false, submittedAt: "2026-03-19",
    hitDimensions: [ev("fund", "strong", 38, "入金后 1h 内全额转出"), ev("withdraw_addr", "weak", 18, "出口地址相近")] },
  { id: "RING-0006", name: "代付资金归集网络", method: "第三方代付", confidence: "mid", confidenceScore: 79, memberCount: 4, accountCount: 9, totalAmountCad: 56000, overLctr: true, alertCount: 5, status: "investigating", assignee: { name: "James Liu", initials: "JL" }, slaRemaining: "剩 2d", slaUrgent: false, submittedAt: "2026-03-14",
    hitDimensions: [ev("fund", "strong", 36, "多方代付归集"), ev("device", "weak", 16, "共享设备"), ev("ip", "weak", 9, "同 IP 段")] },
  { id: "RING-0007", name: "制裁实体关联网络", method: "制裁规避", confidence: "high", confidenceScore: 96, memberCount: 2, accountCount: 4, totalAmountCad: 88000, overLctr: true, alertCount: 7, status: "merged_case", assignee: { name: "Emma Zhang", initials: "EZ" }, slaRemaining: null, slaUrgent: false, submittedAt: "2026-03-13",
    hitDimensions: [ev("withdraw_addr", "strong", 40, "命中 OFAC 制裁地址"), ev("fund", "strong", 30, "资金注入制裁关联实体")] },
  { id: "RING-0008", name: "共用设备登录簇", method: "设备聚类", confidence: "low", confidenceScore: 42, memberCount: 3, accountCount: 5, totalAmountCad: 9600, overLctr: false, alertCount: 1, status: "closed", assignee: { name: "Sarah Chen", initials: "SC" }, slaRemaining: null, slaUrgent: false, submittedAt: "2026-02-28",
    hitDimensions: [ev("device", "weak", 20, "共用设备指纹"), ev("ip", "weak", 12, "同 IP 段")] },
];

// ── 确定性派生 RingDetail ──
const seedOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const PALETTE = ["var(--brand)", "var(--violet)", "var(--warning)", "var(--success)", "var(--danger)"];

export function buildRingDetail(r: Ring): RingDetail {
  const h = seedOf(r.id);
  const linked = SUBJECTS.filter((s) => s.ringId === r.id);
  // 成员 = 真实主体(§7.2);无关联主体的团伙合成 memberCount 个成员
  const members: RingMember[] = linked.length
    ? linked.map((s, i) => ({ subjectId: s.id, subjectName: s.name, avatar: s.avatar, color: PALETTE[i % PALETTE.length], role: s.ringRole ?? "团伙成员", accountCount: s.accountCount }))
    : Array.from({ length: Math.max(1, r.memberCount) }, (_, i) => ({ subjectId: `${r.id}-M${i + 1}`, subjectName: i === 0 ? "归集主体" : `关联主体 ${i + 1}`, avatar: i === 0 ? "核" : `M${i + 1}`, color: PALETTE[i % PALETTE.length], role: i === 0 ? "归集核心" : "关联主体", accountCount: 1 + ((h >>> i) % 3) }));

  const coreIdx = Math.max(0, members.findIndex((m) => m.role.includes("核心") || m.role.includes("归集")));
  const dims = r.hitDimensions.map((d) => d.dimension);
  const nodes: RingNode[] = members.map((m, i) => ({ id: m.subjectId, label: m.subjectName, sublabel: m.role, type: i === coreIdx ? "core" : "subject", color: m.color }));
  // 边:每个非核心成员 → 核心,维度取团伙命中维度的子集
  const edges: RingEdge[] = members.flatMap((m, i) => i === coreIdx ? [] : [{ from: m.subjectId, to: members[coreIdx].subjectId, dimensions: dims.slice(0, 1 + ((h >>> i) % Math.max(1, dims.length))), strength: 30 + ((h >>> (i * 2)) % 55) }]);

  const fundFlow: FundFlowStage[] = [
    { kind: "in", title: "分散入金", desc: `${members.length} 主体分散入金`, amountCad: r.totalAmountCad, status: "已完成" },
    { kind: "aggregate", title: "归集中转", desc: "资金归集至核心地址后经中转层过账", amountCad: r.totalAmountCad, status: "已完成", note: "分层混淆 · 切断链上溯源" },
    { kind: "out", title: "分发出金", desc: "中转后分发至多个出口地址", amountCad: Math.round(r.totalAmountCad * 0.92), status: r.overLctr ? "超 LCTR" : "正常" },
  ];

  return {
    ...r,
    members,
    graph: { nodes, edges },
    fundFlow,
    evidence: r.hitDimensions,
    timeline: [
      { at: r.submittedAt, text: "系统识别团伙 · 多维关联聚类成团", done: true },
      { at: r.submittedAt, text: r.assignee ? `${r.assignee.name} 认领 · 进入调查` : "待认领", done: !!r.assignee },
      { at: "—", text: "研判结论 · 升级 / 转案件 / 处置", done: ["escalated", "merged_case", "disposed", "closed"].includes(r.status) },
    ],
    hitRules: [
      { name: "多主体扇入同一地址", hit: dims.includes("fund") },
      { name: "共享设备指纹聚类", hit: dims.includes("device") },
      { name: "提现地址复用", hit: dims.includes("withdraw_addr") },
      { name: "同 IP 段登录", hit: dims.includes("ip") },
    ],
  };
}
