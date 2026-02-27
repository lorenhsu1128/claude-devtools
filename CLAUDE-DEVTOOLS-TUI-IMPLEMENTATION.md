# TUI 實作完整參考

## 概述

TUI（Terminal User Interface）已完整實作，作為 claude-devtools 的第三種執行模式。使用 Ink v5（React for CLI）框架，在終端機中提供互動式的 Claude Code session 瀏覽功能。

---

## 執行方式

```bash
pnpm tui           # 建置並執行
pnpm tui:build     # 僅建置（輸出至 dist-tui/）
pnpm tui:start     # 執行已建置的版本
```

環境變數：
```bash
CLAUDE_ROOT=/custom/path pnpm tui   # 使用自訂 .claude 目錄
```

---

## 已完成功能清單

### Phase 1：基礎建設 ✅
- Ink 相關依賴（`ink`, `ink-text-input`, `ink-spinner`）
- `@tui/*` 路徑別名
- ESLint boundary 規則
- Vite 建置設定（`vite.tui.config.ts`）
- 空殼入口驗證

### Phase 2：資料層 ✅
- `ServiceContext` 初始化（`utils/initServiceContext.ts`）
- Zustand Store 完整實作（`store.ts`）
- 資料流程：JSONL → ParsedMessage → Chunk → ChatItem → EnhancedAIGroup
- Context 追蹤整合（`processSessionContextWithPhases`）

### Phase 3：導航外殼 ✅
- **單一全寬面板**（非原規劃的雙面板）
- `BreadcrumbBar` 導覽列元件
- `ProjectListView` 全寬專案列表
- `SessionListView` 全寬 session 列表（含日期分組）
- 集中鍵盤處理（`useKeymap.ts`）
- 逐行捲動系統（`chatItemLineOffset`）

### Phase 4：聊天渲染 ✅
- `AIItem`（摺疊/展開，含子項目導覽）
- `UserItem`（展開/收合，超過 15 行截斷）
- `SystemItem`（展開後內部分頁捲動）
- `CompactItem`（壓縮邊界）
- `ToolItem`（工具呼叫展開詳情）
- `ContextPanel`（Context 注入分類詳情）
- `MarkdownText`（終端機 Markdown 渲染）
- `TokenBar`（ASCII 進度條）
- Syntax highlighting（10+ 語言）

### Phase 5：即時更新 ✅
- `useFileWatcher.ts` — FileWatcher 事件訂閱，自動 refresh

### 額外功能（超出原規劃）✅
- Session 過濾搜尋（`/` 鍵啟動，即時過濾）
- Chat 記錄搜尋（`/` 鍵啟動，高亮匹配項）
- Subagent 鑽取導航（stack-based，完整狀態還原）
- Context 面板（逐類別展開，6 大類）
- 說明視窗（`?` 鍵切換）
- `[LIVE]` 即時 session 標記
- 子代理 drill-down 完整支援（含深層巢狀）

---

## 實際目錄結構

```
src/tui/
├── index.tsx                          # 入口點：初始化 ServiceContext、render App
├── store.ts                           # 單一扁平 Zustand store
├── types.ts                           # TUI 專用型別
│
├── components/
│   ├── App.tsx                        # 根佈局：header + breadcrumb + panel + statusbar
│   ├── ChatView.tsx                   # 全寬聊天瀑布流（逐行捲動）
│   ├── ProjectListView.tsx            # 全寬專案列表
│   ├── SessionListView.tsx            # 全寬 session 列表（含過濾）
│   │
│   ├── chat/
│   │   ├── AIItem.tsx                 # AI 回應渲染（摺疊/展開/子項目導覽）
│   │   ├── UserItem.tsx               # 使用者訊息渲染（展開/收合）
│   │   ├── SystemItem.tsx             # 系統輸出渲染（展開後分頁）
│   │   ├── CompactItem.tsx            # 壓縮邊界渲染
│   │   ├── ToolItem.tsx               # 工具呼叫渲染（展開詳情）
│   │   └── ContextPanel.tsx           # Context 注入詳情面板
│   │
│   └── common/
│       ├── App.tsx                    # 根佈局（同上層 App.tsx）
│       ├── BreadcrumbBar.tsx          # 導覽列
│       ├── HelpOverlay.tsx            # 全螢幕說明視窗
│       ├── LoadingSpinner.tsx         # 載入動畫
│       ├── MarkdownText.tsx           # 終端機 Markdown 渲染
│       ├── StatusBar.tsx              # 底部按鍵說明列
│       └── TokenBar.tsx               # ASCII Token 進度條
│
├── hooks/
│   ├── useFileWatcher.ts              # FileWatcher 訂閱（即時更新）
│   ├── useKeymap.ts                   # 集中鍵盤事件分派
│   └── useScrollWindow.ts            # 視窗捲動計算 + 項目高度估算
│
└── utils/
    ├── dateGrouping.ts                # Session 日期分組
    ├── initServiceContext.ts          # ServiceContext 工廠
    ├── syntaxHighlight.tsx            # 語法高亮（10+ 語言）
    └── textWrap.ts                    # 文字截斷工具
```

---

## Store 狀態架構

### ServiceContext 整合

ServiceContext 以**模組層級 singleton** 持有，在 `index.tsx` 建立後透過 `setServiceContext()` 注入：

```typescript
// index.tsx
const serviceContext = createLocalServiceContext();
setServiceContext(serviceContext);
render(<App />);
```

```typescript
// store.ts 內部取用
const ctx = getServiceContext();
const projects = await ctx.projectScanner.scan();
```

### 資料流（各 action 邏輯）

**`loadProjects()`：**
1. `ctx.projectScanner.scan()` → `Project[]`
2. 依 `mostRecentSession` 排序
3. 平行計算各專案的過濾後 session 數量
4. 存入 `projects`, `projectSessionCounts`

**`selectProject(id)`：**
1. `ctx.projectScanner.listSessions(id)` → `Session[]`
2. 依 `createdAt` 降序排列
3. 切換 `focusMode: 'sessions'`

**`selectSession(id)`：**
1. `ctx.sessionParser.parseSession(projectId, id)` → `ParsedSession`
2. `ctx.subagentResolver.resolveSubagents(...)` → `Process[]`
3. `ctx.chunkBuilder.buildChunks(messages, subagents)` → `EnhancedChunk[]`
4. `transformChunksToConversation(chunks, subagents, isOngoing)` → `ChatItem[]`
5. 對每個 AIGroup 呼叫 `enhanceAIGroup()`
6. `processSessionContextWithPhases()` 計算 context stats
7. 存入 `chatItems`, 切換 `focusMode: 'chat'`

**`refreshCurrentSession()`：**
重新執行 `selectSession()` 流程，但保留 `chatScrollOffset` 和 `expandedAIGroupIds`。

**`drillDownSubagent(process)`：**
1. 將目前完整狀態壓入 `subagentStack`
2. 設定 `subagentLabel`
3. 載入 subagent 的 session 資料

**`goBackFromSubagent()`：**
從 `subagentStack` pop，完整還原上一層狀態。

---

## 捲動系統技術細節

### 逐行捲動原理

```typescript
// useKeymap.ts 中的 scrollChatLine 邏輯
function scrollChatLine(direction: 1 | -1): void {
  const store = useTuiStore.getState();
  const { chatScrollOffset, chatItemLineOffset, chatItems } = store;
  const termCols = stdout?.columns ?? 80;
  const availableRows = Math.max((stdout?.rows ?? 24) - CHAT_CHROME_ROWS, 5);

  if (direction === 1) {
    const itemHeight = getItemHeight(chatItems[chatScrollOffset], termCols, store, availableRows);
    if (chatItemLineOffset + 1 < itemHeight) {
      // 在同一項目內繼續往下
      store.setState({ chatItemLineOffset: chatItemLineOffset + 1 });
    } else if (chatScrollOffset + 1 < chatItems.length) {
      // 移到下一個項目
      store.scrollChat(1);
      store.setState({ chatItemLineOffset: 0 });
    }
  } else {
    if (chatItemLineOffset > 0) {
      // 在同一項目內往上
      store.setState({ chatItemLineOffset: chatItemLineOffset - 1 });
    } else if (chatScrollOffset > 0) {
      // 移到上一個項目的最後一行
      store.scrollChat(-1);
      const prevHeight = getItemHeight(chatItems[chatScrollOffset - 1], termCols, store, availableRows);
      store.setState({ chatItemLineOffset: Math.max(0, prevHeight - 1) });
    }
  }
}
```

### 視窗計算（useScrollWindow.ts）

```typescript
// 計算可見的 ChatItem 切片
function useScrollWindow(chatItems, scrollOffset): ScrollWindow {
  const availableRows = termRows - CHROME_ROWS; // CHROME_ROWS = 9
  let rowsBudget = availableRows + chatItemLineOffset; // 加上偏移量以多渲染一項
  let count = 0;

  for (let i = scrollOffset; i < chatItems.length && rowsBudget > 0; i++) {
    rowsBudget -= estimateItemRows(chatItems[i], ...);
    count++;
  }
  return { startIndex: scrollOffset, count, availableRows };
}
```

### 視覺渲染（ChatView.tsx）

```tsx
// overflow="hidden" + 負 marginTop 實現視覺行滾動
<Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
  <Box flexDirection="column" marginTop={-chatItemLineOffset}>
    {visibleItems.map(...)}
  </Box>
</Box>
```

---

## 重用的現有模組

| 模組 | 路徑 | 用途 |
|------|------|------|
| `transformChunksToConversation` | `@renderer/utils/groupTransformer` | Chunk → ChatItem |
| `enhanceAIGroup` | `@renderer/utils/aiGroupEnhancer` | AI 群組顯示增強 |
| `processSessionContextWithPhases` | `@renderer/utils/contextTracker` | Context 追蹤 |
| `formatDuration` | `@renderer/utils/formatters` | 時間格式化 |
| `parseModelString` | `@shared/utils/modelParser` | 模型名稱解析 |
| `sanitizeDisplayContent` | `@shared/utils/contentSanitizer` | 內容清理 |
| `ServiceContext` | `@main/services` | 核心服務容器 |
| `ProjectScanner` | `@main/services/discovery` | 專案掃描 |
| `SessionParser` | `@main/services/parsing` | JSONL 解析 |
| `ChunkBuilder` | `@main/services/analysis` | Chunk 建構 |
| `SubagentResolver` | `@main/services` | Subagent 連結 |
| `FileWatcher` | `@main/services/infrastructure` | 檔案監聽 |

---

## 驗證指令

```bash
pnpm tui           # 啟動 TUI，應顯示全寬專案列表
pnpm typecheck     # 型別檢查通過（無錯誤）
pnpm lint          # ESLint 邊界規則通過
pnpm test          # 所有 652 個測試通過
pnpm check         # 完整品質管線
```

---

## 已知限制

- **無 SSH 遠端 session 支援**（僅本機 `~/.claude/`）
- **無多分頁/多窗格**（同時只能查看一個 session）
- **無滑鼠操作**（純鍵盤導覽）
- **Context Injection 追蹤不完整**（部分類別資料可能較少）
- **ANSI escape code 清理**：系統指令輸出若含大量 ANSI 碼，顯示效果可能不佳
