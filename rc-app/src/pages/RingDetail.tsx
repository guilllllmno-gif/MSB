import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardHeader, CardBody, Button } from "@heroui/react";
import { ArrowLeft, FolderPlus, ListPlus, FileDown, Coins, Link2, Smartphone, Globe, Bell, Sparkles, Info } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { ringOf, DIM_META, DIM_ORDER, confTone, confLabel, type RingDim, type Ring } from "@/lib/rings";

const DIM_ICON: Record<RingDim, typeof Coins> = { funds: Coins, address: Link2, device: Smartphone, ip: Globe };
const THRESHOLD = 60;

// radial relationship graph
function Graph({ ring }: { ring: Ring }) {
  const W = 460, H = 320, cx = W / 2, cy = H / 2, r = 112;
  const n = ring.members.length;
  const pos = ring.members.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 340 }}>
      {ring.edges.map((e, i) => {
        const dim = DIM_ORDER.find((d) => e.dims.includes(d))!; // highest-weight dim present
        const p1 = pos[e.a], p2 = pos[e.b];
        return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={DIM_META[dim].color} strokeWidth={Math.max(1.5, e.strength / 16)} strokeOpacity={0.5} strokeLinecap="round" />;
      })}
      {ring.members.map((m, i) => (
        <g key={m.id}>
          <circle cx={pos[i].x} cy={pos[i].y} r={24} fill={m.c} />
          <text x={pos[i].x} y={pos[i].y} dy="0.35em" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{m.i}</text>
          <text x={pos[i].x} y={pos[i].y + 38} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--foreground, #111)">{m.name.length > 12 ? m.name.slice(0, 11) + "…" : m.name}</text>
          <text x={pos[i].x} y={pos[i].y + 52} textAnchor="middle" fontSize="9.5" fill="var(--text-3)">{m.role}</text>
        </g>
      ))}
    </svg>
  );
}

export default function RingDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const ring = ringOf(sp.get("id") || undefined);
  const tone = confTone(ring.confidence);
  const sharedCount = ring.shared.length;

  return (
    <Shell crumb={["风控", "检测策略", "团伙识别", ring.id]} wide>
      <button onClick={() => nav("/rings")} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回团伙列表</button>

      {/* top bar */}
      <Card shadow="none" className="mb-5 card"><CardBody className="py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2.5 text-[23px] font-bold tracking-tight">
              {ring.name}
              <Pill tone={ring.risk} dot={false}>{ring.typology}</Pill>
              <Pill tone={tone}>{confLabel(ring.confidence)} {ring.confidence}%</Pill>
            </h1>
            <div className="mt-2.5 text-[13px] text-default-500">
              {ring.id} · {ring.members.length} 个主体 · 关联告警 <b className="text-foreground">{ring.alertCount}</b> 条 · 涉及 <b className="text-foreground">{ring.amount}</b> · {ring.span}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Button size="sm" variant="bordered" startContent={<ListPlus className="h-4 w-4" />} onPress={() => toast.success("已批量列入加强监控名单")}>批量列名单</Button>
            <Button size="sm" variant="bordered" startContent={<FileDown className="h-4 w-4" />} onPress={() => toast.success("团伙研判报告已导出")}>导出报告</Button>
            <Button size="sm" color="primary" startContent={<FolderPlus className="h-4 w-4" />} onPress={() => toast.success(`${ring.id} 已并入调查案件`)}>并入案件</Button>
          </div>
        </div>
      </CardBody></Card>

      <div className="flex flex-col gap-5">
        {/* graph + confidence breakdown */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Card shadow="none" className="card"><CardHeader className="flex items-center justify-between"><div><div className="text-[15px] font-bold">关系图谱</div><div className="text-[12px] text-default-400">边 = 共享关系，粗细 = 关联强度，颜色 = 维度</div></div>
            <div className="flex flex-wrap items-center gap-2.5">{DIM_ORDER.map((d) => <span key={d} className="flex items-center gap-1 text-[11px] text-default-500"><span className="h-2 w-2 rounded-full" style={{ background: DIM_META[d].color }} />{DIM_META[d].short}</span>)}</div>
          </CardHeader>
            <CardBody className="pt-0"><Graph ring={ring} /></CardBody>
          </Card>

          <Card shadow="none" className="card"><CardHeader><div><div className="text-[15px] font-bold">置信度构成</div><div className="text-[12px] text-default-400">多维加权打分 · 共享 {sharedCount} 类维度</div></div></CardHeader>
            <CardBody className="pt-0">
              <div className="flex items-end gap-2"><div className="text-[40px] font-extrabold leading-none tnum" style={{ color: tone === "red" ? "var(--danger)" : tone === "amber" ? "var(--warning)" : "var(--text-2)" }}>{ring.confidence}<span className="text-[18px]">%</span></div><div className="mb-1 text-[12px] text-default-500">{confLabel(ring.confidence)}<br />阈值 {THRESHOLD}% {ring.confidence >= THRESHOLD ? "· 已成团" : "· 未达标"}</div></div>

              <div className="mt-4 flex flex-col gap-3">
                {DIM_ORDER.map((d) => {
                  const s = ring.shared.find((x) => x.dim === d);
                  const Icon = DIM_ICON[d];
                  const pct = s ? Math.round((s.contrib / DIM_META[d].weight) * 100) : 0;
                  return (
                    <div key={d}>
                      <div className="mb-1 flex items-center gap-1.5 text-[12px]">
                        <Icon className="h-3.5 w-3.5" style={{ color: s ? DIM_META[d].color : "var(--text-3)" }} />
                        <span className={s ? "font-semibold" : "text-default-400"}>{DIM_META[d].label}</span>
                        <span className="rounded-full bg-default-100 px-1.5 text-[10px] font-semibold text-default-400">权重 {DIM_META[d].weight}</span>
                        <span className="ml-auto tnum font-semibold" style={{ color: s ? DIM_META[d].color : "var(--text-3)" }}>{s ? `共享 ${s.count} 项 · +${s.contrib}` : "未共享"}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-default-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: DIM_META[d].color }} /></div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 flex items-start gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500"><Info className="mt-px h-3.5 w-3.5 shrink-0" />区分度越高的维度权重越大：资金/地址难以伪造，IP/设备可能因共享网络巧合，故权重递减。</p>
            </CardBody>
          </Card>
        </div>

        {/* members */}
        <Card shadow="none" className="card"><CardHeader><div className="text-[15px] font-bold">团伙成员 · {ring.members.length}</div></CardHeader>
          <CardBody className="pt-0">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ring.members.map((m) => {
                const dims = Array.from(new Set(ring.edges.filter((e) => e.a === ring.members.indexOf(m) || e.b === ring.members.indexOf(m)).flatMap((e) => e.dims)));
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-divider p-3">
                    <Initials p={{ i: m.i, c: m.c }} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="truncate font-semibold">{m.name}</span><Pill tone="grey" dot={false}>{m.kind}</Pill></div>
                      <div className="text-[11.5px] text-default-400">{m.sub} · {m.role} · 关联告警 {m.alerts} 条</div>
                    </div>
                    <div className="flex shrink-0 gap-1">{DIM_ORDER.filter((d) => dims.includes(d)).map((d) => { const Icon = DIM_ICON[d]; return <span key={d} title={DIM_META[d].label} className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb," + DIM_META[d].color + " 14%, transparent)", color: DIM_META[d].color }}><Icon className="h-3.5 w-3.5" /></span>; })}</div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* evidence + recommendation */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <Card shadow="none" className="card"><CardHeader><div><div className="text-[15px] font-bold">共享证据明细</div><div className="text-[12px] text-default-400">{ring.edges.length} 条关联边 · 可解释 / 可留痕</div></div></CardHeader>
            <CardBody className="flex flex-col gap-2.5 pt-0">
              {ring.edges.map((e, i) => (
                <div key={i} className="rounded-xl border border-divider p-3">
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold">
                    <Initials p={{ i: ring.members[e.a].i, c: ring.members[e.a].c }} size={20} />{ring.members[e.a].name}
                    <span className="text-default-300">↔</span>
                    <Initials p={{ i: ring.members[e.b].i, c: ring.members[e.b].c }} size={20} />{ring.members[e.b].name}
                    <span className="ml-auto tnum font-bold" style={{ color: "var(--danger)" }}>强度 {e.strength}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {e.dims.map((d) => <span key={d} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "color-mix(in srgb," + DIM_META[d].color + " 14%, transparent)", color: DIM_META[d].color }}>{DIM_META[d].label}</span>)}
                    <span className="text-[11.5px] text-default-500">· {e.note}</span>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card shadow="none" className="card"><CardHeader className="flex items-center justify-between"><div className="flex items-center gap-2 text-[15px] font-bold"><Sparkles className="h-4 w-4 text-default-400" />研判建议</div><Pill tone={ring.statusTone}>{ring.status}</Pill></CardHeader>
            <CardBody className="pt-0">
              <p className="text-[13px] leading-relaxed text-default-600">{ring.recommendation}</p>
              {ring.hubNote && <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500"><Info className="mt-px h-3.5 w-3.5 shrink-0" />{ring.hubNote}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" color="primary" startContent={<FolderPlus className="h-4 w-4" />} onPress={() => toast.success(`${ring.id} 已并入调查案件`)}>并入案件</Button>
                <Button size="sm" variant="bordered" startContent={<ListPlus className="h-4 w-4" />} onPress={() => toast.success("已批量列入名单")}>批量列名单</Button>
                <Button size="sm" variant="bordered" startContent={<Bell className="h-4 w-4" />} onPress={() => nav("/alerts")}>查看关联告警</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
