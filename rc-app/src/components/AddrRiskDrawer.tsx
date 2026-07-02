import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button } from "@heroui/react";
import { ArrowRight, ExternalLink, ListPlus } from "lucide-react";
import { Pill, SectionLabel } from "./bits";
import type { Tone } from "@/lib/data";
import { OnChainRiskCard } from "./OnChainRiskCard";
import { scoreLevel, kytToSignals, shortAddr, type AddrRisk } from "@/lib/onchain";
import { decide, type Action } from "@/lib/decision";
import { useKytVersion } from "@/lib/store";

// 事中引擎动作 → 中文 + 色(状态可上色)
const ACT: Record<Action, { label: string; tone: Tone }> = {
  freeze: { label: "冻结", tone: "red" }, block: { label: "拦截", tone: "red" },
  hold: { label: "暂缓 · 转人工", tone: "amber" }, review: { label: "放行 · 转研判", tone: "amber" }, allow: { label: "放行", tone: "green" },
};
const SIM_AMOUNT = 2500; // 示意:以该地址为收款方一笔 CAD 2,500 提现(避开大额规则,凸显 KYT 信号本身)

export function AddrRiskDrawer({ addr, onClose }: { addr: AddrRisk | null; onClose: () => void }) {
  const nav = useNavigate();
  const policy = useKytVersion();
  if (!addr) return null;
  const lv = scoreLevel(addr.score);
  // ① 接进事中闸口:KYT 画像 → 链上信号 → 决策引擎(真跑 decide,不改引擎)
  const sig = kytToSignals(addr);
  const dec = decide({ id: "SIM", merchant: "(示意商户)", direction: "withdraw", amount: SIM_AMOUNT, receiver: addr.address, kybComplete: true, ...sig });
  const act = ACT[dec.action];

  return (
    <Drawer isOpen={!!addr} onOpenChange={(o) => { if (!o) onClose(); }} placement="right" size="lg">
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-1 border-b border-divider">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-bold tracking-tight">{shortAddr(addr.address)}</span>
            <Pill tone="grey" dot={false}>{addr.chain}</Pill>
            <Pill tone={lv.tone}>供应商风险 {addr.score} · {lv.label}</Pill>
          </div>
          {addr.ownEntity && <div className="text-[11.5px] text-default-400">归属:{addr.ownEntity}</div>}
        </DrawerHeader>

        <DrawerBody className="gap-5 py-5">
          {/* 供应商情报 + 本系统处置 —— 共享卡(与详情页 / 控制台同一渲染)*/}
          <OnChainRiskCard addr={addr} />

          {/* ① 事中闸口影响 —— 把 KYT 信号喂给决策引擎真跑一遍 */}
          <div>
            <SectionLabel>事中闸口影响(示意 · 以该地址为收款方一笔 CAD {SIM_AMOUNT.toLocaleString()} 提现)</SectionLabel>
            <div className="rounded-xl border border-divider p-3">
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-default-500">
                <span className="rounded-md bg-default-100 px-1.5 py-0.5 font-semibold">链上信号 → 引擎</span>
                <span>KYW <b className="text-foreground">{sig.kyw}</b></span>
                <span>· 制裁/混币最短跳 <b className="text-foreground">{sig.mixerHops ?? "未溯源"}</b></span>
                {sig.addressTags?.length ? <span>· 风险标签 <b className="text-foreground">{sig.addressTags.join("、")}</b></span> : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-default-400">引擎判定</span>
                <Pill tone={act.tone}>{act.label}</Pill>
                {dec.manualReview && <span className="text-[11.5px] text-default-500">· 强制人工</span>}
              </div>
              {dec.reasons.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[12px] text-default-500">
                  {dec.reasons.slice(0, 3).map((r, i) => <li key={i}>· {r.detail}</li>)}
                </ul>
              )}
              <div className="mt-2 text-[11px] text-default-400">经 lib/decision 决策引擎实跑;KYT 只提供链上信号,处置由引擎按管线综合(规则/名单/基线/降级 最严生效)。</div>
            </div>
          </div>

          {/* 对手方 */}
          {addr.counterparties.length > 0 && (
            <div>
              <SectionLabel>主要对手方</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {addr.counterparties.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12.5px]">
                    <span className="font-semibold">{c.name}</span>
                    <span className="rounded-md bg-default-100 px-1.5 py-px text-[10.5px] font-semibold text-default-500">{c.kind}</span>
                    <span className="ml-auto tnum text-default-500">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 见于本系统 —— 交叉回链 */}
          {addr.seenIn.length > 0 && (
            <div>
              <SectionLabel>见于本系统</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {addr.seenIn.map((s, i) => (
                  <button key={i} onClick={() => { onClose(); nav(s.to); }} className="flex items-center gap-2 rounded-lg border border-divider px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-default-50">
                    <span className="rounded-md bg-default-100 px-1.5 py-px text-[10.5px] font-semibold text-default-500">{s.kind}</span>
                    <span className="font-medium">{s.label}</span>
                    <ExternalLink className="ml-auto h-3.5 w-3.5 text-default-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 风险策略 —— 本系统自建层(实时值)*/}
          <div className="rounded-xl border border-divider bg-default-50 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-default-400">生效风险策略</span>
              <span className="rounded-full bg-default-100 px-1.5 py-px text-[10.5px] font-semibold text-default-500">本系统 · 风控总管可调</span>
            </div>
            <ul className="space-y-0.5 text-[12px] text-default-500">
              <li>· 直接敞口到被制裁地址(≤{policy.sanctionHops} 跳)→ 拒绝</li>
              <li>· 供应商风险分 ≥ {policy.scoreBlock} → 拒绝;≥ {policy.scoreReview} → 转人工</li>
              <li>· 混币器敞口 ≥ {policy.mixerReview}% / 暗网 ≥ {policy.darknetReview}% / 诈骗 ≥ {policy.scamReview}% / 盗币 ≥ {policy.stolenReview}% → 转人工</li>
            </ul>
          </div>
        </DrawerBody>

        <DrawerFooter className="border-t border-divider">
          <Button variant="flat" size="sm" startContent={<ListPlus className="h-3.5 w-3.5" />} onPress={() => toast.success(`已将 ${shortAddr(addr.address)} 列入观察名单`)}>列入观察名单</Button>
          <Button variant="flat" size="sm" endContent={<ArrowRight className="h-3.5 w-3.5" />} onPress={() => { onClose(); nav("/rules"); }}>去监控规则</Button>
          <Button color="primary" size="sm" onPress={onClose}>关闭</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
