import { describe, it, expect } from "vitest";
import { decide, type Txn, type DataHealth, type Action, type ReportKind } from "./decision";

// ─────────────────────────────────────────────────────────────────────────────
// item 2:回归样本集 + 对照表。
// 注意:这是「我构造」的样本集,期望值取自 /strategy 政策口径(FINTRAC / 制裁 / 基线矩阵),
// 与引擎实现相互独立(policy = ground truth,engine = 被测对象)。
// 你提供真样本后,把下面的 SAMPLES 整体替换/追加即可,断言逻辑不变。
// 样本主体取自真实种子(lib/lists.ts):制裁地址 0x7F4a…9c21 / 制裁商户 OffshoreFX Ltd.
// / 黑名单成员 / 关注名单 Eastwind / 白名单 NovaPay / pending 黑名单 0x9a1c…44Bd。
// ─────────────────────────────────────────────────────────────────────────────
const OK: DataHealth = { sanctionsSource: "ok", scoring: "ok", chainTrace: "ok" };
const t = (over: Partial<Txn>): Txn => ({ id: "S", merchant: "CleanCo Ltd.", direction: "deposit", amount: 100, kybComplete: true, kyw: 5, ...over });

interface Sample { name: string; txn: Txn; health?: DataHealth; expect: { action: Action; reports?: ReportKind[]; manualReview?: boolean } }

const SAMPLES: Sample[] = [
  { name: "干净小额充值", txn: t({ amount: 200 }), expect: { action: "allow", reports: [] } },
  { name: "大额充值 8,000 (+60)", txn: t({ amount: 8_000 }), expect: { action: "review", reports: [] } },
  { name: "大额提现 3,500 (+55, 留痕放行)", txn: t({ direction: "withdraw", amount: 3_500 }), expect: { action: "allow", reports: [] } },
  { name: "LVCTR:充值 15,000", txn: t({ amount: 15_000 }), expect: { action: "review", reports: ["LVCTR"] } },
  { name: "制裁地址收款 → 冻结 + TPR", txn: t({ direction: "withdraw", amount: 4_000, receiver: "0x7F4a…9c21" }), expect: { action: "freeze", reports: ["TPR"], manualReview: true } },
  { name: "制裁商户主体 → 冻结 + TPR", txn: t({ merchant: "OffshoreFX Ltd.", amount: 500 }), expect: { action: "freeze", reports: ["TPR"], manualReview: true } },
  { name: "黑名单成员(active)→ 拦截", txn: t({ merchant: "众包养卡团伙成员 #07", amount: 300 }), expect: { action: "block", manualReview: true } },
  { name: "关注名单(active)→ 加强监控(转研判,不拦)", txn: t({ merchant: "Eastwind Exchange", amount: 300 }), expect: { action: "review", manualReview: true } },
  { name: "白名单商户高 KYW → 豁免评分类 → 放行", txn: t({ merchant: "NovaPay Technologies Ltd.", kyw: 95, amount: 200 }), expect: { action: "allow", reports: [] } },
  { name: "结构化拆单 9,000 ×6 相近 → 拦截", txn: t({ amount: 9_000, window: { count24h: 6, similarAmountRun: true } }), expect: { action: "block", reports: [] } },
  { name: "混币器 ≤2 跳 → 冻结", txn: t({ mixerHops: 1, amount: 2_000 }), expect: { action: "freeze", manualReview: true } },
  { name: "KYW 88 单独(+50 留痕放行)", txn: t({ kyw: 88, amount: 200 }), expect: { action: "allow" } },
  { name: "组合高分:充值 6,000 + KYW 88 → 拦截", txn: t({ amount: 6_000, kyw: 88 }), expect: { action: "block", manualReview: true } },
  { name: "白名单商户 → 制裁对手地址(白名单不豁免制裁)→ 冻结", txn: t({ merchant: "NovaPay Technologies Ltd.", direction: "withdraw", amount: 4_000, receiver: "0x7F4a…9c21" }), expect: { action: "freeze", reports: ["TPR"] } },
  { name: "pending 黑名单地址(未生效)→ 不拦", txn: t({ receiver: "0x9a1c…44Bd", amount: 200 }), expect: { action: "allow" } },
  { name: "降级:制裁源不可达 → fail-closed 暂缓", txn: t({ amount: 200 }), health: { sanctionsSource: "down", scoring: "ok", chainTrace: "ok" }, expect: { action: "hold", manualReview: true } },
  { name: "降级:评分超时 + 大额 → 暂缓", txn: t({ amount: 12_000, kyw: 95 }), health: { sanctionsSource: "ok", scoring: "timeout", chainTrace: "ok" }, expect: { action: "hold", reports: ["LVCTR"] } },
  { name: "字段异常:负数金额 → 暂缓", txn: t({ amount: -100 }), expect: { action: "hold", manualReview: true } },
  { name: "KYC 缺失 → 最高风险档(转研判)", txn: t({ kybComplete: undefined, amount: 200 }), expect: { action: "review" } },
];

describe("回归对照表 (policy = ground truth)", () => {
  it("全部样本 PASS,并打印对照表", () => {
    const rows = SAMPLES.map((s, i) => {
      const d = decide(s.txn, s.health ?? OK);
      const actExp = s.expect.action;
      const repExp = s.expect.reports;
      const mrExp = s.expect.manualReview;
      const repOk = repExp === undefined || (repExp.every((r) => d.reports.includes(r)) && d.reports.length === repExp.length);
      const mrOk = mrExp === undefined || d.manualReview === mrExp;
      const pass = d.action === actExp && repOk && mrOk;
      return {
        "#": i + 1,
        场景: s.name,
        期望动作: actExp,
        实际动作: d.action,
        分: d.score,
        期望报送: (repExp ?? ["—(不校验)"]).join("/") || "无",
        实际报送: d.reports.join("/") || "无",
        PASS: pass ? "✅" : "❌",
        _pass: pass,
      };
    });
    // 打印对照表
    // eslint-disable-next-line no-console
    console.table(rows.map(({ _pass, ...r }) => r));
    const failures = rows.filter((r) => !r._pass).map((r) => `#${r["#"]} ${r.场景}: 期望 ${r.期望动作} 实得 ${r.实际动作}`);
    // eslint-disable-next-line no-console
    console.log(`\n回归结果:${rows.filter((r) => r._pass).length}/${rows.length} PASS`);
    expect(failures).toEqual([]);
  });
});
