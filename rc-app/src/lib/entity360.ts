// 主体360 · 跨模块聚合。把同一主体(商户 / 链上地址)在 事中·事后·告警·团伙·案件·报送 的全部足迹
// 按归一化键聚到一起 —— 解决「同主体跨模块」却名字写法不一(NovaPay Technologies Ltd. vs NovaPay Technologies)的对齐问题。
// 纯派生(只读静态数据 + 不依赖 store);页面用各 store 的 version hook 叠加实时状态。
import { alerts, type Alert } from "./data";
import { FINDINGS, type Finding } from "./findings";
import { rings, type Ring, type RingMember } from "./rings";
import { CASES, type Case, strLabel, type CState } from "./cases";
import { REPORTS, type Report } from "./reports";

// --- 归一化键 ---------------------------------------------------------------
// 一个名字可能含多个可匹配的「身份」(如报告主体「OffshoreFX Ltd. · 0x7F4a…9c21」= 商户 + 地址),
// 故返回键数组;两个名字只要任一键重合即视为同一主体。
const NOISE = new Set(["ltd", "inc", "corp", "co", "llc", "plc", "limited", "technologies", "exchange", "systems", "group", "holdings", "company"]);

export function entityKeys(name: string): string[] {
  if (!name) return [];
  const keys = new Set<string>();
  for (const raw of name.split(/[·(（、]/)) {
    const part = raw.trim();
    if (!part) continue;
    const s = part.toLowerCase();
    // 链上地址(0x… 或 base58 截断,带省略号)
    const addr = s.match(/0x[0-9a-f]{2,6}…[0-9a-f]{2,6}/i)?.[0] || s.match(/[a-z0-9]{3,6}…[a-z0-9]{2,6}/)?.[0];
    if (addr) { keys.add(addr.replace(/\s+/g, "")); continue; }
    // 团伙编号
    const ring = s.match(/ring-\d{4}-\d{3}/i)?.[0];
    if (ring) { keys.add(ring); continue; }
    // 设备 / 群组编号(#A7 等)保持原样作弱键
    const grp = s.match(/#[a-z0-9]{1,4}/i)?.[0];
    if (grp) { keys.add(grp); continue; }
    // 商户:去标点 + 去公司后缀噪声词,取核心 1-2 词
    const tokens = s.replace(/[.,]/g, " ").split(/\s+/).filter((t) => t && !NOISE.has(t));
    if (tokens.length) keys.add(tokens.slice(0, 2).join(" "));
  }
  return [...keys];
}

export const sameEntity = (a: string, b: string): boolean => {
  const kb = new Set(entityKeys(b));
  return entityKeys(a).some((k) => kb.has(k));
};

// --- 类型判定 ---------------------------------------------------------------
export type EntityType = "商户" | "链上地址" | "团伙" | "个人";
export function entityType(name: string): EntityType {
  if (/ring-\d{4}-\d{3}/i.test(name) || name.includes("团伙")) return "团伙";
  if (/0x|…|地址/.test(name)) return "链上地址";
  return "商户";
}
export const ENTITY_TONE: Record<EntityType, "blue" | "violet" | "amber" | "grey"> = { 商户: "blue", 链上地址: "violet", 团伙: "amber", 个人: "grey" };

// --- 跨模块足迹 -------------------------------------------------------------
export interface RingHit { ring: Ring; member: RingMember }
export interface Footprint {
  alerts: Alert[];
  findings: Finding[];
  rings: RingHit[];
  cases: Case[];
  reports: Report[];
}

export function footprint(name: string): Footprint {
  return {
    alerts: alerts.filter((a) => sameEntity(a.merchant, name)),
    findings: FINDINGS.filter((f) => sameEntity(f.subject, name)),
    rings: rings.flatMap((r) => {
      const m = r.members.find((mm) => sameEntity(mm.name, name));
      return m ? [{ ring: r, member: m }] : [];
    }),
    cases: CASES.filter((c) => sameEntity(c.subject, name) || (c.subjects || []).some((s) => sameEntity(s.name, name))),
    reports: REPORTS.filter((r) => sameEntity(r.subject, name)),
  };
}

// --- 商户 → 关联链上地址(从交易对手反推)----------------------------------
// footprint 按归一化键匹配,商户键≠地址键,故商户自己的钱包/对手地址不会直接命中。
// 但每条告警都带 sender/receiver,商户侧标「商户托管」—— 从中抽出该商户交易里出现的地址,
// 区分「商户托管钱包」(本方持有)与「交易对手地址」(入金来源/出金去向),可点进地址 360。
const ADDR_RE = /(0x[0-9a-fA-F]{2,8}…[0-9a-fA-F]{2,8}|bc1[a-z0-9]{1,8}…[a-z0-9]{1,8}|[A-Za-z0-9]{2,8}…[A-Za-z0-9]{2,8})/;
export interface LinkedAddr { addr: string; role: "商户托管" | "交易对手"; dir: string; alertId: string; alertTitle: string }
export function linkedAddresses(name: string): LinkedAddr[] {
  const out = new Map<string, LinkedAddr>();
  for (const a of alerts.filter((x) => sameEntity(x.merchant, name))) {
    for (const [field, val] of [["sender", a.sender], ["receiver", a.receiver]] as const) {
      const m = val.match(ADDR_RE);
      if (!m) continue;
      const custody = val.includes("商户托管");
      const addr = m[1];
      if (!out.has(addr)) out.set(addr, {
        addr, role: custody ? "商户托管" : "交易对手",
        dir: custody ? "本方持有钱包" : field === "sender" ? "入金来源" : "出金去向",
        alertId: a.id, alertTitle: a.title,
      });
    }
  }
  // 托管钱包排前
  return [...out.values()].sort((x, y) => (x.role === "商户托管" ? -1 : 1) - (y.role === "商户托管" ? -1 : 1));
}

// 涉及金额合计(粗略:解析各记录金额字符串求和,只为给一个量级感)
export const parseAmt = (s?: string): number => (s ? Number(s.replace(/[^0-9.]/g, "")) || 0 : 0);
export function totalExposure(fp: Footprint): number {
  return (
    fp.alerts.reduce((n, a) => n + parseAmt(a.amount), 0) +
    fp.findings.reduce((n, f) => n + parseAmt(f.amount), 0) +
    fp.cases.reduce((n, c) => n + parseAmt(c.amount), 0)
  );
}
export const fmtCAD = (n: number) => "CAD " + n.toLocaleString("en-CA", { maximumFractionDigits: 0 });

// 案件 → STR 关联进展(借用 cases.strLabel)
export const caseStr = (s: CState) => strLabel(s);

// --- 主体目录(动态派生,非手工维护)----------------------------------------
// 扫描 告警 / 事后 / 团伙成员 / 案件主体 的全部名字,按归一化键聚合;
// 同键取最完整(最长)的名字作展示名;按「模块覆盖广度」降序 → 总命中降序。
export interface DirEntry {
  key: string; name: string; type: EntityType;
  alerts: number; findings: number; rings: number; cases: number; reports: number;
  span: number; total: number;
}

export function directory(): DirEntry[] {
  const map = new Map<string, { names: string[]; rec: DirEntry }>();
  const touch = (name: string, mod: keyof Pick<DirEntry, "alerts" | "findings" | "rings" | "cases" | "reports">) => {
    for (const k of entityKeys(name)) {
      if (k.startsWith("#") || /ring-/.test(k)) continue; // 跳过设备群组 / 团伙号本身作为主体
      let e = map.get(k);
      if (!e) { e = { names: [], rec: { key: k, name, type: entityType(name), alerts: 0, findings: 0, rings: 0, cases: 0, reports: 0, span: 0, total: 0 } }; map.set(k, e); }
      e.names.push(name);
      e.rec[mod]++;
    }
  };
  alerts.forEach((a) => touch(a.merchant, "alerts"));
  FINDINGS.forEach((f) => touch(f.subject, "findings"));
  rings.forEach((r) => r.members.filter((m) => m.kind !== "群组").forEach((m) => touch(m.name, "rings")));
  CASES.forEach((c) => { touch(c.subject, "cases"); (c.subjects || []).forEach((s) => touch(s.name, "cases")); });
  REPORTS.forEach((r) => touch(r.subject, "reports"));

  const out: DirEntry[] = [];
  for (const { names, rec } of map.values()) {
    // 展示名 = 最长的那个写法(信息最全)
    rec.name = names.reduce((a, b) => (b.length > a.length ? b : a));
    rec.type = entityType(rec.name);
    rec.span = [rec.alerts, rec.findings, rec.rings, rec.cases, rec.reports].filter((n) => n > 0).length;
    rec.total = rec.alerts + rec.findings + rec.rings + rec.cases + rec.reports;
    out.push(rec);
  }
  return out.sort((a, b) => b.span - a.span || b.total - a.total);
}
