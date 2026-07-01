import { useState } from "react";
import { toast } from "sonner";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Input, Tooltip } from "@heroui/react";
import { Search, Eye, Link2, ShieldCheck, Radar } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill } from "@/components/bits";
import { AddrRiskDrawer } from "@/components/AddrRiskDrawer";
import { toneVar } from "@/lib/data";
import { ADDRS, CAT_META, VERDICT_META, scoreLevel, policyVerdict, screen, shortAddr, type AddrRisk } from "@/lib/onchain";

export default function OnChainIntel() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<AddrRisk | null>(null);

  const rows = ADDRS
    .filter((a) => !q.trim() || a.address.toLowerCase().includes(q.toLowerCase()) || a.categories.some((c) => CAT_META[c].label.includes(q)))
    .map((a) => ({ a, ...policyVerdict(a) }))
    .sort((x, y) => y.a.score - x.a.score);

  const doScreen = () => {
    const r = screen(q);
    if (!r) { toast.error("请输入要筛查的钱包地址"); return; }
    setSel(r);
    if (!ADDRS.some((a) => a.address.toLowerCase() === q.trim().toLowerCase())) toast.success("已调用 KYT · 返回该地址风险画像");
  };

  const block = ADDRS.filter((a) => policyVerdict(a).verdict === "block").length;
  const review = ADDRS.filter((a) => policyVerdict(a).verdict === "review").length;
  const sanctioned = ADDRS.filter((a) => a.exposures.some((e) => e.cat === "sanctioned")).length;
  const tiles = [
    { label: "已筛查地址", n: ADDRS.length, tone: undefined as string | undefined },
    { label: "处置 · 拒绝", n: block, tone: "var(--danger)" },
    { label: "处置 · 转人工", n: review, tone: "var(--warning)" },
    { label: "命中制裁敞口", n: sanctioned, tone: "var(--danger)" },
  ];

  return (
    <Shell crumb={["风控", "检测策略", "链上情报"]} wide>
      <PageHead
        title="链上风险情报 (KYT)"
        sub="对钱包地址做风险画像:供应商提供风险分 / 类别归属 / 资金敞口;本系统据风险策略给出处置(放行 / 复核 / 拒绝),并回链到相关商户 / 团伙 / 告警。"
      />

      {/* 情报源 / 职责边界 */}
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-divider bg-default-50 px-3.5 py-2.5 text-[12.5px] text-default-600">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-default-400" />
        <span><b>情报源</b> = KYT 供应商(Chainalysis / TRM 类,原型内为 mock 响应)· <b>风险策略与处置口径</b> = 本风控系统。制裁命中的 STR 报送 / 裁决归合规系统。</span>
      </div>

      {/* 汇总 */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card px-4 py-3.5">
            <div className="text-[12.5px] text-default-500">{t.label}</div>
            <div className="mt-1.5 text-[26px] font-extrabold leading-none tnum" style={{ color: t.tone }}>{t.n}</div>
          </div>
        ))}
      </div>

      {/* 筛查 */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input size="sm" radius="full" value={q} onValueChange={setQ} placeholder="粘贴 / 搜索钱包地址(0x… / bc1… / T…)或类别…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="max-w-[420px] flex-1"
          onKeyDown={(e) => { if (e.key === "Enter") doScreen(); }}
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
        <Button size="sm" radius="full" color="primary" startContent={<Radar className="h-3.5 w-3.5" />} onPress={doScreen}>筛查地址</Button>
      </div>

      <Table aria-label="链上地址风险" radius="lg"
        classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] whitespace-nowrap", tr: "border-b border-default-100 last:border-0 transition-colors hover:bg-default-50" }}>
        <TableHeader>
          <TableColumn>钱包地址</TableColumn><TableColumn>链</TableColumn><TableColumn>供应商风险分</TableColumn>
          <TableColumn>类别归属</TableColumn><TableColumn>本系统处置</TableColumn><TableColumn>命中策略</TableColumn>
          <TableColumn>见于</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="无匹配地址">
          {rows.map(({ a, verdict, reason }) => {
            const lv = scoreLevel(a.score);
            const v = VERDICT_META[verdict];
            return (
              <TableRow key={a.address}>
                <TableCell><button onClick={() => setSel(a)} className="text-left"><div className="font-semibold">{shortAddr(a.address)}</div>{a.ownEntity && <div className="text-[11px] text-default-400">{a.ownEntity}</div>}</button></TableCell>
                <TableCell><Pill tone="grey" dot={false}>{a.chain}</Pill></TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5"><span className="tnum text-[15px] font-extrabold" style={{ color: toneVar(lv.tone) }}>{a.score}</span><span className="rounded-full bg-default-100 px-1.5 py-px text-[10.5px] font-semibold text-default-500">{lv.label}</span></span></TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {a.categories.map((c) => <span key={c} className="rounded-md border border-divider bg-default-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-default-600">{CAT_META[c].label}</span>)}
                  </div>
                </TableCell>
                <TableCell><Pill tone={v.tone}>{v.label}</Pill></TableCell>
                <TableCell><span className="text-[12px] text-default-500">{reason}</span></TableCell>
                <TableCell>{a.seenIn.length ? <span className="text-default-600">{a.seenIn.length} 处</span> : <span className="text-default-300">—</span>}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Tooltip content="查看风险画像" size="sm" delay={300}><Button isIconOnly aria-label="查看风险画像" size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => setSel(a)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button></Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-default-400"><ShieldCheck className="h-3.5 w-3.5" />处置由风险策略从供应商信号推导(阈值见地址详情"生效风险策略")· 按供应商风险分降序</div>

      <AddrRiskDrawer addr={sel} onClose={() => setSel(null)} />
    </Shell>
  );
}
