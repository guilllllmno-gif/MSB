// 数据契约 · 公共维度与关联证据(Zod = 单一来源)。
// 维度配色沿用 rc-app 视觉语言(--brand/--violet/--warning/--danger),与 spec 维度色一一对应。
import { z } from "zod";

export const DimensionKey = z.enum(["fund", "device", "withdraw_addr", "ip"]);
export type DimensionKey = z.infer<typeof DimensionKey>;

export const SignalStrength = z.enum(["strong", "weak"]);
export type SignalStrength = z.infer<typeof SignalStrength>;

export const AssocEvidence = z.object({
  dimension: DimensionKey,
  strength: SignalStrength,
  weight: z.number(),
  note: z.string(),
});
export type AssocEvidence = z.infer<typeof AssocEvidence>;

export const RiskLevel = z.enum(["high", "mid", "low"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const Confidence = z.enum(["high", "mid", "low"]);
export type Confidence = z.infer<typeof Confidence>;

// 维度展示元数据(关系图圆点 / 归并依据 全局统一)
export const DIM_META: Record<DimensionKey, { label: string; short: string; color: string }> = {
  fund: { label: "资金路径", short: "资金", color: "var(--danger)" },
  device: { label: "设备指纹", short: "设备", color: "var(--brand)" },
  withdraw_addr: { label: "提现地址", short: "提现", color: "var(--violet)" },
  ip: { label: "IP 段", short: "IP", color: "var(--warning)" },
};
export const DIM_ORDER: DimensionKey[] = ["fund", "device", "withdraw_addr", "ip"];

// 风险 / 置信度 → 语义色(高=danger / 中=amber / 低=green)
export const LEVEL_TONE: Record<RiskLevel, "red" | "amber" | "green"> = { high: "red", mid: "amber", low: "green" };
export const LEVEL_LABEL: Record<RiskLevel, string> = { high: "高", mid: "中", low: "低" };
