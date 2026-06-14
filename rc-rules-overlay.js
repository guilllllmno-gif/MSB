/* 规则覆盖层 —— 让「变更治理·上线」真正回写规则配置。
   原型里 rc-rules-data.js 是静态的；本层用 localStorage 存"已上线变更"的覆盖值，
   在每个页面加载 RC_RULES 之后就地打补丁，使列表/详情/回测/效果都显示最新生效版本。
   存的是【完整字段快照】(name/weight/action/cond/params/version/changelog)，支持版本回滚。
   依赖：必须在 rc-rules-data.js 之后引入；引入即自动 apply()。 */
window.RC_RULES_OVERLAY = {
  _key: 'rc_rules_overlay_v2',
  _load() { try { return JSON.parse(localStorage.getItem(this._key)) || {}; } catch (e) { return {}; } },
  _save(o) { try { localStorage.setItem(this._key, JSON.stringify(o)); } catch (e) {} },
  _today() { const d = new Date(); const p = n => ('0' + n).slice(-2); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; },
  _clone(o) { return JSON.parse(JSON.stringify(o)); },

  // 当前规则的完整可变配置快照
  snap(r) { return this._clone({ name:r.name, weight:r.weight, action:r.action, cond:r.cond, params:r.params||[], version:r.version, changelog:r.changelog||[] }); },

  // 启动时把已存覆盖打到 window.RC_RULES 上（每页加载后调用一次）
  apply() {
    const ov = this._load(); if (!window.RC_RULES) return;
    window.RC_RULES.forEach(r => { const e = ov[r.id]; if (e && e.current) Object.assign(r, e.current); });
  },

  // 把阈值数字写进首个含数字的参数 + cond 表达式（保留 CAD/跳 等单位文字）
  _setThreshold(cfg, thr) {
    const num = String(thr).replace(/[^\d.]/g, ''); if (!num) return;
    const fmt = Number(num).toLocaleString();
    const p = (cfg.params || []).find(x => /\d/.test(x[2]));
    if (p) p[2] = p[2].replace(/[\d,]+(\.\d+)?/, fmt);
    if (cfg.cond) cfg.cond = cfg.cond.replace(/[\d,]+(\.\d+)?/, fmt);
  },

  // CR 上线 → 生成新版本、回写、留快照
  applyChange(ruleId, patch, meta) {
    if (!ruleId || !patch) return null;
    const ov = this._load();
    const r = (window.RC_RULES || []).find(x => x.id === ruleId); if (!r) return null;
    const before = this.snap(r);
    const next = this.snap(r);
    if (patch.name)   next.name = patch.name;
    if (patch.weight) next.weight = patch.weight;
    if (patch.action) next.action = patch.action;            // [label, cls]
    if (patch.threshold != null && patch.threshold !== '') this._setThreshold(next, patch.threshold);
    const vn = (parseInt(String(before.version).replace(/\D/g, '')) || 1) + 1;
    next.version = 'v' + vn;
    next.changelog = [[ (meta && meta.date) || this._today(), (meta && meta.by) || 'MLRO',
                        (meta && meta.summary) || ('变更上线' + (meta && meta.no ? ' · ' + meta.no : '')) ],
                      ...(before.changelog || [])];
    const e = ov[ruleId] || { history: [] };
    e.history = e.history || []; e.history.push(before);     // 压入上一版本，供回滚
    e.current = next;
    ov[ruleId] = e; this._save(ov);
    Object.assign(r, next);                                  // 立即生效（本页）
    return next;
  },

  // 回滚到上一版本（弹出最近一次变更前的快照并还原；还原到基线则清除覆盖）
  rollback(ruleId) {
    const ov = this._load(); const e = ov[ruleId];
    if (!e || !e.history || !e.history.length) return null;
    const prev = e.history.pop();   // 上一版本配置（即最近一次变更前的快照）
    e.current = prev;
    if (!e.history.length) delete ov[ruleId];   // 已回到最早快照（基线）→ 移除覆盖
    this._save(ov);
    return prev;   // 立即生效需调用方刷新页面
  },

  has(ruleId) { const e = this._load()[ruleId]; return !!(e && e.current); },
  reset() { try { localStorage.removeItem(this._key); } catch (e) {} },
};
window.RC_RULES_OVERLAY.apply();
