import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { AlertTriangle, FolderOpen, SendHorizontal, UserPlus, Check } from "lucide-react";
import { Initials, SectionLabel } from "./bits";
import { analystQueue, spareAnalysts, type Analyst, type QItem } from "@/lib/opsMetrics";
import { urgencyColor } from "@/lib/data";

const toneC = (t: string) => urgencyColor(t, "var(--success)"); // 见 lib/data
const KIND_ICON = { 告警: AlertTriangle, 案件: FolderOpen, 报送: SendHorizontal };

// 总管下钻:点开某分析师 → 看他手头具体背着什么 → 把超载的件改派给有余力的人(演示态本地状态)
export function AnalystQueueDrawer({ analyst, open, onOpenChange }: { analyst: Analyst | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = useMemo<QItem[]>(() => (analyst ? analystQueue(analyst) : []), [analyst]);
  const [moved, setMoved] = useState<Record<string, string>>({}); // itemId → 改派给谁
  // 每次抽屉打开时清空改派状态(渲染期重置,避免 effect 级联渲染)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) { setWasOpen(open); if (open) setMoved({}); }
  if (!analyst) return null;

  const candidates = spareAnalysts(analyst.p.n);
  const movedN = Object.keys(moved).length;
  const remaining = items.length - movedN;
  const over = Math.max(0, analyst.open - analyst.cap);
  const reds = items.filter((it) => it.tone === "red" && !moved[it.id]);

  const reassign = (item: QItem, name: string) => {
    setMoved((m) => ({ ...m, [item.id]: name }));
    toast.success(`已将 ${item.id} 改派给 ${name}`);
  };
  // 一键把所有超时件分给最空闲的人(轮转候选)
  const drainReds = () => {
    if (!candidates.length) { toast.error("当前没有有余力的同事可接收"); return; }
    setMoved((m) => {
      const next = { ...m };
      reds.forEach((it, i) => { next[it.id] = candidates[i % candidates.length].name; });
      return next;
    });
    toast.success(`已分流 ${reds.length} 件超时告警给 ${Math.min(reds.length, candidates.length)} 名有余力的同事`);
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[46vw] !min-w-[460px] !max-w-[760px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-2 border-b border-divider">
          <div className="flex w-full items-center gap-3">
            <Initials p={analyst.p} size={40} />
            <div className="flex-1">
              <div className="text-[16px] font-bold">{analyst.p.n} 的队列</div>
              <div className="text-[12px] text-default-400">
                手头 <b className="text-foreground tnum">{analyst.open}</b> / 上限 {analyst.cap} ·{" "}
                <span style={{ color: over > 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>{over > 0 ? `超 ${over} 件` : `余 ${analyst.cap - analyst.open} 件`}</span>
                {movedN > 0 && <> · 已分流 <b style={{ color: "var(--success)" }}>{movedN}</b> 件 → 现 <b className="text-foreground tnum">{remaining}</b></>}
              </div>
            </div>
          </div>
          {over > 0 && reds.length > 0 && (
            <Button size="sm" radius="full" className="bg-danger/10 font-semibold text-danger" startContent={<UserPlus className="h-3.5 w-3.5" />} onPress={drainReds}>
              一键分流 {reds.length} 件超时件
            </Button>
          )}
        </DrawerHeader>

        <DrawerBody className="px-0 py-0">
          <div className="px-5 pt-4"><SectionLabel>手头任务 · 超时在前</SectionLabel></div>
          <div className="flex flex-col">
            {items.map((it) => {
              const Icon = KIND_ICON[it.kind];
              const to = moved[it.id];
              return (
                <div key={it.id} className={`flex items-center gap-3 border-b border-divider/60 px-5 py-2.5 ${to ? "opacity-55" : ""}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${toneC(it.tone)} 14%, transparent)`, color: toneC(it.tone) }}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold">{it.subject}</span>
                      <span className="shrink-0 rounded bg-default-100 px-1.5 text-[10px] font-medium text-default-500">{it.kind}</span>
                    </div>
                    <div className="truncate text-[11px] text-default-400">{it.id} · {it.meta}</div>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold tnum" style={{ color: toneC(it.tone) }}>{it.sla}</span>
                  {to ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-success"><Check className="h-3.5 w-3.5" />已改派 {to.split(" ")[0]}</span>
                  ) : (
                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <Button size="sm" variant="flat" radius="full" className="h-7 shrink-0 bg-default-100 px-3 text-[11.5px] font-semibold">改派</Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="改派给" onAction={(key) => reassign(it, String(key))}>
                        {candidates.length ? (
                          candidates.slice(0, 8).map((c) => (
                            <DropdownItem key={c.name} description={`空余 ${c.spare} 件`} startContent={<Initials p={c.p} size={22} />}>{c.name}</DropdownItem>
                          ))
                        ) : (
                          <DropdownItem key="none" isReadOnly className="text-default-400">暂无有余力的同事</DropdownItem>
                        )}
                      </DropdownMenu>
                    </Dropdown>
                  )}
                </div>
              );
            })}
          </div>
          <p className="px-5 py-3 text-[10.5px] leading-snug text-default-400">
            演示态:这些是按确定性种子编出的占位队列。接后端后,这里应是该分析师名下的真实告警 / 案件 / 报送,「改派」即把记录的处理人改为他人。
          </p>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
