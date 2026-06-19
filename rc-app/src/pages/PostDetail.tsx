import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Select, SelectItem } from "@heroui/react";
import { ArrowLeft, RefreshCw, Coins, Snowflake, AlertTriangle, ArrowUpRight, ArrowRight, UserX, ShieldPlus, UserPlus, ClipboardCheck } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill } from "@/components/bits";
import { FindingReviewDialog } from "@/components/FindingReviewDialog";
import { findingOf, detailOf, FSTATES, TRACE, traceTier, traceRecovery, type FState } from "@/lib/findings";
import { findingStore, useFindingVersion } from "@/lib/store";

const ME = { i: "JL", n: "James Liu", c: "var(--brand)" };
const tc = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : t === "green" ? "var(--success)" : t === "violet" ? "var(--violet)" : t === "blue" ? "var(--brand)" : "var(--text-3)");

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2 text-[12.5px] last:border-0"><span className="text-default-500">{label}</span><span className="text-right font-semibold">{children}</span></div>;
}

export default function PostDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  useFindingVersion();
  const f = findingOf(sp.get("id") || undefined);

  const [rev, setRev] = useState(false);

  const st = findingStore.statusOf(f.id, f.status) as FState;
  const sd = FSTATES[st];
  const tr = findingStore.traceOf(f.id, f.trace);
  const bf = findingStore.backfillOf(f.id, f.backfill);
  const frozen = findingStore.frozenOf(f.id);
  const loss = findingStore.lossOf(f.id);
  const restricted = findingStore.restrictedOf(f.id);
  const listed = findingStore.listedOf(f.id);
  const events = findingStore.eventsOf(f.id);
  const owner = findingStore.ownerOf(f.id, f.owner);
  const d = detailOf(f.id);
  const Icon = f.icon;

  const claim = () => { findingStore.set(f.id, { status: "progress", owner: ME, event: "认领 · 开始回溯调查" }); toast.success(`${f.id} · 已认领`); };
  const doBackfill = () => { findingStore.set(f.id, { backfill: true, event: "规则回填检测规则" }); toast(`已回填检测规则 · typology「${f.pattern}」事中即时拦截`); };
  const updateTrace = (v: string) => { if (v) { const rec = traceRecovery(v); findingStore.set(f.id, { trace: v, frozen: rec.frozen, lossReported: rec.lossReported, event: `更新追溯评估:${v}` }); } };
  const reqFreeze = () => { findingStore.set(f.id, { frozen: true, event: "请求下游交易所冻结" }); toast.success(`${f.id} · 已请求下游冻结`); };
  const reportLoss = () => { findingStore.set(f.id, { lossReported: true, event: "上报已发生损失" }); toast.success(`${f.id} · 已上报已发生损失`); };
  const restrict = () => { findingStore.set(f.id, { restricted: true, event: "限制 / 封禁账户 · 止损" }); toast.success(`${f.id} · 已限制账户`); };
  const addList = () => { findingStore.set(f.id, { listed: true, event: "对手地址 / 主体列名单" }); toast.success(`${f.id} · 已列入名单`); };

  return (
    <Shell crumb={["交易", "交易监控", "事后监控", f.id]}>
      <button onClick={() => nav("/post-monitoring")} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回事后监控</button>

      {/* header + 审核操作(统一在详情页) */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2.5 text-[22px] font-extrabold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100 text-default-500"><Icon className="h-5 w-5" /></span>
            {f.pattern}
            <Pill tone={f.risk} dot={false}>{f.risk === "red" ? "高风险" : "中风险"}</Pill>
            <Pill tone={sd.tone}>{sd.label}</Pill>
            {bf && <Pill tone="green">已回填规则</Pill>}
          </h1>
          <div className="mt-2.5 text-[13px] text-default-500">{f.id} · {f.subject} · 涉及 <b className="text-foreground">{f.amount}</b> · {f.txns} 笔 · 分配给 {owner ? <b className="text-foreground">{owner.n}</b> : <span className="text-default-400">未分配</span>} · SLA {f.sla.text} · 批次 {f.batch}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {sd.active ? (
            st === "new"
              ? <Button size="sm" color="primary" startContent={<UserPlus className="h-4 w-4" />} onPress={claim}>认领</Button>
              : <Button size="sm" color="primary" startContent={<ClipboardCheck className="h-4 w-4" />} onPress={() => setRev(true)}>审核</Button>
          ) : (
            <Pill tone={sd.tone}>{sd.label} · 已结案</Pill>
          )}
        </div>
      </div>

      {/* 资金已出账提示 */}
      <div className="card mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-l-[3px] p-3.5 pl-4" style={{ borderLeftColor: "var(--danger)" }}>
        <span className="flex items-center gap-1.5 text-[13px] font-bold"><Coins className="h-4 w-4 text-danger" />资金已出账</span>
        <span className="text-[12.5px] text-default-500">本命中为交易完成后回溯发现 —— 事中已无法拦截。{st === "tracing" || st === "closed_str" || st === "closed_case" ? <>确认可疑,资金追溯评估:<b className="text-foreground">{tr || "待评估"}</b>。</> : "若确认可疑,需评估能否追溯、是否上报已发生损失。"}</span>
      </div>

      {/* 追溯工作台 — 仅追溯中状态。重心:报送 + 止损 + 留痕(资金常不可逆,不依赖追回) */}
      {st === "tracing" && (
        <div className="card mb-5 p-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[14px] font-bold">追溯处置 · 资金已出账</div>
            <div className="flex flex-wrap gap-1.5">
              {restricted && <Pill tone="red">已限制账户</Pill>}
              {listed && <Pill tone="amber">已列名单</Pill>}
              {frozen && <Pill tone="green">已请求下游冻结</Pill>}
              {loss && <Pill tone="amber">已上报损失</Pill>}
              {bf && <Pill tone="green">已回填规则</Pill>}
            </div>
          </div>
          <p className="mb-3 text-[11.5px] text-default-400">钱已出账多半不可逆,确认可疑的客户也大概率已流失 —— 追溯的重点不是"追回",而是<b className="text-default-600">履行报送义务 + 止损(封号/列名单/规则回填) + 审计留痕</b>;限制/封禁即结束该客户关系,在确认可疑下是预期止损,非误伤。能追回只是加分项。</p>

          <div className="mb-3 max-w-md">
            <Select size="sm" label="资金追溯评估" labelPlacement="outside" aria-label="资金追溯评估" selectedKeys={tr ? [tr] : []}
              onSelectionChange={(keys) => updateTrace(Array.from(keys as Set<string>)[0] ?? "")}>
              {TRACE.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
            </Select>
            {traceTier(tr) && <p className="mt-1.5 text-[11px] leading-relaxed text-default-400">{traceTier(tr)!.guide}</p>}
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wider text-default-400">止损 · 阻断后续</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {!restricted && <Button size="sm" variant="bordered" startContent={<UserX className="h-4 w-4" />} onPress={restrict}>限制 / 封禁账户</Button>}
            {!listed && <Button size="sm" variant="bordered" startContent={<ShieldPlus className="h-4 w-4" />} onPress={addList}>对手列名单</Button>}
            {!bf && <Button size="sm" variant="bordered" startContent={<RefreshCw className="h-4 w-4" />} onPress={doBackfill}>规则回填</Button>}
            {restricted && listed && bf && <span className="text-[12px] text-default-400">止损动作已完成</span>}
          </div>

          <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-default-400">追回 · 留痕(常追不回)</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {!frozen && <Button size="sm" variant="bordered" startContent={<Snowflake className="h-4 w-4" />} onPress={reqFreeze}>请求下游冻结</Button>}
            {!loss && <Button size="sm" variant="bordered" startContent={<AlertTriangle className="h-4 w-4" />} onPress={reportLoss}>上报已发生损失</Button>}
          </div>

          <p className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-default-400" />
            规则回填:基于本 typology 生成检测规则草案 → 变更治理 → 回测 → 审批后由<b className="text-foreground">事中实时拦截同类</b>(堵住下一笔,本笔不依赖追回);生效前不影响线上。
            <button onClick={() => nav("/rules")} className="inline-flex items-center gap-0.5 font-semibold text-primary hover:opacity-80">去监控规则 <ArrowUpRight className="h-3.5 w-3.5" /></button>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* 命中详情 */}
          <div className="card p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">命中详情</div>
            <p className="text-[13px] leading-relaxed text-default-700">{f.hit}</p>
            <div className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <Kv label="命中规则 / 模型">{f.rule}</Kv>
              <Kv label="监测周期">{f.period}</Kv>
              <Kv label="涉及交易数">{f.txns} 笔</Kv>
              <Kv label="涉及金额">{f.amount}</Kv>
              <Kv label="来源批次">{f.batch}</Kv>
              <Kv label="风险等级"><Pill tone={f.risk}>{f.risk === "red" ? "高" : "中"}</Pill></Kv>
            </div>
          </div>

          {/* 风险信号 */}
          {d?.factors.length ? (
            <div className="card p-5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">风险信号</div>
              <div className="flex flex-col gap-2">
                {d.factors.map((fa, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-divider p-3">
                    <span className="text-[18px] leading-none">{fa.emoji}</span>
                    <div className="min-w-0"><div className="text-[13px] font-semibold" style={{ color: tc(fa.tone) }}>{fa.title}</div><div className="text-[11.5px] text-default-400">{fa.desc}</div></div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 为什么事中漏判 */}
          {d?.gap && (
            <div className="card border-l-[3px] p-5" style={{ borderLeftColor: "var(--warning)" }}>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">为什么事中漏判 · 规则缺口</div>
              <p className="text-[12.5px] leading-relaxed text-default-600">{d.gap}</p>
            </div>
          )}

          {/* 资金路径 */}
          {d?.path && (
            <div className="card p-5">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-default-400">资金路径</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {d.path.map((p, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="rounded-lg border px-2.5 py-1 text-[12px] font-semibold" style={{ borderColor: tc(p[1]), color: tc(p[1]) }}>{p[0]}</span>
                    {i < d.path!.length - 1 && <ArrowRight className="h-4 w-4 text-default-300" />}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 涉及交易明细 */}
          {d?.txList.length ? (
            <div className="card overflow-hidden p-0">
              <div className="border-b border-divider p-4 text-[13px] font-bold">涉及交易明细 · {f.txns} 笔(样本 {d.txList.length})</div>
              <table className="w-full text-[12.5px]">
                <thead><tr className="border-b border-divider text-[11.5px] text-default-400"><th className="px-4 py-2 text-left font-medium">时间</th><th className="px-4 py-2 text-left font-medium">对手</th><th className="px-4 py-2 text-right font-medium">金额</th><th className="px-4 py-2 text-left font-medium">说明</th></tr></thead>
                <tbody>
                  {d.txList.map((tx, i) => (
                    <tr key={i} className="border-b border-default-100 last:border-0">
                      <td className="px-4 py-2.5 tnum text-default-500 whitespace-nowrap">{tx.t}</td>
                      <td className="px-4 py-2.5 font-medium">{tx.party}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tnum">{tx.amount}</td>
                      <td className="px-4 py-2.5 text-default-500">{tx.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          {/* 主体画像 */}
          <div className="card p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">主体画像</div>
            <div className="text-[14px] font-bold">{f.subject}</div>
            <div className="mb-2 text-[12px] text-default-400">{f.sub}</div>
            {d?.profile && <>
              <Kv label="注册地 / 辖区">{d.profile.country}</Kv>
              <Kv label="KYC / KYB">{d.profile.kyc}</Kv>
              <Kv label="注册时长">{d.profile.registered}</Kv>
              <Kv label="历史">{d.profile.history}</Kv>
            </>}
          </div>

          {/* 系统建议 */}
          {d?.rec && (
            <div className="card p-5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">系统建议</div>
              <p className="text-[12.5px] leading-relaxed text-default-600">{d.rec}</p>
            </div>
          )}

          {/* 处置摘要 */}
          <div className="card p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">处置摘要</div>
            <Kv label="当前状态"><Pill tone={sd.tone}>{sd.label}</Pill></Kv>
            <Kv label="账户处置">{restricted ? <span style={{ color: "var(--danger)" }}>已限制 / 封禁</span> : <span className="font-normal text-default-400">—</span>}</Kv>
            <Kv label="对手名单">{listed ? <span style={{ color: "var(--warning)" }}>已列名单</span> : <span className="font-normal text-default-400">—</span>}</Kv>
            <Kv label="规则回填">{bf ? <span style={{ color: "var(--success)" }}>已回填</span> : <span className="font-normal text-default-400">未回填</span>}</Kv>
            <Kv label="资金追溯">{tr || <span className="font-normal text-default-400">未评估</span>}</Kv>
            <Kv label="下游冻结">{frozen ? <span style={{ color: "var(--success)" }}>已请求</span> : <span className="font-normal text-default-400">—</span>}</Kv>
            <Kv label="损失上报">{loss ? <span style={{ color: "var(--warning)" }}>已上报</span> : <span className="font-normal text-default-400">—</span>}</Kv>
          </div>
        </div>
      </div>

      {/* 活动日志 */}
      {events.length > 0 && (
        <div className="card mt-5 p-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">活动日志</div>
          <div className="flex flex-col gap-2">
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-3 text-[12.5px]">
                <span className="tnum text-default-400">{e.t}</span>
                <span className="text-default-700">{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 审核 → 命中研判抽屉(与告警研判一致,按状态自适应处置 / 流程动作)*/}
      <FindingReviewDialog findingId={f.id} open={rev} onOpenChange={setRev} />
    </Shell>
  );
}
