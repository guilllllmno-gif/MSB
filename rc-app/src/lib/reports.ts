// 报告报送(FINTRAC 合规上报)· MLRO 工作台数据 + 报告状态机 + 报告类型。
// 报告来源:告警研判(转合规)/ 事后监控(转报送)/ 团伙识别(转案件)/ 制裁筛查 / 系统自动(LVCTR)。
// 状态 / MLRO 经手 / 事件存 store.ts 的 reportStore(内存)。
import { Send, CheckCircle2, RotateCcw, Ban, FileCheck2, Inbox } from "lucide-react";
import type { Tone, Person } from "./data";

// ── FINTRAC 报告类型(加密 MSB 口径)──
export type RType = "STR" | "LVCTR" | "TPR";
export const RTYPE: Record<RType, { label: string; full: string; tone: Tone; deadline: string }> = {
  STR: { label: "STR", full: "可疑交易报告", tone: "red", deadline: "确定可疑后 30 日内" },
  LVCTR: { label: "LVCTR", full: "大额虚拟货币交易报告", tone: "blue", deadline: "交易后 5 个工作日内" },
  TPR: { label: "TPR", full: "恐怖分子 / 制裁财产报告", tone: "violet", deadline: "立即 · 无延迟" },
};

// ── 报告状态机:草稿 →(提交)→ 待MLRO复核 →(复核通过)→ 待报送 →(报送)→ 已报送 →(回执)→ FINTRAC已接收 ──
export type RState = "draft" | "review" | "queued" | "filed" | "ack" | "returned" | "void";
export const RSTATE: Record<RState, { label: string; tone: Tone; active: boolean }> = {
  draft: { label: "草稿", tone: "grey", active: true },
  review: { label: "待MLRO复核", tone: "amber", active: true },
  queued: { label: "待报送", tone: "blue", active: true },
  filed: { label: "已报送·待回执", tone: "violet", active: true },
  ack: { label: "FINTRAC已接收", tone: "green", active: false },
  returned: { label: "被退回·需补正", tone: "red", active: true },
  void: { label: "已作废", tone: "grey", active: false },
};

// 状态门控动作(MLRO 复核 / 报送 / 回执)
export interface RAction { k: string; label: string; to: RState; icon: typeof Send; tip: string; tone?: Tone }
export const RFLOW: Record<RState, RAction[]> = {
  draft: [
    { k: "submit", label: "提交 MLRO 复核", to: "review", icon: Send, tip: "起草完成 · 提交合规官复核" },
    { k: "void", label: "作废", to: "void", icon: Ban, tip: "无需报送 · 作废留档", tone: "grey" },
  ],
  review: [
    { k: "approve", label: "复核通过 · 入报送队列", to: "queued", icon: CheckCircle2, tip: "MLRO 签发 · 进入报送队列", tone: "blue" },
    { k: "return", label: "退回起草人", to: "draft", icon: RotateCcw, tip: "信息不足 · 退回补充", tone: "amber" },
    { k: "void", label: "作废", to: "void", icon: Ban, tip: "嫌疑排除 · 作废留档", tone: "grey" },
  ],
  queued: [
    { k: "file", label: "标记已报送 FINTRAC", to: "filed", icon: FileCheck2, tip: "已通过 FINTRAC 电子报送", tone: "violet" },
  ],
  filed: [
    { k: "ack", label: "登记 FINTRAC 回执", to: "ack", icon: Inbox, tip: "已收到 FINTRAC 接收回执", tone: "green" },
    { k: "returned", label: "登记退回 · 需补正", to: "returned", icon: RotateCcw, tip: "FINTRAC 退回 · 字段需补正", tone: "red" },
  ],
  returned: [
    { k: "resubmit", label: "补正后重新复核", to: "review", icon: Send, tip: "补正完成 · 重新提交复核", tone: "amber" },
    { k: "void", label: "作废", to: "void", icon: Ban, tip: "作废留档", tone: "grey" },
  ],
  ack: [],
  void: [],
};

// FINTRAC 报告必填字段清单(复核重点)— 按类型自适应
export const RFIELDS: Record<RType, { label: string; sub: string }[]> = {
  STR: [
    { label: "报告主体信息", sub: "报送机构 + 责任合规官" },
    { label: "交易明细", sub: "逐笔金额 / 时间 / 钱包地址 / 链" },
    { label: "可疑理由叙述", sub: "为何构成「合理怀疑」(自由文本)" },
    { label: "涉事人 / 受益所有人", sub: "KYC / KYB / UBO 信息" },
    { label: "资金处置", sub: "冻结 / 放行 / 退回 / 已出账" },
  ],
  LVCTR: [
    { label: "报告主体信息", sub: "报送机构 + 责任人" },
    { label: "大额交易明细", sub: "≥ CAD 10,000 虚拟货币交易逐笔" },
    { label: "交易对手信息", sub: "发起人 / 收款人 / 第三方" },
    { label: "虚拟货币类型与价值", sub: "币种 / 数量 / CAD 折算" },
  ],
  TPR: [
    { label: "报告主体信息", sub: "报送机构 + 责任合规官" },
    { label: "财产明细", sub: "受控资产 / 钱包 / 金额" },
    { label: "制裁 / 名单依据", sub: "OFAC / UN / FINTRAC 列名" },
    { label: "处置措施", sub: "冻结 / 阻断 / 上报执法" },
  ],
};

export interface Report {
  id: string; type: RType; status: RState;
  src: string; srcId?: string; to?: string; // 来源 + 关联记录(可跳转)
  subject: string; sub: string;             // 涉事主体
  amount: string; summary: string;          // 金额 + 报送摘要
  officer: Person; mlro: Person | null;     // 起草人 + MLRO
  due: { text: string; tone: Tone };        // 报送时限剩余
  filedAt?: string;                          // 报送时间(已报送 / 已接收)
  ref?: string;                              // FINTRAC 受理回执号
}

const JL: Person = { i: "JL", n: "James Liu", c: "var(--brand)" };
const SC: Person = { i: "SC", n: "Sarah Chen", c: "var(--violet)" };
const DW: Person = { i: "DW", n: "David Wu", c: "#0ea5e9" };
const EZ: Person = { i: "EZ", n: "Emma Zhang", c: "var(--success)" }; // MLRO
const SYS: Person = { i: "⚙", n: "系统自动", c: "var(--chip-fg)" };
export const MLRO: Person = EZ;

// 静态报告样本。STR 一律由案件管理派生(案件 = STR 唯一发起点,见 page);
// 此处只保留 非可疑判定 的客观报告:LVCTR(系统阈值)/ TPR(制裁即时,历史已接收)。
export const REPORTS: Report[] = [
  { id: "TPR-20260313-0021", type: "TPR", status: "ack", src: "制裁筛查", srcId: "ALT-50218", to: "/alert?id=ALT-50218",
    subject: "OffshoreFX Ltd. · 0x7F4a…9c21", sub: "提现 · OFAC SDN 直接命中", amount: "CAD 11,900", summary: "收款地址直接命中 OFAC SDN 制裁名单,资金已自动冻结,按制裁财产立即上报(无需可疑判定)。",
    officer: DW, mlro: EZ, due: { text: "已报送", tone: "grey" }, filedAt: "2026-03-13 07:05", ref: "FINTRAC #TPR-CA-2603-10882" },
  { id: "LVCTR-20260619-0143", type: "LVCTR", status: "queued", src: "系统自动", subject: "大额虚拟货币交易批次", sub: "06-18 当日 · 12 笔 ≥ CAD 10,000",
    amount: "CAD 207,300", summary: "系统自动归集当日 ≥ CAD 10,000 虚拟货币交易,客观阈值触发,无需可疑判定,批量报送。",
    officer: SYS, mlro: null, due: { text: "剩 2 工作日", tone: "amber" } },
  { id: "LVCTR-20260616-0138", type: "LVCTR", status: "ack", src: "系统自动", subject: "大额虚拟货币交易批次", sub: "06-15 当日 · 9 笔 ≥ CAD 10,000",
    amount: "CAD 181,500", summary: "当日大额虚拟货币交易批量报送,已获 FINTRAC 接收回执。",
    officer: SYS, mlro: null, due: { text: "已报送", tone: "grey" }, filedAt: "2026-06-16 10:05", ref: "FINTRAC #LVCTR-CA-2206-55190" },
];

export const reportOf = (id?: string) => REPORTS.find((r) => r.id === id);

// ── 详情页:进度条按类型自适应(STR 走人工研判链;LVCTR 走客观阈值链)──
export const RSTEPS: Record<RType, [string, string, string, string, string]> = {
  STR: ["草稿", "分析师复核", "待 MLRO 签发", "已报送", "FINTRAC 受理"],
  LVCTR: ["阈值触发", "自动归集", "待报送", "已报送", "FINTRAC 受理"],
  TPR: ["制裁命中", "资产冻结", "待报送", "已报送", "FINTRAC 受理"],
};
// 状态 → 当前步(done = idx < cur,current = idx === cur)
export const reportStep = (s: RState): number =>
  s === "draft" ? 0 : s === "review" || s === "queued" || s === "returned" ? 2 : s === "filed" ? 3 : s === "ack" ? 4 : 0;

// ── 详情正文(按类型自适应)──
export interface PvRow { k: string; v: string }                       // FINTRAC 报文键值
export interface LvctrTxn { id: string; party: string; kind: string; time: string; amount: string } // LVCTR 批次逐笔

// ── 真实 FINTRAC STR(可疑交易报告)报文结构(加密 MSB 口径)──
// 对标 FINTRAC 升级版 STR / F2-R:分部填报 Part A 报告与机构 → B 交易(含虚拟货币明细)
// → C 账户 → D/E 涉事主体 → F 可疑理由叙述 → G 已采取措施。
export interface KV { k: string; en: string; v: string; flag?: Tone } // 字段:中文标签 / 英文标签 / 值 / 风险高亮
export interface StrTxn { ref: string; dir: "存入" | "提出"; dirEn: string; fields: KV[] } // 单笔交易(虚拟货币)
export interface StrParty { role: string; roleEn: string; kind: "实体" | "个人"; name: string; fields: KV[] } // 涉事主体
export interface StrDoc {
  reportRef: string;                  // 报告参考号
  header: KV[];                       // Part A:报告 + 报送机构
  txns: StrTxn[];                     // Part B:虚拟货币交易明细
  account: KV[];                      // Part C:账户 / 处置
  parties: StrParty[];                // Part D/E:涉事主体(实体 + UBO)
  grounds: string;                    // Part F:可疑理由叙述(合理怀疑)
  action: KV[];                       // Part G:已采取措施
}

export interface ReportDetail {
  reason?: { src: string; body: string; tags: { label: string; tone: Tone }[] }; // STR / TPR:可疑/依据叙述 + 风险标签
  batch?: { count: number; shown: number; total: string; window: string; threshold: string; trigger: string; txns: LvctrTxn[]; note: string }; // LVCTR:批次归集
  preview: { title: string; format: string; rows: PvRow[] };          // FINTRAC 报文预览(LVCTR/TPR 用简版键值)
  strDoc?: StrDoc;                    // STR 专用:完整 FINTRAC 分部报文
}

// 报文主体(机构信息),全站统一
const REPORTING_ENTITY = "Future Pay CA (MSB# M2024xxxx)";

export const RDETAIL: Record<string, ReportDetail> = {
  // STR hero(案件 CASE-20260318-001 派生)—— 可疑理由由案件研判定性、人工撰写
  "STR-CASE-20260318-001": {
    reason: {
      src: "由案件研判定性 · 人工撰写",
      body: "主体账户于 2026-03-01 接收来自混币器 Tornado Cash 关联地址的 0.21 BTC,经单跳中转后入金平台并即时兑换为 CAD 8,200,到账 14 分钟内发起全额提现至外部地址,符合分层(layering)与过水特征。结合主体注册仅 3 个月、本次金额偏离历史基线 7 倍,判定为可疑交易,依据 PCMLTFA 建议作为 STR 上报。",
      tags: [{ label: "混币器接触", tone: "red" }, { label: "过水模式", tone: "red" }, { label: "基线偏离 ×7", tone: "amber" }, { label: "疑似团伙 G-2026-014", tone: "violet" }],
    },
    preview: {
      title: "Suspicious Transaction Report (STR)", format: "FINTRAC F2-R / JSON",
      rows: [
        { k: "Report Type", v: "STR" }, { k: "Reporting Entity", v: REPORTING_ENTITY },
        { k: "Subject", v: "NovaPay Technologies Ltd." }, { k: "Transaction Date", v: "2026-03-01" },
        { k: "Amount (CAD)", v: "8,200.00" }, { k: "Virtual Currency", v: "0.21 BTC → USDT" },
        { k: "Suspicion Grounds", v: "Mixer exposure (Tornado Cash); layering; rapid pass-through" },
        { k: "Related Case", v: "CASE-20260318-001" },
      ],
    },
    strDoc: {
      reportRef: "STR-2026-0312",
      header: [
        { k: "报告类型", en: "Report Type", v: "STR — Suspicious Transaction Report" },
        { k: "报送机构", en: "Reporting Entity", v: "Future Pay CA Inc." },
        { k: "MSB 注册号", en: "FINTRAC MSB Registration", v: "M2024xxxx" },
        { k: "机构类别", en: "RE Sector", v: "Money Services Business — Dealing in Virtual Currency" },
        { k: "报告参考号", en: "Report Reference", v: "STR-2026-0312" },
        { k: "责任合规官", en: "Compliance Officer (MLRO)", v: "David Wu · +1 604-555-0142" },
        { k: "报送时限", en: "Reporting Deadline", v: "确定可疑后 30 日内 · 剩 6 天", flag: "amber" },
      ],
      txns: [
        { ref: "TXN-1 · DEP-20260315-001", dir: "存入", dirEn: "Incoming / Deposit", fields: [
          { k: "交易日期时间", en: "Date & Time (UTC)", v: "2026-03-01 09:30:15" },
          { k: "交易方式", en: "Method", v: "线上 · 虚拟货币转入(非面对面)" },
          { k: "虚拟货币类型", en: "Virtual Currency", v: "USDT (ERC-20)" },
          { k: "虚拟货币数量", en: "VC Amount", v: "8,180.00 USDT" },
          { k: "CAD 折算", en: "CAD Equivalent", v: "8,200.00" },
          { k: "折算汇率", en: "Exchange Rate", v: "1 USDT = 1.0024 CAD (2026-03-01)" },
          { k: "发送地址", en: "Sending Address", v: "0x5078…Ec8c · Tornado Cash 关联(溯源 92%)", flag: "red" },
          { k: "接收地址", en: "Receiving Address", v: "0x91Ad…77F2(本机构托管钱包)" },
          { k: "交易哈希", en: "Transaction Hash", v: "0x9b3c…a01f" },
          { k: "确认数", en: "Confirmations", v: "32 / 32" },
        ] },
        { ref: "TXN-2 · WD-20260315-007", dir: "提出", dirEn: "Outgoing / Withdrawal", fields: [
          { k: "交易日期时间", en: "Date & Time (UTC)", v: "2026-03-01 09:44:01(入金后 14 分钟)", flag: "amber" },
          { k: "交易方式", en: "Method", v: "线上 · 虚拟货币转出(非面对面)" },
          { k: "虚拟货币类型", en: "Virtual Currency", v: "USDT (ERC-20)" },
          { k: "虚拟货币数量", en: "VC Amount", v: "8,150.00 USDT" },
          { k: "CAD 折算", en: "CAD Equivalent", v: "8,170.00" },
          { k: "发送地址", en: "Sending Address", v: "0x91Ad…77F2(本机构托管钱包)" },
          { k: "接收地址", en: "Receiving Address", v: "bc1q…7h2k(外部非托管地址)", flag: "amber" },
          { k: "交易哈希", en: "Transaction Hash", v: "0x4f22…b80c" },
        ] },
      ],
      account: [
        { k: "账户主体", en: "Account Holder", v: "NovaPay Technologies Ltd." },
        { k: "账户编号", en: "Account Number", v: "ACC-NP-88421" },
        { k: "账户类型", en: "Account Type", v: "企业 / 商户" },
        { k: "开户日期", en: "Account Opened", v: "2026-02-24(交易前 5 天)", flag: "amber" },
        { k: "账户状态", en: "Account Status", v: "已限制 · 提现冻结" },
      ],
      parties: [
        { role: "交易实施主体", roleEn: "Conducting Entity", kind: "实体", name: "NovaPay Technologies Ltd.", fields: [
          { k: "实体类型", en: "Entity Type", v: "公司(Corporation)" },
          { k: "注册号 / 辖区", en: "Incorporation / Jurisdiction", v: "US-DE-7741920 · 美国(特拉华)" },
          { k: "经营性质", en: "Nature of Business", v: "支付服务 / VASP" },
          { k: "注册地址", en: "Registered Address", v: "1209 Orange St, Wilmington, DE 19801, US" },
          { k: "身份核验", en: "Identification", v: "KYB 未完成", flag: "red" },
          { k: "与机构关系", en: "Relationship to RE", v: "客户(商户)" },
        ] },
        { role: "受益所有人", roleEn: "Beneficial Owner (>25%)", kind: "个人", name: "Andrei Petrov", fields: [
          { k: "出生日期", en: "Date of Birth", v: "1989-07-12" },
          { k: "国籍", en: "Nationality", v: "塞浦路斯 / 俄罗斯(双重)" },
          { k: "持股", en: "Ownership", v: "100%(唯一 UBO)" },
          { k: "身份核验", en: "Identification", v: "护照(部分核验)", flag: "amber" },
          { k: "PEP", en: "PEP Status", v: "否" },
        ] },
      ],
      grounds: "本机构于 2026-03-01 监测到客户 NovaPay Technologies Ltd.(开户仅 5 日)托管钱包 0x91Ad…77F2 接收来自地址 0x5078…Ec8c 的 8,180 USDT;链上溯源显示该发送地址与混币器 Tornado Cash 高度关联(命中度 92%)。资金到账后 14 分钟内即被全额(8,150 USDT)提现至外部非托管地址 bc1q…7h2k,资金在本机构停留极短、无实际业务用途,呈典型分层(layering)与过水(pass-through)特征。本笔金额较该客户历史基线偏离约 7 倍,且 KYB 尚未完成、UBO 身份仅部分核验。综合混币器接触、快进快出、主体新近开户及关联团伙线索(疑似团伙 G-2026-014),本机构形成「合理怀疑」,依据 PCMLTFA 第 7 条作为可疑交易报告(STR)报送 FINTRAC。",
      action: [
        { k: "账户措施", en: "Account Action", v: "已限制提现 · 待二次核验" },
        { k: "资金处置", en: "Funds Disposition", v: "下游冻结请求已发出(部分可追溯)", flag: "amber" },
        { k: "内部升级", en: "Internal Escalation", v: "案件 CASE-20260318-001 · 关联团伙 G-2026-014" },
        { k: "报送机关", en: "Reported To", v: "FINTRAC(STR)· 抄送内部 MLRO 存档" },
      ],
    },
  },
  // LVCTR(系统自动归集批次)—— 客观阈值,无需可疑判定
  "LVCTR-20260619-0143": {
    batch: {
      count: 12, shown: 6, total: "CAD 207,300", window: "2026-06-18 当日", threshold: "≥ CAD 10,000", trigger: "系统自动 · 阈值归集",
      txns: [
        { id: "TXN-…0142", party: "SwiftX Ltd", kind: "加密兑法币", time: "06-18 09:12", amount: "18,500" },
        { id: "TXN-…0145", party: "Orbit Ltd", kind: "法币入金", time: "06-18 10:30", amount: "25,000" },
        { id: "TXN-…0151", party: "Lin W.", kind: "日累计提现", time: "06-18 11:48", amount: "11,200" },
        { id: "TXN-…0160", party: "Apex Holdings", kind: "加密兑法币", time: "06-18 13:05", amount: "14,800" },
        { id: "TXN-…0166", party: "NovaPay Tech.", kind: "稳定币兑换", time: "06-18 15:22", amount: "10,400" },
        { id: "TXN-…0171", party: "Kraken-U", kind: "法币入金", time: "06-18 16:40", amount: "32,100" },
      ],
      note: "每笔均独立达到或日累计达到 CAD 10,000 阈值。批量报送时每笔生成一条 LVCTR 记录。",
    },
    preview: {
      title: "Large Virtual Currency Transaction Report", format: "FINTRAC LVCTR · batch",
      rows: [
        { k: "Report Type", v: "LVCTR (batch)" }, { k: "Batch Date", v: "2026-06-18" },
        { k: "Reporting Entity", v: REPORTING_ENTITY }, { k: "Transactions", v: "12" },
        { k: "Batch Total (CAD)", v: "207,300.00" }, { k: "Threshold", v: "≥ CAD 10,000 (per txn / daily aggregate)" },
        { k: "Trigger", v: "Automated threshold aggregation (R-AMT-01)" },
      ],
    },
  },
  // TPR(制裁财产报告)—— 制裁命中即时上报,非可疑判定
  "TPR-20260313-0021": {
    reason: {
      src: "制裁筛查命中 · 法定即时上报",
      body: "提现收款地址 0x7F4a…9c21 直接命中 OFAC SDN 制裁名单(实体清单),交易已被实时拦截、资金自动冻结。按 PCMLTFA 及制裁条例属受控财产,须立即(无延迟)上报 FINTRAC 并阻断,无需可疑判定。",
      tags: [{ label: "OFAC SDN 直接命中", tone: "red" }, { label: "资金已冻结", tone: "violet" }, { label: "法定即时上报", tone: "amber" }],
    },
    preview: {
      title: "Terrorist Property / Sanctions Report (TPR)", format: "FINTRAC TPR · immediate",
      rows: [
        { k: "Report Type", v: "TPR" }, { k: "Reporting Entity", v: REPORTING_ENTITY },
        { k: "Subject", v: "OffshoreFX Ltd." }, { k: "Controlled Address", v: "0x7F4a…9c21" },
        { k: "Sanctions List", v: "OFAC SDN" }, { k: "Amount Frozen (CAD)", v: "11,900.00" },
        { k: "Action", v: "Blocked + frozen + reported to law enforcement" },
      ],
    },
  },
};

// 取详情:命中样本则用 RDETAIL,否则按类型兜底合成(案件派生 STR 用 summary 当叙述)
export function reportDetail(r: Report): ReportDetail {
  if (RDETAIL[r.id]) return RDETAIL[r.id];
  if (r.type === "LVCTR") {
    return {
      batch: { count: 1, shown: 1, total: r.amount, window: r.sub, threshold: "≥ CAD 10,000", trigger: "系统自动 · 阈值触发", txns: [{ id: r.srcId || r.id, party: r.subject, kind: "大额虚拟货币交易", time: r.sub, amount: r.amount.replace(/[^0-9.,]/g, "") }], note: "达到 CAD 10,000 客观阈值,系统自动生成 LVCTR 记录。" },
      preview: { title: "Large Virtual Currency Transaction Report", format: "FINTRAC LVCTR", rows: [{ k: "Report Type", v: "LVCTR" }, { k: "Reporting Entity", v: REPORTING_ENTITY }, { k: "Subject", v: r.subject }, { k: "Amount (CAD)", v: r.amount.replace(/[^0-9.,]/g, "") }] },
    };
  }
  const tone: Tone = r.type === "TPR" ? "violet" : "red";
  return {
    reason: { src: r.type === "TPR" ? "制裁筛查命中 · 法定即时上报" : "由案件研判定性 · 人工撰写", body: r.summary, tags: [{ label: r.sub, tone }] },
    preview: { title: r.type === "TPR" ? "Sanctions / Terrorist Property Report (TPR)" : "Suspicious Transaction Report (STR)", format: r.type === "TPR" ? "FINTRAC TPR" : "FINTRAC F2-R / JSON", rows: [{ k: "Report Type", v: r.type }, { k: "Reporting Entity", v: REPORTING_ENTITY }, { k: "Subject", v: r.subject }, { k: "Amount (CAD)", v: r.amount.replace(/[^0-9.,]/g, "") }, ...(r.srcId ? [{ k: "Source", v: r.srcId }] : [])] },
    strDoc: r.type === "STR" ? synthStrDoc(r) : undefined,
  };
}

// 兜底:为任意 STR(案件派生 / 手动)按报告字段合成一份 FINTRAC 分部报文,保证每条 STR 都有结构化预览
const amtCAD = (s: string) => s.replace(/[^0-9.,]/g, "");
function synthStrDoc(r: Report): StrDoc {
  return {
    reportRef: r.id,
    header: [
      { k: "报告类型", en: "Report Type", v: "STR — Suspicious Transaction Report" },
      { k: "报送机构", en: "Reporting Entity", v: "Future Pay CA Inc." },
      { k: "MSB 注册号", en: "FINTRAC MSB Registration", v: "M2024xxxx" },
      { k: "机构类别", en: "RE Sector", v: "Money Services Business — Dealing in Virtual Currency" },
      { k: "报告参考号", en: "Report Reference", v: r.id },
      { k: "责任合规官", en: "Compliance Officer (MLRO)", v: "David Wu · +1 604-555-0142" },
      ...(r.srcId ? [{ k: "来源案件", en: "Source Case", v: r.srcId }] : []),
    ],
    txns: [
      { ref: r.srcId || "TXN-1", dir: "存入", dirEn: "Incoming / Deposit", fields: [
        { k: "交易方式", en: "Method", v: "线上 · 虚拟货币(非面对面)" },
        { k: "虚拟货币类型", en: "Virtual Currency", v: "USDT / BTC(见明细)" },
        { k: "CAD 折算", en: "CAD Equivalent", v: amtCAD(r.amount) },
        { k: "对手地址", en: "Counterparty Address", v: "见案件链上溯源" },
      ] },
    ],
    account: [
      { k: "账户主体", en: "Account Holder", v: r.subject },
      { k: "账户类型", en: "Account Type", v: "企业 / 商户" },
      { k: "账户状态", en: "Account Status", v: "调查中 · 视结论限制" },
    ],
    parties: [
      { role: "交易实施主体", roleEn: "Conducting Entity", kind: "实体", name: r.subject, fields: [
        { k: "经营性质", en: "Nature of Business", v: "支付服务 / VASP" },
        { k: "与机构关系", en: "Relationship to RE", v: "客户" },
        { k: "身份核验", en: "Identification", v: "见 KYC / KYB 档案" },
      ] },
    ],
    grounds: r.summary,
    action: [
      { k: "内部升级", en: "Internal Escalation", v: r.srcId ? `案件 ${r.srcId}` : "案件研判" },
      { k: "报送机关", en: "Reported To", v: "FINTRAC(STR)" },
    ],
  };
}

// 案件 → STR 报告状态映射(案件管理 = STR 唯一发起点;在 ReportFiling 实时派生)。
export const caseStrState = (cs: string): RState =>
  cs === "str_draft" ? "draft" : cs === "mlro" ? "review" : cs === "queued" ? "queued" : cs === "filed" ? "filed" : "ack";