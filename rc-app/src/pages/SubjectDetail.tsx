// 主体详情 · 账户归并(Phase 3)—— 消费 useSubject + 归并/拆分/拒绝 mutations。
// 高敏操作(合并需风控分析师、拆分需风控主管)前端不实际鉴权,但呈现权限要求 + 审计留痕提示(领域约束 7.5)。
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea, useDisclosure, Tooltip } from "@heroui/react";
import { ArrowLeft, Network, ShieldCheck, ShieldAlert, GitMerge, Split, Check, X, Anchor, Fingerprint, ScrollText, Info } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, Initials, SectionLabel, KvRow } from "@/components/bits";
import { LEVEL_TONE, LEVEL_LABEL, DIM_META, type RiskLevel } from "@/schemas/common";
import { KYC_META, mergeDisposition, REQUIRED_ROLE } from "@/lib/domain";
import { fmtCad, fmtDate, fmtAge } from "@/lib/format";
import { useSubject, useMergeAccount, useSplitAccount, useRejectCandidate } from "@/hooks/useSubjects";
import { roleStore, useRoleVersion, ROLE_META } from "@/lib/store";
import type { AssocEvidence } from "@/schemas/common";

// 归并置信小条
function MergeBar({ value }: { value: number }) {
  const disp = mergeDisposition(value);
  const col = disp === "auto" ? "var(--success)" : disp === "review" ? "var(--warning)" : "var(--text-3)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-default-100"><div className="h-full rounded-full" style={{ width: `${value}%`, background: col }} /></div>
      <span className="tnum text-[12px] font-bold" style={{ color: col }}>{value}%</span>
    </div>
  );
}

function EvidenceRow({ e }: { e: AssocEvidence }) {
  const m = DIM_META[e.dimension];
  return (
    <div className="flex items-center gap-3 border-b border-dashed border-default-200 py-2.5 last:border-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold" style={{ background: "var(--track)", color: m.color }}>{m.short}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold">{m.label}</div>
        <div className="truncate text-[11.5px] text-default-500">{e.note}</div>
      </div>
      <Pill tone={e.strength === "strong" ? "red" : "grey"} dot={false}>{e.strength === "strong" ? "强信号" : "弱信号"} · 权重 {e.weight}</Pill>
    </div>
  );
}

type PendingAction = { kind: "merge" | "split" | "reject"; title: string; requiredRole: string; desc: string; run: (reason: string) => void } | null;

export default function SubjectDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const id = sp.get("id") ?? undefined;
  const role = useRoleVersion();
  const roleLabel = ROLE_META[role].role;

  const { data: s, isLoading, isError } = useSubject(id);
  const mergeM = useMergeAccount();
  const splitM = useSplitAccount();
  const rejectM = useRejectCandidate();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [action, setAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState("");
  const busy = mergeM.isPending || splitM.isPending || rejectM.isPending;

  const openAction = (a: NonNullable<PendingAction>) => { setAction(a); setReason(""); onOpen(); };
  const confirm = () => { if (action) { action.run(reason.trim()); onClose(); } };

  if (isError) return <Shell crumb={["风控", "检测策略", "主体归并", id ?? "—"]}><div className="card flex items-center gap-2.5 px-4 py-10 text-[13px] text-danger"><ShieldAlert className="h-4 w-4" />主体不存在或加载失败。<button onClick={() => nav("/subjects")} className="font-semibold text-brand hover:underline">返回列表</button></div></Shell>;
  if (isLoading || !s) return <Shell crumb={["风控", "检测策略", "主体归并", id ?? "—"]}><div className="card flex items-center justify-center py-20"><Spinner color="primary" /></div></Shell>;

  const kyc = KYC_META[s.kycStatus];

  return (
    <Shell crumb={["风控", "检测策略", "主体归并", s.id]} wide>
      <button onClick={() => nav("/subjects")} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-default-500 transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回主体归并</button>

      {/* 主体头卡 */}
      <div className="card mb-5 flex flex-wrap items-start gap-5 p-5">
        <Initials p={{ i: s.avatar, c: "var(--brand)" }} size={56} mono />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-extrabold tracking-tight">{s.name}</h1>
            <Pill tone={LEVEL_TONE[s.riskLevel as RiskLevel]}>风险 {LEVEL_LABEL[s.riskLevel as RiskLevel]} · {s.riskScore}</Pill>
            <Pill tone={kyc.tone} dot={false}>KYC {kyc.label}</Pill>
            <span className="rounded-full bg-default-100 px-2 py-0.5 text-[11px] font-semibold text-default-500">{s.type === "entity" ? "机构" : "个人"}</span>
          </div>
          <div className="mt-1 text-[12px] text-default-400">{s.id} · 首次出现 {fmtDate(s.firstSeen)} · 账龄 {fmtAge(s.accountAgeDays)}</div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
            <span className="text-default-500">归并置信</span><MergeBar value={s.mergeConfidence} />
            <span className="text-default-500">归并账户 <span className="font-bold text-foreground">{s.accountCount}</span></span>
            <span className="text-default-500">涉及金额 <span className="tnum font-bold text-foreground">{fmtCad(s.totalAmountCad)}</span></span>
            {s.ringId && <button onClick={() => nav(`/ring?id=${s.ringId}`)} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><Network className="h-3.5 w-3.5" />{s.ringId}{s.ringRole ? ` · ${s.ringRole}` : ""}</button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* 主列 */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* 归并账户 */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>归并账户 · {s.accounts.length}</SectionLabel>
              <span className="text-[11px] text-default-400">锚点为首次身份核验账户,不可拆分</span>
            </div>
            <div className="flex flex-col">
              {s.accounts.map((a) => (
                <div key={a.accountId} className="flex items-center gap-3 border-b border-default-100 py-3 last:border-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: a.isAnchor ? "var(--brand-soft)" : "var(--track)" }}>
                    {a.isAnchor ? <Anchor className="h-4 w-4" style={{ color: "var(--brand)" }} /> : <GitMerge className="h-4 w-4 text-default-500" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-semibold">{a.accountId}</span>{a.isAnchor && <Pill tone="blue" dot={false}>锚点</Pill>}</div>
                    <div className="truncate text-[11.5px] text-default-500">{a.meta} · 注册于 {fmtDate(a.registeredAt)}</div>
                  </div>
                  {a.linkStrength != null && <div className="hidden sm:block"><MergeBar value={a.linkStrength} /></div>}
                  {!a.isAnchor && (
                    <Tooltip content={`拆分该账户 · 需 ${REQUIRED_ROLE.split}`} size="sm" delay={300}>
                      <Button isIconOnly size="sm" radius="full" variant="flat" className="bg-default-100" isDisabled={busy}
                        onPress={() => openAction({ kind: "split", title: `拆分账户 ${a.accountId}`, requiredRole: REQUIRED_ROLE.split, desc: `将 ${a.accountId} 从主体 ${s.name} 拆出,恢复为独立主体。此操作影响团伙判定与风险聚合,请填写依据。`,
                          run: (r) => splitM.mutate({ id: s.id, accountId: a.accountId, reason: r }, { onSuccess: () => toast.success(`${a.accountId} 已拆分`), onError: () => toast.error("拆分失败") }) })}>
                        <Split className="h-4 w-4 text-default-500" strokeWidth={1.9} />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 归并证据 */}
          <div className="card p-5">
            <SectionLabel>归并证据 · 多维关联信号</SectionLabel>
            {s.mergeEvidence.length ? <div className="mt-1">{s.mergeEvidence.map((e, i) => <EvidenceRow key={i} e={e} />)}</div> : <div className="py-4 text-[12.5px] text-default-400">无归并证据(单账户主体)。</div>}
          </div>

          {/* 归并候选队列 */}
          {s.pendingCandidates.length > 0 && (
            <div className="card p-5">
              <div className="mb-1 flex items-center gap-2">
                <SectionLabel>待复核归并候选 · {s.pendingCandidates.length}</SectionLabel>
              </div>
              <div className="mb-3 flex items-center gap-1.5 text-[11.5px] text-default-500"><Info className="h-3.5 w-3.5" />置信度落在 50–74 复核区间,合并操作需 {REQUIRED_ROLE.merge} 且全程留痕。</div>
              <div className="flex flex-col gap-3">
                {s.pendingCandidates.map((c) => (
                  <div key={c.id} className="rounded-xl border border-default-100 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><span className="font-semibold">{c.accountId}</span><span className="text-[11px] text-default-400">检出 {fmtDate(c.detectedAt)}</span></div>
                      <MergeBar value={c.confidence} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {c.evidence.map((e, i) => <span key={i} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--track)", color: DIM_META[e.dimension].color }}>{DIM_META[e.dimension].short}</span>)}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button size="sm" radius="full" color="primary" startContent={<Check className="h-3.5 w-3.5" />} isDisabled={busy}
                        onPress={() => openAction({ kind: "merge", title: `归并账户 ${c.accountId}`, requiredRole: REQUIRED_ROLE.merge, desc: `确认将 ${c.accountId} 归入主体 ${s.name}。归并后风险与金额将聚合到本主体,请填写复核依据。`,
                          run: (r) => mergeM.mutate({ id: s.id, accountId: c.accountId, reason: r }, { onSuccess: () => toast.success(`${c.accountId} 已归并`), onError: () => toast.error("归并失败") }) })}>确认归并</Button>
                      <Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<X className="h-3.5 w-3.5" />} isDisabled={busy}
                        onPress={() => openAction({ kind: "reject", title: `拒绝候选 ${c.accountId}`, requiredRole: REQUIRED_ROLE.merge, desc: `拒绝将 ${c.accountId} 归入主体 ${s.name},候选将移出复核队列。请填写拒绝理由。`,
                          run: (r) => rejectM.mutate({ candidateId: c.id, reason: r }, { onSuccess: () => toast.success(`候选 ${c.accountId} 已拒绝`), onError: () => toast.error("操作失败") }) })}>拒绝</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 侧栏 */}
        <div className="flex flex-col gap-5">
          <div className="card p-5">
            <SectionLabel>风险画像</SectionLabel>
            <KvRow label="风险评分">{s.riskScore} / 100</KvRow>
            <KvRow label="AML 命中">{s.amlHitCount > 0 ? <span className="text-danger">{s.amlHitCount} 项</span> : "0"}</KvRow>
            <KvRow label="规则命中">{s.ruleHitCount} 条</KvRow>
            <KvRow label="账户数">{s.accountCount} 个</KvRow>
            <KvRow label="KYC 状态"><Pill tone={kyc.tone} dot={false}>{kyc.label}</Pill></KvRow>
          </div>

          {/* AML 命中 */}
          <div className="card p-5">
            <SectionLabel>AML 命中记录</SectionLabel>
            {s.amlHits.length ? (
              <div className="flex flex-col gap-2.5">
                {s.amlHits.map((h) => (
                  <div key={h.id} className="rounded-lg border border-default-100 p-3">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold"><ShieldAlert className="h-3.5 w-3.5" style={{ color: "var(--danger)" }} />{h.title}</div>
                    <div className="mt-1 text-[11.5px] leading-relaxed text-default-500">{h.detail}</div>
                    <div className="mt-1 text-[10.5px] text-default-400">{fmtDate(h.detectedAt)}</div>
                  </div>
                ))}
              </div>
            ) : <div className="flex items-center gap-1.5 py-2 text-[12.5px] text-default-500"><ShieldCheck className="h-4 w-4 text-success" />无 AML 命中</div>}
          </div>

          {/* 归并日志 */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-1.5"><ScrollText className="h-4 w-4 text-default-400" strokeWidth={1.9} /><SectionLabel>归并日志 · 全程留痕</SectionLabel></div>
            <div className="flex flex-col gap-3">
              {s.mergeLog.map((l, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2 w-2 rounded-full" style={{ background: l.action === "manual_split" ? "var(--warning)" : l.action === "manual_merge" ? "var(--brand)" : "var(--text-3)" }} />
                    {i < s.mergeLog.length - 1 && <span className="mt-0.5 w-px flex-1 bg-default-200" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="text-[12px] font-semibold">{l.action === "auto_merge" ? "自动归并" : l.action === "manual_merge" ? "人工归并" : "人工拆分"} · {l.account}</div>
                    <div className="text-[11px] text-default-500">{l.operator} · {fmtDate(l.at)}</div>
                    {l.reason && <div className="mt-0.5 text-[11px] text-default-400">依据:{l.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 高敏操作确认 —— 权限要求 + 留痕提示 */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg" placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-[16px] font-bold">{action?.title}</span>
          </ModalHeader>
          <ModalBody>
            <p className="text-[13px] leading-relaxed text-default-600">{action?.desc}</p>
            <div className="flex items-start gap-2 rounded-xl border border-default-100 bg-default-50 p-3 text-[12px]">
              <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-default-400" strokeWidth={1.9} />
              <div>
                <div>需 <span className="font-bold">{action?.requiredRole}</span> 权限 · 当前操作员身份 <span className="font-bold">{roleStore.person().n}({roleLabel})</span></div>
                <div className="mt-0.5 text-default-400">此为高敏操作,确认后将写入归并日志与全站审计,不可静默撤销。</div>
              </div>
            </div>
            <Textarea label="操作依据(必填)" placeholder="填写归并 / 拆分 / 拒绝的判断依据,将随审计留存…" value={reason} onValueChange={setReason} minRows={2} variant="bordered" />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>取消</Button>
            <Button color={action?.kind === "merge" ? "primary" : "default"} className={action?.kind !== "merge" ? "bg-default-200" : ""} isDisabled={!reason.trim() || busy} isLoading={busy} onPress={confirm}>确认{action?.kind === "merge" ? "归并" : action?.kind === "split" ? "拆分" : "拒绝"}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Shell>
  );
}
