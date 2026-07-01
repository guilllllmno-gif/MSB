// 数据契约 · 主体(Subject)+ 归并(Merge)。字段语义见 IMPLEMENTATION.md 第四节。
// 实体层级(领域真实模型):钱包地址(多)──▶ 商户 = 公司主体(1:1)──▶ 团伙(同一控制人的多个商户)。
// 主体粒度 = 商户(type:entity)/ 自然人(type:individual);「归并」= 把观察到的钱包地址归属到某个主体/商户。
import { z } from "zod";
import { AssocEvidence, RiskLevel } from "./common";

export const Subject = z.object({
  id: z.string().regex(/^SUBJ-/, "Subject.id 必须为 SUBJ- 前缀"),
  name: z.string().min(1),
  type: z.enum(["individual", "entity"]), // entity=商户(公司主体,与商户 1:1)/ individual=自然人(UBO/实控人)
  avatar: z.string().min(1),
  riskLevel: RiskLevel,
  riskScore: z.number().min(0).max(100),
  mergeConfidence: z.number().min(0).max(100),
  walletCount: z.number().int().nonnegative(), // 归属该主体的钱包地址数(一个商户可有多个)
  ringId: z.string().nullable(),
  ringRole: z.string().optional(),
  totalAmountCad: z.number().nonnegative(),
  amlHitCount: z.number().int().nonnegative(),
  ruleHitCount: z.number().int().nonnegative(),
  accountAgeDays: z.number().int().nonnegative(),
  kycStatus: z.enum(["passed", "pending", "rejected"]),
  firstSeen: z.string(),
});
export type Subject = z.infer<typeof Subject>;

// 归属该主体的钱包地址(一个商户/主体可挂多个钱包地址)
export const MergedWallet = z.object({
  address: z.string().min(1), // 钱包地址(链上标识,展示可截断)
  isAnchor: z.boolean(), // 登记地址(商户注册主地址)—— 不可拆分
  registeredAt: z.string(),
  linkStrength: z.number().nullable(), // 登记地址为 null;其余为归属置信强度
  meta: z.string(),
});
export type MergedWallet = z.infer<typeof MergedWallet>;

export const AmlHit = z.object({
  id: z.string(),
  title: z.string(),
  detectedAt: z.string(),
  detail: z.string(),
});
export type AmlHit = z.infer<typeof AmlHit>;

export const MergeCandidate = z.object({
  id: z.string(),
  address: z.string(), // 待归属的钱包地址
  targetSubjectId: z.string(),
  targetSubjectName: z.string(),
  evidence: z.array(AssocEvidence).min(1),
  confidence: z.number().min(0).max(100),
  detectedAt: z.string(),
});
export type MergeCandidate = z.infer<typeof MergeCandidate>;

export const MergeLogEntry = z.object({
  action: z.enum(["auto_merge", "manual_merge", "manual_split"]),
  wallet: z.string(), // 涉及的钱包地址
  operator: z.string(),
  at: z.string(),
  reason: z.string().optional(),
});
export type MergeLogEntry = z.infer<typeof MergeLogEntry>;

export const SubjectDetail = Subject.extend({
  wallets: z.array(MergedWallet).min(1),
  mergeEvidence: z.array(AssocEvidence),
  amlHits: z.array(AmlHit),
  pendingCandidates: z.array(MergeCandidate),
  mergeLog: z.array(MergeLogEntry),
});
export type SubjectDetail = z.infer<typeof SubjectDetail>;
