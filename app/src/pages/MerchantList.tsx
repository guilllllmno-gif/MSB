import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Filter, Calendar, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { RiskBadge, Pill, Mono } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { merchantList, riskLevel, type Tone } from "@/lib/data";

const PER_PAGE = 10;

function riskShort(score: number) {
  return score >= 70 ? "高" : score >= 40 ? "中" : "低";
}

export default function MerchantList() {
  const nav = useNavigate();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);

  // counts per status (derived)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: merchantList.length };
    merchantList.forEach((m) => (c[m.status] = (c[m.status] || 0) + 1));
    return c;
  }, []);

  const tiles: { key: string; label: string; tone: Tone }[] = [
    { key: "all", label: "全部", tone: "blue" },
    { key: "已通过", label: "已通过", tone: "green" },
    { key: "待审核", label: "待审核", tone: "amber" },
    { key: "已拒绝", label: "已拒绝", tone: "red" },
    { key: "待补充材料", label: "待补充材料", tone: "blue" },
  ];

  const filtered = useMemo(() => {
    let rows = merchantList.filter((m) => (status === "all" || m.status === status));
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      rows = rows.filter((m) => m.name.toLowerCase().includes(k) || m.mid.toLowerCase().includes(k));
    }
    if (sortAsc !== null) rows = [...rows].sort((a, b) => (sortAsc ? a.risk - b.risk : b.risk - a.risk));
    return rows;
  }, [status, q, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);
  const from = filtered.length ? (curPage - 1) * PER_PAGE + 1 : 0;
  const to = Math.min(curPage * PER_PAGE, filtered.length);

  const toneVar = (t: Tone) => `var(--${t === "green" ? "success" : t === "amber" ? "warning" : t === "red" ? "danger" : t === "violet" ? "violet" : "brand"})`;

  return (
    <Shell crumb={["商户", "商户管理", "商户列表"]}>
      <PageHead title="商户列表" sub={`共 ${merchantList.length} 个商户 · ${counts["已通过"] || 0} 个正常运营`} />

      {/* status filter tiles */}
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-5">
        {tiles.map((t) => {
          const on = status === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setStatus(t.key); setPage(1); }}
              className="rounded-xl border bg-card p-4 text-left transition-all"
              style={on ? { borderColor: "var(--brand)", boxShadow: "0 0 0 2px var(--brand-soft)" } : undefined}
            >
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneVar(t.tone) }} />{t.label}
              </div>
              <div className="mt-1.5 text-2xl font-extrabold tnum" style={on ? { color: "var(--brand)" } : undefined}>{counts[t.key] || 0}</div>
            </button>
          );
        })}
      </div>

      {/* toolbar */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-9 min-w-[260px] max-w-[420px] flex-1 items-center gap-2 rounded-lg border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="搜索商户名称或 MID" className="flex-1 bg-transparent text-[13px] outline-none" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm"><SlidersHorizontal className="h-3.5 w-3.5" />审核状态</Button>
          <Button variant="outline" size="sm" onClick={() => { setSortAsc((s) => (s === null ? false : !s)); }}><Filter className="h-3.5 w-3.5" />风险评分</Button>
          <Button variant="outline" size="sm"><Calendar className="h-3.5 w-3.5" />日期</Button>
        </div>
      </div>

      {/* table */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>商户名称及国家</TableHead>
              <TableHead className="text-right">法币余额</TableHead>
              <TableHead>
                <button className="inline-flex items-center gap-1" onClick={() => setSortAsc((s) => (s === null ? false : !s))}>
                  风险评分
                  {sortAsc === null ? <ArrowDown className="h-3.5 w-3.5 opacity-40" /> : sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                </button>
              </TableHead>
              <TableHead>审核状态</TableHead>
              <TableHead>入驻时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((m) => {
              const lvl = riskLevel(m.risk);
              return (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => nav("/merchant")}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[11px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,var(--brand),#4f8ef7)" }}>
                        {m.name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">{m.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">{m.flag} {m.country} · <Mono>{m.mid}</Mono></div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tnum">{m.balance}</TableCell>
                  <TableCell><RiskBadge tone={lvl.tone}>{riskShort(m.risk)} {m.risk}</RiskBadge></TableCell>
                  <TableCell><Pill tone={m.statusTone}>{m.status}</Pill></TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground tnum">{m.onboarded}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); nav("/merchant"); }}>查看</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!pageRows.length && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">没有符合条件的商户。</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        {/* pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-[12.5px] text-muted-foreground">
          <span>显示 {from}-{to} · 全部 {filtered.length} 条</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}><ChevronLeft className="h-3.5 w-3.5" />上一页</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button key={p} size="sm" variant={p === curPage ? "default" : "outline"} className="min-w-9" style={p === curPage ? { background: "var(--brand)" } : undefined} onClick={() => setPage(p)}>{p}</Button>
            ))}
            <Button variant="outline" size="sm" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>下一页<ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </Card>
    </Shell>
  );
}
