/* Shared alert dataset — consumed by rc-alerts.html (list) and rc-review.html (per-alert detail).
 * Each record carries everything a risk reviewer needs to decide: approve/release vs. reject/freeze. */
window.RC_ALERTS = [
  {
    id:'ALT-50231', state:'new', order:'DEP-20260315-001', sev:'high', score:95, level:'Highest', type:'充值',
    title:'混币器关联充值', ruleShort:'混币器关联 / 大额充值',
    status:['待认领','p-grey'], ago:'14 分钟前', submitted:'2026-03-15 09:30:15',
    sla:{text:'剩 1d 02h', pct:62, color:'amber'}, assignee:null,
    amount:'CAD 8,200.00', asset:'8,180 USDT', network:'ERC-20',
    txHash:'0x9b3c…a01f', confirmations:'32 / 32', sender:'0x5078…Ec8c', receiver:'0x91Ad…77F2（商户托管）',
    merchant:'NovaPay Technologies Ltd.', country:'美国', merchantTier:['中风险 · 新商户','p-amber'],
    kyb:'未完成', accountAge:'5 天',
    rules:[
      {name:'大额充值监控', cat:'金额阈值', cond:'单笔 ≥ CAD 5,000', hit:'CAD 8,200', weight:'+60'},
      {name:'混币器关联', cat:'链上溯源', cond:'资金 ≤2 跳触及制裁地址', hit:'Tornado Cash', weight:'+35'},
    ],
    trace:[['Tornado Cash 92%','p-red'],['中转地址 ×3','p-amber'],['发送方 0x5078…','p-grey'],['商户托管钱包','p-blue']],
    traceNote:'92% 入金资产可溯源至 Tornado Cash 混币器（OFAC 制裁实体），经 3 个中转地址在 36 小时内归集至发送方。',
    factors:[
      ['⛓','var(--red-bg)','var(--red)','链上溯源 92% 来自 Tornado Cash','OFAC 制裁混币器'],
      ['💰','var(--amber-bg)','var(--amber)','单笔 CAD 8,200，为商户均值 5.5×','偏离基线'],
      ['🏷','var(--amber-bg)','var(--amber)','商户首充且 KYB 未完成','注册 < 7 天'],
    ],
    addrIntel:{age:'18 天', labels:['混币器关联','高风险'], networkSeen:'网络内 7 家商户出现', priorBlocks:'历史被拦截 3 次'},
    sanctions:{status:'间接命中','list':'OFAC（经混币器）', note:'非直接命中，但资金溯源触及制裁实体'},
    custHistory:{orders:'1（首笔）', violations:'关联 3 笔历史违规', vol30:'CAD 8,200', limit:'CAD 5,000 / 笔'},
    timeline:[
      ['2026-03-15 09:30:15','订单提交 · 规则引擎命中 2 条','done'],
      ['2026-03-15 09:30:16','AI 风险预判完成 · 评分 95（Highest）','done'],
      ['待处理','等待审核决策',''],
    ],
    recommendation:'驳回并冻结资金，升级至 MLRO 评估是否触发 STR 上报。链上溯源命中制裁混币器，放行风险极高。',
    checklist:[['核验链上溯源报告（Chainalysis）',true],['确认商户 KYB 资料是否可补齐',false],['评估是否需起草 STR 转合规',false]],
  },
  {
    id:'ALT-50229', state:'progress', order:'WD-20260314-058', sev:'high', score:88, level:'Highest', type:'提现',
    title:'KYW 评分超阈值提现', ruleShort:'KYW 评分超过阈值',
    status:['处理中','p-amber'], ago:'50 分钟前', submitted:'2026-03-14 08:54:02',
    sla:{text:'剩 18h', pct:74, color:'amber'}, assignee:{i:'SC',n:'Sarah Chen',c:'var(--brand)'},
    amount:'CAD 21,400.00', asset:'0.34 BTC', network:'BTC',
    txHash:'（待广播）', confirmations:'出金待审', sender:'商户托管钱包', receiver:'bc1q…7h2k',
    merchant:'BlockTrade Corp.', country:'美国', merchantTier:['中风险','p-amber'],
    kyb:'完成', accountAge:'1.2 年',
    rules:[
      {name:'KYW 评分超阈值', cat:'评分', cond:'收款钱包 KYW 评分 > 70', hit:'88', weight:'+50'},
      {name:'大额提现监控', cat:'金额阈值', cond:'单笔 ≥ CAD 3,000', hit:'CAD 21,400', weight:'+55'},
    ],
    trace:[['商户托管钱包','p-blue'],['接收方 bc1q…','p-grey'],['高风险地区交易所','p-red']],
    traceNote:'出金目标钱包 KYW 风险评分 88，关联高风险司法管辖区交易所，需核实提现合理性与资金用途。',
    factors:[
      ['📊','var(--red-bg)','var(--red)','收款钱包 KYW 评分 88 > 阈值 70','钱包级风险超限'],
      ['🌐','var(--amber-bg)','var(--amber)','接收方位于高风险司法管辖区','FATF 灰名单'],
      ['💰','var(--amber-bg)','var(--amber)','单笔 CAD 21,400 大额提现','超阈值 7×'],
    ],
    addrIntel:{age:'2 年+', labels:['交易所','高风险地区'], networkSeen:'网络内 2 家商户出现', priorBlocks:'无'},
    sanctions:{status:'未命中', list:'OFAC / UN', note:'收款地址未直接命中制裁名单'},
    custHistory:{orders:'342（历史良好）', violations:'无', vol30:'CAD 96,000', limit:'CAD 3,000 / 笔'},
    timeline:[
      ['2026-03-14 08:54:02','提现发起 · 命中 KYW 评分规则','done'],
      ['2026-03-14 09:10:11','Sarah Chen (L1) 认领','done'],
      ['处理中','核实资金用途与收款方',''],
    ],
    recommendation:'要求商户补充提现用途与收款方关系证明；资料合理则可放行，否则暂缓并升级。',
    checklist:[['核实收款钱包 KYW 报告',true],['要求提现用途说明',false],['确认商户历史无异常',true]],
  },
  {
    id:'ALT-50224', state:'progress', order:'DEP-20260313-204', sev:'mid', score:62, level:'Elevated', type:'充值',
    title:'高频拆分入金', ruleShort:'高频拆分入金',
    status:['处理中','p-amber'], ago:'1 小时前', submitted:'2026-03-13 08:12:40',
    sla:{text:'剩 22h', pct:30, color:'blue'}, assignee:{i:'ML',n:'Mike Lin',c:'var(--green)'},
    amount:'CAD 3,150.00', asset:'3,145 USDT', network:'TRC-20',
    txHash:'TQ5n…9wEx', confirmations:'20 / 20', sender:'TQ5n…9wEx', receiver:'商户托管钱包',
    merchant:'Eastwind Exchange', country:'新加坡', merchantTier:['中风险 · 关注名单','p-amber'],
    kyb:'完成', accountAge:'8 个月',
    rules:[
      {name:'高频拆分入金', cat:'行为', cond:'24h 内 ≥5 笔且金额相近', hit:'7 笔 / 24h', weight:'+30'},
    ],
    trace:[['发送方群组 #A7','p-amber'],['商户托管钱包','p-blue']],
    traceNote:'24 小时内 7 笔金额相近入金，关联关注名单群组 #A7，疑似结构化拆分以规避大额阈值。',
    factors:[
      ['🔁','var(--amber-bg)','var(--amber)','24h 内 7 笔金额相近入金','疑似结构化拆分'],
      ['👥','var(--blue-bg)','var(--blue)','关联群组 #A7（关注名单）','模型识别'],
    ],
    addrIntel:{age:'45 天', labels:['关注名单'], networkSeen:'网络内 1 家商户出现', priorBlocks:'无'},
    sanctions:{status:'未命中', list:'OFAC / UN', note:'—'},
    custHistory:{orders:'128', violations:'1 笔（已结）', vol30:'CAD 42,000', limit:'CAD 5,000 / 笔'},
    timeline:[
      ['2026-03-13 08:12:40','入金命中高频拆分规则','done'],
      ['2026-03-13 08:40:02','Mike Lin (L1) 认领','done'],
      ['处理中','核实拆分原因',''],
    ],
    recommendation:'要求商户说明拆分原因；若为正常业务（如分批结算）可放行，否则纳入加强监控。',
    checklist:[['核查 24h 入金明细',true],['要求拆分原因说明',false],['确认群组 #A7 关联度',false]],
  },
  {
    id:'ALT-50220', state:'new', order:'DEP-20260313-188', sev:'mid', score:55, level:'Elevated', type:'充值',
    title:'新商户大额首充', ruleShort:'新商户首充',
    status:['待认领','p-grey'], ago:'2 小时前', submitted:'2026-03-13 07:48:11',
    sla:{text:'剩 23h', pct:20, color:'blue'}, assignee:null,
    amount:'CAD 6,000.00', asset:'5,985 USDT', network:'ERC-20',
    txHash:'0x9a1c…44Bd', confirmations:'32 / 32', sender:'0x9a1c…44Bd', receiver:'商户托管钱包',
    merchant:'Acme Pay Ltd.', country:'加拿大', merchantTier:['中风险 · 新商户','p-amber'],
    kyb:'审核中', accountAge:'3 天',
    rules:[
      {name:'新商户首充', cat:'行为', cond:'商户首笔 & KYB 未完成', hit:'首充 / KYB 审核中', weight:'+20'},
      {name:'大额充值监控', cat:'金额阈值', cond:'单笔 ≥ CAD 5,000', hit:'CAD 6,000', weight:'+35'},
    ],
    trace:[['发送方 0x9a1c…','p-grey'],['商户托管钱包','p-blue']],
    traceNote:'新注册商户首笔充值，金额偏高；发送方地址链上无负面标签，主要风险为 KYB 未完成。',
    factors:[
      ['🏷','var(--amber-bg)','var(--amber)','商户注册 < 7 天，KYB 审核中','主体未充分核验'],
      ['💰','var(--blue-bg)','var(--blue)','首充 CAD 6,000，高于新商户基线','基线 CAD 1,500'],
    ],
    addrIntel:{age:'120 天', labels:['无负面标签'], networkSeen:'网络内未出现', priorBlocks:'无'},
    sanctions:{status:'未命中', list:'OFAC / UN', note:'—'},
    custHistory:{orders:'1（首笔）', violations:'无', vol30:'CAD 6,000', limit:'CAD 5,000 / 笔'},
    timeline:[
      ['2026-03-13 07:48:11','首充命中新商户规则','done'],
      ['待认领','等待 L1 认领',''],
    ],
    recommendation:'待 KYB 审核通过后放行；如 KYB 资料齐全可优先加速，避免新商户首充体验受损。',
    checklist:[['确认 KYB 审核进度',false],['核验发送方地址无负面',true],['评估是否纳入绿色通道',false]],
  },
  {
    id:'ALT-50218', state:'escalated', order:'WD-20260313-021', sev:'high', score:99, level:'Highest', type:'提现',
    title:'制裁地址命中', ruleShort:'制裁地址命中',
    status:['已升级','p-violet'], ago:'3 小时前', submitted:'2026-03-13 06:20:33',
    sla:{text:'已冻结', pct:100, color:'red'}, assignee:{i:'DW',n:'David Wu',c:'var(--violet)'},
    amount:'CAD 11,900.00', asset:'0.19 BTC', network:'ERC-20',
    txHash:'（已拦截）', confirmations:'出金已冻结', sender:'商户托管钱包', receiver:'0x7F4a…9c21',
    merchant:'OffshoreFX Ltd.', country:'离岸', merchantTier:['高风险','p-red'],
    kyb:'完成', accountAge:'4 个月',
    rules:[
      {name:'制裁地址命中', cat:'名单', cond:'收/发方命中 OFAC/UN', hit:'OFAC SDN 直接命中', weight:'+100'},
    ],
    trace:[['商户托管钱包','p-blue'],['接收方 0x7F4a…9c21','p-red']],
    traceNote:'收款地址 0x7F4a…9c21 直接命中 OFAC SDN 制裁名单，系统已自动冻结资金并升级 MLRO。',
    factors:[
      ['⛔','var(--red-bg)','var(--red)','收款地址直接命中 OFAC SDN','制裁实体'],
      ['🌐','var(--red-bg)','var(--red)','离岸高风险商户','主体风险高'],
    ],
    addrIntel:{age:'—', labels:['OFAC SDN','黑名单'], networkSeen:'网络黑名单', priorBlocks:'黑名单'},
    sanctions:{status:'直接命中', list:'OFAC SDN', note:'收款地址在制裁名单，禁止交易'},
    custHistory:{orders:'56', violations:'2 笔', vol30:'CAD 88,000', limit:'CAD 3,000 / 笔'},
    timeline:[
      ['2026-03-13 06:20:33','提现命中制裁名单 · 系统自动冻结','done'],
      ['2026-03-13 06:20:35','自动升级 MLRO · 生成案件','done'],
      ['处理中','MLRO 评估 STR 上报',''],
    ],
    recommendation:'禁止放行。资金已冻结，由 MLRO 完成 STR 上报 FINTRAC，按制裁合规流程处置。',
    checklist:[['确认制裁命中（OFAC SDN）',true],['资金已冻结',true],['起草 STR 草稿移交合规',false]],
  },
  {
    id:'ALT-50212', state:'closed_done', order:'DEP-20260312-512', sev:'low', score:38, level:'Normal', type:'充值',
    title:'地址风险标签命中', ruleShort:'高风险地址检测',
    status:['已结','p-green'], ago:'今日 06:30', submitted:'2026-03-12 06:30:55',
    sla:{text:'已完结', pct:100, color:'grey'}, assignee:{i:'SC',n:'Sarah Chen',c:'var(--brand)'},
    amount:'CAD 980.00', asset:'978 USDT', network:'SOL',
    txHash:'7xKp…Qz1', confirmations:'已确认', sender:'7xKp…Qz1', receiver:'商户托管钱包',
    merchant:'NovaPay Technologies Ltd.', country:'美国', merchantTier:['低风险','p-green'],
    kyb:'完成', accountAge:'2 年+',
    rules:[
      {name:'高风险地址检测', cat:'链上溯源', cond:'发送方含风险标签', hit:'交易所热钱包（低）', weight:'+25'},
    ],
    trace:[['交易所热钱包','p-blue'],['商户托管钱包','p-blue']],
    traceNote:'发送方为已知交易所热钱包标签，属低风险来源；金额小，已自动放行入账。',
    factors:[
      ['🏷','var(--blue-bg)','var(--blue)','发送方含「交易所热钱包」标签','低风险来源'],
    ],
    addrIntel:{age:'1 年+', labels:['交易所热钱包'], networkSeen:'网络内常见', priorBlocks:'无'},
    sanctions:{status:'未命中', list:'OFAC / UN', note:'—'},
    custHistory:{orders:'410', violations:'无', vol30:'CAD 12,000', limit:'CAD 10,000 / 笔'},
    timeline:[
      ['2026-03-12 06:30:55','入金命中地址标签规则','done'],
      ['2026-03-12 06:31:02','评分 38（Normal）· 自动放行','done'],
      ['2026-03-12 06:31:02','已入账','done'],
    ],
    recommendation:'低风险，已放行入账。可将该交易所热钱包加入可信来源，减少后续误报。',
    checklist:[['确认地址标签为交易所',true],['金额在自动放行区间',true],['建议加入白名单',false]],
  },
  {
    id:'ALT-50205', state:'progress', order:'WD-20260312-077', sev:'mid', score:58, level:'Elevated', type:'提现',
    title:'快进快出钱包', ruleShort:'快进快出钱包',
    status:['处理中','p-amber'], ago:'今日 05:12', submitted:'2026-03-12 05:12:18',
    sla:{text:'剩 20h', pct:35, color:'blue'}, assignee:{i:'ML',n:'Mike Lin',c:'var(--green)'},
    amount:'CAD 4,500.00', asset:'4,490 USDT', network:'TRC-20',
    txHash:'（待广播）', confirmations:'出金待审', sender:'商户托管钱包', receiver:'TQ8m…2kFa',
    merchant:'BlockTrade Corp.', country:'美国', merchantTier:['中风险','p-amber'],
    kyb:'完成', accountAge:'1.2 年',
    rules:[
      {name:'快进快出钱包', cat:'行为', cond:'入金后 1h 内转出 > 80%', hit:'1h 内转出 86%', weight:'+28'},
    ],
    trace:[['商户托管钱包','p-blue'],['接收方 TQ8m…','p-grey']],
    traceNote:'账户入金后 1 小时内转出 86%，呈快进快出特征，可能为资金过账，需核实业务实质。',
    factors:[
      ['⚡','var(--amber-bg)','var(--amber)','入金后 1h 内转出 86%','快进快出特征'],
      ['🔁','var(--blue-bg)','var(--blue)','近 7 日多次类似行为','资金过账嫌疑'],
    ],
    addrIntel:{age:'90 天', labels:['无负面标签'], networkSeen:'网络内 1 家商户出现', priorBlocks:'无'},
    sanctions:{status:'未命中', list:'OFAC / UN', note:'—'},
    custHistory:{orders:'342', violations:'无', vol30:'CAD 96,000', limit:'CAD 3,000 / 笔'},
    timeline:[
      ['2026-03-12 05:12:18','提现命中快进快出规则','done'],
      ['2026-03-12 05:30:40','Mike Lin (L1) 认领','done'],
      ['处理中','核实资金过账实质',''],
    ],
    recommendation:'要求说明资金来源与用途；如为正常结算可放行，若无法解释则暂缓并加强监控。',
    checklist:[['核查入金/转出时间线',true],['要求业务实质说明',false],['评估是否过账行为',false]],
  },
];

/* ── Alert lifecycle state machine (shared by list + detail) ── */
window.RC_STATES = {
  new:         {label:'待认领',    cls:'p-grey',   bucket:'unclaimed', active:true},
  progress:    {label:'处理中',    cls:'p-amber',  bucket:'progress',  active:true},
  pending_l2:  {label:'待L2复核',  cls:'p-blue',   bucket:'progress',  active:true},
  pending:     {label:'待补充材料', cls:'p-blue',   bucket:'progress',  active:true},
  escalated:   {label:'已升级',    cls:'p-violet', bucket:'escalated', active:true},
  closed_fp:   {label:'已结 · 误报', cls:'p-grey',  bucket:'done',      active:false},
  closed_done: {label:'已结 · 已处置', cls:'p-green', bucket:'done',    active:false},
  closed_case: {label:'已结 · 转案件', cls:'p-violet', bucket:'done',   active:false},
};

/* Per-alert state overrides + appended timeline events, persisted in localStorage
   so an action taken on the detail page is reflected back in the list. */
window.RC = {
  _key: 'rc_alert_states_v1',
  _load(){ try { return JSON.parse(localStorage.getItem(this._key)) || {}; } catch(e){ return {}; } },
  _save(o){ try { localStorage.setItem(this._key, JSON.stringify(o)); } catch(e){} },
  _base(id){ return (window.RC_ALERTS||[]).find(x=>x.id===id) || null; },
  now(){ const d=new Date(); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); },
  override(id){ return this._load()[id] || null; },
  state(id){ const o=this.override(id); if(o&&o.state) return o.state; const b=this._base(id); return b?b.state:'new'; },
  assignee(id){ const o=this.override(id); if(o&&o.assignee) return o.assignee; const b=this._base(id); return b?b.assignee:null; },
  events(id){ const o=this.override(id); return (o&&o.events)?o.events:[]; },
  set(id, state, opts){
    opts = opts || {};
    const all=this._load(); const cur=all[id] || {events:[]};
    cur.state=state;
    if(opts.assignee!==undefined) cur.assignee=opts.assignee;
    cur.events=cur.events||[];
    cur.events.push({ t: opts.time||this.now(), text: opts.event||(window.RC_STATES[state]?window.RC_STATES[state].label:state), reason: opts.reason||'' });
    all[id]=cur; this._save(all);
  },
  reset(){ this._save({}); },
};
