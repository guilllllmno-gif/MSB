// 主体归并调查台(Phase 3)—— 消费新数据契约层(Zod+MSW+Query)。
// 跨账户身份归并:同一实控人的多账户经多维信号聚合为单一主体;≥75 自动归并,50–74 进入人工复核队列。
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Input, Tooltip, Spinner, Pagination } from "@heroui/react";
import { Search, Eye, GitMerge, Fingerprint, ShieldAlert, Network } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { LEVEL_TONE, LEVEL_LABEL, DIM_META, type RiskLevel } from "@/schemas/common";
import { KYC_META, mergeDisposition } from "@/lib/domain";
import { fmtCadCompact, fmtDate } from "@/lib/format";
import { useSubjects, useMergeCandidates } from "@/hooks/useSubjects";
import type { Subject } from "@/schemas/subject";

// 归并置信条(50–74 复核区间用琥珀色标注)
function MergeBar({ value }: { value: number }) {
  const disp = mergeDisposition(value);
  const col = disp === "auto" ? "var(--success)" : disp === "review" ? "var(--warning)" : "var(--text-3)";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-default-100">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: col }} />
      </div>
      <span className="tnum text-[13px] font-bold" style={{ color: col }}>{value}%</span>
    </div>
  );
}

const RISK_TILES: { f: string; label: string }[] = [
  { f: "all", label: "全部主体" },
  { f: "high", label: "高危" },
  { f: "mid", label: "中风险" },
  { f: "low", label: "低风险" },
];

const PAGE_SIZE = 10; // 与 MSW 后端分页口径一致

export default function SubjectList() {
  const nav = useNavigate();
  const [risk, setRisk] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pickRisk = (f: string) => { setRisk(f); setPage(1); };
  const search = (v: string) => { setQ(v); setPage(1); };

  // 列表由 MSW 后端按 risk/q/page 真实过滤 + 分页(每页 10);候选队列全量(仅 50–74 复核区间)
  const { data, isLoading, isError } = useSubjects({ risk: risk === "all" ? undefined : risk, q: q.trim() || undefined, page });
  const candQ = useMergeCandidates();

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cand = candQ.data ?? [];

  // 各风险档计数 —— 取分档查询返回的 total(分页只影响 items,total 恒为该档全量;各查询被 React Query 缓存)
  const counts: Record<string, number> = {
    all: useSubjects({}).data?.total ?? 0,
    high: useSubjects({ risk: "high" }).data?.total ?? 0,
    mid: useSubjects({ risk: "mid" }).data?.total ?? 0,
    low: useSubjects({ risk: "low" }).data?.total ?? 0,
  };

  return (
    <Shell crumb={["风控", "检测策略", "主体归并"]} wide>
      <PageHead
        title="主体归并"
        sub="跨账户身份归并:同一实控人的多个账户经设备指纹 / 提现地址 / IP 段 / 资金路径等多维信号聚合为单一主体。置信度 ≥75 自动归并,50–74 进入人工复核队列,<50 不归并。"
        actions={<Button size="sm" radius="full" variant="flat" className="bg-default-100" startContent={<Network className="h-3.5 w-3.5" />} onPress={() => nav("/rings")}>关联团伙 →</Button>}
      />

      {/* 复核队列提醒 —— 50–74 区间待人工裁决 */}
      {cand.length > 0 && (
        <button onClick={() => document.getElementById("cand-queue")?.scrollIntoView({ behavior: "smooth" })}
          className="card card-hover mb-5 flex w-full items-center gap-3 px-4 py-3.5 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--warning-bg)" }}><GitMerge className="h-[18px] w-[18px]" style={{ color: "var(--warning)" }} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold">归并复核队列 · {cand.length} 项待人工裁决</span>
            <span className="block text-[12px] text-default-500">置信度落在 50–74 复核区间,需分析师确认后归并或拒绝</span>
          </span>
          <span className="text-[12px] font-semibold text-brand">查看 ↓</span>
        </button>
      )}

      {/* 风险分档 */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {RISK_TILES.map((t) => {
          const on = risk === t.f;
          return (
            <button key={t.f} onClick={() => pickRisk(t.f)}
              className={`card card-hover px-4 py-3.5 text-left ${on ? "outline outline-2 -outline-offset-2 outline-[var(--brand)]" : ""}`}>
              <div className="text-[12.5px] text-default-500">{t.label}</div>
              <div className="mt-1.5 text-[26px] font-extrabold leading-none tnum" style={{ color: on ? "var(--brand)" : undefined }}>{counts[t.f] ?? 0}</div>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input size="sm" radius="full" value={q} onValueChange={search} placeholder="搜索主体 ID、名称或所属团伙…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="max-w-[360px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
        {!isLoading && !isError && <span className="ml-auto text-[12.5px] text-default-400">共 <span className="font-semibold text-default-600">{total}</span> 个主体</span>}
      </div>

      {isError ? (
        <div className="card flex items-center gap-2.5 px-4 py-8 text-[13px] text-danger"><ShieldAlert className="h-4 w-4" />主体数据加载失败,请重试。</div>
      ) : isLoading ? (
        <div className="card flex items-center justify-center py-16"><Spinner color="primary" /></div>
      ) : (
        <Table aria-label="主体归并" radius="lg"
          classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-5 text-[13px] whitespace-nowrap", tr: "border-b border-default-100 last:border-0 transition-colors hover:bg-default-50 cursor-pointer" }}>
          <TableHeader>
            <TableColumn>主体 / 名称</TableColumn><TableColumn>类型</TableColumn><TableColumn>风险分</TableColumn>
            <TableColumn>归并置信</TableColumn><TableColumn>账户</TableColumn><TableColumn>所属团伙</TableColumn>
            <TableColumn>涉及金额</TableColumn><TableColumn>AML 命中</TableColumn><TableColumn>KYC</TableColumn><TableColumn>首次出现</TableColumn><TableColumn align="end">操作</TableColumn>
          </TableHeader>
          <TableBody emptyContent="没有符合条件的主体" items={rows}>
            {(s: Subject) => {
              const kyc = KYC_META[s.kycStatus];
              return (
                <TableRow key={s.id} onClick={() => nav(`/subject?id=${s.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Initials p={{ i: s.avatar, c: "var(--brand)" }} size={28} mono />
                      <div><div className="font-semibold">{s.name}</div><div className="text-[11px] text-default-400">{s.id}</div></div>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-default-500">{s.type === "entity" ? "机构" : "个人"}</span></TableCell>
                  <TableCell><Pill tone={LEVEL_TONE[s.riskLevel as RiskLevel]}>{LEVEL_LABEL[s.riskLevel as RiskLevel]} · {s.riskScore}</Pill></TableCell>
                  <TableCell><MergeBar value={s.mergeConfidence} /></TableCell>
                  <TableCell><span className="tnum font-semibold">{s.accountCount}</span><span className="text-default-400"> 个</span></TableCell>
                  <TableCell>
                    {s.ringId
                      ? <button onClick={(e) => { e.stopPropagation(); nav(`/ring?id=${s.ringId}`); }} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><Network className="h-3.5 w-3.5" />{s.ringId}</button>
                      : <span className="text-default-300">未关联</span>}
                  </TableCell>
                  <TableCell><span className="tnum text-default-600">{fmtCadCompact(s.totalAmountCad)}</span></TableCell>
                  <TableCell>{s.amlHitCount > 0 ? <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--danger)" }}><ShieldAlert className="h-3.5 w-3.5" />{s.amlHitCount}</span> : <span className="text-default-300">0</span>}</TableCell>
                  <TableCell><Pill tone={kyc.tone} dot={false}>{kyc.label}</Pill></TableCell>
                  <TableCell><span className="text-default-500">{fmtDate(s.firstSeen)}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                      <Tooltip content="查看归并详情" size="sm" delay={300}><Button isIconOnly size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => nav(`/subject?id=${s.id}`)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button></Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      )}

      {!isLoading && !isError && pageCount > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination showControls size="sm" radius="full" total={pageCount} page={page} onChange={setPage} />
        </div>
      )}

      {/* 归并复核队列 —— 50–74 区间候选,逐条查看到目标主体裁决 */}
      {cand.length > 0 && (
        <div id="cand-queue" className="mt-8 scroll-mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-default-400" strokeWidth={1.9} />
            <h2 className="text-[16px] font-bold">归并复核队列</h2>
            <span className="rounded-full bg-default-100 px-2 py-0.5 text-[11px] font-bold text-default-500">{cand.length}</span>
          </div>
          <Table aria-label="归并复核队列" radius="lg"
            classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] whitespace-nowrap", tr: "border-b border-default-100 last:border-0 transition-colors hover:bg-default-50 cursor-pointer" }}>
            <TableHeader>
              <TableColumn>候选账户</TableColumn><TableColumn>拟归入主体</TableColumn><TableColumn>关联证据</TableColumn><TableColumn>置信度</TableColumn><TableColumn>检出时间</TableColumn><TableColumn align="end">操作</TableColumn>
            </TableHeader>
            <TableBody>
              {cand.map((c) => (
                <TableRow key={c.id} onClick={() => nav(`/subject?id=${c.targetSubjectId}`)}>
                  <TableCell><span className="font-semibold">{c.accountId}</span></TableCell>
                  <TableCell><div className="font-medium">{c.targetSubjectName}</div><div className="text-[11px] text-default-400">{c.targetSubjectId}</div></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {c.evidence.map((e, i) => (
                        <span key={i} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--track)", color: DIM_META[e.dimension].color }}>{DIM_META[e.dimension].short}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell><MergeBar value={c.confidence} /></TableCell>
                  <TableCell><span className="text-default-500">{fmtDate(c.detectedAt)}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => nav(`/subject?id=${c.targetSubjectId}`)}>去裁决 →</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Shell>
  );
}
