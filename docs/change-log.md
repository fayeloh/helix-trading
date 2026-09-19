# 项目变更记录

本文件记录项目中所有由开发会话产生的文件修改。任何会话只要修改项目文件，都必须在同一会话中追加记录。

## 2026-09-19

### 当前会话：建立持续变更记录机制

- 更新 `AGENTS.md`，约定所有会话只要修改项目文件，就必须同步更新本文件。
- 新增本文件作为项目统一变更日志，并补录本次会话已完成的图标替换、每日简报导航调整，以及工作区中已存在的行情缓存相关修改。

### 当前会话：品牌图标替换

- 新增 `public/favicon.svg`，使用 Helix Trading 深色青绿色交易符号作为浏览器图标。
- 删除旧的 `public/favicon.ico`，移除原 Lovable 默认图标。
- 更新 `src/routes/__root.tsx`，将 favicon、alternate icon 和 apple touch icon 全部指向新的 SVG。
- 验证：`npm run lint` 通过；`npm run build` 因本机缺少 `rolldown` 原生 binding 未完成，属于环境依赖问题。

### 当前会话：每日简报导航布局

- 更新 `src/components/macro/MacroBriefingHeader.tsx`，让主导航使用与其他页面一致的 Helix Trading 顶栏结构，并保持顶部吸顶。
- 将“每日宏观简报”的日期、更新时间、刷新、偏好和时区操作移到主导航下方，避免切换到每日简报时导航行下移。
- 为当前导航项增加背景高亮和 `aria-current="page"`。
- 更新 `src/routes/briefing.index.tsx`，将桌面端右侧栏吸顶偏移调整为 `top-16`，与统一顶栏高度匹配。
- 更新 `src/styles.css`，隐藏简报导航横向滚动条并保留触控滚动能力。
- 验证：`npm run lint` 通过，`git diff --check` 通过。

### 既有工作区变更（本会话开始前已存在）

- `src/lib/market-api.server.ts`：为指数看板增加无有效行情时读取过期缓存的兜底。
- `src/lib/market.server.ts`：增加过期缓存读取、历史行情持久缓存、Financial Modeling Prep 备用行情源及 Yahoo 请求失败回退逻辑。
- `src/lib/market-seed.ts`：新增主要指数的离线历史行情种子数据，作为实时行情和缓存均不可用时的安全兜底；该文件在本会话进行状态复核时发现，未由本会话创建。
