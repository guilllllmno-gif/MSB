import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardHeader, CardBody, Button, Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Textarea, Select, SelectItem } from "@heroui/react";
import { ArrowLeft, FolderPlus, ListPlus, FileDown, Coins, Link2, Smartphone, Globe, Bell, Sparkles, Info, ArrowUpCircle, XCircle, ClipboardCheck, Clock, UserPlus, ChevronDown, FileQuestion } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, Initials, SectionLabel } from "@/components/bits";
import { RingBasis } from "@/components/RingBasis";
import { ringOf, DIM_META, DIM_ORDER, confTone, confLabel, RING_FIELDS, RING_STATES, DISP_STATE, type RingDim, type Ring, type RingStateKey } from "@/lib/rings";
import { ringStore, useRingVersion } from "@/lib/store";

const ME = { i: "JL", n: "James Liu", c: "var(--brand)" };

const DIM_ICON: Record<RingDim, typeof Coins> = { funds: Coins, address: Link2, device: Smartphone, ip: Globe };
const THRESHOLD = 60;
const toneCol = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : "var(--text-2)");

// relationship graph — radial, adaptive to member count (scales node/radius/canvas)
function Graph({ ring }: { ring: Ring }) {
  const n = ring.members.length;
  // adapt to member count so it stays legible as the ring grows
  const size = n <= 5 ? 50 : n <= 8 ? 42 : 34;
  const r = n <= 5 ? 112 : n <= 8 ? 134 : 152;
  const W = 520;
  const H = Math.max(340, Math.round(2 * r + size + 110));
  const cx = W / 2, cy = H / 2;
  const labelW = Math.round(size * 2.6);
  const showChipText = n <= 8; // hide the "强度" word when dense, keep dots + number
  const pos = ring.members.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  const pc = (v: number, max: number) => `${(v / max) * 100}%`;
  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: W, aspectRatio: `${W}/${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
        {ring.edges.map((e, i) => {
          const dim = DIM_ORDER.find((d) => e.dims.includes(d))!;
          const p1 = pos[e.a], p2 = pos[e.b];
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={DIM_META[dim].color} strokeWidth={Math.min(6, Math.max(2, e.strength / 13))} strokeOpacity={0.45} strokeLinecap="round" />;
        })}
      </svg>
      {/* edge strength chips */}
      {ring.edges.map((e, i) => {
        const mx = (pos[e.a].x + pos[e.b].x) / 2, my = (pos[e.a].y + pos[e.b].y) / 2;
        return (
          <div key={i} title={`关联强度 ${e.strength} · 共享 ${e.dims.map((d) => DIM_META[d].label).join("、")}`} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-divider bg-content1 px-1.5 py-0.5 shadow-[0_1px_2px_rgba(17,24,39,.08)]" style={{ left: pc(mx, W), top: pc(my, H) }}>
            {e.dims.map((d) => <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: DIM_META[d].color }} />)}
            {showChipText && <span className="text-[9px] font-medium text-default-400">强度</span>}
            <span className="tnum text-[10.5px] font-bold text-default-700">{e.strength}</span>
          </div>
        );
      })}
      {/* nodes */}
      {ring.members.map((m, i) => (
        <div key={m.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: pc(pos[i].x, W), top: pc(pos[i].y, H), width: labelW }}>
          <Initials p={{ i: m.i, c: m.c }} size={size} />
          <div className={`mt-1 max-w-full truncate text-center font-semibold leading-tight ${n <= 8 ? "text-[11.5px]" : "text-[10px]"}`}>{m.name}</div>
          <div className="max-w-full truncate text-[10px] leading-tight text-default-400">{m.role}</div>
        </div>
      ))}
    </div>
  );
}

// 处置结论 — terminal dispositions (each → a terminal state)
const DISP = [
  { k: "case", label: "并入案件", icon: FolderPlus, msg: "已并入调查案件" },
  { k: "watch", label: "批量列名单", icon: ListPlus, msg: "已批量列入加强监控名单" },
  { k: "escalate", label: "升级 MLRO", icon: ArrowUpCircle, msg: "已升级 MLRO 评估 STR" },
  { k: "fp", label: "标记误报", icon: XCircle, msg: "已标记为误聚 / 误报" },
];
// 流程操作 — non-terminal (ring stays in investigation)
const PROC = [
  { k: "reqinfo", label: "要求补充材料", icon: FileQuestion, msg: "已向商户发起补充材料请求 · 保持调查中" },
];
const ACTIONS = [...DISP, ...PROC];

export default function RingDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  useRingVersion();
  const rid = sp.get("id") || undefined;
  const ring = ringStore.created().find((r) => r.id === rid) || ringOf(rid);
  const state = ringStore.stateOf(ring.id, ring.state) as RingStateKey;
  const sd = RING_STATES[state];
  const owner = ringStore.ownerOf(ring.id, ring.owner);
  const tone = confTone(ring.confidence);
  const claim = () => { ringStore.set(ring.id, "investigating", ME); toast.success(`${ring.id} 已认领 · 进入调查中`); };
  const [open, setOpen] = useState(false);
  const [disp, setDisp] = useState<string>(ring.confidence >= 80 ? "case" : ring.confidence >= 60 ? "reqinfo" : "fp");
  const [note, setNote] = useState("");
  const [fieldVals, setFieldVals] = useState<Record<string, string[]>>({});
  const [errs, setErrs] = useState<Set<string>>(new Set());
  const [expDim, setExpDim] = useState<RingDim | null>(null);
  const edges = [...ring.edges].sort((a, b) => b.strength - a.strength);

  const pickDisp = (k: string) => { setDisp(k); setFieldVals({}); setErrs(new Set()); };
  const toggleField = (k: string, val: string, multi: boolean) => setFieldVals((p) => {
    const cur = p[k] || [];
    if (multi) return { ...p, [k]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
    return { ...p, [k]: [val] };
  });

  const submit = () => {
    const fields = RING_FIELDS[disp] || [];
    const e = new Set<string>();
    fields.forEach((f) => { if (f.required && !(fieldVals[f.k] || []).length) e.add(f.k); });
    setErrs(e);
    if (e.size) { toast.error("请补全所需信息"); return; }
    const d = ACTIONS.find((x) => x.k === disp);
    ringStore.set(ring.id, DISP_STATE[disp]);
    toast.success(`${ring.id} · ${d?.msg ?? "已提交研判"}`);
    setOpen(false);
  };

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
              <Pill tone={sd.tone}>{sd.label}{ring.caseRef ? ` · ${ring.caseRef}` : ""}</Pill>
            </h1>
            <div className="mt-2.5 text-[13px] text-default-500">
              {ring.id} · {ring.members.length} 个主体 · 关联告警 <b className="text-foreground">{ring.alertCount}</b> 条 · 涉及 <b className="text-foreground">{ring.amount}</b> · {ring.span}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {ring.sla && <Pill tone={ring.sla.tone} icon={<Clock className="h-3.5 w-3.5" />}>SLA {ring.sla.text}</Pill>}
            {owner ? <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Initials p={owner} size={26} />{owner.n}</span> : <Pill tone="grey">未分配</Pill>}
            <RingBasis ring={ring} />
            {state === "pending" && <Button size="sm" variant="bordered" startContent={<UserPlus className="h-4 w-4" />} onPress={claim}>认领</Button>}
            <Button size="sm" variant="bordered" startContent={<FileDown className="h-4 w-4" />} onPress={() => toast.success("团伙研判报告已导出")}>导出报告</Button>
            {sd.active && <Button size="sm" color="primary" startContent={<ClipboardCheck className="h-4 w-4" />} onPress={() => setOpen(true)}>研判处置</Button>}
          </div>
        </div>
      </CardBody></Card>

      <div className="flex flex-col gap-5">
        {/* graph + its evidence — the edges ARE the evidence, so they live together */}
        <Card shadow="none" className="card"><CardHeader className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[15px] font-bold">关系图谱</div><div className="text-[12px] text-default-400">节点 = 主体 · 连线 = 共享关系（颜色 / 圆点 = 维度）· 连线标签「强度」= 关联强度，越高越可靠</div></div>
            <div className="flex flex-wrap items-center gap-2.5">{DIM_ORDER.map((d) => <span key={d} className="flex items-center gap-1 text-[11px] text-default-500"><span className="h-2 w-2 rounded-full" style={{ background: DIM_META[d].color }} />{DIM_META[d].short}</span>)}</div>
          </CardHeader>
            <CardBody className="pt-0">
              <Graph ring={ring} />
              {/* evidence explains each edge above */}
              <div className="mt-5 border-t border-divider pt-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1"><div className="text-[14px] font-bold">共享证据明细 · {edges.length} 条连线</div><div className="text-[12px] text-default-400">逐条解释上方每条连线（主体对）· 强度叠加形成置信度 · 可留痕</div></div>
                <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                  {edges.map((e, i) => { const sc = confTone(Math.min(100, e.strength + 15)); return (
                    <div key={i} className="rounded-xl border border-divider p-3.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px] font-semibold">
                        <span className="inline-flex items-center gap-1.5"><Initials p={{ i: ring.members[e.a].i, c: ring.members[e.a].c }} size={22} />{ring.members[e.a].name}</span>
                        <span className="text-default-300">↔</span>
                        <span className="inline-flex items-center gap-1.5"><Initials p={{ i: ring.members[e.b].i, c: ring.members[e.b].c }} size={22} />{ring.members[e.b].name}</span>
                        <span className="ml-auto flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-default-100"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, e.strength)}%`, background: toneCol(sc) }} /></span>
                          <span className="tnum text-[12px] font-bold" style={{ color: toneCol(sc) }}>{e.strength}</span>
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {e.dims.map((d) => { const Icon = DIM_ICON[d]; return <span key={d} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "color-mix(in srgb," + DIM_META[d].color + " 14%, transparent)", color: DIM_META[d].color }}><Icon className="h-3 w-3" />{DIM_META[d].label}</span>; })}
                        <span className="text-[11.5px] text-default-500">· {e.note}</span>
                      </div>
                    </div>
                  ); })}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* confidence + members */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <Card shadow="none" className="card"><CardHeader><div><div className="text-[15px] font-bold">置信度构成</div><div className="text-[12px] text-default-400">各维度关联强度叠加 → 累计置信度</div></div></CardHeader>
            <CardBody className="pt-0">
              <div className="flex items-end gap-3">
                <div className="text-[42px] font-extrabold leading-none tnum" style={{ color: toneCol(tone) }}>{ring.confidence}<span className="text-[18px]">%</span></div>
                <div className="mb-1 text-[12px]"><Pill tone={tone}>{confLabel(ring.confidence)}</Pill><div className="mt-1 text-default-400">阈值 {THRESHOLD}% · {ring.confidence >= THRESHOLD ? "已成团" : "未达标"}</div></div>
              </div>

              {/* stacked contribution bar with threshold marker */}
              <div className="relative mt-4 h-3.5 w-full overflow-hidden rounded-full bg-default-100">
                <div className="flex h-full">
                  {DIM_ORDER.map((d) => { const s = ring.shared.find((x) => x.dim === d); return s ? <div key={d} className="h-full" style={{ width: `${s.contrib}%`, background: DIM_META[d].color }} title={`${DIM_META[d].label} +${s.contrib}`} /> : null; })}
                </div>
              </div>
              <div className="relative mt-1 h-3 w-full text-[10px] text-default-400">
                <span className="absolute -translate-x-1/2 cursor-help" style={{ left: `${THRESHOLD}%` }} title={`判定门槛：累计置信度 ≥ ${THRESHOLD}% 才成团（进入待研判）；低于阈值仅进入观察中，避免弱关联误聚`}>▲ 阈值 {THRESHOLD}%</span>
              </div>

              {/* legend — click a shared dimension to expand its hit relationships */}
              <div className="mt-3 flex flex-col gap-1">
                {DIM_ORDER.map((d) => {
                  const s = ring.shared.find((x) => x.dim === d);
                  const Icon = DIM_ICON[d];
                  const hits = ring.edges.filter((e) => e.dims.includes(d));
                  const exp = expDim === d;
                  return (
                    <div key={d}>
                      <button disabled={!s} onClick={() => setExpDim(exp ? null : d)} className="flex w-full items-center gap-2 rounded-lg py-1 text-left text-[12px] disabled:opacity-100">
                        {s ? <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-default-400 transition-transform ${exp ? "rotate-180" : ""}`} /> : <span className="w-3.5 shrink-0" />}
                        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: s ? DIM_META[d].color : "var(--text-3)" }} />
                        <span className={s ? "" : "text-default-400"}>{DIM_META[d].label}</span>
                        <span className="rounded-full bg-default-100 px-1.5 text-[10px] font-semibold text-default-400">权重 {DIM_META[d].weight}</span>
                        <span className="ml-auto tnum font-semibold" style={{ color: s ? DIM_META[d].color : "var(--text-3)" }}>{s ? `共享 ${s.count} 项 · +${s.contrib}` : "未共享"}</span>
                      </button>
                      {exp && s && (
                        <div className="mb-1.5 ml-[22px] mt-1 flex flex-col gap-1 border-l-2 pl-3" style={{ borderColor: "color-mix(in srgb," + DIM_META[d].color + " 40%, transparent)" }}>
                          <div className="text-[11px] text-default-400">命中 {hits.length} 条连线（主体对）· 共 {s.count} 项证据 · 折算 +{s.contrib} 分</div>
                          {hits.map((e, i) => (
                            <div key={i} className="text-[11.5px] text-default-600">{ring.members[e.a].name} <span className="text-default-300">↔</span> {ring.members[e.b].name}<span className="text-default-400"> · {e.note}</span></div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3.5 flex items-start gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500"><Info className="mt-px h-3.5 w-3.5 shrink-0" />区分度越高的维度权重越大：资金 / 地址难以伪造，IP / 设备可能因共享网络巧合，故权重递减。</p>
            </CardBody>
          </Card>

          <Card shadow="none" className="card"><CardHeader><div className="text-[15px] font-bold">团伙成员 · {ring.members.length}</div></CardHeader>
          <CardBody className="pt-0">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ring.members.map((m, idx) => {
                const dims = Array.from(new Set(ring.edges.filter((e) => e.a === idx || e.b === idx).flatMap((e) => e.dims)));
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
        </div>
      </div>

      {/* 研判处置 — side drawer */}
      <Drawer isOpen={open} onOpenChange={setOpen} placement="right" size="md" classNames={{ base: "!w-[46vw] !min-w-[420px] !max-w-[720px]" }}>
        <DrawerContent>
          <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
            <span className="text-[15px] font-bold">研判处置</span>
            <span className="text-[11.5px] font-normal text-default-400">{ring.id} · {ring.name}</span>
          </DrawerHeader>
          <DrawerBody className="gap-4 py-4">
            <div className="flex items-center gap-3 rounded-xl border border-divider bg-default-50 p-3.5">
              <div className="text-[28px] font-extrabold leading-none tnum" style={{ color: toneCol(tone) }}>{ring.confidence}%</div>
              <div className="text-[12px] text-default-500"><b className="text-foreground">{confLabel(ring.confidence)}</b> · {ring.typology}<br />{ring.members.length} 主体 · {ring.alertCount} 告警 · {ring.amount}</div>
            </div>

            <div className="rounded-xl border border-divider bg-default-50 p-3.5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-default-700"><Sparkles className="h-4 w-4 text-default-400" />AI 研判建议</div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-default-600">{ring.recommendation}</p>
              {ring.hubNote && <p className="mt-2.5 flex items-start gap-1.5 border-t border-divider pt-2.5 text-[11.5px] leading-relaxed text-default-500"><Info className="mt-px h-3.5 w-3.5 shrink-0" />{ring.hubNote}</p>}
            </div>

            <div>
              <SectionLabel>处置结论 · 终态</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {DISP.map((d) => { const on = disp === d.k; const Icon = d.icon; return (
                  <button key={d.k} onClick={() => pickDisp(d.k)} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12.5px] font-semibold transition-colors"
                    style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" } : { borderColor: "var(--line)", color: "var(--text-2)" }}>
                    <Icon className="h-[18px] w-[18px]" />{d.label}</button>
                ); })}
              </div>
            </div>
            <div>
              <SectionLabel>流程操作 · 不结案</SectionLabel>
              <div className="grid grid-cols-1 gap-2">
                {PROC.map((d) => { const on = disp === d.k; const Icon = d.icon; return (
                  <button key={d.k} onClick={() => pickDisp(d.k)} className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] px-1.5 py-2.5 text-[12.5px] font-semibold transition-colors"
                    style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" } : { borderColor: "var(--line)", color: "var(--text-2)" }}>
                    <Icon className="h-[18px] w-[18px]" />{d.label}<span className="text-[11px] font-normal text-default-400">· 保持调查中</span></button>
                ); })}
              </div>
            </div>

            {/* per-action form */}
            {(RING_FIELDS[disp] || []).map((fd) => fd.type === "select" ? (
              <Select key={fd.k} size="sm" label={fd.label} labelPlacement="outside" placeholder="请选择…" isRequired={fd.required} aria-label={fd.label}
                selectedKeys={(fieldVals[fd.k] || []).length ? [fieldVals[fd.k][0]] : []} isInvalid={errs.has(fd.k)}
                onSelectionChange={(keys) => toggleField(fd.k, Array.from(keys as Set<string>)[0] ?? "", false)}>
                {fd.options.map((o) => <SelectItem key={o}>{o}</SelectItem>)}
              </Select>
            ) : (
              <div key={fd.k}>
                <label className="mb-1.5 block text-[12.5px] font-semibold">{fd.label} {fd.required ? <span className="text-danger">*</span> : <span className="font-normal text-default-400">· 选填</span>}</label>
                <div className={`flex flex-wrap gap-1.5 ${errs.has(fd.k) ? "rounded-xl p-1 ring-2 ring-danger/40" : ""}`}>
                  {fd.options.map((o) => { const on = (fieldVals[fd.k] || []).includes(o); return (
                    <button key={o} onClick={() => toggleField(fd.k, o, true)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
                      style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" } : { borderColor: "var(--line)", color: "var(--text-2)" }}>
                      <span>{on ? "✓" : "+"}</span>{o}</button>
                  ); })}
                </div>
              </div>
            ))}

            <Textarea label="研判备注" labelPlacement="outside" value={note} onValueChange={setNote} minRows={3} placeholder="说明聚类依据、对手范围与处置理由…（记入审计日志）" />
          </DrawerBody>
          <DrawerFooter className="border-t border-divider">
            <Button variant="bordered" onPress={() => setOpen(false)}>取消</Button>
            <Button color="primary" startContent={<Bell className="h-4 w-4" />} onPress={submit}>提交研判</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Shell>
  );
}
