// 共享图表组件:风控仪表盘与运营总览同源复用。
// LineChart — 通用折线(面积底纹 + hover 游标 tooltip);AnalystLoad — 分析师工作量柱图(Top-N + 溢出 + 悬浮卡)。
import { useState } from "react";
import { toast } from "sonner";
import { Initials } from "@/components/bits";

export function LineChart({ series, labels, valueFmt }: { series: { data: number[]; color: string; name?: string }[]; labels?: string[]; valueFmt?: (n: number) => string }) {
  const W = 320, H = 124, padT = 8, padB = 16;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all), min = Math.min(...all), rng = max - min || 1;
  const n = series[0].data.length;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => padT + (1 - (v - min) / rng) * (H - padT - padB);
  const yPct = (v: number) => (y(v) / H) * 100;
  const xPct = (i: number) => (i / (n - 1)) * 100;
  const fmt = valueFmt ?? ((v: number) => `${v}`);
  const grid = [0, 0.5, 1];
  const [hi, setHi] = useState<number | null>(null);
  return (
    <div className="relative w-full" style={{ height: H }}
      onMouseLeave={() => setHi(null)}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const f = (e.clientX - r.left) / r.width; setHi(Math.max(0, Math.min(n - 1, Math.round(f * (n - 1))))); }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
        {grid.map((g) => { const gy = padT + g * (H - padT - padB); return <line key={g} x1={0} x2={W} y1={gy} y2={gy} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />; })}
        {series.map((s, si) => {
          const line = s.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          const li = s.data.length - 1;
          return (
            <g key={si}>
              {si === 0 && <polygon points={`0,${H - padB} ${line} ${W},${H - padB}`} fill={s.color} opacity={0.07} />}
              <polyline points={line} fill="none" stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <circle cx={x(li)} cy={y(s.data[li])} r={2.6} fill={s.color} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
      {hi !== null && (
        <>
          <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-default-300" style={{ left: `${xPct(hi)}%` }} />
          {series.map((s, si) => (
            <div key={si} className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-content1" style={{ left: `${xPct(hi)}%`, top: `${yPct(s.data[hi])}%`, background: s.color }} />
          ))}
          <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-divider bg-content1 px-2 py-1 shadow-soft" style={{ left: `${Math.min(82, Math.max(18, xPct(hi)))}%` }}>
            {labels && <div className="mb-0.5 text-[10px] font-semibold text-default-500">{labels[hi]}</div>}
            {series.map((s, si) => (
              <div key={si} className="flex items-center gap-1.5 whitespace-nowrap text-[10.5px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.name && <span className="text-default-400">{s.name}</span>}
                <span className="font-bold tnum">{fmt(s.data[hi])}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// analyst caseload vs capacity — vertical columns, top-N + overflow, hover popover for detail
export function AnalystLoad({ analysts }: { analysts: { p: { i: string; n: string; c: string }; open: number; cap: number }[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const sorted = [...analysts].sort((a, b) => b.open - a.open);
  const cap = analysts[0].cap;
  const N = sorted.length;
  const avg = Math.round(sorted.reduce((s, a) => s + a.open, 0) / N);
  const overCnt = sorted.filter((a) => a.open > a.cap).length;
  const TOP = 6;
  const top = sorted.slice(0, TOP);
  const rest = sorted.slice(TOP);
  const restAvg = rest.length ? Math.round(rest.reduce((s, a) => s + a.open, 0) / rest.length) : 0;
  const scaleMax = Math.max(...sorted.map((a) => a.open), cap) * 1.15;
  const cols = top.length + (rest.length ? 1 : 0);
  const expand = () => toast(`展开团队负荷 · 全部 ${N} 人`);
  const tip = hi === null ? null
    : hi < top.length
      ? (() => { const a = top[hi]; const d = a.open - cap; return { left: ((hi + 0.5) / cols) * 100, over: d > 0, lines: [a.p.n, `手头 ${a.open} 件`, d > 0 ? `超出上限 ${d} 件 · 需分流` : `还能接 ${-d} 件`] }; })()
      : { left: ((top.length + 0.5) / cols) * 100, over: false, lines: [`其余 ${rest.length} 人`, `人均手头 ${restAvg} 件`] };
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-default-400">分析师工作量</span>
        <span className="text-[11px] text-default-400">团队 {N} 人 · 人均手头 {avg} 件 · <span style={{ color: "var(--danger)", fontWeight: 600 }}>{overCnt} 人忙不过来</span></span>
      </div>
      <div className="relative flex h-[104px] items-end gap-2">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-default-300" style={{ bottom: `${(cap / scaleMax) * 100}%` }}>
          <span className="absolute -top-3.5 right-0 rounded bg-default-100 px-1 text-[9px] font-semibold text-default-500">正常上限 {cap}</span>
        </div>
        {top.map((a, i) => {
          const isOver = a.open > a.cap;
          const over = Math.max(0, a.open - a.cap), base = Math.min(a.open, a.cap);
          return (
            <div key={a.p.n} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className="flex h-full flex-1 flex-col justify-end">
              <span className="mb-1 text-center text-[10px] font-bold tnum" style={isOver ? { color: "var(--danger)" } : undefined}>{a.open}</span>
              {over > 0 && <div className="w-full rounded-t-[3px]" style={{ height: `${(over / scaleMax) * 100}%`, background: "var(--danger)" }} />}
              <div className={over > 0 ? "w-full" : "w-full rounded-t-[3px]"} style={{ height: `${(base / scaleMax) * 100}%`, background: isOver ? "color-mix(in srgb, var(--danger) 35%, var(--track))" : "var(--brand)" }} />
            </div>
          );
        })}
        {rest.length > 0 && (
          <button onMouseEnter={() => setHi(top.length)} onMouseLeave={() => setHi(null)} onClick={expand} className="flex h-full flex-1 flex-col justify-end">
            <span className="mb-1 text-center text-[10px] font-semibold tnum text-default-400">{restAvg}</span>
            <div className="w-full rounded-t-[3px] bg-default-200" style={{ height: `${(restAvg / scaleMax) * 100}%` }} />
          </button>
        )}
        {tip && (
          <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-divider bg-content1 px-2 py-1 shadow-soft" style={{ left: `${Math.min(82, Math.max(18, tip.left))}%` }}>
            {tip.lines.map((l, i) => <div key={i} className={`whitespace-nowrap text-[10.5px] ${i === 0 ? "font-bold" : "text-default-500"}`} style={i > 0 && tip.over ? { color: "var(--danger)" } : undefined}>{l}</div>)}
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        {top.map((a) => (
          <div key={a.p.n} className="flex flex-1 flex-col items-center gap-1">
            <Initials p={a.p} size={20} />
            <span className="w-full truncate text-center text-[9.5px] text-default-400">{a.p.n.split(" ")[0]}</span>
          </div>
        ))}
        {rest.length > 0 && (
          <button onClick={expand} className="flex flex-1 flex-col items-center gap-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-default-100 text-[9px] font-bold text-default-500">+{rest.length}</span>
            <span className="text-[9.5px] text-default-400">其余</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-default-400">柱子越高 = 手头任务越多;虚线是正常上限,<b style={{ color: "var(--danger)" }}>冒红 = 忙不过来</b>,该把任务分给有余力的人。</p>
    </>
  );
}
