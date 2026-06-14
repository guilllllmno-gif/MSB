import { useState } from "react";
import { toast } from "sonner";
import { Pencil, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Pill } from "@/components/bits";
import { depositFees, withdrawFees, exchangeSpreads, type DepositFee, type WithdrawFee, type SpreadRow } from "@/lib/data";

type Section = "deposit" | "withdraw" | "spread" | null;

function SectionTitle({ icon, children, onEdit }: { icon: React.ReactNode; children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="mb-3 mt-1 flex items-center gap-2">
      <span style={{ color: "var(--brand)" }}>{icon}</span>
      <h3 className="text-[15px] font-bold">{children}</h3>
      <Button size="sm" variant="outline" className="ml-auto" onClick={onEdit}><Pencil className="h-3.5 w-3.5" />编辑</Button>
    </div>
  );
}

export function ConfigTab() {
  const [deposit, setDeposit] = useState<DepositFee[]>([]);
  const [withdraw, setWithdraw] = useState<WithdrawFee[]>(withdrawFees.map((x) => ({ ...x })));
  const [spreads, setSpreads] = useState<SpreadRow[]>(exchangeSpreads.map((x) => ({ ...x })));
  const [editing, setEditing] = useState<Section>(null);

  // draft copies edited inside the dialog
  const [dDraft, setDDraft] = useState<DepositFee[]>([]);
  const [wDraft, setWDraft] = useState<WithdrawFee[]>([]);
  const [sDraft, setSDraft] = useState<SpreadRow[]>([]);

  const open = (s: Section) => {
    if (s === "deposit") setDDraft(deposit.map((x) => ({ ...x })));
    if (s === "withdraw") setWDraft(withdraw.map((x) => ({ ...x })));
    if (s === "spread") setSDraft(spreads.map((x) => ({ ...x })));
    setEditing(s);
  };

  const save = () => {
    if (editing === "deposit") setDeposit(dDraft);
    if (editing === "withdraw") setWithdraw(wDraft);
    if (editing === "spread") setSpreads(sDraft.map((x) => ({ ...x, effective: "待审批" })));
    toast.success("已提交费率变更审批 · 生效前状态为「待审批」,并记入活动日志");
    setEditing(null);
  };

  const title = editing === "deposit" ? "编辑充值手续费" : editing === "withdraw" ? "编辑提现手续费" : "编辑兑换加点 · 点差";

  return (
    <div className="flex flex-col gap-6">
      {/* 充值手续费 */}
      <div>
        <SectionTitle icon={<ArrowUpRight className="h-4 w-4" />} onEdit={() => open("deposit")}>充值手续费</SectionTitle>
        <Card className="overflow-hidden p-0"><Table>
          <TableHeader><TableRow><TableHead>资产</TableHead><TableHead>网络</TableHead><TableHead>费率</TableHead><TableHead>最低收取</TableHead><TableHead className="text-right">状态</TableHead></TableRow></TableHeader>
          <TableBody>{deposit.map((f) => (
            <TableRow key={f.asset + f.chain}>
              <TableCell className="font-semibold">{f.asset}</TableCell>
              <TableCell className="text-[12.5px] text-muted-foreground">{f.chain}</TableCell>
              <TableCell className="tnum font-semibold">{f.rate}</TableCell>
              <TableCell className="tnum">{f.min}</TableCell>
              <TableCell className="text-right">{f.enabled ? <Pill tone="green">启用</Pill> : <Pill tone="grey">停用</Pill>}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></Card>
      </div>

      {/* 提现手续费 */}
      <div>
        <SectionTitle icon={<ArrowUpRight className="h-4 w-4 rotate-180" />} onEdit={() => open("withdraw")}>提现手续费</SectionTitle>
        <Card className="overflow-hidden p-0"><Table>
          <TableHeader><TableRow><TableHead>资产</TableHead><TableHead>网络</TableHead><TableHead>单笔手续费</TableHead><TableHead>日累计上限</TableHead><TableHead className="text-right">状态</TableHead></TableRow></TableHeader>
          <TableBody>{withdraw.map((f) => (
            <TableRow key={f.asset + f.chain}>
              <TableCell className="font-semibold">{f.asset}</TableCell>
              <TableCell className="text-[12.5px] text-muted-foreground">{f.chain}</TableCell>
              <TableCell className="tnum font-semibold">{f.fee}</TableCell>
              <TableCell className="tnum">{f.dailyCap}</TableCell>
              <TableCell className="text-right">{f.enabled ? <Pill tone="green">启用</Pill> : <Pill tone="grey">停用</Pill>}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></Card>
      </div>

      {/* 兑换加点 */}
      <div>
        <SectionTitle icon={<RefreshCw className="h-4 w-4" />} onEdit={() => open("spread")}>兑换加点 · 点差</SectionTitle>
        <Card className="overflow-hidden p-0"><Table>
          <TableHeader><TableRow><TableHead>交易对</TableHead><TableHead>点差(spread)</TableHead><TableHead>审批点差覆盖</TableHead><TableHead className="text-right">状态</TableHead></TableRow></TableHeader>
          <TableBody>{spreads.map((s) => (
            <TableRow key={s.pair}>
              <TableCell className="font-semibold">{s.pair}</TableCell>
              <TableCell className="tnum font-semibold">{s.spread}</TableCell>
              <TableCell className="tnum text-muted-foreground">{s.approvalCap}</TableCell>
              <TableCell className="text-right"><Pill tone={s.effective === "生效中" ? "green" : "amber"}>{s.effective}</Pill></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></Card>
        <p className="mt-2 text-[11.5px] text-muted-foreground">点差为基础加点(bps);超出「审批点差覆盖」需经合规复核。所有费率变更走变更审批并记入活动日志。</p>
      </div>

      {/* ── 编辑弹窗 ── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>修改后将提交变更审批,生效前不影响线上费率。带 <span style={{ color: "var(--danger)" }}>*</span> 为必填。</DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto py-1">
            {editing === "deposit" && dDraft.map((r, i) => (
              <div key={i} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{r.asset} <span className="text-muted-foreground">· {r.chain}</span></span>
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Checkbox checked={r.enabled} onCheckedChange={(v) => setDDraft((p) => p.map((x, j) => (j === i ? { ...x, enabled: !!v } : x)))} />启用
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="费率">
                    <Input value={r.rate} onChange={(e) => setDDraft((p) => p.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} />
                  </Field>
                  <Field label="最低收取">
                    <Input value={r.min} onChange={(e) => setDDraft((p) => p.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))} />
                  </Field>
                </div>
              </div>
            ))}

            {editing === "withdraw" && wDraft.map((r, i) => (
              <div key={i} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{r.asset} <span className="text-muted-foreground">· {r.chain}</span></span>
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Checkbox checked={r.enabled} onCheckedChange={(v) => setWDraft((p) => p.map((x, j) => (j === i ? { ...x, enabled: !!v } : x)))} />启用
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="单笔手续费"><Input value={r.fee} onChange={(e) => setWDraft((p) => p.map((x, j) => (j === i ? { ...x, fee: e.target.value } : x)))} /></Field>
                  <Field label="日累计上限"><Input value={r.dailyCap} onChange={(e) => setWDraft((p) => p.map((x, j) => (j === i ? { ...x, dailyCap: e.target.value } : x)))} /></Field>
                </div>
              </div>
            ))}

            {editing === "spread" && sDraft.map((r, i) => (
              <div key={i} className="rounded-xl border p-3">
                <div className="mb-2 text-[13px] font-semibold">{r.pair}</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="点差 (spread)"><Input value={r.spread} onChange={(e) => setSDraft((p) => p.map((x, j) => (j === i ? { ...x, spread: e.target.value } : x)))} /></Field>
                  <Field label="审批点差覆盖"><Input value={r.approvalCap} onChange={(e) => setSDraft((p) => p.map((x, j) => (j === i ? { ...x, approvalCap: e.target.value } : x)))} /></Field>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button style={{ background: "var(--brand)" }} onClick={save}>提交变更审批</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11.5px] font-semibold text-muted-foreground">{label} <span style={{ color: "var(--danger)" }}>*</span></label>
      {children}
    </div>
  );
}