/* Shared 告警研判 · 处置结论 modal — used by 告警工作台 (rc-alerts.html) and 审核决策 detail (rc-review.html).
   Single source of truth for the alert review flow. Call RCReview.open(alertId, {onDone}) — onDone runs after submit
   (defaults to a page reload). Depends on globals from rc-alerts-data.js (RC_ALERTS / RC / RC_STATES) and rc-shell.js (RC_CASES). */
(function () {
  let RV = null, onDoneCb = null, styled = false, marked = false;
  const L1 = { i:'JL', n:'James Liu', c:'var(--brand)' };

  function ensureStyle() {
    if (styled) return; styled = true;
    const s = document.createElement('style');
    s.textContent = `
      .ov{position:fixed;inset:0;background:rgba(18,21,27,.45);backdrop-filter:blur(2px);display:none;align-items:flex-start;justify-content:center;z-index:60;padding:40px 16px;overflow-y:auto}
      .ov.open{display:flex}
      .dlg{background:var(--surface);width:100%;max-width:548px;border-radius:16px;box-shadow:var(--shadow-pop);overflow:hidden;animation:dlgIn .18s ease}
      @keyframes dlgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      .dlg-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line)}
      .dlg-head h3{font-size:16px;font-weight:700}
      .dlg-x{width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--text-3);cursor:pointer;display:flex;align-items:center;justify-content:center}
      .dlg-x svg{width:18px;height:18px}
      .dlg-x:hover{background:var(--surface-2);color:var(--text)}
      .dlg-body{padding:18px 20px;max-height:calc(100vh - 210px);overflow-y:auto}
      .dlg-foot{display:flex;gap:10px;padding:14px 20px;border-top:1px solid var(--line);background:var(--surface-3)}
      .dlg-foot .btn{flex:1;height:42px;justify-content:center;font-weight:600}
      .ai-sum{font-size:12px;color:var(--text-2);line-height:1.55}
      .ai-rec{border-top:1px solid var(--violet-bd);padding-top:9px;margin-top:10px;font-size:12.5px;display:flex;align-items:center;gap:6px}
      .who{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600;margin-top:4px}
      .who .role{font-size:11px;font-weight:600;color:var(--text-3);background:var(--surface-2);padding:2px 8px;border-radius:999px;margin-left:auto}
      .sec-lbl{font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin:18px 0 9px}
      .disp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .proc-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .rel-order{display:flex;align-items:center;gap:11px;margin-top:14px;padding:11px 13px;border:1px solid var(--amber-bd);background:var(--amber-bg);border-radius:11px;text-decoration:none;color:var(--text)}
      .rel-order:hover{filter:brightness(.985)}
      .rel-order .ro-ico{width:30px;height:30px;border-radius:8px;background:var(--surface);border:1px solid var(--amber-bd);display:flex;align-items:center;justify-content:center;color:var(--amber);flex-shrink:0}
      .rel-order .ro-ico svg{width:16px;height:16px}
      .rel-order .ro-txt{display:flex;flex-direction:column;gap:1px;flex:1;font-size:12.5px}
      .rel-order .ro-txt b{font-weight:700}
      .rel-order .ro-txt span{font-size:11px;color:var(--text-2)}
      .rel-order .ro-go{font-size:12px;font-weight:600;color:var(--amber);white-space:nowrap}
      .disp{border:1.5px solid var(--line);background:var(--surface);border-radius:11px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--text-2);transition:all .12s}
      .disp svg{width:18px;height:18px}
      .disp:hover{border-color:var(--blue-bd);background:var(--brand-softer)}
      .disp.on{border-color:var(--brand);background:var(--brand-soft);color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
      .proc{border:1px solid var(--line);background:var(--surface);border-radius:9px;padding:9px 5px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text-2);transition:all .12s}
      .proc svg{width:16px;height:16px}
      .proc:hover{background:var(--surface-2);color:var(--text)}
      .proc.on{border-color:var(--violet);background:var(--violet-bg);color:var(--violet)}
      .impact{display:flex;gap:10px;background:var(--blue-bg);border:1px solid var(--blue-bd);border-radius:10px;padding:11px 13px;margin-top:12px;font-size:12px;color:var(--text);line-height:1.55}
      .impact svg{width:16px;height:16px;color:var(--brand);flex-shrink:0;margin-top:1px}
      .impact.tone-green{background:var(--green-bg);border-color:var(--green-bd)} .impact.tone-green svg{color:var(--green)}
      .impact.tone-amber{background:var(--amber-bg);border-color:var(--amber-bd)} .impact.tone-amber svg{color:var(--amber)}
      .impact.tone-red{background:var(--red-bg);border-color:var(--red-bd)} .impact.tone-red svg{color:var(--red)}
      .impact.tone-violet{background:var(--violet-bg);border-color:var(--violet-bd)} .impact.tone-violet svg{color:var(--violet)}
      .fld{margin-top:14px}
      .fld>label{display:block;font-size:12.5px;font-weight:600;margin-bottom:6px}
      .fld .req{color:var(--red)}
      .fsel,.ftxt{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 11px;font-family:inherit;font-size:13px;color:var(--text);background:var(--surface)}
      .fsel:focus,.ftxt:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
      .ftxt{min-height:70px;resize:vertical}
      .fld.err .fsel,.fld.err .ftxt{border-color:var(--red);box-shadow:0 0 0 3px var(--red-bg)}
      .fld.err>label{color:var(--red)}
      #rvFields .fld{margin-top:14px}
      .opts{display:flex;flex-wrap:wrap;gap:7px}
      .optchip{padding:7px 11px;border:1px solid var(--line);border-radius:9px;font-size:12px;font-weight:600;color:var(--text-2);cursor:pointer;display:inline-flex;align-items:center;gap:6px;user-select:none;transition:all .12s}
      .optchip:hover{background:var(--surface-2)}
      .optchip::before{content:"+";font-size:13px;line-height:1;color:var(--text-3)}
      .optchip.on{border-color:var(--brand);background:var(--brand-soft);color:var(--brand)}
      .optchip.on::before{content:"✓";color:var(--brand)}
      .fld.err .opts{border-radius:10px;outline:2px solid var(--red-bg)}
      .ev{display:flex;align-items:flex-start;gap:9px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;margin-top:8px;cursor:pointer}
      .ev:hover{background:var(--surface-3)}
      .ev input{width:16px;height:16px;accent-color:var(--brand);margin-top:1px;cursor:pointer;flex-shrink:0}
      .ev-t{font-size:12.5px;font-weight:600}.ev-d{font-size:11px;color:var(--text-2);margin-top:1px}
      #rvToast{position:fixed;left:50%;bottom:30px;transform:translateX(-50%) translateY(20px);background:var(--text);color:#fff;padding:11px 18px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:var(--shadow-pop);opacity:0;transition:all .25s;pointer-events:none;z-index:90}
      #rvToast.show{opacity:1;transform:translateX(-50%) translateY(0)}`;
    document.head.appendChild(s);
  }

  function ensureMarkup() {
    if (marked) return; marked = true;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="ov" id="rvOv">
      <div class="dlg">
        <div class="dlg-head"><h3>告警研判 · 处置结论</h3>
          <button class="dlg-x" data-act="close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>
        <div class="dlg-body" id="rvBody"></div>
        <div class="dlg-foot">
          <button class="btn btn-ghost" data-act="close">取消</button>
          <button class="btn btn-primary" data-act="submit">提交决定</button>
        </div>
      </div>
    </div>`;
    const ov = wrap.firstElementChild;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.dataset.act === 'close') closeReview();
      else if (e.target.dataset.act === 'submit') submitReview();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeReview(); });
  }

  function toast(m) {
    let t = document.getElementById('toast') || document.getElementById('rvToast');
    if (!t) { t = document.createElement('div'); t.id = 'rvToast'; document.body.appendChild(t); }
    t.textContent = m; t.classList.add('show'); clearTimeout(window._rvtt);
    window._rvtt = setTimeout(() => t.classList.remove('show'), 1700);
  }

  const ICO = {
    star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6L5.7 21l2.3-7.2-6-4.4h7.6z"/></svg>',
    ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg>',
    case:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    gate:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  };

  function aiRec(a) {
    if (a.sanctions.status === '直接命中') return { k:'case', conf:97 };
    if (a.sev === 'high') return { k:'case', conf:88 };
    if (a.sev === 'mid')  return { k:'release', conf:84 };
    return { k:'release', conf:92 };
  }

  const DISP = [
    { k:'release', label:'放行结案', ico:ICO.ok },
    { k:'case',    label:'建案调查', ico:ICO.case },
    { k:'watch',   label:'加入名单', ico:ICO.shield },
  ];
  const PROC = [
    { k:'reqinfo', label:'请求信息', ico:ICO.doc },
    { k:'l2',      label:'升级至L2', ico:ICO.up },
  ];
  const REASONS = {
    release:['证据充分，链上溯源风险可控','商户补充材料已核实','与历史交易模式一致','信号为低风险，无需上报','误报 · 规则需调优','其他（见研判依据）'],
    case:   ['需多笔交易关联调查','商户主体存在结构性风险','链上资金路径需深挖','疑似分层洗钱 / 结构化拆分','链上溯源触及制裁实体','其他（见研判依据）'],
    watch:  ['对手地址加入黑名单','商户加入加强监控名单','对手地址加入关注名单','关联群组加入观察名单','其他（见研判依据）'],
    reqinfo:['要求补充 KYB / KYC 资料','要求提供资金来源证明','要求说明交易用途','要求补充收款方关系证明','其他（见研判依据）'],
    l2:     ['风险超 L1 处置权限','需高级别复核确认','处置存在分歧，需二级研判','其他（见研判依据）'],
  };
  const LABELS = {}; [...DISP, ...PROC].forEach(o => LABELS[o.k] = o.label);

  const IMPACT = {
    release:a=>`结案放行后本告警关闭，关联在途订单 <b>${a.order}</b> 解除风控标记 — 实际${a.type==='提现'?'出金':'入账'}由「事中监控」闸口执行。记入审计日志，供 L2 / 合规复核。`,
    case:   a=>`按商户聚合：并入 <b>${a.merchant}</b> 的在办案件（无则新建），关联本告警与在途订单 <b>${a.order}</b>。STR 起草与报送在「案件管理」中进行。`,
    watch:  a=>`对手地址 / 商户写入风控名单，后续同类交易将按名单规则自动处置；本告警据此结案。`,
    reqinfo:a=>`向商户发起补充材料请求，告警转「待补充材料」，SLA 计时暂停；资料回补后重新进入研判。`,
    l2:     a=>`移交 L2 高级审核员复核，告警转「待 L2 复核」；L1 处置建议与依据一并提交，由 L2 作出最终结论。`,
  };
  const ITONE = { release:'tone-green', case:'tone-violet', watch:'tone-amber', reqinfo:'', l2:'tone-violet' };

  const FIELDS = {
    release:[ {k:'followup', label:'后续监控', type:'multi', required:false, options:['纳入加强监控','列入复盘样本','加入可信白名单']} ],
    case:[
      {k:'casetype', label:'案件类型', type:'select', required:true,  options:['可疑洗钱','制裁规避','欺诈交易','结构化拆分','其他']},
      {k:'priority', label:'案件优先级', type:'select', required:true, options:['高','中','低']},
      {k:'scope',    label:'调查范围', type:'multi',  required:true,  options:['本订单','该商户全部交易','关联群组','对手地址簇']},
    ],
    watch:[
      {k:'listtype', label:'名单类型', type:'select', required:true, options:['黑名单','加强监控名单','关注名单','观察名单']},
      {k:'entities', label:'列入对象', type:'multi',  required:true, options:['发送方地址','收款方地址','商户主体','关联群组']},
      {k:'duration', label:'有效期',   type:'select', required:true, options:['永久','180 天','90 天','1 年']},
    ],
    reqinfo:[
      {k:'materials', label:'需补充材料', type:'multi', required:true, options:['KYB 主体证明','资金来源证明','交易用途说明','收款方关系证明','银行流水 / 对账单','受益所有人 (UBO) 信息']},
      {k:'deadline',  label:'回复时限',  type:'select', required:true, options:['24 小时','48 小时','72 小时']},
    ],
    l2:[
      {k:'assignee', label:'指派 L2 审核员', type:'select', required:true, options:['自动分配','David Wu (L2)','Emma Zhang (L2)']},
      {k:'urgency',  label:'紧急度', type:'select', required:true, options:['常规','加急']},
    ],
  };
  function renderFields(choice) {
    return (FIELDS[choice]||[]).map(f=>`
      <div class="fld" data-field="${f.k}" data-type="${f.type}" data-req="${!!f.required}">
        <label>${f.label} ${f.required?'<span class="req">*</span>':'<span class="muted" style="font-weight:400">· 选填</span>'}</label>
        ${f.type==='multi'
          ? `<div class="opts">${f.options.map(o=>`<span class="optchip" data-val="${o}" onclick="this.classList.toggle('on')">${o}</span>`).join('')}</div>`
          : `<select class="fsel"><option value="">请选择…</option>${f.options.map(o=>`<option>${o}</option>`).join('')}</select>`}
      </div>`).join('');
  }
  function collectFields() {
    const wrap = document.getElementById('rvFields'); const parts=[], values={}; let firstErr=null;
    wrap.querySelectorAll('.fld[data-field]').forEach(fl=>{
      const req=fl.dataset.req==='true', lbl=fl.querySelector('label').textContent.replace('*','').replace('· 选填','').trim();
      let vals = fl.dataset.type==='multi'
        ? [...fl.querySelectorAll('.optchip.on')].map(c=>c.dataset.val)
        : (fl.querySelector('select').value ? [fl.querySelector('select').value] : []);
      if(req && !vals.length){ if(!firstErr) firstErr=fl; fl.classList.add('err'); } else fl.classList.remove('err');
      values[fl.dataset.field]=vals;
      if(vals.length) parts.push(`${lbl}：${vals.join('、')}`);
    });
    return { ok:!firstErr, summary:parts.join(' · '), values, firstErr };
  }

  function applyDispUI() {
    document.querySelectorAll('.disp').forEach(d=>d.classList.toggle('on',d.dataset.disp===RV.disp));
    document.querySelectorAll('.proc').forEach(p=>p.classList.toggle('on',p.dataset.proc===RV.proc));
    const choice=RV.disp||RV.proc;
    const a=(window.RC_ALERTS||[]).find(x=>x.id===RV.id);
    const imp=document.getElementById('rvImpact'), rf=document.getElementById('rvReasonFld'), fw=document.getElementById('rvFields');
    if(imp){
      if(choice){ imp.style.display='flex'; imp.className='impact '+(ITONE[choice]||''); document.getElementById('rvImpactTxt').innerHTML=IMPACT[choice](a); }
      else imp.style.display='none';
    }
    if(fw) fw.innerHTML = choice ? renderFields(choice) : '';
    if(!rf) return;
    if(choice){
      rf.style.display='block'; rf.classList.remove('err');
      const sel=document.getElementById('rvReason'), prev=sel.value;
      document.getElementById('rvReasonLbl').innerHTML=`${LABELS[choice]} · 原因 <span class="req">*</span>`;
      sel.innerHTML='<option value="">请选择…</option>'+REASONS[choice].map(r=>`<option>${r}</option>`).join('');
      if(REASONS[choice].includes(prev)) sel.value=prev;
    } else { rf.style.display='none'; }
  }
  window.selDisp = function(k){ RV.disp=(RV.disp===k?null:k); RV.proc=null; applyDispUI(); };
  window.selProc = function(k){ RV.proc=(RV.proc===k?null:k); RV.disp=null; applyDispUI(); };
  window.closeReview = function(){ const ov=document.getElementById('rvOv'); if(ov) ov.classList.remove('open'); document.body.style.overflow=''; RV=null; };

  const SUBMIT = {
    release:{state:'closed_done', label:()=>'放行结案'},
    case:   {state:'closed_case', label:()=>'建案调查'},
    watch:  {state:'closed_done', label:()=>'加入监控名单'},
    reqinfo:{state:'pending',     label:()=>'请求补充信息'},
    l2:     {state:'pending_l2',  label:()=>'升级至 L2 复核'},
  };

  window.submitReview = function(){
    if(!RV) return;
    const a=(window.RC_ALERTS||[]).find(x=>x.id===RV.id);
    const choice=RV.disp||RV.proc;
    if(!choice){ toast('请选择处置结论或流程操作'); return; }
    const reasonEl=document.getElementById('rvReason'), basisEl=document.getElementById('rvBasis');
    document.querySelectorAll('#rvBody .fld.err').forEach(f=>f.classList.remove('err'));
    if(reasonEl && !reasonEl.value){ document.getElementById('rvReasonFld').classList.add('err'); reasonEl.focus(); toast(`请选择「${LABELS[choice]}」的原因`); return; }
    if(reasonEl && reasonEl.value.indexOf('其他')===0 && basisEl && !basisEl.value.trim()){ basisEl.closest('.fld').classList.add('err'); basisEl.focus(); toast('选择「其他」需在研判依据中说明'); return; }
    const ff=collectFields();
    if(!ff.ok){ ff.firstErr.scrollIntoView({block:'center',behavior:'smooth'}); toast(`请补全「${LABELS[choice]}」所需信息`); return; }
    const cfg=SUBMIT[choice];
    let extra='';
    if(choice==='case' && window.RC_CASES){
      const ct=(ff.values.casetype&&ff.values.casetype[0])||a.title;
      const res=RC_CASES.intake({merchant:a.merchant, type:ct, priority:(ff.values.priority&&ff.values.priority[0])||'中', scope:ff.values.scope||[], amount:a.amount, owner:L1, alertId:a.id, orderId:a.order});
      extra=(res.created?'新建案件 ':'并入案件 ')+res.caseNo;
    }
    const reason=[reasonEl&&reasonEl.value, ff.summary, basisEl&&basisEl.value.trim(), extra].filter(Boolean).join(' · ');
    RC.set(RV.id, cfg.state, {assignee:L1, event:cfg.label(a)+'（L1 '+L1.n+'）', reason});
    toast(choice==='case' ? '已'+extra+' → 案件管理' : '已提交 · '+cfg.label(a));
    const cb = onDoneCb || (()=>location.reload());
    closeReview();
    setTimeout(cb, 700);
  };

  function open(id, opts) {
    ensureStyle(); ensureMarkup();
    const a=(window.RC_ALERTS||[]).find(x=>x.id===id); if(!a) return;
    onDoneCb = (opts && opts.onDone) || null;
    const state=RC.state(id), ss=RC_STATES[state];
    const sevMeta={high:['高风险','p-red'],mid:['中风险','p-amber'],low:['低风险','p-blue']}[a.sev];
    const rec=aiRec(a);
    const recLabel=DISP.find(d=>d.k===rec.k).label;
    RV={ id, disp:ss.active?rec.k:null, proc:null };
    const closed = !ss.active;
    const summary=a.factors.map(f=>f[3]).join(' · ');

    document.getElementById('rvBody').innerHTML=`
      <div class="ai-box">
        <div class="ai-head">${ICO.star}AI 风险研判<span class="pill ${sevMeta[1]}" style="margin-left:auto"><span class="pdot"></span>${sevMeta[0]}</span></div>
        <p class="ai-sum">${summary}</p>
        <p class="ai-rec"><b>建议结论：</b><span style="color:var(--brand);font-weight:700">${recLabel}</span><span class="muted">（置信度 ${rec.conf}%）</span></p>
      </div>

      <a class="rel-order" href="rc-monitoring.html">
        <span class="ro-ico">${ICO.gate}</span>
        <span class="ro-txt"><b>关联在途订单 ${a.order}</b><span>资金暂缓中 · 实际放行/拒绝在事中监控闸口执行</span></span>
        <span class="ro-go">前往闸口 →</span>
      </a>

      <div class="who" style="margin-top:14px"><span class="avatar" style="width:26px;height:26px;font-size:10px;background:${L1.c}">${L1.i}</span>${L1.n} 研判操作<span class="role">L1 调查</span></div>

      ${closed?`<div class="impact" style="background:var(--surface-2);border-color:var(--line);color:var(--text-2)"><span>本告警已关闭 · <b>${ss.label.replace('已结 · ','')}</b>。如需变更请重新打开。</span></div>`:`
      <div class="sec-lbl">处置结论</div>
      <div class="disp-grid">${DISP.map(d=>`<div class="disp" data-disp="${d.k}" onclick="selDisp('${d.k}')">${d.ico}${d.label}</div>`).join('')}</div>

      <div class="sec-lbl">流程操作</div>
      <div class="proc-grid">${PROC.map(p=>`<div class="proc" data-proc="${p.k}" onclick="selProc('${p.k}')">${p.ico}${p.label}</div>`).join('')}</div>

      <div id="rvImpact" class="impact" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg><span id="rvImpactTxt"></span></div>

      <div class="fld" id="rvReasonFld" style="display:none"><label id="rvReasonLbl">原因 <span class="req">*</span></label>
        <select class="fsel" id="rvReason"><option value="">请选择…</option></select></div>

      <div id="rvFields"></div>

      <div class="fld"><label id="rvBasisLbl">研判依据 <span class="muted" style="font-weight:400">· 选填</span></label>
        <textarea class="ftxt" id="rvBasis" placeholder="描述链上溯源、证据与补充材料如何支撑该结论，以及与历史订单的对比…（记入审计日志）"></textarea></div>

      <div class="sec-lbl">关联证据材料 · L2 复核重点</div>
      <label class="ev"><input type="checkbox" ${a.kyb==='完成'?'checked':''}><span><span class="ev-t">商户补充材料</span><span class="ev-d">${a.merchant} · KYB ${a.kyb}</span></span></label>
      <label class="ev"><input type="checkbox" checked><span><span class="ev-t">历史订单参考</span><span class="ev-d">类似订单放行率 68% · 历史违规 ${a.custHistory.violations}</span></span></label>
      `}`;

    const foot=document.querySelector('#rvOv .dlg-foot'); if(foot) foot.style.display=closed?'none':'flex';
    if(!closed && RV.disp) applyDispUI();
    document.getElementById('rvOv').classList.add('open');
    document.body.style.overflow='hidden';
  }

  window.RCReview = { open };
  window.openReview = open;   // back-compat alias for 告警工作台 row/审核 onclick
})();
