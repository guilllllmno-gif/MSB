import { useState } from "react";
import { toast } from "sonner";
import { ScanLine, Download, ChevronDown, ShieldCheck, ShieldAlert, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Pill, SectionLabel } from "./bits";
import { toneVar } from "@/lib/data";
import { useKytVersion } from "@/lib/store";
import { CAT_META, VERDICT_META, scoreLevel, policyVerdict, catRiskTone, catRank, riskFindings, scanHistory, shortAddr, type AddrRisk } from "@/lib/onchain";

// 供应商链上情报的就地展示卡 —— 详情页 / 抽屉 / 控制台共用同一个,避免各画一套。
// 「情报」来自供应商;「本系统处置」由风险策略推导(见 policyVerdict)。
export function OnChainRiskCard({ addr, targetLabel }: { addr: AddrRisk; targetLabel?: string }) {
  const policy = useKytVersion();
  const [histOpen, setHistOpen] = useState(false);
  const lv = scoreLevel(addr.score);
  const { verdict, reason } = policyVerdict(addr, policy);
  const v = VERDICT_META[verdict];
  const exps = [...addr.exposures].sort((a, b) => catRank(a.cat) - catRank(b.cat) || b.pct - a.pct);
  const total = exps.reduce((s, e) => s + e.pct, 0) || 100;
  const findings = riskFindings(addr);
  const hist = scanHistory(addr);

  // 环形仪表
  const R = 34, C = 2 * Math.PI * R, off = C * (1 - addr.score / 100);

  return (
    <div className="card p-0">
      {/* 头部 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-divider px-4 py-3">
        <ScanLine className="h-4 w-4 text-default-400" />
        <span className="text-[14px] font-bold">链上风险扫描</span>
        <span className="text-[12px] text-default-400">· 扫描对象 <span className="font-semibold text-default-600">{targetLabel ?? shortAddr(addr.address)}</span></span>
        <Pill tone="grey" dot={false}>{addr.chain}</Pill>
        <div className="ml-auto flex items-center gap-3 text-[12px] text-default-400">
          <span>最近扫描 {addr.lastScreened}</span>
          <button onClick={() => toast.success("已下载供应商链上风险报告 (PDF)")} className="inline-flex items-center gap-1 font-semibold text-brand hover:opacity-80"><Download className="h-3.5 w-3.5" />下载报告</button>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 md:flex-row">
        {/* 左:分数环 + 本系统处置 */}
        <div className="flex shrink-0 flex-row items-center gap-4 md:w-[190px] md:flex-col md:items-start">
          <div className="relative h-[92px] w-[92px] shrink-0">
            <svg width="92" height="92" viewBox="0 0 92 92">
              <circle cx="46" cy="46" r={R} fill="none" stroke="var(--default-100)" strokeWidth="7" />
              <circle cx="46" cy="46" r={R} fill="none" stroke={toneVar(lv.tone)} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 46 46)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[24px] font-extrabold leading-none tnum" style={{ color: toneVar(lv.tone) }}>{addr.score}</span>
              <span className="text-[10px] text-default-400">/100</span>
            </div>
          </div>
          <div className="md:w-full">
            <div className="text-[13px] font-bold" style={{ color: toneVar(lv.tone) }}>{lv.label}</div>
            {/* 本系统处置 —— "买情报、建策略"里建的那半 */}
            <div className="mt-2 rounded-lg border p-2" style={{ borderColor: `color-mix(in srgb, ${toneVar(v.tone)} 30%, transparent)`, background: `color-mix(in srgb, ${toneVar(v.tone)} 6%, transparent)` }}>
              <div className="flex items-center gap-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-default-400">本系统处置</span></div>
              <div className="mt-1"><Pill tone={v.tone}>{v.label}</Pill></div>
              <div className="mt-1 text-[11px] text-default-500">{reason}</div>
            </div>
          </div>
        </div>

        {/* 右:暴露分析 + 命中要点 */}
        <div className="min-w-0 flex-1">
          <SectionLabel>暴露分析<span className="ml-1 font-normal normal-case text-default-400">· 情报源:KYT 供应商</span></SectionLabel>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-default-100">
            {exps.map((e, i) => (
              <div key={i} title={`${CAT_META[e.cat].label} ${e.pct}% · ${e.direction === "in" ? "流入" : "流出"} · ${e.hops} 跳`}
                style={{ width: `${(e.pct / total) * 100}%`, background: toneVar(catRiskTone(e.cat)), opacity: catRank(e.cat) === 2 ? 0.35 + 0.5 / (i + 1) : 1 }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
            {exps.map((e, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11.5px] text-default-500">
                <span className="h-2 w-2 rounded-full" style={{ background: toneVar(catRiskTone(e.cat)), opacity: catRank(e.cat) === 2 ? 0.35 + 0.5 / (i + 1) : 1 }} />
                {CAT_META[e.cat].label} <b className="tnum text-default-600">{e.pct}%</b>
              </span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {findings.map((f, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-divider bg-default-50 px-2.5 py-2">
                {f.ok ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: toneVar("green") }} /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: toneVar(f.tone) }} />}
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold">{f.text}</div>
                  <div className="text-[11px] text-default-500">{f.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 扫描历史 —— 带当时分数 + 趋势 */}
      <div className="border-t border-divider px-4 py-2.5">
        <button onClick={() => setHistOpen((o) => !o)} className="flex w-full items-center gap-1.5 text-left text-[12.5px] font-semibold text-default-600">
          扫描历史记录 <span className="text-default-400">({hist.length})</span>
          <ChevronDown className={`h-4 w-4 text-default-400 transition-transform ${histOpen ? "" : "-rotate-90"}`} />
        </button>
        {histOpen && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {hist.map((r, i) => {
              const prev = i > 0 ? hist[i - 1].score : r.score;
              const d = r.score - prev;
              const Tr = d > 0 ? ArrowUp : d < 0 ? ArrowDown : Minus;
              const trTone = d > 0 ? "var(--danger)" : d < 0 ? "var(--success)" : "var(--text-3)";
              const rl = scoreLevel(r.score);
              return (
                <div key={i} className="inline-flex items-center gap-2 rounded-lg border border-divider px-2.5 py-1.5 text-[12px]">
                  <span className="text-default-500">{r.date}</span>
                  <span className="tnum font-bold" style={{ color: toneVar(rl.tone) }}>{r.score}</span>
                  {i > 0 && <span className="inline-flex items-center" style={{ color: trTone }}><Tr className="h-3 w-3" /></span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
