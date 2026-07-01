// 数据契约 · 团伙(Ring)。字段语义见 IMPLEMENTATION.md 第四节。
// 注意:刻意不含任何账本归属字段(MSO/MSB)—— 关系图与团伙判定不引入账本维度(领域约束 7.7)。
import { z } from "zod";
import { AssocEvidence, Confidence, DimensionKey } from "./common";

export const RingStatus = z.enum(["pending", "watching", "investigating", "escalated", "merged_case", "disposed", "closed"]);
export type RingStatus = z.infer<typeof RingStatus>;

export const Ring = z.object({
  id: z.string().regex(/^RING-/, "Ring.id 必须为 RING- 前缀"),
  name: z.string().min(1),
  method: z.string(),
  confidence: Confidence,
  confidenceScore: z.number().min(0).max(100),
  hitDimensions: z.array(AssocEvidence),
  memberCount: z.number().int().nonnegative(), // 真实主体数(商户/自然人,已归并)
  walletCount: z.number().int().nonnegative(), // 涉及钱包地址数
  totalAmountCad: z.number().nonnegative(),
  overLctr: z.boolean(),
  alertCount: z.number().int().nonnegative(),
  status: RingStatus,
  assignee: z.object({ name: z.string(), initials: z.string() }).nullable(),
  slaRemaining: z.string().nullable(),
  slaUrgent: z.boolean(),
  submittedAt: z.string(),
});
export type Ring = z.infer<typeof Ring>;

export const RingMember = z.object({
  subjectId: z.string(),
  subjectName: z.string(),
  avatar: z.string(),
  color: z.string(),
  role: z.string(),
  walletCount: z.number().int().nonnegative(),
});
export type RingMember = z.infer<typeof RingMember>;

export const RingNode = z.object({
  id: z.string(),
  label: z.string(),
  sublabel: z.string(),
  type: z.enum(["subject", "core", "relay"]),
  color: z.string(),
});
export type RingNode = z.infer<typeof RingNode>;

export const RingEdge = z.object({
  from: z.string(),
  to: z.string(),
  dimensions: z.array(DimensionKey).min(1),
  strength: z.number(),
});
export type RingEdge = z.infer<typeof RingEdge>;

export const FundFlowStage = z.object({
  kind: z.enum(["in", "aggregate", "out"]),
  title: z.string(),
  desc: z.string(),
  amountCad: z.number().optional(),
  status: z.string().optional(),
  note: z.string().optional(),
});
export type FundFlowStage = z.infer<typeof FundFlowStage>;

export const RingDetail = Ring.extend({
  members: z.array(RingMember).min(1),
  graph: z.object({ nodes: z.array(RingNode).min(1), edges: z.array(RingEdge) }),
  fundFlow: z.array(FundFlowStage),
  evidence: z.array(AssocEvidence),
  timeline: z.array(z.object({ at: z.string(), text: z.string(), done: z.boolean() })),
  hitRules: z.array(z.object({ name: z.string(), hit: z.boolean() })),
});
export type RingDetail = z.infer<typeof RingDetail>;
