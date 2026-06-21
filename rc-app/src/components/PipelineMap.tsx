import { useNavigate } from "react-router-dom";
import { Search, History, Bell, FolderOpen, FileText, FileCheck, Network, ListChecks, ArrowRight, ArrowDown, CornerDownRight } from "lucide-react";
import { alerts, GATE_STATES, INVESTIGATION_STATES, RC_STATES } from "@/lib/data";
import { FINDINGS, FSTATES, type FState } from "@/lib/findings";
import { CASES, CSTATE, type CState } from "@/lib/cases";
import { REPORTS, RSTATE, type RState } from "@/lib/reports";
import { rings } from "@/lib/rings";

// 风控流水线总览 —— 给第一次用的人一张"一笔钱怎么流动"的地图。每个节点可点,带在办计数。
interface Node { to: string; label: string; desc: string; icon: typeof Search; n: number }

export function PipelineMap() {
  const nav = useNavigate();
  const gateN = alerts.filter((a) => GATE_STATES.includes(a.state)).length;
  const invN = alerts.filter((a) => INVESTIGATION_STATES.includes(a.state)).length;
  const findN = FINDINGS.filter((f) => FSTATES[f.status as FState].active).length;
  const caseN = CASES.filter((c) => CSTATE[c.state as CState].active).length;
  const repN = REPORTS.filter((r) => RSTATE[r.status as RState].active).length;
  const dispN = alerts.filter((a) => !RC_STATES[a.state].active).length;

  // 主链:事中 → 告警 → 案件 → 报送 → 归档
  const lane: { node: Node; via?: string }[] = [
    { node: { to: "/monitoring", label: "事中监控", desc: "实时闸口", icon: Search, n: gateN } },
    { node: { to: "/alerts", label: "告警研判", desc: "深度调查", icon: Bell, n: invN }, via: "转研判" },
    { node: { to: "/cases", label: "案件管理", desc: "合规案件", icon: FolderOpen, n: caseN }, via: "升级 / 建案" },
    { node: { to: "/reports", label: "报告报送", desc: "STR · FINTRAC", icon: FileText, n: repN }, via: "起草 STR" },
    { node: { to: "/dispositions", label: "处置记录", desc: "全口径归档", icon: FileCheck, n: dispN }, via: "结案" },
  ];
  const feeders: Node[] = [
    { to: "/post-monitoring", label: "事后监控", desc: "批量回溯", icon: History, n: findN },
    { to: "/rings", label: "关联团伙", desc: "团伙识别", icon: Network, n: rings.length },
  ];

  const Chip = ({ node, soft }: { node: Node; soft?: boolean }) => (
    <button onClick={() => nav(node.to)} className={`group flex min-w-[112px] flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition-colors ${soft ? "border-divider bg-default-50 hover:bg-default-100" : "border-[var(--brand-bd)] bg-[var(--brand-softer)] hover:bg-[var(--brand-soft)]"}`}>
      <span className="flex items-center gap-1.5 text-[12.5px] font-bold"><node.icon className="h-3.5 w-3.5" style={{ color: soft ? "var(--text-3)" : "var(--brand)" }} />{node.label}</span>
      <span className="text-[10.5px] text-default-400">{node.desc}</span>
      <span className="mt-0.5 text-[15px] font-extrabold leading-none tnum" style={{ color: soft ? undefined : "var(--brand)" }}>{node.n}<span className="ml-0.5 text-[10px] font-normal text-default-400">在办</span></span>
    </button>
  );

  return (
    <div className="card mb-5 p-4">
      <div className="mb-1 flex items-center gap-2"><span className="text-[13px] font-bold">风控流水线</span><span className="text-[11.5px] text-default-400">一笔交易命中规则后,如何在各模块间流动 —— 点任意环节进入</span></div>

      {/* 主链 */}
      <div className="mt-3 flex flex-wrap items-stretch gap-1.5">
        {lane.map((s, i) => (
          <div key={s.node.label} className="flex items-stretch gap-1.5">
            {i > 0 && (
              <div className="flex flex-col items-center justify-center px-0.5">
                <span className="text-[9.5px] font-semibold text-default-400 whitespace-nowrap">{s.via}</span>
                <ArrowRight className="h-4 w-4 text-default-300" />
              </div>
            )}
            <Chip node={s.node} />
          </div>
        ))}
      </div>

      {/* 旁路汇入 + 反馈闭环 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-divider pt-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-default-500"><CornerDownRight className="h-3.5 w-3.5 text-default-400" />汇入</span>
        {feeders.map((f) => <Chip key={f.label} node={f} soft />)}
        <span className="text-[11px] text-default-400">→ 直连 告警研判 / 案件管理(资金已出账则走追溯)</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-default-50 px-3 py-1.5 text-[11px] text-default-500">
          <ArrowDown className="h-3.5 w-3.5 text-default-400" />反馈闭环:事后<b className="text-default-600">规则回填</b>
          <button onClick={() => nav("/rules")} className="inline-flex items-center gap-0.5 font-semibold text-primary hover:opacity-80"><ListChecks className="h-3.5 w-3.5" />监控规则</button>
          → 回到事中实时拦截
        </span>
      </div>
    </div>
  );
}
