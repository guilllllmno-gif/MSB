import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Select, SelectItem } from "@heroui/react";
import { FlaskConical, Play } from "lucide-react";
import { SectionLabel } from "./bits";
import { condText, type Rule } from "@/lib/rules";

const WINDOWS = ["近 30 天", "近 90 天", "近 180 天"];

interface Result { scanned: string; wouldHit: number; estFp: string; eff: number; window: string }

export function RuleBacktestDrawer({ rule, open, onOpenChange }: { rule: Rule | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [window, setWindow] = useState("近 90 天");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setWindow("近 90 天"); setResult(null); }
  }, [open, rule?.id]);

  if (!rule) return null;

  const run = () => {
    const h = [...rule.id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const days = window.includes("180") ? 180 : window.includes("90") ? 90 : 30;
    const fp = (h % 12) + 3;
    setResult({ scanned: (days * 1.2).toFixed(1) + "M", wouldHit: (h % 40) + Math.round(days / 9), estFp: fp + "%", eff: 100 - fp, window });
    toast.success(`回测完成 · ${window}`);
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[46vw] !min-w-[440px] !max-w-[760px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">回测模拟</span>
          <span className="text-[11.5px] font-normal text-default-400">{rule.id} · {rule.name}</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <p className="rounded-xl border border-divider bg-default-50 p-3 text-[12px] leading-relaxed text-default-600">在历史交易窗口上<b>重放该规则</b>,评估若上线会额外命中多少笔、预估误报率。回测<b>不改变规则状态</b>,结果供变更审批参考。</p>

          <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12px]">
            <span className="mr-1.5 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--brand)]">IF</span>
            <span className="font-medium text-default-700">{rule.clauses?.length ? condText(rule.clauses) : rule.cond}</span>
          </div>

          <Select size="sm" label="回测窗口" labelPlacement="outside" aria-label="回测窗口" selectedKeys={[window]}
            onSelectionChange={(k) => { setWindow(Array.from(k as Set<string>)[0] ?? "近 90 天"); setResult(null); }}>
            {WINDOWS.map((w) => <SelectItem key={w}>{w}</SelectItem>)}
          </Select>

          <Button color="primary" variant="flat" startContent={<Play className="h-4 w-4" />} onPress={run}>运行回测</Button>

          {result && (
            <div><SectionLabel>回测结果 · {result.window}</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: "扫描量", v: result.scanned, t: "" },
                  { k: "将额外命中", v: `${result.wouldHit} 笔`, t: "var(--brand)" },
                  { k: "预估误报率", v: result.estFp, t: "var(--warning)" },
                  { k: "命中有效率", v: `${result.eff}%`, t: "var(--success)" },
                ].map((m) => (
                  <div key={m.k} className="rounded-xl border border-divider p-3">
                    <div className="text-[11.5px] text-default-500">{m.k}</div>
                    <div className="mt-1 text-[22px] font-extrabold leading-none tnum" style={{ color: m.t || undefined }}>{m.v}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-default-400"><FlaskConical className="h-3.5 w-3.5" />达标后可在页头「提交审批 / 上线」推进(若按状态门控)。</p>
            </div>
          )}
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>关闭</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
