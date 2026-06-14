import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Snowflake, ArrowUpRight, FileText, ShieldAlert, FolderOpen, Wallet, Building2, UsersRound, Pencil, Paperclip, Link2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { ConfigTab } from "@/components/ConfigTab";
import { Pill, RiskBadge, StatTile } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  merchant, merchantProfile as P, personnel, transactions, activity, riskLevel,
  depositFees, withdrawFees, exchangeSpreads, withdrawAddrs, accountStatus, freezeHistory,
} from "@/lib/data";

function Field({ label, req, children }: { label: string; req?: boolean; children: ReactNode }) {
  return (
    <div className="border-b border-dashed py-2.5">
      <div className="text-[11.5px] text-muted-foreground">{label}{req && <span style={{ color: "var(--danger)" }}> *</span>}</div>
      <div className="mt-1 text-[13.5px] font-semibold">{children}</div>
    </div>
  );
}
const DocLink = ({ name }: { name: string }) => (
  <button onClick={() => toast.success("打开 " + name)} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "var(--brand)" }}>
    <Paperclip className="h-3.5 w-3.5" />{name}
  </button>
);

function SectionTitle({ icon, children, extra }: { icon: ReactNode; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-3 mt-1 flex items-center gap-2">
      <span style={{ color: "var(--brand)" }}>{icon}</span>
      <h3 className="text-[15px] font-bold">{children}</h3>
      {extra}
    </div>
  );
}

function FeeTable({ head, rows }: { head: string[]; rows: ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader><TableRow>{head.map((h, i) => <TableHead key={i} className={i === head.length - 1 ? "text-right" : ""}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows}</TableBody>
      </Table>
    </Card>
  );
}

export default function Merchant360() {
  const nav = useNavigate();
  const crr = riskLevel(merchant.crr);
  const editToast = (s: string) => toast.success("已进入「" + s + "」编辑(需变更审批)");

  return (
    <Shell crumb={["商户", "商户管理", "商户列表", merchant.name]}>
      <button onClick={() => nav("/merchants")} className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回商户管理</button>

      {/* header */}
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-extrabold">{merchant.name}</h1>
            <RiskBadge tone={crr.tone}>CRR {crr.label} {merchant.crr}</RiskBadge>
            <Pill tone="amber">待审核</Pill>
          </div>
          <div className="mt-1.5 text-[13px] text-muted-foreground">
            {P.bizRegNo} · 注册于 {P.jurisdiction} · 入网时间 {P.onboarded} · 合规专员 {P.officer}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button style={{ background: "var(--brand)" }} onClick={() => toast.success("已重新计算 CRR")}><RefreshCw className="h-4 w-4" />更新 CRR</Button>
          <Button style={{ background: "var(--danger)" }} onClick={() => toast("已发起冻结商户审批")}><Snowflake className="h-4 w-4" />冻结商户</Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={<ArrowUpRight className="h-4 w-4" />} tone="blue" label="本月充值总数" value="1.28M" foot="CAD · 月环比 ↑ 142%" />
        <StatTile icon={<FileText className="h-4 w-4" />} tone="violet" label="历史 STR 申报" value={merchant.strCount} foot="首次 2025-09" />
        <StatTile icon={<ShieldAlert className="h-4 w-4" />} tone="amber" label="EDD 历史" value={merchant.eddCount} foot="1 进行中" />
        <StatTile icon={<FolderOpen className="h-4 w-4" />} tone="red" label="升级案件(合规)" value={3} foot="1 个待处理" />
        <StatTile icon={<Wallet className="h-4 w-4" />} tone="grey" label="注册钱包数" value={merchant.registeredWallets} foot={`${merchant.highRiskWallets} 个高风险`} />
      </div>

      {/* tabs */}
      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="tx">交易记录</TabsTrigger>
          <TabsTrigger value="config">配置</TabsTrigger>
          <TabsTrigger value="addr">提币地址</TabsTrigger>
          <TabsTrigger value="activity">活动日志</TabsTrigger>
          <TabsTrigger value="status">账户状态</TabsTrigger>
        </TabsList>

        {/* 基本信息 */}
        <TabsContent value="basic" className="mt-4">
          <SectionTitle icon={<Building2 className="h-4 w-4" />}>企业信息</SectionTitle>

          <Card className="mb-4"><CardContent className="py-4">
            <div className="text-[12.5px] font-bold text-muted-foreground">商户信息</div>
            <div className="mt-1 grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <Field label="商户名称" req>{P.merchantName}</Field>
              <Field label="商户号" req>{P.merchantNo}</Field>
            </div>
          </CardContent></Card>

          <Card className="mb-5"><CardContent className="py-4">
            <div className="text-[12.5px] font-bold text-muted-foreground">企业信息</div>
            <div className="mt-1 grid grid-cols-1 gap-x-8 md:grid-cols-2 lg:grid-cols-3">
              <Field label="公司注册号" req>{P.regNo}</Field>
              <Field label="商业登记证号码" req>{P.bizRegNo}</Field>
              <Field label="商业登记证有效期" req>{P.bizRegExpiry}</Field>
              <Field label="成立日期" req>{P.incorpDate}</Field>
              <Field label="注册国家/地区" req>{P.jurisdiction}</Field>
              <Field label="公司注册名称(中文)" req>{P.nameCn}</Field>
              <Field label="公司注册名称(英文)" req>{P.nameEn}</Field>
              <Field label="注册资本" req>{P.capital}</Field>
              <Field label="员工数量" req>{P.employees}</Field>
              <Field label="注册地址" req>{P.regAddr}</Field>
              <Field label="注册地址邮政编码" req>{P.regZip}</Field>
              <Field label="经营地址" req>{P.bizAddr}</Field>
              <Field label="经营地址邮政编码" req>{P.bizZip}</Field>
              <Field label="公司是否存在母公司" req>{P.hasParent}</Field>
              <Field label="注册证书(CI)" req><DocLink name={P.ci} /></Field>
              <Field label="企业章程(AOA)" req><DocLink name={P.aoa} /></Field>
            </div>
          </CardContent></Card>

          <SectionTitle icon={<UsersRound className="h-4 w-4" />} extra={<Pill tone="blue" dot={false}>3 人</Pill>}>人员信息</SectionTitle>
          <Card className="overflow-hidden p-0"><Table>
            <TableHeader><TableRow><TableHead>字段</TableHead><TableHead>法定人</TableHead><TableHead>董事</TableHead><TableHead>最终受益人(UBO)</TableHead></TableRow></TableHeader>
            <TableBody>
              {personnel.map((p) => {
                const cell = (v: string) => (p.link && v !== "—" ? <button onClick={() => toast.success("查看 " + v)} className="font-semibold" style={{ color: "var(--brand)" }}>{v}</button> : v);
                return (
                  <TableRow key={p.field}>
                    <TableCell className="text-[12.5px] text-muted-foreground">{p.field}{p.req && <span style={{ color: "var(--danger)" }}> *</span>}</TableCell>
                    <TableCell className="text-[13px] font-medium">{cell(p.legal)}</TableCell>
                    <TableCell className="text-[13px] font-medium">{cell(p.director)}</TableCell>
                    <TableCell className="text-[13px] font-medium">{cell(p.ubo)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table></Card>
        </TabsContent>

        {/* 交易记录 */}
        <TabsContent value="tx" className="mt-4">
          <Card className="overflow-hidden p-0"><Table>
            <TableHeader><TableRow><TableHead>订单号</TableHead><TableHead>方向</TableHead><TableHead>资产</TableHead><TableHead>数量</TableHead><TableHead>金额</TableHead><TableHead>状态</TableHead><TableHead>时间</TableHead></TableRow></TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><span className="font-mono text-[12px] font-semibold" style={{ color: "var(--brand)" }}>{t.id}</span></TableCell>
                  <TableCell><Pill tone={t.dir === "充值" ? "blue" : "violet"} dot={false}>{t.dir}</Pill></TableCell>
                  <TableCell className="text-[12.5px]">{t.asset}</TableCell>
                  <TableCell className="tnum">{t.amount}</TableCell>
                  <TableCell className="tnum">{t.cad}</TableCell>
                  <TableCell><Pill tone={t.statusTone}>{t.status}</Pill></TableCell>
                  <TableCell className="tnum text-[12px] text-muted-foreground">{t.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></Card>
        </TabsContent>

        {/* 配置 · 手续费配置 */}
        <TabsContent value="config" className="mt-4">
          <ConfigTab />
        </TabsContent>

        {/* 提币地址 */}
        <TabsContent value="addr" className="mt-4">
          <Card className="overflow-hidden p-0"><Table>
            <TableHeader><TableRow><TableHead>地址</TableHead><TableHead>网络</TableHead><TableHead>标签</TableHead><TableHead>KYW 评分</TableHead><TableHead>添加时间</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {withdrawAddrs.map((w) => {
                const lvl = riskLevel(w.kyw);
                return (
                  <TableRow key={w.address}>
                    <TableCell><span className="font-mono text-[12.5px] font-semibold">{w.address}</span></TableCell>
                    <TableCell className="text-[12.5px]">{w.chain}</TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground">{w.label}</TableCell>
                    <TableCell><RiskBadge tone={lvl.tone}>{w.kyw}</RiskBadge></TableCell>
                    <TableCell className="tnum text-[12px] text-muted-foreground">{w.added}</TableCell>
                    <TableCell><Pill tone={w.statusTone}>{w.status}</Pill></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => toast.success("已发起重新扫描")}><RefreshCw className="h-3 w-3" />重扫</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table></Card>
        </TabsContent>

        {/* 活动日志 */}
        <TabsContent value="activity" className="mt-4">
          <Card><CardContent className="py-5">
            <ol className="relative ml-2 border-l pl-6">
              {activity.map((e, i) => (
                <li key={i} className="relative pb-5 last:pb-0">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 bg-card" style={{ borderColor: "var(--brand)" }} />
                  <div className="text-[11px] text-muted-foreground tnum">{e.time}</div>
                  <div className="mt-0.5 text-[13px] font-semibold">{e.action} <span className="font-normal text-muted-foreground">· {e.actor} ({e.role})</span></div>
                  <div className="text-[12px] text-muted-foreground">{e.detail}</div>
                </li>
              ))}
            </ol>
          </CardContent></Card>
        </TabsContent>

        {/* 账户状态 */}
        <TabsContent value="status" className="mt-4">
          <Card className="mb-4"><CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <div className="text-[11.5px] text-muted-foreground">当前账户状态</div>
              <div className="mt-1.5 flex items-center gap-2"><Pill tone={accountStatus.tone}>{accountStatus.current}</Pill><span className="text-[12px] text-muted-foreground">自 {accountStatus.since}</span></div>
            </div>
            <div className="text-right">
              <div className="text-[11.5px] text-muted-foreground">当前限额</div>
              <div className="mt-1 text-[15px] font-bold tnum">{accountStatus.limit}</div>
            </div>
            <Button variant="outline" onClick={() => nav("/unfreeze")}><Link2 className="h-4 w-4" />前往解冻处置</Button>
          </CardContent></Card>
          <div className="mb-2 text-[12.5px] font-bold text-muted-foreground">状态 / 冻结历史</div>
          <Card><CardContent className="py-5">
            <ol className="relative ml-2 border-l pl-6">
              {freezeHistory.map((e, i) => (
                <li key={i} className="relative pb-5 last:pb-0">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 bg-card" style={{ borderColor: `var(--${e.tone === "green" ? "success" : e.tone === "amber" ? "warning" : "danger"})` }} />
                  <div className="text-[11px] text-muted-foreground tnum">{e.time}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[13px] font-semibold"><Pill tone={e.tone}>{e.action}</Pill><span className="font-normal text-muted-foreground">· {e.by}</span></div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{e.detail}</div>
                </li>
              ))}
            </ol>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </Shell>
  );
}
