# Fundamentals Multi-Agent MVP：评测摘要

截至 2026-09-20，同一批冻结公开公司档案输入分别运行旧单调用与 Bull/Bear → Synthesizer → Verifier；原始模型输出、Agent trace 和程序化分数见 [`eval/reports/comparison.json`](../eval/reports/comparison.json)。这是一份小样本可复现演示，不是多 Agent 优于单模型的统计证据。

| 标的 | 单调用：有据数字/日期 | 多 Agent：有据数字/日期 | 空值陷阱 | 本次耗时（单/多） |
| --- | ---: | ---: | --- | ---: |
| AAPL | 10/10 | 8/8 | 均未编造员工数 | 10.0 / 98.8 秒 |
| CRWV | 1/1 | 2/2 | 均未编造员工数 | 3.2 / 63.4 秒 |
| ZZZZZZ | 无效代码，不生成报告 | 无效代码，不生成报告 | 不适用 | 不适用 |

人工复核 Bull/Bear trace：AAPL 的两方分别围绕产品生态/多元化与核心产品依赖/竞争监管作论证，方向有区别；但部分具体判断（例如营收增速放缓或监管风险）不是冻结档案直接给出的事实，作为 `inference` 仍需谨慎。CRWV 档案很薄，Bull 的行业和地理优势推论、Bear 的竞争论点偏通用，辩论形式存在但信息增量有限。当前 Judge 只检查 `kind: fact` 的数字/日期，以及一个被置空的员工数字段；不评价语义事实、出处真实性、分析深度或成本。两个模型输出的数字声明数也不同，不能直接拿百分比当作质量改善。

校验口径：`ticker` 是标识符，`company_profile.market_cap` 会由可信档案在交付前覆写；后者如 `4.94T` 对原始美元数值的合理舍入不做精确字符串比较。报告已从保存的原始输出重新评分，未重新调用模型。历史改码前的 baseline 未保存，本报告的单调用基线是事后对同一冻结输入运行保留的 legacy 路径。

工程验收：`npm run verify` 通过（9 个常规文件、90 项测试，2 个可选在线用例跳过），`npm run build` 通过；定向测试覆盖正常路径、Agent 失败/超时 fallback、Synthesizer 失败与 Verifier 重试/拒绝，另有报告分数重算测试。本地 `/research` SSR 返回 HTTP 200，但未在已登录浏览器中点击生成报告，不能把此项写成完整端到端 UI 验收。`npm run eval:record` 和 `npm run eval:live` 需要项目 `.env.local` 与外部 API，默认测试不调用付费模型。

MVP 结论：证明了可编排、可回退、可追踪、可对照的工作流；目前没有证明多 Agent 能降低幻觉，且本次 AAPL/CRWV 延迟明显较高。扩样和语义级评测应先于扩大到 `earnings` 或宏观流水线。
