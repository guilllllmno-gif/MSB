import { describe, it, expect } from "vitest";
import { decide, SCORING_RULES, THRESHOLDS, LVCTR_LIMIT, type Txn, type DataHealth } from "./decision";

// 干净低风险基线交易:不命中任何规则、不在任何名单、KYB 完成 → 应放行(score 0)。
// 每条用例只改与被测规则相关的字段,避免串扰。
const base = (over: Partial<Txn> = {}): Txn => ({
  id: "T-BASE", merchant: "CleanCo Ltd.", direction: "deposit", amount: 100,
  kybComplete: true, kyw: 5, ...over,
});
const OK: DataHealth = { sanctionsSource: "ok", scoring: "ok", chainTrace: "ok" };
const hit = (t: Txn, id: string) => decide(t, OK).reasons.some((r) => r.rule === id && r.code === "RULE_HIT");

describe("基线交易", () => {
  it("干净交易放行,score 0", () => {
    const d = decide(base(), OK);
    expect(d.action).toBe("allow");
    expect(d.score).toBe(0);
    expect(d.band).toBe("pass");
  });
});

// ── item 1:每条已上线规则的 命中 / 不命中 / 边界 ──
describe("R-AMT-001 大额充值监控 (deposit ≥ CAD 5,000, +60)", () => {
  it("命中:充值 6,000", () => expect(hit(base({ direction: "deposit", amount: 6_000 }), "R-AMT-001")).toBe(true));
  it("不命中:充值 4,999", () => expect(hit(base({ direction: "deposit", amount: 4_999 }), "R-AMT-001")).toBe(false));
  it("边界:恰好 5,000 命中(≥)", () => expect(hit(base({ direction: "deposit", amount: 5_000 }), "R-AMT-001")).toBe(true));
  it("不命中:同额但方向为提现", () => expect(hit(base({ direction: "withdraw", amount: 6_000 }), "R-AMT-001")).toBe(false));
});

describe("R-AMT-002 大额提现监控 (withdraw ≥ CAD 3,000, +55)", () => {
  it("命中:提现 3,500", () => expect(hit(base({ direction: "withdraw", amount: 3_500 }), "R-AMT-002")).toBe(true));
  it("不命中:提现 2,999", () => expect(hit(base({ direction: "withdraw", amount: 2_999 }), "R-AMT-002")).toBe(false));
  it("边界:恰好 3,000 命中(≥)", () => expect(hit(base({ direction: "withdraw", amount: 3_000 }), "R-AMT-002")).toBe(true));
});

describe("R-CHN-001 混币器关联 (mixerHops ≤ 2, +35, 冻结)", () => {
  it("命中:2 跳触及混币器 → 冻结", () => {
    const d = decide(base({ mixerHops: 2 }), OK);
    expect(hit(base({ mixerHops: 2 }), "R-CHN-001")).toBe(true);
    expect(d.action).toBe("freeze");
  });
  it("不命中:3 跳", () => expect(hit(base({ mixerHops: 3 }), "R-CHN-001")).toBe(false));
  it("边界:恰好 2 跳命中 / 未溯源(undefined)不命中", () => {
    expect(hit(base({ mixerHops: 2 }), "R-CHN-001")).toBe(true);
    expect(hit(base({ mixerHops: undefined }), "R-CHN-001")).toBe(false);
  });
});

describe("R-SCR-001 KYW 评分超阈值 (kyw > 70, +50)", () => {
  it("命中:KYW 88", () => expect(hit(base({ kyw: 88 }), "R-SCR-001")).toBe(true));
  it("不命中:KYW 70(严格 >)", () => expect(hit(base({ kyw: 70 }), "R-SCR-001")).toBe(false));
  it("边界:71 命中 / 70 不命中", () => {
    expect(hit(base({ kyw: 71 }), "R-SCR-001")).toBe(true);
    expect(hit(base({ kyw: 70 }), "R-SCR-001")).toBe(false);
  });
});

describe("R-BHV-001 高频拆分入金 (24h ≥5 笔且金额相近, +30)", () => {
  it("命中:6 笔且金额相近", () => expect(hit(base({ window: { count24h: 6, similarAmountRun: true } }), "R-BHV-001")).toBe(true));
  it("不命中:5 笔但金额不相近", () => expect(hit(base({ window: { count24h: 5, similarAmountRun: false } }), "R-BHV-001")).toBe(false));
  it("边界:恰好 5 笔且相近命中 / 4 笔不命中", () => {
    expect(hit(base({ window: { count24h: 5, similarAmountRun: true } }), "R-BHV-001")).toBe(true);
    expect(hit(base({ window: { count24h: 4, similarAmountRun: true } }), "R-BHV-001")).toBe(false);
  });
});

describe("R-BHV-002 快进快出钱包 (入金后 1h 转出 > 80%, +28)", () => {
  it("命中:0.95", () => expect(hit(base({ window: { outflowRatio1h: 0.95 } }), "R-BHV-002")).toBe(true));
  it("不命中:0.80(严格 >)", () => expect(hit(base({ window: { outflowRatio1h: 0.8 } }), "R-BHV-002")).toBe(false));
  it("边界:0.81 命中 / 0.80 不命中", () => {
    expect(hit(base({ window: { outflowRatio1h: 0.81 } }), "R-BHV-002")).toBe(true);
    expect(hit(base({ window: { outflowRatio1h: 0.8 } }), "R-BHV-002")).toBe(false);
  });
});

describe("R-BHV-003 新商户首充 (首笔 且 KYB 未完成, +20)", () => {
  it("命中:首笔且 KYB 未完成", () => expect(hit(base({ firstTransaction: true, kybComplete: false }), "R-BHV-003")).toBe(true));
  it("不命中:首笔但 KYB 已完成", () => expect(hit(base({ firstTransaction: true, kybComplete: true }), "R-BHV-003")).toBe(false));
  it("不命中:非首笔", () => expect(hit(base({ firstTransaction: false, kybComplete: false }), "R-BHV-003")).toBe(false));
});

describe("R-CHN-002 高风险地址检测 (发送方含风险标签, +25)", () => {
  it("命中:含风险标签", () => expect(hit(base({ addressTags: ["mixer-adjacent"] }), "R-CHN-002")).toBe(true));
  it("不命中:无标签", () => expect(hit(base({ addressTags: [] }), "R-CHN-002")).toBe(false));
  it("边界:1 个标签命中 / undefined 不命中", () => {
    expect(hit(base({ addressTags: ["x"] }), "R-CHN-002")).toBe(true);
    expect(hit(base({ addressTags: undefined }), "R-CHN-002")).toBe(false);
  });
});

// ── 基线矩阵分档 ──
describe("决策基线矩阵 (拦截 80 / 研判 60 / 留痕 40)", () => {
  it("score ≥ 80 → 拦截 + 强制人工", () => {
    // 充值 6000(+60) + KYW 88(+50) = 110 → 封顶 100 → block
    const d = decide(base({ direction: "deposit", amount: 6_000, kyw: 88 }), OK);
    expect(d.score).toBe(100);
    expect(d.action).toBe("block");
    expect(d.manualReview).toBe(true);
  });
  it("60–79 → 放行转研判", () => {
    const d = decide(base({ direction: "deposit", amount: 6_000 }), OK); // +60
    expect(d.band).toBe("review");
    expect(d.action).toBe("review");
  });
  it("40–59 → 放行 + 留痕", () => {
    const d = decide(base({ direction: "withdraw", amount: 3_500 }), OK); // +55
    expect(d.band).toBe("log");
    expect(d.action).toBe("allow");
  });
  it("< 40 → 放行", () => {
    const d = decide(base({ firstTransaction: true, kybComplete: false }), OK); // +20
    expect(d.band).toBe("pass");
    expect(d.action).toBe("allow");
  });
});

// ── item 3:绕过尝试(≥5)——确保都被拦下 ──
describe("绕过尝试 (bypass attempts)", () => {
  it("① 拆单规避 LVCTR:单笔 9,000(< 10k 不报 LVCTR)但 24h 6 笔相近 → 结构化拆分命中 → 拦截", () => {
    const d = decide(base({ direction: "deposit", amount: 9_000, window: { count24h: 6, similarAmountRun: true } }), OK);
    // +60 (大额) +30 (拆分) = 90 ≥ 80
    expect(d.action).toBe("block");
    expect(d.reports).not.toContain("LVCTR"); // 拆到 9k 确实没触发 LVCTR…
    expect(d.reasons.some((r) => r.rule === "R-BHV-001")).toBe(true); // …但被拆分规则逮住
  });
  it("② 边界试探:9,999.99 刚好压在 LVCTR 之下 → 不报 LVCTR,但 ≥5000 仍转研判(没逃掉监控)", () => {
    const d = decide(base({ direction: "deposit", amount: 9_999.99 }), OK);
    expect(d.reports).not.toContain("LVCTR");
    expect(d.action).toBe("review"); // +60 → 60–79
    const d2 = decide(base({ direction: "deposit", amount: LVCTR_LIMIT }), OK);
    expect(d2.reports).toContain("LVCTR"); // 恰好 10,000 触发
  });
  it("③ 字段异常:金额为负 / NaN → fail-safe 暂缓,不放行(不会因 <阈值 而被当作低风险)", () => {
    expect(decide(base({ amount: -5_000 }), OK).action).toBe("hold");
    expect(decide(base({ amount: NaN }), OK).action).toBe("hold");
    expect(decide(base({ amount: Infinity }), OK).action).toBe("hold");
  });
  it("④ 制裁名大小写 / 空格规避:'offshorefx ltd.  ' 仍命中制裁 → 冻结", () => {
    const d = decide(base({ merchant: "  offshorefx ltd.  " }), OK);
    expect(d.action).toBe("freeze");
    expect(d.reports).toContain("TPR");
    expect(d.reasons.some((r) => r.code === "SANCTIONS_HIT")).toBe(true);
  });
  it("⑤ 白名单滥用:白名单商户向制裁地址出金 → 白名单不豁免制裁 → 仍冻结", () => {
    const d = decide(base({ merchant: "NovaPay Technologies Ltd.", direction: "withdraw", amount: 4_000, receiver: "0x7F4a…9c21" }), OK);
    expect(d.action).toBe("freeze");
    expect(d.reasons.some((r) => r.code === "SANCTIONS_HIT")).toBe(true);
  });
  it("⑥ 白名单豁免范围验证:白名单商户高 KYW(评分类规则被豁免)但无制裁/黑 → 不因 R-SCR 拦截", () => {
    const d = decide(base({ merchant: "NovaPay Technologies Ltd.", kyw: 95 }), OK);
    expect(d.reasons.some((r) => r.rule === "R-SCR-001" && r.code === "RULE_HIT")).toBe(false);
    expect(d.reasons.some((r) => r.code === "ALLOWLIST_EXEMPT")).toBe(true);
  });
  it("⑦ pending 黑名单不生效:仅 active 名单参与筛查(0x9a1c…44Bd 为 pending)→ 不拦", () => {
    const d = decide(base({ receiver: "0x9a1c…44Bd" }), OK);
    expect(d.reasons.some((r) => r.code === "BLOCKLIST_HIT")).toBe(false);
  });
});

// ── item 4:数据源失败降级策略 ──
describe("数据源降级兜底 (fail-safe)", () => {
  it("制裁名单源不可达 → fail-closed:即便干净交易也暂缓、转人工、不放行", () => {
    const d = decide(base(), { sanctionsSource: "down", scoring: "ok", chainTrace: "ok" });
    expect(["hold", "block", "freeze"]).toContain(d.action);
    expect(d.action).not.toBe("allow");
    expect(d.manualReview).toBe(true);
    expect(d.degraded.join()).toContain("fail-closed");
  });
  it("评分服务超时 → 熔断保守:默认转研判;大额暂缓;R-SCR 跳过不当作未命中", () => {
    const small = decide(base({ kyw: 95, amount: 500 }), { sanctionsSource: "ok", scoring: "timeout", chainTrace: "ok" });
    expect(small.action).toBe("review");
    expect(small.reasons.some((r) => r.code === "DEGRADE_SCORING_SKIP")).toBe(true);
    const large = decide(base({ kyw: 95, amount: 12_000 }), { sanctionsSource: "ok", scoring: "down", chainTrace: "ok" });
    expect(large.action).toBe("hold");
  });
  it("链上溯源失败 → 依赖链上的规则转人工暂缓(不放行),记降级", () => {
    const d = decide(base({ mixerHops: 1, addressTags: ["x"] }), { sanctionsSource: "ok", scoring: "ok", chainTrace: "down" });
    expect(d.action).toBe("hold");
    expect(d.degraded.join()).toContain("链上溯源失败");
    expect(d.reasons.some((r) => r.code === "DEGRADE_CHAIN_SKIP")).toBe(true);
  });
  it("KYC/KYB 缺失 → 按最高风险档:不自动放行,至少转研判", () => {
    const d = decide(base({ kybComplete: undefined }), OK);
    expect(d.action).not.toBe("allow");
    expect(d.degraded.join()).toContain("KYC/KYB 缺失");
  });
});

// 完整性:确保每条已上线规则都被 hit 测试覆盖到
describe("覆盖完整性", () => {
  it("8 条已上线 gate 评分规则都有命中断言", () => {
    expect(SCORING_RULES.map((r) => r.id).sort()).toEqual(
      ["R-AMT-001", "R-AMT-002", "R-BHV-001", "R-BHV-002", "R-BHV-003", "R-CHN-001", "R-CHN-002", "R-SCR-001"].sort(),
    );
  });
  it("阈值常量与 strategy 默认基线一致", () => {
    expect(THRESHOLDS).toEqual({ block: 80, review: 60, log: 40 });
    expect(LVCTR_LIMIT).toBe(10_000);
  });
});
