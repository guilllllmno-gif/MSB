/*
 * FuturePayCA · 回测引擎 (Backtest Engine)
 * ───────────────────────────────────────────────────────────────────────
 * 纯 Node、零依赖。职责：
 *   1) 单一数据源 —— 直接加载前端的 rc-rules-data.js（用 vm 沙箱执行），不重复维护规则。
 *   2) 数据集 —— 优先读 server/data/<ruleId>.csv（真实历史交易：score,label），
 *      没有则用「按规则 fp 确定性生成」的带标注模拟总体（与前端回退算法一致）。
 *   3) 阈值扫描 —— 在数据集上逐阈值(0..100)计算混淆矩阵 TP/FP/FN/TN，
 *      导出 命中量/误报率/精确率/召回率/F1，并求最优阈值（F1 最高 + 召回≥90% 下误报最低）。
 *   4) 回测摘要 —— 命中量、拦截金额、基线对比、每日分布、命中样本对照。
 *
 * 这套算法与前端 rc-backtest.html 的本地回退函数逐字对应，所以「后端」与「离线」结果一致。
 * 把真实交易放到 server/data/<ruleId>.csv 即可让引擎跑真实数据，无需改任何代码。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');

// ── 单一数据源：执行 rc-rules-data.js 抓取 window.RC_RULES（每次调用重读，规则改动即时生效）──
function loadRules() {
  const code = fs.readFileSync(path.join(ROOT, 'rc-rules-data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.RC_RULES || [];
}

const POOL = { deposit: 96420, withdraw: 64280, chain: 38150, both: 112400 };
const AVG  = { deposit: 8300,  withdraw: 11200, chain: 6400,  both: 9500 };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pInt  = v => (v === '—' || v == null) ? 0 : (parseInt(v) || 0);

// mulberry32 — 可复现伪随机：同一规则永远同一总体
function makeRNG(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── 数据集：CSV(真实) 或 确定性模拟总体 ──
function dataset(rule) {
  const csv = path.join(DATA_DIR, rule.id + '.csv');
  if (fs.existsSync(csv)) {
    const lines = fs.readFileSync(csv, 'utf8').trim().split(/\r?\n/);
    const header = lines.shift().split(',').map(s => s.trim().toLowerCase());
    const si = header.indexOf('score'), li = header.indexOf('label');
    const pop = lines.map(l => {
      const c = l.split(',');
      return { score: clamp(Math.round(+c[si]), 0, 100), risky: +c[li] === 1 };
    });
    return { pop, totalRisky: pop.filter(p => p.risky).length, N: pop.length, dataSource: 'csv' };
  }
  const N = 4000, prevalence = 0.04;
  const rng = makeRNG(hashStr(rule.id));
  const gauss = (m, sd) => { const u = Math.max(1e-9, rng()), v = rng(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const fp = pInt(rule.fp);                          // fp 越高 → 正常样本评分被抬高 → 两类越重叠、越难分
  const riskyMean = 80, riskySd = 12, normMean = 28 + fp * 0.5, normSd = 15;
  const pop = []; let totalRisky = 0;
  for (let i = 0; i < N; i++) {
    const risky = rng() < prevalence; if (risky) totalRisky++;
    const score = clamp(Math.round(risky ? gauss(riskyMean, riskySd) : gauss(normMean, normSd)), 0, 100);
    pop.push({ score, risky });
  }
  return { pop, totalRisky, N, dataSource: 'synthetic' };
}

// ── 阈值扫描 + 混淆矩阵 + 最优阈值 ──
function sweep(rule) {
  const { pop, totalRisky, N, dataSource } = dataset(rule);
  const curve = [];
  for (let t = 0; t <= 100; t++) {
    let hits = 0, tp = 0, fpc = 0;
    for (const p of pop) { if (p.score >= t) { hits++; p.risky ? tp++ : fpc++; } }
    const precision = hits ? tp / hits : 0;
    const recall = totalRisky ? tp / totalRisky : 0;
    const f1 = (precision + recall) ? 2 * precision * recall / (precision + recall) : 0;
    curve.push({ t, hits, tp, fp: fpc, fn: totalRisky - tp, fpShare: hits ? fpc / hits : 0, recall, precision, f1 });
  }
  let f1Best = curve[0];
  for (const c of curve) if (c.f1 > f1Best.f1) f1Best = c;          // F1 最优
  let recall90 = null;
  for (const c of curve) if (c.recall >= 0.9 && (!recall90 || c.fpShare < recall90.fpShare)) recall90 = c; // 召回≥90%下误报最低
  return { source: 'engine', dataSource, N, totalRisky, maxHits: curve[0].hits || 1, curve, optimal: { f1: f1Best, recall90 } };
}

// 把整数命中数精确分配到 30 天（总和 == hits）。权重由规则种子生成，每条规则形态各异、更像真实每日波动
function distributeDaily(hits, seed) {
  const rng = makeRNG(hashStr(String(seed || 'x')));
  const W = Array.from({ length: 30 }, () => 0.35 + rng() * 1.3);
  const sumW = W.reduce((a, b) => a + b, 0);
  const raw = W.map(w => w / sumW * hits);
  const days = raw.map(Math.floor);
  let rem = hits - days.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]); // 按小数部分从大到小补余数
  for (let k = 0; k < rem; k++) days[order[k % 30][1]]++;
  return days;
}

// ── 回测摘要（命中/金额/基线对比/每日分布/样本）──
function backtest(rule, windowFactor, baseline) {
  const wf = +windowFactor || 1;
  const noRule = baseline === 'none';
  const pool = Math.round((POOL[rule.applic] || 80000) * wf);
  const hits = Math.round((rule.hits30d || 0) * wf);
  const fpPct = pInt(rule.fp);
  const fpCount = Math.round(hits * fpPct / 100);
  const realRisk = hits - fpCount;
  const amount = hits * (AVG[rule.applic] || 9000);
  const baseHits = noRule ? 0 : Math.round(hits * 0.9);
  const baseFp = noRule ? 0 : Math.round(baseHits * fpPct / 100 * 0.92);
  const baseRisk = baseHits - baseFp;
  const dHits = hits - baseHits, dFp = fpCount - baseFp, dRisk = realRisk - baseRisk;
  const pctHits = baseHits ? Math.round(dHits / baseHits * 100) : 100;
  const pctFp = baseFp ? Math.round(dFp / baseFp * 100) : 100;
  const sla = dFp * 0.02;
  const days = distributeDaily(hits, rule.id);
  const samples = (rule.samples || []).map((s, i) => {
    const isFp = /放行/.test(s[5]) && !/补材料/.test(s[5]);
    const score = isFp ? 60 + (i % 3) * 4 : 82 + (i % 4) * 4;   // 误报多在阈值边缘(中分)，命中正确为高分
    return { id: s[0], merchant: s[1], amount: s[2], score, result: s[5], isFp };
  });
  return {
    ruleId: rule.id, ruleName: rule.name, version: rule.version, applic: rule.applic,
    action: rule.action, fpText: rule.fp, noRule,
    pool, hits, fpPct, fpCount, realRisk, amount,
    baseHits, baseFp, baseRisk, dHits, dFp, dRisk, pctHits, pctFp, sla, days, samples,
  };
}

function rulesList() {
  return loadRules().map(r => ({
    id: r.id, name: r.name, version: r.version, enabled: r.enabled,
    applic: r.applic, category: r.category, fp: r.fp, hits30d: r.hits30d, weight: r.weight, action: r.action,
  }));
}
function getRule(id) { return loadRules().find(r => r.id === id) || null; }

module.exports = { rulesList, getRule, sweep, backtest };
