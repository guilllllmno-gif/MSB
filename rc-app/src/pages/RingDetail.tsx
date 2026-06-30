import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardHeader, CardBody, Button, Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Textarea, Select, SelectItem } from "@heroui/react";
import { ArrowLeft, FolderPlus, ListPlus, FileDown, Coins, Link2, Smartphone, Globe, Bell, Sparkles, Info, ArrowUpCircle, XCircle, ClipboardCheck, Clock, UserPlus, ChevronDown, FileQuestion } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, Initials, SectionLabel } from "@/components/bits";
import { RingBasis } from "@/components/RingBasis";
import { Timeline } from "@/components/Timeline";
import { ringOf, caseRefFor, clusterCount, clusterChildren, DIM_META, DIM_ORDER, confTone, confLabel, RING_FIELDS, RING_STATES, DISP_STATE, ringActions, type RingDim, type Ring, type RingEdge, type RingStateKey } from "@/lib/rings";
import { ringStore, useRingVersion } from "@/lib/store";
import { intakeCase } from "@/lib/caseIntake";
import type { CaseSubject } from "@/lib/cases";

const ME = { i: "JL", n: "James Liu", c: "var(--brand)" };

const DIM_ICON: Record<RingDim, typeof Coins> = { funds: Coins, address: Link2, device: Smartphone, ip: Globe };
const THRESHOLD = 60;
const toneCol = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : "var(--text-2)");

// deterministic layered layout for larger rings (a single circle tangles, and a
// force sim overlaps nodes/labels). We BFS from the highest-degree node (the hub)
// and place nodes in columns by graph distance: every edge then spans adjacent
// columns, so nothing crosses and the money-flow reads left→right. Pixel-space.
// Edge direction in the data is inconsistent, so we treat the graph as undirected.
function layeredLayout(n: number, edges: RingEdge[], W: number, size: number, labelW: number): { pos: { x: number; y: number }[]; H: number } {
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (const e of edges) { adj[e.a].add(e.b); adj[e.b].add(e.a); }
  // hub = max degree (ties → lowest index, for determinism)
  let hub = 0;
  for (let i = 1; i < n; i++) if (adj[i].size > adj[hub].size) hub = i;
  // BFS distance → column index
  const layer = Array<number>(n).fill(-1);
  layer[hub] = 0;
  const queue = [hub];
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    for (const v of adj[u]) if (layer[v] === -1) { layer[v] = layer[u] + 1; queue.push(v); }
  }
  let maxL = Math.max(...layer);
  for (let i = 0; i < n; i++) if (layer[i] === -1) layer[i] = ++maxL; // disconnected → own trailing column
  const cols = maxL + 1;
  const byLayer: number[][] = Array.from({ length: cols }, () => []);
  for (let i = 0; i < n; i++) byLayer[layer[i]].push(i);

  const padX = labelW / 2 + 14;
  const innerW = W - 2 * padX;
  const colX = (l: number) => (cols > 1 ? padX + (innerW * l) / (cols - 1) : W / 2);
  const rowGap = size + 48;
  const maxRows = Math.max(...byLayer.map((c) => c.length));
  const H = Math.max(300, maxRows * rowGap + 36);
  const cy = H / 2;
  const pos: { x: number; y: number }[] = new Array(n);
  byLayer.forEach((col, l) => {
    const m = col.length;
    col.forEach((idx, k) => { pos[idx] = { x: colX(l), y: cy + (k - (m - 1) / 2) * rowGap }; });
  });
  return { pos, H };
}

// relationship graph — single circle for small rings, force-directed for large
function Graph({ ring, expanded, onToggle }: { ring: Ring; expanded: Set<string>; onToggle: (id: string) => void }) {
  const n = ring.members.length;
  // adapt to member count so it stays legible as the ring grows
  const size = n <= 5 ? 50 : n <= 8 ? 42 : 34;
  const layered = n >= 6; // small rings read best as a clean circle; larger ones as layered columns
  const W = layered ? 640 : 520; // wider canvas so columns + labels breathe
  const labelW = Math.round(size * 2.6);
  const showChipText = n <= 8; // hide the "强度" word when dense, keep dots + number

  const { pos, H } = useMemo(() => {
    if (layered) return layeredLayout(n, ring.edges, W, size, labelW);
    const r = n <= 5 ? 112 : 134;
    const Hc = Math.max(340, Math.round(2 * r + size + 110));
    const cx = W / 2, cy = Hc / 2;
    return {
      H: Hc,
      pos: ring.members.map((_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
      }),
    };
  }, [ring, n, layered, W, size, labelW]);

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
      {/* nodes — 群组 (cluster) nodes are clickable to expand their sub-members */}
      {ring.members.map((m, i) => {
        const cluster = m.kind === "群组";
        const cnt = cluster ? clusterCount(m) : 0;
        const on = expanded.has(m.id);
        return (
          <div key={m.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: pc(pos[i].x, W), top: pc(pos[i].y, H), width: labelW }}>
            <button type="button" disabled={!cluster} onClick={() => onToggle(m.id)} aria-label={cluster ? `展开群组 ${m.name} 的 ${cnt} 个子成员` : undefined}
              className={`relative rounded-full transition ${cluster ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
              style={on ? { boxShadow: "0 0 0 3px var(--content1), 0 0 0 5px var(--brand)" } : undefined}
              title={cluster ? `${cnt} 个子成员 · 点击${on ? "收起" : "展开"}` : undefined}>
              <Initials p={{ i: m.i, c: m.c }} size={size} mono />
              {cluster && cnt > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex items-center gap-px rounded-full border-2 border-content1 px-1 py-px text-[9px] font-bold leading-none text-white" style={{ background: "var(--brand)" }}>
                  {cnt}<ChevronDown className={`h-2.5 w-2.5 transition-transform ${on ? "rotate-180" : ""}`} />
                </span>
              )}
            </button>
            <div className={`mt-1 max-w-full truncate text-center font-semibold leading-tight ${n <= 8 ? "text-[11.5px]" : "text-[10px]"}`}>{m.name}</div>
            <div className="max-w-full truncate text-[10px] leading-tight text-default-400">{m.role}</div>
          </div>
        );
      })}
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

// 操作后影响 — what submitting each disposition does (shown after a choice is made)
const IMPACT: Record<string, (r: Ring) => string> = {
  case: (r) => `将本团伙 <b>${r.members.length}</b> 个主体与 <b>${r.alertCount}</b> 条关联告警按所选调查范围并入调查案件${r.caseRef ? `（并入 <b>${r.caseRef}</b>）` : `（新建 <b>${caseRefFor(r)}</b>）`}。后续 STR 起草、多笔关联调查在「案件管理」中进行 · 团伙状态转 <b>已聚案</b>。`,
  watch: (r) => `将所选对象（成员地址 / 商户主体 / 关联群组）批量写入风控名单，涉及 <b>${r.amount}</b> 资金敞口；后续同类交易将按名单规则自动加严或拦截 · 团伙状态转 <b>已列名单</b>。`,
  escalate: (r) => `升级至 MLRO 评估是否构成可疑活动、是否向 FINTRAC 报送 STR；<b>${r.typology}</b> 高风险，相关主体可触发资金冻结 · 团伙状态转 <b>已升级 MLRO</b>。`,
  fp: () => `判定为误聚 / 误报并关闭团伙；可同时降低误命中维度权重或将相关网络加入可信白名单，回流模型减少后续误聚 · 团伙状态转 <b>已关闭 · 误报</b>。`,
  reqinfo: () => `向相关商户发起补充材料请求（按所选材料与回复时限）；团伙<b>保持调查中</b>、SLA 暂停计时，资料回补后重新进入研判，不立即结案。`,
};
const IMPACT_STYLE: Record<string, { bg: string; bd: string }> = {
  case: { bg: "var(--violet-bg)", bd: "var(--violet-bd)" },
  watch: { bg: "var(--success-bg)", bd: "var(--success-bd)" },
  escalate: { bg: "var(--danger-bg)", bd: "var(--danger-bd)" },
  fp: { bg: "var(--chip-bg)", bd: "var(--line)" },
  reqinfo: { bg: "var(--brand-softer)", bd: "var(--brand-bd)" },
};

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
  const caseRef = ringStore.caseRefOf(ring.id, ring.caseRef);
  const claim = () => { ringStore.set(ring.id, "investigating", ME, "认领 · 进入调查中"); toast.success(`${ring.id} 已认领 · 进入调查中`); };
  const allowed = ringActions(state);
  // smart default disposition for the current state + confidence (recomputed each time the drawer opens)
  const defaultDisp = () => { const p = ring.confidence >= 80 ? "case" : ring.confidence >= 60 ? "reqinfo" : "fp"; return allowed.includes(p) ? p : allowed[0] ?? "fp"; };
  const [open, setOpen] = useState(false);
  const [disp, setDisp] = useState<string>(defaultDisp());
  const [note, setNote] = useState("");
  const [fieldVals, setFieldVals] = useState<Record<string, string[]>>({});
  const [errs, setErrs] = useState<Set<string>>(new Set());
  const [expDim, setExpDim] = useState<RingDim | null>(null);
  const [expClusters, setExpClusters] = useState<Set<string>>(new Set());
  const toggleCluster = (id: string) => setExpClusters((p) => { const next = new Set(p); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const [tab, setTab] = useState<"info" | "log">("info");
  const edges = [...ring.edges].sort((a, b) => b.strength - a.strength);

  // activity log: detection → in-session actions → current state
  const logItems = [
    { time: ring.span, text: `系统多维聚类识别成团 · ${ring.typology} · 置信度 ${ring.confidence}%`, done: true },
    ...ringStore.eventsOf(ring.id).map((e) => ({ time: e.t, text: e.text, done: true })),
    { time: "当前", text: `${sd.label}${owner ? ` · ${owner.n}` : ""}`, done: !sd.active },
  ];

  // open the disposition drawer, selecting `preset` if it's allowed else the smart default
  const openDisp = (preset?: string) => { setDisp(preset && allowed.includes(preset) ? preset : defaultDisp()); setFieldVals({}); setErrs(new Set()); setOpen(true); };
  // deep-link from the list ("并入案件" shortcut) → open drawer pre-selected to that disposition
  const action = sp.get("action");
  useEffect(() => { if (action && allowed.includes(action)) openDisp(action); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [action]);
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
    // 转案件 → 在案件管理生成 / 并入案件(案件 = STR 唯一漏斗),涉案主体取团伙成员
    let newCaseRef: string | undefined;
    if (disp === "case") {
      const subjects: CaseSubject[] = ring.members.slice(0, 8).map((m) => ({ name: m.name, type: m.kind === "商户" ? "商户" : "链上地址", role: m.role }));
      const { id, attached } = intakeCase({ subject: ring.name, sub: `团伙 · ${ring.members.length} 主体`, type: ring.typology, risk: "团伙网络", amount: ring.amount, src: "团伙转案件", linkIds: `${ring.id} · ${ring.members.length} 主体`, linkTo: `/ring?id=${ring.id}`, subjects });
      newCaseRef = id;
      toast(attached ? `已并入在办案件 ${id}` : `已聚案 ${id} · 在案件管理确认可疑后起草 STR`);
    }
    ringStore.set(ring.id, DISP_STATE[disp], undefined, `${d?.label ?? "提交研判"}${newCaseRef ? ` · ${newCaseRef}` : ""}`, newCaseRef);
    if (disp !== "case") toast.success(`${ring.id} · ${d?.msg ?? "已提交研判"}`);
    setOpen(false);
  };

  return (
    <Shell crumb={["风控", "检测策略", "团伙识别", ring.id]} wide>
      <button onClick={() => nav("/rings")} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回团伙列表</button>

      {/* top bar — flat, no box */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-[23px] font-bold tracking-tight">
            {ring.name}
            <Pill tone="grey" dot={false}>{ring.typology}</Pill>
            <Pill tone={tone}>{confLabel(ring.confidence)} {ring.confidence}%</Pill>
            <Pill tone={sd.tone}>{sd.label}{caseRef ? ` · ${caseRef}` : ""}</Pill>
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
          {allowed.length > 0 && <Button size="sm" color="primary" startContent={<ClipboardCheck className="h-4 w-4" />} onPress={() => openDisp()}>研判处置</Button>}
        </div>
      </div>

      {/* tabs */}
      <div className="mb-5 flex items-center gap-6 border-b border-divider">
        {([["info", "团伙详情"], ["log", "活动日志"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`relative -mb-px pb-3 text-[14px] font-semibold transition-colors ${tab === k ? "text-foreground" : "text-default-400 hover:text-default-600"}`}>
            {label}
            {tab === k && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <Card shadow="none" className="card"><CardHeader><div className="text-[15px] font-bold">活动日志 · 操作时间线</div></CardHeader><CardBody className="pt-0">
          <Timeline items={logItems} />
        </CardBody></Card>
      ) : (
      <div className="flex flex-col gap-5">
        {/* graph + its evidence — the edges ARE the evidence, so they live together */}
        <Card shadow="none" className="card"><CardHeader className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[15px] font-bold">关系图谱</div><div className="text-[12px] text-default-400">节点 = 主体 · 连线 = 共享关系（颜色 / 圆点 = 维度）· 连线标签「强度」= 关联强度，越高越可靠</div></div>
            <div className="flex flex-wrap items-center gap-2.5">{DIM_ORDER.map((d) => <span key={d} className="flex items-center gap-1 text-[11px] text-default-500"><span className="h-2 w-2 rounded-full" style={{ background: DIM_META[d].color }} />{DIM_META[d].short}</span>)}</div>
          </CardHeader>
            <CardBody className="pt-0">
              <Graph ring={ring} expanded={expClusters} onToggle={(id) => { toggleCluster(id); if (!expClusters.has(id)) setTimeout(() => document.getElementById(`cm-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); }} />
              {ring.members.some((m) => m.kind === "群组") && <div className="mt-2 text-center text-[11px] text-default-400">提示：带 <span className="font-semibold text-default-500">数字角标</span> 的为簇节点，点击可展开查看其下子成员（地址 / 钱包 / 设备）</div>}
              {/* evidence explains each edge above */}
              <div className="mt-5 border-t border-divider pt-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1"><div className="text-[14px] font-bold">共享证据明细 · {edges.length} 条连线</div><div className="text-[12px] text-default-400">逐条解释上方每条连线（主体对）· 强度叠加形成置信度 · 可留痕</div></div>
                <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                  {edges.map((e, i) => { const sc = confTone(Math.min(100, e.strength + 15)); return (
                    <div key={i} className="rounded-xl border border-divider p-3.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px] font-semibold">
                        <span className="inline-flex items-center gap-1.5"><Initials p={{ i: ring.members[e.a].i, c: ring.members[e.a].c }} size={22} mono />{ring.members[e.a].name}</span>
                        <span className="text-default-300">↔</span>
                        <span className="inline-flex items-center gap-1.5"><Initials p={{ i: ring.members[e.b].i, c: ring.members[e.b].c }} size={22} mono />{ring.members[e.b].name}</span>
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
                <span className="absolute -translate-x-1/2 cursor-help" style={{ left: `${THRESHOLD}%` }} title={`判定门槛：累计置信度 ≥ ${THRESHOLD}% 才成团（进入待认领）；低于阈值仅进入观察中，避免弱关联误聚`}>▲ 阈值 {THRESHOLD}%</span>
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
                const cluster = m.kind === "群组";
                const cnt = cluster ? clusterCount(m) : 0;
                const on = expClusters.has(m.id);
                const children = on ? clusterChildren(m) : [];
                return (
                  <div key={m.id} id={`cm-${m.id}`} className={`rounded-xl border p-3 transition-colors ${cluster && on ? "border-primary/50 bg-primary/[0.03]" : "border-divider"} ${cluster ? "sm:col-span-2" : ""}`}>
                    <div className="flex items-center gap-3">
                      <Initials p={{ i: m.i, c: m.c }} size={36} mono />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="truncate font-semibold">{m.name}</span><Pill tone="grey" dot={false}>{m.kind}</Pill>{cluster && cnt > 0 && <span className="rounded-full bg-default-100 px-1.5 text-[10px] font-semibold text-default-500">{cnt} 个子成员</span>}</div>
                        <div className="text-[11.5px] text-default-400">{m.sub} · {m.role} · 关联告警 {m.alerts} 条</div>
                      </div>
                      {cluster && cnt > 0 ? (
                        <button onClick={() => toggleCluster(m.id)} className="flex shrink-0 items-center gap-1 rounded-lg border border-divider px-2 py-1 text-[11.5px] font-semibold text-default-600 hover:bg-default-50">
                          {on ? "收起" : "展开"}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${on ? "rotate-180" : ""}`} />
                        </button>
                      ) : (
                        <div className="flex shrink-0 gap-1">{DIM_ORDER.filter((d) => dims.includes(d)).map((d) => { const Icon = DIM_ICON[d]; return <span key={d} title={DIM_META[d].label} className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb," + DIM_META[d].color + " 14%, transparent)", color: DIM_META[d].color }}><Icon className="h-3.5 w-3.5" /></span>; })}</div>
                      )}
                    </div>
                    {cluster && on && (
                      <div className="mt-2.5 border-t border-divider pt-2.5">
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {children.map((ch, ci) => (
                            <div key={ci} className="flex items-center gap-2 rounded-lg bg-default-50 px-2.5 py-1.5">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: toneCol(ch.tone) }} />
                              <span className="tnum shrink-0 font-mono text-[12px] font-semibold">{ch.v}</span>
                              <span className="min-w-0 flex-1 truncate text-[11px] text-default-400">{ch.meta}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
        </div>
      </div>
      )}

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

            {state === "watching" && <p className="flex items-start gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500"><Info className="mt-px h-3.5 w-3.5 shrink-0" />弱关联团伙（低于阈值）仅可「升级 MLRO」或「标记误报」，不进入聚案 / 列名单处置流。</p>}
            {DISP.some((d) => allowed.includes(d.k)) && (
              <div>
                <SectionLabel>处置结论 · 终态</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {DISP.filter((d) => allowed.includes(d.k)).map((d) => { const on = disp === d.k; const Icon = d.icon; return (
                    <button key={d.k} onClick={() => pickDisp(d.k)} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12.5px] font-semibold transition-colors"
                      style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" } : { borderColor: "var(--line)", color: "var(--text-2)" }}>
                      <Icon className="h-[18px] w-[18px]" />{d.label}</button>
                  ); })}
                </div>
              </div>
            )}
            {PROC.some((d) => allowed.includes(d.k)) && (
              <div>
                <SectionLabel>流程操作 · 不结案</SectionLabel>
                <div className="grid grid-cols-1 gap-2">
                  {PROC.filter((d) => allowed.includes(d.k)).map((d) => { const on = disp === d.k; const Icon = d.icon; return (
                    <button key={d.k} onClick={() => pickDisp(d.k)} className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] px-1.5 py-2.5 text-[12.5px] font-semibold transition-colors"
                      style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" } : { borderColor: "var(--line)", color: "var(--text-2)" }}>
                      <Icon className="h-[18px] w-[18px]" />{d.label}<span className="text-[11px] font-normal text-default-400">· 保持调查中</span></button>
                  ); })}
                </div>
              </div>
            )}

            {/* 操作后影响 — consistent with the alert review drawer */}
            {disp && IMPACT[disp] && (
              <div className="rounded-xl border p-3 text-[12px] leading-relaxed text-default-600" style={{ background: IMPACT_STYLE[disp]?.bg, borderColor: IMPACT_STYLE[disp]?.bd }}>
                <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-default-400"><Info className="h-3 w-3" />操作后影响</div>
                <span dangerouslySetInnerHTML={{ __html: IMPACT[disp](ring) }} />
              </div>
            )}

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
