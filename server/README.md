# FuturePayCA · 回测后端

零依赖 Node 服务，给「回测模拟」页(`rc-backtest.html`)提供真实的回测计算引擎。

## 启动

```bash
node server/server.js
# 自定义端口：PORT=8080 node server/server.js
```

然后打开 **http://localhost:3000/rc-backtest.html**（不要用 `file://` 直接打开——那样不走后端，会自动回退到浏览器内本地计算）。

## API

| 端点 | 说明 |
|---|---|
| `GET /api/rules` | 规则列表（从 `rc-rules-data.js` 实时加载，单一数据源） |
| `GET /api/sweep?ruleId=RULE-003` | 阈值扫描：逐阈值(0–100)混淆矩阵 + 命中量/误报率/精确率/召回率/F1 + 最优阈值(F1 最高、召回≥90%下误报最低) |
| `GET /api/backtest?ruleId=RULE-003&window=1&baseline=online` | 回测摘要：命中量、拦截金额、基线对比、每日分布、命中样本 |
| `GET /api/health` | 健康检查 |

## 架构

```
rc-rules-data.js ──(vm 沙箱执行, 单一数据源)──▶ engine.loadRules()
                                                     │
                            ┌────────────────────────┴───────────────────────┐
                   dataset(rule)                                       backtest(rule,…)
        CSV(真实) 或 确定性模拟总体(带 risky 标注)                  命中/金额/基线/分布/样本
                            │
                     sweep(rule)
        逐阈值 TP/FP/FN/TN → precision/recall/F1 → 最优阈值
```

前端**优先调 API，后端不可达时回退到浏览器内同算法计算**（`rc-backtest.html` 里的 `localSweep`/`localBacktest` 与 `engine.js` 逐字对应），所以两种模式结果一致。

## 接入真实数据

把带标注的历史交易放到 `server/data/<ruleId>.csv`，引擎会**自动改用真实数据**（无需改代码）：

```csv
score,label
92,1
14,0
78,1
...
```

- `score`：该交易在这条规则下的风险评分（0–100）。
- `label`：历史人工真值，`1`=真风险，`0`=正常。

文件存在即生效；页面顶部来源标签会显示「后端引擎 · 真实数据」。

> 生产化路线：把 `dataset()` 换成查数仓(point-in-time join)、把 `score` 换成规则 AST 在交易上的实际求值，其余(混淆矩阵/扫描/最优阈值)逻辑不变。
