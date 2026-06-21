import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { SectionLabel } from "./bits";
import { LCAT, LCATS, LENTRY_TYPE_TONE, type ListCat, type EntryType, type ListEntry } from "@/lib/lists";
import { listStore } from "@/lib/store";
import type { Person } from "@/lib/data";

const ME: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const ENTRY_TYPES: EntryType[] = ["商户", "个人", "链上地址", "钱包", "IP", "设备"];
const SCOPES = ["全业务线", "充值", "提现", "充值 / 提现", "链上交易", "登录 / 充值"];

const CAT_GUIDE: Record<ListCat, string> = {
  sanctions: "法定硬拦截 —— OFAC SDN / UN / 加拿大 SEMA 命中即禁止交易,出生即生效。",
  block: "确认主体 —— 已坐实的欺诈 / 洗钱主体及地址,直接拦截。",
  watch: "升级监控 —— 不直接拦截,命中后加强监控 / 加分转研判,设复核到期日。",
  allow: "放行豁免 —— 已核验 / 可信主体,跳过指定规则以减少误报。",
};

const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

export function AddToListDrawer({ open, onOpenChange, preset }: { open: boolean; onOpenChange: (o: boolean) => void; preset?: Partial<ListEntry> }) {
  const [value, setValue] = useState("");
  const [entryType, setEntryType] = useState<EntryType | "">("");
  const [cat, setCat] = useState<ListCat | "">("");
  const [scope, setScope] = useState("");
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("");
  const [errs, setErrs] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) {
      setErrs(new Set());
      setValue(preset?.value || "");
      setEntryType((preset?.entryType as EntryType) || "");
      setCat((preset?.cat as ListCat) || "");
      setScope(preset?.scope || "");
      setReason(preset?.reason || "");
      setExpiry(preset?.expiry || "");
    }
  }, [open, preset]);

  const submit = () => {
    const e = new Set<string>();
    if (!value.trim()) e.add("value");
    if (!entryType) e.add("entryType");
    if (!cat) e.add("cat");
    if (!reason.trim()) e.add("reason");
    setErrs(e);
    if (e.size) { toast.error("请补全名单项信息(值 / 类型 / 类别 / 理由)"); return; }
    const c = cat as ListCat;
    const status: ListEntry["status"] = c === "sanctions" ? "active" : "pending";
    const n = listStore.created().length + 1;
    const entry: ListEntry = {
      id: `LE-2026-${String(900 + n).padStart(4, "0")}`,
      value: value.trim(), entryType: entryType as EntryType, cat: c,
      risk: preset?.risk || (c === "sanctions" ? "制裁命中" : c === "block" ? "确认主体" : c === "watch" ? "观察" : "已核验"),
      source: preset?.source || "手动", srcId: preset?.srcId, to: preset?.to,
      addedBy: ME, addedAt: "2026-06-21", reason: reason.trim(),
      hits30: 0, scope: scope || "全业务线",
      expiry: expiry.trim() || (c === "sanctions" || c === "block" ? "长期有效" : undefined),
      status,
    };
    listStore.add(entry);
    toast.success(`已新增名单项「${entry.value}」· ${LCAT[c].label}`);
    toast(status === "active" ? "制裁类即时生效 · 已纳入事中筛查" : "待复核 · 复核生效后纳入事中筛查");
    onOpenChange(false);
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[50vw] !min-w-[460px] !max-w-[820px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">新增名单项</span>
          <span className="text-[11.5px] font-normal text-default-400">名单项纳入事中筛查 —— 制裁类即时生效,其余先进「待复核」,复核生效后参与拦截 / 监控</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <Input size="sm" label="名单项值" labelPlacement="outside" placeholder="如:0x7F4a…9c21 / OffshoreFX Ltd. / bc1q…7h2k" isRequired value={value} onValueChange={setValue} isInvalid={errs.has("value")} />

          {/* 类型 */}
          <div>
            <SectionLabel>类型 <span className="text-danger">*</span></SectionLabel>
            <div className={`flex flex-wrap gap-2 ${errs.has("entryType") ? "rounded-xl p-1 ring-2 ring-danger/40" : ""}`}>
              {ENTRY_TYPES.map((t) => {
                const on = entryType === t;
                return <button key={t} onClick={() => setEntryType(t)} className="rounded-full border-[1.5px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors" style={on ? onStyle : offStyle}>{t}</button>;
              })}
            </div>
          </div>

          {/* 类别 */}
          <div>
            <SectionLabel>类别 <span className="text-danger">*</span></SectionLabel>
            <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${errs.has("cat") ? "rounded-xl p-1 ring-2 ring-danger/40" : ""}`}>
              {LCATS.map((c) => {
                const Icon = LCAT[c].icon;
                const on = cat === c;
                return (
                  <button key={c} onClick={() => setCat(c)} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12px] font-semibold transition-colors" style={on ? onStyle : offStyle}>
                    <Icon className="h-[18px] w-[18px]" />{LCAT[c].label}
                  </button>
                );
              })}
            </div>
            {cat && <p className="mt-1.5 rounded-xl border border-divider bg-default-50 p-2.5 text-[11.5px] leading-relaxed text-default-500">{CAT_GUIDE[cat]}</p>}
          </div>

          <Select size="sm" label="适用范围" labelPlacement="outside" placeholder="请选择…" aria-label="适用范围"
            selectedKeys={scope ? [scope] : []}
            onSelectionChange={(k) => setScope(Array.from(k as Set<string>)[0] ?? "")}>
            {SCOPES.map((s) => <SelectItem key={s}>{s}</SelectItem>)}
          </Select>

          <Textarea size="sm" label="理由" labelPlacement="outside" placeholder="列入名单的依据(命中来源 / 案件结论 / 团伙研判…)" isRequired minRows={3} value={reason} onValueChange={setReason} isInvalid={errs.has("reason")} />

          <Input size="sm" label="到期日(选填)" labelPlacement="outside" placeholder="如:2026-09-30(制裁 / 黑名单 默认长期有效)" value={expiry} onValueChange={setExpiry} />

          <p className="rounded-xl border border-divider bg-default-100 p-3 text-[11.5px] leading-relaxed text-default-500">制裁名单为<b>法定硬拦截</b>,新增即生效;内部黑名单 / 关注 / 白名单先进<b>待复核</b>,复核生效后才纳入事中筛查。此操作记入审计。</p>
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          <Button color="primary" onPress={submit}>新增名单项</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
