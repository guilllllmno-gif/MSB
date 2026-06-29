import { useState } from "react";
import { toast } from "sonner";
import { Switch, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { Shield, ShieldCheck, Scale, Gauge, Database, Clock, Lock, Landmark, UserCheck, GitBranch, ListChecks, Info,
  ShieldAlert, Banknote, FileText, Archive, ListOrdered, Layers, UserX, Eye, SlidersHorizontal, Globe, Unlink, ServerOff, ZapOff, FileQuestion, Network, AlarmClock, Briefcase, CalendarClock, CalendarX, Users, ScrollText, FlaskConical } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { toneVar } from "@/components/bits";
import type { Tone } from "@/lib/data";

// 区块容器
function Section({ icon: Icon, title, hint, children }: { icon: typeof Shield; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Icon className="h-[16px] w-[16px]" strokeWidth={2} /></span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
          {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-default-400">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// 单条策略 —— 借鉴 Stripe Radar「Risk controls」式行:左图标方块 + 名称/取值/说明 + 右状态徽标(可调项再带开关)
// 配色克制:取值徽标一律中性灰(取值是「设置值」不是状态);唯有右侧状态徽标(生效中 / 已关闭)用色。
// 三种性质由右侧状态徽标区分:法定锁定(法定·只读封条)/ 可调兜底(生效中·已关闭 + 开关)/ 固定基线(默认生效)
function Policy({ icon: Icon, title, desc, value, locked, lockNote, on, onToggle }: { icon: typeof Shield; title: string; desc: string; value?: string; locked?: boolean; lockNote?: string; on?: boolean; onToggle?: () => void }) {
  const kind = locked ? "locked" : onToggle ? "tunable" : "fixed";
  return (
    <div className="flex items-start gap-3.5 border-b border-default-100 py-3.5 last:border-0">
      <span className="mt-px flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-default-100 text-default-500"><Icon className="h-[18px] w-[18px]" strokeWidth={1.9} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold">{title}</span>
          {value && <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--track)", color: "var(--text-2)" }}>{value}</span>}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-default-500">{desc}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
        {kind === "locked" ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-bold" style={{ background: "var(--chip-bg)", color: "var(--text-3)" }} title={lockNote}><Lock className="h-3 w-3" />法定 · 只读</span>
        ) : kind === "tunable" ? (
          <>
            <span className="rounded-full px-2 py-1 text-[10.5px] font-bold" style={on ? { background: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)" } : { background: "var(--track)", color: "var(--text-3)" }}>{on ? "生效中" : "已关闭"}</span>
            <Switch size="sm" isSelected={on} onValueChange={onToggle} aria-label={title} />
          </>
        ) : (
          <span className="rounded-full px-2 py-1 text-[10.5px] font-bold" style={{ background: "var(--track)", color: "var(--text-3)" }}>默认生效</span>
        )}
      </div>
    </div>
  );
}

// 处置基线 = 三个风险分切点(拦截 / 转研判 / 留痕),其余区间派生
type Thresholds = { block: number; review: number; log: number };
const DEFAULT_THRESH: Thresholds = { block: 80, review: 60, log: 40 };
// 预设档(对标 Stripe「Select risk setting」)—— 选一档即设定三个切点
const BASELINE_PRESETS: { key: string; name: string; desc: string; t: Thresholds }[] = [
  { key: "conservative", name: "保守 · 更早拦截", desc: "下调各档阈值,更多交易进入拦截 / 研判 —— 适合风险高发期、新制裁生效。", t: { block: 70, review: 50, log: 30 } },
  { key: "standard", name: "标准 · 平衡(推荐)", desc: "默认平衡档:高分拦截、中高分转研判、低分放行留痕。", t: { block: 80, review: 60, log: 40 } },
  { key: "loose", name: "宽松 · 减少打扰", desc: "上调各档阈值,仅最高风险拦截 —— 适合直通率优先、误报偏高时。", t: { block: 90, review: 70, log: 50 } },
];
const presetOf = (t: Thresholds) => BASELINE_PRESETS.find((p) => p.t.block === t.block && p.t.review === t.review && p.t.log === t.log);
// 由切点派生四档处置区间(高→低)
const makeBands = (t: Thresholds): { range: string; label: string; tone: Tone; action: string; note: string }[] => [
  { range: `≥ ${t.block}`, label: "高危", tone: "red", action: "拦截 + 强制人工复核", note: "fail-closed;高额可触发资金暂缓冻结" },
  { range: `${t.review}–${t.block - 1}`, label: "偏高", tone: "amber", action: "放行 + 转告警研判 + 留痕", note: "不阻断,但进研判队列复核" },
  { range: `${t.log}–${t.review - 1}`, label: "中低", tone: "blue", action: "放行 + 留痕(按比例抽样复核)", note: "默认放行,留痕备查" },
  { range: `< ${t.log}`, label: "低", tone: "green", action: "直接放行", note: "仅记录,不干预" },
];

export default function StrategyPage() {
  // 可调兜底开关(原型:本地状态 + toast;接后端落 policyStore + 双人复核)
  const [conserveOnTraceFail, setConserveOnTraceFail] = useState(true);
  const [circuitBreaker, setCircuitBreaker] = useState(true);
  const [holdOnAlertSLA, setHoldOnAlertSLA] = useState(true);
  const [strictNewMerchant, setStrictNewMerchant] = useState(true);
  const [keepListOnExpiry, setKeepListOnExpiry] = useState(true);
  const flip = (set: (v: boolean) => void, cur: boolean, name: string) => { set(!cur); toast.success(`${name} 已${!cur ? "开启" : "关闭"} · 记入审计日志(需双人复核生效)`); };

  // 处置基线:当前切点 + 调整弹窗(原型:本地 state + toast;接后端落 policyStore + 双人复核)
  const [thresh, setThresh] = useState<Thresholds>(DEFAULT_THRESH);
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState("standard");
  const bands = makeBands(thresh);
  const curPreset = presetOf(thresh);
  const openBaseline = () => { setDraftPreset(curPreset?.key ?? "standard"); setBaselineOpen(true); };
  const applyBaseline = () => {
    const p = BASELINE_PRESETS.find((x) => x.key === draftPreset);
    if (p) setThresh(p.t);
    setBaselineOpen(false);
    toast.success(`处置基线已更新为「${p?.name}」· 已提交双人复核(记入审计日志)`);
  };

  return (
    <Shell crumb={["风控", "配置", "全局策略"]} wide>
      <PageHead title="全局策略 · 系统兜底" sub="在具体监控规则之外、系统始终生效的全局默认与兜底策略 —— 决定「没有规则命中时怎么办」「规则 / 名单冲突听谁的」「数据缺失或系统降级时如何保守处置」。这是风控的安全网底座,与逐条「监控规则」互补:规则是显式拦截逻辑,本页是默认与兜底。" />

      {/* 三原则 */}
      <div className="card mb-5 grid grid-cols-1 gap-px overflow-hidden bg-default-100 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, t: "默认从严 · fail-safe", d: "无规则命中、评分缺失或超时,默认按更保守档处置(转研判 / 暂缓),不默认放行漏网。" },
          { icon: Scale, t: "最严生效 · most-restrictive", d: "同一笔被多条规则 / 名单命中时,取最严的处置动作,不取最宽松。" },
          { icon: Landmark, t: "法定不可豁免", d: "制裁筛查、LVCTR 阈值、STR 时限、记录保留等法定硬约束始终生效,任何规则 / 白名单都不能关闭或绕过。" },
        ].map((p) => (
          <div key={p.t} className="bg-content1 p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold"><p.icon className="h-4 w-4" style={{ color: "var(--brand)" }} />{p.t}</div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-default-500">{p.d}</p>
          </div>
        ))}
      </div>

      {/* 当前姿态条 —— 分隔迷你统计 */}
      <div className="card mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["运行模式", circuitBreaker ? "标准 · 熔断布防" : "标准", true],
          ["无规则命中", "按风险分矩阵", false],
          ["评分服务", "正常", true],
          ["制裁名单源", "实时同步", true],
          ["策略版本", "v2.4 · 06-10", false],
        ].map(([k, v, ok], i) => (
          <div key={k as string} className={`px-4 py-3 ${i > 0 ? "border-l border-default-100" : ""} ${i >= 3 ? "max-lg:border-l-0" : ""}`}>
            <div className="text-[11px] text-default-400">{k}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold">{ok && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />}{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {/* ① 决策基线 · 风险分处置矩阵 */}
        <Section icon={Gauge} title="决策基线 · 风险分处置矩阵" hint="当没有任何具体规则命中时,系统按交易的综合风险分落入下列区间,执行对应默认处置。这是兜底的「最后一道分诊」。">
          {/* Stripe 式「当前处置基线」卡 —— 一眼读到当前生效阈值 + 调整入口 */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-default-200 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-px flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-default-100 text-default-500"><Gauge className="h-[18px] w-[18px]" strokeWidth={1.9} /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold">处置基线由综合风险分自动分诊<span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--track)", color: "var(--text-2)" }}>{curPreset ? curPreset.name : "自定义"}</span></div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-default-500">当前:综合风险分 <b className="text-foreground">≥ {thresh.block} 拦截 + 强制人工</b> · {thresh.review}–{thresh.block - 1} 转研判 · &lt; {thresh.log} 直接放行。变更走双人复核。</p>
              </div>
            </div>
            <button onClick={openBaseline} className="shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>调整基线</button>
          </div>
          {/* 渐变分段条:0–100 风险分按四档着色,宽度按区间跨度;低→高 左→右 */}
          {(() => {
            const lowToHigh = [...bands].reverse(); // <log / log–review / review–block / ≥block
            const widths = [thresh.log, thresh.review - thresh.log, thresh.block - thresh.review, 100 - thresh.block];
            return (
              <>
                <div className="flex h-10 overflow-hidden rounded-xl border border-default-200">
                  {lowToHigh.map((b, i) => (
                    <div key={b.range} className="flex flex-col items-center justify-center text-white" style={{ flexBasis: `${widths[i]}%`, flexGrow: 0, background: toneVar(b.tone) }} title={`${b.range} · ${b.action}`}>
                      <span className="text-[11px] font-bold leading-none">{b.label}</span>
                      <span className="mt-0.5 text-[9.5px] font-medium leading-none opacity-90">{b.range}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between px-0.5 text-[10px] tabular-nums text-default-400"><span>0</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {lowToHigh.map((b) => (
                    <div key={b.range} className="rounded-xl border border-default-200 p-3">
                      <div className="flex items-center gap-1.5 text-[12px] font-bold"><span className="h-2 w-2 rounded-full" style={{ background: toneVar(b.tone) }} /><span className="tnum">{b.range}</span><span className="text-[11px] font-medium text-default-400">{b.label}</span></div>
                      <div className="mt-1 text-[12px] font-semibold text-foreground">{b.action}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-default-500">{b.note}</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
          <p className="mt-3 flex items-start gap-1.5 rounded-xl border-l-[3px] border-l-brand bg-default-50 p-3 text-[12px] leading-relaxed text-default-600">
            <Info className="mt-px h-4 w-4 shrink-0 text-default-400" /><span><b>兜底口径</b>:风险<b>评分缺失 / 评分服务超时</b>时,不按「低」放行,而是<b>默认按「偏高 · 转研判」</b>处理(fail-safe 从严);大额交易在评分不可用时默认<b>暂缓</b>等待人工。</span>
          </p>
        </Section>

        {/* ② 法定硬约束 */}
        <Section icon={Landmark} title="法定硬约束 · 始终生效" hint="基于 PCMLTFA / FINTRAC 要求,任何规则、名单或人工都不能关闭或豁免。本页仅可查看。">
          <Policy icon={ShieldAlert} locked lockNote="OFAC / UN / SEMA" title="制裁与恐怖融资筛查" value="实时 · 硬拦截" desc="每笔交易实时筛查 OFAC SDN / UN 1267 / 加拿大 SEMA 名单;命中即冻结资金 + 立即生成 TPR 上报。白名单与任何评分规则均不可豁免。" />
          <Policy icon={Banknote} locked title="LVCTR 大额虚拟货币报送" value="≥ CAD 10,000" desc="单笔或日累计 ≥ CAD 10,000 的虚拟货币交易,系统按客观阈值自动归集生成 LVCTR,无需可疑判定,5 个工作日内报送。" />
          <Policy icon={FileText} locked title="STR 可疑交易报送时限" value="30 日内" desc="确定可疑(MLRO 签发)后 30 日内向 FINTRAC 报送 STR;系统在临期前自动加急提醒并升级。" />
          <Policy icon={Archive} locked title="记录保留" value="≥ 5 年" desc="交易、KYC/KYB、报送与处置记录依法保留至少 5 年;审计日志全程留痕、不可删改。" />
        </Section>

        {/* ③ 冲突仲裁 · 优先级 */}
        <Section icon={Scale} title="冲突仲裁 · 优先级" hint="多条规则 / 名单同时命中,或彼此结论冲突时的全局裁决顺序。">
          <Policy icon={Scale} title="多命中处置仲裁" value="最严生效" desc="同一笔交易被多条规则命中时,取所有命中里最严的处置动作(冻结 > 暂缓 > 转研判 > 放行),绝不取最宽松。" />
          <Policy icon={ListOrdered} title="名单优先级" value="制裁 > 黑 > 关注 > 白" desc="制裁名单 > 内部黑名单 > 关注名单 > 白名单。白名单仅豁免「评分类」规则减少误报,不能豁免制裁 / 黑名单的硬拦截。" />
          <Policy icon={Layers} title="策略层级" value="法定 > 名单 > 模型 > 规则 > 基线" desc="法定硬约束 > 名单硬拦截 > 评分模型 > 行为规则 > 风险分默认基线。上层覆盖下层,确保兜底永远不弱于显式规则。" />
        </Section>

        {/* ④ 准入与默认限额 */}
        <Section icon={UserCheck} title="准入门槛与默认限额" hint="商户 / 账户在没有专门授权时的默认权限边界——「先收紧、后按尽调放开」。">
          <Policy icon={UserX} title="未完成 KYB 商户" value="禁提现 · 入金限额 CAD 1,000" desc="KYB 未完成的商户默认禁止提现、单笔入金封顶 CAD 1,000、不开放币币兑换;完成尽调后按分级放开。" on={strictNewMerchant} onToggle={() => flip(setStrictNewMerchant, strictNewMerchant, "新商户加严准入")} />
          <Policy icon={Eye} title="新商户首充观察期" value="7 天 · 首 5 笔人工" desc="新入网商户前 7 天加严阈值,首 5 笔入金强制人工复核,观察期内不进信任白名单。" />
          <Policy icon={SlidersHorizontal} title="默认限额体系" value="按 KYC 分级三档" desc="基础 / 标准 / 加强 三档对应单笔、日、月限额;超限默认转人工审批,不自动放行。" />
          <Policy icon={Globe} title="高风险辖区" value="默认加严 + 强制 EDD" desc="高风险辖区主体默认提高风险基线并触发强化尽调(EDD);受制裁辖区直接禁止。" />
        </Section>

        {/* ⑤ 数据缺失 / 系统降级兜底(核心) */}
        <Section icon={Database} title="数据缺失 / 系统降级兜底" hint="当依赖的数据源或检测服务不可用时,系统如何「失效安全」地保守处置——这是兜底策略的核心。">
          <Policy icon={Unlink} title="链上溯源失败 / 超时" value={conserveOnTraceFail ? "保守 · 转人工暂缓" : "放行 + 留痕"} desc="无法完成链上来源追溯(节点超时 / 地址无标签)时,默认转人工并暂缓放行;关闭则降级为放行留痕(不建议)。" on={conserveOnTraceFail} onToggle={() => flip(setConserveOnTraceFail, conserveOnTraceFail, "链上溯源失败兜底")} />
          <Policy icon={ServerOff} locked title="制裁名单源不可达" value="fail-closed · 暂停放行" desc="制裁名单服务不可达时,法定要求 fail-closed:暂停受影响交易的放行直至恢复,不得默认放行。此项不可改。" />
          <Policy icon={ZapOff} title="评分服务不可用 · 熔断" value={circuitBreaker ? "全局保守模式" : "关闭"} desc="风险评分服务故障时自动熔断:全局切换保守模式——大额默认暂缓、更多交易转人工、提高拦截倾向,直至服务恢复。" on={circuitBreaker} onToggle={() => flip(setCircuitBreaker, circuitBreaker, "评分熔断保守模式")} />
          <Policy icon={FileQuestion} title="KYC / KYB 数据缺失" value="按最高风险档" desc="主体核验数据缺失或过期时,默认按最高风险档处置,不给予任何信任豁免。" />
          <Policy icon={Network} title="实时通道拥塞降级" value="低额优先 · 余者排队" desc="事中实时通道拥塞时降级:仅放行低额低风险交易,其余进入人工队列,避免为保时延而漏检。" />
        </Section>

        {/* ⑥ SLA 超时兜底 */}
        <Section icon={Clock} title="SLA 超时兜底" hint="处置环节超时未完成时的默认动作——防止「超时即默认放行」造成漏网。">
          <Policy icon={AlarmClock} title="事中告警 SLA 超时" value={holdOnAlertSLA ? "自动暂缓冻结" : "自动升级 L2"} desc="事中告警在 SLA 内未处置时,默认自动暂缓冻结该笔(从严),而非超时放行;可改为自动升级 L2 复核。" on={holdOnAlertSLA} onToggle={() => flip(setHoldOnAlertSLA, holdOnAlertSLA, "告警超时兜底")} />
          <Policy icon={Briefcase} title="案件超 SLA" value="自动升级 MLRO" desc="案件超出处置时限自动升级至 MLRO,并在工作台置顶提醒。" />
          <Policy icon={CalendarClock} title="STR 临期" value="< 5 天 加急升级" desc="距 FINTRAC 30 日报送时限不足 5 天的 STR,自动加急提醒并升级,防止逾期未报。" />
          <Policy icon={CalendarX} title="名单项到期未复核" value={keepListOnExpiry ? "维持生效(从严)" : "自动失效"} desc="名单项到期但未完成复核时,默认维持生效(从严,避免自动失效放开拦截);可改为到期自动失效。" on={keepListOnExpiry} onToggle={() => flip(setKeepListOnExpiry, keepListOnExpiry, "名单到期兜底")} />
        </Section>

        {/* ⑦ 变更治理 */}
        <Section icon={GitBranch} title="变更治理" hint="谁能改、怎么改、改了能不能追溯。">
          <Policy icon={Users} title="全局策略变更" value="双人复核" desc="可调策略的任何修改需 MLRO + 风控负责人双人复核后生效;法定硬约束不可修改,仅可查看。" />
          <Policy icon={ScrollText} title="审计与回溯" value="全量留痕" desc="每次调整记录变更人、时间、前后取值与理由,进审计日志,可按版本回溯与回滚。" />
          <Policy icon={FlaskConical} title="灰度与回测" value="先回测 → 审批 → 灰度" desc="涉及检测逻辑的策略变更默认先进回测、审批、灰度放量,不直接全量上线(与「监控规则」治理一致)。" />
        </Section>

        <div className="flex items-start gap-2 rounded-xl border border-default-200 p-3.5 text-[12px] leading-relaxed text-default-500">
          <ListChecks className="mt-px h-4 w-4 shrink-0 text-default-400" />
          <span>原型说明:可调开关为本地演示态(toast + 审计提示),接后端后落 `policyStore` 并经双人复核生效;法定硬约束项恒为只读。本页与 <b>监控规则</b>(显式拦截逻辑)、<b>名单管理</b>(筛查数据)共同构成「逻辑 + 数据 + 兜底」三层风控配置。</span>
        </div>
      </div>

      {/* 调整处置基线 —— 对标 Stripe「Select risk setting」:选一档风险设定,重设拦截/研判/留痕切点 */}
      <Modal isOpen={baselineOpen} onOpenChange={setBaselineOpen} size="lg" placement="center" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[15px]"><span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Gauge className="h-4 w-4" /></span>调整处置基线</div>
            <p className="text-[12px] font-normal leading-relaxed text-default-500">选择一档风险设定,系统据此设定「拦截 / 转研判 / 留痕」的风险分切点。这只影响<b className="text-default-600">无规则命中时的兜底分诊</b>,变更需 MLRO + 风控负责人双人复核后生效。</p>
          </ModalHeader>
          <ModalBody className="gap-2.5">
            {BASELINE_PRESETS.map((p) => {
              const on = draftPreset === p.key;
              return (
                <button key={p.key} onClick={() => setDraftPreset(p.key)} className={`rounded-2xl border p-3.5 text-left transition-colors ${on ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-default-200 hover:bg-default-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-bold">{p.name}</span>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? "border-[var(--brand)]" : "border-default-300"}`}>{on && <span className="h-2 w-2 rounded-full" style={{ background: "var(--brand)" }} />}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-default-500">{p.desc}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-default-600">
                    <span className="rounded-md bg-default-100 px-1.5 py-0.5">≥ {p.t.block} 拦截</span>
                    <span className="rounded-md bg-default-100 px-1.5 py-0.5">{p.t.review}–{p.t.block - 1} 转研判</span>
                    <span className="rounded-md bg-default-100 px-1.5 py-0.5">{p.t.log}–{p.t.review - 1} 留痕</span>
                    <span className="rounded-md bg-default-100 px-1.5 py-0.5">{"<"} {p.t.log} 放行</span>
                  </div>
                </button>
              );
            })}
            <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-default-400"><Info className="mt-px h-3.5 w-3.5 shrink-0" />法定硬约束(制裁筛查 / LVCTR / STR)不受基线影响,始终生效。需任意自定义切点时由风控总管在评分模型侧配置。</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setBaselineOpen(false)}>取消</Button>
            <Button color="primary" isDisabled={draftPreset === (curPreset?.key ?? "")} onPress={applyBaseline}>提交双人复核</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Shell>
  );
}
