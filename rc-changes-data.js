/* 规则变更治理 store —— 变更请求(CR)的状态机 + localStorage 持久化。
   规则编辑器 intake() 创建 CR；变更治理页(rc-rule-governance.html)消费与流转。
   闭环：编辑器(改) → 回测(验证) → 提交CR → diff审查+MLRO审批 → 冠军-挑战者灰度 → 上线，全程留痕。
   状态：submitted 待审批 → shadow 灰度中(挑战者) → live 已上线 ｜ rejected 已驳回 ｜ rolled_back 已回滚 */
window.RC_CHANGES = {
  _key: 'rc_changes_v3',
  STATES: {
    submitted:   { label: '待审批',         cls: 'p-amber' },
    shadow:      { label: '灰度中 · 挑战者', cls: 'p-blue'  },
    live:        { label: '已上线',         cls: 'p-green' },
    rejected:    { label: '已驳回',         cls: 'p-red'   },
    rolled_back: { label: '已回滚',         cls: 'p-grey'  },
  },
  // from-state → 允许的流转；role: rc 提交 / compliance(MLRO) 审批 / any
  TX: {
    submitted: [ { to:'shadow',   label:'批准 · 进入灰度',  event:'MLRO 批准，进入冠军-挑战者灰度', role:'compliance', kind:'primary' },
                 { to:'rejected', label:'驳回',            event:'MLRO 驳回变更',               role:'compliance', kind:'ghost'   } ],
    shadow:    [ { to:'live',     label:'灰度达标 · 上线',  event:'灰度达标，挑战者提升上线生效',   role:'compliance', kind:'primary' },
                 { to:'rejected', label:'灰度不达标 · 退回', event:'灰度不达标，退回',             role:'compliance', kind:'ghost'   } ],
    live:      [ { to:'rolled_back', label:'回滚到上一版本', event:'回滚到上一版本',              role:'any',        kind:'ghost'   } ],
    rejected: [], rolled_back: [],
  },
  _now() { const d = new Date(); const p = n => ('0' + n).slice(-2); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; },
  _ev(text, by, team) { return { t: this._now(), text, by: by || '系统', team: team || null }; },

  get _seed() { return [
    { no:'CR-2026-014', ruleId:'RULE-007', rule:'新商户首充', summary:'权重 +20 → +12（降低对新商户的误伤）', by:'Mike Lin', team:'rc', state:'submitted', created:'2026-06-06 10:12',
      diff:[['风险权重','+20','+12'],['严重度','中','低']], patch:{weight:'+12'},
      reason:'近30日误报率 52%，多为已完成 KYB 的正常新商户被拦。建议下调权重作为加分项而非单独拦截。依据：误报反馈 FB-2031 等 14 起。',
      champion:{hits:158, fp:'52%', precision:'48%'}, challenger:{hits:96, fp:'31%', precision:'69%'},
      events:[{t:'2026-06-06 10:12', text:'提交变更请求 · 待 MLRO 审批', by:'Mike Lin', team:'rc'}] },

    { no:'CR-2026-013', ruleId:'RULE-003', rule:'大额充值监控', summary:'充值阈值 CAD 5,000 → 6,500', by:'Sarah Chen', team:'rc', state:'shadow', created:'2026-06-03 14:40',
      diff:[['充值金额阈值','CAD 5,000','CAD 6,500']], patch:{threshold:'6500'},
      reason:'固定阈值对大额商户误报偏高；上调阈值并保留商户分层豁免。回测显示误报显著下降而真风险拦截基本持平。',
      champion:{hits:312, fp:'38%', precision:'62%'}, challenger:{hits:268, fp:'29%', precision:'71%'},
      shadow:{days:5, traffic:'100% 影子流量 · 不阻断', champHits:312, chalHits:268, champFp:'38%', chalFp:'29%', champTp:193, chalTp:190, champPrec:'62%', chalPrec:'71%', missedRisk:0, slaDelta:'-0.3h', verdict:'达标', verdictNote:'误报降 9pp、真风险拦截基本持平（-3）、零新增漏报、SLA 改善，建议提升上线。'},
      events:[{t:'2026-06-03 14:40', text:'提交变更请求', by:'Sarah Chen', team:'rc'},
              {t:'2026-06-03 15:02', text:'MLRO 批准，进入冠军-挑战者灰度', by:'David Wu', team:'compliance'}] },

    { no:'CR-2026-012', ruleId:'RULE-001', rule:'混币器关联', summary:'权重 +30 → +35 · 溯源置信度 75% → 80%', by:'David Wu', team:'rc', state:'live', created:'2026-05-20 09:00',
      diff:[['风险权重','+30','+35'],['溯源置信度阈值','75%','80%']],
      reason:'制裁混币器溯源命中应从严，提高权重确保达到「冻结+升级」阈值。',
      champion:{hits:42, fp:'5%', precision:'95%'}, challenger:{hits:47, fp:'4%', precision:'96%'},
      shadow:{days:3, traffic:'影子模式 · 不阻断', champHits:42, chalHits:47, champFp:'5%', chalFp:'4%', missedRisk:0},
      events:[{t:'2026-05-20 09:00', text:'提交变更请求', by:'David Wu', team:'rc'},
              {t:'2026-05-20 09:30', text:'MLRO 批准，进入灰度', by:'David Wu', team:'compliance'},
              {t:'2026-05-20 18:00', text:'灰度达标，挑战者提升上线生效', by:'David Wu', team:'compliance'}] },

    { no:'CR-2026-011', ruleId:'RULE-005', rule:'KYW 评分超阈值', summary:'阈值 > 70 → > 65（提高覆盖）', by:'Mike Lin', team:'rc', state:'rejected', created:'2026-05-12 11:20',
      diff:[['KYW 评分阈值','> 70','> 65']],
      reason:'希望提高拦截覆盖率。',
      champion:{hits:31, fp:'9%', precision:'91%'}, challenger:{hits:78, fp:'34%', precision:'66%'},
      events:[{t:'2026-05-12 11:20', text:'提交变更请求', by:'Mike Lin', team:'rc'},
              {t:'2026-05-12 16:00', text:'MLRO 驳回：回测显示误报激增至 34%，收益不足以抵消客户摩擦', by:'David Wu', team:'compliance'}] },

    { no:'CR-2026-010', ruleId:'RULE-004', rule:'大额提现监控', summary:'提现阈值 CAD 3,000 → 2,000（收紧）', by:'Sarah Chen', team:'rc', state:'rolled_back', created:'2026-05-08 10:00',
      diff:[['提现金额阈值','CAD 3,000','CAD 2,000']], patch:{threshold:'2000'},
      reason:'希望提高提现侧拦截覆盖率。',
      champion:{hits:204, fp:'29%', precision:'71%'}, challenger:{hits:341, fp:'46%', precision:'54%'},
      shadow:{days:3, traffic:'100% 影子流量 · 不阻断', champHits:204, chalHits:341, champFp:'29%', chalFp:'46%', champTp:145, chalTp:184, champPrec:'71%', chalPrec:'54%', missedRisk:0, slaDelta:'+0.9h', verdict:'勉强达标', verdictNote:'多拦真风险但误报与 SLA 同步恶化，灰度判定偏激进。'},
      events:[{t:'2026-05-08 10:00', text:'提交变更请求', by:'Sarah Chen', team:'rc'},
              {t:'2026-05-08 11:00', text:'MLRO 批准，进入冠军-挑战者灰度', by:'David Wu', team:'compliance'},
              {t:'2026-05-09 09:00', text:'灰度达标，挑战者提升上线生效', by:'David Wu', team:'compliance'},
              {t:'2026-05-11 14:00', text:'回滚到上一版本：上线后误报由 29% 升至 46%、SLA 恶化，业务投诉上升', by:'David Wu', team:'compliance'}] },
  ]; },

  _ensure() { if (localStorage.getItem(this._key) === null) { try { localStorage.setItem(this._key, JSON.stringify(this._seed)); } catch (e) {} } },
  _load() { this._ensure(); try { return JSON.parse(localStorage.getItem(this._key)) || this._seed; } catch (e) { return this._seed; } },
  _save(a) { try { localStorage.setItem(this._key, JSON.stringify(a)); } catch (e) {} },
  all() { return this._load(); },
  get(no) { return this._load().find(c => c.no === no) || null; },
  def(c) { return this.STATES[c.state] || this.STATES.submitted; },
  nextActions(c) { return this.TX[c.state] || []; },
  nextNo() { const ns = this._load().map(c => parseInt(String(c.no).slice(-3), 10)).filter(n => !isNaN(n)); const mx = ns.length ? Math.max(...ns) : 14; return 'CR-2026-' + String(mx + 1).padStart(3, '0'); },

  intake(o) {
    const all = this._load();
    const c = { no: this.nextNo(), ruleId: o.ruleId || '', rule: o.rule || '未命名规则', summary: o.summary || '规则变更',
      by: o.by || 'James Liu', team: 'rc', state: 'submitted', created: this._now(),
      diff: o.diff || [], patch: o.patch || null, reason: o.reason || '', champion: o.champion || null, challenger: o.challenger || null,
      events: [this._ev('提交变更请求 · 待 MLRO 审批', o.by, 'rc')] };
    all.unshift(c); this._save(all); return c;
  },
  // 守卫流转：仅当 to 对当前状态合法、且角色匹配时才执行
  transition(no, to, opts) {
    opts = opts || {};
    const all = this._load(); const c = all.find(x => x.no === no); if (!c) return { ok:false, err:'not_found' };
    const tx = (this.TX[c.state] || []).find(t => t.to === to);
    if (!tx) return { ok:false, err:'illegal' };
    if (opts.role && tx.role !== 'any' && tx.role !== opts.role) return { ok:false, err:'forbidden' };
    const from = c.state; c.state = to;
    (c.events = c.events || []).push(this._ev(opts.event || tx.event || tx.label, opts.by, opts.team || (tx.role !== 'any' ? tx.role : null)));
    this._save(all); return { ok:true, case:c, from };
  },
  reset() { try { localStorage.removeItem(this._key); } catch (e) {} },
};
