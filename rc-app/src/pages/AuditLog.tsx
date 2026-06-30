import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Select, SelectItem, Tooltip, Button } from "@heroui/react";
import { Search, ExternalLink, ShieldAlert, Download } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Initials } from "@/components/bits";
import { allAudit, AUDIT_MOD, AUDIT_CATS, AUDIT_ACTORS, isHiSensitive, type AuditModule, type AuditCat } from "@/lib/audit";
import { useRuleVersion, useCaseVersion, useReportVersion, useListVersion, useRingVersion, useFindingVersion, useAlertVersion } from "@/lib/store";

const MODULES: AuditModule[] = ["规则", "案件", "报送", "名单", "团伙", "事后", "告警", "策略", "系统"];

export default function AuditLog() {
  const nav = useNavigate();
  // 订阅各 store 版本 —— 本会话任意模块的处置 / 审批等动作实时汇入审计轨迹
  useRuleVersion(); useCaseVersion(); useReportVersion(); useListVersion(); useRingVersion(); useFindingVersion(); useAlertVersion();
  const [mod, setMod] = useState<"all" | AuditModule>("all");
  const [cat, setCat] = useState<"all" | AuditCat>("all");
  const [actor, setActor] = useState("all");
  const [q, setQ] = useState("");

  const all = allAudit(); // 版本 hook 触发重渲染即重算(实时事件 + 种子)

  const filtered = all.filter((r) => {
    const okM = mod === "all" || r.module === mod;
    const okC = cat === "all" || r.cat === cat;
    const okA = actor === "all" || r.actor.n === actor;
    const okQ = !q.trim() || (r.action + r.target + (r.targetId || "") + r.actor.n + (r.reason || "")).toLowerCase().includes(q.toLowerCase());
    return okM && okC && okA && okQ;
  });

  // KPI
  const decisionN = all.filter((r) => r.cat === "审批" || r.cat === "处置").length;
  const actorN = new Set(all.map((r) => r.actor.n)).size;
  const hiN = all.filter((r) => isHiSensitive(r.action)).length;
  const KPI: { k: string; v: string | number; sub: string }[] = [
    { k: "操作记录", v: all.length, sub: "近 30 天 · 全量留痕" },
    { k: "决策类", v: decisionN, sub: "审批 + 处置" },
    { k: "涉及操作人", v: actorN, sub: "分析师 / 总管 / 系统" },
    { k: "高敏动作", v: hiN, sub: "冻结 / 上线 / 签发 / 作废" },
  ];

  return (
    <Shell crumb={["治理与合规", "审计日志"]} wide>
      <PageHead
        title="审计日志 · 全量留痕"
        sub="风控全模块「谁在何时对哪条记录做了什么、为什么」的统一不可篡改轨迹 —— 规则上线 / 案件处置 / STR 签发 / 名单生效 / 策略变更等均逐条留痕,供 MLRO 与监管追溯。本会话的实时动作即时汇入。"
        actions={<Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<Download className="h-3.5 w-3.5" />}>导出轨迹</Button>}
      />

      {/* KPI */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {KPI.map((s) => (
          <div key={s.k} className="card p-4">
            <div className="text-[12px] text-default-500">{s.k}</div>
            <div className="mt-1.5 text-[26px] font-extrabold leading-none tnum">{s.v}</div>
            <div className="mt-1 text-[11px] text-default-400">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* 模块筛选 chips */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setMod("all")} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${mod === "all" ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:bg-default-100"}`}>全部模块</button>
        {MODULES.map((m) => {
          const on = mod === m;
          const Icon = AUDIT_MOD[m].icon;
          return <button key={m} onClick={() => setMod(m)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:bg-default-100"}`}><Icon className="h-3.5 w-3.5" />{m}</button>;
        })}
      </div>

      {/* 类别 / 操作人 / 搜索 */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Select aria-label="动作类别" size="sm" selectedKeys={[cat]} onChange={(e) => setCat((e.target.value || "all") as "all" | AuditCat)} className="max-w-[150px]" classNames={{ trigger: "bg-default-100 shadow-none h-10" }}>
          {[<SelectItem key="all">全部类别</SelectItem>, ...AUDIT_CATS.map((c) => <SelectItem key={c}>{c}</SelectItem>)]}
        </Select>
        <Select aria-label="操作人" size="sm" selectedKeys={[actor]} onChange={(e) => setActor(e.target.value || "all")} className="max-w-[160px]" classNames={{ trigger: "bg-default-100 shadow-none h-10" }}>
          {[<SelectItem key="all">全部操作人</SelectItem>, ...AUDIT_ACTORS.map((p) => <SelectItem key={p.n}>{p.n}</SelectItem>)]}
        </Select>
        <Input size="sm" radius="full" value={q} onValueChange={setQ} placeholder="搜索动作、对象、操作人或理由…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="ml-auto max-w-[300px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
      </div>

      {/* 审计轨迹表(只读) */}
      <Table aria-label="审计日志" radius="lg" classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] align-top", tr: "border-b border-default-100 last:border-0" }}>
        <TableHeader>
          <TableColumn>时间</TableColumn><TableColumn>操作人</TableColumn><TableColumn>模块</TableColumn>
          <TableColumn>对象</TableColumn><TableColumn>动作</TableColumn><TableColumn>理由 / 详情</TableColumn>
        </TableHeader>
        <TableBody emptyContent="没有符合条件的审计记录">
          {filtered.map((r, i) => {
            const Icon = AUDIT_MOD[r.module].icon;
            const hi = isHiSensitive(r.action);
            return (
              <TableRow key={i}>
                <TableCell>
                  <div className="whitespace-nowrap font-semibold tnum">{r.live ? "今日" : r.date}</div>
                  <div className="flex items-center gap-1 text-[11px] text-default-400"><span className="tnum">{r.time}</span>{r.live && <span className="rounded bg-default-100 px-1 py-px text-[9.5px] font-bold text-default-500">本会话</span>}</div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Initials p={r.actor} size={24} /><span><span className="font-semibold">{r.actor.n}</span><span className="block text-[11px] text-default-400">{r.role}</span></span></span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ background: "var(--track)", color: "var(--text-2)" }}><Icon className="h-3.5 w-3.5" />{r.module}</span>
                </TableCell>
                <TableCell>
                  {r.to ? (
                    <button onClick={() => nav(r.to!)} className="inline-flex max-w-[220px] items-center gap-1 text-left text-primary hover:opacity-80"><span className="truncate">{r.target}</span><ExternalLink className="h-3 w-3 shrink-0" /></button>
                  ) : <span className="block max-w-[220px] text-default-600">{r.target}</span>}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    {hi && <Tooltip content="高敏动作 · 合规重点关注" size="sm" delay={300}><ShieldAlert className="h-3.5 w-3.5 shrink-0 text-default-400" /></Tooltip>}
                    <span className="font-medium text-default-700">{r.action}</span>
                  </span>
                </TableCell>
                <TableCell><span className="block max-w-[280px] text-[12px] leading-snug text-default-500">{r.reason || "—"}</span></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-default-400">审计日志为<b className="text-default-500">只读、不可篡改</b>的合规留痕 —— 每条操作记录操作人、角色、时间、对象、动作与理由,依法保留 ≥5 年。本会话内各模块的实时动作(认领 / 处置 / 审批 / 报送…)即时汇入并标「本会话」;历史轨迹为代表性留痕样本(原型演示态,接后端读统一审计库)。</p>
    </Shell>
  );
}
