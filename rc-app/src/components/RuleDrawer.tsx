import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Button, Textarea } from "@heroui/react";
import { ExternalLink, Check } from "lucide-react";
import { Initials, SectionLabel, Pill, KvRow } from "./bits";
import { RUSTATE, RUFLOW, CAT_ICON, VENUE, venueOf, type Rule, type RuState } from "@/lib/rules";
import { ruleStore, useRuleVersion } from "@/lib/store";

const RH = { i: "RH", n: "Raj Hota", c: "#0ea5e9" }; // 变更治理执行人
const onStyle = { borderColor: "var(--brand)", background: "var(--brand-soft)", color: "var(--brand)" };
const offStyle = { borderColor: "var(--line)", color: "var(--text-2)" };

// 回填闭环阶段:回填/提案 → 回测 → 审批 → 上线生效
const STEPS = ["回填 / 提案", "回测", "审批", "上线生效"];
const stepIndex = (st: RuState) => (st === "backtest" ? 1 : st === "pending" ? 2 : st === "live" ? 3 : st === "disabled" ? 3 : 0);

export function RuleDrawer({ rule, open, onOpenChange, onDone }: { rule: Rule | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  useRuleVersion();
  const nav = useNavigate();
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setChoice(null); setNote(""); }
  }, [open, rule?.id]);

  if (!rule) return null;
  const st = ruleStore.stateOf(rule.id, rule.state) as RuState;
  const sd = RUSTATE[st];
  const owner = ruleStore.ownerOf(rule.id, rule.owner);
  const actions = RUFLOW[st];
  const action = actions.find((a) => a.k === choice) || null;
  const CIcon = CAT_ICON[rule.cat];
  const fromBackfill = rule.src.startsWith("回填");
  const cur = stepIndex(st);

  const submit = () => {
    if (!action) { toast.error("请选择处置动作"); return; }
    ruleStore.set(rule.id, action.to, { owner: RH, event: `${action.label}（${RH.n}）`, reason: note.trim() });
    toast.success(`${rule.name} · ${action.label}`);
    if (action.to === "live") toast("规则已上线 · 事中闸口将实时拦截同类");
    onOpenChange(false); onDone?.();
  };

  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="right" size="md" classNames={{ base: "!w-[50vw] !min-w-[460px] !max-w-[820px]" }}>
      <DrawerContent>
        <DrawerHeader className="flex-col items-start gap-0.5 border-b border-divider">
          <span className="text-[15px] font-bold">监控规则 · 变更治理</span>
          <span className="text-[11.5px] font-normal text-default-400">{rule.id} · {rule.name}</span>
        </DrawerHeader>
        <DrawerBody className="gap-4 py-4">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-default-100 text-default-500"><CIcon className="h-4 w-4" /></span>{rule.name}<Pill tone={sd.tone}>{sd.label}</Pill></div>

          {/* 规则摘要 */}
          <div className="card p-3.5">
            <KvRow label="类别">{rule.cat}</KvRow>
            <KvRow label="执行场景"><span className="inline-flex items-center gap-1.5"><Pill tone={VENUE[venueOf(rule)].tone} dot={false}>{VENUE[venueOf(rule)].short}</Pill></span></KvRow>
            <KvRow label="触发条件">{rule.cond}</KvRow>
            <KvRow label="命中处置">{rule.action}</KvRow>
            <KvRow label="权重 / 评分">{rule.weight}</KvRow>
            <KvRow label="近 30 天命中 / 误报">{st === "live" ? `${rule.hits30} 命中 · 误报 ${rule.fp30}` : "未上线"}</KvRow>
            <KvRow label="来源">{rule.to ? <button onClick={() => nav(rule.to!)} className="inline-flex items-center gap-1 text-primary hover:opacity-80">{rule.src} · {rule.srcId} <ExternalLink className="h-3 w-3" /></button> : rule.src}</KvRow>
          </div>

          {/* 回填闭环进度 */}
          {fromBackfill && (
            <div className="card p-3.5">
              <SectionLabel>规则回填闭环</SectionLabel>
              <div className="flex items-center">
                {STEPS.map((s, i) => {
                  const done = i < cur || st === "live";
                  const active = i === cur && st !== "live";
                  return (
                    <div key={s} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: done ? "var(--brand)" : active ? "var(--brand-soft)" : "var(--chip-bg)", color: done ? "#fff" : active ? "var(--brand)" : "var(--chip-fg)", border: active ? "1.5px solid var(--brand)" : "none" }}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                        <span className="whitespace-nowrap text-[10px] font-semibold" style={{ color: done || active ? "var(--brand)" : "var(--text-3)" }}>{s}</span>
                      </div>
                      {i < STEPS.length - 1 && <span className="mx-1 mb-4 h-[2px] flex-1 rounded-full" style={{ background: i < cur ? "var(--brand)" : "var(--line)" }} />}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-default-400">事后发现 typology → 回填生成草案 → 回测评估命中 / 误报 → 变更审批 → 上线后由<b className="text-default-600">事中闸口实时拦截同类</b>(堵下一笔,生效前不影响线上)。</p>
            </div>
          )}

          {/* 回测结果 */}
          {rule.backtest && (
            <div className="card p-3.5">
              <SectionLabel>回测结果</SectionLabel>
              <div className="grid grid-cols-2 gap-x-6">
                <KvRow label="回测窗口">{rule.backtest.window}</KvRow>
                <KvRow label="扫描量">{rule.backtest.scanned}</KvRow>
                <KvRow label="将额外命中">{rule.backtest.wouldHit} 笔</KvRow>
                <KvRow label="预估误报">{rule.backtest.estFp}</KvRow>
              </div>
            </div>
          )}

          {!sd.active ? (
            <div className="rounded-xl border border-divider bg-default-50 p-3 text-[12.5px] text-default-500">本规则当前 <b>{sd.label}</b>{actions.length ? "。可在下方重新启用 / 回测。" : "。"}</div>
          ) : null}

          {actions.length > 0 && (
            <div><SectionLabel>变更动作</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {actions.map((a) => { const Icon = a.icon; const on = choice === a.k; return (
                  <button key={a.k} onClick={() => setChoice(on ? null : a.k)} className="flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-1.5 py-3 text-[12px] font-semibold transition-colors"
                    style={on ? onStyle : offStyle}>
                    <Icon className="h-[18px] w-[18px]" />{a.label}</button>
                ); })}
              </div>
            </div>
          )}

          {action && <div className="rounded-xl border border-divider bg-default-100 p-3 text-[12px] leading-relaxed text-default-600">{action.tip}。记入变更审计日志。</div>}

          {actions.length > 0 && <Textarea label="变更说明 / 审批意见" labelPlacement="outside" value={note} onValueChange={setNote} minRows={3} placeholder="阈值依据、回测结论或审批意见…(记入变更审计日志)" />}

          <div className="flex items-center gap-2 text-[11.5px] text-default-400"><Initials p={owner || RH} size={20} />负责人 {(owner || RH).n} · 变更治理</div>
        </DrawerBody>
        <DrawerFooter className="border-t border-divider">
          <Button variant="bordered" onPress={() => onOpenChange(false)}>关闭</Button>
          {actions.length > 0 && <Button color="primary" onPress={submit}>提交变更</Button>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
