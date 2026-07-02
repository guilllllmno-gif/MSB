import { useSyncExternalStore } from "react";
import type { Person } from "./data";
import type { Ring } from "./rings";
import type { Rule, RuleVersion } from "./rules";
import type { Report } from "./reports";
import type { ListEntry } from "./lists";
import type { Case, CaseSubject } from "./cases";
import { KYT_POLICY } from "./onchain";

interface Override { state?: string; assignee?: Person | null; events: { t: string; text: string; reason: string }[] }

const data: Record<string, Override> = {};
let version = 0;
const listeners = new Set<() => void>();
const notify = () => { version++; listeners.forEach((l) => l()); };
const now = () => { const d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); };

export const alertStore = {
  subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
  getVersion() { return version; },
  stateOf(id: string, base: string) { return data[id]?.state || base; },
  assigneeOf(id: string, base: Person | null) { const o = data[id]; return o && o.assignee !== undefined ? o.assignee : base; },
  eventsOf(id: string) { return data[id]?.events || []; },
  allEvents() { return Object.entries(data).flatMap(([id, v]) => (v.events || []).map((e) => ({ id, ...e }))); },
  set(id: string, state: string, opts: { assignee?: Person | null; event?: string; reason?: string }) {
    const cur = data[id] || { events: [] };
    cur.state = state;
    if (opts.assignee !== undefined) cur.assignee = opts.assignee;
    cur.events = [...(cur.events || []), { t: now(), text: opts.event || state, reason: opts.reason || "" }];
    data[id] = cur;
    notify();
  },
};

export function useAlertVersion() {
  return useSyncExternalStore(alertStore.subscribe, alertStore.getVersion, alertStore.getVersion);
}

// ── ring (团伙) state store ──
const ringData: Record<string, { state?: string; owner?: Person | null; caseRef?: string; events?: { t: string; text: string }[] }> = {};
let ringCreated: Ring[] = [];
let ringVersion = 0;
const ringListeners = new Set<() => void>();
const ringNotify = () => { ringVersion++; ringListeners.forEach((l) => l()); };

export const ringStore = {
  subscribe(cb: () => void) { ringListeners.add(cb); return () => { ringListeners.delete(cb); }; },
  getVersion() { return ringVersion; },
  created() { return ringCreated; },
  stateOf(id: string, base: string) { return ringData[id]?.state || base; },
  ownerOf(id: string, base: Person | null | undefined) { const o = ringData[id]; return o && o.owner !== undefined ? o.owner : base ?? null; },
  caseRefOf(id: string, base?: string) { return ringData[id]?.caseRef ?? base; },
  eventsOf(id: string) { return ringData[id]?.events || []; },
  allEvents() { return Object.entries(ringData).flatMap(([id, v]) => (v.events || []).map((e) => ({ id, ...e }))); },
  set(id: string, state: string, owner?: Person | null, event?: string, caseRef?: string) {
    const cur = ringData[id] || {};
    cur.state = state;
    if (owner !== undefined) cur.owner = owner;
    if (caseRef !== undefined) cur.caseRef = caseRef;
    if (event) cur.events = [...(cur.events || []), { t: now(), text: event }];
    ringData[id] = cur;
    ringNotify();
  },
  addRing(r: Ring) { ringCreated = [r, ...ringCreated]; ringNotify(); },
};

export function useRingVersion() {
  return useSyncExternalStore(ringStore.subscribe, ringStore.getVersion, ringStore.getVersion);
}

// ── 事后监控命中(finding)状态store ──
const findingData: Record<string, { status?: string; owner?: Person | null; trace?: string; backfill?: boolean; frozen?: boolean; lossReported?: boolean; restricted?: boolean; listed?: boolean; events?: { t: string; text: string }[] }> = {};
let findingVersion = 0;
const findingListeners = new Set<() => void>();
const findingNotify = () => { findingVersion++; findingListeners.forEach((l) => l()); };

export const findingStore = {
  subscribe(cb: () => void) { findingListeners.add(cb); return () => { findingListeners.delete(cb); }; },
  getVersion() { return findingVersion; },
  statusOf(id: string, base: string) { return findingData[id]?.status || base; },
  ownerOf(id: string, base: Person | null) { const o = findingData[id]; return o && o.owner !== undefined ? o.owner : base; },
  traceOf(id: string, base?: string) { const o = findingData[id]; return o && o.trace !== undefined ? o.trace : base; },
  backfillOf(id: string, base?: boolean) { const o = findingData[id]; return o && o.backfill !== undefined ? o.backfill : base; },
  frozenOf(id: string) { return !!findingData[id]?.frozen; },
  lossOf(id: string) { return !!findingData[id]?.lossReported; },
  restrictedOf(id: string) { return !!findingData[id]?.restricted; },
  listedOf(id: string) { return !!findingData[id]?.listed; },
  eventsOf(id: string) { return findingData[id]?.events || []; },
  allEvents() { return Object.entries(findingData).flatMap(([id, v]) => (v.events || []).map((e) => ({ id, ...e }))); },
  set(id: string, opts: { status?: string; owner?: Person | null; trace?: string; backfill?: boolean; frozen?: boolean; lossReported?: boolean; restricted?: boolean; listed?: boolean; event?: string }) {
    const cur = findingData[id] || {};
    if (opts.status !== undefined) cur.status = opts.status;
    if (opts.owner !== undefined) cur.owner = opts.owner;
    if (opts.trace !== undefined) cur.trace = opts.trace;
    if (opts.backfill !== undefined) cur.backfill = opts.backfill;
    if (opts.frozen !== undefined) cur.frozen = opts.frozen;
    if (opts.lossReported !== undefined) cur.lossReported = opts.lossReported;
    if (opts.restricted !== undefined) cur.restricted = opts.restricted;
    if (opts.listed !== undefined) cur.listed = opts.listed;
    if (opts.event) cur.events = [...(cur.events || []), { t: now(), text: opts.event }];
    findingData[id] = cur;
    findingNotify();
  },
};

export function useFindingVersion() {
  return useSyncExternalStore(findingStore.subscribe, findingStore.getVersion, findingStore.getVersion);
}

// ── 报告报送(FINTRAC)状态store ──
const reportData: Record<string, { status?: string; mlro?: Person | null; ref?: string; events?: { t: string; text: string; reason: string }[] }> = {};
let reportCreated: Report[] = [];
let reportVersion = 0;
const reportListeners = new Set<() => void>();
const reportNotify = () => { reportVersion++; reportListeners.forEach((l) => l()); };

export const reportStore = {
  subscribe(cb: () => void) { reportListeners.add(cb); return () => { reportListeners.delete(cb); }; },
  getVersion() { return reportVersion; },
  created() { return reportCreated; },
  add(r: Report) { reportCreated = [r, ...reportCreated]; reportNotify(); },
  statusOf(id: string, base: string) { return reportData[id]?.status || base; },
  mlroOf(id: string, base: Person | null) { const o = reportData[id]; return o && o.mlro !== undefined ? o.mlro : base; },
  refOf(id: string, base?: string) { const o = reportData[id]; return o && o.ref !== undefined ? o.ref : base; },
  eventsOf(id: string) { return reportData[id]?.events || []; },
  allEvents() { return Object.entries(reportData).flatMap(([id, v]) => (v.events || []).map((e) => ({ id, ...e }))); },
  set(id: string, status: string, opts: { mlro?: Person | null; ref?: string; event?: string; reason?: string } = {}) {
    const cur = reportData[id] || {};
    cur.status = status;
    if (opts.mlro !== undefined) cur.mlro = opts.mlro;
    if (opts.ref !== undefined) cur.ref = opts.ref;
    cur.events = [...(cur.events || []), { t: now(), text: opts.event || status, reason: opts.reason || "" }];
    reportData[id] = cur;
    reportNotify();
  },
};

export function useReportVersion() {
  return useSyncExternalStore(reportStore.subscribe, reportStore.getVersion, reportStore.getVersion);
}

// ── 监控规则状态store(变更治理:回测 → 审批 → 上线 / 停用)──
const ruleData: Record<string, { state?: string; owner?: Person | null; events?: { t: string; text: string; reason: string }[] }> = {};
const ruleEdits: Record<string, Partial<Rule>> = {};
const ruleHistory: Record<string, RuleVersion[]> = {};
// 变更治理:改「已上线」规则不直接动线上,先落一份「拟议变更」(完整字段快照),原版照常生效,待风控总管审批
export interface PendingChange { fields: Partial<Rule>; by: Person; at: string; summary: string }
const rulePending: Record<string, PendingChange> = {};
const ruleRemoved = new Set<string>();
let ruleCreated: Rule[] = [];
let ruleVersion = 0;
const ruleListeners = new Set<() => void>();
const ruleNotify = () => { ruleVersion++; ruleListeners.forEach((l) => l()); };

export const ruleStore = {
  subscribe(cb: () => void) { ruleListeners.add(cb); return () => { ruleListeners.delete(cb); }; },
  getVersion() { return ruleVersion; },
  created() { return ruleCreated; },
  stateOf(id: string, base: string) { return ruleData[id]?.state || base; },
  ownerOf(id: string, base: Person | null) { const o = ruleData[id]; return o && o.owner !== undefined ? o.owner : base; },
  eventsOf(id: string) { return ruleData[id]?.events || []; },
  allEvents() { return Object.entries(ruleData).flatMap(([id, v]) => (v.events || []).map((e) => ({ id, ...e }))); },
  editsOf(id: string) { return ruleEdits[id]; },
  isRemoved(id: string) { return ruleRemoved.has(id); },
  // 版本历史:首次查看时用种子谱系懒初始化(不触发通知);回滚 / 变更追加新版本(最新在前,自动编号 + 时间戳)
  ensureVersions(id: string, seed: RuleVersion[]) { if (!ruleHistory[id]) ruleHistory[id] = seed; return ruleHistory[id]; },
  recordVersion(id: string, e: { by: Person; summary: string; fields: { cond?: string; weight?: string; action?: string } }) {
    const nextV = (ruleHistory[id]?.[0]?.v ?? 0) + 1;
    ruleHistory[id] = [{ v: nextV, date: "今天 " + now(), by: e.by, summary: e.summary, fields: e.fields }, ...(ruleHistory[id] || [])];
    ruleNotify();
  },
  add(r: Rule) { ruleCreated = [r, ...ruleCreated]; ruleNotify(); },
  update(id: string, patch: Partial<Rule>) { ruleEdits[id] = { ...(ruleEdits[id] || {}), ...patch }; ruleNotify(); },
  remove(id: string) { ruleRemoved.add(id); ruleNotify(); },
  // ── 变更治理:拟议 → 审批 / 退回 ──
  pendingOf(id: string) { return rulePending[id]; },
  allPending() { return Object.entries(rulePending).map(([id, c]) => ({ id, ...c })); },
  // 编辑已上线规则 → 落拟议变更(不动线上),记一条「待审批」事件
  proposeChange(id: string, fields: Partial<Rule>, by: Person, summary: string) {
    rulePending[id] = { fields, by, at: "今天 " + now(), summary };
    const cur = ruleData[id] || {};
    cur.events = [...(cur.events || []), { t: now(), text: "提交拟议变更 · 待风控总管审批", reason: summary }];
    ruleData[id] = cur;
    ruleNotify();
  },
  // 总管批准:把拟议字段套到线上(ruleEdits)+ 记一个新版本 + 事件,清空 pending
  approveChange(id: string, by: Person) {
    const p = rulePending[id];
    if (!p) return;
    ruleEdits[id] = { ...(ruleEdits[id] || {}), ...p.fields };
    const nextV = (ruleHistory[id]?.[0]?.v ?? 0) + 1;
    ruleHistory[id] = [{ v: nextV, date: "今天 " + now(), by, summary: "变更上线 · " + p.summary, fields: { cond: p.fields.cond, weight: p.fields.weight, action: p.fields.action } }, ...(ruleHistory[id] || [])];
    const cur = ruleData[id] || {};
    cur.events = [...(cur.events || []), { t: now(), text: `审批通过 · 变更上线(v${nextV})`, reason: p.summary }];
    ruleData[id] = cur;
    delete rulePending[id];
    ruleNotify();
  },
  // 总管退回:不动线上,记退回事件,清空 pending(理由必填)
  rejectChange(id: string, by: Person, reason: string) {
    if (!rulePending[id]) return;
    const cur = ruleData[id] || {};
    cur.events = [...(cur.events || []), { t: now(), text: `退回拟议变更 · ${by.n}`, reason }];
    ruleData[id] = cur;
    delete rulePending[id];
    ruleNotify();
  },
  set(id: string, state: string, opts: { owner?: Person | null; event?: string; reason?: string } = {}) {
    const cur = ruleData[id] || {};
    cur.state = state;
    if (opts.owner !== undefined) cur.owner = opts.owner;
    cur.events = [...(cur.events || []), { t: now(), text: opts.event || state, reason: opts.reason || "" }];
    ruleData[id] = cur;
    ruleNotify();
  },
};

export function useRuleVersion() {
  return useSyncExternalStore(ruleStore.subscribe, ruleStore.getVersion, ruleStore.getVersion);
}

// ── 名单管理状态store(筛查名单生命周期:待复核 → 生效 → 暂停 / 过期 / 移除)──
const listData: Record<string, { status?: string; owner?: Person | null; events?: { t: string; text: string; reason: string }[] }> = {};
let listCreated: ListEntry[] = [];
let listVersion = 0;
const listListeners = new Set<() => void>();
const listNotify = () => { listVersion++; listListeners.forEach((l) => l()); };

export const listStore = {
  subscribe(cb: () => void) { listListeners.add(cb); return () => { listListeners.delete(cb); }; },
  getVersion() { return listVersion; },
  created() { return listCreated; },
  statusOf(id: string, base: string) { return listData[id]?.status || base; },
  ownerOf(id: string, base: Person | null) { const o = listData[id]; return o && o.owner !== undefined ? o.owner : base; },
  eventsOf(id: string) { return listData[id]?.events || []; },
  allEvents() { return Object.entries(listData).flatMap(([id, v]) => (v.events || []).map((e) => ({ id, ...e }))); },
  add(e: ListEntry) { listCreated = [e, ...listCreated]; listNotify(); },
  set(id: string, status: string, opts: { owner?: Person | null; event?: string; reason?: string } = {}) {
    const cur = listData[id] || {};
    cur.status = status;
    if (opts.owner !== undefined) cur.owner = opts.owner;
    cur.events = [...(cur.events || []), { t: now(), text: opts.event || status, reason: opts.reason || "" }];
    listData[id] = cur;
    listNotify();
  },
};

export function useListVersion() {
  return useSyncExternalStore(listStore.subscribe, listStore.getVersion, listStore.getVersion);
}

// ── 案件管理状态store ──
const caseData: Record<string, { state?: string; owner?: Person | null; events?: { t: string; text: string; reason: string }[] }> = {};
const caseExtraSubjects: Record<string, CaseSubject[]> = {};
let caseCreated: Case[] = [];
let caseVersion = 0;
const caseListeners = new Set<() => void>();
const caseNotify = () => { caseVersion++; caseListeners.forEach((l) => l()); };

export const caseStore = {
  subscribe(cb: () => void) { caseListeners.add(cb); return () => { caseListeners.delete(cb); }; },
  getVersion() { return caseVersion; },
  created() { return caseCreated; },
  stateOf(id: string, base: string) { return caseData[id]?.state || base; },
  ownerOf(id: string, base: Person | null) { const o = caseData[id]; return o && o.owner !== undefined ? o.owner : base; },
  eventsOf(id: string) { return caseData[id]?.events || []; },
  allEvents() { return Object.entries(caseData).flatMap(([id, v]) => (v.events || []).map((e) => ({ id, ...e }))); },
  subjectsOf(id: string, base: CaseSubject[]) { return [...base, ...(caseExtraSubjects[id] || [])]; },
  addSubject(id: string, subj: CaseSubject) { caseExtraSubjects[id] = [...(caseExtraSubjects[id] || []), subj]; caseNotify(); },
  add(c: Case) { caseCreated = [c, ...caseCreated]; caseNotify(); },
  set(id: string, state: string, opts: { owner?: Person | null; event?: string; reason?: string } = {}) {
    const cur = caseData[id] || {};
    cur.state = state;
    if (opts.owner !== undefined) cur.owner = opts.owner;
    cur.events = [...(cur.events || []), { t: now(), text: opts.event || state, reason: opts.reason || "" }];
    caseData[id] = cur;
    caseNotify();
  },
};

export function useCaseVersion() {
  return useSyncExternalStore(caseStore.subscribe, caseStore.getVersion, caseStore.getVersion);
}

// ── 商户业务模式标签:模型自动识别 → 人工确认。确认态存内存(刷新重置),按归一化键存,跨名字写法一致 ──
import { entityKeys } from "./entity360";
let tagVersion = 0;
const tagListeners = new Set<() => void>();
const tagNotify = () => { tagVersion++; tagListeners.forEach((l) => l()); };
const tagConfirmed: Record<string, string[]> = {};
const tagDismissed: Record<string, string[]> = {};
const tagKey = (name: string) => entityKeys(name)[0] || name;
export const tagStore = {
  subscribe(cb: () => void) { tagListeners.add(cb); return () => { tagListeners.delete(cb); }; },
  getVersion() { return tagVersion; },
  confirmedOf(name: string) { return tagConfirmed[tagKey(name)] || []; },
  dismissedOf(name: string) { return tagDismissed[tagKey(name)] || []; },
  confirm(name: string, tag: string) { const k = tagKey(name); tagConfirmed[k] = [...new Set([...(tagConfirmed[k] || []), tag])]; tagDismissed[k] = (tagDismissed[k] || []).filter((t) => t !== tag); tagNotify(); },
  remove(name: string, tag: string) { const k = tagKey(name); tagConfirmed[k] = (tagConfirmed[k] || []).filter((t) => t !== tag); tagNotify(); },
  dismiss(name: string, tag: string) { const k = tagKey(name); tagDismissed[k] = [...new Set([...(tagDismissed[k] || []), tag])]; tagNotify(); },
};
export function useTagVersion() {
  return useSyncExternalStore(tagStore.subscribe, tagStore.getVersion, tagStore.getVersion);
}

// ── 演示态全局操作员身份 —— 一线分析师 James Liu ↔ 风控总管(兼MLRO)Emma Zhang ──
// 顶栏(铃铛通知集 / 操作员菜单)与仪表盘视角共享同一身份,切换即全站联动。内存态,刷新重置。
export type Role = "analyst" | "head";
export const PERSONS: Record<Role, Person> = {
  analyst: { i: "JL", n: "James Liu", c: "var(--brand)" },
  head: { i: "EZ", n: "Emma Zhang", c: "var(--violet)" },
};
export const ROLE_META: Record<Role, { role: string; tier: string; chip: string }> = {
  analyst: { role: "一线分析师", tier: "风控 L1", chip: "风控 · L1" },
  head: { role: "风控总管 · 兼 MLRO", tier: "风控负责人", chip: "风控 · 总管" },
};
let roleVal: Role = "analyst";
let roleVersion = 0;
const roleListeners = new Set<() => void>();
export const roleStore = {
  subscribe(cb: () => void) { roleListeners.add(cb); return () => { roleListeners.delete(cb); }; },
  getVersion() { return roleVersion; },
  get() { return roleVal; },
  person() { return PERSONS[roleVal]; },
  set(r: Role) { if (r === roleVal) return; roleVal = r; roleVersion++; roleListeners.forEach((l) => l()); },
};
export function useRoleVersion() {
  useSyncExternalStore(roleStore.subscribe, roleStore.getVersion, roleStore.getVersion);
  return roleVal;
}

// ── 链上风险策略(KYT)· 风控总管可调,内存态,刷新重置 ──────────────────────────
// 阈值把「供应商信号」映射成「本系统处置」;调这里,链上情报页 / 抽屉 / 团伙成员评分全站实时联动。
export type KytPolicy = typeof KYT_POLICY;
let kytPolicy: KytPolicy = { ...KYT_POLICY };
let kytVersion = 0;
const kytListeners = new Set<() => void>();
export const kytPolicyStore = {
  subscribe(cb: () => void) { kytListeners.add(cb); return () => { kytListeners.delete(cb); }; },
  getVersion() { return kytVersion; },
  current() { return kytPolicy; },
  set(patch: Partial<KytPolicy>) { kytPolicy = { ...kytPolicy, ...patch }; kytVersion++; kytListeners.forEach((l) => l()); },
  reset() { kytPolicy = { ...KYT_POLICY }; kytVersion++; kytListeners.forEach((l) => l()); },
  isDefault() { return (Object.keys(KYT_POLICY) as (keyof KytPolicy)[]).every((k) => kytPolicy[k] === KYT_POLICY[k]); },
};
export function useKytVersion() {
  useSyncExternalStore(kytPolicyStore.subscribe, kytPolicyStore.getVersion, kytPolicyStore.getVersion);
  return kytPolicy;
}
