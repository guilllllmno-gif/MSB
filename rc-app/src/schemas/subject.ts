// 数据契约 · 主体(Subject)+ 归并(Merge)。字段语义见 IMPLEMENTATION.md 第四节。
import { z } from "zod";
import { AssocEvidence, RiskLevel } from "./common";

export const Subject = z.object({
  id: z.string().regex(/^SUBJ-/, "Subject.id 必须为 SUBJ- 前缀"),
  name: z.string().min(1),
  type: z.enum(["individual", "entity"]),
  avatar: z.string().min(1),
  riskLevel: RiskLevel,
  riskScore: z.number().min(0).max(100),
  mergeConfidence: z.number().min(0).max(100),
  accountCount: z.number().int().nonnegative(),
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

export const MergedAccount = z.object({
  accountId: z.string().regex(/^ACCT-/, "account.id 必须为 ACCT- 前缀"),
  isAnchor: z.boolean(),
  registeredAt: z.string(),
  linkStrength: z.number().nullable(), // 锚点为 null
  meta: z.string(),
});
export type MergedAccount = z.infer<typeof MergedAccount>;

export const AmlHit = z.object({
  id: z.string(),
  title: z.string(),
  detectedAt: z.string(),
  detail: z.string(),
});
export type AmlHit = z.infer<typeof AmlHit>;

export const MergeCandidate = z.object({
  id: z.string(),
  accountId: z.string(),
  targetSubjectId: z.string(),
  targetSubjectName: z.string(),
  evidence: z.array(AssocEvidence).min(1),
  confidence: z.number().min(0).max(100),
  detectedAt: z.string(),
});
export type MergeCandidate = z.infer<typeof MergeCandidate>;

export const MergeLogEntry = z.object({
  action: z.enum(["auto_merge", "manual_merge", "manual_split"]),
  account: z.string(),
  operator: z.string(),
  at: z.string(),
  reason: z.string().optional(),
});
export type MergeLogEntry = z.infer<typeof MergeLogEntry>;

export const SubjectDetail = Subject.extend({
  accounts: z.array(MergedAccount).min(1),
  mergeEvidence: z.array(AssocEvidence),
  amlHits: z.array(AmlHit),
  pendingCandidates: z.array(MergeCandidate),
  mergeLog: z.array(MergeLogEntry),
});
export type SubjectDetail = z.infer<typeof SubjectDetail>;
