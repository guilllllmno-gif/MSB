import { useNavigate } from "react-router-dom";
import { ArrowRight, Activity } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { SectionLabel, Initials } from "@/components/bits";
import { LineChart, AnalystLoad } from "@/components/charts";
import { QUEUE, queueHealth, DAYS14 } from "@/lib/opsMetrics";

const BRAND = "var(--brand)";
const toneC = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : "var(--success)");

export default function OpsOverview() {
  const nav = useNavigate();
  const h = queueHealth();
  const net = h.net; // >0 ⇒ backlog shrinking
  const agingTotal = QUEUE.aging.reduce((s, a) => s + a.n, 0);
  // true burn-down: remaining backlog per day, back-computed from today's open so it reconciles
  const backlog = (() => {
    const { newD, clearedD } = QUEUE.trend; const days = newD.length; const b = new Array(days);
    b[days - 1] = QUEUE.open;
    for (let i = days - 2; i >= 0; i--) b[i] = b[i + 1] - (newD[i + 1] - clearedD[i + 1]);
    return b;
  })();
  const peak = Math.max(...backlog);
  const slaTone = QUEUE.sla >= 95 ? "green" : QUEUE.sla >= 90 ? "amber" : "red";
  const vitals = [
    { k: "待处理积压", v: `${QUEUE.open}`, sub: `今日净 ${net > 0 ? "−" : "+"}${Math.abs(net)} · ${net > 0 ? "队列在消" : "队列在涨"}`, subTone: net > 0 ? "green" : "red" },
    { k: "SLA 达成率", v: `${QUEUE.sla}%`, sub: `较昨日 ${QUEUE.slaDelta}`, subTone: slaTone },
    { k: "平均处理时长", v: QUEUE.mttr, sub: `MTTR · ${QUEUE.mttrDelta}`, subTone: "green" },
    { k: "超 SLA 待处理", v: `${h.overSla} 件`, sub: "需优先清理", subTone: h.overSla > 0 ? "red" : "green" },
  ];
  // full roster, sorted by load — beyond the chart's top-6, this is the complete picture
  const roster = [...QUEUE.analysts].sort((a, b) => b.open - a.open);
  const cap = QUEUE.analysts[0].cap;
  const rosterMax = Math.max(...roster.map((a) => a.open), cap);
  // donut segment offsets — cumulative sums precomputed without mutation
  const DC = 2 * Math.PI * 50;
  const agingFrac = QUEUE.aging.map((a) => a.n / agingTotal);
  const agingOff = agingFrac.map((_, i) => -agingFrac.slice(0, i).reduce((s, f) => s + f, 0) * DC);

  return (
    <Shell crumb={["监控运营", "运营总览"]} wide>
      <PageHead
        title="告警运营总览"
        sub="告警队列的健康脉搏 —— 积压余量、停留时长、燃尽趋势与团队负荷,一屏看清今天队列是在消还是在涨、谁忙不过来、哪些件已超时。"
        actions={
          <button onClick={() => nav("/alerts")} className="inline-flex items-center gap-1 rounded-full bg-default-100 px-4 py-2 text-[13px] font-semibold text-default-600 hover:bg-default-200">
            去告警队列 <ArrowRight className="h-3.5 w-3.5" />
          </button>
        }
      />

      {/* 队列健康判定条 */}
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100 text-default-500"><Activity className="h-4 w-4" /></span>
          <div>
            <div className="flex items-center gap-2 text-[14px] font-bold">
              当前队列状态
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: `color-mix(in srgb, ${toneC(h.status.tone)} 14%, transparent)`, color: toneC(h.status.tone) }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneC(h.status.tone) }} />{h.status.label}
              </span>
            </div>
            <div className="text-[12px] text-default-400">{h.teamN} 名分析师 · {h.teamOver} 人超负荷 · {h.overSla} 件已超 SLA</div>
          </div>
        </div>
      </div>

      {/* vitals — the at-a-glance health read */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {vitals.map((m) => (
          <div key={m.k} className="card p-4">
            <div className="text-[11.5px] text-default-500">{m.k}</div>
            <div className="mt-1 text-[26px] font-extrabold leading-none tnum">{m.v}</div>
            <div className="mt-1.5 text-[11.5px] font-semibold" style={{ color: toneC(m.subTone) }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* burn-down trend — daily inflow vs outflow over 14 days */}
        <div className="card p-5 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>燃尽趋势 · 积压余量(近 14 日)</SectionLabel>
            <span className="text-[11px] text-default-400">峰值 <b className="text-foreground tnum">{peak}</b> → 现 <b className="text-foreground tnum">{QUEUE.open}</b> · 已燃尽 <b className="tnum" style={{ color: "var(--success)" }}>−{peak - QUEUE.open}</b></span>
          </div>
          <div className="mt-2"><LineChart series={[{ data: backlog, color: BRAND, name: "积压余量" }]} labels={DAYS14} /></div>
          <p className="mt-1.5 text-[10.5px] leading-snug text-default-400">线往下 = 积压在被消化(好);往上 = 越积越多。</p>
        </div>
        {/* aging — donut by time-in-queue (brand ramp, 超SLA red) */}
        <div className="card p-5 lg:col-span-5">
          <SectionLabel>停留时长分布</SectionLabel>
          <div className="flex items-center gap-4">
            <div className="relative h-[110px] w-[110px] shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                {QUEUE.aging.map((a, i) => (
                  <circle key={a.k} cx={60} cy={60} r={50} fill="none" strokeWidth={16}
                    stroke={a.over ? "var(--danger)" : `color-mix(in srgb, var(--brand) ${32 + i * 22}%, var(--track))`}
                    strokeDasharray={`${agingFrac[i] * DC} ${DC}`} strokeDashoffset={agingOff[i]}><title>{`${a.k} · ${a.n} 笔 · ${(agingFrac[i] * 100).toFixed(1)}%`}</title></circle>
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[20px] font-extrabold leading-none tnum">{agingTotal}</span>
                <span className="text-[9px] text-default-400">积压</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {QUEUE.aging.map((a, i) => (
                <div key={a.k} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.over ? "var(--danger)" : `color-mix(in srgb, var(--brand) ${32 + i * 22}%, var(--track))` }} />
                  <span className="flex-1" style={a.over ? { color: "var(--danger)", fontWeight: 600 } : undefined}>{a.k}</span>
                  <span className="font-bold tnum">{a.n}</span>
                  <span className="w-10 text-right text-[11px] text-default-400 tnum">{((a.n / agingTotal) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[10.5px] leading-snug text-default-400">按等待时长把积压分段,<b style={{ color: "var(--danger)" }}>红色 = 已超时</b>,占比越大越糟。</p>
        </div>
      </div>

      {/* analyst load — chart + full roster table */}
      <div className="card mb-5 p-5">
        <AnalystLoad analysts={QUEUE.analysts} />
        <div className="mt-5 border-t border-divider pt-4">
          <SectionLabel>全员负荷明细 · {roster.length} 人</SectionLabel>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-default-400">
                  <th className="pb-2 font-medium">分析师</th>
                  <th className="pb-2 font-medium">手头</th>
                  <th className="pb-2 font-medium">上限</th>
                  <th className="w-[42%] pb-2 font-medium">利用率</th>
                  <th className="pb-2 text-right font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((a) => {
                  const util = a.open / a.cap;
                  const over = a.open > a.cap;
                  const barTone = over ? "var(--danger)" : util >= 0.9 ? "var(--warning)" : "var(--brand)";
                  return (
                    <tr key={a.p.n} className="border-t border-divider/60">
                      <td className="py-2">
                        <div className="flex items-center gap-2"><Initials p={a.p} size={22} /><span className="font-medium">{a.p.n}</span></div>
                      </td>
                      <td className="py-2 font-bold tnum" style={over ? { color: "var(--danger)" } : undefined}>{a.open}</td>
                      <td className="py-2 text-default-400 tnum">{a.cap}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-default-100">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (a.open / rosterMax) * 100)}%`, background: barTone }} />
                          </div>
                          <span className="w-9 text-right text-[11px] font-semibold tnum" style={{ color: barTone }}>{Math.round(util * 100)}%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <span className="text-[11px] font-semibold" style={{ color: over ? "var(--danger)" : "var(--success)" }}>{over ? `超 ${a.open - a.cap} 件` : `余 ${a.cap - a.open} 件`}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
