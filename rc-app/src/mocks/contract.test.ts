import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { z } from "zod";
import { handlers, __resetMockState } from "./handlers";
import { Subject, SubjectDetail, MergeCandidate } from "@/schemas/subject";
import { Ring, RingDetail } from "@/schemas/ring";
import { SUBJECTS, buildSubjectDetail } from "./fixtures/subjects";
import { RINGS, buildRingDetail } from "./fixtures/rings";
import { CANDIDATES } from "./fixtures/candidates";

// ── Phase 1 门禁核心:所有 fixtures + 派生详情 通过 Zod schema ──
describe("fixtures 通过 Zod schema", () => {
  it("SUBJECTS(≥12)全部合法", () => { expect(SUBJECTS.length).toBeGreaterThanOrEqual(12); SUBJECTS.forEach((s) => Subject.parse(s)); });
  it("RINGS(≥8)全部合法", () => { expect(RINGS.length).toBeGreaterThanOrEqual(8); RINGS.forEach((r) => Ring.parse(r)); });
  it("CANDIDATES(≥5)合法且 confidence ∈ [50,74]", () => {
    expect(CANDIDATES.length).toBeGreaterThanOrEqual(5);
    CANDIDATES.forEach((c) => { MergeCandidate.parse(c); expect(c.confidence).toBeGreaterThanOrEqual(50); expect(c.confidence).toBeLessThanOrEqual(74); });
  });
  it("ID 全局唯一(§7.1)", () => {
    const sids = SUBJECTS.map((s) => s.id); expect(new Set(sids).size).toBe(sids.length);
    const rids = RINGS.map((r) => r.id); expect(new Set(rids).size).toBe(rids.length);
  });
  it("buildSubjectDetail 全部通过 SubjectDetail", () => SUBJECTS.forEach((s) => SubjectDetail.parse(buildSubjectDetail(s, CANDIDATES))));
  it("buildRingDetail 全部通过 RingDetail", () => RINGS.forEach((r) => RingDetail.parse(buildRingDetail(r))));
  it("成员=真实主体(§7.2):有关联主体的团伙 members 来自 SUBJECTS", () => {
    const d = buildRingDetail(RINGS.find((r) => r.id === "RING-0001")!);
    expect(d.members.length).toBe(2);
    expect(d.members.map((m) => m.subjectId).sort()).toEqual(["SUBJ-0001", "SUBJ-0002"]);
  });
});

// ── handler 集成:真实过滤/分页/搜索,非写死返回(§5)──
const server = setupServer(...handlers);
const BASE = "http://localhost";
const getJson = async <T,>(path: string, schema: z.ZodType<T>): Promise<T> => schema.parse(await (await fetch(BASE + path)).json());
const SubjList = z.object({ items: z.array(Subject), total: z.number() });
const RingList = z.object({ items: z.array(Ring), total: z.number() });

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); __resetMockState(); });
afterAll(() => server.close());

describe("MSW /api 真实过滤 / 分页 / 搜索", () => {
  it("subjects:risk 过滤", async () => {
    expect((await getJson("/api/subjects", SubjList)).total).toBe(12);
    const high = await getJson("/api/subjects?risk=high", SubjList);
    expect(high.items.every((s) => s.riskLevel === "high")).toBe(true);
    expect(high.total).toBeLessThan(12);
  });
  it("subjects:q 搜索", async () => {
    const r = await getJson("/api/subjects?q=novapay", SubjList);
    expect(r.items.map((s) => s.id)).toEqual(["SUBJ-0001"]);
  });
  it("subjects:分页(每页 10)", async () => {
    expect((await getJson("/api/subjects?page=1", SubjList)).items.length).toBe(10);
    expect((await getJson("/api/subjects?page=2", SubjList)).items.length).toBe(2);
  });
  it("merge-candidates:默认只返回复核区间", async () => {
    const cs = await getJson("/api/merge-candidates", z.array(MergeCandidate));
    expect(cs.length).toBe(CANDIDATES.length);
    expect(cs.every((c) => c.confidence >= 50 && c.confidence <= 74)).toBe(true);
  });
  it("rings:status 过滤 + 详情可取", async () => {
    const pending = await getJson("/api/rings?status=pending", RingList);
    expect(pending.items.every((r) => r.status === "pending")).toBe(true);
    expect((await getJson("/api/rings/RING-0001", RingDetail)).id).toBe("RING-0001");
  });
});

describe("认领状态机(§7.6)", () => {
  it("pending 可认领 → investigating + assignee", async () => {
    expect((await fetch(BASE + "/api/rings/RING-0003/claim", { method: "POST" })).status).toBe(200);
    const d = await getJson("/api/rings/RING-0003", RingDetail);
    expect(d.status).toBe("investigating");
    expect(d.assignee).not.toBeNull();
  });
  it("已 closed 不可认领 → 409", async () => {
    expect((await fetch(BASE + "/api/rings/RING-0008/claim", { method: "POST" })).status).toBe(409);
  });
});

describe("归并 / 拆分 mock 真实改状态(§5)", () => {
  it("merge:消费候选 + 钱包数 +1", async () => {
    const before = await getJson("/api/subjects/SUBJ-0001", SubjectDetail);
    await fetch(BASE + "/api/subjects/SUBJ-0001/merge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: "0x91Ad…77F2", reason: "复核同提现地址,人工归属" }) });
    const after = await getJson("/api/subjects/SUBJ-0001", SubjectDetail);
    expect(after.walletCount).toBe(before.walletCount + 1);
    expect(after.pendingCandidates.length).toBe(before.pendingCandidates.length - 1);
  });
  it("split:返回 recalcTriggered + auditId", async () => {
    const j = await (await fetch(BASE + "/api/subjects/SUBJ-0001/split", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: "0x0a1b…2c3d", reason: "误归属,拆出" }) })).json();
    expect(j.recalcTriggered).toBe(true);
    expect(j.auditId).toMatch(/^AUD-/);
  });
  it("reject:候选移除", async () => {
    const j = await (await fetch(BASE + "/api/merge-candidates/CAND-0005/reject", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "弱信号,不足以归并" }) })).json();
    expect(j.ok).toBe(true);
    const cs = await getJson("/api/merge-candidates", z.array(MergeCandidate));
    expect(cs.find((c) => c.id === "CAND-0005")).toBeUndefined();
  });
});
