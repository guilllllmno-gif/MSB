import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tooltip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input } from "@heroui/react";
import { Eye, Settings2, Search, RefreshCw, ExternalLink, FlaskConical, ShieldCheck, Radar, RotateCcw, ChevronRight } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { NewRuleDrawer } from "@/components/NewRuleDrawer";
import { RULES, RUSTATE, CAT_ICON, CATS, VENUE, venueOf, bfrMeta, bfrDefault, rolloutBadges, type Rule, type RuState } from "@/lib/rules";
import { FINDINGS } from "@/lib/findings";
import { findingStore, ruleStore, useRuleVersion, useFindingVersion } from "@/lib/store";
import type { Person } from "@/lib/data";

const ME: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };

const TILES: { f: string; label: string }[] = [
  { f: "all", label: "全部" },
  { f: "live", label: "已上线" },
  { f: "backtest", label: "回测中" },
  { f: "pending", label: "待审批" },
  { f: "rejected", label: "已驳回" },
  { f: "disabled", label: "已停用" },
];

export default function RulesPage() {
  const nav = useNavigate();
  useRuleVersion();
  useFindingVersion();
  const [filter, setFilter] = useState("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  // 规则回填闭环:命中 backfill 的 typology 实时派生为规则(历史回填→已上线,本会话新回填→回测中)
  const finRules: Rule[] = FINDINGS
    .filter((f) => findingStore.backfillOf(f.id, f.backfill))
    .map((f) => {
      const m = bfrMeta(f.pattern);
      return {
        id: `R-BF-${f.id}`, name: m.name, cat: m.cat, cond: m.cond, action: m.action, state: bfrDefault(f.backfill),
        hits30: f.backfill ? 8 : 0, fp30: f.backfill ? "5%" : "—", src: "回填自", srcId: f.id, to: `/finding?id=${f.id}`,
        owner: findingStore.ownerOf(f.id, f.owner) || ME, updated: f.batch, weight: m.weight,
      };
    });

  const all: Rule[] = [...ruleStore.created(), ...finRules, ...RULES]
    .filter((r) => !ruleStore.isRemoved(r.id))
    .map((r) => ({ ...r, ...ruleStore.editsOf(r.id) }) as Rule);
  const stOf = (r: Rule) => ruleStore.stateOf(r.id, r.state) as RuState;

  const count = (key: string) => all.filter((r) => key === "all" || stOf(r) === key).length;
  const rows = all.filter((r) => {
    const okF = filter === "all" || stOf(r) === filter;
    const okC = cat === "all" || r.cat === cat;
    const okQ = !q.trim() || (r.id + r.name + r.cond + r.src).toLowerCase().includes(q.toLowerCase());
    return okF && okC && okQ;
  });

  const liveN = all.filter((r) => stOf(r) === "live").length;
  const bfN = finRules.length;
  // 权重校准闭环的每个阶段挂一个真实计数
  const fpNum = (s: string) => parseInt(s, 10) || 0;
  const backtestN = all.filter((r) => stOf(r) === "backtest").length;
  const pendingN = all.filter((r) => stOf(r) === "pending").length;
  const worstFp = [...all].filter((r) => stOf(r) === "live").sort((a, b) => fpNum(b.fp30) - fpNum(a.fp30))[0];
  // 闭环 5 阶段:建模 → 回测 → 审批 → 生效·监控 → 回填,再回到建模
  const LOOP: { icon: typeof FlaskConical; t: string; who: string; metric: string; tone?: string }[] = [
    { icon: Settings2, t: "建模 · 提案", who: "风控建模", metric: "拟规则 / 调权重" },
    { icon: FlaskConical, t: "回测", who: "历史数据验证", metric: `回测中 ${backtestN} · 预估误报达标才提交` },
    { icon: ShieldCheck, t: "审批上线", who: "风控总管签批", metric: `待审批 ${pendingN}`, tone: pendingN ? "var(--warning)" : undefined },
    { icon: Radar, t: "事中生效 · 误报监控", who: "实时拦截同类", metric: worstFp ? `已上线 ${liveN} · 最高误报 ${worstFp.fp30}` : `已上线 ${liveN}`, tone: worstFp && fpNum(worstFp.fp30) >= 20 ? "var(--danger)" : undefined },
    { icon: RotateCcw, t: "事后确认 · 回填", who: "成案 / 误报回填", metric: `来自回填 ${bfN}`, tone: bfN ? "var(--brand)" : undefined },
  ];

  const manage = (r: Rule) => nav(`/rule?id=${r.id}`);

  return (
    <Shell crumb={["检测策略", "监控规则"]} wide>
      <PageHead
        title="监控规则"
        sub="事中 / 告警的检测规则库与变更治理 —— 内置规则长期生效;事后监控「规则回填」的 typology 在此走 回测 → 审批 → 上线,闭环让事中实时拦截同类。"
        actions={<Button size="sm" radius="full" color="primary" variant="flat" startContent={<Settings2 className="h-3.5 w-3.5" />} onPress={() => setNewOpen(true)}>新建规则</Button>}
      />

      {/* 权重校准闭环 —— 规则/权重从提案到上线再到回填的循环;每阶段挂真实计数 */}
      <div className="card mb-5 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><RefreshCw className="h-4 w-4" /></span>
          <span className="text-[14px] font-bold">权重校准闭环</span>
          <span className="text-[12px] text-default-400">规则的权重不是拍一次定死 —— 经回测验证、上线后盯误报、事后结果回填再调,闭环让它持续收敛。</span>
        </div>

        {/* 5 阶段流:小屏纵向、宽屏横向带箭头 */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          {LOOP.map((s, i) => (
            <div key={s.t} className="flex items-stretch gap-2 lg:flex-1">
              <div className="flex flex-1 flex-col rounded-xl border border-divider p-3">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-default-100 text-default-500"><s.icon className="h-3.5 w-3.5" /></span>
                  <span className="text-[12.5px] font-bold leading-tight">{s.t}</span>
                </div>
                <span className="mt-1 text-[11px] text-default-400">{s.who}</span>
                <span className="mt-1.5 text-[11px] font-semibold tnum" style={{ color: s.tone ?? "var(--text-3)" }}>{s.metric}</span>
              </div>
              <ChevronRight className="hidden h-4 w-4 shrink-0 self-center text-default-300 lg:block" style={i === LOOP.length - 1 ? { visibility: "hidden" } : undefined} />
            </div>
          ))}
        </div>

        {/* 回填回环:从末端绕回起点 */}
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-dashed border-default-300 bg-default-50 px-3 py-2 text-[11.5px] leading-relaxed text-default-500">
          <RotateCcw className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: "var(--brand)" }} />
          <span><b style={{ color: "var(--brand)" }}>回填 / 再校准</b> —— 误报偏高或事后确认成案,就<b>回到「建模」调整规则权重</b>,重新走一圈。<b className="text-foreground">制裁 / 名单类硬规则不在此环</b>(命中即拦,不靠权重与阈值)。</span>
        </div>
      </div>

      {/* 状态分桶 tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map((t) => {
          const on = filter === t.f;
          return (
            <button key={t.f} onClick={() => setFilter(t.f)} className={`card card-hover px-3.5 py-3 text-left ${on ? "outline outline-2 -outline-offset-2 outline-[var(--brand)]" : ""}`}>
              <div className="text-[12px] text-default-500">{t.label}</div>
              <div className="mt-1.5 text-[24px] font-extrabold leading-none tnum" style={{ color: on ? "var(--brand)" : undefined }}>{count(t.f)}</div>
            </button>
          );
        })}
      </div>

      {/* 类别筛选 + 搜索 */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setCat("all")} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${cat === "all" ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:bg-default-100"}`}>全部类别</button>
          {CATS.map((c) => {
            const on = cat === c;
            return <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:bg-default-100"}`}>{c}</button>;
          })}
        </div>
        <Input size="sm" radius="full" value={q} onValueChange={setQ} placeholder="搜索规则名、条件或来源…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="ml-auto max-w-[300px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
      </div>

      {/* 规则库 */}
      <Table aria-label="监控规则" radius="lg" classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] align-top", tr: "border-b border-default-100 last:border-0 transition-colors data-[hover=true]:bg-default-50 hover:bg-default-50" }}>
        <TableHeader>
          <TableColumn>规则名称 / 类别</TableColumn><TableColumn>触发条件</TableColumn><TableColumn>命中处置</TableColumn>
          <TableColumn>近30天命中</TableColumn><TableColumn>状态</TableColumn><TableColumn>来源</TableColumn>
          <TableColumn>负责人</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="没有符合条件的规则">
          {rows.map((r) => {
            const st = stOf(r);
            const owner = ruleStore.ownerOf(r.id, r.owner);
            const CIcon = CAT_ICON[r.cat];
            const bf = r.src.startsWith("回填");
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <button onClick={() => manage(r)} className="text-left">
                    <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><CIcon className="h-4 w-4" /></span>{r.name}</span>
                    <div className="ml-9 mt-0.5 flex flex-wrap items-center gap-1.5"><Pill tone={VENUE[venueOf(r)].tone} dot={false}>{VENUE[venueOf(r)].short}</Pill><span className="text-[11px] text-default-400">{r.cat} · {r.id}</span>{rolloutBadges(r).map((b) => <Pill key={b.label} tone={b.tone} dot={false}>{b.label}</Pill>)}</div>
                  </button>
                </TableCell>
                <TableCell><span className="block max-w-[240px] text-[12.5px] leading-snug text-default-600">{r.cond}</span></TableCell>
                <TableCell><span className="text-default-600">{r.action}</span></TableCell>
                <TableCell>{st === "live" ? <span className="tnum font-semibold">{r.hits30}<span className="ml-1 text-[10.5px] font-normal text-default-400">误报 {r.fp30}</span></span> : <span className="text-default-400">—</span>}</TableCell>
                <TableCell><Pill tone={RUSTATE[st].tone}>{RUSTATE[st].label}</Pill></TableCell>
                <TableCell>{bf && r.to ? <button onClick={() => nav(r.to!)} className="inline-flex items-center gap-1 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--brand)] hover:opacity-80">回填 · {r.srcId} <ExternalLink className="h-3 w-3" /></button> : <span className="text-[12px] text-default-500">{r.src}</span>}</TableCell>
                <TableCell>{owner ? <span className="inline-flex items-center gap-1.5"><Initials p={owner} size={22} />{owner.n}</span> : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Tooltip content="查看 / 管理" size="sm" delay={300}><Button isIconOnly size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => manage(r)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button></Tooltip>
                    <Tooltip content="变更治理" size="sm" delay={300}><Button size="sm" radius="full" color="primary" variant="flat" startContent={<Settings2 className="h-3.5 w-3.5" />} onPress={() => manage(r)}>管理</Button></Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <NewRuleDrawer open={newOpen} onOpenChange={setNewOpen} />
    </Shell>
  );
}
