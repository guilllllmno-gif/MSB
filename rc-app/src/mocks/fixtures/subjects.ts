// 主体 fixtures(≥12,ID 唯一,主体各不相同)。与 rc-app 既有世界一致(NovaPay/BlockTrade/…)。
// 详情(SubjectDetail)由 buildSubjectDetail 确定性派生(seed=id),保证 schema 合法且稳定。
import type { Subject, SubjectDetail, MergedWallet, AmlHit, MergeLogEntry, MergeCandidate } from "@/schemas/subject";
import type { AssocEvidence, DimensionKey } from "@/schemas/common";

export const SUBJECTS: Subject[] = [
  { id: "SUBJ-0001", name: "NovaPay Technologies Ltd.", type: "entity", avatar: "NP", riskLevel: "high", riskScore: 88, mergeConfidence: 92, walletCount: 3, ringId: "RING-0001", ringRole: "归集核心", totalAmountCad: 124000, amlHitCount: 4, ruleHitCount: 7, accountAgeDays: 95, kycStatus: "pending", firstSeen: "2026-03-15" },
  { id: "SUBJ-0002", name: "BlockTrade Corp.", type: "entity", avatar: "BT", riskLevel: "high", riskScore: 84, mergeConfidence: 81, walletCount: 2, ringId: "RING-0001", ringRole: "出金商户", totalAmountCad: 48000, amlHitCount: 3, ruleHitCount: 5, accountAgeDays: 210, kycStatus: "passed", firstSeen: "2025-11-08" },
  { id: "SUBJ-0003", name: "Eastwind Exchange", type: "entity", avatar: "EE", riskLevel: "mid", riskScore: 66, mergeConfidence: 73, walletCount: 2, ringId: "RING-0002", ringRole: "资金来源", totalAmountCad: 27100, amlHitCount: 2, ruleHitCount: 3, accountAgeDays: 320, kycStatus: "passed", firstSeen: "2025-08-12" },
  { id: "SUBJ-0004", name: "RapidPay Ltd.", type: "entity", avatar: "RP", riskLevel: "high", riskScore: 90, mergeConfidence: 88, walletCount: 4, ringId: "RING-0002", ringRole: "归集核心", totalAmountCad: 38400, amlHitCount: 5, ruleHitCount: 8, accountAgeDays: 140, kycStatus: "pending", firstSeen: "2026-02-01" },
  { id: "SUBJ-0005", name: "GlobalRemit Ltd.", type: "entity", avatar: "GR", riskLevel: "high", riskScore: 86, mergeConfidence: 79, walletCount: 3, ringId: "RING-0003", ringRole: "归集入金商户", totalAmountCad: 124000, amlHitCount: 4, ruleHitCount: 6, accountAgeDays: 175, kycStatus: "passed", firstSeen: "2025-12-20" },
  { id: "SUBJ-0006", name: "HavenPay Inc.", type: "entity", avatar: "HP", riskLevel: "mid", riskScore: 71, mergeConfidence: 64, walletCount: 2, ringId: "RING-0003", ringRole: "出金商户", totalAmountCad: 33500, amlHitCount: 2, ruleHitCount: 4, accountAgeDays: 410, kycStatus: "passed", firstSeen: "2025-05-18" },
  { id: "SUBJ-0007", name: "Chen Wei", type: "individual", avatar: "CW", riskLevel: "high", riskScore: 82, mergeConfidence: 85, walletCount: 3, ringId: "RING-0002", ringRole: "实际控制人", totalAmountCad: 14200, amlHitCount: 3, ruleHitCount: 4, accountAgeDays: 88, kycStatus: "pending", firstSeen: "2026-04-02" },
  { id: "SUBJ-0008", name: "Li Ming", type: "individual", avatar: "LM", riskLevel: "mid", riskScore: 63, mergeConfidence: 58, walletCount: 2, ringId: "RING-0002", ringRole: "共同 UBO", totalAmountCad: 12000, amlHitCount: 1, ruleHitCount: 2, accountAgeDays: 150, kycStatus: "passed", firstSeen: "2026-01-25" },
  { id: "SUBJ-0009", name: "SwiftRemit Inc.", type: "entity", avatar: "SR", riskLevel: "mid", riskScore: 59, mergeConfidence: 56, walletCount: 1, ringId: null, totalAmountCad: 22500, amlHitCount: 1, ruleHitCount: 2, accountAgeDays: 260, kycStatus: "passed", firstSeen: "2025-09-30" },
  { id: "SUBJ-0010", name: "OffshoreFX Ltd.", type: "entity", avatar: "OF", riskLevel: "high", riskScore: 95, mergeConfidence: 90, walletCount: 2, ringId: null, totalAmountCad: 88000, amlHitCount: 6, ruleHitCount: 9, accountAgeDays: 60, kycStatus: "rejected", firstSeen: "2026-04-20" },
  { id: "SUBJ-0011", name: "QuickWallet Inc.", type: "entity", avatar: "QW", riskLevel: "low", riskScore: 38, mergeConfidence: 52, walletCount: 1, ringId: null, totalAmountCad: 9600, amlHitCount: 0, ruleHitCount: 1, accountAgeDays: 520, kycStatus: "passed", firstSeen: "2024-12-11" },
  { id: "SUBJ-0012", name: "J. Morrison", type: "individual", avatar: "JM", riskLevel: "low", riskScore: 31, mergeConfidence: 0, walletCount: 1, ringId: null, totalAmountCad: 5800, amlHitCount: 0, ruleHitCount: 0, accountAgeDays: 700, kycStatus: "passed", firstSeen: "2024-08-03" },
];

// ── 确定性派生 SubjectDetail(seed=id;无随机,刷新稳定)──
const seedOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const DIMS: DimensionKey[] = ["fund", "device", "withdraw_addr", "ip"];
const DIM_NOTE: Record<DimensionKey, string> = {
  fund: "资金 2 跳归集 + 复用收款地址",
  device: "共享 2 个设备指纹",
  withdraw_addr: "复用同一提现地址",
  ip: "同一 IP 段登录,时间窗重叠",
};
const AML_TITLES = ["混币器关联充值", "结构化拆分入金", "快进快出过水", "KYW 收款地址超阈值", "大额提现偏离基线", "对手集中度异常"];

// 确定性生成钱包地址(展示截断形式 0x{4}…{4};seed=主体id + 序号)
const HEXD = "0123456789abcdef";
function walletOf(h: number, i: number): string {
  const d = (k: number) => HEXD[(h >>> (k % 28)) & 0xf];
  const head = d(i * 4) + d(i * 4 + 5) + d(i * 4 + 9) + d(i * 4 + 13);
  const tail = d(i * 3 + 2) + d(i * 3 + 7) + d(i * 3 + 11) + d(i * 3 + 17);
  return `0x${head}…${tail}`;
}

function evidenceFor(s: Subject): AssocEvidence[] {
  const h = seedOf(s.id);
  const n = 2 + (h % 2); // 2–3 条
  return Array.from({ length: n }, (_, i) => {
    const dim = DIMS[(h >>> (i * 2)) % DIMS.length];
    const strong = s.mergeConfidence >= 75 ? i === 0 : false; // 高置信主体至少一条强信号
    return { dimension: dim, strength: strong ? "strong" : "weak", weight: strong ? 40 : 10 + ((h >>> i) % 15), note: DIM_NOTE[dim] };
  });
}

export function buildSubjectDetail(s: Subject, candidates: MergeCandidate[]): SubjectDetail {
  const h = seedOf(s.id);
  const wallets: MergedWallet[] = Array.from({ length: Math.max(1, s.walletCount) }, (_, i) => {
    const anchor = i === 0;
    return {
      address: walletOf(h ^ (i * 0x9e37), i),
      isAnchor: anchor,
      registeredAt: s.firstSeen,
      linkStrength: anchor ? null : 50 + ((h >>> (i * 3)) % 48),
      meta: anchor ? "登记地址 · 注册时身份核验" : DIM_NOTE[DIMS[(h >>> i) % DIMS.length]],
    };
  });
  const amlHits: AmlHit[] = Array.from({ length: s.amlHitCount }, (_, i) => ({
    id: `${s.id}-AML-${i + 1}`,
    title: AML_TITLES[(h + i) % AML_TITLES.length],
    detectedAt: s.firstSeen,
    detail: `命中 ${AML_TITLES[(h + i) % AML_TITLES.length]};涉及钱包地址 ${wallets[i % wallets.length].address},经 KYT 链上分析确认。`,
  }));
  const mergeLog: MergeLogEntry[] = wallets.map((a, i) =>
    a.isAnchor
      ? { action: "auto_merge" as const, wallet: a.address, operator: "系统 · 实体关联", at: s.firstSeen }
      : { action: (i % 3 === 0 ? "manual_merge" : "auto_merge") as "manual_merge" | "auto_merge", wallet: a.address, operator: i % 3 === 0 ? "风控分析师 · James Liu" : "系统 · 实体关联", at: s.firstSeen, reason: i % 3 === 0 ? "复核确认同设备指纹 + 同提现地址,人工归属" : undefined },
  );
  return {
    ...s,
    wallets,
    mergeEvidence: evidenceFor(s),
    amlHits,
    pendingCandidates: candidates.filter((c) => c.targetSubjectId === s.id),
    mergeLog,
  };
}
