# FuturePayCA MSB — Full System Lifecycle

> Source: Figma design file `bvmuDTTkQBW3U7NNsUbvPJ` · 81 screens analysed
> Roles: 客户代理 → L1分析师 → L2审核员 → L3/合规管理员

---

## Overview

FuturePayCA MSB is a compliance operations platform for a Canadian Money Services Business (MSB) regulated under **FINTRAC**. The system manages the full lifecycle of:

1. **Merchant onboarding** — KYC/KYB review and approval
2. **Wallet due diligence** — KYW screening and threshold management
3. **Transaction monitoring** — real-time rule evaluation and alert handling
4. **Order review** — deposit, withdrawal, exchange, A2A approval
5. **Regulatory reporting** — STR and LCTR filing to FINTRAC
6. **Ongoing compliance** — periodic reviews, EDD, account status

---

## System Modules Map

```
┌─────────────────────────────────────────────────────────────┐
│                     FuturePayCA MSB                         │
├──────────────┬──────────────┬──────────────┬───────────────┤
│   合规        │   交易        │   监控        │   财务/报告   │
│  KYC审核     │  事中监控     │  持续监控     │  STR报告      │
│  KYW审核     │  交易警报     │  KYW监控     │  LCTR报告     │
│              │  监控规则     │              │  日记账/结算  │
├──────────────┴──────────────┴──────────────┴───────────────┤
│                      商户管理                                │
│  商户列表 · 基本信息 · 配置 · 提币地址 · 活动日志            │
├──────────────────────────────────────────────────────────────┤
│                      订单管理                                │
│  充值订单 · 兑换订单 · 提现订单 · A2A订单                   │
├──────────────────────────────────────────────────────────────┤
│                      系统配置                                │
│  监控规则 · 阈值配置 · 费率配置 · SLA配置 · 角色权限        │
└──────────────────────────────────────────────────────────────┘
```

---

## Lifecycle 1 — Merchant Onboarding (KYC/KYB)

### Stage 1.1 — Application Submitted
- 客户代理 creates merchant record in system
- Basic info entered: company name, MSO ID, registration country, incorporation date
- KYC status: `待提交`

### Stage 1.2 — KYC Review Initiated
- Case appears in **KYC审核** queue with status `待审核`
- L1分析师 claims (认领) the case
- SLA countdown begins (configurable per risk tier)

### Stage 1.3 — Basic Information Review
**Tab: 基本信息**

Fields reviewed:
- 客户名称 / 客户号
- 公司注册号 / 商业登记证号
- 商业登记证有效期
- 成立日期 / 注册国家地区
- 公司名称中文/英文
- 注册资本 / 员工人数
- 注册地址 / 经营地址
- 公司是否存在母公司

**人员信息 (Personnel — 3 columns):**

| Field | 法定人 | 董事 | 最终受益人 (UBO) |
|---|---|---|---|
| 国籍 | ✓ | ✓ | ✓ |
| 证件类型 | ✓ | ✓ | ✓ |
| 证件照片 | ✓ | ✓ | ✓ |
| 姓名 (中/英) | ✓ | ✓ | ✓ |
| 出生日期 | ✓ | ✓ | ✓ |
| 有效证件号码 | ✓ | ✓ | ✓ |
| 证件有效期 | ✓ | ✓ | ✓ |
| 居住地址 | ✓ | ✓ | ✓ |
| 控股比例 | — | — | ✓ |
| 人员KYC | ✓ | ✓ | ✓ |

Documents: 注册证书 (CI) · 企业章程 (AOA)

### Stage 1.4 — Risk Scoring (CRR)
**Tab: 风险评分**

14 risk indicators, each scored individually. System auto-calculates composite CRR. Manual override possible per line item.

| Indicator | Description |
|---|---|
| 注册国家&地区 | Jurisdiction risk |
| 省份 | Sub-national risk |
| 运营国家&地区 | Operating country |
| 董事/UBO居住地 | Beneficial owner location |
| (预计)付款方/受益人国家 | Expected counterparty countries |
| 成立时间 | Corporate age |
| 证件类型 | ID document risk |
| 产品&服务类型 | Business product risk |
| 企业类型 | Corporate structure |
| 名单扫描 | Sanctions screening result |
| Channel | Acquisition channel |
| IP&Machine | Technical fingerprint |
| 命中规则频率 | Historical rule trigger rate |
| 风险事件 | Past incidents |

**CRR Output:**
- 低风险: 0–39
- 中风险: 40–69
- 高风险: 70–100

### Stage 1.5 — EDD (Enhanced Due Diligence)
**Tab: EDD** — triggered when CRR ≥ threshold or manual flag

5 investigation items:

| Item | Description |
|---|---|
| 加强身份验证 | Third-party identity verification |
| 业务模式验证 | Business model legitimacy |
| IP管理员验证 | IP address and admin identity |
| 10% UBO声明 | Shareholder equity declarations |
| 扩展负面新闻扫描 | Adverse media screening |

Each item: Investigation result (dropdown) · Risk level · Comment · 人员 panel (legal person, director, flags)

EDD decisions: **EDD上报 / EDD批准 / EDD拒绝**

### Stage 1.6 — System Checks
**Tab: 系统检查**

Automated cross-checks:
- Sanctions list matching (OFAC · UN · EU · FINTRAC)
- Historical record retrieval
- Expandable history log per check

### Stage 1.7 — File Management
**Tab: 文件管理**

Two sub-tabs: **KYC** · **交易**

Each file record:
- Thumbnail · File name & size
- 上传原因: 首次提交 / 合规上传 / 请求更新 / 重新提交
- 备注 (editable)
- 上传时间 · 操作人
- Actions: 下载 · 删除

### Stage 1.8 — Decision
**审核决定 modal (L2 makes final call)**

处置决定:
- `入账` — Approve and onboard
- `退款` — Reject and return
- `冻结并报告` — Freeze account and file report

流程操作:
- `请求信息` — Request more materials from merchant
- `退回审核人` — Return case to L1
- `升级至L3` — Escalate to senior compliance

标记为STR toggle — flag as suspicious transaction report

**Resulting KYC statuses:**
`已通过` · `已拒绝` · `待补充材料` · `审核中` · `待审核`

### Stage 1.9 — Post-Approval
- Merchant status set to `正常运营`
- CRR score locked to profile (updateable via 更新CRR action)
- Assigned 合规专员
- Appears in 商户列表 with full profile

---

## Lifecycle 2 — Wallet Due Diligence (KYW)

### Stage 2.1 — Wallet Address Added
- Merchant submits withdrawal wallet address
- Record created: chain · address · label (热钱包-运营 / 冷钱包 etc.) · submission date

### Stage 2.2 — KYW Screening
**Data sources: Chainalysis / Bit2Go KYW API**

Screening result includes:
- Risk score (0–100)
- 暴露分析: mixer exposure %, unknown %, low-risk exchange %, gambling %, high-risk exchange %, compliant source %
- Sanctions flags: 是否检测到直接制裁匹配 (OFAC · UN · EU · FINTRAC)
- 混币器关联 alerts
- 扫描历史记录 (timestamped scan log)

Auto-scan frequency: configurable (hourly / daily / every 3 days / weekly / monthly)
Re-review trigger: wallet score ≥ 15 AND risk level change detected

### Stage 2.3 — KYW Case Review
**KYW审核 queue** — appears as `待审核` case

Case detail tabs:
- **基本信息**: scan result + source of funds documents + wallet address info + merchant info
- **阈值配置**: wallet-level threshold (就低原则 vs merchant-level)
- **活动日志**: all actions recorded

Source of funds documents: uploaded by merchant, downloadable

### Stage 2.4 — Threshold Configuration
**就低原则 (Take-Lower Principle)**

Effective threshold = min(wallet-level, merchant-level)

Wallet threshold fields:
- 单日累计上限
- 月累计上限

Merchant threshold hierarchy:
- Per-Chain (chain + network) → Per-Asset (asset type) → 全局默认

Per rule fields:
- 单笔最小
- 自动审批上限 (below this: auto-approve)
- 人工审核阈值 (above this: manual review required)
- 日累计上限
- 月累计上限

### Stage 2.5 — KYW Decision
- `通过` — wallet cleared, transactions allowed
- `拒绝` — wallet blocked
- `请求扫描` — request fresh scan from provider

### Stage 2.6 — Ongoing Monitoring
**KYW监控 (持续监控)**

Auto re-scan every N days (configurable)
休眠阈值: wallet inactive ≥ 180 days → marked dormant
Re-review triggered by: score change, transaction anomaly, rule hit

---

## Lifecycle 3 — Transaction Monitoring

### Stage 3.1 — Rule Configuration
**监控规则**

5 default rules (extensible):

| Rule ID | Name | Category | Trigger | Actions |
|---|---|---|---|---|
| TM-00-001 | 大额虚拟货币交易 | 金额阈值 | Crypto tx ≥ CAD $10,000 | 告警指派 · 生成报告 |
| TM-00-002 | 可疑交易报告 | 可疑交易 | Any suspicious tx, any amount | 告警指派 · 生成报告 · 拦截交易 · 发送通知 |
| TM-00-003 | 政治公众人物/HIO检测 | 制裁筛查 | PEP/HIO customer ≥ CAD $1,000 | 告警指派 · 触发EDD |
| TM-00-004 | 高频加密币入账 | 频率异常 | High frequency ≥ CAD $5,000/h | 告警指派 · 上报升级 |
| TM-00-005 | 高风险司法管辖区转账 | 可疑交易 | Any suspicious tx, any amount | 告警指派 · 上报升级 |

Rule tags: `法定` (regulatory mandate) · `配置` (admin-configured)

### Stage 3.2 — Alert Generated
When a rule fires → **交易警报** created

Alert record fields:
- 警报ID (ALT-YYYY-NNN)
- 关联交易 (DEP / WIT / EXC order ID)
- 类型: 充值 / 提现 / 兑换
- 商户名称
- 触发规则
- 交易金额
- 状态: 传处理 / 已处理 / 待确认 / 已申报 / 已屏蔽
- 处理结果
- 经手人
- 触发时间

### Stage 3.3 — Real-time Review (事中监控)
L1 analyst receives alert → reviews transaction detail:
- Transaction info (amount, direction, chain, wallet)
- Merchant CRR + KYW score
- Sanctions screening result
- Linked previous cases

**Four actions:**
- `审核通过` — clear the transaction
- `暂缓入账` — hold pending further review
- `拦截交易` — block + freeze account
- `标记STR` — flag as suspicious, route to STR filing

### Stage 3.4 — Escalation
If L1 cannot decide → escalate to L2
If L2 cannot decide → escalate to L3
Each escalation: reason recorded + SLA restarts

---

## Lifecycle 4 — Order Review

### Order Types

| Type | Queue | Description |
|---|---|---|
| 充值订单 | 充值订单 | Crypto deposit from merchant wallet |
| 提现订单 | 提现订单 | Crypto withdrawal to external wallet |
| 兑换订单 | 兑换订单 | Crypto-to-crypto or crypto-to-fiat exchange |
| A2A订单 | A2A订单 | Account-to-account transfer |

### Order Status Flow

```
新建 → 待审核 → 审核中 → 已通过 / 已拒绝 / 暂缓入账 / 已冻结
                ↓
          待补充材料 → (merchant submits) → 审核中
                ↓
           已申请解冻 → 申请解冻审批 → 解冻 / 维持冻结
```

### Order Detail Fields (Deposit example)
- 订单号 / 发送方地址 / 链 / 商户名称
- 充值金额 (crypto + CAD equivalent)
- 匹配规则 (which monitoring rule triggered)
- 风险等级 (CRR badge)
- 状态 / 分配给 / 提交时间 / SLA剩余

**Decision modal (same as KYC):**
- 入账 / 退款 / 冻结并报告
- 请求信息 / 退回审核人 / 升级至L3
- 标记为STR toggle

---

## Lifecycle 5 — STR / LCTR Regulatory Reporting

### STR (Suspicious Transaction Report)

Triggered by:
- Manual flag during any review (交易审核 / KYC审核 / 交易警报)
- Automatic rule action (TM-00-002)

Flow:
1. L1 flags transaction as suspicious → STR draft created
2. L2 reviews STR content → confirms or rejects
3. L2 confirms → STR submitted to FINTRAC via F2R system
4. Status: `草稿` → `待L2确认` → `已提交`

FINTRAC deadline: 30 days from detection

### LCTR (Large Cash Transaction Report)

Triggered by: cash transaction ≥ CAD $10,000
Filed within: 15 business days
Flow same as STR but separate queue

---

## Lifecycle 6 — Ongoing Merchant Management

### Merchant Profile Tabs

| Tab | Content |
|---|---|
| 基本信息 | Company details, KYB fields, assigned agent |
| 交易记录 | Full transaction history with filters |
| 配置 | Fee config + threshold config (see below) |
| 提币地址 | Registered withdrawal wallet addresses |
| 活动日志 | All config changes, decisions, fee updates |
| 账户状态 | Current status, freeze history |
| MSO历史 | MSO registration change history |

### Configuration Changes (Activity Log tracked)
Every change creates an activity log entry:
- Who made the change (email)
- Timestamp
- Old value → New value
- Approval status (if change requires approval: `待审核` badge)

Examples: 更新手续费 USDT-ERC20: 10 → 15 USDT · 审批点差覆盖: 150bps → 100bps

### Account Actions
- `更新CRR` — manually recalculate risk score
- `冻结商户` — suspend all transactions
- `申请解冻` — merchant submits unfreeze request → L2 approval required

### KPI Cards on Merchant Profile
- 本月充值总数 + CAD amount + MoM change
- 历史STR申报 count + first report date
- EDD历史 count + in-progress flag
- 升级案件(合规) count + pending flag
- 注册钱包数 + high-risk count

---

## Lifecycle 7 — System Configuration

### Settings Structure
**系统设置 → 风险与合规配置**

Tabs: 风险阈值 · SLA配置 · 监控配置 · 角色权限

### 监控配置
- 自动筛查频率: every 1h / 1d / 1w / 1m / custom (default: every 3 days)
- 复审触发条件: wallet score ≥ N AND risk level reaches [低/中/高]
- 休眠阈值: inactive ≥ 180 days → dormant

### 阈值配置
Priority: **Per-Chain > Per-Asset > 全局默认**

Per rule:
- 规则级别: Per-Chain / Per-Asset / 全局默认
- 计价币种 + 网络
- 单笔最小
- 自动审批上限 (auto-clear below this)
- 人工审核阈值 (manual review above this)
- 日累计上限
- 月累计上限
- 启用/停用 toggle

### 费率配置
- 充值手续费 (% or fixed)
- 提现手续费 (fixed per asset, e.g. 15 USDT)
- 兑换点差 (bps, e.g. 0.50%)
- 交易对点差 (per trading pair)

### SLA配置
Per case type and risk tier — configurable review time limits

### 角色权限
User & role management:
- 权限管理 — assign permissions per role
- Roles: 客户代理 · L1分析师 · L2审核员 · L3/合规管理员

---

## End-to-End Flow Summary

```
[Merchant Applies]
       │
       ▼
[KYC Review] ──── 待补材料 ──→ Merchant submits ──┐
   L1 reviews                                     │
   L2 approves                                    │
       │                                          │
    Approved ◄────────────────────────────────────┘
       │
       ▼
[Merchant Active] ←──────────────────────────────────────────────┐
       │                                                          │
       ▼                                                          │
[Wallet Added] → [KYW Scan] → [KYW Review] → Cleared            │
                                    │                             │
                              Periodic re-scan (every 3 days) ───┘
       │
       ▼
[Transaction Submitted]
       │
       ├──→ Below auto-approve threshold → Auto-cleared
       │
       ├──→ Above manual threshold → [Order Review Queue]
       │           L1 reviews → Decision (approve/hold/block/STR)
       │
       └──→ Rule triggered → [交易警报] → [事中监控]
                   L1 reviews → Decision
                         │
                    Suspicious?
                         │
                         ▼
                    [STR Draft]
                    L2 confirms
                         │
                         ▼
                  [FINTRAC Filing]
```

---

## Role Responsibilities Summary

| Role | Primary Responsibilities | Cannot Do |
|---|---|---|
| 客户代理 | Merchant onboarding, material collection, pipeline tracking | No compliance decisions |
| L1 分析师 | KYC review, order review, alert triage, STR flagging | Cannot confirm STR, cannot final-approve high-risk |
| L2 审核员 | Escalated cases, STR confirmation, EDD approval, L1 oversight | Cannot override L3 decisions |
| L3 / 合规管理员 | Final authority, rule configuration, threshold setting, system config, team management | — |

---

## Data Entities

```
Merchant
  ├── KYC Case (1:1)
  │     ├── Risk Score (14 indicators)
  │     ├── EDD Record
  │     ├── File Management (KYC docs + tx docs)
  │     └── Activity Log
  ├── Wallet Addresses (1:N)
  │     ├── KYW Case (1:1 per wallet)
  │     └── Threshold Config (per wallet)
  ├── Threshold Config (merchant-level)
  ├── Fee Config
  └── Orders (1:N)
        ├── Deposit Orders
        ├── Withdrawal Orders
        ├── Exchange Orders
        └── A2A Orders

Monitoring Rules (global config)
  └── Alerts (1:N triggered)
        └── STR / LCTR Reports (if flagged)

Users
  └── Role → Permissions
```

---

## Key Business Rules

1. **就低原则** — Effective threshold = min(wallet-level, merchant-level, global)
2. **SLA enforcement** — Each case type has a time limit; breach escalates priority
3. **Auto vs manual split** — Below auto-approve threshold: system clears; above manual threshold: L1 required
4. **Threshold priority** — Per-Chain > Per-Asset > Global default
5. **STR deadline** — Must file within 30 days of detection (FINTRAC requirement)
6. **LCTR deadline** — Must file within 15 business days
7. **KYW re-scan** — Automatic every 3 days (default); triggered by score change
8. **Dormancy** — Wallet inactive ≥ 180 days → marked dormant, excluded from active monitoring
9. **EDD trigger** — CRR ≥ high-risk threshold OR manual flag by analyst
10. **L3 escalation** — Any case can be escalated to L3; L2 cannot self-resolve if L3-flagged