// 主体360 · 跨模块聚合。把同一主体(商户 / 链上地址)在 事中·事后·告警·团伙·案件·报送 的全部足迹
// 按归一化键聚到一起 —— 解决「同主体跨模块」却名字写法不一(NovaPay Technologies Ltd. vs NovaPay Technologies)的对齐问题。
// 纯派生(只读静态数据 + 不依赖 store);页面用各 store 的 version hook 叠加实时状态。
import { alerts, type Alert, type Tone } from "./data";
import { FINDINGS, type Finding } from "./findings";
import { rings, type Ring, type RingMember } from "./rings";
import { CASES, type Case, strLabel, type CState } from "./cases";
import { REPORTS, type Report } from "./reports";
import { LISTS } from "./lists";

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
// 同键取最完整(最长)的名字作展示名。每个商户进一步派生 风险分 / 状态 / 商户号 /
// 30日交易额 / 注册地 / 最近事件,组成「商户风险总览」。少量干净 / 白名单 / 观察商户
// 由种子补入(DIR_SEED),让总览覆盖完整风险谱(不只问题主体)。
export interface DirStatus { key: string; label: string; tone: Tone }
export interface RiskFactor { label: string; tone: Tone }
// 待办 = 当前需要分析师做的「动作」(并进「处置进展」列作紧急角标,不再单列)
export interface Pending { label: string; tone: Tone; urgent: boolean; kind: "claim" | "sla" }
export interface DirEntry {
  key: string; name: string; type: EntityType;
  merchantNo: string; country: string;
  alerts: number; findings: number; rings: number; cases: number; reports: number; str: number;
  span: number; total: number;
  risk: number; vol30: string;
  lastEvent: { label: string; date: string };
  // —— 两轴状态 ——
  acct: DirStatus;         // 账户状态:被采取了什么约束(动作的结果)—— 正常/受限/冻结/观察/白名单,来自名单库
  flow: DirStatus;         // 处置进展:工作流走到哪一阶段 —— 待研判/调查中/待报送/已结
  pending: Pending | null; // 处置进展上的紧急待办(待认领 / SLA临期),作 flow 的角标
  // —— 分诊增强 ——
  factors: RiskFactor[];   // 风险驱动因素(解释 risk 为何这么高)
  trend: number;           // 风险趋势:相对 30 天前的变化(+ 恶化 / − 缓和)
  ringMates: number;       // 同团伙里的其它商户数(>0 → 可并案信号)
  need: number;            // 需关注度排序分 = 风险 + 待办紧迫 + 趋势
}

// FNV-1a → 稳定数字种子(刷新不变);用于合成商户号 / 日期 / 交易额
function hashNum(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function synthMerchantNo(key: string): string { const tail = String(hashNum(key) % 100000).padStart(5, "0"); return "178905678900000" + tail; }
function synthDate(key: string): string { const h = hashNum(key + "d"); const mm = 2 + (h % 3); const dd = 1 + ((h >>> 4) % 28); return `${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`; }
function synthVol(key: string): string { const h = hashNum(key + "v"); const v = (3 + (h % 280)) + (h % 10) / 10; return `CAD ${v.toFixed(1)}K`; }

// 账户状态(动作驱动)—— 来自名单库 lists.ts 的真实约束动作,而非从「有没有告警」反推。
//   制裁名单 → 冻结(法定硬拦截);内部黑名单 → 受限(确认欺诈/洗钱,拦截);
//   关注名单 → 观察(升级监控、不拦);白名单 → 白名单(已核验豁免);其余 → 正常。
// 只认 status==="active" 的生效名单项,按商户名归一化匹配(故只命中「商户」类名单项)。
const ACCT_LABEL: Record<string, string> = { frozen: "冻结", restricted: "受限", watch: "观察", white: "白名单", normal: "正常" };
const ACCT_TONE: Record<string, Tone> = { frozen: "red", restricted: "red", watch: "blue", white: "green", normal: "green" };
const acctOf = (key: string): DirStatus => ({ key, label: ACCT_LABEL[key], tone: ACCT_TONE[key] });
const CAT_RANK: Record<string, number> = { sanctions: 4, block: 3, watch: 2, allow: 1 };
const CAT_ACCT: Record<string, string> = { sanctions: "frozen", block: "restricted", watch: "watch", allow: "white" };
function accountState(name: string): string {
  let best = ""; let rank = 0;
  for (const le of LISTS) {
    if (le.status !== "active") continue;
    if (!sameEntity(le.value, name)) continue;
    if ((CAT_RANK[le.cat] || 0) > rank) { rank = CAT_RANK[le.cat]; best = CAT_ACCT[le.cat]; }
  }
  return best || "normal";
}

const FLOW_LABEL: Record<string, string> = { triage: "待研判", case: "调查中", report: "待报送", done: "已结" };
const FLOW_TONE: Record<string, Tone> = { triage: "amber", case: "amber", report: "red", done: "grey" };
const flowOf = (key: string): DirStatus => ({ key, label: FLOW_LABEL[key], tone: FLOW_TONE[key] });

// 干净 / 白名单 / 观察商户种子 —— 仅当其键未被记录派生命中时补入,凑齐风险总览的低风险段
interface Seed { name: string; country: string; risk: number; acctKey: string; vol30: string; lastEvent: [string, string]; alerts?: number }
const DIR_SEED: Seed[] = [
  { name: "SwiftX Ltd", country: "美国", risk: 38, acctKey: "normal", vol30: "CAD 18.5K", lastEvent: ["误报关闭", "02-28"], alerts: 3 },
  { name: "Maple Store Inc.", country: "加拿大", risk: 14, acctKey: "normal", vol30: "CAD 142K", lastEvent: ["误报关闭", "04-12"], alerts: 2 },
  { name: "Kraken-U Exchange", country: "加拿大", risk: 9, acctKey: "white", vol30: "CAD 320K", lastEvent: ["—", ""] },
  { name: "Harbor Pay Co.", country: "新加坡", risk: 24, acctKey: "watch", vol30: "CAD 64K", lastEvent: ["名单观察", "03-02"], alerts: 1 },
  { name: "Lumen Capital", country: "英国", risk: 17, acctKey: "normal", vol30: "CAD 88K", lastEvent: ["—", ""] },
  { name: "Vertex Pay", country: "加拿大", risk: 11, acctKey: "white", vol30: "CAD 51K", lastEvent: ["—", ""] },
  { name: "Cedar Remit", country: "加拿大", risk: 29, acctKey: "watch", vol30: "CAD 33K", lastEvent: ["名单观察", "03-09"] },
];

interface Acc {
  names: string[]; alerts: number; findings: number; rings: number; cases: number; reports: number;
  maxScore: number; sanction: boolean; ring: boolean; caseActive: boolean; reportOpen: boolean;
  unclaimedCase: boolean; caseSlaUrgent: boolean; ringMates: number;
  vol30?: string; country?: string; lastLabel?: string;
}

export function directory(): DirEntry[] {
  const map = new Map<string, Acc>();
  const get = (name: string): Acc[] => entityKeys(name)
    .filter((k) => !(k.startsWith("#") || /ring-/.test(k)))
    .map((k) => { let e = map.get(k); if (!e) { e = { names: [], alerts: 0, findings: 0, rings: 0, cases: 0, reports: 0, maxScore: 0, sanction: false, ring: false, caseActive: false, reportOpen: false, unclaimedCase: false, caseSlaUrgent: false, ringMates: 0 }; map.set(k, e); } e.names.push(name); return e; });

  alerts.forEach((a) => get(a.merchant).forEach((e) => {
    e.alerts++; e.maxScore = Math.max(e.maxScore, a.score);
    if (a.sanctions?.status?.includes("命中")) e.sanction = true;
    if (!e.vol30 && a.custHistory?.vol30) e.vol30 = a.custHistory.vol30;
    if (!e.country) e.country = a.country;
    if (!e.lastLabel) e.lastLabel = a.score >= 80 ? "事中拦截" : "告警研判";
  }));
  FINDINGS.forEach((f) => get(f.subject).forEach((e) => { e.findings++; if (!e.lastLabel) e.lastLabel = "事后命中"; }));
  rings.forEach((r) => {
    const mates = r.members.filter((m) => m.kind !== "群组" && entityType(m.name) === "商户").length; // 同团伙里的其它商户数(并案信号)
    r.members.filter((m) => m.kind !== "群组").forEach((m) => get(m.name).forEach((e) => { e.rings++; e.ring = true; e.ringMates = Math.max(e.ringMates, mates - 1); }));
  });
  CASES.forEach((c) => {
    const active = CASE_ACTIVE.has(c.state);
    const touch = (n: string) => get(n).forEach((e) => {
      e.cases++;
      if (active) { e.caseActive = true; if (!c.owner) e.unclaimedCase = true; if (c.sla?.tone === "red" || c.sla?.tone === "amber") e.caseSlaUrgent = true; }
      if (/制裁/.test(c.risk + c.type)) e.sanction = true;
      e.lastLabel = active ? "立案调查" : e.lastLabel;
    });
    touch(c.subject);
    // 子主体只纳入「商户」—— 链上地址 / 个人 / UBO(如制裁混币器 Tornado Cash)是商户名下属性或外部实体,不另作主体行
    (c.subjects || []).forEach((s) => { if (s.type === "商户") touch(s.name); });
  });
  REPORTS.forEach((r) => get(r.subject).forEach((e) => { e.reports++; if (!["filed", "ack", "void"].includes(r.status)) e.reportOpen = true; if (!e.lastLabel) e.lastLabel = "STR 报送"; }));

  const out: DirEntry[] = [];
  for (const [key, e] of map.entries()) {
    // 展示名 = 最长的「商户写法」变体 —— 跳过带地址的报告写法(如「OffshoreFX Ltd. · 0x7F4a…9c21」会被误判为链上地址)
    const merchantForm = e.names.filter((n) => entityType(n) === "商户");
    if (!merchantForm.length) continue; // 该键从无商户写法 → 不是商户主体(纯地址 / 团伙)
    const name = merchantForm.reduce((a, b) => (b.length > a.length ? b : a));
    const str = e.reports + Math.min(e.cases, e.caseActive ? e.cases : 0);
    let risk = e.maxScore;
    if (e.sanction) risk = Math.max(risk, 88);
    if (e.caseActive) risk = Math.max(risk, 82);
    if (e.ring) risk = Math.max(risk, 72);
    if (!risk && e.findings) risk = 56;
    if (!risk) risk = 12 + (hashNum(key) % 18);
    risk = Math.min(99, risk);
    // 账户状态(动作驱动)—— 名单库真实约束;确认制裁敞口(命中制裁名单 / 制裁溯源案件)→ 冻结,
    // 覆盖过期的白名单豁免(一个有在办制裁案件的商户,不该因旧白名单条目显示「白名单」)
    const acctKey = e.sanction ? "frozen" : accountState(name);
    // 处置进展(工作流)—— 在哪一阶段;待报送 > 调查中 > 待研判 > 已结
    const flowKey = e.reportOpen ? "report" : e.caseActive ? "case" : e.alerts && !e.caseActive && risk >= 60 ? "triage" : "done";
    // 处置进展上的紧急待办(作 flow 角标):待认领 / SLA临期
    const pending: Pending | null =
      e.unclaimedCase ? { label: "待认领", tone: "violet", urgent: true, kind: "claim" }
        : e.caseSlaUrgent ? { label: "SLA临期", tone: "amber", urgent: true, kind: "sla" }
        : null;
    // 风险驱动因素 —— 解释「为何这个分」,复用全站加权贡献语言
    const factors: RiskFactor[] = [];
    if (e.sanction) factors.push({ label: "制裁名单关联", tone: "red" });
    if (e.caseActive) factors.push({ label: `${e.cases} 个在办案件`, tone: "violet" });
    if (e.ring) factors.push({ label: `关联团伙${e.ringMates > 0 ? ` · 同伙 ${e.ringMates} 主体` : ""}`, tone: "amber" });
    if (e.maxScore >= 80) factors.push({ label: `高分告警 ${e.maxScore}`, tone: "red" });
    else if (e.maxScore >= 60) factors.push({ label: `告警最高分 ${e.maxScore}`, tone: "amber" });
    if (e.findings) factors.push({ label: `${e.findings} 项事后命中`, tone: "amber" });
    if (e.reportOpen) factors.push({ label: "STR 报送在途", tone: "red" });
    if (!factors.length) factors.push({ label: e.alerts ? `告警 ${e.alerts} 笔 · 均未升级` : "无显著风险信号", tone: "green" });
    // 趋势:相对 30 天前的风险变化(确定性合成;低风险主体波动小)
    const raw = (hashNum(key + "t") % 27) - 11;
    const trend = risk < 40 ? Math.round(raw / 3) : raw;
    const need = risk + (pending?.urgent ? 24 : 0) + (flowKey === "report" ? 14 : flowKey === "case" ? 8 : flowKey === "triage" ? 5 : 0) + Math.max(0, trend) * 0.7;
    out.push({
      key, name, type: "商户", merchantNo: synthMerchantNo(key), country: e.country || "—",
      alerts: e.alerts, findings: e.findings, rings: e.rings, cases: e.cases, reports: e.reports, str,
      span: [e.alerts, e.findings, e.rings, e.cases, e.reports].filter((n) => n > 0).length,
      total: e.alerts + e.findings + e.rings + e.cases + e.reports,
      risk, vol30: e.vol30 || synthVol(key),
      lastEvent: { label: e.lastLabel || "—", date: e.lastLabel ? synthDate(key) : "" },
      acct: acctOf(acctKey), flow: flowOf(flowKey), pending,
      factors, trend, ringMates: e.ringMates, need,
    });
  }
  // 补入干净 / 白名单 / 观察商户种子(键未命中时)
  for (const s of DIR_SEED) {
    const k = entityKeys(s.name)[0] || s.name.toLowerCase();
    if (map.has(k)) continue;
    const trend = Math.round(((hashNum(k + "t") % 13) - 7) / 2); // 干净主体波动小
    out.push({
      key: k, name: s.name, type: "商户", merchantNo: synthMerchantNo(k), country: s.country,
      alerts: s.alerts || 0, findings: 0, rings: 0, cases: 0, reports: 0, str: 0,
      span: s.alerts ? 1 : 0, total: s.alerts || 0,
      risk: s.risk, vol30: s.vol30,
      lastEvent: { label: s.lastEvent[0], date: s.lastEvent[1] },
      acct: acctOf(s.acctKey), flow: flowOf(s.alerts && s.risk >= 60 ? "triage" : "done"),
      pending: null,
      factors: [{ label: s.acctKey === "white" ? "已核验 · 白名单豁免" : s.alerts ? `告警 ${s.alerts} 笔 · 均误报` : "无显著风险信号", tone: "green" }],
      trend, ringMates: 0, need: s.risk + Math.max(0, trend) * 0.7,
    });
  }
  // 默认按「需关注度」降序 —— 不是纯风险排名,而是把 待办紧迫 / 正在恶化 的主体顶上来(分诊,而非排行)
  return out.sort((a, b) => b.need - a.need || b.risk - a.risk);
}

// 案件「在办」状态集(派生风险分 / 状态用,与 cases.ts 的 active 口径一致)
const CASE_ACTIVE = new Set<string>(["investigating", "str_draft", "mlro", "queued", "filed"]);
