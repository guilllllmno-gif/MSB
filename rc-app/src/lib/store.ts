import { useSyncExternalStore } from "react";
import type { Person } from "./data";
import type { Ring } from "./rings";
import type { Rule } from "./rules";
import type { Report } from "./reports";
import type { ListEntry } from "./lists";
import type { Case, CaseSubject } from "./cases";

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
  editsOf(id: string) { return ruleEdits[id]; },
  isRemoved(id: string) { return ruleRemoved.has(id); },
  add(r: Rule) { ruleCreated = [r, ...ruleCreated]; ruleNotify(); },
  update(id: string, patch: Partial<Rule>) { ruleEdits[id] = { ...(ruleEdits[id] || {}), ...patch }; ruleNotify(); },
  remove(id: string) { ruleRemoved.add(id); ruleNotify(); },
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
