import { useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Select, SelectItem, Slider } from "@heroui/react";
import { FlaskConical, Play, Ban } from "lucide-react";
import { SectionLabel } from "./bits";
import { condText, parseThreshold, fmtThresh, spliceThresh, type Rule } from "@/lib/rules";

const WINDOWS = ["近 30 天", "近 90 天", "近 180 天"];
const daysOf = (w: string) => (w.includes("180") ? 180 : w.includes("90") ? 90 : 30);

export function RuleBacktestDrawer({ rule, open, onOpenChange }: { rule: Rule | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const cond = rule ? (rule.clauses?.length ? condText(rule.clauses) : rule.cond) : "";
  const param = rule ? parseThreshold(cond) : null;
  const v0 = param?.value ?? 0;

  const [window, setWindow] = useState("近 90 天");
  const [v, setV] = useState(v0); // 当前阈值(真实参数,带单位)
  // 开抽屉 / 换规则时复位(渲染期重置)
  const [seen, setSeen] = useState("");
  const key = open && rule ? rule.id : "";
  if (key !== seen) { setSeen(key); if (key) { setWindow("近 90 天"); setV(v0); } }
  if (!rule) return null;

  // 确定性基线:命中取回测样本(无则按 id 派生),误报取 estFp(无则派生)
  const h = [...rule.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const baseHit = rule.backtest?.wouldHit && rule.backtest.wouldHit > 0 ? rule.backtest.wouldHit : (h % 38) + 14;
  const baseFp = parseInt(rule.backtest?.estFp ?? "", 10) || (h % 12) + 4;
  const winMult = daysOf(window) / 90;
  const scanned = (daysOf(window) * 1.2).toFixed(1) + "M";

  // 阈值 → 命中 / 误报 响应(放宽:命中↑误报↑)。r>1 = 比基线更松
  const isPct = !!param && (param.unit === "%" || param.prefix === "P");
  const ratio = (val: number) => (param!.lowerLooser ? v0 / val : val / v0);
  const hitAt = (val: number) => Math.max(0, Math.round(baseHit * winMult * Math.pow(ratio(val), 1.4)));
  const fpAt = (val: number) => +Math.min(60, baseFp * (0.5 + 0.5 * ratio(val))).toFixed(1);

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[46vw] !min-w-[460px] !max-w-[800px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">回测模拟 · 调阈值看影响</span>
          <span className="text-[11.5px] font-normal text-default-400">{rule.id} · {rule.name} · 命中权重 {rule.weight}</span>
        </DrawerHeader>

        <DrawerBody className="gap-4 py-4">
          <p className="rounded-xl border border-divider bg-default-50 p-3 text-[12px] leading-relaxed text-default-600">在历史交易窗口上<b>重放该规则</b>,调整它<b>真实的触发阈值</b>,看会额外命中多少笔、预估误报率怎么变 —— 上线前权衡<b>召回 ↔ 精准</b>。回测<b>不改变规则状态</b>,供审批参考。</p>

          <Select size="sm" label="回测窗口" labelPlacement="outside" aria-label="回测窗口" selectedKeys={[window]}
            onSelectionChange={(k) => setWindow(Array.from(k as Set<string>)[0] ?? "近 90 天")}>
            {WINDOWS.map((w) => <SelectItem key={w}>{w}</SelectItem>)}
          </Select>

          {param ? (() => {
            // 阈值真实参数 → 可拖滑块
            const span = param.currency ? v0 * 0.6 : Math.max(2, Math.round(v0 * 0.5));
            const step = param.currency ? (v0 >= 10000 ? 500 : 100) : 1;
            const min = Math.max(param.currency ? step : isPct ? 5 : 1, Math.round((v0 - span) / step) * step);
            let max = Math.round((v0 + span) / step) * step;
            if (isPct) max = Math.min(100, max);
            if (max <= min) max = min + step;
            const liveCond = spliceThresh(cond, param, v);
            const hit = hitAt(v), fp = fpAt(v), eff = Math.max(0, +(100 - fp).toFixed(1));
            const dHit = hit - hitAt(v0), dFp = +(fp - fpAt(v0)).toFixed(1);
            // 曲线:在阈值区间上采样(x = 真实阈值,带单位)
            const N = 28, xs = Array.from({ length: N + 1 }, (_, i) => min + ((max - min) * i) / N);
            const hitS = xs.map(hitAt), fpS = xs.map(fpAt);
            const hMax = Math.max(...hitS, 1), fMax = Math.max(...fpS, 1);
            const W = 300, H = 92, padT = 6, padB = 6;
            const px = (val: number) => ((val - min) / (max - min)) * W;
            const py = (val: number, m: number) => padT + (1 - val / m) * (H - padT - padB);
            const line = (ser: number[], m: number) => ser.map((val, i) => `${px(xs[i]).toFixed(1)},${py(val, m).toFixed(1)}`).join(" ");
            const leftLabel = param.lowerLooser ? "放宽" : "收紧";
            const rightLabel = param.lowerLooser ? "收紧" : "放宽";
            return (
              <>
                {/* 当前条件实时改写 */}
                <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px]">
                  <span className="mr-1.5 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--brand)]">IF</span>
                  <span className="font-semibold text-foreground">{liveCond}</span>
                  {v !== v0 && <span className="ml-2 text-[11px] text-default-400">基线 {param.prefix}{fmtThresh(v0, param.currency)}{param.unit}</span>}
                </div>

                {/* 阈值滑块 —— 规则的真实参数 */}
                <div className="rounded-xl border border-divider p-3">
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-default-600">触发阈值</span>
                    <span className="tnum text-foreground">{param.prefix}{fmtThresh(v, param.currency)}{param.unit}</span>
                  </div>
                  <Slider aria-label="触发阈值" size="sm" minValue={min} maxValue={max} step={step} value={v}
                    onChange={(val) => setV(Array.isArray(val) ? val[0] : val)}
                    classNames={{ track: "bg-default-200", filler: "bg-primary" }} />
                  <div className="mt-0.5 flex justify-between text-[10px] text-default-400">
                    <span>{param.prefix}{fmtThresh(min, param.currency)}{param.unit} · {leftLabel}</span>
                    <span>{param.prefix}{fmtThresh(max, param.currency)}{param.unit} · {rightLabel}</span>
                  </div>
                </div>

                {/* 实时指标 */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { k: "扫描量", v: scanned, t: "", d: "" },
                    { k: "将额外命中", v: `${hit}`, t: "var(--brand)", d: dHit ? `${dHit > 0 ? "+" : ""}${dHit} 较基线` : "基线" },
                    { k: "预估误报率", v: `${fp}%`, t: fp >= 20 ? "var(--danger)" : "var(--warning)", d: dFp ? `${dFp > 0 ? "+" : ""}${dFp}pt` : "基线" },
                    { k: "命中有效率", v: `${eff}%`, t: "var(--success)", d: "" },
                  ].map((m) => (
                    <div key={m.k} className="rounded-xl border border-divider p-3">
                      <div className="text-[11.5px] text-default-500">{m.k}</div>
                      <div className="mt-1 text-[20px] font-extrabold leading-none tnum" style={{ color: m.t || undefined }}>{m.v}</div>
                      {m.d && <div className="mt-1 text-[10.5px] text-default-400">{m.d}</div>}
                    </div>
                  ))}
                </div>

                {/* 权衡曲线:x = 真实阈值,命中 vs 误报 */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <SectionLabel>召回 ↔ 精准 权衡曲线</SectionLabel>
                    <div className="flex items-center gap-3 text-[10.5px] text-default-500">
                      <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "var(--brand)" }} />命中数</span>
                      <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: "var(--warning)" }} />误报率</span>
                    </div>
                  </div>
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
                    {[0, 0.5, 1].map((g) => <line key={g} x1={0} x2={W} y1={padT + g * (H - padT - padB)} y2={padT + g * (H - padT - padB)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
                    <polyline points={line(hitS, hMax)} fill="none" stroke="var(--brand)" strokeWidth={1.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <polyline points={line(fpS, fMax)} fill="none" stroke="var(--warning)" strokeWidth={1.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <line x1={px(v)} x2={px(v)} y1={0} y2={H} stroke="var(--default-400)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                    <circle cx={px(v)} cy={py(hit, hMax)} r={3} fill="var(--brand)" vectorEffect="non-scaling-stroke" />
                    <circle cx={px(v)} cy={py(fp, fMax)} r={3} fill="var(--warning)" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <div className="mt-0.5 flex justify-between text-[9.5px] text-default-300 tnum">
                    <span>{param.prefix}{fmtThresh(min, param.currency)}{param.unit}</span>
                    <span>{param.prefix}{fmtThresh(max, param.currency)}{param.unit}</span>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-snug text-default-400">横轴 = 该规则的真实阈值。{leftLabel === "放宽" ? "向左放宽" : "向右放宽"} → 命中更多(召回↑)、误报也升(精准↓)。<b>找命中够多、误报可接受的那一点</b>。</p>
                </div>
              </>
            );
          })() : (
            // 无连续阈值的规则(名单 / 布尔类)——诚实说明,不给假旋钮
            <div className="rounded-xl border border-divider bg-default-50 p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-default-700"><Ban className="h-4 w-4 text-default-400" />本规则无连续阈值可调</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-default-500">「{cond}」属<b>布尔 / 名单类</b>条件,命中即触发,没有可调的数值阈值 —— 不适用阈值回测。要改变它的灵敏度,只能改条件本身(在「编辑规则」里增删子句)。</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-divider bg-content1 p-3"><div className="text-[11.5px] text-default-500">扫描量</div><div className="mt-1 text-[20px] font-extrabold tnum">{scanned}</div></div>
                <div className="rounded-xl border border-divider bg-content1 p-3"><div className="text-[11.5px] text-default-500">窗口内命中(估计)</div><div className="mt-1 text-[20px] font-extrabold tnum" style={{ color: "var(--brand)" }}>{Math.round(baseHit * winMult)}</div></div>
              </div>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-default-400">
            <FlaskConical className="mt-px h-3.5 w-3.5 shrink-0" />
            演示态:命中 / 误报随阈值的响应为<b>估计模型</b>(基线取规则回测样本),原型无逐笔交易重放;接入历史数据引擎后,曲线即替换为真实回测结果,滑块联动逻辑不变。达标后在页头「提交审批 / 上线」推进,审批由风控总管签批。
          </p>
        </DrawerBody>

        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>关闭</Button>
          {param && <Button color="primary" variant="flat" startContent={<Play className="h-4 w-4" />} onPress={() => toast.success(`已记录回测 · ${window} · 阈值 ${param.prefix}${fmtThresh(v, param.currency)}${param.unit} → 命中 ${hitAt(v)} 笔 · 误报 ${fpAt(v)}%`)}>采纳此阈值 · 记录回测</Button>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
