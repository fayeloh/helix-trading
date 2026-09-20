# Helix Trading Multi-Agent 路演讲解稿

本文档对应 `helix_multi_agent_pitch_deck.pptx`。每次更新 PPT 或其生成脚本时，必须同步更新本文档。

## 建议时长

约 3 分钟。

## 核心主线

> 我们不是简单增加两个模型，而是把 Multi-Agent 放进了一条可验证、可回退、可测试的研究工作流。

## 开场（约 20 秒）

这份演示介绍的是 Helix Trading 如何把 Multi-Agent 用到股票基本面研究中。重点不只是 Bull 和 Bear 两个 Agent，而是我们给它们配了一套 Harness，让每次研究请求都能被调度、验证、追踪，并在失败时安全回退。

## 第 1 页：Multi-Agent 编排（约 50 秒）

第一步，我们先冻结行情和基本面事实，避免 Agent 自由发挥。

然后 Bull 和 Bear 两个 Agent 并行工作：一个寻找机会和正向催化剂，另一个寻找风险和脆弱点。

两份结构化分析交给 Deep Synthesizer 综合，最后由 `verifyAgainstFacts` 检查事实类数字和日期是否有 grounding 支持。如果校验失败，违规项会反馈给 Synthesizer 重试一次。

如果 Synthesizer 或某个 Agent 失败，系统会回到原来的单模型路径；如果回退结果仍然无法通过事实校验，系统拒绝交付报告，不会因为新增 Multi-Agent 而让产品不可用。

这一页要让评委记住：事实先行、并行分析、综合输出、事实验证、失败回退。

## 第 2 页：Harness（约 60 秒）

第二页是工程核心。我们把一次模型调用拆成了可观测的执行单元。

每个 Agent 都有状态、耗时和错误信息；每个阶段都有超时控制；Bull 和 Bear 可以并行执行；Synthesizer 单独负责综合；Verifier 负责记录事实校验结果。

这条链路已经有最小工程门禁：运行 `npm run verify`，会检查 Harness 代码、TypeScript 类型和全部测试。

当前 9 个测试文件、90 项测试通过，另有 2 个录制/在线评测用例默认跳过。覆盖正常的 Multi-Agent 路径、Agent 失败与超时回退、Synthesizer 失败回退、验证重试与拒绝，以及 fact 和 inference 的边界。

评测也已经接入：`eval:record` 生成 AAPL、CRWV 和无效代码的冻结 golden fixture，`eval:live` 用同一份输入比较 single-call 与 Multi-Agent，并保留原始 JSON 输出。当前 Judge 只衡量数字/日期 grounding 和空值陷阱，不宣称能证明整体质量提升。

准确表述是：这是一个可运行、可测试、可回退的 MVP Harness，而不是已经完全生产化的平台。

## 第 3 页：应用工作流（约 50 秒）

第三页说明它不是一个孤立的实验。用户输入股票代码后，系统先解析和验证标的，再获取事实数据，然后根据研究模块选择策略。

目前 `fundamentals` 模块使用 Multi-Agent，其他模块仍然保留单模型路径。

最终输出是结构化 JSON，进入前端展示和缓存。

完整链路是：统一事实输入，经过 Bull、Bear、Synthesizer 和 Verifier，失败时 fallback，结果带有 `_debate trace`。当前证据来自 AAPL、CRWV 和 ZZZZZZ 三个冻结样本：两个有效标的的数字/日期声明均通过接地检查，空值陷阱未被编造，但样本太小，不能宣称 Multi-Agent 已经优于单模型。评测链路用 golden fixture 固定输入，避免把数据变化误判成模型改进。

这一页右侧的“后续展望”要主动讲清楚边界：先扩充 Golden Dataset 和 CI 回归门禁，再补 semantic Judge，最后才评估 earnings 多 Agent；宏观四阶段流水线属于 Phase 3，不纳入当前 MVP。

## 结尾（约 20 秒）

这套方案的价值不在于用了几个 Agent，而在于把 Agent 变成了产品中可观测、可验证、可回退、可比较的研究策略。

我们先在 fundamentals 这个核心场景完成闭环，再根据评测结果决定是否扩展到 earnings、cycle 和 flows。当前交付的是可运行、可回退、可复核的 MVP，不把未完成的展望包装成现成功能。

## 评委追问准备

### 为什么不全部改成 Multi-Agent？

我们有意控制范围。先在 fundamentals 做垂直切片，验证准确率、延迟和稳定性，再扩展到其他模块。当前报告显示 Multi-Agent 延迟明显更高，且小样本没有证明质量提升，所以 earnings 和宏观流水线仍然是后续展望。

### Verifier 能不能保证没有幻觉？

目前是程序化 MVP，主要检查 fact 类数字和日期是否出现在 grounding 中，并在 Synthesizer 阶段反馈违规项重试。它能发现一部分事实幻觉，但还不是完整的语义验证。当前 golden fixture 和自动 Judge 已经接入，后续可以继续扩大样本并加入更严格的 judge。

### Multi-Agent 是否一定比单模型好？

不一定。Multi-Agent 通常会增加延迟和成本，所以我们把 baseline 对比作为下一步重点。只有事实准确率或分析覆盖明显提升时，才值得扩大范围。

### 现在达到生产级了吗？

目前是工程化 MVP，不声称已经完成生产级闭环。已有超时、fallback、trace、验证和测试门禁；CI、长期评测、成本监控和更多模块接入还可以继续完善。

## 最重要的一句话

> 我们展示的不是两个 Agent 的概念，而是一条可以失败、可以回退、可以验证、可以测试、可以用同一份事实输入比较的 Agent 工作流。
