/* FuturePayCA 风控系统 — shared shell (sidebar + topbar) injected into every page.
 * Each page declares: <body data-page="alerts" data-crumb="风控·监控运营·告警工作台">
 * and provides <aside class="sidebar" id="rcSidebar"></aside> + <header class="topbar" id="rcTopbar"></header>.
 */
/* ── Roles / teams — Case Management is shared by 风控 (first line) and 合规·MLRO (second line).
   No real auth in the prototype: the current role is a switch persisted in localStorage. */
window.CASE_TEAMS = { rc: '风控', compliance: '合规·MLRO' };
window.RC_ROLE = {
  _key: 'rc_role_v1',
  ROLES: {
    rc:         { key:'rc',         label:'风控 · L1',  team:'rc',         actor:{i:'JL',n:'James Liu',c:'var(--brand)'} },
    l2:         { key:'l2',         label:'风控 · L2',  team:'rc',         actor:{i:'EZ',n:'Emma Zhang (L2)',c:'var(--amber)'} },
    compliance: { key:'compliance', label:'合规 · MLRO', team:'compliance', actor:{i:'DW',n:'David Wu (MLRO)',c:'var(--violet)'} },
  },
  get() { return localStorage.getItem(this._key) || 'rc'; },
  set(r) { try { localStorage.setItem(this._key, r); } catch (e) {} },
  cur() { return this.ROLES[this.get()] || this.ROLES.rc; },
  team() { return this.cur().team; },
};

/* 中央审计事件 store —— 配置类操作(名单维护 / 策略发布 / 其它)追加留痕；审计日志页聚合读取。
   规则变更由 RC_CHANGES、案件流转由 RC_CASES 各自带 events，审计页一并合并。 */
window.RC_AUDIT = {
  _key: 'rc_audit_v1',
  _load() { try { return JSON.parse(localStorage.getItem(this._key)) || []; } catch (e) { return []; } },
  _save(a) { try { localStorage.setItem(this._key, JSON.stringify(a)); } catch (e) {} },
  _now() { const d = new Date(), p = n => ('0' + n).slice(-2); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; },
  log(o) {
    const role = window.RC_ROLE ? RC_ROLE.cur() : { actor:{n:'James Liu'}, team:'rc' };
    const a = this._load();
    a.unshift({ ts: this._now(), by: o.by || role.actor.n, role: o.role || (role.team === 'compliance' ? 'MLRO' : 'RC'),
                action: o.action || '操作', object: o.object || '—', detail: o.detail || '', cat: o.cat || 'config' });
    this._save(a); return a[0];
  },
  all() { return this._load(); },
  reset() { try { localStorage.removeItem(this._key); } catch (e) {} },
};

/* 全局策略 store —— 持久化策略配置 + 每次发布存完整前/后快照、版本号、结构化 diff、历史。
   与规则的 RC_RULES_OVERLAY 同思路：让策略变更可持久、可查历史、可审计。 */
window.RC_STRATEGY = {
  _key: 'rc_strategy_v1',
  _blank: { version: 0, current: null, history: [] },
  _load() { try { return JSON.parse(localStorage.getItem(this._key)) || this._blank; } catch (e) { return this._blank; } },
  _save(o) { try { localStorage.setItem(this._key, JSON.stringify(o)); } catch (e) {} },
  _nowFull() { const d = new Date(), p = n => ('0' + n).slice(-2); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; },
  current() { return this._load().current; },
  version() { return this._load().version || 0; },
  history() { return this._load().history || []; },
  _diff(prev, cur) {
    if (!prev) return [{ k: '初始发布', from: '—', to: '建立策略基线' }];
    const d = []; if (prev.appetite !== cur.appetite) d.push({ k: '风险偏好', from: prev.appetite, to: cur.appetite });
    const pm = {}; (prev.items || []).forEach(i => pm[i.k] = i.v);
    (cur.items || []).forEach(i => { if (pm[i.k] !== undefined && pm[i.k] !== i.v) d.push({ k: i.k, from: pm[i.k], to: i.v }); });
    return d;
  },
  publish(cfg, meta) {
    const s = this._load(); const diff = this._diff(s.current, cfg); const ver = (s.version || 0) + 1;
    const entry = { version: 'v' + ver, at: this._nowFull(), by: (meta && meta.by) || 'MLRO', diff, config: cfg };
    s.history = [entry, ...(s.history || [])]; s.current = cfg; s.version = ver;
    this._save(s); return entry;
  },
  reset() { try { localStorage.removeItem(this._key); } catch (e) {} },
};

/* ── Case lifecycle state machine (parity with the alert RC_STATES machine) ──
   Each state declares label/cls/bucket/active + the STR sub-status it implies + the team whose court it's in.
   CASE_TX is the single source of truth for legal transitions; RC_CASES.transition() enforces it.
   Each transition declares the `role` allowed to perform it (rc | compliance | any). */
window.CASE_STATES = {
  investigating: { label:'调查中',      cls:'p-amber',  bucket:'investigating', active:true,  str:'未起草',        team:'rc',         court:'风控 · L1',  actRole:'rc' },
  l2_review:     { label:'L2 复核中',   cls:'p-blue',   bucket:'l2',            active:true,  str:'L2 复核',       team:'rc',         court:'风控 · L2',  actRole:'l2' },
  str_draft:     { label:'STR 草稿中',  cls:'p-blue',   bucket:'str',           active:true,  str:'草稿中',        team:'rc',         court:'风控',       actRole:'rc' },
  mlro_review:   { label:'MLRO 评估中', cls:'p-violet', bucket:'mlro',          active:true,  str:'MLRO 评估',     team:'compliance', court:'合规 · MLRO', actRole:'compliance' },
  pending_file:  { label:'待报送',      cls:'p-blue',   bucket:'pending',       active:true,  str:'待报送',        team:'compliance', court:'合规 · MLRO', actRole:'compliance' },
  filed:         { label:'已报送',      cls:'p-green',  bucket:'filed',         active:true,  str:'已报送 FINTRAC', team:'compliance', court:'合规 · MLRO', actRole:'compliance' },
  closed:        { label:'已结案',      cls:'p-green',  bucket:'closed',        active:false, str:null,            team:null },
  merged:        { label:'已合并',      cls:'p-grey',   bucket:'merged',        active:false, str:null,            team:null },
};
// from-state → allowed transitions. `kind`: primary | back | ghost. `role`: rc | compliance | any. reopen is resolved dynamically.
window.CASE_TX = {
  investigating: [ {to:'str_draft',   label:'起草 STR 草稿',        event:'起草 STR 草稿',        kind:'primary', role:'rc'},
                   {to:'l2_review',    label:'升级 L2 复核',         event:'升级 L2 复核',         kind:'primary', role:'rc'},
                   {to:'closed',       label:'结案 · 无需上报',       event:'结案 · 认定无需上报',   kind:'ghost',   role:'rc'} ],
  l2_review:     [ {to:'str_draft',   label:'起草 STR 草稿',        event:'L2 确认可疑，起草 STR', kind:'primary', role:'l2'},
                   {to:'investigating',label:'退回 L1',             event:'L2 退回 L1 补充调查',   kind:'back',    role:'l2'},
                   {to:'closed',       label:'结案 · 无需上报',       event:'L2 认定无需上报，结案', kind:'ghost',   role:'l2'} ],
  str_draft:     [ {to:'mlro_review', label:'移交 MLRO 复核',       event:'移交 MLRO 复核',       kind:'primary', role:'rc2'},
                   {to:'closed',       label:'结案 · 无需上报',       event:'结案 · 认定无需上报',   kind:'ghost',   role:'rc2'} ],
  mlro_review:   [ {to:'pending_file', label:'MLRO 批准 · 待报送',   event:'MLRO 批准，进入待报送', kind:'primary', role:'compliance'},
                   {to:'str_draft',    label:'退回修订',             event:'MLRO 退回修订',        kind:'back',    role:'compliance'},
                   {to:'closed',       label:'结案 · 无需上报',       event:'MLRO 认定无需上报，结案', kind:'ghost',   role:'compliance'} ],
  pending_file:  [ {to:'filed',        label:'报送 FINTRAC',         event:'由 MLRO 报送 FINTRAC', kind:'primary', role:'compliance'},
                   {to:'mlro_review',  label:'退回 MLRO',            event:'退回 MLRO 复核',        kind:'back',    role:'compliance'} ],
  filed:         [ {to:'closed',       label:'结案归档',             event:'结案归档',             kind:'primary', role:'compliance'} ],
  closed:        [ {to:'reopen',       label:'重新打开',             event:'重新打开案件',         kind:'primary', role:'any'} ],
  merged:        [],
};

/* Shared, subject-centric case store — a case aggregates many alerts/orders for ONE merchant.
   建案调查 (alert) and 拒绝 (gate) both intake() here. Every state change goes through transition()
   which validates legality against CASE_TX and appends to the case's events[] log.
   Case shape: {no, merchant, type, amount, state, owner:{i,n,c}, sensitive, alerts:[], orders:[], events:[], mergedInto?} */
window.RC_CASES = {
  _key: 'rc_cases_v7',
  _seedLen: 8,
  _ev(text, from, to, by, team) { return { t: this._now(), text, from: from||null, to: to||null, by: by||'系统', team: team||null }; },
  _now() { const d = new Date(); const p = n => ('0'+n).slice(-2); return `${d.getMonth()+1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; },
  get _seed() { return [
    {no:'CASE-2026-0312', priority:'高', merchant:'NovaPay Technologies Ltd.', type:'混币器关联 · 制裁溯源', amount:'CAD 8,200.00', state:'mlro_review',  owner:{i:'DW',n:'David Wu (MLRO)',c:'var(--violet)'}, sensitive:0, alerts:['ALT-50231'], orders:['DEP-20260315-001'], events:[{t:'05-21 09:34',text:'事中冻结 → 建案',from:null,to:'investigating',by:'系统',team:'rc'},{t:'05-21 10:02',text:'起草 STR 草稿',from:'investigating',to:'str_draft',by:'Sarah Chen',team:'rc'},{t:'06-01 14:20',text:'移交 MLRO 复核',from:'str_draft',to:'mlro_review',by:'Sarah Chen',team:'rc'}]},
    {no:'CASE-2026-0311', priority:'中', merchant:'BlockTrade Corp.',         type:'KYW 超阈值',          amount:'CAD 21,400.00', state:'pending_file', owner:{i:'DW',n:'David Wu (MLRO)',c:'var(--violet)'}, sensitive:0, alerts:['ALT-50229'], orders:['WD-20260314-058'], events:[{t:'06-02 09:10',text:'建案',from:null,to:'investigating',by:'系统',team:'rc'},{t:'06-08 11:00',text:'MLRO 批准，进入待报送',from:'mlro_review',to:'pending_file',by:'David Wu',team:'compliance'}]},
    {no:'CASE-2026-0310', priority:'中', merchant:'Skyline Pay Inc.',         type:'快进快出',            amount:'CAD 9,400.00',  state:'str_draft',    owner:{i:'ML',n:'Mike Lin',c:'var(--green)'},    sensitive:0, alerts:['ALT-50205'], orders:['WD-20260312-077'], events:[{t:'06-05 05:40',text:'建案',from:null,to:'investigating',by:'系统',team:'rc'},{t:'06-08 09:15',text:'起草 STR 草稿',from:'investigating',to:'str_draft',by:'Mike Lin',team:'rc'}]},
    {no:'CASE-2026-0309', priority:'低', merchant:'Eastwind Exchange',        type:'高频拆分',            amount:'CAD 3,150.00',  state:'investigating',owner:{i:'ML',n:'Mike Lin',c:'var(--green)'},    sensitive:0, alerts:['ALT-50224'], orders:['DEP-20260313-204'], events:[{t:'06-11 08:40',text:'建案',from:null,to:'investigating',by:'系统',team:'rc'}]},
    {no:'CASE-2026-0308', priority:'高', merchant:'Meridian FX Ltd.',         type:'制裁规避',            amount:'CAD 33,000.00', state:'filed',        owner:{i:'DW',n:'David Wu (MLRO)',c:'var(--violet)'}, sensitive:0, alerts:['ALT-50218'], orders:['WD-20260313-021'], events:[{t:'05-12 06:25',text:'制裁命中 → 建案',from:null,to:'investigating',by:'系统',team:'rc'},{t:'05-13 10:00',text:'移交 MLRO 复核',from:'str_draft',to:'mlro_review',by:'Sarah Chen',team:'rc'},{t:'05-14 09:00',text:'MLRO 批准，进入待报送',from:'mlro_review',to:'pending_file',by:'David Wu',team:'compliance'},{t:'05-15 15:30',text:'由 MLRO 报送 FINTRAC',from:'pending_file',to:'filed',by:'David Wu',team:'compliance'}]},
    {no:'CASE-2026-0307', priority:'高', merchant:'Acme Pay Ltd.',            type:'结构化提现',          amount:'CAD 56,000.00', state:'mlro_review',  owner:{i:'DW',n:'David Wu',c:'var(--violet)'},   sensitive:0, alerts:['ALT-50220'], orders:[], events:[{t:'05-10 12:00',text:'建案',from:null,to:'investigating',by:'系统',team:'rc'},{t:'05-12 09:00',text:'移交 MLRO 复核',from:'str_draft',to:'mlro_review',by:'David Wu',team:'rc'}]},
    {no:'CASE-2026-0306', priority:'低', merchant:'NovaPay Technologies Ltd.', type:'重复告警 · 已并案',   amount:'CAD 2,100.00',  state:'merged',       owner:{i:'SC',n:'Sarah Chen',c:'var(--brand)'},  sensitive:0, mergedInto:'CASE-2026-0312', alerts:['ALT-50240'], orders:[], events:[{t:'05-21 12:00',text:'建案',from:null,to:'investigating',by:'系统',team:'rc'},{t:'05-21 12:30',text:'并入 CASE-2026-0312',from:null,to:'merged',by:'Sarah Chen',team:'rc'}]},
    {no:'CASE-2026-0305', priority:'中', merchant:'NovaPay Technologies Ltd.', type:'大额异常',           amount:'CAD 12,000.00', state:'closed',       owner:{i:'SC',n:'Sarah Chen',c:'var(--brand)'},  sensitive:0, alerts:['ALT-50212'], orders:[], _prev:'filed', events:[{t:'05-02 06:31',text:'建案',from:null,to:'investigating',by:'系统',team:'rc'},{t:'05-04 10:00',text:'由 MLRO 报送 FINTRAC',from:'pending_file',to:'filed',by:'David Wu',team:'compliance'},{t:'05-06 16:00',text:'结案归档',from:'filed',to:'closed',by:'David Wu',team:'compliance'}]},
  ]; },
  _ensure() { if (localStorage.getItem(this._key) === null) { try { localStorage.setItem(this._key, JSON.stringify(this._seed)); } catch (e) {} } },
  _load() { this._ensure(); try { return JSON.parse(localStorage.getItem(this._key)) || this._seed; } catch (e) { return this._seed; } },
  _save(a) { try { localStorage.setItem(this._key, JSON.stringify(a)); } catch (e) {} },
  all() { return this._load(); },
  get(no) { return this._load().find(c => c.no === no) || null; },
  def(c) { return CASE_STATES[c.state] || CASE_STATES.investigating; },
  isActive(c) { return !!this.def(c).active; },
  nextActions(c) { return CASE_TX[c.state] || []; },
  ballTeam(c) { return (CASE_STATES[c.state] || {}).team || null; },          // whose court the case is in
  canRole(action, role) { if (!action) return false; const r = action.role; if (r === 'any') return true; if (r === 'rc2') return role === 'rc' || role === 'l2'; return r === role; },
  visibleTo(c, role) { return true; },                                        // 敏感案件需知密暂未启用 — 全部案件双方可见
  createdCount() { return Math.max(0, this._load().length - this._seedLen); },
  nextNo() { const ns = this._load().map(c => parseInt(String(c.no).slice(-4), 10)).filter(n => !isNaN(n)); const mx = ns.length ? Math.max(...ns) : 312; return 'CASE-2026-' + String(mx + 1).padStart(4, '0'); },
  openForMerchant(m) { return this._load().find(c => c.merchant === m && this.isActive(c)) || null; },

  // find the merchant's OPEN case (or create one), attach the alert/order, log the event
  intake(o) {
    const all = this._load();
    let c = all.find(x => x.merchant === o.merchant && (CASE_STATES[x.state] || {}).active), created = false;
    if (!c) {
      c = { no: this.nextNo(), merchant: o.merchant, type: o.type || '风险调查', amount: o.amount || '—',
            state: 'investigating', priority: o.priority || '中', scope: o.scope || [],
            owner: o.owner || {i:'JL',n:'James Liu',c:'var(--brand)'}, origin: 'rc',
            sensitive: o.sensitive ? 1 : 0, alerts: [], orders: [], events: [this._ev('建案 · 来源 ' + (o.source || (o.alertId ? '告警' : '事中监控')), null, 'investigating', o.by, 'rc')] };
      all.unshift(c); created = true;
    }
    const added = [];
    if (o.alertId && !c.alerts.includes(o.alertId)) { c.alerts.push(o.alertId); added.push(o.alertId); }
    if (o.orderId && !c.orders.includes(o.orderId)) { c.orders.push(o.orderId); added.push(o.orderId); }
    if (o.sensitive) c.sensitive = 1;
    if (!created && added.length) (c.events = c.events || []).push(this._ev('关联 ' + added.join('、'), c.state, c.state, o.by, 'rc'));
    this._save(all);
    return { caseNo: c.no, created, count: c.alerts.length + c.orders.length };
  },
  // manual creation (新建案件)
  create(o) {
    const all = this._load();
    const team = o.team || 'rc';
    const c = { no: this.nextNo(), merchant: o.merchant, type: o.type || '风险调查', amount: o.amount || '—',
      state: 'investigating', priority: o.priority || '中', scope: o.scope || [],
      owner: o.owner || {i:'JL',n:'James Liu',c:'var(--brand)'}, origin: team,
      sensitive: o.sensitive ? 1 : 0, alerts: o.alerts || [], orders: o.orders || [], events: [this._ev('手动建案 · ' + (CASE_TEAMS[team]||'') + '发起', null, 'investigating', (o.owner||{}).n, team)] };
    all.unshift(c); this._save(all); return c;
  },
  update(no, patch) { const all = this._load(); const c = all.find(x => x.no === no); if (c) { Object.assign(c, patch); this._save(all); } return c; },
  note(no, text, by, team) { const all = this._load(); const c = all.find(x => x.no === no); if (c) { (c.events = c.events || []).push(this._ev(text, c.state, c.state, by || 'James Liu', team)); this._save(all); } return c; },
  // 请求信息(RFI) —— 旁路动作，不改状态：向商户索取补充材料，挂"待商户补料"
  requestInfo(no, o) { o = o || {}; const all = this._load(); const c = all.find(x => x.no === no); if (!c) return null; c.rfi = { open: true, items: o.items || [], note: o.note || '', due: o.due || '', at: this._now(), by: o.by }; (c.events = c.events || []).push(this._ev('向商户请求补充材料：' + ((o.items || []).join('、') || o.note || '—'), c.state, c.state, o.by, o.team)); this._save(all); return c; },
  infoReceived(no, by, team) { const all = this._load(); const c = all.find(x => x.no === no); if (!c || !c.rfi) return null; c.rfi.open = false; (c.events = c.events || []).push(this._ev('商户已补充材料，RFI 关闭', c.state, c.state, by, team)); this._save(all); return c; },

  // GUARDED transition — only proceeds if `to` is legal from the current state per CASE_TX. Returns {ok, err?, case?}
  transition(no, to, opts) {
    opts = opts || {};
    const all = this._load(); const c = all.find(x => x.no === no); if (!c) return { ok:false, err:'not_found' };
    const txList = CASE_TX[c.state] || [];
    const txDef = txList.find(t => t.to === to);              // `to` is 'reopen' for closed, or a real state otherwise
    if (!txDef) return { ok:false, err:'illegal' };
    // role guard — only the team that owns this transition may perform it (unless 'any')
    if (opts.role && txDef.role !== 'any' && txDef.role !== opts.role) return { ok:false, err:'forbidden' };
    let target = to;
    if (to === 'reopen') target = c._prev || 'investigating';
    if (!CASE_STATES[target]) return { ok:false, err:'unknown_state' };
    const from = c.state;
    if (target === 'closed') c._prev = from;     // remember the pre-close stage so reopen can restore it
    c.state = target;
    const team = opts.team || (txDef.role !== 'any' ? txDef.role : null);
    (c.events = c.events || []).push(this._ev(opts.event || CASE_STATES[target].label, from, target, opts.by || 'James Liu', team));
    this._save(all);
    return { ok:true, case:c };
  },

  // merge: primary absorbs others' alerts/orders/sensitivity; others → merged (terminal) with a back-pointer
  merge(primaryNo, otherNos) {
    const all = this._load(); const p = all.find(c => c.no === primaryNo); if (!p) return null;
    (otherNos || []).forEach(no => { const o = all.find(c => c.no === no); if (o && o !== p && this.isActive(o)) {
      o.alerts.forEach(a => { if (!p.alerts.includes(a)) p.alerts.push(a); });
      o.orders.forEach(x => { if (!p.orders.includes(x)) p.orders.push(x); });
      if (o.sensitive) p.sensitive = 1;
      o.state = 'merged'; o.mergedInto = primaryNo;
      (o.events = o.events || []).push(this._ev('并入 ' + primaryNo, null, 'merged', 'James Liu'));
      (p.events = p.events || []).push(this._ev('并入案件 ' + o.no, p.state, p.state, 'James Liu'));
    }});
    this._save(all); return p;
  },
  // STR 30-day reporting clock — derived from the case's creation event (assumed year 2026).
  // show=true only while the case is pre-filing (the window where the clock legally matters).
  sla(c) {
    const ev = c.events && c.events[0];
    const m = ev && /^(\d{1,2})-(\d{1,2})/.exec(ev.t);
    const base = m ? new Date(2026, +m[1] - 1, +m[2]) : new Date();
    const deadline = new Date(base.getTime() + 30 * 864e5);
    const left = Math.ceil((deadline - new Date()) / 864e5);
    const p = n => ('0' + n).slice(-2);
    return { left, due: `${deadline.getFullYear()}-${p(deadline.getMonth() + 1)}-${p(deadline.getDate())}`,
             show: ['investigating', 'l2_review', 'str_draft', 'mlro_review', 'pending_file'].includes(c.state) };
  },
  // SLA enforcement — flag any overdue pre-filing case as auto-escalated exactly once,
  // writing a breach event to its timeline (which the audit log then surfaces). Idempotent via c.slaBreached.
  sweepSLA() {
    const all = this._load(); let changed = false;
    all.forEach(c => {
      const s = this.sla(c);
      if (s.show && s.left < 0 && !c.slaBreached) {
        c.slaBreached = true;
        (c.events = c.events || []).push(this._ev('SLA 逾期 · 系统自动升级并标记违规', c.state, c.state, '系统', 'compliance'));
        changed = true;
      }
    });
    if (changed) this._save(all);
  },
  reset() { try { localStorage.removeItem(this._key); } catch (e) {} },
};
// run the SLA sweep once at load so breach escalations are recorded before any page reads the cases
try { RC_CASES.sweepSLA(); } catch (e) {}

/* Shared 合并案件 modal — open from the list or a case detail. Pick a primary, multi-select cases to absorb. */
window.RCMerge = {
  _styled: false,
  _ensureStyle() {
    if (this._styled) return; this._styled = true;
    const s = document.createElement('style');
    s.textContent = `
      .rcm-ov{position:fixed;inset:0;background:rgba(18,21,27,.45);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;z-index:90;padding:48px 16px;overflow-y:auto}
      .rcm-dlg{background:var(--surface);width:100%;max-width:520px;border-radius:16px;box-shadow:var(--shadow-pop);overflow:hidden;animation:rcmIn .18s ease}
      @keyframes rcmIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      .rcm-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line)}
      .rcm-head h3{font-size:16px;font-weight:700;margin:0}
      .rcm-x{width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--text-3);cursor:pointer;font-size:17px;line-height:1}
      .rcm-x:hover{background:var(--surface-2);color:var(--text)}
      .rcm-body{padding:18px 20px;max-height:60vh;overflow-y:auto}
      .rcm-lbl{display:block;font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
      .rcm-sel{width:100%;height:40px;border:1px solid var(--line);border-radius:10px;padding:0 11px;background:var(--surface);color:var(--text);font-size:13px;font-family:inherit}
      .rcm-list{display:flex;flex-direction:column;gap:8px}
      .rcm-opt{display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:11px;padding:11px 13px;cursor:pointer;transition:all .12s}
      .rcm-opt:hover{background:var(--surface-3)}
      .rcm-opt.on{border-color:var(--brand);background:var(--brand-soft)}
      .rcm-ck{width:18px;height:18px;border-radius:6px;border:1.5px solid var(--line);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px}
      .rcm-opt.on .rcm-ck{background:var(--brand);border-color:var(--brand);color:#fff}
      .rcm-main{display:flex;flex-direction:column;gap:1px;flex:1;font-size:13px;font-weight:600}
      .rcm-sub{font-size:11px;color:var(--text-2);font-weight:400}
      .rcm-prev{font-size:12px;color:var(--text-2);margin-top:14px;line-height:1.55}
      .rcm-warn{background:var(--amber-bg);border:1px solid var(--amber-bd);color:var(--amber);padding:7px 10px;border-radius:8px;margin-top:8px;font-size:11.5px}
      .rcm-muted{color:var(--text-3);font-size:12.5px;text-align:center;padding:16px 0}
      .rcm-foot{display:flex;gap:10px;padding:14px 20px;border-top:1px solid var(--line);background:var(--surface-3)}
      .rcm-foot .btn{flex:1;height:42px;justify-content:center;font-weight:600}`;
    document.head.appendChild(s);
  },
  open(primaryNo, onDone) {
    this._ensureStyle();
    const cases = RC_CASES.all().filter(c => RC_CASES.isActive(c));
    if (!cases.length) return;
    let primary = (primaryNo && cases.some(c => c.no === primaryNo)) ? primaryNo : cases[0].no;
    const sel = new Set();
    const ov = document.createElement('div'); ov.className = 'rcm-ov';
    ov.innerHTML = `<div class="rcm-dlg">
      <div class="rcm-head"><h3>合并案件</h3><button class="rcm-x" data-act="close">✕</button></div>
      <div class="rcm-body">
        <label class="rcm-lbl">主案件 · 保留</label>
        <select class="rcm-sel" data-el="primary">${cases.map(c => `<option value="${c.no}">${c.no} · ${c.merchant}</option>`).join('')}</select>
        <label class="rcm-lbl" style="margin-top:16px">选择并入的案件 · 可多选</label>
        <div class="rcm-list" data-el="list"></div>
        <div class="rcm-prev" data-el="prev"></div>
      </div>
      <div class="rcm-foot"><button class="btn btn-ghost" data-act="close">取消</button><button class="btn btn-primary" data-act="go" disabled>合并</button></div>
    </div>`;
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    const $ = s => ov.querySelector(s);
    const priEl = $('[data-el="primary"]'); priEl.value = primary;
    const close = () => { ov.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    function renderList() {
      primary = priEl.value;
      const pm = cases.find(c => c.no === primary);
      const rows = cases.filter(c => c.no !== primary);
      $('[data-el="list"]').innerHTML = rows.length ? rows.map(c => {
        const same = c.merchant === pm.merchant;
        return `<div class="rcm-opt${sel.has(c.no) ? ' on' : ''}" data-no="${c.no}">
          <span class="rcm-ck">${sel.has(c.no) ? '✓' : ''}</span>
          <span class="rcm-main">${c.no}${c.sensitive ? ' <span class="risk-badge risk-hi">敏感</span>' : ''}<span class="rcm-sub">${c.merchant} · ${c.type} · ${c.alerts.length + c.orders.length} 关联</span></span>
          ${same ? '<span class="chip" style="background:var(--brand-soft);color:var(--brand);border-color:var(--blue-bd)">同主体</span>' : ''}
        </div>`;
      }).join('') : '<p class="rcm-muted">没有其他在办案件可并入。</p>';
      renderPrev();
    }
    function renderPrev() {
      const pm = cases.find(c => c.no === primary);
      const chosen = [...sel].filter(n => n !== primary).map(n => cases.find(c => c.no === n)).filter(Boolean);
      const A = new Set(pm.alerts), O = new Set(pm.orders); let s = pm.sensitive, cross = false;
      chosen.forEach(c => { c.alerts.forEach(x => A.add(x)); c.orders.forEach(x => O.add(x)); if (c.sensitive) s = 1; if (c.merchant !== pm.merchant) cross = true; });
      $('[data-el="prev"]').innerHTML = chosen.length
        ? `合并后 <b>${pm.no}</b> 将含 <b>${A.size}</b> 告警 / <b>${O.size}</b> 订单${s ? ' · <span style="color:var(--red)">敏感</span>' : ''}${cross ? '<div class="rcm-warn">⚠ 跨主体合并 — 请确认确为同一调查对象</div>' : ''}` : '';
      const go = $('[data-act="go"]'); go.disabled = !chosen.length;
      go.textContent = chosen.length ? `合并 ${chosen.length} 个案件 → ${pm.no}` : '合并';
    }
    priEl.addEventListener('change', () => { sel.delete(priEl.value); renderList(); });
    $('[data-el="list"]').addEventListener('click', e => { const o = e.target.closest('.rcm-opt'); if (!o) return; const no = o.dataset.no; sel.has(no) ? sel.delete(no) : sel.add(no); renderList(); });
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.dataset.act === 'close') return close();
      if (e.target.dataset.act === 'go') {
        const chosen = [...sel].filter(n => n !== primary); if (!chosen.length) return;
        RC_CASES.merge(primary, chosen); close();
        (onDone || (() => location.reload()))(primary);
      }
    });
    renderList();
  },
};

/* 通用表单弹窗 + Toast —— 各页「添加/新建」类操作复用。RCModal.form({title,desc,submitLabel,fields,onSubmit}) */
window.RCModal = {
  _styled: false,
  _ensure() {
    if (this._styled) return; this._styled = true;
    const s = document.createElement('style');
    s.textContent = `
      .rcf-ov{position:fixed;inset:0;background:rgba(18,21,27,.45);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;z-index:90;padding:56px 16px;overflow-y:auto}
      .rcf-dlg{background:var(--surface);width:100%;max-width:560px;border-radius:16px;box-shadow:var(--shadow-pop);overflow:hidden;animation:rcfIn .18s ease}
      @keyframes rcfIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      .rcf-head{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--line)}
      .rcf-head h3{font-size:16px;font-weight:700;margin:0}.rcf-head p{font-size:12.5px;color:var(--text-2);margin:4px 0 0}
      .rcf-x{width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--text-3);cursor:pointer;font-size:16px;line-height:1}
      .rcf-x:hover{background:var(--surface-2);color:var(--text)}
      .rcf-body{padding:18px 20px}
      .rcf-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .rcf-field{display:flex;flex-direction:column;gap:6px}.rcf-field.full{grid-column:1/-1}
      .rcf-field label{font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px}
      .rcf-in{height:38px;border:1px solid var(--line);border-radius:10px;padding:0 11px;font-family:inherit;font-size:13px;background:var(--surface);color:var(--text)}
      textarea.rcf-in{height:auto;padding:9px 11px;line-height:1.5}
      .rcf-in:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
      .rcf-foot{display:flex;gap:10px;padding:14px 20px;border-top:1px solid var(--line);background:var(--surface-3)}
      .rcf-foot .btn{flex:1;height:42px;justify-content:center;font-weight:600}
      #rcfToast{position:fixed;left:50%;bottom:30px;transform:translateX(-50%) translateY(20px);background:var(--text);color:#fff;padding:11px 18px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:var(--shadow-pop);opacity:0;transition:all .25s;pointer-events:none;z-index:120}
      #rcfToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      @media(max-width:560px){.rcf-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
    if (!document.getElementById('rcfToast')) { const t = document.createElement('div'); t.id = 'rcfToast'; document.body.appendChild(t); }
  },
  toast(m) { this._ensure(); const t = document.getElementById('rcfToast'); t.textContent = m; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 1900); },
  form(opt) {
    this._ensure();
    const fields = opt.fields || [];
    const opt2 = o => (typeof o === 'object') ? o : { value: o, label: o };
    const ctrl = f => {
      if (f.type === 'select') return `<select class="rcf-in" data-name="${f.name}">${f.options.map(o => { o = opt2(o); return `<option value="${o.value}">${o.label}</option>`; }).join('')}</select>`;
      if (f.type === 'textarea') return `<textarea class="rcf-in" data-name="${f.name}" placeholder="${f.placeholder || ''}">${f.value || ''}</textarea>`;
      return `<input class="rcf-in" data-name="${f.name}" placeholder="${f.placeholder || ''}" value="${f.value || ''}">`;
    };
    const ov = document.createElement('div'); ov.className = 'rcf-ov';
    ov.innerHTML = `<div class="rcf-dlg">
      <div class="rcf-head"><div><h3>${opt.title || ''}</h3>${opt.desc ? `<p>${opt.desc}</p>` : ''}</div><button class="rcf-x" data-act="close">✕</button></div>
      <div class="rcf-body"><div class="rcf-grid">${fields.map(f => `<div class="rcf-field${f.full ? ' full' : ''}"><label>${f.label}${f.required ? ' <span style="color:var(--red)">*</span>' : ''}</label>${ctrl(f)}</div>`).join('')}</div></div>
      <div class="rcf-foot"><button class="btn btn-ghost" data-act="close">取消</button><button class="btn btn-primary" data-act="go">${opt.submitLabel || '确定'}</button></div>
    </div>`;
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    const close = () => { ov.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.dataset.act === 'close') return close();
      if (e.target.dataset.act === 'go') {
        const v = {}; ov.querySelectorAll('[data-name]').forEach(el => v[el.dataset.name] = el.value.trim());
        const miss = fields.find(f => f.required && !v[f.name]);
        if (miss) { const el = ov.querySelector(`[data-name="${miss.name}"]`); el.focus(); el.style.borderColor = 'var(--red)'; return; }
        const r = opt.onSubmit ? opt.onSubmit(v) : true;
        if (r !== false) close();
      }
    });
    setTimeout(() => { const f = ov.querySelector('.rcf-in'); if (f) f.focus(); }, 30);
  },
  // 只读详情弹窗：任意 HTML 内容 + 自定义底部按钮
  dialog(opt) {
    this._ensure();
    const acts = opt.actions || [];
    const btns = acts.length
      ? acts.map((a, i) => `<button class="btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : a.kind === 'ghost' ? 'btn-ghost' : ''}" data-i="${i}">${a.label}</button>`).join('')
      : '<button class="btn btn-ghost" data-act="close" style="flex:1">关闭</button>';
    const ov = document.createElement('div'); ov.className = 'rcf-ov';
    ov.innerHTML = `<div class="rcf-dlg">
      <div class="rcf-head"><div><h3>${opt.title || ''}</h3>${opt.desc ? `<p>${opt.desc}</p>` : ''}</div><button class="rcf-x" data-act="close">✕</button></div>
      <div class="rcf-body">${opt.html || ''}</div>
      <div class="rcf-foot">${btns}</div>
    </div>`;
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    const close = () => { ov.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.dataset.act === 'close') return close();
      const b = e.target.closest('[data-i]');
      if (b) { const a = acts[+b.dataset.i]; const r = a.onClick ? a.onClick() : true; if (r !== false) close(); }
    });
    return { close };
  },
};

/* ── Shared risk & SLA renderers — used by case detail, transaction review and the case list.
   RC_RISK takes a {type, priority, lastScan?, sanctions?} descriptor so both case- and alert-based
   pages can build one profile. Cards reuse the rk / expo / sla classes from risk-design-system.css.
   The re-scan button calls window.rcRescan() — each page defines its own handler. */
window.RC_RISK = function (src) {
  src = src || {};
  const type = src.type || '', pr = src.priority || '中';
  const mixer = /混币|制裁|溯源|规避/.test(type), struct = /拆分|结构化|快进快出/.test(type);
  const kyw = mixer ? 86 : struct ? 64 : pr === '高' ? 72 : pr === '中' ? 48 : 28;
  const crr = mixer ? 91 : struct ? 68 : pr === '高' ? 77 : pr === '中' ? 52 : 33;
  const lvl = v => v >= 70 ? { t: '高', cls: 'risk-hi' } : v >= 40 ? { t: '中', cls: 'risk-md' } : { t: '低', cls: 'risk-lo' };
  const exposure = mixer
    ? [['混币器', 38, 'var(--red)'], ['未知来源', 24, 'var(--amber)'], ['高风险交易所', 16, 'var(--amber)'], ['合规来源', 22, 'var(--green)']]
    : [['合规来源', 64, 'var(--green)'], ['未知来源', 18, 'var(--amber)'], ['高风险交易所', 10, 'var(--amber)'], ['博彩', 8, 'var(--red)']];
  return { kyw, crr, kywLvl: lvl(kyw), crrLvl: lvl(crr), exposure,
           lastScan: src.lastScan || '2026-06-11 06:00', sanctions: src.sanctions || (mixer ? '间接命中 · OFAC 2 跳' : '未命中') };
};
window.RC_riskCard = function (r, opts) {
  opts = opts || {};
  const ringC = v => v >= 70 ? 'var(--red)' : v >= 40 ? 'var(--amber)' : 'var(--green)';
  const hit = /命中/.test(r.sanctions) && !/未命中/.test(r.sanctions);
  const expo = r.exposure.map(([l, v, col]) => `<div class="er"><span class="el">${l}</span><span class="eb"><span class="ef" style="width:${v}%;background:${col}"></span></span><span class="ev">${v}%</span></div>`).join('');
  const inner = `
    <div class="rk">
      <div class="rk-ring" style="--p:${r.kyw};--rkc:${ringC(r.kyw)}"><span class="rk-v">${r.kyw}</span></div>
      <div class="rk-meta">
        <div class="rk-row"><span class="lab">KYW 钱包评分</span><span class="risk-badge ${r.kywLvl.cls}">${r.kywLvl.t}风险</span></div>
        <div class="rk-row"><span class="lab">商户 CRR</span><span><b>${r.crr}</b> <span class="risk-badge ${r.crrLvl.cls}">${r.crrLvl.t}</span></span></div>
        <div class="rk-row"><span class="lab">制裁筛查</span><span style="font-weight:700;color:${hit ? 'var(--red)' : 'var(--text)'}">${r.sanctions}</span></div>
      </div>
    </div>
    <div class="expo">${expo}</div>
    <div class="rk-foot"><span class="scan">上次扫描 · ${r.lastScan} · Chainalysis</span>
      <button class="btn btn-sm" onclick="(window.rcRescan||function(){})()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:13px;height:13px"><path d="M21 3v6h-6M3 21v-6h6M21 9a9 9 0 0 0-15-3.5L3 9M3 15a9 9 0 0 0 15 3.5L21 15"/></svg>请求重新扫描</button>
    </div>`;
  if (opts.bare) return inner;
  const head = `<div class="card-head"><div class="card-title">客户与钱包风险</div><a class="btn-link" href="compliance-kyw.html">KYW 档案 ↗</a></div>`;
  return `<div class="card">${head}<div class="card-body">${inner}</div></div>`;
};
window.RC_slaCard = function (s) {
  const tone = s.left < 0 ? 'var(--red)' : s.left <= 7 ? 'var(--amber)' : 'var(--brand)';
  const bg = s.left < 0 ? 'var(--red-bg)' : s.left <= 7 ? 'var(--amber-bg)' : 'var(--blue-bg)';
  const bd = s.left < 0 ? 'var(--red-bd)' : s.left <= 7 ? 'var(--amber-bd)' : 'var(--blue-bd)';
  const pct = Math.max(3, Math.min(100, Math.round((30 - Math.max(s.left, 0)) / 30 * 100)));
  const note = s.left < 0 ? `已逾期 ${-s.left} 天 · 已自动升级 MLRO 并标记违规`
    : s.left <= 7 ? `距时限 ${s.left} 天 · 系统已提醒当前处理方加速处置`
    : `距时限 ${s.left} 天 · 进度正常`;
  return `<div class="card"><div class="card-head"><div class="card-title">报送时限 · STR 30 日</div></div>
    <div class="card-body"><div class="sla">
      <div class="sla-top"><span class="muted small">FINTRAC 报送截止 · ${s.due}</span><span class="sla-d" style="color:${tone}">${s.left < 0 ? '逾期' : s.left + ' 天'}</span></div>
      <div class="sla-track"><span class="sla-fill" style="width:${pct}%;background:${tone}"></span></div>
      <div class="sla-note" style="background:${bg};border:1px solid ${bd};color:${tone}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span>${note}</span></div>
    </div></div></div>`;
};
window.RC_slaChip = function (s) {
  if (!s.show) return '<span class="muted">—</span>';
  const tone = s.left < 0 ? { c: 'var(--red)', bg: 'var(--red-bg)' } : s.left <= 7 ? { c: 'var(--amber)', bg: 'var(--amber-bg)' } : { c: 'var(--green)', bg: 'var(--green-bg)' };
  const txt = s.left < 0 ? `逾期 ${-s.left} 天` : `${s.left} 天`;
  return `<span class="sla-chip" style="color:${tone.c};background:${tone.bg}" title="STR 报送截止 ${s.due}"><span class="pdot" style="background:${tone.c}"></span>${txt}</span>`;
};

(function () {
  const I = {
    home:   '<path d="M3 12l9-9 9 9M5 10v10h14V10"/>',
    bell:   '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    list:   '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    grid:   '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    chart:  '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    refresh:'<path d="M21 3v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 9"/><path d="M3 21v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 15"/>',
    hash:   '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    file:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM5 4H4v2a3 3 0 0 0 3 3M19 4h1v2a3 3 0 0 1-3 3"/>',
    funnel: '<path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/>',
    branch: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="9" r="3"/><path d="M18 12a9 9 0 0 1-9 9M6 9v6"/>',
    gear:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 5 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 3.6V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21 9h.6a2 2 0 0 1 0 4H21z"/>',
  };
  const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${I[k] || ''}</svg>`;

  const NAV = [
    { page:'dashboard',  href:'rc-dashboard.html',  label:'风控仪表盘', icon:'home' },
    { page:'value',      href:'rc-value.html',      label:'风控价值看板', icon:'trophy' },
    { group:'监控运营' },
    { page:'alerts',     href:'rc-alerts.html',     label:'告警工作台', icon:'bell',   tag:'12' },
    { page:'monitoring', href:'rc-monitoring.html', label:'事中监控',   icon:'search', tag:'10' },
    { group:'检测策略' },
    { page:'rules',      href:'rc-rules.html',      label:'规则列表',   icon:'list',   tag:'12' },
    { page:'rule-editor',href:'rc-rule-editor.html',label:'规则编辑器', icon:'sliders' },
    { page:'backtest',   href:'rc-backtest.html',   label:'回测模拟',   icon:'grid' },
    { page:'rule-perf',  href:'rc-rule-perf.html',  label:'规则效果',   icon:'chart', tag:'8' },
    { page:'governance', href:'rc-rule-governance.html', label:'变更治理', icon:'branch' },
    { group:'治理与合规' },
    { page:'strategy',   href:'rc-strategy.html',   label:'全局策略',   icon:'hash' },
    { page:'lists',      href:'rc-lists.html',      label:'名单管理',   icon:'shield' },
    { page:'cases',      href:'rc-cases.html',      label:'案件管理',   icon:'folder' },
    { page:'reports',    href:'rc-reports.html',    label:'报告报送',   icon:'file' },
    { page:'audit',      href:'rc-audit.html',      label:'审计日志',   icon:'clock' },
  ];

  // Compliance sees a focused cluster; 案件管理 is the shared node both teams collaborate in.
  const NAV_COMPLIANCE = [
    { page:'dashboard', href:'rc-dashboard.html', label:'合规仪表盘', icon:'home' },
    { group:'合规与治理' },
    { page:'cases',   href:'rc-cases.html',   label:'案件管理', icon:'folder' },
    { page:'reports', href:'rc-reports.html', label:'报告报送', icon:'file' },
    { page:'lists',   href:'rc-lists.html',   label:'名单管理', icon:'shield' },
    { page:'audit',   href:'rc-audit.html',   label:'审计日志', icon:'clock' },
  ];
  function renderSidebar(active) {
    const role = (window.RC_ROLE ? RC_ROLE.get() : 'rc');
    const nav = role === 'compliance' ? NAV_COMPLIANCE : NAV;
    const items = nav.map(n => {
      if (n.group) return `<div class="sb-group">${n.group}</div>`;
      const on = n.page === active ? ' active' : '';
      const tagVal = (n.page === 'rules' && window.RC_RULES) ? window.RC_RULES.length : n.tag;
      const tag = tagVal ? `<span class="sb-tag">${tagVal}</span>` : '';
      return `<a class="sb-item${on}" href="${n.href}">${svg(n.icon)}${n.label}${tag}</a>`;
    }).join('');
    return `
      <div class="sb-logo"><div class="sb-logo-mark">F</div><div class="sb-logo-text">Future<span>Pay</span>CA</div></div>
      <nav class="sb-nav">${items}</nav>`;
  }

  function renderTopbar(crumb) {
    const parts = (crumb || '').split('·').map(s => s.trim()).filter(Boolean);
    const trail = parts.map((p, i) =>
      i === parts.length - 1
        ? `<span class="cur">${p}</span>`
        : `<span>${p}</span><span class="sep">/</span>`
    ).join('');
    const role = (window.RC_ROLE ? RC_ROLE.cur() : { key:'rc', actor:{i:'JS',c:'var(--brand)'} });
    const opt = k => `<option value="${k}"${role.key===k?' selected':''}>${RC_ROLE.ROLES[k].label}</option>`;
    const roleSel = window.RC_ROLE ? `<select id="roleSel" title="切换角色（演示）" style="height:32px;border:1px solid var(--line);border-radius:8px;padding:0 8px;background:var(--surface);color:var(--text);font-size:12.5px;font-weight:600;font-family:inherit;cursor:pointer">${opt('rc')}${opt('l2')}${opt('compliance')}</select>` : '';
    return `
      <div class="crumb">${trail}</div>
      <div class="topbar-right">
        ${roleSel}
        <button class="icon-btn"><span class="dot"></span>${svg('bell')}</button>
        <button class="icon-btn">${svg('gear')}</button>
        <div class="avatar" style="background:${role.actor.c}">${role.actor.i}</div>
      </div>`;
  }

  function wire() {
    // toggle switches
    document.querySelectorAll('.switch').forEach(s =>
      s.addEventListener('click', () => s.classList.toggle('off')));
    // tab ↔ panel
    document.querySelectorAll('.tab[data-tab]').forEach(t =>
      t.addEventListener('click', () => {
        const tabs = t.parentNode.querySelectorAll('.tab');
        tabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const id = t.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.dataset.panel !== id; });
      }));
    // segmented controls
    document.querySelectorAll('.seg').forEach(seg =>
      seg.querySelectorAll('button').forEach(b =>
        b.addEventListener('click', () => {
          seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          if (b.dataset.filter) {
            const f = b.dataset.filter, scope = seg.dataset.scope || 'tr[data-row]';
            document.querySelectorAll(scope).forEach(r => {
              const tokens = (r.dataset.row || '').split(/\s+/);
              r.style.display = (f === 'all' || tokens.includes(f)) ? '' : 'none';
            });
          }
        })));
    // stat-card highlight
    document.querySelectorAll('.stat-row').forEach(row =>
      row.querySelectorAll('.stat').forEach(s =>
        s.addEventListener('click', () => {
          row.querySelectorAll('.stat').forEach(x => x.classList.remove('active'));
          s.classList.add('active');
        })));
    // role switcher (prototype) — re-render the whole page under the new role
    const rs = document.getElementById('roleSel');
    if (rs) rs.addEventListener('change', () => { RC_ROLE.set(rs.value); location.reload(); });
  }

  function init() {
    const b = document.body;
    const sb = document.getElementById('rcSidebar');
    const tb = document.getElementById('rcTopbar');
    if (sb) sb.innerHTML = renderSidebar(b.dataset.page);
    if (tb) tb.innerHTML = renderTopbar(b.dataset.crumb);
    wire();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
