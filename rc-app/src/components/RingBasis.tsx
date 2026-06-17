import { Popover, PopoverTrigger, PopoverContent, Button } from "@heroui/react";
import { Info } from "lucide-react";
import { DIM_META, type Ring } from "@/lib/rings";

const THRESHOLD = 60;
const STEPS: [string, string][] = [
  ["特征采集", "抽取资金路径、链上地址、设备指纹、IP 等可关联标识"],
  ["关联加权", "共享标识连成边，按区分度加权（资金40＞地址30＞设备20＞IP10）+ 时间衰减"],
  ["剔除超级节点", "交易所热钱包 / 公共 IP 等高频公共节点降权，避免聚类坍缩误聚"],
  ["累积过阈值", "子图内各边强度累加，折算置信度 ≥ 60% 才判定成团"],
  ["图聚类成团", "连通分量 / 社区发现圈定团伙成员范围"],
  ["打分定性", "多维贡献叠加成置信度，并归类洗钱手法"],
];

export function RingBasis({ ring }: { ring?: Ring }) {
  const maxStrength = ring ? Math.max(...ring.edges.map((e) => e.strength)) : 0;
  return (
    <Popover placement="bottom-end" showArrow>
      <PopoverTrigger>
        <Button size="sm" variant="bordered" startContent={<Info className="h-4 w-4" />}>识别依据</Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <div className="no-scrollbar max-h-[72vh] w-[400px] max-w-[88vw] overflow-y-auto p-4">
          <div className="text-[14px] font-bold">团伙是怎么识别出来的</div>
          <p className="mt-1 text-[12px] leading-relaxed text-default-500">共享标识连成加权边 → 剔除超级节点 → 累积强度过阈值 → 图聚类成团 → 多维叠加打分。</p>

          <ol className="mt-3 flex flex-col gap-2.5">
            {STEPS.map(([title, desc], i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10.5px] font-bold text-primary">{i + 1}</span>
                <div><div className="text-[12.5px] font-semibold leading-tight">{title}</div><div className="mt-0.5 text-[11.5px] leading-relaxed text-default-500">{desc}</div></div>
              </li>
            ))}
          </ol>

          {ring && (
            <div className="mt-4 rounded-xl border border-divider bg-default-50 p-3">
              <div className="text-[12px] font-bold">本团伙识别要点</div>
              <div className="mt-2 flex flex-col gap-2 text-[11.5px]">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-default-500">命中维度</span>
                  <span className="ml-auto flex flex-wrap justify-end gap-1">{ring.shared.map((s) => <span key={s.dim} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "color-mix(in srgb," + DIM_META[s.dim].color + " 14%, transparent)", color: DIM_META[s.dim].color }}>{DIM_META[s.dim].short} +{s.contrib}</span>)}</span>
                </div>
                <div className="flex justify-between gap-2"><span className="text-default-500">累积置信度</span><span className="font-semibold">{ring.confidence}% {ring.confidence >= THRESHOLD ? `≥ 阈值 ${THRESHOLD}% · 成团` : `< 阈值 ${THRESHOLD}% · 观察`}</span></div>
                <div className="flex justify-between gap-2"><span className="text-default-500">关联边</span><span className="font-semibold">{ring.edges.length} 条 · 最强 {maxStrength}</span></div>
                <div className="flex justify-between gap-2"><span className="text-default-500">定性</span><span className="font-semibold">{ring.typology}</span></div>
                {ring.hubNote && <div className="border-t border-divider pt-2 text-default-500">{ring.hubNote}</div>}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
