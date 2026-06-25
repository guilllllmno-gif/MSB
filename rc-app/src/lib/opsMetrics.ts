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

// ── 下钻:某分析师手头具体背着什么(总管派单视角)──
// 注:演示态。这 16 人目前只有名字+在办数,未挂真实记录;此处按确定性种子编出可信的占位队列,
// 接后端后应改为按 assignee 拉真实告警/案件/报送。生成是纯函数(同输入同输出),抽屉里 reassign 重渲染不会乱跳。
export type Analyst = (typeof QUEUE.analysts)[number];
export type QItem = { id: string; kind: "告警" | "案件" | "报送"; subject: string; meta: string; sla: string; tone: QueueTone };

const A_SUBJ = ["NovaPay · 大额异动", "Eastwind · 快进快出", "BlockTrade · 链跳兑换", "Acme Pay · 新户首充", "PayBridge · 代付归集", "Coinhub · 隐私币兑换", "FastRamp · 拆分入金", "MetaPay · 异常提币", "SwiftEx · 跨境聚合", "ChainGo · 高频对敲"];
const C_SUBJ = ["快进快出资金调查", "可疑资金归集", "结构化拆分入金", "制裁名单关联核查", "团伙资金链路梳理"];
const R_SUBJ = ["STR · 可疑交易报告", "LCTR · 大额现金交易", "STR · 团伙上报"];
const pick = <T,>(arr: T[], k: number) => arr[k % arr.length];
const SLA_RED = ["超 SLA 2.1h", "超 SLA 40m", "超 SLA 5.6h", "超 SLA 1.3h"];
const SLA_AMB = ["剩 1.2h", "剩 3.5h", "剩 48m"];
const SLA_GRN = ["剩 1.8d", "剩 6.2h", "剩 1.1d", "无时限"];

// 按种子生成某人的完整队列,红(超SLA)在前。over=超出上限的件,作为红件数;不超载者给 1–2 件临期黄。
export function analystQueue(p: Analyst): QItem[] {
  const seed = [...p.p.n].reduce((s, c) => s + c.charCodeAt(0), 0);
  const over = Math.max(0, p.open - p.cap);
  const redN = over > 0 ? over : 0;
  const ambN = over > 0 ? 2 : Math.min(2, p.open);
  const items: QItem[] = [];
  for (let i = 0; i < p.open; i++) {
    const r = (seed * 9301 + i * 49297) % 233280;
    const f = r / 233280;
    const kind: QItem["kind"] = f < 0.62 ? "告警" : f < 0.86 ? "案件" : "报送";
    const tone: QueueTone = i < redN ? "red" : i < redN + ambN ? "amber" : "green";
    const sla = tone === "red" ? pick(SLA_RED, seed + i) : tone === "amber" ? pick(SLA_AMB, seed + i) : pick(SLA_GRN, seed + i);
    const id4 = 2400 + (seed % 400) + i;
    if (kind === "告警") items.push({ id: `ALT-${id4}`, kind, subject: pick(A_SUBJ, seed + i), meta: `评分 ${60 + ((seed + i * 7) % 39)} · 命中 ${1 + ((seed + i) % 4)} 规则`, sla, tone });
    else if (kind === "案件") items.push({ id: `CASE-${id4}`, kind, subject: pick(C_SUBJ, seed + i), meta: `CAD ${(0.3 + ((seed + i) % 28) / 10).toFixed(1)}M · 调查中`, sla, tone });
    else items.push({ id: `STR-${id4}`, kind, subject: pick(R_SUBJ, seed + i), meta: `起草中 · 待提交 MLRO`, sla, tone });
  }
  const rank = { red: 0, amber: 1, green: 2 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

// 改派候选:有余力的人(open<cap),按空余量降序,排除指定人
export function spareAnalysts(excludeName?: string): { name: string; spare: number; p: Analyst["p"] }[] {
  return QUEUE.analysts
    .filter((a) => a.p.n !== excludeName && a.open < a.cap)
    .map((a) => ({ name: a.p.n, spare: a.cap - a.open, p: a.p }))
    .sort((x, y) => y.spare - x.spare);
}
