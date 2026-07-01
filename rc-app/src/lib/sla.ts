import type { Tone } from "./data";

// ─────────────────────────────────────────────────────────────────────────────
// SLA 计算框架(优化项 B2 · 待定口径)
//
// ⚠️ 本模块的「起算点」与「分级处置时限」均为**占位默认值**,未经风控 / 合规签发,
//    不得作为真实处置时限依据。前端只实现算法框架;`SLA_HOURS` 时长表与 `slaTier`
//    分档口径须由风控负责人定义后替换。参数确认见 docs/OPEN_QUESTIONS.md(B2)。
// ─────────────────────────────────────────────────────────────────────────────
export const SLA_PROVISIONAL = true;

// 演示世界时钟 —— 与 mkCase / intakeList 的 2026-07-01 世界日期口径一致(取次日 09:00 为「现在」)
export const WORLD_NOW = "2026-07-02T09:00:00";

// 分级处置时限(小时)· 占位默认 · 待定
export const SLA_HOURS = { high: 24, medium: 48, low: 96 } as const;
export type SlaTier = keyof typeof SLA_HOURS;

// 关注等级 → 时限档(占位:按置信度分档)· 待定
export const slaTier = (confidence: number): SlaTier =>
  confidence >= 80 ? "high" : confidence >= 60 ? "medium" : "low";

export interface SlaView { text: string; pct: number; tone: Tone; overdue: boolean; hoursLeft: number; allotH: number }

const fmtH = (h: number): string => {
  const t = Math.round(h), d = Math.floor(t / 24), r = t % 24;
  return d > 0 ? `${d}d ${String(r).padStart(2, "0")}h` : `${r}h`;
};

// 从「起算时刻已过的小时数」+ 时限档 → SLA 视图。
//   pct = 已消耗时限百分比(越接近截止越大);tone:逾期→red、余量 ≤25%→amber、否则 blue。
export function computeSla(elapsedH: number, tier: SlaTier): SlaView {
  const allotH = SLA_HOURS[tier];
  const leftH = allotH - elapsedH;
  const overdue = leftH <= 0;
  const pct = Math.max(0, Math.min(100, Math.round((elapsedH / allotH) * 100)));
  const tone: Tone = overdue ? "red" : leftH <= allotH * 0.25 ? "amber" : "blue";
  return { text: overdue ? `已逾期 ${fmtH(-leftH)}` : `剩 ${fmtH(leftH)}`, pct, tone, overdue, hoursLeft: leftH, allotH };
}

// 演示态无真实入队时间戳 → 由 id 稳定合成一个「已过小时数」(0 .. 1.3×时限,约 1/4 逾期)。
// 接后端应改为:elapsed = WORLD_NOW − 真实 detectedAt(识别 / 入队时刻)。
export function synthElapsedH(id: string, tier: SlaTier): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  const seed = ((h >>> 0) % 1000) / 1000; // 0..1
  return Math.round(SLA_HOURS[tier] * seed * 1.3);
}
