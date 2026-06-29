import { useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Input, Select, SelectItem } from "@heroui/react";
import { Info } from "lucide-react";
import { Initials, SectionLabel } from "./bits";
import { RING_TYPOLOGIES, RING_CANDIDATES, DIM_META, DIM_ORDER, buildRing, confTone, confLabel, type RingDim } from "@/lib/rings";
import { ringStore } from "@/lib/store";

const toneCol = (t: string) => (t === "red" ? "var(--danger)" : t === "amber" ? "var(--warning)" : "var(--text-2)");

export function NewRingDrawer({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: string) => void }) {
  const [name, setName] = useState("");
  const [typology, setTypology] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [dims, setDims] = useState<RingDim[]>([]);

  const conf = Math.min(100, DIM_ORDER.filter((d) => dims.includes(d)).reduce((s, d) => s + DIM_META[d].weight, 0));
  const tone = confTone(conf);
  const toggle = <T extends string>(arr: T[], set: (v: T[]) => void, v: T) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const reset = () => { setName(""); setTypology(""); setMembers([]); setDims([]); };

  const create = () => {
    if (!name.trim() || members.length < 2 || dims.length === 0) { toast.error("请填写名称、至少 2 个成员、至少 1 个共享维度"); return; }
    const chosen = RING_CANDIDATES.filter((c) => members.includes(c.id)).map((c, i) => ({ ...c, id: "M" + (i + 1) }));
    const ring = buildRing({ name: name.trim(), typology: typology || "疑似关联", members: chosen, dims }, ringStore.created().length + 1);
    ringStore.addRing(ring);
    toast.success(`已新建团伙 ${ring.id} · 置信度 ${ring.confidence}%`);
    onOpenChange(false); reset(); onCreated?.(ring.id);
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[46vw] !min-w-[420px] !max-w-[720px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">新建关联团伙</span>
          <span className="text-[11.5px] font-normal text-default-400">手动圈定成员与共享维度，系统按区分度权重折算置信度</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <Input size="sm" label="团伙名称" labelPlacement="outside" placeholder="如：拆分入金群组 #B3" value={name} onValueChange={setName} isRequired />
          <Select size="sm" label="洗钱手法" labelPlacement="outside" placeholder="请选择…" selectedKeys={typology ? [typology] : []} onSelectionChange={(k) => setTypology(Array.from(k as Set<string>)[0] ?? "")}>
            {RING_TYPOLOGIES.map((t) => <SelectItem key={t}>{t}</SelectItem>)}
          </Select>

          <div>
            <SectionLabel>团伙成员 · 至少 2 个</SectionLabel>
            <div className="flex flex-col gap-2">
              {RING_CANDIDATES.map((m) => { const on = members.includes(m.id); return (
                <button key={m.id} onClick={() => toggle(members, setMembers, m.id)} className="flex items-center gap-3 rounded-xl border-[1.5px] p-2.5 text-left transition-colors"
                  style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : { borderColor: "var(--line)" }}>
                  <Initials p={{ i: m.i, c: m.c }} size={30} mono />
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{m.name}</div><div className="text-[11px] text-default-400">{m.sub}</div></div>
                  <span className="text-[14px] font-bold" style={{ color: on ? "var(--brand)" : "var(--text-3)" }}>{on ? "✓" : "+"}</span>
                </button>
              ); })}
            </div>
          </div>

          <div>
            <SectionLabel>共享维度 · 至少 1 个</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {DIM_ORDER.map((d) => { const on = dims.includes(d); return (
                <button key={d} onClick={() => toggle(dims, setDims, d)} className="flex items-center justify-between rounded-xl border-[1.5px] px-3 py-2.5 text-[12.5px] font-semibold transition-colors"
                  style={on ? { borderColor: DIM_META[d].color, background: "color-mix(in srgb," + DIM_META[d].color + " 12%, transparent)", color: DIM_META[d].color } : { borderColor: "var(--line)", color: "var(--text-2)" }}>
                  {DIM_META[d].label}<span className="rounded-full bg-default-100 px-1.5 text-[10px] text-default-500">权重 {DIM_META[d].weight}</span>
                </button>
              ); })}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-divider bg-default-50 p-3.5">
            <div className="text-[30px] font-extrabold leading-none tnum" style={{ color: toneCol(tone) }}>{conf}<span className="text-[15px]">%</span></div>
            <div className="text-[12px] text-default-500"><b className="text-foreground">{conf ? confLabel(conf) : "—"}</b> · 折算自所选维度权重之和<br />{conf >= 60 ? "≥ 阈值 60% → 进入「待认领」" : "< 阈值 60% → 进入「观察中」"}</div>
          </div>
          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-default-400"><Info className="mt-px h-3.5 w-3.5 shrink-0" />手动团伙关联依据待核实，建议补充资金 / 地址等强维度证据后再处置。</p>
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>取消</Button>
          <Button color="primary" onPress={create}>创建团伙</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
