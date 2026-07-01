// 商户档案列表(/subjects)—— 团伙成员的下钻来源 + 主体检索入口。
// 领域修正后:提现地址由商户自行加白(申报即绑定),无「钱包归属」这一风控决策;
// 本页只做商户/主体档案检索(useSubjects,MSW handler 真实筛选/分页/搜索),行点击跳只读档案 /subject。
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Button, Input, Select, SelectItem, Spinner,
} from "@heroui/react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { useSubjects } from "@/hooks/useSubjects";
import { LEVEL_TONE, LEVEL_LABEL } from "@/schemas/common";
import { KYC_META } from "@/lib/domain";
import { fmtCadCompact } from "@/lib/format";

const PAGE_SIZE = 10;

export default function SubjectWorkbench() {
  const nav = useNavigate();
  const [risk, setRisk] = useState("");
  const [kyc, setKyc] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const subjectsQ = useSubjects({ risk: risk || undefined, status: kyc || undefined, q: q || undefined, page });

  const total = subjectsQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = subjectsQ.data?.items ?? [];

  // 筛选/搜索变更时回到第 1 页
  const setFilter = (fn: () => void) => { fn(); setPage(1); };

  return (
    <Shell crumb={["风控", "检测策略", "商户档案"]} wide>
      <PageHead
        title="商户档案"
        sub="商户(公司主体)与关联自然人的档案目录。提现地址由商户自行加入白名单,档案汇总其白名单地址、涉及金额、AML 命中与所属团伙。行点击查看只读档案。"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input size="sm" radius="full" value={q} onValueChange={(v) => setFilter(() => setQ(v))} placeholder="搜索商户/主体名称或 ID…"
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

      <Table aria-label="商户档案" radius="lg"
        classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-5 text-[13px] whitespace-nowrap", tr: "border-b border-default-100 last:border-0 transition-colors hover:bg-default-50 cursor-pointer" }}>
        <TableHeader>
          <TableColumn>商户 / 主体</TableColumn><TableColumn>风险</TableColumn><TableColumn>白名单地址</TableColumn>
          <TableColumn>涉及金额</TableColumn><TableColumn>AML 命中</TableColumn><TableColumn>KYC</TableColumn><TableColumn>所属团伙</TableColumn>
        </TableHeader>
        <TableBody
          isLoading={subjectsQ.isLoading}
          loadingContent={<div className="flex items-center gap-2 py-8 text-[13px] text-default-400"><Spinner size="sm" />加载商户档案…</div>}
          emptyContent={subjectsQ.isError ? "加载失败" : "没有符合条件的商户"}>
          {rows.map((s) => {
            const kycM = KYC_META[s.kycStatus];
            return (
              <TableRow key={s.id} onClick={() => nav(`/subject?id=${s.id}`)}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Initials p={{ i: s.avatar, c: "var(--brand)" }} size={28} mono />
                    <div><div className="font-semibold">{s.name}</div><div className="text-[11px] text-default-400">{s.id} · {s.type === "entity" ? "商户" : "自然人"}</div></div>
                  </div>
                </TableCell>
                <TableCell><Pill tone={LEVEL_TONE[s.riskLevel]}>{LEVEL_LABEL[s.riskLevel]} · {s.riskScore}</Pill></TableCell>
                <TableCell><span className="font-semibold tnum">{s.walletCount}</span> <span className="text-default-400">个</span></TableCell>
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
