// 建案收口:同一主体已有在办案件 → 并入(加涉案主体 + 记事件),否则新建。
// 避免同一商户被多个告警/命中各开一个案件、重复起草 STR(案件 = 单一调查容器)。
import { caseStore } from "./store";
import { CASES, mkCase, type CaseSubject, type Priority } from "./cases";

const ACTIVE = ["investigating", "str_draft", "mlro", "queued", "filed"];
const sameSubject = (a: string, b: string) => a === b || a.includes(b) || b.includes(a);

export interface IntakeOpts {
  subject: string; sub: string; type: string; risk: string; amount: string; src: string;
  linkIds: string; linkTo?: string; priority?: Priority; subjects?: CaseSubject[];
  addSubject?: CaseSubject; // 并入既有案件时追加的涉案主体
}

export function intakeCase(o: IntakeOpts): { id: string; attached: boolean } {
  const existing = [...caseStore.created(), ...CASES]
    .find((c) => ACTIVE.includes(caseStore.stateOf(c.id, c.state)) && sameSubject(c.subject, o.subject));
  if (existing) {
    if (o.addSubject) caseStore.addSubject(existing.id, o.addSubject);
    caseStore.set(existing.id, caseStore.stateOf(existing.id, existing.state), { event: `并入关联线索 ${o.linkIds}（${o.src}）` });
    return { id: existing.id, attached: true };
  }
  const nc = mkCase(caseStore.created().length + 1, o);
  caseStore.add(nc);
  return { id: nc.id, attached: false };
}
