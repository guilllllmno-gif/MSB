// 商户档案(/subject?id=SUBJ-xxxx)—— 只读档案页(团伙成员下钻目标)。
// 领域修正后:提现地址由商户自行加入白名单(申报即绑定),不存在「钱包归属」这一风控决策;
// 本页只呈现档案事实:基本信息 + 提现白名单地址 + 所属团伙 + AML 命中。消费 useSubject → SubjectDetail。
// 视觉基准=rc-app 现有页面(Shell/PageHead/Pill/Initials/card 复用,只有「状态」用色)。
import { useNavigate, useSearchParams } from "react-router-dom";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Spinner } from "@heroui/react";
import { ArrowLeft, ChevronRight, ShieldCheck, ShieldAlert, AlertTriangle, Wallet, Network } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials, SectionLabel } from "@/components/bits";
import { useSubject } from "@/hooks/useSubjects";
import { LEVEL_TONE, LEVEL_LABEL } from "@/schemas/common";
import { KYC_META } from "@/lib/domain";
import { fmtCad, fmtCadCompact, fmtDate, fmtAge } from "@/lib/format";

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

export default function SubjectDetail() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const id = sp.get("id") || undefined;
  const { data: s, isLoading, isError } = useSubject(id);

  if (isLoading) {
    return (
      <Shell crumb={["风控", "检测策略", "商户档案", "详情"]} wide>
        <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-default-400"><Spinner size="sm" />加载商户档案…</div>
      </Shell>
    );
  }
  if (isError || !s) {
    return (
      <Shell crumb={["风控", "检测策略", "商户档案", "详情"]} wide>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <AlertTriangle className="h-6 w-6 text-default-300" />
          <div className="text-[13px] text-default-500">{id ? "未找到该主体或加载失败" : "缺少主体 ID"}</div>
          <Button size="sm" radius="full" variant="flat" startContent={<ArrowLeft className="h-3.5 w-3.5" />} onPress={() => nav("/subjects")}>返回列表</Button>
        </div>
      </Shell>
    );
  }

  const kycM = KYC_META[s.kycStatus];
  const isMerchant = s.type === "entity";

  return (
    <Shell crumb={["风控", "检测策略", "商户档案", s.name]} wide>
      <PageHead
        title={s.name}
        sub={`${s.id} · ${isMerchant ? "商户" : "自然人"} · 首现 ${fmtDate(s.firstSeen)} · 账龄 ${fmtAge(s.accountAgeDays)}`}
        actions={<Button size="sm" radius="full" variant="flat" startContent={<ArrowLeft className="h-3.5 w-3.5" />} onPress={() => nav("/subjects")}>返回列表</Button>}
      />

      {/* ── 身份 + 状态徽标 ── */}
      <div className="card mb-4 flex flex-wrap items-center gap-4 p-4">
        <Initials p={{ i: s.avatar, c: "var(--brand)" }} size={44} mono />
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={LEVEL_TONE[s.riskLevel]}>{LEVEL_LABEL[s.riskLevel]}风险 · {s.riskScore}</Pill>
          <Pill tone={kycM.tone} dot={false}>KYC {kycM.label}</Pill>
          {s.ringId
            ? <button className="inline-flex items-center gap-1 rounded-full border border-default-200 bg-default-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-primary hover:underline" onClick={() => nav(`/ring?id=${s.ringId}`)}>
                所属团伙 {s.ringId}{s.ringRole ? ` · ${s.ringRole}` : ""}<ChevronRight className="h-3 w-3" />
              </button>
            : <Pill tone="grey" dot={false}>无关联团伙</Pill>}
        </div>
      </div>

      {/* ── 概览 ── */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="提现白名单地址" value={`${s.walletCount} 个`} sub="商户自行申报加白" />
        <Stat label="涉及金额" value={fmtCadCompact(s.totalAmountCad)} sub={fmtCad(s.totalAmountCad)} />
        <Stat label="AML 命中" value={s.amlHitCount} sub={`规则命中 ${s.ruleHitCount}`} />
        <Stat label="风险分" value={s.riskScore} sub={`${LEVEL_LABEL[s.riskLevel]}风险`} />
        <Stat label="账龄" value={fmtAge(s.accountAgeDays)} sub={`首现 ${fmtDate(s.firstSeen)}`} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* ── 主区:提现白名单地址 ── */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <SectionLabel>提现白名单地址（{s.wallets.length}）</SectionLabel>
            <span className="text-[11px] text-default-400">· 商户侧提现前须先加入白名单</span>
          </div>
          <Table aria-label="提现白名单地址" radius="lg"
            classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-11 border-b border-divider whitespace-nowrap", td: "py-4 text-[13px] align-top", tr: "border-b border-default-100 last:border-0" }}>
            <TableHeader>
              <TableColumn>钱包地址</TableColumn><TableColumn>类型</TableColumn><TableColumn>备注</TableColumn><TableColumn>登记日</TableColumn>
            </TableHeader>
            <TableBody>
              {s.wallets.map((a) => (
                <TableRow key={a.address}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Wallet className="h-3.5 w-3.5 text-default-300" />
                      <span className="rounded-md bg-default-100 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-default-600">{a.address}</span>
                    </div>
                  </TableCell>
                  <TableCell>{a.isAnchor
                    ? <span className="text-[12px] font-semibold text-default-600">主结算地址</span>
                    : <span className="text-[12px] text-default-400">提现地址</span>}</TableCell>
                  <TableCell><span className="text-default-500">{a.meta}</span></TableCell>
                  <TableCell><span className="tnum text-default-500">{fmtDate(a.registeredAt)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* ── 侧栏:所属团伙 + AML 命中 ── */}
        <div className="space-y-8">
          <div>
            <div className="mb-3"><SectionLabel>所属团伙</SectionLabel></div>
            {s.ringId ? (
              <button onClick={() => nav(`/ring?id=${s.ringId}`)}
                className="card flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-default-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-default-100"><Network className="h-4 w-4 text-default-500" /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.ringId}</div>
                  <div className="text-[11.5px] text-default-400">{s.ringRole ? `本商户角色 · ${s.ringRole}` : "关联团伙成员"}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-default-300" />
              </button>
            ) : (
              <div className="card flex items-center justify-center gap-2 py-6 text-[12px] text-default-400"><ShieldCheck className="h-4 w-4 text-success" />未关联任何团伙</div>
            )}
          </div>

          <div>
            <div className="mb-3"><SectionLabel>AML 命中（{s.amlHits.length}）</SectionLabel></div>
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
        </div>
      </div>
    </Shell>
  );
}
