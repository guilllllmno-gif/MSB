import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { UploadCloud, FileText, Eye, Download, Link2, ShieldCheck, ArrowLeft, Paperclip } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, SectionLabel, Mono } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { evidence as seed, chainOfCustody, type Evidence, type Tone } from "@/lib/data";

const KINDS: { key: string; label: string; tone: Tone }[] = [
  { key: "all", label: "全部", tone: "grey" },
  { key: "链上分析", label: "链上分析", tone: "blue" },
  { key: "商户材料", label: "商户材料", tone: "violet" },
  { key: "制裁筛查", label: "制裁筛查", tone: "red" },
  { key: "截图", label: "截图", tone: "grey" },
  { key: "内部备忘", label: "内部备忘", tone: "amber" },
];

export default function CaseEvidence() {
  const [items, setItems] = useState<Evidence[]>(seed);
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState<Evidence | null>(null);

  const shown = filter === "all" ? items : items.filter((e) => e.kind === filter);
  const linkedCount = items.filter((e) => e.linkedStr).length;

  const toggleStr = (id: string) => {
    setItems((xs) => xs.map((e) => (e.id === id ? { ...e, linkedStr: !e.linkedStr } : e)));
    toast.success("已更新 STR 关联");
  };

  return (
    <Shell crumb={["风控", "治理与合规", "案件证据"]}>
      <Link to="/merchant" className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回商户 360</Link>
      <PageHead
        title="案件证据柜 · CASE-2026-0312"
        sub="集中管理调查证据:链上分析、商户材料、制裁筛查、截图与研判备忘。每份证据带来源与监管链(chain-of-custody),可关联进 STR 报送。"
        actions={<><Pill tone="violet">STR 草稿中</Pill><Pill tone="red">混币器关联 · 制裁溯源</Pill></>}
      />

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.7fr_1fr]">
        {/* left: upload + evidence list */}
        <div className="flex flex-col gap-[18px]">
          {/* dropzone */}
          <button
            onClick={() => toast.success("已上传 1 个文件 · 待归档")}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-7 text-center transition-colors hover:bg-secondary/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><UploadCloud className="h-5 w-5" /></span>
            <span className="text-[13.5px] font-semibold">拖拽文件到此,或点击上传证据</span>
            <span className="text-[11.5px] text-muted-foreground">支持 PDF / PNG / CSV · 单文件 ≤ 25MB · 上传即写入监管链</span>
          </button>

          {/* filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            {KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => setFilter(k.key)}
                className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors ${filter === k.key ? "text-white" : "bg-card text-muted-foreground hover:bg-secondary"}`}
                style={filter === k.key ? { background: "var(--brand)", borderColor: "var(--brand)" } : undefined}
              >
                {k.label}
              </button>
            ))}
          </div>

          {/* evidence table */}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>证据</TableHead><TableHead>类别</TableHead><TableHead>上传人</TableHead><TableHead>STR</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>
                {shown.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold" style={{ maxWidth: 240 }}>{e.name}</div>
                          <div className="text-[11px] text-muted-foreground"><Mono>{e.id}</Mono> · {e.size} · {e.time} · {e.reason}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Pill tone={e.tone} dot={false}>{e.kind}</Pill></TableCell>
                    <TableCell className="text-[12.5px]">{e.uploader}<span className="ml-1 text-muted-foreground">({e.role})</span></TableCell>
                    <TableCell>{e.linkedStr ? <Pill tone="violet" dot={false}>已关联</Pill> : <span className="text-[12px] text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreview(e)}><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toast.success("开始下载 " + e.id)}><Download className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleStr(e.id)}><Link2 className="h-4 w-4" style={e.linkedStr ? { color: "var(--violet)" } : undefined} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>

        {/* right: STR linkage + chain of custody */}
        <div className="flex flex-col gap-[18px]">
          <Card>
            <CardHeader><CardTitle className="text-[15px]">STR 关联材料</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: "var(--violet-bg)" }}>
                <Paperclip className="h-5 w-5" style={{ color: "var(--violet)" }} />
                <div className="text-[12.5px]"><b>{linkedCount}</b> / {items.length} 份证据已关联进 STR 草稿</div>
              </div>
              <p className="mt-3 text-[11.5px] text-muted-foreground">移交 MLRO 前,建议将链上溯源、制裁筛查与对手地址情报全部关联,以支撑「可疑理由」叙述。</p>
              <Button className="mt-3 w-full" style={{ background: "var(--brand)" }} onClick={() => toast.success("已将选中证据打包进 STR 草稿")}>打包进 STR 草稿</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-[15px]"><ShieldCheck className="h-4 w-4" style={{ color: "var(--success)" }} />监管链 · Chain of Custody</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative ml-2 border-l pl-6">
                {chainOfCustody.map((c, i) => (
                  <li key={i} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 bg-card" style={{ borderColor: "var(--success)" }} />
                    <div className="text-[11px] text-muted-foreground tnum">{c.time}</div>
                    <div className="mt-0.5 text-[12.5px]"><b>{c.actor}</b> · {c.text}</div>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-muted-foreground">每次上传 / 关联 / 下载均不可篡改留痕,满足 FINTRAC 证据可追溯要求。</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* preview dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />{preview?.name}</DialogTitle>
            <DialogDescription><Mono>{preview?.id}</Mono> · {preview?.kind} · {preview?.size} · 上传人 {preview?.uploader}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-secondary/40 p-4 text-[13px] leading-relaxed">{preview?.note}</div>
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>上传时间 {preview?.time} · 原因 {preview?.reason}</span>
            {preview?.linkedStr ? <Pill tone="violet" dot={false}>已关联 STR</Pill> : <span>未关联 STR</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => toast.success("开始下载 " + preview?.id)}><Download className="h-4 w-4" />下载</Button>
            <Button className="flex-1" style={{ background: "var(--brand)" }} onClick={() => { if (preview) toggleStr(preview.id); setPreview(null); }}><Link2 className="h-4 w-4" />{preview?.linkedStr ? "取消关联" : "关联 STR"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
