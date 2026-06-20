import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Select, SelectItem } from "@heroui/react";
import { Coins, RefreshCw, Snowflake, AlertTriangle, ArrowUpRight, UserX, ShieldPlus, ClipboardCheck } from "lucide-react";
import { Pill, SectionLabel } from "./bits";
import { findingOf, TRACE, traceTier, traceRecovery } from "@/lib/findings";
import { findingStore, useFindingVersion } from "@/lib/store";

// 追溯处置工作台(右侧抽屉,与审核抽屉同款)—— 仅追溯中状态。
// 重心:报送 + 止损 + 留痕(资金常不可逆,不依赖追回)。止损 / 追回动作即时生效;结案(转报送 / 转案件)在「审核」抽屉。
export function TraceDrawer({ findingId, open, onOpenChange, onReview }: { findingId: string | null; open: boolean; onOpenChange: (o: boolean) => void; onReview?: () => void }) {
  useFindingVersion();
  const nav = useNavigate();
  const f = findingOf(findingId || undefined);

  const tr = findingStore.traceOf(f.id, f.trace);
  const bf = findingStore.backfillOf(f.id, f.backfill);
  const frozen = findingStore.frozenOf(f.id);
  const loss = findingStore.lossOf(f.id);
  const restricted = findingStore.restrictedOf(f.id);
  const listed = findingStore.listedOf(f.id);

  const updateTrace = (v: string) => { if (v) { const rec = traceRecovery(v); findingStore.set(f.id, { trace: v, frozen: rec.frozen, lossReported: rec.lossReported, event: `更新追溯评估:${v}` }); } };
  const doBackfill = () => { findingStore.set(f.id, { backfill: true, event: "规则回填检测规则" }); toast(`已回填检测规则 · typology「${f.pattern}」事中即时拦截`); };
  const reqFreeze = () => { findingStore.set(f.id, { frozen: true, event: "请求下游交易所冻结" }); toast.success(`${f.id} · 已请求下游冻结`); };
  const reportLoss = () => { findingStore.set(f.id, { lossReported: true, event: "上报已发生损失" }); toast.success(`${f.id} · 已上报已发生损失`); };
  const restrict = () => { findingStore.set(f.id, { restricted: true, event: "限制 / 封禁账户 · 止损" }); toast.success(`${f.id} · 已限制账户`); };
  const addList = () => { findingStore.set(f.id, { listed: true, event: "对手地址 / 主体列名单" }); toast.success(`${f.id} · 已列入名单`); };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[50vw] !min-w-[460px] !max-w-[820px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">追溯处置 · 资金已出账</span>
          <span className="text-[11.5px] font-normal text-default-400">{f.id} · {f.pattern} · {f.subject}</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {restricted && <Pill tone="red">已限制账户</Pill>}
            {listed && <Pill tone="amber">已列名单</Pill>}
            {frozen && <Pill tone="green">已请求下游冻结</Pill>}
            {loss && <Pill tone="amber">已上报损失</Pill>}
            {bf && <Pill tone="green">已回填规则</Pill>}
            {!restricted && !listed && !frozen && !loss && !bf && <span className="text-[12px] text-default-400">尚未执行追溯处置动作</span>}
          </div>

          <p className="rounded-xl border border-divider bg-default-50 p-3 text-[11.5px] leading-relaxed text-default-500">
            钱已出账多半不可逆,确认可疑的客户也大概率已流失 —— 追溯重点不是"追回",而是<b className="text-default-600">履行报送义务 + 止损(封号 / 列名单 / 规则回填) + 审计留痕</b>;限制 / 封禁即结束该客户关系,在确认可疑下是预期止损,非误伤。能追回只是加分项。下列动作<b className="text-default-600">即时生效</b>。
          </p>

          <div>
            <Select size="sm" label="资金追溯评估" labelPlacement="outside" aria-label="资金追溯评估" selectedKeys={tr ? [tr] : []}
              onSelectionChange={(keys) => updateTrace(Array.from(keys as Set<string>)[0] ?? "")}>
              {TRACE.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
            </Select>
            {traceTier(tr) && <p className="mt-1.5 text-[11px] leading-relaxed text-default-400">{traceTier(tr)!.guide}</p>}
          </div>

          <div><SectionLabel>止损 · 阻断后续</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {!restricted && <Button size="sm" variant="bordered" startContent={<UserX className="h-4 w-4" />} onPress={restrict}>限制 / 封禁账户</Button>}
              {!listed && <Button size="sm" variant="bordered" startContent={<ShieldPlus className="h-4 w-4" />} onPress={addList}>对手列名单</Button>}
              {!bf && <Button size="sm" variant="bordered" startContent={<RefreshCw className="h-4 w-4" />} onPress={doBackfill}>规则回填</Button>}
              {restricted && listed && bf && <span className="text-[12px] text-default-400">止损动作已完成</span>}
            </div>
          </div>

          <div><SectionLabel>追回 · 留痕(常追不回)</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {!frozen && <Button size="sm" variant="bordered" startContent={<Snowflake className="h-4 w-4" />} onPress={reqFreeze}>请求下游冻结</Button>}
              {!loss && <Button size="sm" variant="bordered" startContent={<AlertTriangle className="h-4 w-4" />} onPress={reportLoss}>上报已发生损失</Button>}
              {frozen && loss && <span className="text-[12px] text-default-400">冻结 / 损失均已登记</span>}
            </div>
          </div>

          <p className="flex flex-wrap items-center gap-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-default-400" />
            规则回填:基于本 typology 生成检测规则草案 → 变更治理 → 回测 → 审批后由<b className="text-foreground">事中实时拦截同类</b>(堵住下一笔,本笔不依赖追回);生效前不影响线上。
            <button onClick={() => { onOpenChange(false); nav("/rules"); }} className="inline-flex items-center gap-0.5 font-semibold text-primary hover:opacity-80">去监控规则 <ArrowUpRight className="h-3.5 w-3.5" /></button>
          </p>

          <div className="rounded-xl border border-divider bg-default-100 p-3 text-[12px] leading-relaxed text-default-600">
            <Coins className="mr-1.5 inline h-3.5 w-3.5 text-danger" />追溯处置告一段落后,在<b>「审核」</b>抽屉作出结案结论:<b>转报送(补 STR)</b> 或 <b>转案件</b>。
          </div>
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>关闭</Button>
          {onReview && <Button color="primary" startContent={<ClipboardCheck className="h-4 w-4" />} onPress={() => { onOpenChange(false); onReview(); }}>去结案审核</Button>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
