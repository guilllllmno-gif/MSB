// MSW handlers —— 全部 /api 路由。列表分页/筛选/搜索基于 fixtures 真实实现(非写死返回)。
// 内存可变副本:merge/split/claim/reject 真实改状态,前端 invalidate 后能读到变化。
import { http, HttpResponse, delay } from "msw";
import { SUBJECTS, buildSubjectDetail } from "./fixtures/subjects";
import { RINGS, buildRingDetail } from "./fixtures/rings";
import { CANDIDATES } from "./fixtures/candidates";
import { MERGE, canClaim } from "@/lib/domain";
import type { Subject } from "@/schemas/subject";
import type { Ring } from "@/schemas/ring";

// 可变状态(模拟后端持久层)
let subjects: Subject[] = SUBJECTS.map((s) => ({ ...s }));
let candidates = CANDIDATES.map((c) => ({ ...c }));
const rings: Ring[] = RINGS.map((r) => ({ ...r }));

let auditSeq = 1000;
const nextAuditId = () => `AUD-${++auditSeq}`;

const lat = () => delay(200 + Math.floor(Math.random() * 300)); // 200–500ms
const page = <T,>(items: T[], pageNum: number, size = 10) => ({ items: items.slice((pageNum - 1) * size, pageNum * size), total: items.length });

export const handlers = [
  // ── 主体 ──
  http.get("*/api/subjects", async ({ request }) => {
    await lat();
    const u = new URL(request.url);
    const risk = u.searchParams.get("risk") ?? "";
    const kyc = u.searchParams.get("status") ?? "";
    const q = (u.searchParams.get("q") ?? "").toLowerCase();
    const pageNum = Number(u.searchParams.get("page") ?? "1") || 1;
    let rows = subjects;
    if (risk) rows = rows.filter((s) => s.riskLevel === risk);
    if (kyc) rows = rows.filter((s) => s.kycStatus === kyc);
    if (q) rows = rows.filter((s) => (s.name + s.id).toLowerCase().includes(q));
    return HttpResponse.json(page(rows, pageNum));
  }),

  http.get("*/api/subjects/:id", async ({ params }) => {
    await lat();
    const s = subjects.find((x) => x.id === params.id);
    if (!s) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(buildSubjectDetail(s, candidates));
  }),

  http.get("*/api/merge-candidates", async ({ request }) => {
    await lat();
    const u = new URL(request.url);
    const min = Number(u.searchParams.get("confidenceMin") ?? MERGE.reviewLow);
    const max = Number(u.searchParams.get("max") ?? MERGE.reviewHigh);
    return HttpResponse.json(candidates.filter((c) => c.confidence >= min && c.confidence <= max));
  }),

  http.post("*/api/subjects/:id/merge", async ({ params, request }) => {
    await lat();
    const body = (await request.json().catch(() => ({}))) as { accountId?: string };
    const s = subjects.find((x) => x.id === params.id);
    if (!s) return new HttpResponse(null, { status: 404 });
    // 归并:消费对应候选 + 主体账户数 +1
    candidates = candidates.filter((c) => !(c.targetSubjectId === params.id && c.accountId === body.accountId));
    subjects = subjects.map((x) => (x.id === params.id ? { ...x, accountCount: x.accountCount + 1 } : x));
    return HttpResponse.json({ ok: true, auditId: nextAuditId() });
  }),

  http.post("*/api/subjects/:id/split", async ({ params, request }) => {
    await lat();
    const body = (await request.json().catch(() => ({}))) as { accountId?: string };
    const s = subjects.find((x) => x.id === params.id);
    if (!s) return new HttpResponse(null, { status: 404 });
    subjects = subjects.map((x) => (x.id === params.id ? { ...x, accountCount: Math.max(1, x.accountCount - 1) } : x));
    void body;
    return HttpResponse.json({ ok: true, auditId: nextAuditId(), recalcTriggered: true });
  }),

  http.post("*/api/merge-candidates/:id/reject", async ({ params }) => {
    await lat();
    const before = candidates.length;
    candidates = candidates.filter((c) => c.id !== params.id);
    if (candidates.length === before) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({ ok: true });
  }),

  // ── 团伙 ──
  http.get("*/api/rings", async ({ request }) => {
    await lat();
    const u = new URL(request.url);
    const status = u.searchParams.get("status") ?? "";
    const q = (u.searchParams.get("q") ?? "").toLowerCase();
    const pageNum = Number(u.searchParams.get("page") ?? "1") || 1;
    let rows = rings;
    if (status) rows = rows.filter((r) => r.status === status);
    if (q) rows = rows.filter((r) => (r.name + r.id + r.method).toLowerCase().includes(q));
    return HttpResponse.json(page(rows, pageNum));
  }),

  http.get("*/api/rings/:id", async ({ params }) => {
    await lat();
    const r = rings.find((x) => x.id === params.id);
    if (!r) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(buildRingDetail(r));
  }),

  http.post("*/api/rings/:id/claim", async ({ params }) => {
    await lat();
    const r = rings.find((x) => x.id === params.id);
    if (!r) return new HttpResponse(null, { status: 404 });
    if (!canClaim(r.status, r.assignee)) return HttpResponse.json({ ok: false, error: "状态不可认领" }, { status: 409 });
    r.status = "investigating";
    r.assignee = { name: "James Liu", initials: "JL" };
    return HttpResponse.json({ ok: true });
  }),

  http.post("*/api/rings/:id/escalate", async ({ params }) => {
    await lat();
    const r = rings.find((x) => x.id === params.id);
    if (!r) return new HttpResponse(null, { status: 404 });
    r.status = "escalated";
    return HttpResponse.json({ ok: true });
  }),
];

// 测试用:重置内存状态(避免用例间串扰)
export function __resetMockState() {
  subjects = SUBJECTS.map((s) => ({ ...s }));
  candidates = CANDIDATES.map((c) => ({ ...c }));
  rings.splice(0, rings.length, ...RINGS.map((r) => ({ ...r })));
}
