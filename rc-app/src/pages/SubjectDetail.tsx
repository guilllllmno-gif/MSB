// 主体详情页(/subject?id=SUBJ-xxxx)—— 调查工作台 Phase 4。
// 消费新数据层 useSubject → SubjectDetail:概览 + 归并账户表(拆分 useSplitAccount + §7.5 风控主管封条)
// + 归并依据(mergeEvidence)+ AML 命中(amlHits)+ 待复核候选(pendingCandidates)+ 归并日志(mergeLog)。
// 视觉基准=rc-app 现有页面(Shell/PageHead/Pill/Initials/card 复用,只有「状态」用色)。
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Button, Spinner, Tooltip,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea,
} from "@heroui/react";
import {
  ArrowLeft, GitMerge, Split, ShieldCheck, UserRound, AlertTriangle,
  Anchor, ChevronRight, Bot, ShieldAlert,
} from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials, SectionLabel } from "@/components/bits";
import { useSubject, useSplitAccount } from "@/hooks/useSubjects";
import type { MergedAccount, MergeLogEntry } from "@/schemas/subject";
import type { DimensionKey } from "@/schemas/common";
import { LEVEL_TONE, LEVEL_LABEL, DIM_META, DIM_ORDER } from "@/schemas/common";
import { KYC_META, REQUIRED_ROLE } from "@/lib/domain";
import { fmtCad, fmtCadCompact, fmtDate, fmtAge } from "@/lib/format";

// 关联强度条(非状态量 → 中性灰,不承载语义色)
function StrengthBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-default-100">
        <div className="h-full rounded-full bg-default-400" style={{ width: `${value}%` }} />
      </div>
      <span className="tnum text-[12px] font-semibold text-default-600">{value}</span>
    </div>
  );
}

// 概览小卡
function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-default-100 bg-default-50 px-4 py-3">
      <div className="text-[11px] text-default-400">{label}</div>
      <div className="mt-1 text-[17px] font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-default-400">{sub}</div>}
    </div>
  );
}

const MERGE_LOG_META: Record<MergeLogEntry["action"], { label: string; icon: React.ReactNode }> = {
  auto_merge: { label: "自动归并", icon: <Bot className="h-3.5 w-3.5 text-default-400" /> },
  manual_merge: { label: "人工归并", icon: <GitMerge className="h-3.5 w-3.5 text-default-400" /> },
  manual_split: { label: "人工拆分", icon: <Split className="h-3.5 w-3.5 text-default-400" /> },
};

export default function SubjectDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const id = sp.get("id") || undefined;
  const { data: s, isLoading, isError } = useSubject(id);
  const split = useSplitAccount();

  const [target, setTarget] = useState<MergedAccount | null>(null);
  const [reason, setReason] = useState("");

  const openSplit = (a: MergedAccount) => { setReason(""); setTarget(a); };
  const submitSplit = () => {
    if (!target || !s) return;
    split.mutate({ id: s.id, accountId: target.accountId, reason }, {
      onSuccess: () => { toast.success(`已拆分 ${target.accountId} · 触发风险重算 · 已记入审计`); setTarget(null); },
      onError: () => toast.error("拆分失败"),
    });
  };

  if (isLoading) {
    return (
      <Shell crumb={["风控", "检测策略", "主体归并", "主体详情"]} wide>
        <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-default-400"><Spinner size="sm" />加载主体档案…</div>
      </Shell>
    );
  }
  if (isError || !s) {
    return (
      <Shell crumb={["风控", "检测策略", "主体归并", "主体详情"]} wide>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <AlertTriangle className="h-6 w-6 text-default-300" />
          <div className="text-[13px] text-default-500">{id ? "未找到该主体或加载失败" : "缺少主体 ID"}</div>
          <Button size="sm" radius="full" variant="flat" startContent={<ArrowLeft className="h-3.5 w-3.5" />} onPress={() => nav("/subjects")}>返回工作台</Button>
        </div>
      </Shell>
    );
  }

  const kycM = KYC_META[s.kycStatus];

  return (
    <Shell crumb={["风控", "检测策略", "主体归并", s.name]} wide>
      <PageHead
        title={s.name}
        sub={`${s.id} · ${s.type === "entity" ? "实体" : "个人"} · 首现 ${fmtDate(s.firstSeen)} · 账龄 ${fmtAge(s.accountAgeDays)}`}
        actions={<Button size="sm" radius="full" variant="flat" startContent={<ArrowLeft className="h-3.5 w-3.5" />} onPress={() => nav("/subjects")}>返回工作台</Button>}
      />

      {/* ── 身份 + 状态徽标 ── */}
      <div className="card mb-4 flex flex-wrap items-center gap-4 p-4">
        <Initials p={{ i: s.avatar, c: "var(--brand)" }} size={44} mono />
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={LEVEL_TONE[s.riskLevel]}>{LEVEL_LABEL[s.riskLevel]}风险 · {s.riskScore}</Pill>
          <Pill tone={kycM.tone} dot={false}>KYC {kycM.label}</Pill>
          {s.ringId
            ? <button className="inline-flex items-center gap-1 rounded-full border border-default-200 bg-default-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-primary hover:underline" onClick={() => nav(`/ring?id=${s.ringId}`)}>
                关联团伙 {s.ringId}{s.ringRole ? ` · ${s.ringRole}` : ""}<ChevronRight className="h-3 w-3" />
              </button>
            : <Pill tone="grey" dot={false}>无关联团伙</Pill>}
        </div>
      </div>

      {/* ── 概览 ── */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="归并置信度" value={`${s.mergeConfidence}%`} sub={s.mergeConfidence >= 75 ? "≥75 自动归并" : s.mergeConfidence >= 50 ? "50–74 复核区间" : "<50 不归并"} />
        <Stat label="归并账户" value={`${s.accountCount} 个`} sub="多账户归并为单一主体" />
        <Stat label="涉及金额" value={fmtCadCompact(s.totalAmountCad)} sub={fmtCad(s.totalAmountCad)} />
        <Stat label="AML 命中" value={s.amlHitCount} sub={`规则命中 ${s.ruleHitCount}`} />
        <Stat label="账龄" value={fmtAge(s.accountAgeDays)} sub={`首现 ${fmtDate(s.firstSeen)}`} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* ── 主区:归并账户表 + 归并日志 ── */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>归并账户（{s.accounts.length}）</SectionLabel>
            <Tooltip content={`拆分为高敏操作 · 需 ${REQUIRED_ROLE.split} 权限 · 全量记入审计`} size="sm" delay={200}>
              <span className="inline-flex items-center gap-1 text-[11px] text-default-400"><UserRound className="h-3.5 w-3.5" />拆分需 {REQUIRED_ROLE.split}</span>
            </Tooltip>
          </div>
          <Table aria-label="归并账户" radius="lg"
            classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-11 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] align-top", tr: "border-b border-default-100 last:border-0" }}>
            <TableHeader>
              <TableColumn>账户 ID</TableColumn><TableColumn>归并依据</TableColumn><TableColumn>关联强度</TableColumn><TableColumn>注册日</TableColumn><TableColumn> </TableColumn>
            </TableHeader>
            <TableBody>
              {s.accounts.map((a) => (
                <TableRow key={a.accountId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-default-600">{a.accountId}</span>
                      {a.isAnchor && (
                        <Tooltip content="锚点账户 · 主体身份基准,不可拆分" size="sm" delay={150}>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-default-500"><Anchor className="h-3 w-3" />锚点</span>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><span className="text-default-500">{a.meta}</span></TableCell>
                  <TableCell>{a.linkStrength == null ? <span className="text-default-300">—</span> : <StrengthBar value={a.linkStrength} />}</TableCell>
                  <TableCell><span className="tnum text-default-500">{fmtDate(a.registeredAt)}</span></TableCell>
                  <TableCell>
                    {a.isAnchor
                      ? <span className="text-[11px] text-default-300">—</span>
                      : <Button size="sm" radius="full" variant="flat" startContent={<Split className="h-3.5 w-3.5" />} isDisabled={split.isPending} onPress={() => openSplit(a)}>拆分</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* 归并日志 */}
          <div className="mb-3 mt-8"><SectionLabel>归并日志</SectionLabel></div>
          <div className="card p-4">
            <ol className="relative ml-1 border-l border-default-200 pl-5">
              {s.mergeLog.map((e, i) => {
                const m = MERGE_LOG_META[e.action];
                return (
                  <li key={i} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-default-100">{m.icon}</span>
                    <div className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                      <span className="font-semibold">{m.label}</span>
                      <span className="rounded bg-default-100 px-1 font-mono text-[11px] text-default-600">{e.account}</span>
                      <span className="text-default-400">· {e.operator}</span>
                      <span className="ml-auto tnum text-[11px] text-default-400">{fmtDate(e.at)}</span>
                    </div>
                    {e.reason && <div className="mt-0.5 text-[11.5px] text-default-500">{e.reason}</div>}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* ── 侧栏:归并依据 + AML 命中 + 待复核候选 ── */}
        <div className="space-y-8">
          <div>
            <div className="mb-3"><SectionLabel>归并依据</SectionLabel></div>
            <div className="card space-y-2.5 p-4">
              {DIM_ORDER.filter((d) => s.mergeEvidence.some((e) => e.dimension === d)).map((d) => {
                const e = s.mergeEvidence.find((x) => x.dimension === d)!;
                return <EvidenceRow key={d} dim={d} strength={e.strength} weight={e.weight} note={e.note} />;
              })}
              {s.mergeEvidence.length === 0 && <div className="py-2 text-[12px] text-default-400">无归并依据(单账户主体)</div>}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>AML 命中（{s.amlHits.length}）</SectionLabel>
            </div>
            <div className="space-y-2.5">
              {s.amlHits.length === 0
                ? <div className="card flex items-center justify-center gap-2 py-6 text-[12px] text-default-400"><ShieldCheck className="h-4 w-4 text-success" />无 AML 命中</div>
                : s.amlHits.map((h) => (
                    <div key={h.id} className="card p-3.5">
                      <div className="flex items-center gap-2 text-[13px] font-semibold"><ShieldAlert className="h-4 w-4 text-danger" />{h.title}</div>
                      <div className="mt-1 text-[11.5px] leading-relaxed text-default-500">{h.detail}</div>
                      <div className="mt-1 tnum text-[11px] text-default-400">检出于 {fmtDate(h.detectedAt)}</div>
                    </div>
                  ))}
            </div>
          </div>

          {s.pendingCandidates.length > 0 && (
            <div>
              <div className="mb-3"><SectionLabel>待复核归并候选（{s.pendingCandidates.length}）</SectionLabel></div>
              <div className="card p-4">
                <div className="space-y-2">
                  {s.pendingCandidates.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="rounded bg-default-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-default-600">{c.accountId}</span>
                      <span className="text-default-400">置信度 {c.confidence}%</span>
                    </div>
                  ))}
                </div>
                <Button size="sm" radius="full" variant="flat" className="mt-3 w-full" startContent={<GitMerge className="h-3.5 w-3.5" />} onPress={() => nav("/subjects")}>去复核队列处理</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 拆分确认弹窗(§7.5 高敏封条 + 理由必填)*/}
      <Modal isOpen={!!target} onOpenChange={(o) => !o && setTarget(null)} size="md" placement="center">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-[15px]">确认拆分账户</span>
                <span className="text-[12px] font-normal text-default-500">将 {target?.accountId} 从主体 {s.name} 拆出,恢复为独立主体并触发风险重算</span>
              </ModalHeader>
              <ModalBody>
                <div className="rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-[11.5px] text-default-500">
                  <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-default-400" />
                  高敏操作 · 需 {REQUIRED_ROLE.split} 权限 · 提交后全量记入审计日志(原型不实际鉴权)
                </div>
                <Textarea size="sm" label="拆分理由" labelPlacement="outside" placeholder="填写拆分依据(如:关联证据被推翻 / 误归并)…" value={reason} onValueChange={setReason} minRows={2} />
              </ModalBody>
              <ModalFooter>
                <Button size="sm" radius="full" variant="light" onPress={close} isDisabled={split.isPending}>取消</Button>
                <Button size="sm" radius="full" color="danger" variant="flat" isLoading={split.isPending} isDisabled={!reason.trim()} onPress={submitSplit}>确认拆分</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Shell>
  );
}

// 归并依据单行(维度色圆点 + 强/弱信号 + 权重 + 说明)
function EvidenceRow({ dim, strength, weight, note }: { dim: DimensionKey; strength: "strong" | "weak"; weight: number; note: string }) {
  const m = DIM_META[dim];
  return (
    <div className="flex items-start gap-2.5 border-b border-dashed border-default-100 pb-2.5 last:border-0 last:pb-0" style={{ opacity: strength === "weak" ? 0.72 : 1 }}>
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: m.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12.5px] font-semibold">{m.label}</span>
          <span className="shrink-0 text-[10.5px] text-default-400">{strength === "strong" ? "强信号" : "弱信号"} · 权重 {weight}</span>
        </div>
        <div className="mt-0.5 text-[11.5px] text-default-500">{note}</div>
      </div>
    </div>
  );
}