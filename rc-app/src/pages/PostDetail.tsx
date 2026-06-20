import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@heroui/react";
import { ArrowLeft, Coins, AlertTriangle, ArrowUpRight, ArrowRight, UserPlus, ClipboardCheck, Lightbulb, ArrowDownToLine, GitMerge, ArrowLeftRight, Shuffle, Waypoints, CircleOff, FolderPlus, Link2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill } from "@/components/bits";
import { FindingReviewDialog } from "@/components/FindingReviewDialog";
import { TraceDrawer } from "@/components/TraceDrawer";
import { findingOf, detailOf, FINDINGS, FSTATES, FDIM, dimSubjType, type FState } from "@/lib/findings";
import { findingStore, caseStore, useFindingVersion } from "@/lib/store";
import type { Case } from "@/lib/cases";

const ME = { i: "JL", n: "James Liu", c: "var(--brand)" };
const tc = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : t === "green" ? "var(--success)" : t === "violet" ? "var(--violet)" : t === "blue" ? "var(--brand)" : "var(--text-3)");
const tbg = (t: string) => (t === "red" ? "var(--danger-bg)" : t === "amber" ? "var(--warning-bg)" : t === "green" ? "var(--success-bg)" : t === "violet" ? "var(--violet-bg)" : t === "blue" ? "var(--brand-soft)" : "var(--chip-bg)");
// 资金路径节点角色 → 图标
const ROLE_ICON: Record<string, typeof Coins> = { 来源: ArrowDownToLine, 归集: GitMerge, 中转: ArrowLeftRight, 混淆: Shuffle, 跨链: Waypoints, 出口: ArrowUpRight, 失联: CircleOff };

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2 text-[12.5px] last:border-0"><span className="text-default-500">{label}</span><span className="text-right font-semibold">{children}</span></div>;
}

// 处置摘要横向条目:标签在上、值在下,值按状态上色
function Summ({ label, tone, children }: { label: string; tone?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[88px]">
      <div className="text-[10.5px] uppercase tracking-wider text-default-400">{label}</div>
      <div className="mt-0.5 text-[12.5px] font-semibold" style={{ color: tone ? tc(tone) : "var(--text-3)" }}>{children}</div>
    </div>
  );
}

export default function PostDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  useFindingVersion();
  const f = findingOf(sp.get("id") || undefined);

  const [rev, setRev] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

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
  // 关联命中(跨维度同主体/网络)
  const related = (f.related || []).map((id) => FINDINGS.find((x) => x.id === id)).filter(Boolean) as typeof FINDINGS;
  // 一键并案:把本命中 + 关联命中合并为一个案件(涉案主体自动并集),减少人工
  const consolidate = () => {
    const group = [f, ...related];
    const subjects = group.map((g) => ({ name: g.subject, type: dimSubjType(g.dim), role: `${FDIM[g.dim].label} · ${g.pattern}`, amount: g.amount }));
    const n = caseStore.created().length + 1;
    const c: Case = { id: `CASE-20260621-${String(n).padStart(3, "0")}`, subject: "跨维度关联网络", sub: `${group.length} 命中 · 多维度`, type: "跨维度关联并案", risk: "团伙网络", priority: "高", amount: "—", links: group.length, linkIds: group.map((g) => g.id).join(" · "), state: "investigating", owner: ME, sla: { text: "剩 3d", tone: "amber" }, submitted: "2026-06-21 10:00", src: "事后转案件(关联并案)", subjects };
    caseStore.add(c);
    group.forEach((g) => findingStore.set(g.id, { event: `并案 → ${c.id}` }));
    toast.success(`已并案 ${c.id} · ${group.length} 条命中合一`);
    nav("/cases");
  };

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
              : st === "tracing"
                ? <>
                    <Button size="sm" color="primary" startContent={<Coins className="h-4 w-4" />} onPress={() => setTraceOpen(true)}>追溯处置</Button>
                    <Button size="sm" variant="bordered" startContent={<ClipboardCheck className="h-4 w-4" />} onPress={() => setRev(true)}>结案审核</Button>
                  </>
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

      {/* 处置摘要 — 顶部横向状态条(常驻;空值占位) */}
      <div className="card mb-5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-default-400">处置摘要</span>
          {st === "tracing" && <button onClick={() => setTraceOpen(true)} className="text-[11.5px] font-semibold text-primary hover:opacity-80">管理追溯处置 →</button>}
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          <Summ label="当前状态" tone={sd.tone}>{sd.label}</Summ>
          <Summ label="资金追溯" tone={tr ? "amber" : undefined}>{tr || "未评估"}</Summ>
          <Summ label="账户处置" tone={restricted ? "red" : undefined}>{restricted ? "已限制 / 封禁" : "—"}</Summ>
          <Summ label="对手名单" tone={listed ? "amber" : undefined}>{listed ? "已列名单" : "—"}</Summ>
          <Summ label="下游冻结" tone={frozen ? "green" : undefined}>{frozen ? "已请求" : "—"}</Summ>
          <Summ label="损失上报" tone={loss ? "amber" : undefined}>{loss ? "已上报" : "—"}</Summ>
          <Summ label="规则回填" tone={bf ? "green" : undefined}>{bf ? "已回填" : "未回填"}</Summ>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* 命中详情 */}
          <div className="card p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-default-400">命中详情</div>
            <p className="text-[13px] leading-relaxed text-default-700">{f.hit}</p>
            <div className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <Kv label="命中规则 / 模型">{f.rule}</Kv>
              <Kv label="检测维度"><span className="inline-flex items-center gap-1">{(() => { const DI = FDIM[f.dim].icon; return <DI className="h-3.5 w-3.5 text-default-400" />; })()}{FDIM[f.dim].label}</span></Kv>
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

          {/* 为什么事中漏判 · 系统建议(规则缺口 → 处置建议,合并) */}
          {(d?.gap || d?.rec) && (
            <div className="card border-l-[3px] p-5" style={{ borderLeftColor: "var(--warning)" }}>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-default-400">为什么事中漏判 · 系统建议</div>
              {d?.gap && (
                <div className="mb-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--warning)" }}><AlertTriangle className="h-3.5 w-3.5" />规则缺口</div>
                  <p className="text-[12.5px] leading-relaxed text-default-600">{d.gap}</p>
                </div>
              )}
              {d?.rec && (
                <div className="rounded-xl border border-divider bg-default-50 p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-foreground"><Lightbulb className="h-3.5 w-3.5 text-primary" />系统建议</div>
                  <p className="text-[12.5px] leading-relaxed text-default-600">{d.rec}</p>
                </div>
              )}
            </div>
          )}

          {/* 资金路径 — 逐跳流向(按 typology 自适应,仅扇入 / 链跳类有) */}
          {d?.path && (
            <div className="card p-5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-default-400">资金路径</div>
              <p className="mb-4 text-[11.5px] leading-relaxed text-default-400">资金逐跳流向:来源 → 归集 / 混淆 → 出口。越靠右越接近出金 / 失联,节点颜色越深风险越高。</p>
              <div className="flex items-start gap-1 overflow-x-auto no-scrollbar pb-1">
                {d.path.map((n, i) => {
                  const RIcon = ROLE_ICON[n.role] || Coins;
                  const last = i === d.path!.length - 1;
                  const nextTone = last ? n.tone : d.path![i + 1].tone;
                  return (
                    <div key={i} className="flex items-start">
                      <div className="flex w-[108px] shrink-0 flex-col items-center text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-[1.5px]" style={{ borderColor: tc(n.tone), background: tbg(n.tone), color: tc(n.tone) }}><RIcon className="h-5 w-5" /></span>
                        <span className="mt-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: tbg(n.tone), color: tc(n.tone) }}>{n.role}</span>
                        <span className="mt-1 text-[12px] font-semibold leading-tight">{n.label}</span>
                        {n.meta && <span className="mt-0.5 text-[10.5px] leading-tight text-default-400">{n.meta}</span>}
                      </div>
                      {!last && (
                        <div className="flex h-11 w-9 shrink-0 items-center justify-center gap-0.5">
                          <span className="h-[2px] flex-1 rounded-full" style={{ background: tc(nextTone), opacity: 0.45 }} />
                          <ArrowRight className="h-4 w-4 shrink-0" style={{ color: tc(nextTone) }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 关联命中 · 跨维度(同主体 / 网络)—— 一键并案,减少人工 */}
          {related.length > 0 && (
            <div className="card border-l-[3px] p-5" style={{ borderLeftColor: "var(--brand)" }}>
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-default-400"><Link2 className="h-3.5 w-3.5" />关联命中 · 跨维度</div>
              <p className="mb-3 text-[11.5px] leading-relaxed text-default-400">同一主体 / 网络在<b className="text-default-600">其它维度也被命中</b> —— 同笔钱被不同镜头各看一遍。建议<b className="text-default-600">合并调查与报送</b>,避免重复立案、重复 STR。</p>
              <div className="mb-3 flex flex-col gap-2">
                {related.map((r) => { const RDI = FDIM[r.dim].icon; const rst = findingStore.statusOf(r.id, r.status) as FState; return (
                  <button key={r.id} onClick={() => nav(`/finding?id=${r.id}`)} className="flex items-center gap-2.5 rounded-xl border border-divider p-2.5 text-left transition-colors hover:bg-default-50">
                    <Pill tone={FDIM[r.dim].tone} dot={false} icon={<RDI className="h-3 w-3" />}>{FDIM[r.dim].label}</Pill>
                    <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold">{r.pattern} · {r.subject}</div><div className="text-[11px] text-default-400">{r.id} · {FSTATES[rst].label} · {r.amount}</div></div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-default-300" />
                  </button>
                ); })}
              </div>
              <Button size="sm" color="primary" startContent={<FolderPlus className="h-4 w-4" />} onPress={consolidate}>一并转入同一案件(共 {related.length + 1} 条)</Button>
              <p className="mt-2 text-[11px] leading-relaxed text-default-400">一键并案:本命中 + 关联命中合为一个案件,**涉案主体自动并集**,在案件管理统一调查、一份 STR 报送。</p>
            </div>
          )}

          {/* 对手集中度分布 — 占比条(替代逐笔表格,集中度类) */}
          {d?.dist?.length ? (
            <div className="card p-5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-default-400">{d.distLabel || "对手分布"}</div>
              <p className="mb-3 text-[11.5px] leading-relaxed text-default-400">按金额占比看对手集中度 —— 单一对手占比越高越异常(本例 80% 流向同一高风险辖区交易所)。</p>
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {d.dist.map((s, i) => <div key={i} style={{ width: `${s.pct}%`, background: tc(s.tone) }} title={`${s.label} · ${s.pct}%`} />)}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {d.dist.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[12.5px]">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tc(s.tone) }} />{s.label}</span>
                    <span className="font-semibold tnum"><span style={{ color: tc(s.tone) }}>{s.pct}%</span> · {s.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 涉及交易明细 */}
          {d?.txList.length ? (
            <div className="card overflow-hidden p-0">
              {(() => { const perOrder = d.txList.some((tx) => tx.id); return (
                <div className="border-b border-divider p-4 text-[13px] font-bold">{perOrder ? `涉及交易明细 · 共 ${f.txns} 笔(逐笔样本 ${d.txList.length})` : `资金流构成 · 共 ${f.txns} 笔`}<span className="ml-2 text-[11px] font-normal text-default-400">{perOrder ? "逐笔订单 / 哈希" : "按环节汇总,非逐笔"}</span></div>
              ); })()}
              <table className="w-full text-[12.5px]">
                <thead><tr className="border-b border-divider text-[11.5px] text-default-400"><th className="px-4 py-2 text-left font-medium">交易ID / 哈希</th><th className="px-4 py-2 text-left font-medium">时间</th><th className="px-4 py-2 text-left font-medium">对手</th><th className="px-4 py-2 text-right font-medium">金额</th><th className="px-4 py-2 text-left font-medium">说明</th></tr></thead>
                <tbody>
                  {d.txList.map((tx, i) => (
                    <tr key={i} className="border-b border-default-100 last:border-0">
                      <td className="px-4 py-2.5 whitespace-nowrap">{tx.id ? <span className="font-semibold tnum">{tx.id}</span> : <span className="text-default-400">多笔汇总</span>}</td>
                      <td className="px-4 py-2.5 tnum text-default-500 whitespace-nowrap">{tx.t}</td>
                      <td className="px-4 py-2.5 font-medium">{tx.party}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tnum">{tx.amount}</td>
                      <td className="px-4 py-2.5 text-default-500">{tx.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!d.txList.some((tx) => tx.id) && <p className="border-t border-divider px-4 py-2.5 text-[11px] leading-relaxed text-default-400">各环节为<b className="text-default-500">同一资金在不同阶段</b>的流转量(汇入 → 过账 → 分发),非逐笔加总;完整逐跳见上方「资金路径」。</p>}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          {/* 主体画像 — 按检测维度自适应(商户 / 地址 / 网络) */}
          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-default-400">{FDIM[f.dim].profileTitle}</span>
              <Pill tone={FDIM[f.dim].tone} dot={false} icon={(() => { const DI = FDIM[f.dim].icon; return <DI className="h-3 w-3" />; })()}>{FDIM[f.dim].label}</Pill>
            </div>
            <div className="text-[14px] font-bold">{f.subject}</div>
            <div className="mb-2 text-[12px] text-default-400">{f.sub}</div>
            {d?.profile?.tags?.length ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {d.profile.tags.map((tg) => <span key={tg} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: tg === "高风险" || tg.includes("黑名单") ? "var(--danger-bg)" : "var(--chip-bg)", color: tg === "高风险" || tg.includes("黑名单") ? "var(--danger)" : "var(--chip-fg)" }}>{tg}</span>)}
              </div>
            ) : null}
            {d?.profile && <>
              <Kv label="注册地 / 辖区">{d.profile.country}</Kv>
              <Kv label="KYC / KYB">{d.profile.kyc}</Kv>
              <Kv label="注册时长">{d.profile.registered}</Kv>
              <Kv label="历史">{d.profile.history}</Kv>
            </>}
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
      {/* 追溯处置抽屉(资金已出账;止损 / 追回 / 评估 / 回填,即时生效)*/}
      <TraceDrawer findingId={f.id} open={traceOpen} onOpenChange={setTraceOpen} onReview={() => setRev(true)} />
    </Shell>
  );
}
