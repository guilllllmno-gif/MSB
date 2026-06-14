// ── Mock domain for the FuturePayCA risk-control prototype (React/shadcn slice) ──
// Three pages share this: Merchant 360, Case Evidence, Unfreeze workflow.

export type Tone = "green" | "amber" | "red" | "blue" | "violet" | "grey";

export function riskLevel(score: number): { label: string; tone: Tone } {
  if (score >= 70) return { label: "高风险", tone: "red" };
  if (score >= 40) return { label: "中风险", tone: "amber" };
  return { label: "低风险", tone: "green" };
}

// STR 30-day clock helper (days left → tone)
export function slaTone(daysLeft: number): Tone {
  if (daysLeft < 0) return "red";
  if (daysLeft <= 7) return "amber";
  return "green";
}

export interface Merchant {
  id: string;
  name: string;
  country: string;
  mso: string;
  kyb: string;
  status: string;
  statusTone: Tone;
  accountAge: string;
  crr: number;
  kyw: number;
  owner: { initials: string; name: string };
  vol30: string;
  limit: string;
  registeredWallets: number;
  highRiskWallets: number;
  strCount: number;
  eddCount: number;
}

export const merchant: Merchant = {
  id: "MID-30219",
  name: "NovaPay Technologies Ltd.",
  country: "🇰🇾 开曼群岛",
  mso: "MSO-CA-118822",
  kyb: "已验证",
  status: "受限 · 部分冻结",
  statusTone: "amber",
  accountAge: "1 年 4 个月",
  crr: 91,
  kyw: 86,
  owner: { initials: "SC", name: "Sarah Chen" },
  vol30: "CAD 1,284,500",
  limit: "CAD 50,000 / 日",
  registeredWallets: 6,
  highRiskWallets: 2,
  strCount: 3,
  eddCount: 2,
};

// CRR history (risk rating over time)
export const crrHistory = [
  { date: "2025-02", crr: 44 },
  { date: "2025-05", crr: 52 },
  { date: "2025-08", crr: 61 },
  { date: "2025-11", crr: 68 },
  { date: "2026-02", crr: 77 },
  { date: "2026-05", crr: 91 },
];

// 30-day transaction volume vs. the merchant's own 90-day baseline (anomaly detection)
export const volumeSeries = [
  { d: "05-16", v: 38, base: 41 }, { d: "05-18", v: 42, base: 41 },
  { d: "05-20", v: 40, base: 42 }, { d: "05-22", v: 45, base: 42 },
  { d: "05-24", v: 43, base: 43 }, { d: "05-26", v: 39, base: 43 },
  { d: "05-28", v: 48, base: 44 }, { d: "05-30", v: 52, base: 44 },
  { d: "06-01", v: 61, base: 45 }, { d: "06-03", v: 88, base: 45 },
  { d: "06-05", v: 132, base: 46 }, { d: "06-07", v: 119, base: 46 },
  { d: "06-09", v: 96, base: 47 }, { d: "06-11", v: 104, base: 47 },
];

export interface CaseRow {
  no: string; type: string; state: string; stateTone: Tone;
  amount: string; priority: string; priorityTone: Tone;
  slaLeft: number; owner: string;
}
export const cases: CaseRow[] = [
  { no: "CASE-2026-0312", type: "混币器关联 · 制裁溯源", state: "MLRO 评估中", stateTone: "violet", amount: "CAD 8,200", priority: "高", priorityTone: "red", slaLeft: 6, owner: "David Wu (MLRO)" },
  { no: "CASE-2026-0306", type: "重复告警 · 已并案", state: "已合并", stateTone: "grey", amount: "CAD 2,100", priority: "低", priorityTone: "grey", slaLeft: 99, owner: "Sarah Chen" },
  { no: "CASE-2026-0305", type: "大额异常", state: "已结案", stateTone: "green", amount: "CAD 12,000", priority: "中", priorityTone: "amber", slaLeft: 99, owner: "Sarah Chen" },
];

export interface AlertRow {
  id: string; type: string; rule: string; sev: string; sevTone: Tone;
  amount: string; status: string; time: string;
}
export const alerts: AlertRow[] = [
  { id: "ALT-50231", type: "充值", rule: "混币器关联", sev: "高", sevTone: "red", amount: "CAD 8,200", status: "已建案", time: "06-11 09:34" },
  { id: "ALT-50240", type: "充值", rule: "高频拆分", sev: "中", sevTone: "amber", amount: "CAD 2,100", status: "已并案", time: "06-09 12:00" },
  { id: "ALT-50212", type: "提现", rule: "大额异常", sev: "中", sevTone: "amber", amount: "CAD 12,000", status: "已结案", time: "05-02 06:31" },
  { id: "ALT-50260", type: "充值", rule: "新走廊首现", sev: "低", sevTone: "grey", amount: "CAD 980", status: "自动放行", time: "06-10 21:14" },
];

export interface WalletRow {
  address: string; chain: string; label: string; kyw: number;
  exposure: { label: string; pct: number; tone: Tone }[];
  lastScan: string; sanctioned: boolean;
}
export const wallets: WalletRow[] = [
  {
    address: "0x9f2a…d7E1", chain: "ERC-20", label: "热钱包-运营", kyw: 86,
    exposure: [
      { label: "混币器", pct: 38, tone: "red" }, { label: "未知来源", pct: 24, tone: "amber" },
      { label: "高风险交易所", pct: 16, tone: "amber" }, { label: "合规来源", pct: 22, tone: "green" },
    ],
    lastScan: "2026-06-11 06:00", sanctioned: true,
  },
  {
    address: "bc1q…8k4d", chain: "BTC", label: "冷钱包-储备", kyw: 41,
    exposure: [
      { label: "合规来源", pct: 71, tone: "green" }, { label: "未知来源", pct: 18, tone: "amber" },
      { label: "高风险交易所", pct: 11, tone: "amber" },
    ],
    lastScan: "2026-06-08 06:00", sanctioned: false,
  },
  {
    address: "TPa3…Lm9V", chain: "TRC-20", label: "结算地址", kyw: 28,
    exposure: [
      { label: "合规来源", pct: 82, tone: "green" }, { label: "未知来源", pct: 12, tone: "amber" },
      { label: "博彩", pct: 6, tone: "red" },
    ],
    lastScan: "2026-06-10 06:00", sanctioned: false,
  },
];

export interface TxRow {
  id: string; dir: "充值" | "提现"; asset: string; amount: string;
  cad: string; status: string; statusTone: Tone; time: string;
}
export const transactions: TxRow[] = [
  { id: "DEP-20260611-001", dir: "充值", asset: "USDT", amount: "8,200", cad: "CAD 8,200", status: "已冻结", statusTone: "red", time: "06-11 09:34" },
  { id: "WD-20260609-058", dir: "提现", asset: "ETH", amount: "5.2", cad: "CAD 21,400", status: "暂缓", statusTone: "amber", time: "06-09 11:00" },
  { id: "DEP-20260607-204", dir: "充值", asset: "USDT", amount: "3,150", cad: "CAD 3,150", status: "已放行", statusTone: "green", time: "06-07 08:40" },
  { id: "DEP-20260605-112", dir: "充值", asset: "BTC", amount: "0.18", cad: "CAD 9,400", status: "已放行", statusTone: "green", time: "06-05 05:40" },
  { id: "WD-20260603-021", dir: "提现", asset: "USDT", amount: "12,000", cad: "CAD 12,000", status: "已放行", statusTone: "green", time: "06-03 06:25" },
];

export interface ActivityRow { time: string; actor: string; role: string; action: string; detail: string; }
export const activity: ActivityRow[] = [
  { time: "2026-06-11 09:34", actor: "系统", role: "SYS", action: "事中冻结 → 建案", detail: "DEP-20260611-001 命中混币器关联 → CASE-2026-0312" },
  { time: "2026-06-11 06:00", actor: "系统", role: "SYS", action: "KYW 重新扫描", detail: "0x9f2a…d7E1 评分 78 → 86,风险上升" },
  { time: "2026-06-08 14:20", actor: "Sarah Chen", role: "L1", action: "更新 CRR", detail: "CRR 77 → 91,新增制裁溯源指标" },
  { time: "2026-05-21 10:02", actor: "Sarah Chen", role: "L1", action: "起草 STR", detail: "CASE-2026-0312 STR 草稿创建" },
  { time: "2026-05-02 06:31", actor: "系统", role: "SYS", action: "规则命中暂缓", detail: "WD-20260603-021 大额异常" },
];

// ── Case Evidence page ──
export interface Evidence {
  id: string; name: string; kind: "链上分析" | "商户材料" | "截图" | "内部备忘" | "制裁筛查";
  tone: Tone; size: string; uploader: string; role: string; time: string;
  reason: string; linkedStr: boolean; note: string;
}
export const evidence: Evidence[] = [
  { id: "EV-1042", name: "Chainalysis_溯源报告_0x9f2a.pdf", kind: "链上分析", tone: "blue", size: "2.4 MB", uploader: "Sarah Chen", role: "L1", time: "2026-06-11 10:12", reason: "首次提交", linkedStr: true, note: "92% 资金溯源至 Tornado Cash,2 跳触及 OFAC 制裁地址。" },
  { id: "EV-1043", name: "资金来源证明_NovaPay.pdf", kind: "商户材料", tone: "violet", size: "1.1 MB", uploader: "客户代理", role: "AGENT", time: "2026-06-11 15:40", reason: "请求更新", linkedStr: false, note: "商户提交的资金来源说明,与链上溯源存在矛盾,待核实。" },
  { id: "EV-1044", name: "交易对手地址情报.png", kind: "截图", tone: "grey", size: "640 KB", uploader: "Mike Lin", role: "L1", time: "2026-06-11 16:05", reason: "合规上传", linkedStr: true, note: "对手地址链龄 9 天,历史拦截 3 次。" },
  { id: "EV-1045", name: "OFAC_UN_筛查结果.pdf", kind: "制裁筛查", tone: "red", size: "320 KB", uploader: "系统", role: "SYS", time: "2026-06-11 09:35", reason: "首次提交", linkedStr: true, note: "间接命中 · OFAC SDN(2 跳)。" },
  { id: "EV-1046", name: "L1研判备忘_0312.txt", kind: "内部备忘", tone: "amber", size: "12 KB", uploader: "Sarah Chen", role: "L1", time: "2026-06-12 09:18", reason: "合规上传", linkedStr: false, note: "建议移交 MLRO,符合可疑交易报送门槛。" },
];

export const chainOfCustody = [
  { time: "2026-06-11 09:35", actor: "系统", text: "EV-1045 自动归档 · 哈希锚定" },
  { time: "2026-06-11 10:12", actor: "Sarah Chen", text: "上传 EV-1042 链上溯源报告" },
  { time: "2026-06-11 16:05", actor: "Mike Lin", text: "上传 EV-1044 并关联至 STR 草稿" },
  { time: "2026-06-12 09:18", actor: "Sarah Chen", text: "上传 EV-1046 研判备忘" },
];

// ── Unfreeze / remediation page ──
export interface FrozenItem {
  id: string; merchant: string; asset: string; amount: string; cad: string;
  frozenAt: string; reason: string; case: string; daysHeld: number;
}
export const frozenItem: FrozenItem = {
  id: "DEP-20260611-001", merchant: "NovaPay Technologies Ltd.", asset: "USDT (ERC-20)",
  amount: "8,200", cad: "CAD 8,200", frozenAt: "2026-06-11 11:05",
  reason: "链上溯源命中混币器 · 关联制裁地址", case: "CASE-2026-0312", daysHeld: 3,
};

export type StepState = "done" | "active" | "todo";
export interface UnfreezeStep { key: string; label: string; state: StepState; by?: string; at?: string; }
export const unfreezeSteps: UnfreezeStep[] = [
  { key: "frozen", label: "资金冻结", state: "done", by: "系统", at: "06-11 11:05" },
  { key: "requested", label: "提交解冻申请", state: "done", by: "客户代理", at: "06-12 10:30" },
  { key: "l2", label: "L2 复核", state: "active", by: "Emma Zhang (L2)" },
  { key: "mlro", label: "MLRO 批准", state: "todo" },
  { key: "decision", label: "执行处置", state: "todo" },
];

export const unfreezeTrail = [
  { time: "2026-06-11 11:05", actor: "系统", role: "SYS", text: "拒绝并冻结 · 命中混币器关联" },
  { time: "2026-06-12 10:30", actor: "客户代理", role: "AGENT", text: "代商户提交解冻申请,附资金来源证明" },
  { time: "2026-06-12 14:02", actor: "Emma Zhang (L2)", role: "L2", text: "受理解冻申请,进入 L2 复核" },
];

// ── Merchant list page ──
export interface MerchantListRow {
  id: string; name: string; flag: string; country: string; mid: string;
  balance: string; risk: number; status: string; statusTone: Tone; onboarded: string;
}
export const merchantStatusTone: Record<string, Tone> = {
  "已通过": "green", "待审核": "amber", "已拒绝": "red", "待补充材料": "blue",
};
export const merchantList: MerchantListRow[] = [
  { id: "MID-30219", name: "NovaPay Technologies Ltd.", flag: "🇰🇾", country: "开曼群岛", mid: "MCH90909920250398", balance: "USD 1,284,500.00", risk: 91, status: "已通过", statusTone: "green", onboarded: "2025-02-10 09:30:15" },
  { id: "MID-30220", name: "BlockTrade Corp.", flag: "🇸🇬", country: "新加坡", mid: "MCH88120045120771", balance: "USD 540,200.00", risk: 64, status: "待审核", statusTone: "amber", onboarded: "2026-05-28 14:02:40" },
  { id: "MID-30221", name: "Skyline Pay Inc.", flag: "🇨🇦", country: "加拿大", mid: "MCH77451200389044", balance: "USD 96,400.00", risk: 52, status: "待补充材料", statusTone: "blue", onboarded: "2026-06-01 08:15:00" },
  { id: "MID-30222", name: "Eastwind Exchange", flag: "🇭🇰", country: "香港", mid: "MCH66012398745521", balance: "USD 23,150.00", risk: 33, status: "已通过", statusTone: "green", onboarded: "2025-11-12 11:40:22" },
  { id: "MID-30223", name: "Meridian FX Ltd.", flag: "🇦🇪", country: "阿联酋", mid: "MCH55890012047781", balance: "USD 880,000.00", risk: 77, status: "已拒绝", statusTone: "red", onboarded: "2026-04-03 16:25:10" },
  { id: "MID-30224", name: "Acme Pay Ltd.", flag: "🇬🇧", country: "英国", mid: "MCH44120998120034", balance: "USD 412,000.00", risk: 88, status: "待审核", statusTone: "amber", onboarded: "2026-03-19 09:50:00" },
  { id: "MID-30225", name: "Lumen Capital", flag: "🇺🇸", country: "美国", mid: "MCH33001288740912", balance: "USD 210,500.00", risk: 28, status: "已通过", statusTone: "green", onboarded: "2025-09-22 13:05:48" },
  { id: "MID-30226", name: "Orbit Remit", flag: "🇦🇺", country: "澳大利亚", mid: "MCH22890045120066", balance: "USD 65,800.00", risk: 49, status: "待补充材料", statusTone: "blue", onboarded: "2026-06-05 07:30:33" },
  { id: "MID-30227", name: "Vega Settlements", flag: "🇨🇭", country: "瑞士", mid: "MCH11900128440285", balance: "USD 1,020,000.00", risk: 61, status: "已通过", statusTone: "green", onboarded: "2025-07-14 10:12:09" },
  { id: "MID-30228", name: "Northwind Pay", flag: "🇨🇦", country: "加拿大", mid: "MCH10012988470120", balance: "USD 8,900.00", risk: 22, status: "已拒绝", statusTone: "red", onboarded: "2026-02-28 15:48:21" },
  { id: "MID-30229", name: "Helios Digital", flag: "🇸🇬", country: "新加坡", mid: "MCH99120045128890", balance: "USD 305,000.00", risk: 73, status: "待审核", statusTone: "amber", onboarded: "2026-05-09 12:00:55" },
  { id: "MID-30230", name: "Tundra Exchange", flag: "🇨🇦", country: "加拿大", mid: "MCH98001288440213", balance: "USD 150,300.00", risk: 31, status: "已通过", statusTone: "green", onboarded: "2025-12-02 09:18:40" },
  { id: "MID-30231", name: "Castor Pay", flag: "🇰🇾", country: "开曼群岛", mid: "MCH97451200380077", balance: "USD 47,600.00", risk: 55, status: "待补充材料", statusTone: "blue", onboarded: "2026-06-08 06:42:11" },
  { id: "MID-30232", name: "Pioneer FX", flag: "🇺🇸", country: "美国", mid: "MCH96012398740338", balance: "USD 720,000.00", risk: 84, status: "已拒绝", statusTone: "red", onboarded: "2026-01-17 17:33:02" },
];

// ── Merchant 360 detail (按用户真实详情页结构) ──
export const merchantProfile = {
  merchantName: "NovaPay Technologies Ltd.",
  merchantNo: "2036394913033269248",
  regNo: "2345888888",
  bizRegNo: "2036394913033269248",
  bizRegExpiry: "2027-01-23 · 长期有效",
  incorpDate: "2021-03-18",
  jurisdiction: "🇰🇾 开曼群岛",
  nameCn: "诺华支付科技有限公司",
  nameEn: "NovaPay Technologies Ltd.",
  capital: "1,000,000.00 USD",
  employees: "11–50",
  regAddr: "George Town, 802 West Bay Road",
  regZip: "KY1-1205",
  bizAddr: "George Town, 802 West Bay Road",
  bizZip: "KY1-1205",
  hasParent: "否",
  ci: "Certificate_of_Incorporation.pdf",
  aoa: "Articles_of_Association.pdf",
  regCountry: "开曼群岛",
  onboarded: "2025-02-10",
  officer: "Sarah Chen",
};

export interface PersonField { field: string; legal: string; director: string; ubo: string; req?: boolean; link?: boolean; }
export const personnel: PersonField[] = [
  { field: "国籍", legal: "🇰🇾 开曼群岛", director: "🇨🇦 加拿大", ubo: "🇨🇳 中国", req: true },
  { field: "证件类型", legal: "护照", director: "护照", ubo: "护照", req: true },
  { field: "证件照片", legal: "passport_01.jpg", director: "passport_02.jpg", ubo: "passport_03.jpg", req: true, link: true },
  { field: "姓名(中文)", legal: "陈伟", director: "林明", ubo: "王启明", req: true },
  { field: "姓名(英文)", legal: "Wei Chen", director: "Ming Lin", ubo: "Qiming Wang", req: true },
  { field: "出生日期", legal: "1982-04-11", director: "1979-09-23", ubo: "1975-12-02", req: true },
  { field: "有效证件号码", legal: "K33090888", director: "C44120998", ubo: "G55890012", req: true },
  { field: "证件有效期", legal: "2031-04-10", director: "2029-09-22", ubo: "2028-12-01", req: true },
  { field: "居住地", legal: "Cayman Islands", director: "Toronto, CA", ubo: "Shanghai, CN", req: true },
  { field: "邮政编码", legal: "KY1-1205", director: "M5H 2N2", ubo: "200120", req: true },
  { field: "授权书", legal: "—", director: "—", ubo: "POA_ubo.pdf", link: true },
  { field: "持股比例", legal: "—", director: "—", ubo: "62%", req: true },
  { field: "人脸识别", legal: "已通过", director: "已通过", ubo: "待邀请", req: true },
];

// 配置 · 手续费配置
export interface DepositFee { asset: string; chain: string; rate: string; min: string; enabled: boolean; }
export const depositFees: DepositFee[] = [
  { asset: "USDT", chain: "ERC-20", rate: "0.30%", min: "1.00 USDT", enabled: true },
  { asset: "USDT", chain: "TRC-20", rate: "0.10%", min: "0.50 USDT", enabled: true },
  { asset: "ETH", chain: "ERC-20", rate: "0.25%", min: "0.0005 ETH", enabled: true },
  { asset: "BTC", chain: "Bitcoin", rate: "0.20%", min: "0.00005 BTC", enabled: false },
];
export interface WithdrawFee { asset: string; chain: string; fee: string; dailyCap: string; enabled: boolean; }
export const withdrawFees: WithdrawFee[] = [
  { asset: "USDT", chain: "ERC-20", fee: "15.00 USDT", dailyCap: "CAD 50,000", enabled: true },
  { asset: "USDT", chain: "TRC-20", fee: "1.00 USDT", dailyCap: "CAD 50,000", enabled: true },
  { asset: "ETH", chain: "ERC-20", fee: "0.0020 ETH", dailyCap: "CAD 30,000", enabled: true },
  { asset: "BTC", chain: "Bitcoin", fee: "0.0004 BTC", dailyCap: "CAD 30,000", enabled: false },
];
export interface SpreadRow { pair: string; spread: string; approvalCap: string; effective: string; }
export const exchangeSpreads: SpreadRow[] = [
  { pair: "USDT / CAD", spread: "50 bps", approvalCap: "100 bps", effective: "生效中" },
  { pair: "BTC / CAD", spread: "80 bps", approvalCap: "150 bps", effective: "生效中" },
  { pair: "ETH / USDT", spread: "60 bps", approvalCap: "120 bps", effective: "生效中" },
  { pair: "BTC / USDT", spread: "55 bps", approvalCap: "120 bps", effective: "待审批" },
];

// 提币地址
export interface WithdrawAddr { address: string; chain: string; label: string; kyw: number; added: string; status: string; statusTone: Tone; }
export const withdrawAddrs: WithdrawAddr[] = [
  { address: "0x9f2a3b…d7E1", chain: "ERC-20", label: "热钱包-运营", kyw: 86, added: "2025-03-02", status: "受限", statusTone: "amber" },
  { address: "bc1q8s…8k4d", chain: "Bitcoin", label: "冷钱包-储备", kyw: 41, added: "2025-04-18", status: "正常", statusTone: "green" },
  { address: "TPa3Lk…Lm9V", chain: "TRC-20", label: "结算地址", kyw: 28, added: "2025-06-09", status: "正常", statusTone: "green" },
  { address: "0x4c71d…9A2f", chain: "ERC-20", label: "备用地址", kyw: 73, added: "2026-01-22", status: "待复核", statusTone: "blue" },
];

// 账户状态 · 冻结历史
export interface StatusEvent { time: string; action: string; tone: Tone; by: string; detail: string; }
export const accountStatus = { current: "受限 · 部分冻结", tone: "amber" as Tone, since: "2026-06-11", limit: "CAD 50,000 / 日" };
export const freezeHistory: StatusEvent[] = [
  { time: "2026-06-11 11:05", action: "部分冻结", tone: "red", by: "系统", detail: "DEP-20260611-001 命中混币器关联,冻结相关资金" },
  { time: "2026-05-21 10:02", action: "标记受限", tone: "amber", by: "Sarah Chen", detail: "CRR 升至高风险,限制单日额度" },
  { time: "2025-02-10 09:30", action: "正常运营", tone: "green", by: "系统", detail: "KYC 通过,账户激活" },
];

// ── 订单管理 ──
export type OrderType = "充值" | "提现" | "兑换" | "A2A";
export interface Order {
  id: string; type: OrderType; merchant: string; asset: string;
  amount: string; cad: string; rule: string; risk: number;
  status: string; statusTone: Tone; assignee: string; submitted: string;
  slaText: string; slaPct: number;
}
export const orders: Order[] = [
  { id: "DEP-20260611-001", type: "充值", merchant: "NovaPay Technologies Ltd.", asset: "USDT", amount: "8,200 USDT", cad: "CAD 8,200", rule: "混币器关联", risk: 91, status: "已冻结", statusTone: "red", assignee: "Sarah Chen", submitted: "06-11 09:34", slaText: "已处置", slaPct: 100 },
  { id: "WD-20260611-058", type: "提现", merchant: "BlockTrade Corp.", asset: "ETH", amount: "5.2 ETH", cad: "CAD 21,400", rule: "KYW 超阈值", risk: 64, status: "待审核", statusTone: "amber", assignee: "—", submitted: "06-11 08:54", slaText: "剩 36h", slaPct: 25 },
  { id: "EXC-20260611-112", type: "兑换", merchant: "Skyline Pay Inc.", asset: "USDT→CAD", amount: "9,400 USDT", cad: "CAD 9,400", rule: "快进快出", risk: 52, status: "审核中", statusTone: "blue", assignee: "Mike Lin", submitted: "06-11 07:20", slaText: "剩 28h", slaPct: 38 },
  { id: "DEP-20260610-204", type: "充值", merchant: "Eastwind Exchange", asset: "USDT", amount: "3,150 USDT", cad: "CAD 3,150", rule: "高频拆分", risk: 33, status: "暂缓入账", statusTone: "amber", assignee: "Mike Lin", submitted: "06-10 21:14", slaText: "剩 12h", slaPct: 62 },
  { id: "A2A-20260610-077", type: "A2A", merchant: "Vega Settlements", asset: "USDT", amount: "40,000 USDT", cad: "CAD 40,000", rule: "大额账户互转", risk: 61, status: "待补充材料", statusTone: "blue", assignee: "Sarah Chen", submitted: "06-10 16:40", slaText: "待商户", slaPct: 50 },
  { id: "WD-20260610-021", type: "提现", merchant: "Meridian FX Ltd.", asset: "USDT", amount: "33,000 USDT", cad: "CAD 33,000", rule: "制裁规避", risk: 77, status: "已拒绝", statusTone: "red", assignee: "David Wu", submitted: "06-10 06:25", slaText: "已处置", slaPct: 100 },
  { id: "DEP-20260609-188", type: "充值", merchant: "Lumen Capital", asset: "BTC", amount: "0.32 BTC", cad: "CAD 16,800", rule: "新商户首充", risk: 28, status: "已通过", statusTone: "green", assignee: "Mike Lin", submitted: "06-09 13:05", slaText: "已处置", slaPct: 100 },
  { id: "EXC-20260609-140", type: "兑换", merchant: "Helios Digital", asset: "BTC→USDT", amount: "1.1 BTC", cad: "CAD 57,800", rule: "高风险地址", risk: 73, status: "待审核", statusTone: "amber", assignee: "—", submitted: "06-09 11:00", slaText: "剩 20h", slaPct: 45 },
  { id: "DEP-20260608-301", type: "充值", merchant: "Orbit Remit", asset: "USDT", amount: "1,200 USDT", cad: "CAD 1,200", rule: "—", risk: 18, status: "已通过", statusTone: "green", assignee: "系统", submitted: "06-08 07:30", slaText: "自动放行", slaPct: 100 },
  { id: "A2A-20260608-066", type: "A2A", merchant: "Castor Pay", asset: "USDT", amount: "12,500 USDT", cad: "CAD 12,500", rule: "账户互转", risk: 55, status: "审核中", statusTone: "blue", assignee: "Sarah Chen", submitted: "06-08 06:42", slaText: "剩 30h", slaPct: 33 },
  { id: "WD-20260607-099", type: "提现", merchant: "Tundra Exchange", asset: "ETH", amount: "2.0 ETH", cad: "CAD 8,200", rule: "—", risk: 31, status: "已通过", statusTone: "green", assignee: "Mike Lin", submitted: "06-07 09:18", slaText: "已处置", slaPct: 100 },
  { id: "EXC-20260607-055", type: "兑换", merchant: "Pioneer FX", asset: "USDT→CAD", amount: "60,000 USDT", cad: "CAD 60,000", rule: "结构化", risk: 84, status: "暂缓入账", statusTone: "amber", assignee: "David Wu", submitted: "06-07 17:33", slaText: "剩 8h", slaPct: 78 },
];
export const orderTimelineSeed = [
  { time: "06-11 09:34", text: "规则命中暂缓 · 混币器关联+大额", by: "系统" },
  { time: "06-11 10:12", text: "认领工单", by: "Sarah Chen" },
  { time: "06-11 11:05", text: "驳回并冻结 · 链上溯源命中混币器", by: "Sarah Chen" },
];
