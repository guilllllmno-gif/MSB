import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tooltip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input } from "@heroui/react";
import { Eye, Clock, Search, UserRound, UserPlus, ClipboardCheck, Plus, ExternalLink } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { NewCaseDrawer } from "@/components/NewCaseDrawer";
import { CASES, CSTATE, strLabel, RISK_TYPES, type Case, type CState } from "@/lib/cases";
import { caseStore, useCaseVersion } from "@/lib/store";
import { urgencyColor } from "@/lib/data";

const ME = { i: "JL", n: "James Liu", c: "var(--brand)" };
const TILES: { f: string; label: string }[] = [
  { f: "all", label: "全部" },
  { f: "investigating", label: "调查中" },
  { f: "str_draft", label: "STR 草稿" },
  { f: "mlro", label: "MLRO 评估" },
  { f: "queued", label: "待报送" },
  { f: "filed", label: "已报送" },
  { f: "closed", label: "已结案" },
  { f: "merged", label: "已合并" },
];

export default function CaseList() {
  const nav = useNavigate();
  useCaseVersion();
  const [filter, setFilter] = useState("all");
  const [risk, setRisk] = useState("all");
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const all: Case[] = [...caseStore.created(), ...CASES];
  const stOf = (c: Case) => caseStore.stateOf(c.id, c.state) as CState;

  const count = (key: string) => all.filter((c) => key === "all" || stOf(c) === key).length;
  const rows = all.filter((c) => {
    const okF = filter === "all" || stOf(c) === filter;
    const okR = risk === "all" || c.risk === risk;
    const okQ = !q.trim() || (c.id + c.subject + c.type).toLowerCase().includes(q.toLowerCase());
    return okF && okR && okQ;
  });

  const review = (c: Case) => nav(`/case?id=${c.id}`);

  return (
    <Shell crumb={["调查", "案件管理"]} wide>
      <PageHead
        title="案件管理"
        sub="事中冻结 / 驳回、告警升级、事后转案件、团伙转案件 形成的合规案件 —— 认领调查、合并关联案件、起草 STR、推进至报告报送与结案。"
        actions={<Button size="sm" radius="full" color="primary" startContent={<Plus className="h-3.5 w-3.5" />} onPress={() => setNewOpen(true)}>新增案件</Button>}
      />

      {/* 状态分桶 tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {TILES.map((t) => {
          const on = filter === t.f;
          return (
            <button key={t.f} onClick={() => setFilter(t.f)} className={`card card-hover px-3 py-3 text-left ${on ? "outline outline-2 -outline-offset-2 outline-[var(--brand)]" : ""}`}>
              <div className="text-[11.5px] text-default-500">{t.label}</div>
              <div className="mt-1.5 text-[22px] font-extrabold leading-none tnum" style={{ color: on ? "var(--brand)" : undefined }}>{count(t.f)}</div>
            </button>
          );
        })}
      </div>

      {/* 风险类型筛选 + 搜索 */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setRisk("all")} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${risk === "all" ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:bg-default-100"}`}>全部类型</button>
          {RISK_TYPES.map((r) => {
            const on = risk === r;
            return <button key={r} onClick={() => setRisk(r)} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-divider text-default-500 hover:bg-default-100"}`}>{r}</button>;
          })}
        </div>
        <Input size="sm" radius="full" value={q} onValueChange={setQ} placeholder="搜索案件号、主体…" startContent={<Search className="h-4 w-4 text-default-400" />} className="ml-auto max-w-[280px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
      </div>

      {/* 案件表 */}
      <Table aria-label="案件管理" radius="lg" classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] align-top whitespace-nowrap", tr: "border-b border-default-100 last:border-0 transition-colors data-[hover=true]:bg-default-50 hover:bg-default-50" }}>
        <TableHeader>
          <TableColumn>案件号 / 来源</TableColumn><TableColumn>主体</TableColumn><TableColumn>类型</TableColumn><TableColumn>优先级</TableColumn>
          <TableColumn>金额</TableColumn><TableColumn>关联</TableColumn><TableColumn>STR</TableColumn><TableColumn>状态</TableColumn>
          <TableColumn>分配给</TableColumn><TableColumn>SLA剩余</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="没有符合条件的案件">
          {rows.map((c) => {
            const st = stOf(c);
            const owner = caseStore.ownerOf(c.id, c.owner);
            const str = strLabel(st);
            const active = CSTATE[st].active;
            return (
              <TableRow key={c.id}>
                <TableCell><button onClick={() => review(c)} className="text-left"><span className="font-semibold">{c.id}</span><div className="mt-0.5"><span className="rounded bg-default-100 px-1.5 py-0.5 text-[10px] font-semibold text-default-500">{c.src}</span></div></button></TableCell>
                <TableCell><span className="font-medium">{c.subject}</span><div className="text-[11px] text-default-400">{c.sub}</div></TableCell>
                <TableCell><span className="text-default-600">{c.type}</span></TableCell>
                <TableCell><Pill tone="grey" dot={false}>{c.priority}</Pill></TableCell>
                <TableCell><span className="font-semibold tnum">{c.amount}</span></TableCell>
                <TableCell>{c.linkTo ? <button onClick={() => nav(c.linkTo!)} className="inline-flex items-center gap-1 text-primary hover:opacity-80">{c.links} 项</button> : <span className="text-default-500">{c.links} 项</span>}</TableCell>
                <TableCell>{str.link ? <button onClick={() => nav("/reports")} className="inline-flex items-center gap-1 text-[12.5px] font-medium hover:opacity-80" style={{ color: str.tone === "green" ? "var(--success)" : str.tone === "amber" ? "var(--warning)" : "var(--brand)" }}>{str.text}<ExternalLink className="h-3 w-3" /></button> : <span className="text-[12.5px] text-default-400">{str.text}</span>}</TableCell>
                <TableCell><Pill tone={CSTATE[st].tone}>{CSTATE[st].label}</Pill></TableCell>
                <TableCell>{owner ? <span className="inline-flex items-center gap-1.5"><Initials p={owner} size={22} />{owner.n}</span> : <span className="inline-flex items-center gap-1.5 text-default-400"><UserRound className="h-3.5 w-3.5" />未分配</span>}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1" style={{ color: urgencyColor(c.sla.tone) }}><Clock className="h-3.5 w-3.5" />{c.sla.text}</span></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Tooltip content="查看 / 推进" size="sm" delay={300}><Button isIconOnly aria-label="查看 / 推进" size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => review(c)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button></Tooltip>
                    {active && (!owner
                      ? <Tooltip content="认领案件" size="sm" delay={300}><Button size="sm" radius="full" color="primary" variant="flat" startContent={<UserPlus className="h-3.5 w-3.5" />} onPress={() => { caseStore.set(c.id, st, { owner: ME, event: "认领案件 · 开始调查" }); }}>认领</Button></Tooltip>
                      : <Tooltip content="研判推进" size="sm" delay={300}><Button size="sm" radius="full" color="primary" variant="flat" startContent={<ClipboardCheck className="h-3.5 w-3.5" />} onPress={() => review(c)}>审核</Button></Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <NewCaseDrawer open={newOpen} onOpenChange={setNewOpen} />
    </Shell>
  );
}
