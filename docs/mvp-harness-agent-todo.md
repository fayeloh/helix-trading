# Helix Trading — Harness + Multi-Agent MVP TODO（10 小时硬预算版）

> 硬约束：整个改造 ≤10 小时。超出此范围的需求一律进「明确不做」清单。
> 范围：Harness 基线 + `fundamentals` Tab 四角色改造 + 前后对比数字。
> 关键简化：groundedness 以 fixture 自身为 ground truth（AI 的 fact 字段值 vs 录制的 grounding 值），**不做人工 expected_facts 标注**；只人工构造 known_traps。

---

## 预算分配（总计 ≤10h）

| 块 | 预算 |
|---|---|
| Harness（录制 + Judge + baseline） | 4h |
| Multi-Agent（fundamentals） | 4h |
| 对比 + 收尾 | 2h |

---

## 当前状态

MVP 闭环已完成：golden fixture 录制、离线 Judge、同快照 baseline / Multi-Agent
对比、Synthesizer 验证重试与最终拒绝、fallback、缓存版本隔离，以及
`npm run verify` 门禁均已落地。在线评测仍是显式 opt-in，不属于默认测试门禁。

补充：全球指数地球仪已修正行情状态语义。缺少有效涨跌幅时显示“暂无数据”，不再把
`null` 当作 0 或上涨，避免行情源不可用时产生误导性绿色标记。

## H0–H1.5 · Golden 录制

- [x] 写 `eval/record.test.ts`：调用现有 `getCompanyProfile` / `resolveSymbol`，把真实返回值 dump 为 fixture（1h）
  - `AAPL`（齐全）/ `CRWV`（档案薄）/ `ZZZZZZ`（拒绝路径）
- [x] 两个有效标的各构造 1 个 `known_traps`：把 `employees` 在 grounding 中置 `null`；无效代码只测拒绝、不生成报告

## H1.5–H3.5 · Judge 脚本（纯程序化，无 LLM 评分）

- [x] `eval/judge.ts`：检查 `kind:"fact"` 数字/日期 grounding 与 known trap（1h）
- [x] `eval/live.test.ts` 串联冻结 fixture → baseline / debate → JSON 报告（1h）

## H3.5–H4 · Baseline

- [x] 同一冻结输入运行单调用与 Multi-Agent → `eval/reports/comparison.json`（0.5h）
  - 注意：历史上未在多 Agent 改码前留存 baseline；这是事后以同一冻结输入重跑现有 legacy 单调用路径，不能称为改码前实测历史基线。

## H4–H8 · Multi-Agent（仅 fundamentals）

- [x] `BULL_CASE_SCHEMA` / `BEAR_CASE_SCHEMA`（复用 `SOURCED`）+ 两条立场对立的 system prompt
- [x] `Promise.all` 并行调 Bull/Bear（`AI_MODEL_FAST`），各自捕获失败/超时；任一失败 → 走单调用 fallback（与原计划的 `allSettled` 实现方式不同）
- [x] Synthesizer（`AI_MODEL_DEEP`）：grounding + bull + bear 注入 user prompt，仍输出 `FUNDAMENTALS_SCHEMA`
- [x] `verifyAgainstFacts`：数字/日期 fact 与 grounding 硬比对；Synthesizer 失败时反馈违规项并重试，仍失败则 fallback（1h）
- [x] AAPL/CRWV 在线 trace 人工复核：AAPL 有正反方向；CRWV 论点偏泛化，不能宣称辩论改善质量，详见 `docs/mvp-eval-summary.md`

## H8–H9.5 · 对比

- [x] 新架构同套 eval → `eval/reports/comparison.json`；报告保留原始输出并记录结论数字（1h）
  - 数字没变好也如实记录 + 一句原因分析，本身就是产出

## H9.5–H10 · 收尾

- [x] 缓存 data version +1；补齐 Agent / Synthesizer 失败与 verifier 重试测试（0.5h）

---

## 明确不做（MVP 后再说）

- earnings / cycle / flows Tab 改造（仍未做）
- 宏观简报四阶段流水线
- CI / GitHub Actions 接入
- LLM-Judge 主观维度（hedge quality、debate quality）
- prompt skill 化 / 外部 prompt 管理框架
- 语义级 verifier（数值验证失败时的 Synthesizer 单次重试已实现）
- debate 过程的 UI 展示

## 风险提示

- 最大不确定项是 Bull/Bear/Synthesizer 三个 prompt 的调优（易超时 30–50%）：先写最糙版本跑通全链路，再回头打磨，不在链路未通时死磕单 Agent 质量。
- 若 H4 时 baseline 还没跑出来，砍掉 `CRWV` fixture，保 2 个标的也要保住「baseline 在改码前完成」这条铁律。
