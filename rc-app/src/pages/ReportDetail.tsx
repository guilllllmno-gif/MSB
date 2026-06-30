import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@heroui/react";
import { ArrowLeft, Clock, Eye, FileSignature, Send, Check, Info, ExternalLink, FileText, ClipboardList, Landmark, Coins, Users, ShieldAlert, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Pill, Initials, toneVar } from "@/components/bits";
import { ReportDrawer } from "@/components/ReportDrawer";
import { RTYPE, RSTATE, RSTEPS, reportStep, reportDetail, type Report, type RType, type RState, type StrDoc, type KV } from "@/lib/reports";
import { findReport, liveStatus } from "@/lib/reportsAll";
import { reportStore, useReportVersion, useCaseVersion } from "@/lib/store";
import type { Person, Tone } from "@/lib/data";

const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const DW: Person = { i: "DW", n: "David Wu", c: "#0ea5e9" };

// 处理记录条目(按类型 / 状态合成,新→旧)
interface LogItem { tone: Tone; title: string; meta: string; note?: string }
function baseLog(r: Report, st: RState): LogItem[] {
  const done = (s: RState) => reportStep(st) > reportStep(s) || (!RSTATE[st].active && st !== "void");
  if (r.type === "LVCTR") {
    const items: LogItem[] = [];
    if (st === "queued") items.push({ tone: "amber", title: "待报送", meta: "当前 · 等待批量提交" });
    if (st === "filed") items.push({ tone: "violet", title: "已报送 · 待回执", meta: r.filedAt || "已提交 FINTRAC" });
    if (st === "ack") items.push({ tone: "green", title: "FINTRAC 已接收", meta: r.filedAt || "已获回执" });
    items.push({ tone: "green", title: "自动归集成批", meta: "系统 · 06-19 00:00", note: "归集当日 12 笔达阈交易" });
    items.push({ tone: "blue", title: "阈值触发", meta: "R-AMT-01 · 06-18 持续" });
    return items;
  }
  if (r.type === "TPR") {
    return [
      { tone: st === "ack" ? "green" : "violet", title: st === "ack" ? "FINTRAC 已接收" : "已报送 · 待回执", meta: r.filedAt || "立即上报已提交" },
      { tone: "violet", title: "资产冻结 · 阻断交易", meta: "系统 · 制裁命中即时" },
      { tone: "red", title: "OFAC SDN 命中", meta: "制裁筛查 · R-SANC-01" },
    ];
  }
  // STR
  const items: LogItem[] = [];
  if (st === "draft") items.push({ tone: "grey", title: "起草中", meta: "当前 · 分析师撰写可疑理由" });
  if (st === "review") items.push({ tone: "amber", title: "待 MLRO 签发", meta: `当前 · 等待 ${DW.n} 终审` });
  if (st === "queued") items.push({ tone: "blue", title: "待报送", meta: "MLRO 已签发 · 入报送队列" });
  if (st === "filed") items.push({ tone: "violet", title: "已报送 · 待回执", meta: r.filedAt || "已提交 FINTRAC" });
  if (st === "ack") items.push({ tone: "green", title: "FINTRAC 已接收", meta: r.filedAt || "已获回执" });
  if (done("review") || st === "review" || st === "queued" || st === "filed" || st === "ack")
    items.push({ tone: "green", title: "分析师复核通过", meta: `${SC.n} · 03-02 14:20`, note: "资金链与过水模式成立,建议上报" });
  items.push({ tone: "green", title: "起草 STR", meta: `${SC.n} · 03-01` });
  return items;
}

// 进度条(5 步,按类型自适应标签)
function Stepper({ type, st }: { type: RType; st: RState }) {
  const steps = RSTEPS[type];
  const cur = reportStep(st);
  const returned = st === "returned";
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const isDone = i < cur || (!RSTATE[st].active && st === "ack" && i <= cur);
        const isCur = i === cur;
        const tone = returned && isCur ? "var(--danger)" : isCur ? "var(--brand)" : isDone ? "var(--success)" : "var(--default-300, #c4c4c8)";
        return (
          <div key={i} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: isDone ? "var(--success)" : isCur ? (returned ? "var(--danger)" : "var(--brand)") : "var(--track)", color: isDone || isCur ? "#fff" : "var(--text-3)" }}>
                {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="whitespace-nowrap text-[12.5px] font-semibold" style={{ color: isCur ? tone : isDone ? "var(--text-2)" : "var(--text-3)" }}>{label}</span>
            </div>
            {i < steps.length - 1 && <span className="mx-2 h-0.5 flex-1 rounded-full" style={{ background: i < cur ? "var(--success)" : "var(--track)" }} />}
          </div>
        );
      })}
    </div>
  );
}

function Card({ icon: Icon, title, extra, children }: { icon: typeof FileText; title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-3.5 flex items-center gap-2">
        <Icon className="h-[18px] w-[18px] text-default-500" strokeWidth={1.9} />
        <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
        {extra && <span className="ml-auto text-[11.5px] text-default-400">{extra}</span>}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2.5 text-[12.5px] last:border-0"><span className="text-default-500">{k}</span><span className="text-right font-semibold">{children}</span></div>;
}

export default function ReportDetail() {
  useReportVersion(); useCaseVersion();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const id = params.get("id") || "";
  const r = findReport(id);

  if (!r) return (
    <Shell crumb={["治理与合规", "报告报送", "未找到"]} wide>
      <div className="card flex flex-col items-center justify-center gap-3 py-20 text-center">
        <FileText className="h-8 w-8 text-default-300" />
        <div className="text-[14px] font-semibold">未找到报告 {id}</div>
        <Button size="sm" variant="flat" onPress={() => nav("/reports")}>返回报送台账</Button>
      </div>
    </Shell>
  );

  const st = liveStatus(r);
  const ty = RTYPE[r.type];
  const sd = RSTATE[st];
  const d = reportDetail(r);
  const mlro = reportStore.mlroOf(r.id, r.mlro);
  const ref = reportStore.refOf(r.id, r.ref);
  const events = reportStore.eventsOf(r.id);
  const log = baseLog(r, st);

  const primaryLabel = r.type === "LVCTR" ? "批量报送" : r.type === "TPR" ? "上报 / 回执" : "MLRO 签发报送";
  const PrimaryIcon = r.type === "LVCTR" ? Send : FileSignature;

  return (
    <Shell crumb={["治理与合规", "报告报送", r.id]} wide>
      <button onClick={() => nav("/reports")} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-default-500 transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" />报送台账</button>

      {/* 页头卡:标题 + 类型/状态 + 操作 + 进度条 */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="text-[26px] font-extrabold tracking-tight">{r.id}</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <Pill tone={ty.tone} dot={false}>{ty.label} · {ty.full}</Pill>
            <Pill tone={sd.tone}>{sd.label}</Pill>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold" style={{ borderColor: r.due.tone === "red" ? "var(--danger-bd)" : "var(--warning-bd)", background: r.due.tone === "red" ? "var(--danger-bg)" : "var(--warning-bg)", color: r.due.tone === "red" ? "var(--danger)" : "var(--warning)" }}><Clock className="h-3.5 w-3.5" />报送时限 {r.due.text}</span>
            <Button variant="bordered" startContent={<Eye className="h-4 w-4" />} onPress={() => toast.success(`已导出 ${r.type} 报文 (JSON)`)}>预览报文</Button>
            {sd.active && <Button color={r.type === "LVCTR" ? "primary" : "secondary"} className={r.type === "STR" ? "bg-[var(--violet)] text-white" : ""} startContent={<PrimaryIcon className="h-4 w-4" />} onPress={() => setOpen(true)}>{primaryLabel}</Button>}
          </div>
        </div>

        {/* sub line — 按类型自适应 */}
        <p className="mt-2 text-[13px] text-default-500">
          {r.type === "LVCTR" ? (
            <>交易批次 <b className="text-foreground">{d.batch?.window || r.sub}</b> · 来源 <b className="text-foreground">{r.src}</b> · 触发阈值 <b className="text-foreground">{d.batch?.threshold}</b> · 共 <b className="text-foreground">{d.batch?.count} 笔</b></>
          ) : (
            <>涉事主体 <b className="text-foreground">{r.subject}</b> · 来源 {r.to ? <button onClick={() => nav(r.to!)} className="font-semibold text-primary hover:opacity-80">{r.src} {r.srcId}</button> : <b className="text-foreground">{r.src}</b>} · 起草人 <b className="text-foreground">{r.officer.n}</b>{r.officer.i !== "系" && "（风控）"} · 金额 <b className="text-foreground tnum">{r.amount}</b></>
          )}
        </p>

        <div className="mt-4 border-t border-default-100 pt-4"><Stepper type={r.type} st={st} /></div>
      </div>

      {/* 客观类报告(LVCTR/TPR)顶部说明横幅 */}
      {r.type !== "STR" && (
        <div className="card mb-5 flex items-start gap-2.5 border-l-[3px] p-3.5" style={{ borderLeftColor: "var(--brand)", background: "var(--brand-softer, var(--brand-soft))" }}>
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p className="text-[12.5px] leading-relaxed text-default-600">
            {r.type === "LVCTR"
              ? <><b>LVCTR 按客观阈值自动生成</b>:单笔或日累计 ≥ CAD 10,000 的虚拟货币交易,<b>无需可疑判定</b>,系统自动归集成批、按 FINTRAC 要求批量报送。下方为本批次归集的交易明细。</>
              : <><b>TPR 制裁财产报告</b>:收款方命中制裁名单即触发,资金已实时冻结、阻断交易,属<b>法定即时上报</b>(无延迟),非可疑判定。人工只需在时限内确认并登记回执。</>}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* 左栏 */}
        <div className="flex flex-col gap-5">
          {/* STR/TPR:可疑理由 / 依据叙述 */}
          {d.reason && (
            <Card icon={ClipboardList} title={r.type === "TPR" ? "上报依据" : "可疑理由"} extra={d.reason.src}>
              <p className="rounded-xl border border-divider bg-default-50 p-4 text-[13px] leading-relaxed text-default-700">{d.reason.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{d.reason.tags.map((t) => <Pill key={t.label} tone={t.tone} dot={false}>{t.label}</Pill>)}</div>
            </Card>
          )}

          {/* LVCTR:归集交易明细 */}
          {d.batch && (
            <Card icon={ClipboardList} title="归集交易明细" extra={`本批次 ${d.batch.count} 笔 · 显示前 ${d.batch.shown}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead><tr className="border-b border-default-100 text-left text-[11px] font-bold uppercase tracking-wider text-default-400">
                    <th className="py-2 pr-3">交易号</th><th className="py-2 pr-3">主体</th><th className="py-2 pr-3">类型</th><th className="py-2 pr-3">时间</th><th className="py-2 text-right">金额 (CAD)</th>
                  </tr></thead>
                  <tbody>
                    {d.batch.txns.map((t) => (
                      <tr key={t.id} className="border-b border-default-50">
                        <td className="py-2.5 pr-3 font-semibold">{t.id}</td><td className="py-2.5 pr-3">{t.party}</td>
                        <td className="py-2.5 pr-3 text-default-500">{t.kind}</td><td className="py-2.5 pr-3 text-default-500 tnum">{t.time}</td>
                        <td className="py-2.5 text-right font-semibold tnum">{t.amount}</td>
                      </tr>
                    ))}
                    <tr className="font-bold"><td className="py-3 pr-3" colSpan={4}>批次合计（{d.batch.count} 笔）</td><td className="py-3 text-right tnum">{d.batch.total}</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-default-400">{d.batch.note}</p>
            </Card>
          )}

          {/* FINTRAC 报文预览 —— STR 走完整分部报文,LVCTR/TPR 走简版键值 */}
          <Card icon={FileText} title="FINTRAC 报文预览" extra={r.type === "STR" && d.strDoc ? `F2-R · 报告参考 ${d.strDoc.reportRef}` : d.preview.format}>
            {r.type === "STR" && d.strDoc ? <StrPreview doc={d.strDoc} /> : (
              <div className="overflow-hidden rounded-xl border border-divider">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-white" style={{ background: "#0f172a" }}>
                  <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold"><FileText className="h-4 w-4" />{d.preview.title}</span>
                  <span className="text-[11px] text-white/60">{d.preview.format}</span>
                </div>
                <div className="px-4 py-1">
                  {d.preview.rows.map((row) => (
                    <div key={row.k} className="flex items-baseline gap-4 border-b border-dashed border-default-200 py-2.5 text-[12.5px] last:border-0">
                      <span className="w-[160px] shrink-0 text-default-400">{row.k}</span><span className="font-semibold">{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* 右栏 */}
        <div className="flex flex-col gap-5">
          {/* 报告信息(按类型自适应)*/}
          <Card icon={Info} title="报告信息">
            <InfoRow k="报告类型">{ty.label} · {ty.full}</InfoRow>
            {r.type === "LVCTR" ? (
              <>
                <InfoRow k="触发方式"><span className="text-brand">{d.batch?.trigger}</span></InfoRow>
                <InfoRow k="触发阈值">{d.batch?.threshold}</InfoRow>
                <InfoRow k="批次笔数">{d.batch?.count} 笔</InfoRow>
                <InfoRow k="批次合计"><span className="tnum">{d.batch?.total}</span></InfoRow>
              </>
            ) : (
              <>
                <InfoRow k="监管口径">FINTRAC（加拿大）</InfoRow>
                {r.srcId && <InfoRow k={r.type === "TPR" ? "来源" : "来源案件"}>{r.to ? <button onClick={() => nav(r.to!)} className="inline-flex items-center gap-1 text-primary hover:opacity-80">{r.srcId}<ExternalLink className="h-3 w-3" /></button> : r.srcId}</InfoRow>}
                <InfoRow k="起草人"><span className="inline-flex items-center gap-1.5"><Initials p={r.officer} size={20} />{r.officer.n} · {r.officer.i === "系" ? "系统" : "分析师"}</span></InfoRow>
                <InfoRow k="签发人">{mlro ? <span className="inline-flex items-center gap-1.5"><Initials p={mlro} size={20} />{mlro.n} · MLRO</span> : <span className="text-default-400">待签发</span>}</InfoRow>
              </>
            )}
            <InfoRow k="法定时限"><span style={{ color: r.due.tone === "red" ? "var(--danger)" : r.due.tone === "amber" ? "var(--warning)" : undefined }}>{ty.deadline.includes("30") ? "30 日内" : ty.deadline} · {r.due.text}</span></InfoRow>
            {ref && <InfoRow k="FINTRAC 回执"><span className="text-success">{ref}</span></InfoRow>}
          </Card>

          {/* 处理记录 */}
          <Card icon={Clock} title="处理记录" extra="全程留痕">
            <ol className="flex flex-col">
              {/* 本会话实时事件(最新)*/}
              {[...events].reverse().map((e, i) => (
                <LogRow key={`ev-${i}`} item={{ tone: "blue", title: e.text, meta: `${e.t}（本会话）`, note: e.reason || undefined }} last={false} />
              ))}
              {log.map((it, i) => <LogRow key={i} item={it} last={i === log.length - 1} />)}
            </ol>
          </Card>
        </div>
      </div>

      <ReportDrawer report={r} open={open} onOpenChange={setOpen} />
    </Shell>
  );
}

function LogRow({ item, last }: { item: LogItem; last: boolean }) {
  return (
    <li className="flex gap-3">
      <div className="flex w-3 shrink-0 flex-col items-center">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: toneVar(item.tone) }} />
        {!last && <span className="my-1 w-0.5 flex-1 rounded-full bg-default-200" />}
      </div>
      <div className={last ? "pb-0" : "pb-4"}>
        <div className="text-[12.5px] font-semibold">{item.title}</div>
        <div className="mt-0.5 text-[11px] text-default-400 tnum">{item.meta}</div>
        {item.note && <div className="mt-1.5 rounded-lg bg-default-50 px-2.5 py-1.5 text-[11.5px] text-default-600">{item.note}</div>}
      </div>
    </li>
  );
}

// ── 完整 FINTRAC STR 分部报文预览 ──────────────────────────────────────────
const flagColor = (t?: KV["flag"]) => (t ? toneVar(t) : undefined);

function KvGrid({ rows }: { rows: KV[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {rows.map((f, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed border-default-200 py-2 text-[12px]">
          <span className="shrink-0 text-default-400">{f.k}<span className="ml-1 text-[10px] text-default-300">{f.en}</span></span>
          <span className="text-right font-semibold" style={{ color: flagColor(f.flag) }}>{f.v}</span>
        </div>
      ))}
    </div>
  );
}

function Part({ no, title, en, icon: Icon, children }: { no: string; title: string; en: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <section className="px-4 py-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 items-center rounded-md bg-default-100 px-1.5 text-[10.5px] font-bold tracking-wide text-default-500">PART {no}</span>
        <Icon className="h-4 w-4 text-default-500" strokeWidth={1.9} />
        <span className="text-[13px] font-bold">{title}</span>
        <span className="text-[10.5px] text-default-300">{en}</span>
      </div>
      {children}
    </section>
  );
}

function StrPreview({ doc }: { doc: StrDoc }) {
  return (
    <div className="overflow-hidden rounded-xl border border-divider">
      {/* FINTRAC 文档抬头 */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-white" style={{ background: "#0f172a" }}>
        <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold"><FileText className="h-4 w-4" />Suspicious Transaction Report (STR)</span>
        <span className="text-[11px] text-white/60">FINTRAC F2-R · {doc.reportRef}</span>
      </div>

      <div className="divide-y divide-default-100">
        <Part no="A" title="报告与报送机构" en="Report & Reporting Entity" icon={Landmark}><KvGrid rows={doc.header} /></Part>

        <Part no="B" title="交易明细 · 虚拟货币" en="Transaction Information" icon={Coins}>
          <div className="flex flex-col gap-2.5">
            {doc.txns.map((t) => (
              <div key={t.ref} className="rounded-xl border border-divider bg-default-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: t.dir === "存入" ? "var(--success-bg)" : "var(--warning-bg)", color: t.dir === "存入" ? "var(--success)" : "var(--warning)" }}>
                    {t.dir === "存入" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-[12.5px] font-bold">{t.dir} · {t.dirEn}</span>
                  <span className="ml-auto text-[10.5px] text-default-400">{t.ref}</span>
                </div>
                <KvGrid rows={t.fields} />
              </div>
            ))}
          </div>
        </Part>

        <Part no="C" title="账户 / 处置" en="Account Information" icon={Landmark}><KvGrid rows={doc.account} /></Part>

        <Part no="D" title="涉事主体" en="Persons & Entities Involved" icon={Users}>
          <div className="flex flex-col gap-2.5">
            {doc.parties.map((p) => (
              <div key={p.name} className="rounded-xl border border-divider bg-default-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Pill tone="grey" dot={false}>{p.role}</Pill>
                  <span className="text-[12.5px] font-bold">{p.name}</span>
                  <span className="ml-auto text-[10.5px] text-default-400">{p.roleEn}</span>
                </div>
                <KvGrid rows={p.fields} />
              </div>
            ))}
          </div>
        </Part>

        <Part no="F" title="可疑理由 · 合理怀疑" en="Grounds for Suspicion" icon={ShieldAlert}>
          <p className="rounded-xl border border-divider bg-white p-3 text-[12.5px] leading-relaxed text-default-700 dark:bg-default-50">{doc.grounds}</p>
        </Part>

        <Part no="G" title="已采取措施" en="Action Taken" icon={Check}><KvGrid rows={doc.action} /></Part>
      </div>
    </div>
  );
}
