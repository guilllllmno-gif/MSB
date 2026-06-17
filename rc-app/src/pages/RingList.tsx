import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Input, Tooltip } from "@heroui/react";
import { Search, Eye, FolderPlus, ShieldAlert, Network, Users2, Bell } from "lucide-react";
import { Shell, PageHead } from "@/components/Shell";
import { Pill, Initials } from "@/components/bits";
import { rings, DIM_META, DIM_ORDER, confTone, confLabel } from "@/lib/rings";

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Bell; tone?: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center gap-2 text-[12.5px] text-default-500"><Icon className="h-4 w-4 text-default-400" />{label}</div>
      <div className="mt-2 text-[24px] font-extrabold leading-none tnum" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}

// compact weighted-confidence bar
function ConfBar({ value }: { value: number }) {
  const tone = confTone(value);
  const col = tone === "red" ? "var(--danger)" : tone === "amber" ? "var(--warning)" : "var(--text-2)";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-default-100">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: col }} />
      </div>
      <span className="tnum text-[13px] font-bold" style={{ color: col }}>{value}%</span>
    </div>
  );
}

export default function RingList() {
  const nav = useNavigate();
  const highConf = rings.filter((r) => r.confidence >= 80).length;
  const subjects = rings.reduce((s, r) => s + r.members.length, 0);
  const alertSum = rings.reduce((s, r) => s + r.alertCount, 0);

  return (
    <Shell crumb={["风控", "检测策略", "团伙识别"]} wide>
      <PageHead
        title="关联团伙"
        sub="多维关系叠加 + 加权打分：地址 / 设备 / IP / 资金路径共享形成边，累积强度超阈值即聚类成团，并给出置信度。"
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <Stat label="识别团伙" value={String(rings.length)} icon={Network} />
        <Stat label="高置信团伙" value={String(highConf)} icon={ShieldAlert} tone="var(--danger)" />
        <Stat label="涉及主体" value={String(subjects)} icon={Users2} />
        <Stat label="关联告警" value={String(alertSum)} icon={Bell} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input size="sm" radius="full" placeholder="搜索团伙ID、手法或主体…"
          startContent={<Search className="h-4 w-4 text-default-400" />} className="max-w-[360px] flex-1"
          classNames={{ inputWrapper: "bg-default-100 shadow-none data-[hover=true]:bg-default-200 h-10" }} />
      </div>

      <Table aria-label="关联团伙" radius="lg"
        classNames={{ wrapper: "card no-scrollbar p-0 rounded-2xl overflow-x-auto", th: "bg-default-50 text-default-500 text-[12px] font-medium h-12 border-b border-divider whitespace-nowrap", td: "py-5 text-[13px] whitespace-nowrap", tr: "border-b border-default-100 last:border-0 transition-colors hover:bg-default-50 cursor-pointer" }}>
        <TableHeader>
          <TableColumn>团伙 / 名称</TableColumn><TableColumn>洗钱手法</TableColumn><TableColumn>置信度</TableColumn>
          <TableColumn>共享维度</TableColumn><TableColumn>成员</TableColumn><TableColumn>涉及金额</TableColumn>
          <TableColumn>关联告警</TableColumn><TableColumn>状态</TableColumn><TableColumn align="end">操作</TableColumn>
        </TableHeader>
        <TableBody>
          {rings.map((r) => (
            <TableRow key={r.id} onClick={() => nav(`/ring?id=${r.id}`)}>
              <TableCell><div className="font-semibold">{r.name}</div><div className="text-[11px] text-default-400">{r.id}</div></TableCell>
              <TableCell><Pill tone={r.risk} dot={false}>{r.typology}</Pill></TableCell>
              <TableCell><div className="flex items-center gap-2"><ConfBar value={r.confidence} /><span className="rounded-full bg-default-100 px-1.5 py-px text-[10.5px] font-semibold text-default-500">{confLabel(r.confidence)}</span></div></TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {DIM_ORDER.map((d) => { const on = r.shared.some((s) => s.dim === d); return (
                    <span key={d} className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold" style={on ? { background: "color-mix(in srgb," + DIM_META[d].color + " 14%, transparent)", color: DIM_META[d].color } : { background: "var(--default-100, #f0f1f3)", color: "var(--text-3)", opacity: 0.5 }}>{DIM_META[d].short}</span>
                  ); })}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  {r.members.slice(0, 4).map((m, i) => (
                    <span key={m.id} style={{ marginLeft: i ? -8 : 0, zIndex: 10 - i }} className="ring-2 ring-content1 rounded-full"><Initials p={{ i: m.i, c: m.c }} size={24} /></span>
                  ))}
                  <span className="ml-2 text-[12px] text-default-500">{r.members.length} 个主体</span>
                </div>
              </TableCell>
              <TableCell><span className="font-semibold tnum">{r.amount}</span></TableCell>
              <TableCell><span className="text-default-600 tnum">{r.alertCount} 条</span></TableCell>
              <TableCell><Pill tone={r.statusTone}>{r.status}</Pill></TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <Tooltip content="查看图谱" size="sm" delay={300}><Button isIconOnly size="sm" radius="full" variant="flat" className="bg-default-100" onPress={() => nav(`/ring?id=${r.id}`)}><Eye className="h-4 w-4 text-default-500" strokeWidth={1.9} /></Button></Tooltip>
                  <Tooltip content="并入案件" size="sm" delay={300}><Button isIconOnly size="sm" radius="full" variant="flat" className="bg-primary/10 text-primary" onPress={() => toast.success(`${r.id} 已并入调查案件`)}><FolderPlus className="h-4 w-4" strokeWidth={1.9} /></Button></Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Shell>
  );
}
