import { describe, it, expect } from "vitest";
import { slaOf, computeSla, synthElapsedH, SLA_HOURS } from "./sla";
import { alerts, slaOfAlert } from "./data";
import { CASES, slaOfCase } from "./cases";
import { FINDINGS, slaOfFinding } from "./findings";

// ─────────────────────────────────────────────────────────────────────────────
// SLA 统一框架(B2)· 生命周期口径回归
// 锁定:三域(告警 / 案件 / 事后命中)SLA 均经 lib/sla.ts 一套口径产出,
// 且随「当前 live 状态」在 跑表 / 暂停 / 终态 三阶段切换。参数(时长/档)仍为占位。
// ─────────────────────────────────────────────────────────────────────────────

describe("slaOf · 生命周期阶段", () => {
  it("terminal → 已完结(默认)/ 自定义 doneLabel,时钟停止不计逾期", () => {
    const done = slaOf("X-1", "high", "terminal");
    expect(done.text).toBe("已完结");
    expect(done.overdue).toBe(false);
    expect(done.pct).toBe(0);
    expect(slaOf("X-1", "high", "terminal", "已报送").text).toBe("已报送");
  });

  it("paused → 已暂停,不计逾期", () => {
    const p = slaOf("X-2", "medium", "paused");
    expect(p.text).toBe("已暂停");
    expect(p.overdue).toBe(false);
  });

  it("active → 真时钟(剩 / 已逾期),确定性(同 id+档 稳定)", () => {
    const a = slaOf("ALT-9999", "high", "active");
    expect(a.text === slaOf("ALT-9999", "high", "active").text).toBe(true);
    expect(/^(剩 |已逾期 )/.test(a.text)).toBe(true);
    expect(a.tone === "grey").toBe(false); // 活动态用状态色,不落灰
  });
});

describe("computeSla · 逾期 / 临期 / 正常 分档", () => {
  it("已消耗超时限 → overdue + red", () => {
    const v = computeSla(SLA_HOURS.high + 5, "high");
    expect(v.overdue).toBe(true);
    expect(v.tone).toBe("red");
    expect(v.text.startsWith("已逾期")).toBe(true);
  });
  it("余量 ≤25% → amber;充裕 → blue", () => {
    expect(computeSla(SLA_HOURS.high * 0.8, "high").tone).toBe("amber");
    expect(computeSla(SLA_HOURS.high * 0.1, "high").tone).toBe("blue");
  });
  it("synthElapsedH 落在 0 .. 1.3×时限", () => {
    const e = synthElapsedH("SOME-ID", "medium");
    expect(e).toBeGreaterThanOrEqual(0);
    expect(e).toBeLessThanOrEqual(Math.round(SLA_HOURS.medium * 1.3));
  });
});

describe("三域解析器 · live 状态 → 阶段", () => {
  const alert = alerts[0]; // 任取一条种子告警

  it("slaOfAlert:closed_* → 终态;pending → 暂停;其余 → 跑表", () => {
    expect(slaOfAlert(alert, "closed_done").text).toBe("已完结");
    expect(slaOfAlert(alert, "pending").text).toBe("已暂停");
    expect(/^(剩 |已逾期 )/.test(slaOfAlert(alert, "new").text)).toBe(true);
  });

  it("slaOfCase:filed→已报送 / merged→并入主案 / closed→已完结 / 在办→跑表", () => {
    const c = CASES[0];
    expect(slaOfCase(c, "filed").text).toBe("已报送");
    expect(slaOfCase(c, "merged").text).toBe("并入主案");
    expect(slaOfCase(c, "closed").text).toBe("已完结");
    expect(/^(剩 |已逾期 )/.test(slaOfCase(c, "investigating").text)).toBe(true);
  });

  it("slaOfFinding:closed_* → 终态;pending → 暂停;其余 → 跑表", () => {
    const f = FINDINGS[0];
    expect(slaOfFinding(f, "closed_str").text).toBe("已完结");
    expect(slaOfFinding(f, "pending").text).toBe("已暂停");
    expect(/^(剩 |已逾期 )/.test(slaOfFinding(f, "new").text)).toBe(true);
  });

  it("风险高的档位时限 ≤ 风险低的档位(high 更紧)", () => {
    // 高危 finding(red)→ high 档;中危(amber)→ medium 档:同 id 下 high 档 allot 更小
    expect(SLA_HOURS.high).toBeLessThan(SLA_HOURS.medium);
  });
});
