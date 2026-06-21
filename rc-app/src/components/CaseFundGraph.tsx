import { GKIND, type CaseGraph } from "@/lib/cases";
import type { Tone } from "@/lib/data";

const tc = (t: Tone) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : t === "green" ? "var(--success)" : t === "violet" ? "var(--violet)" : t === "blue" ? "var(--brand)" : "var(--text-3)");
const tbg = (t: Tone) => (t === "red" ? "var(--danger-bg)" : t === "amber" ? "var(--warning-bg)" : t === "green" ? "var(--success-bg)" : t === "blue" ? "var(--brand-soft)" : "var(--chip-bg)");

const W = 980, H = 430, PADX = 78, TOP = 56, BOT = H - 28;

export function CaseFundGraph({ graph }: { graph: CaseGraph }) {
  const ncol = graph.cols.length;
  const colX = (c: number) => PADX + (c * (W - 2 * PADX)) / (ncol - 1);
  // 每列节点纵向均布
  const byCol: Record<number, typeof graph.nodes> = {};
  graph.nodes.forEach((n) => { (byCol[n.col] ||= []).push(n); });
  const pos: Record<string, { x: number; y: number; tone: Tone }> = {};
  Object.entries(byCol).forEach(([col, nodes]) => {
    const c = Number(col);
    nodes.forEach((n, i) => { pos[n.id] = { x: colX(c), y: TOP + ((BOT - TOP) * (i + 1)) / (nodes.length + 1), tone: GKIND[n.kind].tone }; });
  });
  const dividerX = (colX(graph.dividerAfter) + colX(graph.dividerAfter + 1)) / 2;
  // 图例:只列出现的种类
  const kinds = Array.from(new Set(graph.nodes.map((n) => n.kind)));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {kinds.map((k) => <span key={k} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-default-500"><span className="h-2.5 w-2.5 rounded-full" style={{ background: tc(GKIND[k].tone) }} />{GKIND[k].label}</span>)}
      </div>
      <div className="overflow-x-auto no-scrollbar rounded-xl border border-divider bg-default-50">
        <svg viewBox={`0 0 ${W} ${H}`} className="block" style={{ minWidth: 760, width: "100%", height: "auto" }}>
          {/* 链上 / 法币 跨境分界 */}
          <line x1={dividerX} y1={34} x2={dividerX} y2={H - 22} stroke="var(--brand)" strokeWidth={1.2} strokeDasharray="5 4" opacity={0.5} />
          <text x={dividerX} y={26} textAnchor="middle" className="fill-[var(--brand)]" style={{ fontSize: 10, fontWeight: 700 }}>链上 · 法币跨境点</text>
          <text x={(PADX + dividerX) / 2} y={H - 8} textAnchor="middle" style={{ fontSize: 10, fill: "var(--text-3)" }}>链上世界 · Chainalysis KYT</text>
          <text x={(dividerX + W - PADX) / 2} y={H - 8} textAnchor="middle" style={{ fontSize: 10, fill: "var(--text-3)" }}>法币世界 · 自有数据</text>

          {/* 列标题 */}
          {graph.cols.map((c, i) => <text key={i} x={colX(i)} y={44} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text-2)" }}>{c}</text>)}

          {/* 连线 */}
          {graph.edges.map((e, i) => {
            const a = pos[e.from], b = pos[e.to];
            if (!a || !b) return null;
            const dx = (b.x - a.x) / 2;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            return (
              <g key={i}>
                <path d={`M ${a.x + 18} ${a.y} C ${a.x + 18 + dx} ${a.y}, ${b.x - 18 - dx} ${b.y}, ${b.x - 18} ${b.y}`} fill="none" stroke={tc(a.tone)} strokeWidth={e.w ? 1.8 : 1.1} opacity={0.4} />
                {e.w && <text x={mx} y={my - 3} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: tc(a.tone) }}>{e.w}</text>}
              </g>
            );
          })}

          {/* 节点 */}
          {graph.nodes.map((n) => {
            const p = pos[n.id];
            return (
              <g key={n.id}>
                <circle cx={p.x} cy={p.y} r={17} fill={tbg(p.tone)} stroke={tc(p.tone)} strokeWidth={1.6} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" style={{ fontSize: 13 }}>{GKIND[n.kind].glyph}</text>
                <text x={p.x} y={p.y + 31} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: "var(--text-1)" }}>{n.label}</text>
                {n.sub && <text x={p.x} y={p.y + 42} textAnchor="middle" style={{ fontSize: 8.5, fill: "var(--text-3)" }}>{n.sub}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      {/* 统计信息 */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {graph.stats.map((s) => <div key={s.label} className="rounded-xl border border-divider p-2.5"><div className="text-[10.5px] text-default-400">{s.label}</div><div className="mt-0.5 text-[13px] font-extrabold tnum">{s.value}</div></div>)}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-default-400">分层有向图:节点按路径自左向右分布。左侧链上世界(地址 / 混币器 / 归集)数据来自 Chainalysis KYT;<b className="text-default-500">跨境点</b>之后进入法币世界(平台入金 / 出口),为自有数据。连线粗细 / 标注表示资金量。</p>
    </div>
  );
}
