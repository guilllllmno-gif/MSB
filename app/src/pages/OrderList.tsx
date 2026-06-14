import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, RiskBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { orders, riskLevel, type OrderType } from "@/lib/data";

const TYPES: (OrderType | "全部")[] = ["全部", "充值", "提现", "兑换", "A2A"];
const STATUSES = ["全部", "待审核", "审核中", "暂缓入账", "待补充材料", "已通过", "已拒绝", "已冻结"];

function riskShort(s: number) { return s >= 70 ? "高" : s >= 40 ? "中" : "低"; }

export default function OrderList() {
  const nav = useNavigate();
  const [type, setType] = useState<string>("全部");
  const [status, setStatus] = useState("全部");
  const [q, setQ] = useState("");

  const rows = useMemo(() => orders.filter((o) =>
    (type === "全部" || o.type === type) &&
    (status === "全部" || o.status === status) &&
    (!q.trim() || o.id.toLowerCase().includes(q.toLowerCase()) || o.merchant.toLowerCase().includes(q.toLowerCase()))
  ), [type, status, q]);

  const typeCount = (t: string) => (t === "全部" ? orders.length : orders.filter((o) => o.type === t).length);
  const pending = orders.filter((o) => ["待审核", "审核中", "暂缓入账", "待补充材料"].includes(o.status)).length;

  return (
    <Shell crumb={["审核", "订单管理", "订单列表"]}>
      <PageHead title="订单管理" sub={`充值 / 提现 / 兑换 / A2A 订单审核队列 · 当前 ${pending} 笔待处置`} />

      <Tabs value={type} onValueChange={setType} className="mb-3.5">
        <TabsList>
          {TYPES.map((t) => <TabsTrigger key={t} value={t}>{t}<Pill tone="grey" dot={false}>{typeCount(t)}</Pill></TabsTrigger>)}
        </TabsList>
      </Tabs>

      {/* toolbar */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-9 min-w-[260px] max-w-[380px] flex-1 items-center gap-2 rounded-lg border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索订单号 / 商户" className="flex-1 bg-transparent text-[13px] outline-none" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${status === s ? "text-white" : "bg-card text-muted-foreground hover:bg-secondary"}`}
              style={status === s ? { background: "var(--brand)", borderColor: "var(--brand)" } : undefined}>{s}</button>
          ))}
        </div>
      </div>

      {/* table */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>订单号</TableHead><TableHead>类型</TableHead><TableHead>商户</TableHead>
            <TableHead className="text-right">金额</TableHead><TableHead>匹配规则</TableHead><TableHead>风险</TableHead>
            <TableHead>状态</TableHead><TableHead>分配给</TableHead><TableHead>提交时间</TableHead><TableHead>SLA</TableHead><TableHead className="text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((o) => {
              const lvl = riskLevel(o.risk);
              return (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => nav(`/order?id=${o.id}`)}>
                  <TableCell><span className="font-mono text-[12px] font-semibold" style={{ color: "var(--brand)" }}>{o.id}</span></TableCell>
                  <TableCell><Pill tone={o.type === "充值" ? "blue" : o.type === "提现" ? "violet" : o.type === "兑换" ? "amber" : "grey"} dot={false}>{o.type}</Pill></TableCell>
                  <TableCell className="text-[12.5px]">{o.merchant}</TableCell>
                  <TableCell className="text-right tnum font-semibold">{o.cad}</TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">{o.rule}</TableCell>
                  <TableCell><RiskBadge tone={lvl.tone}>{riskShort(o.risk)} {o.risk}</RiskBadge></TableCell>
                  <TableCell><Pill tone={o.statusTone}>{o.status}</Pill></TableCell>
                  <TableCell className="text-[12.5px]">{o.assignee}</TableCell>
                  <TableCell className="tnum text-[12px] text-muted-foreground">{o.submitted}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{o.slaText}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); nav(`/order?id=${o.id}`); }}>审核</Button></TableCell>
                </TableRow>
              );
            })}
            {!rows.length && <TableRow><TableCell colSpan={11} className="py-10 text-center text-muted-foreground">没有符合条件的订单。</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-4 py-3 text-[12.5px] text-muted-foreground">
          <span>共 {rows.length} 笔</span>
          <span>仅展示当前页</span>
        </div>
      </Card>
    </Shell>
  );
}