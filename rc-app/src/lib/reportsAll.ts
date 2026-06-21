// 报告全集 = 案件派生 STR + 手动新建报告 + 静态 LVCTR/TPR。列表页与详情页共用,口径一致。
import { REPORTS, MLRO, caseStrState, type Report, type RType, type RState } from "./reports";
import { CASES, type CState } from "./cases";
import { caseStore, reportStore } from "./store";
import type { Person } from "./data";

const ME: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const STR_STATES = ["str_draft", "mlro", "queued", "filed"];

// 案件管理 = STR 唯一发起点:案件进入 起草/评估/报送 后实时派生为 STR 报告(制裁规避走 TPR 不在此派生)
export function caseDerivedReports(): Report[] {
  return [...caseStore.created(), ...CASES]
    .filter((c) => STR_STATES.includes(caseStore.stateOf(c.id, c.state)) && c.risk !== "制裁规避")
    .map((c) => {
      const cs = caseStore.stateOf(c.id, c.state) as CState;
      const rs = caseStrState(cs);
      const filed = rs === "filed";
      return {
        id: `STR-${c.id}`, type: "STR" as RType, status: rs,
        src: "案件管理", srcId: c.id, to: `/case?id=${c.id}`,
        subject: c.subject, sub: `案件 · ${c.type}`, amount: c.amount,
        summary: `${c.risk} —— ${c.type};经案件研判确认可疑,起草 STR 上报 FINTRAC。`,
        officer: caseStore.ownerOf(c.id, c.owner) || ME,
        mlro: rs === "draft" ? null : MLRO,
        due: rs === "draft" ? { text: "起草中", tone: "grey" as const } : rs === "review" ? { text: "待复核 · 剩 28d", tone: "amber" as const } : rs === "queued" ? { text: "待报送", tone: "blue" as const } : { text: "已报送", tone: "grey" as const },
        filedAt: filed ? "2026-06-19 16:40" : undefined,
      };
    });
}

export function allReports(): Report[] {
  return [...caseDerivedReports(), ...reportStore.created(), ...REPORTS];
}

export function findReport(id: string): Report | undefined {
  return allReports().find((r) => r.id === id);
}

export const liveStatus = (r: Report) => reportStore.statusOf(r.id, r.status) as RState;
