// 主体归并调查工作台(/subjects)—— 新数据层(Zod + MSW + TanStack Query)的首个 UI 消费页。
// 两块:① 归并候选复核队列(50–74 复核区间,承 useMergeCandidates + merge/reject 变更、§7 角色 + 审计门)
//       ② 主体档案列表(useSubjects,风险/KYC 筛选 + 搜索 + 分页,全部由 MSW handler 真实实现)。
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Button, Input, Select, SelectItem, Spinner, Tooltip,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea,
} from "@heroui/react";
import { Search, GitMerge, X, ChevronLeft, ChevronRight, ShieldCheck, UserRound, AlertTriangle } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials, SectionLabel } from "@/components/bits";
import { useSubjects, useMergeCandidates, useMergeAccount, useRejectCandidate } from "@/hooks/useSubjects";
import type { MergeCandidate } from "@/schemas/subject";
import { LEVEL_TONE, LEVEL_LABEL, DIM_META, DIM_ORDER } from "@/schemas/common";
import { KYC_META, MERGE, REQUIRED_ROLE } from "@/lib/domain";
import { fmtCadCompact } from "@/lib/format";

const PAGE_SIZE = 10;

// 归并置信度条(复核区间 50–74 → amber;越接近自动阈值 75 越强)
function ConfBar({ value }: { value: number }) {
  const col = "var(--warning)";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-default-100">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: col }} />
      </div>
      <span className="tnum text-[13px] font-bold" style={{ color: col }}>{value}%</span>
    </div>
  );
}

// 关联证据维度小片(共享 rc-app 维度色语言)
function DimChip({ dim, strength }: { dim: MergeCandidate["evidence"][number]["dimension"]; strength: "strong" | "weak" }) {
  const m = DIM_META[dim];
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
      style={{ background: "var(--track)", color: "var(--text-2)", opacity: strength === "weak" ? 0.6 : 1 }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.short}
    </span>
  );
}

type Confirm = { kind: "merge" | "reject"; cand: MergeCandidate };

export default function SubjectWorkbench() {
  const nav = useNavigate();
  const [risk, setRisk] = useState("");
  const [kyc, setKyc] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const subjectsQ = useSubjects({ risk: risk || undefined, status: kyc || undefined, q: q || undefined, page });
  const candQ = useMergeCandidates();

  const total = subjectsQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = subjectsQ.data?.items ?? [];
  const candidates = candQ.data ?? [];

  // 筛选/搜索变更时回到第 1 页
  const setFilter = (fn: () => void) => { fn(); setPage(1); };

  return (
    <Shell crumb={["风控", "检测策略", "主体归并"]} wide>
      <PageHead
        title="主体归并工作台"
        sub={`同一自然人/实体的多账户经跨维度关联(资金/设备/提现地址/IP)归并为单一主体。置信度 ≥${MERGE.auto} 自动归并、${MERGE.reviewLow}–${MERGE.reviewHigh} 进入人工复核队列、<${MERGE.reviewLow} 不归并。`}
      />

      {/* ── 归并候选复核队列(50–74)── */}
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>归并候选 · 待复核（{MERGE.reviewLow}–{MERGE.reviewHigh} 复核区间）</SectionLabel>
        {candidates.length > 0 && <Pill tone="amber" dot={false} icon={<AlertTriangle className="h-3 w-3" />}>{candidates.length} 项待复核</Pill>}
      </div>

      {candQ.isLoading ? (
        <div className="card mb-8 flex items-center justify-center gap-2 py-10 text-[13px] text-default-400"><Spinner size="sm" />加载候选…</div>
      ) : candidates.length === 0 ? (
        <div className="card mb-8 flex items-center justify-center gap-2 py-10 text-[13px] text-default-400"><ShieldCheck className="h-4 w-4 text-success" />复核队列已清空</div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {candidates.map((c) => <CandidateCard key={c.id} cand={c} />)}
        </div>
      )}

      {/* ── 主体档案列表 ── */}
      <SectionLabel>主体档案</SectionLabel>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input size="sm" radius="full" value={q} onValueChange={(v) => setFilter(() => setQ(v))} placeholder="搜索主体名称或 ID…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="max-w-[320px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
        <Select size="sm" radius="full" aria-label="风险等级" placeholder="风险等级" selectedKeys={risk ? [risk] : []}
          onSelectionChange={(k) => setFilter(() => setRisk(([...k][0] as string) ?? ""))}
          className="max-w-[150px]" classNames={{ trigger: "bg-default-100 shadow-none h-10" }}>
          <SelectItem key="">全部风险</SelectItem>
          <SelectItem key="high">高风险</SelectItem>
          <SelectItem key="mid">中风险</SelectItem>
          <SelectItem key="low">低风险</SelectItem>
        </Select>
        <Select size="sm" radius="full" aria-label="KYC 状态" placeholder="KYC 状态" selectedKeys={kyc ? [kyc] : []}
          onSelectionChange={(k) => setFilter(() => setKyc(([...k][0] as string) ?? ""))}
          className="max-w-[150px]" classNames={{ trigger: "bg-default-100 shadow-none h-10" }}>
          <SelectItem key="">全部 KYC</SelectItem>
          <SelectItem key="passed">已通过</SelectItem>
          <SelectItem key="pending">待核验</SelectItem>
          <SelectItem key="rejected">未通过</SelectItem>
        </Select>
      </div>

      <Table aria-label="主体档案" radius="lg"
        classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-5 text-[13px] whitespace-nowrap", tr: "border-b border-default-100 last:border-0 transition-colors hover:bg-default-50 cursor-pointer" }}>
        <TableHeader>
          <TableColumn>主体 / ID</TableColumn><TableColumn>风险</TableColumn><TableColumn>归并账户</TableColumn>
          <TableColumn>涉及金额</TableColumn><TableColumn>AML 命中</TableColumn><TableColumn>KYC</TableColumn><TableColumn>关联团伙</TableColumn>
        </TableHeader>
        <TableBody
          isLoading={subjectsQ.isLoading}
          loadingContent={<div className="flex items-center gap-2 py-8 text-[13px] text-default-400"><Spinner size="sm" />加载主体…</div>}
          emptyContent={subjectsQ.isError ? "加载失败" : "没有符合条件的主体"}>
          {rows.map((s) => {
            const kycM = KYC_META[s.kycStatus];
            return (
              <TableRow key={s.id} onClick={() => nav(`/entity?id=${s.id}`)}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Initials p={{ i: s.avatar, c: "var(--brand)" }} size={28} mono />
                    <div><div className="font-semibold">{s.name}</div><div className="text-[11px] text-default-400">{s.id} · {s.type === "entity" ? "实体" : "个人"}</div></div>
                  </div>
                </TableCell>
                <TableCell><Pill tone={LEVEL_TONE[s.riskLevel]}>{LEVEL_LABEL[s.riskLevel]} · {s.riskScore}</Pill></TableCell>
                <TableCell><span className="font-semibold tnum">{s.accountCount}</span> <span className="text-default-400">个</span></TableCell>
                <TableCell><span className="font-semibold tnum">{fmtCadCompact(s.totalAmountCad)}</span></TableCell>
                <TableCell><span className="tnum text-default-600">{s.amlHitCount}</span> <span className="text-default-400 text-[11px]">/ 规则 {s.ruleHitCount}</span></TableCell>
                <TableCell><Pill tone={kycM.tone} dot={false}>{kycM.label}</Pill></TableCell>
                <TableCell>{s.ringId
                  ? <button className="text-[12.5px] font-semibold text-primary hover:underline" onClick={(e) => { e.stopPropagation(); nav(`/ring?id=${s.ringId}`); }}>{s.ringId}{s.ringRole ? ` · ${s.ringRole}` : ""}</button>
                  : <span className="text-default-300">—</span>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* 分页(handler 每页 10)*/}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-[12.5px] text-default-500">
          <span>共 {total} 个主体 · 第 {page} / {pageCount} 页</span>
          <div className="flex items-center gap-2">
            <Button size="sm" radius="full" variant="flat" isDisabled={page <= 1} onPress={() => setPage((p) => p - 1)} startContent={<ChevronLeft className="h-3.5 w-3.5" />}>上一页</Button>
            <Button size="sm" radius="full" variant="flat" isDisabled={page >= pageCount} onPress={() => setPage((p) => p + 1)} endContent={<ChevronRight className="h-3.5 w-3.5" />}>下一页</Button>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ── 单张归并候选卡(含 归并 / 驳回 变更 + 确认弹窗)──
function CandidateCard({ cand }: { cand: MergeCandidate }) {
  const nav = useNavigate();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [reason, setReason] = useState("");
  const merge = useMergeAccount();
  const reject = useRejectCandidate();
  const busy = merge.isPending || reject.isPending;

  const open = (kind: Confirm["kind"]) => { setReason(""); setConfirm({ kind, cand }); };
  const submit = () => {
    if (!confirm) return;
    if (confirm.kind === "merge") {
      merge.mutate({ id: cand.targetSubjectId, accountId: cand.accountId, reason }, {
        onSuccess: () => { toast.success(`已归并 ${cand.accountId} → ${cand.targetSubjectName} · 已记入审计`); setConfirm(null); },
        onError: () => toast.error("归并失败"),
      });
    } else {
      reject.mutate({ candidateId: cand.id, reason }, {
        onSuccess: () => { toast.success(`已驳回候选 · ${cand.accountId} 保留独立主体`); setConfirm(null); },
        onError: () => toast.error("驳回失败"),
      });
    }
  };

  const needRole = confirm?.kind === "merge" ? REQUIRED_ROLE.merge : "风控分析师";

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-default-600">{cand.accountId}</span>
            <GitMerge className="h-3.5 w-3.5 shrink-0 text-default-400" />
            <button className="truncate font-semibold text-primary hover:underline" onClick={() => nav(`/entity?id=${cand.targetSubjectId}`)}>{cand.targetSubjectName}</button>
          </div>
          <div className="mt-1 text-[11px] text-default-400">检出于 {cand.detectedAt.slice(0, 10)} · 目标主体 {cand.targetSubjectId}</div>
        </div>
        <ConfBar value={cand.confidence} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {DIM_ORDER.filter((d) => cand.evidence.some((e) => e.dimension === d)).map((d) => {
          const e = cand.evidence.find((x) => x.dimension === d)!;
          return <DimChip key={d} dim={d} strength={e.strength} />;
        })}
        <span className="text-[11px] text-default-400">· {cand.evidence.map((e) => e.note).join(" / ")}</span>
      </div>

      <div className="mt-3.5 flex items-center gap-2 border-t border-default-100 pt-3">
        <Button size="sm" radius="full" color="primary" startContent={<GitMerge className="h-3.5 w-3.5" />} isDisabled={busy} onPress={() => open("merge")}>归并</Button>
        <Button size="sm" radius="full" variant="flat" startContent={<X className="h-3.5 w-3.5" />} isDisabled={busy} onPress={() => open("reject")}>驳回</Button>
        <Tooltip content={`高敏操作 · 需 ${REQUIRED_ROLE.merge} 权限 · 全量记入审计`} size="sm" delay={200}>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-default-400"><UserRound className="h-3.5 w-3.5" />需 {REQUIRED_ROLE.merge}</span>
        </Tooltip>
      </div>

      <Modal isOpen={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} size="md" placement="center">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span className="text-[15px]">{confirm?.kind === "merge" ? "确认归并账户" : "驳回归并候选"}</span>
                <span className="text-[12px] font-normal text-default-500">
                  {confirm?.kind === "merge"
                    ? `将 ${cand.accountId} 归并入主体 ${cand.targetSubjectName}（置信度 ${cand.confidence}%）`
                    : `保留 ${cand.accountId} 为独立主体，移出复核队列`}
                </span>
              </ModalHeader>
              <ModalBody>
                <div className="rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-[11.5px] text-default-500">
                  <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-default-400" />
                  高敏操作 · 需 {needRole} 权限 · 提交后全量记入审计日志（原型不实际鉴权）
                </div>
                <Textarea size="sm" label="操作理由" labelPlacement="outside" placeholder="填写复核依据 / 处置理由…" value={reason} onValueChange={setReason} minRows={2} />
              </ModalBody>
              <ModalFooter>
                <Button size="sm" radius="full" variant="light" onPress={close} isDisabled={busy}>取消</Button>
                <Button size="sm" radius="full" color={confirm?.kind === "merge" ? "primary" : "default"} isLoading={busy} isDisabled={!reason.trim()} onPress={submit}>
                  {confirm?.kind === "merge" ? "确认归并" : "确认驳回"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
