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

// ─────────────────────────────────────────────────────────────────────────────
// 生命周期感知的统一入口(告警 / 案件 / 事后命中 / 团伙共用一套口径)
//
// SLA 时钟随「当前 live 状态」走,而非记录里的静态副本:
//   • active   —— 处置进行中,跑倒计时(computeSla)
//   • paused   —— 补料 / 待材料等待外部,时钟暂停(不计逾期)
//   • terminal —— 已结 / 已报送 / 已合并,时钟停止(doneLabel 说明落点)
// 起算点仍为占位:演示态由 id 合成 elapsed;接后端改读真实 detectedAt(见上 synthElapsedH)。
// 分档时长 SLA_HOURS 与逾期动作口径待风控 / 合规签发(B2),此处仅实现框架。
// ─────────────────────────────────────────────────────────────────────────────
export type SlaPhase = "active" | "paused" | "terminal";

const grey: Tone = "grey";
// 时钟不再跑的视图(暂停 / 已结):pct/hoursLeft 归零、不计逾期、中性色。
const staticSla = (text: string): SlaView => ({ text, pct: 0, tone: grey, overdue: false, hoursLeft: 0, allotH: 0 });

// 统一 SLA:按当前生命周期阶段产出视图。active 才跑真时钟。
export function slaOf(id: string, tier: SlaTier, phase: SlaPhase, doneLabel = "已完结"): SlaView {
  if (phase === "terminal") return staticSla(doneLabel);
  if (phase === "paused") return staticSla("已暂停");
  return computeSla(synthElapsedH(id, tier), tier);
}
