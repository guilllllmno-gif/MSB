// 顶栏通知中心数据源 —— 团队级「需立即处理」信号,全部从各 store 实时派生。
// 口径与仪表盘「需立即处理」banner 一致(Dashboard.tsx 同名谓词):告警超SLA / 报送待处理 / 案件待认领 / 待认领团伙。
// 单一来源:供 Shell 顶栏铃铛消费;零计数项自动隐去。
import { Clock, SendHorizontal, Snowflake, Network } from "lucide-react";
import { alerts, INVESTIGATION_STATES } from "./data";
import { CASES, CSTATE, type CState } from "./cases";
import { rings, type RingStateKey } from "./rings";
import { allReports, liveStatus } from "./reportsAll";
import { alertStore, caseStore, ringStore, type Role } from "./store";

export interface Notif { n: number; label: string; sub: string; icon: typeof Clock; to: string }

// role-aware,与仪表盘「需立即处理」banner 同口径:
// 分析师 = 团队态势全量;总管 = 只留团队 SLA 告急(报送已在「待我审批」、待认领已并入「团队负荷」,不重复)。
export function liveNotifications(role: Role = "analyst"): Notif[] {
  // 团伙:pending = 待认领(RingList 同口径)
  const allRings = [...ringStore.created(), ...rings];
  const ringPending = allRings.filter((r) => (ringStore.stateOf(r.id, r.state) as RingStateKey) === "pending").length;
  // 案件:active 且未分配 = 待认领(CaseList 显「认领」的件)
  const allCases = [...caseStore.created(), ...CASES];
  const casesToClaim = allCases.filter((c) => CSTATE[caseStore.stateOf(c.id, c.state) as CState].active && !caseStore.ownerOf(c.id, c.owner)).length;
  // 告警研判:调查车道里已超 SLA 的件(AlertList 同口径:INVESTIGATION_STATES + sla 红)
  const alertsOverSla = alerts.filter((a) => INVESTIGATION_STATES.includes(alertStore.stateOf(a.id, a.state)) && a.sla.color === "red").length;
  // 报告报送:待 MLRO 复核 + 被退回需补正(ReportFiling「需立即处理」同口径)
  const reportsNeedAction = allReports().filter((r) => ["review", "returned"].includes(liveStatus(r))).length;

  if (role === "head")
    return [
      { n: alertsOverSla, label: `${alertsOverSla} 笔告警超 SLA`, sub: "团队需介入 · 优先清理", icon: Clock, to: "/alerts" },
    ].filter((u) => u.n > 0);

  return [
    { n: alertsOverSla, label: `${alertsOverSla} 笔告警超 SLA`, sub: "调查车道 · 需优先清理", icon: Clock, to: "/alerts" },
    { n: reportsNeedAction, label: `FINTRAC 报送待处理 ${reportsNeedAction} 件`, sub: "待 MLRO 复核 / 退回补正", icon: SendHorizontal, to: "/reports" },
    { n: casesToClaim, label: `案件待认领 ${casesToClaim} 件`, sub: "在办案件 · 暂无负责人", icon: Snowflake, to: "/cases" },
    { n: ringPending, label: `待认领团伙 ${ringPending} 个`, sub: "团伙识别 · 待研判", icon: Network, to: "/rings" },
  ].filter((u) => u.n > 0);
}
