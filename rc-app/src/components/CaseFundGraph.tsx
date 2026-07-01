import { GKIND, type CaseGraph, type GNodeKind } from "@/lib/cases";
import { toneColor, type Tone } from "@/lib/data";
import { Shuffle, UserRound, GitMerge, Landmark, ArrowUpRight, Check, Coins } from "lucide-react";

// 节点图标 —— 与全站 lucide 图标语言一致(替代 emoji),与事后监控资金路径同源
const ICON: Record<GNodeKind, typeof Coins> = { mixer: Shuffle, mule: UserRound, hub: GitMerge, platform: Landmark, exit: ArrowUpRight, normal: Check };
const tc = toneColor; // 见 lib/data toneColor(单一来源)
const tbg = (t: Tone) => (t === "red" ? "var(--danger-bg)" : t === "amber" ? "var(--warning-bg)" : t === "green" ? "var(--success-bg)" : t === "blue" ? "var(--brand-soft)" : "var(--chip-bg)");

const W = 980, H = 468, PADX = 76, TOP = 78, BOT = H - 46, R = 19;

export function CaseFundGraph({ graph }: { graph: CaseGraph }) {
  const ncol = graph.cols.length;
  const colX = (c: number) => PADX + (c * (W - 2 * PADX)) / (ncol - 1);
  const byCol: Record<number, typeof graph.nodes> = {};
  graph.nodes.forEach((n) => { (byCol[n.col] ||= []).push(n); });
  const pos: Record<string, { x: number; y: number }> = {};
  Object.entries(byCol).forEach(([col, nodes]) => { const c = Number(col); nodes.forEach((n, i) => { pos[n.id] = { x: colX(c), y: TOP + ((BOT - TOP) * (i + 1)) / (nodes.length + 1) }; }); });
  const toneOf = (id: string) => GKIND[graph.nodes.find((n) => n.id === id)!.kind].tone;
  const dividerX = (colX(graph.dividerAfter) + colX(graph.dividerAfter + 1)) / 2;
  const kinds = Array.from(new Set(graph.nodes.map((n) => n.kind)));

  return (
    <div>
      {/* 图例(lucide 芯片,与节点一致) */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {kinds.map((k) => { const I = ICON[k]; return (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-default-500">
            <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: tbg(GKIND[k].tone), color: tc(GKIND[k].tone) }}><I className="h-2.5 w-2.5" /></span>{GKIND[k].label}
          </span>
        ); })}
      </div>

      <div className="overflow-x-auto no-scrollbar rounded-xl border border-divider bg-default-50">
        <div className="relative" style={{ width: W, height: H, minWidth: 760 }}>
          {/* 列标题 */}
          {graph.cols.map((c, i) => <div key={i} className="absolute text-center text-[11px] font-bold text-default-500" style={{ left: colX(i) - 56, width: 112, top: 16 }}>{c}</div>)}

          {/* 连线层(SVG) */}
          <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <line x1={dividerX} y1={40} x2={dividerX} y2={H - 34} stroke="var(--brand)" strokeWidth={1.2} strokeDasharray="5 4" opacity={0.45} />
            {graph.edges.map((e, i) => {
              const a = pos[e.from], b = pos[e.to]; if (!a || !b) return null;
              const dx = (b.x - a.x) / 2; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const tone = toneOf(e.from);
              return (
                <g key={i}>
                  <path d={`M ${a.x + R} ${a.y} C ${a.x + R + dx} ${a.y}, ${b.x - R - dx} ${b.y}, ${b.x - R} ${b.y}`} fill="none" stroke={tc(tone)} strokeWidth={e.w ? 2 : 1.1} opacity={0.38} />
                  {e.w && <text x={mx} y={my - 3} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: tc(tone) }}>{e.w}</text>}
                </g>
              );
            })}
          </svg>

          {/* 跨境分界标签 */}
          <div className="absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[9.5px] font-bold text-[var(--brand)]" style={{ left: dividerX, top: 40 }}>链上 · 法币跨境点</div>

          {/* 节点(HTML 芯片 · lucide 图标) */}
          {graph.nodes.map((n) => {
            const p = pos[n.id]; const I = ICON[n.kind]; const tone = GKIND[n.kind].tone;
            return (
              <div key={n.id} className="absolute" style={{ left: p.x, top: p.y, transform: "translate(-50%,-50%)" }}>
                <span className="flex items-center justify-center rounded-full border-[1.5px]" style={{ width: 2 * R, height: 2 * R, borderColor: tc(tone), background: tbg(tone), color: tc(tone) }}><I className="h-[18px] w-[18px]" /></span>
                <div className="absolute left-1/2 top-[108%] w-24 -translate-x-1/2 text-center">
                  <div className="text-[10px] font-bold leading-tight text-default-700">{n.label}</div>
                  {n.sub && <div className="text-[9px] leading-tight text-default-400">{n.sub}</div>}
                </div>
              </div>
            );
          })}

          {/* 世界标签(可按资金方向配置,默认 链上→法币) */}
          <div className="absolute bottom-2.5 text-center text-[10px] text-default-400" style={{ left: (PADX + dividerX) / 2 - 90, width: 180 }}>{graph.leftWorld || "链上世界 · Chainalysis KYT"}</div>
          <div className="absolute bottom-2.5 text-center text-[10px] text-default-400" style={{ left: (dividerX + W - PADX) / 2 - 90, width: 180 }}>{graph.rightWorld || "法币世界 · 自有数据"}</div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {graph.stats.map((s) => <div key={s.label} className="rounded-xl border border-divider p-2.5"><div className="text-[10.5px] text-default-400">{s.label}</div><div className="mt-0.5 text-[13px] font-extrabold tnum">{s.value}</div></div>)}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-default-400">分层有向图:资金自左向右 源头 → 分散(mule)→ 多跳中转 → 归集 → 平台 → 出口。左侧链上世界(地址 / 混币器 / 归集)来自 Chainalysis KYT,<b className="text-default-500">跨境点</b>后进入法币世界(平台入金 / 出口)为自有数据。连线粗细 / 标注表示资金量。</p>
    </div>
  );
}
