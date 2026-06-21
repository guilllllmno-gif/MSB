import { useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Input, Textarea, Select, SelectItem } from "@heroui/react";
import { FileWarning, Coins, ShieldX, Info } from "lucide-react";
import { SectionLabel } from "./bits";
import { RTYPE, type Report, type RType, type RState } from "@/lib/reports";
import { reportStore } from "@/lib/store";
import type { Person, Tone } from "@/lib/data";

const ME: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

const TYPE_META: Record<RType, { icon: typeof Coins; guide: string; create: RState; createLabel: string }> = {
  STR: { icon: FileWarning, guide: "STR 通常由「案件管理」确认可疑后派生(单一发起点)。此处手动新建用于补录历史或例外情形,落「草稿」由分析师撰写、转 MLRO 签发。", create: "draft", createLabel: "草稿" },
  LVCTR: { icon: Coins, guide: "LVCTR 按客观阈值(≥ CAD 10,000)系统自动归集。手动新建用于补录漏归集的大额交易,落「待报送」直接进报送队列,无需可疑判定。", create: "queued", createLabel: "待报送" },
  TPR: { icon: ShieldX, guide: "TPR 制裁财产报告须立即上报(无延迟)。手动新建用于登记制裁命中的受控财产,落「待报送」并应即时提交。", create: "queued", createLabel: "待报送" },
};
const SOURCES = ["手动新建", "案件管理", "制裁筛查", "事后监控", "系统自动"];

export function NewReportDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [type, setType] = useState<RType>("STR");
  const [subject, setSubject] = useState("");
  const [amount, setAmount] = useState("");
  const [src, setSrc] = useState("手动新建");
  const [summary, setSummary] = useState("");

  const reset = () => { setType("STR"); setSubject(""); setAmount(""); setSrc("手动新建"); setSummary(""); };
  const meta = TYPE_META[type];

  const submit = () => {
    if (!subject.trim()) { toast.error("请填写涉事主体 / 批次描述"); return; }
    if (!amount.trim()) { toast.error("请填写金额"); return; }
    if (type !== "LVCTR" && !summary.trim()) { toast.error(`请填写${type === "TPR" ? "上报依据" : "可疑理由"}`); return; }
    const n = reportStore.created().length + 1;
    const id = `${type}-20260621-${String(900 + n).padStart(4, "0")}`;
    const amt = amount.trim().startsWith("CAD") ? amount.trim() : `CAD ${amount.trim()}`;
    const due: Report["due"] = type === "TPR" ? { text: "立即上报", tone: "red" } : type === "LVCTR" ? { text: "剩 5 工作日", tone: "amber" } : { text: "草稿 · 起草中", tone: "grey" };
    const report: Report = {
      id, type, status: meta.create,
      src, subject: subject.trim(), sub: type === "LVCTR" ? "大额虚拟货币交易" : `${RTYPE[type].full} · 手动新建`,
      amount: amt, summary: summary.trim() || `${RTYPE[type].full} —— 手动新建,${meta.createLabel}。`,
      officer: ME, mlro: null, due,
    };
    reportStore.add(report);
    reportStore.set(id, meta.create, { event: `手动新建 ${type} 报告 · 落${meta.createLabel}`, reason: summary.trim() });
    toast.success(`已新建 ${id} · ${RTYPE[type].full}`);
    reset(); onOpenChange(false);
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[46vw] !min-w-[440px] !max-w-[760px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">新建报告</span>
          <span className="text-[11.5px] font-normal text-default-400">手动登记 FINTRAC 合规报告 · 落审计日志</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          {/* 报告类型 */}
          <div><SectionLabel>报告类型</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as RType[]).map((t) => { const Icon = TYPE_META[t].icon; const on = type === t; return (
                <button key={t} onClick={() => setType(t)} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12px] font-semibold transition-colors" style={on ? onStyle : offStyle}>
                  <Icon className="h-[18px] w-[18px]" />{t}
                  <span className="text-[10px] font-normal opacity-70">{RTYPE[t].full}</span>
                </button>
              ); })}
            </div>
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: toneOf(RTYPE[type].tone) }} />{meta.guide}
            </div>
          </div>

          <Input label={type === "LVCTR" ? "批次描述 / 涉事主体" : "涉事主体"} labelPlacement="outside" value={subject} onValueChange={setSubject} placeholder={type === "LVCTR" ? "如:06-20 当日 ≥ CAD 10,000 批次" : "商户名 / 个人 / 链上地址"} isRequired />
          <Input label="金额 (CAD)" labelPlacement="outside" value={amount} onValueChange={setAmount} placeholder="如 12,600 或 CAD 12,600" isRequired />

          <Select label="来源" labelPlacement="outside" selectedKeys={[src]} onChange={(e) => setSrc(e.target.value)} disallowEmptySelection>
            {SOURCES.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
          </Select>

          {type === "LVCTR" ? (
            <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12px] leading-relaxed text-default-500">LVCTR 为客观申报,<b>无需可疑理由</b>。新建后落「待报送」,在详情页核对归集明细后批量报送。</div>
          ) : (
            <Textarea label={type === "TPR" ? "上报依据(制裁 / 名单)" : "可疑理由叙述"} labelPlacement="outside" value={summary} onValueChange={setSummary} minRows={4} placeholder={type === "TPR" ? "命中的制裁名单 / 受控财产 / 处置措施…" : "为何构成「合理怀疑」:资金来源 / 模式 / 关联…(记入 FINTRAC 报文)"} isRequired />
          )}
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          <Button color="primary" onPress={submit}>新建 · 落{meta.createLabel}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const TONE_FG: Record<Tone, string> = { green: "var(--success)", amber: "var(--warning)", red: "var(--danger)", blue: "var(--brand)", violet: "var(--violet)", grey: "var(--chip-fg)" };
const toneOf = (t: Tone) => TONE_FG[t];
