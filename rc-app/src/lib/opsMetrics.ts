// 告警队列健康度的演示态指标 + 健康判定。
// 行动主页(Dashboard)用 queueHealth() 取一行摘要;运营总览(OpsOverview)用完整 QUEUE 画图。
// 注:这些是仪表盘聚合「今日」量级的 mock,接后端后应由真实队列指标替换。

// 近 14 日的轴标签(折线类图表通用)
export const DAYS14 = ["13日前", "12日前", "11日前", "10日前", "9日前", "8日前", "7日前", "6日前", "5日前", "4日前", "3日前", "前天", "昨天", "今日"];

export const QUEUE = {
  open: 218, newToday: 128, clearedToday: 141, // cleared > new ⇒ backlog shrinking by 13
  sla: 94.5, slaDelta: "+1.2pt", mttr: "4.2h", mttrDelta: "−0.5h", // SLA 达成率 · 平均处理时长(MTTR)
  trend: { // 14-day burn-down: daily inflow vs outflow
    newD: [120, 132, 118, 126, 122, 130, 125, 119, 128, 124, 131, 121, 126, 128],
    clearedD: [112, 120, 124, 118, 128, 122, 130, 126, 133, 129, 138, 132, 140, 141],
  },
  aging: [ // sums to open (218)
    { k: "0–4h", n: 96, over: false },
    { k: "4–24h", n: 74, over: false },
    { k: "1–3d", n: 36, over: false },
    { k: "超 SLA", n: 12, over: true },
  ],
  analysts: [ // open caseload vs target capacity (sorted in the UI; supports many)
    { p: { i: "SC", n: "Sarah Chen", c: "var(--violet)" }, open: 52, cap: 45 },
    { p: { i: "RA", n: "Raj Anand", c: "#0ea5e9" }, open: 49, cap: 45 },
    { p: { i: "AL", n: "Ana Lopez", c: "var(--brand)" }, open: 47, cap: 45 },
    { p: { i: "BT", n: "Bo Tan", c: "var(--success)" }, open: 46, cap: 45 },
    { p: { i: "JL", n: "James Liu", c: "var(--brand)" }, open: 44, cap: 45 },
    { p: { i: "MK", n: "Mae Koh", c: "var(--success)" }, open: 41, cap: 45 },
    { p: { i: "CY", n: "Chen Yu", c: "var(--violet)" }, open: 39, cap: 45 },
    { p: { i: "DN", n: "Dia Naidu", c: "#0ea5e9" }, open: 38, cap: 45 },
    { p: { i: "EM", n: "Eli Moss", c: "var(--brand)" }, open: 36, cap: 45 },
    { p: { i: "FK", n: "Fay Kim", c: "var(--success)" }, open: 34, cap: 45 },
    { p: { i: "GP", n: "Gus Park", c: "var(--violet)" }, open: 32, cap: 45 },
    { p: { i: "HW", n: "Hana Wu", c: "#0ea5e9" }, open: 30, cap: 45 },
    { p: { i: "IV", n: "Ivo Reyes", c: "var(--brand)" }, open: 28, cap: 45 },
    { p: { i: "JX", n: "Jo Xu", c: "var(--success)" }, open: 26, cap: 45 },
    { p: { i: "KO", n: "Kit Ono", c: "var(--violet)" }, open: 24, cap: 45 },
    { p: { i: "LZ", n: "Lev Zane", c: "#0ea5e9" }, open: 22, cap: 45 },
  ],
};

export type QueueTone = "red" | "amber" | "green";

// 一行摘要 + 健康判定(SLA 达成率 + 超载比例 + 积压趋势综合)。Dashboard 与 OpsOverview 同源。
export function queueHealth() {
  const net = QUEUE.clearedToday - QUEUE.newToday; // >0 ⇒ backlog shrinking
  const overSla = QUEUE.aging.find((a) => a.over)?.n ?? 0;
  const teamN = QUEUE.analysts.length;
  const teamOver = QUEUE.analysts.filter((a) => a.open > a.cap).length;
  const status: { label: string; tone: QueueTone } =
    QUEUE.sla < 90 || teamOver / teamN > 0.4 ? { label: "超负荷", tone: "red" }
    : overSla > 0 || teamOver / teamN > 0.2 ? { label: "偏紧", tone: "amber" }
    : { label: "健康", tone: "green" };
  return { net, overSla, teamN, teamOver, status, open: QUEUE.open, sla: QUEUE.sla, mttr: QUEUE.mttr };
}
