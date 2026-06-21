import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Button, Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from "@heroui/react";
import { Search, Download, Eye, FileText } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials, KvRow } from "@/components/bits";
import { alerts, RC_STATES, type Person, type Tone } from "@/lib/data";
import { FINDINGS } from "@/lib/findings";
import { CASES } from "@/lib/cases";
import { alertStore, useAlertVersion, findingStore, useFindingVersion, caseStore, useCaseVersion } from "@/lib/store";

const ME: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
type Outcome = "released" | "rejected" | "watch" | "compliance" | "fp";
const OUTCOME: Record<Outcome, { label: string; tone: Tone }> = {
  released: { label: "已放行", tone: "green" },
  rejected: { label: "已拒绝", tone: "red" },
  watch: { label: "加入名单", tone: "amber" },
  compliance: { label: "转合规 · STR", tone: "violet" },
  fp: { label: "误报关闭", tone: "grey" },
};

interface DispRecord { id: string; to?: string; src?: string; merchant: string; type: string; amount: string; rule: string; outcome: Outcome; by: Person; reason: string; time: string; live?: boolean }

const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const DW: Person = { i: "DW", n: "David Wu", c: "#0ea5e9" };
const EZ: Person = { i: "EZ", n: "Emma Zhang", c: "var(--success)" };

// archived dispositions (terminal outcomes) — the record-of-decisions
const RECORDS: DispRecord[] = [
  { id: "DEP-20260318-007", merchant: "NovaPay Technologies", type: "充值", amount: "CAD 8,200.00", rule: "混币器关联", outcome: "compliance", by: ME, reason: "链上溯源触及制裁混币器,转合规评估 STR", time: "2026-03-18 14:22" },
  { id: "WD-20260318-031", merchant: "BlockTrade Corp.", type: "提现", amount: "CAD 21,400.00", rule: "KYW 评分超阈值", outcome: "rejected", by: SC, reason: "收款钱包高风险,商户无法说明用途", time: "2026-03-18 11:05" },
  { id: "DEP-20260318-019", merchant: "SwiftRemit Inc.", type: "充值", amount: "CAD 3,150.00", rule: "新商户首充", outcome: "released", by: SC, reason: "补充材料已核实,链上来源清晰", time: "2026-03-18 10:48" },
  { id: "DEP-20260317-204", merchant: "QuickWallet Ltd.", type: "充值", amount: "CAD 6,900.00", rule: "高频拆分入金", outcome: "watch", by: DW, reason: "拆分模式可疑,对手地址列加强监控名单", time: "2026-03-17 16:30" },
  { id: "WD-20260317-188", merchant: "GlobalRemit Ltd.", type: "提现", amount: "CAD 48,000.00", rule: "大额提现监控", outcome: "compliance", by: EZ, reason: "分层归集特征,升级 MLRO 已上报 STR", time: "2026-03-17 15:12" },
  { id: "DEP-20260317-142", merchant: "PayFlow Systems", type: "充值", amount: "CAD 1,200.00", rule: "大额充值监控", outcome: "released", by: ME, reason: "与历史交易模式一致,风险可控", time: "2026-03-17 13:55" },
  { id: "DEP-20260317-090", merchant: "NovaPay Technologies", type: "充值", amount: "CAD 980.00", rule: "新商户首充", outcome: "fp", by: SC, reason: "规则误命中,加入可信白名单", time: "2026-03-17 09:41" },
  { id: "WD-20260316-256", merchant: "HavenPay Inc.", type: "提现", amount: "CAD 33,500.00", rule: "混币器关联", outcome: "rejected", by: DW, reason: "出口地址关联隐私币,驳回出金", time: "2026-03-16 17:20" },
  { id: "DEP-20260316-178", merchant: "BlockTrade Corp.", type: "充值", amount: "CAD 5,400.00", rule: "大额充值监控", outcome: "released", by: SC, reason: "KYB 完成,资金来源证明充分", time: "2026-03-16 14:08" },
  { id: "WD-20260316-101", merchant: "RapidPay", type: "提现", amount: "CAD 12,700.00", rule: "众包养卡关联", outcome: "compliance", by: EZ, reason: "设备群聚类命中团伙,转合规并入案件", time: "2026-03-16 10:33" },
  { id: "DEP-20260315-220", merchant: "SwiftRemit Inc.", type: "充值", amount: "CAD 2,050.00", rule: "高频拆分入金", outcome: "fp", by: ME, reason: "正常分批入金,误报关闭", time: "2026-03-15 16:50" },
  { id: "DEP-20260315-150", merchant: "PayFlow Systems", type: "充值", amount: "CAD 7,800.00", rule: "新商户首充", outcome: "watch", by: DW, reason: "新商户高额首充,纳入加强监控名单", time: "2026-03-15 11:27" },
];

const TILES: { f: string; label: string }[] = [
  { f: "all", label: "全部" },
  { f: "released", label: "已放行" },
  { f: "rejected", label: "已拒绝" },
  { f: "watch", label: "加入名单" },
  { f: "compliance", label: "转合规" },
  { f: "fp", label: "误报关闭" },
];

export default function Dispositions() {
  const nav = useNavigate();
  useAlertVersion();
  useFindingVersion();
  useCaseVersion();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [rec, setRec] = useState<DispRecord | null>(null);
  const [open, setOpen] = useState(false);

  // live: alerts decided this session (terminal state) flow into the archive at the top
  const stOf = (id: string, base: string) => alertStore.stateOf(id, base);
  const live: DispRecord[] = alerts
    .filter((a) => !RC_STATES[stOf(a.id, a.state)].active)
    .map((a) => {
      const st = stOf(a.id, a.state);
      const outcome: Outcome = st === "closed_fp" ? "fp" : st === "closed_case" ? "rejected" : "released";
      const evs = alertStore.eventsOf(a.id);
      const last = evs[evs.length - 1];
      return { id: a.order, to: `/alert?id=${a.id}`, src: "事中 / 告警研判", merchant: a.merchant, type: a.type, amount: a.amount, rule: a.title, outcome, by: alertStore.assigneeOf(a.id, a.assignee) || ME, reason: last?.reason || last?.text || "系统归档", time: a.submitted, live: true };
    });
  // 事后监控已结案命中也归档进来(全口径处置归档,带来源标记)
  const fin: DispRecord[] = FINDINGS
    .filter((f) => findingStore.statusOf(f.id, f.status).startsWith("closed"))
    .map((f) => {
      const st = findingStore.statusOf(f.id, f.status);
      const outcome: Outcome = st === "closed_fp" ? "fp" : "compliance"; // 转报送/转案件 → 转合规·STR/案件
      return { id: f.id, to: `/finding?id=${f.id}`, src: "事后监控", merchant: f.subject, type: "事后", amount: f.amount, rule: f.rule, outcome, by: findingStore.ownerOf(f.id, f.owner) || ME, reason: f.hit, time: f.batch };
    });
  // 案件管理已结案的案件也归档进来(案件 = 调查与处置闭环的容器)
  const caseRecs: DispRecord[] = [...caseStore.created(), ...CASES]
    .filter((c) => caseStore.stateOf(c.id, c.state) === "closed")
    .map((c) => {
      const evs = caseStore.eventsOf(c.id);
      const last = evs[evs.length - 1];
      const fp = evs.some((e) => /误报/.test(e.text));
      return { id: c.id, to: `/case?id=${c.id}`, src: "案件管理", merchant: c.subject, type: c.type, amount: c.amount, rule: c.risk, outcome: (fp ? "fp" : "compliance") as Outcome, by: caseStore.ownerOf(c.id, c.owner) || ME, reason: last?.reason || last?.text || "案件结案归档", time: c.submitted };
    });
  const records = [...live, ...fin, ...caseRecs, ...RECORDS];

  const count = (f: string) => (f === "all" ? records.length : records.filter((r) => r.outcome === f).length);
  const rows = records.filter((r) => {
    const okF = filter === "all" || r.outcome === filter;
    const okQ = !q.trim() || (r.id + r.merchant + r.rule).toLowerCase().includes(q.toLowerCase());
    return okF && okQ;
  });

  // 有关联原始记录的(本会话决策 / 事后命中)跳详情页;静态归档记录开只读详情抽屉
  const view = (r: DispRecord) => { if (r.to) nav(r.to); else { setRec(r); setOpen(true); } };

  return (
    <Shell crumb={["交易", "交易监控", "处置记录"]} wide>
      <PageHead
        title="处置记录"
        sub="已决策订单的归档 —— 风控放行 / 拒绝、加入名单、转合规、误报关闭 的终态留档,供复盘与审计查询;实际报送在「报告报送」、建案在「案件管理」。"
        actions={<Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<Download className="h-3.5 w-3.5" />}>导出</Button>}
      />

      {/* outcome filter tiles */}
      <div className="mb-5 grid grid-cols-3 gap-3.5 md:grid-cols-6">
        {TILES.map((t) => {
          const on = filter === t.f;
          return (
            <button key={t.f} onClick={() => setFilter(t.f)} className={`card card-hover px-4 py-3.5 text-left ${on ? "outline outline-2 -outline-offset-2 outline-[var(--brand)]" : ""}`}>
              <div className="text-[12.5px] text-default-500">{t.label}</div>
              <div className="mt-1.5 text-[26px] font-extrabold leading-none tnum" style={{ color: on ? "var(--brand)" : undefined }}>{count(t.f)}</div>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input size="sm" radius="full" value={q} onValueChange={setQ} placeholder="搜索订单号、商户或触发规则…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="max-w-[360px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
        <span className="ml-auto text-[12.5px] text-default-400">共 {records.length} 条处置记录</span>
      </div>

      <Table aria-label="处置记录" radius="lg"
        classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] whitespace-nowrap", tr: "border-b border-default-100 last:border-0 transition-colors data-[hover=true]:bg-default-50 hover:bg-default-50" }}>
        <TableHeader>
          <TableColumn>订单号 / 交易ID</TableColumn><TableColumn>商户名称</TableColumn><TableColumn>类型</TableColumn>
          <TableColumn>金额</TableColumn><TableColumn>触发规则</TableColumn><TableColumn>处置结果</TableColumn>
          <TableColumn>决策人</TableColumn><TableColumn>处置原因</TableColumn><TableColumn>处置时间</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="没有符合条件的处置记录">
          {rows.map((r, i) => {
            const o = OUTCOME[r.outcome];
            return (
              <TableRow key={r.id + i}>
                <TableCell><span className="inline-flex items-center gap-2 font-medium">{r.id}{r.live && <span className="rounded bg-success/10 px-1.5 text-[10px] font-bold text-success">今日</span>}</span>{r.src && <span className="mt-0.5 block w-fit rounded bg-default-100 px-1.5 text-[10px] font-semibold text-default-500">{r.src}</span>}</TableCell>
                <TableCell><span className="font-semibold">{r.merchant}</span></TableCell>
                <TableCell><span className="text-default-600">{r.type}</span></TableCell>
                <TableCell><span className="font-semibold tnum">{r.amount}</span></TableCell>
                <TableCell><span className="text-default-600">{r.rule}</span></TableCell>
                <TableCell><Pill tone={o.tone}>{o.label}</Pill></TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5"><Initials p={r.by} size={22} />{r.by.n}</span></TableCell>
                <TableCell><span className="block max-w-[260px] truncate text-default-500" title={r.reason}>{r.reason}</span></TableCell>
                <TableCell><span className="text-default-500 tnum">{r.time}</span></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end">
                    <Button isIconOnly size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => view(r)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* 归档处置详情(只读)—— 静态归档记录无关联详情页,在此查看 */}
      <Drawer isOpen={open} onOpenChange={setOpen} placement="right" size="md" classNames={{ base: "!w-[46vw] !min-w-[440px] !max-w-[760px]" }}>
        <DrawerContent>
          {rec && (() => { const o = OUTCOME[rec.outcome]; return (
            <>
              <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
                <span className="text-[15px] font-bold">处置详情 · 归档</span>
                <span className="text-[11.5px] font-normal text-default-400">{rec.id} · {rec.merchant}</span>
              </DrawerHeader>
              <DrawerBody className="gap-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-default-100 text-default-500"><FileText className="h-4 w-4" /></span>
                  <Pill tone={o.tone}>{o.label}</Pill>
                  {rec.src && <span className="rounded bg-default-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-default-500">{rec.src}</span>}
                </div>
                <div className="card p-3.5">
                  <KvRow label="订单号 / 交易ID">{rec.id}</KvRow>
                  <KvRow label="商户名称">{rec.merchant}</KvRow>
                  <KvRow label="类型">{rec.type}</KvRow>
                  <KvRow label="金额">{rec.amount}</KvRow>
                  <KvRow label="触发规则">{rec.rule}</KvRow>
                  <KvRow label="处置结果"><Pill tone={o.tone}>{o.label}</Pill></KvRow>
                  <KvRow label="决策人"><span className="inline-flex items-center gap-1.5"><Initials p={rec.by} size={20} />{rec.by.n}</span></KvRow>
                  <KvRow label="处置时间">{rec.time}</KvRow>
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-default-400">处置原因</div>
                  <p className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] leading-relaxed text-default-600">{rec.reason}</p>
                </div>
                <p className="rounded-xl border border-divider bg-default-100 p-3 text-[11.5px] leading-relaxed text-default-500">本条为<b>终态归档记录</b>(只读),供复盘与审计查询。实际报送在「报告报送」、建案在「案件管理」。</p>
              </DrawerBody>
              <DrawerFooter className="border-t border-divider">
                <Button variant="bordered" onPress={() => setOpen(false)}>关闭</Button>
              </DrawerFooter>
            </>
          ); })()}
        </DrawerContent>
      </Drawer>
    </Shell>
  );
}
