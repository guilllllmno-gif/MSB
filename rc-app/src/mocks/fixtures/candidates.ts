// 待确认归并候选 fixtures(≥5)。confidence 一律落在 [50,74] 复核区间(§7.3:队列只展示该区间)。
// 候选 = 一个观察到的钱包地址,疑似应归属至某个主体/商户(address → targetSubject),待人工复核。
import type { MergeCandidate } from "@/schemas/subject";

export const CANDIDATES: MergeCandidate[] = [
  { id: "CAND-0001", address: "0x91Ad…77F2", targetSubjectId: "SUBJ-0001", targetSubjectName: "NovaPay Technologies Ltd.", confidence: 68, detectedAt: "2026-06-28", evidence: [
    { dimension: "withdraw_addr", strength: "strong", weight: 40, note: "复用 NovaPay 历史提现地址 0x91Ad…77F2" },
    { dimension: "ip", strength: "weak", weight: 13, note: "同 IP 段 203.0.113.x 登录" },
  ] },
  { id: "CAND-0002", address: "0x3c8b…a190", targetSubjectId: "SUBJ-0004", targetSubjectName: "RapidPay Ltd.", confidence: 72, detectedAt: "2026-06-27", evidence: [
    { dimension: "device", strength: "strong", weight: 40, note: "共享设备群 DV-7 指纹" },
    { dimension: "fund", strength: "weak", weight: 18, note: "资金 3 跳后归集至同一地址" },
  ] },
  { id: "CAND-0003", address: "0x77e1…4c2d", targetSubjectId: "SUBJ-0007", targetSubjectName: "Chen Wei", confidence: 55, detectedAt: "2026-06-26", evidence: [
    { dimension: "ip", strength: "weak", weight: 15, note: "同 IP 段 + 登录时间窗重叠" },
    { dimension: "device", strength: "weak", weight: 22, note: "相似设备指纹(非完全一致)" },
  ] },
  { id: "CAND-0004", address: "0xb204…f5aa", targetSubjectId: "SUBJ-0005", targetSubjectName: "GlobalRemit Ltd.", confidence: 63, detectedAt: "2026-06-25", evidence: [
    { dimension: "fund", strength: "weak", weight: 24, note: "拆分入金后归集至 GlobalRemit 收款地址" },
    { dimension: "withdraw_addr", strength: "weak", weight: 19, note: "提现地址前缀相近" },
  ] },
  { id: "CAND-0005", address: "0x5f30…8b71", targetSubjectId: "SUBJ-0003", targetSubjectName: "Eastwind Exchange", confidence: 50, detectedAt: "2026-06-24", evidence: [
    { dimension: "ip", strength: "weak", weight: 12, note: "同 IP 段登录" },
  ] },
  { id: "CAND-0006", address: "bc1q…7h2k", targetSubjectId: "SUBJ-0010", targetSubjectName: "OffshoreFX Ltd.", confidence: 74, detectedAt: "2026-06-23", evidence: [
    { dimension: "withdraw_addr", strength: "strong", weight: 40, note: "复用已列名单提现地址 bc1q…7h2k" },
    { dimension: "fund", strength: "weak", weight: 20, note: "资金快速过水至同一出口" },
  ] },
];
