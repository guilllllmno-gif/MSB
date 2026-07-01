// 团伙研判「批量列名单」收口:把团伙成员按所选对象/类型/有效期真实写入名单管理(listStore),
// 每条回链本团伙(source="团伙" · srcId · to=/ring?id=)。镜像 caseIntake 的闭环模式。
import { listStore } from "./store";
import type { ListEntry, ListCat, EntryType } from "./lists";
import type { Person } from "./data";

const TODAY = "2026-07-01"; // 原型世界日期(与 mkCase 固定日期口径一致)

const catOf = (listtype: string): ListCat => (listtype.includes("黑名单") ? "block" : "watch");
const expiryOf = (duration: string): string => (!duration || duration === "永久" ? "长期有效" : duration);
const entryTypeOf = (kind: string): EntryType => (kind === "商户" ? "商户" : kind === "群组" ? "个人" : "链上地址");

export interface RingMemberLite { name: string; kind: "商户" | "地址" | "群组"; role: string }

// 「列入对象」多选 → 命中哪些成员
function pickTargets(members: RingMemberLite[], entities: string[]): RingMemberLite[] {
  if (entities.some((e) => e.includes("全部"))) return members;
  const want = (kw: string) => entities.some((e) => e.includes(kw));
  const hit = members.filter((m) =>
    (m.kind === "商户" && want("商户")) ||
    (m.kind === "群组" && want("群组")) ||
    (m.kind === "地址" && (want("地址") || want("对手"))));
  return hit.length ? hit : members; // 兜底:未匹配到则列入全部成员
}

export interface IntakeListOpts {
  ringId: string; ringName: string; typology: string; members: RingMemberLite[];
  listtype: string; entities: string[]; duration: string; reason: string; operator: Person;
}

export function intakeList(o: IntakeListOpts): { ids: string[]; count: number } {
  const cat = catOf(o.listtype);
  const risk = cat === "block" ? "确认洗钱" : "团伙关联嫌疑";
  const expiry = expiryOf(o.duration);
  const base = listStore.created().length; // 快照,避免本次新增内 id 冲突
  const ids: string[] = [];
  pickTargets(o.members, o.entities).forEach((m, i) => {
    const id = `LE-2026-2${String(base + i).padStart(3, "0")}`;
    const entry: ListEntry = {
      id, value: m.name, entryType: entryTypeOf(m.kind), cat, risk,
      source: "团伙", srcId: o.ringId, to: `/ring?id=${o.ringId}`,
      addedBy: o.operator, addedAt: TODAY,
      reason: o.reason.trim() || `团伙研判「${o.ringName}」(${o.typology})列入${o.listtype} · 成员角色 ${m.role}。`,
      hits30: 0, scope: "全业务线", expiry, status: "active",
    };
    listStore.add(entry);
    ids.push(id);
  });
  return { ids, count: ids.length };
}
