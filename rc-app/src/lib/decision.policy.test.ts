import { describe, it, expect } from "vitest";
import {
  decide, shadowCompare, SAMPLE_TXNS, CHAMPION_POLICY, THRESHOLDS,
  type Txn, type DataHealth, type Policy, type Action,
} from "./decision";

// 事中交易监控 · 策略参数化(Champion / Challenger 影子对比)单元测试。
// 与 decision.test.ts(规则/名单/降级)互补:这里只测「策略如何改变处置」以及
// 「哪些是法定项、策略动不了」。
const OK: DataHealth = { sanctionsSource: "ok", scoring: "ok", chainTrace: "ok" };
const base = (over: Partial<Txn> = {}): Txn => ({
  id: "T-BASE", merchant: "CleanCo Ltd.", direction: "deposit", amount: 100,
  kybComplete: true, kyw: 5, ...over,
});

// 三档策略(对标 strategy 预设:保守 / 标准=Champion / 宽松)
const CHAMPION = CHAMPION_POLICY;                                                        // 80 / 60 / 40
const LOOSE: Policy = { label: "loose", thresholds: { block: 90, review: 70, log: 50 } };
const CONSERVATIVE: Policy = { label: "conservative", thresholds: { block: 70, review: 50, log: 30 } };

describe("Policy · 默认与向后兼容", () => {
  it("两参 decide 等价于显式传 Champion(默认策略不改变行为)", () => {
    const t = base({ direction: "deposit", amount: 6_000 }); // 命中 R-AMT-001 +60
    const a = decide(t, OK);
    const b = decide(t, OK, CHAMPION);
    expect(a.action).toBe(b.action);
    expect(a.score).toBe(b.score);
    expect(a.band).toBe(b.band);
  });
  it("Champion 阈值常量与 strategy 默认基线一致", () => {
    expect(CHAMPION.thresholds).toEqual(THRESHOLDS);
  });
});

describe("Policy · 阈值覆盖改变处置落档", () => {
  it("挑战者更宽松:score 60 在 Champion 转研判、在 loose 仅留痕放行", () => {
    const t = base({ direction: "deposit", amount: 6_000 }); // score 60
    expect(decide(t, OK, CHAMPION).action).toBe("review");
    expect(decide(t, OK, CHAMPION).band).toBe("review");
    const loose = decide(t, OK, LOOSE);
    expect(loose.action).toBe("allow");
    expect(loose.band).toBe("log");
  });
  it("挑战者更保守:score 55 在 Champion 放行留痕、在 conservative 转研判", () => {
    const t = base({ direction: "withdraw", amount: 3_500 }); // score 55
    expect(decide(t, OK, CHAMPION).action).toBe("allow");
    expect(decide(t, OK, CHAMPION).band).toBe("log");
    expect(decide(t, OK, CONSERVATIVE).action).toBe("review");
  });
});

describe("Policy · 规则开关 / 权重覆盖", () => {
  it("disabledRules 关停某规则 → 该规则不评分、不命中", () => {
    const t = base({ direction: "deposit", amount: 6_000 });
    const p: Policy = { label: "no-amt", thresholds: { ...THRESHOLDS }, disabledRules: ["R-AMT-001"] };
    const d = decide(t, OK, p);
    expect(d.score).toBe(0);
    expect(d.action).toBe("allow");
    expect(d.reasons.some((r) => r.rule === "R-AMT-001" && r.code === "RULE_HIT")).toBe(false);
  });
  it("ruleWeights 覆盖权重 → 改变综合分与落档", () => {
    const t = base({ direction: "deposit", amount: 6_000 });
    const p: Policy = { label: "heavy-amt", thresholds: { ...THRESHOLDS }, ruleWeights: { "R-AMT-001": 85 } };
    const d = decide(t, OK, p);
    expect(d.score).toBe(85);          // 60 → 85
    expect(d.action).toBe("block");    // 85 ≥ 80
    expect(d.reasons.some((r) => r.rule === "R-AMT-001" && r.detail.includes("+85"))).toBe(true);
  });
});

describe("Policy · 法定 / 冻结项不可被策略削弱", () => {
  // 一个「什么都放宽 + 关停所有规则」的极端挑战者,用于验证法定项仍然生效
  const NEUTERED: Policy = {
    label: "neutered",
    thresholds: { block: 101, review: 101, log: 101 }, // 阈值抬到不可能触发
    disabledRules: ["R-AMT-001", "R-AMT-002", "R-CHN-001", "R-SCR-001", "R-BHV-001", "R-BHV-002", "R-BHV-003", "R-CHN-002"],
  };
  it("制裁命中:即便极端宽松策略仍冻结 + TPR", () => {
    const d = decide(base({ merchant: "  offshorefx ltd.  " }), OK, NEUTERED);
    expect(d.action).toBe("freeze");
    expect(d.reports).toContain("TPR");
    expect(d.reasons.some((r) => r.code === "SANCTIONS_HIT")).toBe(true);
  });
  it("LVCTR 法定大额:策略动不了报送触发", () => {
    const d = decide(base({ direction: "deposit", amount: 12_000 }), OK, NEUTERED);
    expect(d.reports).toContain("LVCTR");
  });
  it("冻结类规则若未被关停,宽松阈值也不能降级为放行", () => {
    const d = decide(base({ mixerHops: 2 }), OK, LOOSE); // R-CHN-001 命中即冻结
    expect(d.action).toBe("freeze");
  });
});

describe("shadowCompare · Champion vs Challenger 影子对比", () => {
  it("相同策略 → 零翻转,两侧计数一致", () => {
    const { agg, rows } = shadowCompare(SAMPLE_TXNS, CHAMPION, CHAMPION);
    expect(agg.flips).toBe(0);
    expect(rows.every((r) => !r.flipped)).toBe(true);
    expect(agg.champ).toEqual(agg.chall);
  });
  it("各处置计数之和 = 交易总数(两侧都齐)", () => {
    const { agg } = shadowCompare(SAMPLE_TXNS, CHAMPION, LOOSE);
    const sum = (c: Record<Action, number>) => c.freeze + c.block + c.hold + c.review + c.allow;
    expect(agg.total).toBe(SAMPLE_TXNS.length);
    expect(sum(agg.champ)).toBe(SAMPLE_TXNS.length);
    expect(sum(agg.chall)).toBe(SAMPLE_TXNS.length);
  });
  it("flips 与逐行 flipped 标记一致", () => {
    const { agg, rows } = shadowCompare(SAMPLE_TXNS, CHAMPION, LOOSE);
    const manual = rows.filter((r) => r.champ.action !== r.chall.action).length;
    expect(agg.flips).toBe(manual);
    expect(rows.every((r) => r.flipped === (r.champ.action !== r.chall.action))).toBe(true);
    expect(agg.flips).toBeGreaterThan(0); // Champion→loose 必有分歧
  });
  it("更宽松策略 → 直通率不降、拦截率不升", () => {
    const { agg } = shadowCompare(SAMPLE_TXNS, CHAMPION, LOOSE);
    expect(agg.challApprove).toBeGreaterThanOrEqual(agg.champApprove);
    expect(agg.challStop).toBeLessThanOrEqual(agg.champStop);
  });
  it("挑战者对每笔交易只影子跑,不改动 Champion 结果", () => {
    const { rows } = shadowCompare(SAMPLE_TXNS, CHAMPION, LOOSE);
    rows.forEach((r) => {
      const solo = decide(r.txn, {}, CHAMPION);
      expect(r.champ.action).toBe(solo.action); // champ 与单独按 Champion 决策一致
    });
  });
});

describe("SAMPLE_TXNS · 交易流基本约束", () => {
  it("非空、id 唯一、字段齐全", () => {
    expect(SAMPLE_TXNS.length).toBeGreaterThan(0);
    const ids = SAMPLE_TXNS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SAMPLE_TXNS.every((t) => !!t.id && !!t.merchant && !!t.direction && Number.isFinite(t.amount))).toBe(true);
  });
  it("在 Champion 下覆盖到冻结与拦截两种极端处置", () => {
    const acts = SAMPLE_TXNS.map((t) => decide(t, {}, CHAMPION).action);
    expect(acts).toContain("freeze");
    expect(acts).toContain("block");
  });
});
