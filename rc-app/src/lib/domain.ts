// 风控领域约束常量(IMPLEMENTATION.md 第七节)—— 设为常量便于改,逻辑层单一来源。
import type { RingStatus } from "@/schemas/ring";

// 7.3 归并阈值:自动归并 ≥75,人工复核区间 50–74,<50 不归并。候选队列只展示 50–74。
export const MERGE = { auto: 75, reviewLow: 50, reviewHigh: 74 } as const;
export const inReviewBand = (c: number) => c >= MERGE.reviewLow && c <= MERGE.reviewHigh;
export const mergeDisposition = (c: number): "auto" | "review" | "reject" =>
  c >= MERGE.auto ? "auto" : c >= MERGE.reviewLow ? "review" : "reject";

// 7.5 合并/拆分高敏操作所需角色(前端不实际鉴权,但 UI 必须呈现权限要求 + 审计提示)
export const REQUIRED_ROLE = { merge: "风控分析师", split: "风控主管" } as const;

// 7.6 认领状态机:pending 可认领;已 disposed/closed/已有 assignee 不可认领
export const canClaim = (status: RingStatus, assignee: unknown): boolean => status === "pending" && !assignee;

// 团伙状态展示(只有「状态」用色,沿用 rc-app 口径)
export const RING_STATUS_META: Record<RingStatus, { label: string; tone: "amber" | "blue" | "violet" | "red" | "green" | "grey" }> = {
  pending: { label: "待认领", tone: "amber" },
  watching: { label: "观察中", tone: "grey" },
  investigating: { label: "调查中", tone: "violet" },
  escalated: { label: "已升级", tone: "red" },
  merged_case: { label: "并入案件", tone: "blue" },
  disposed: { label: "已处置", tone: "green" },
  closed: { label: "已关闭", tone: "grey" },
};

export const KYC_META: Record<"passed" | "pending" | "rejected", { label: string; tone: "green" | "amber" | "red" }> = {
  passed: { label: "已通过", tone: "green" },
  pending: { label: "待核验", tone: "amber" },
  rejected: { label: "未通过", tone: "red" },
};
