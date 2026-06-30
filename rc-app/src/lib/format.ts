// 金额 / 日期 / CAD 格式化。
const CAD = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const CAD2 = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtCad = (n: number, cents = false) => (cents ? CAD2 : CAD).format(n);

// 紧凑大额:CAD 124,000 → CAD 124K(列表用)
export function fmtCadCompact(n: number): string {
  if (n >= 1_000_000) return `CAD ${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `CAD ${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K`;
  return `CAD ${n}`;
}

// ISO date → YYYY-MM-DD
export const fmtDate = (iso: string) => (iso.length >= 10 ? iso.slice(0, 10) : iso);

// 账龄天数 → 人话
export function fmtAge(days: number): string {
  if (days < 30) return `${days} 天`;
  if (days < 365) return `${Math.round(days / 30)} 个月`;
  return `${(days / 365).toFixed(1)} 年`;
}

export const LCTR_LIMIT = 10_000; // 大额现金交易报告阈值(CAD)
