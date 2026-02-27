# Claude-DevTools TUI 架構文件

本文件描述 claude-devtools TUI（終端機使用者介面）的實際架構與實作細節。TUI 是繼 Electron 桌面版和 Docker 獨立伺服器之後的第三種執行模式。

---

## 1. 概述

TUI 使用 **[Ink](https://github.com/vadimdemedes/ink)**（React for CLI）框架，在終端機中渲染互動式介面。它直接呼叫 `src/main/services/` 核心服務，不需要 Electron IPC 或 HTTP 伺服器。

**啟動指令：**
```bash
pnpm tui           # 建置並執行（使用 Vite 打包）
pnpm tui:build     # 僅建置
pnpm tui:start     # 執行已建置的版本
```

---

## 2. 系統架構圖

```
┌─────────────────────────────────────────────────────────────┐
│  TUI 進程 (Node.js)                                          │
│                                                             │
│  src/tui/index.tsx                                          │
│    └─ createLocalServiceContext()   ← 初始化核心服務         │
│    └─ render(<App />)               ← Ink 渲染              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Ink React 元件                                      │   │
│  │  App → BreadcrumbBar + ProjectListView              │   │
│  │                     + SessionListView               │   │
│  │                     + ChatView                      │   │
│  │                     + HelpOverlay                   │   │
│  │       + StatusBar                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Zustand Store (useTuiStore)                         │   │
│  │  單一扁平 store，無分片設計                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  核心服務（直接重用 src/main/services/）               │   │
│  │  ProjectScanner · SessionParser · ChunkBuilder      │   │
│  │  SubagentResolver · FileWatcher · DataCache         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
               ↕ fs.read / fs.watch
         ~/.claude/ 本機檔案系統
```

---

## 3. 版面配置

TUI 採用**單一全寬面板**設計，根據目前模式顯示不同內容：

```
┌──────────────────────────────────────────────────────────┐
│  claude-devtools TUI                                     │  ← 標題列
│  Projects > MyProject > Fix login bug                    │  ← 導覽列（BreadcrumbBar）
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [全寬主內容區域]                                          │  ← 依 focusMode 切換：
│                                                          │    projects → ProjectListView
│  - projects: 顯示所有專案，含 session 數量                │    sessions → SessionListView
│  - sessions: 顯示選定專案的所有 sessions                   │    chat     → ChatView
│  - chat:     顯示聊天記錄，可展開各項目                    │
│                                                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ↑↓:nav  →:select  ←:back  /:search  ?:help  q:quit     │  ← StatusBar
└──────────────────────────────────────────────────────────┘
```

### 版面高度分配

```
標題列:   1 行
導覽列:   1 行
主內容:   flexGrow(1) — 填滿剩餘終端機高度
StatusBar: 2 行（分隔線 + 文字）
```

---

## 4. 三種顯示模式

### 4.1 Projects 模式

顯示所有 `~/.claude/projects/` 內的專案，依最近一次 session 時間排序。

```
Projects
> my-project         (12)
  api-service        (7)
  documentation      (3)
```

- 數字 = 過濾後的 session 數量
- `→` 鍵選擇進入 Sessions 模式
- `q` 鍵退出程式

### 4.2 Sessions 模式

顯示選定專案的所有 sessions，依建立時間排序（最新優先），並以日期分組。

```
Projects > my-project
  ── 今天 ──
> Fix login validation bug      2024-01-15 14:30
  Add test coverage              2024-01-15 10:15
  ── 昨天 ──
  Refactor auth module           2024-01-14 16:00
```

- `/` 鍵啟動過濾（即時搜尋 session 標題）
- `→` 鍵選擇進入 Chat 模式
- `←` 鍵回到 Projects 模式

### 4.3 Chat 模式

顯示選定 session 的完整對話記錄，包含統計資訊、Token 使用量等。

```
Projects > my-project > Fix login validation bug
(1/24) [LIVE] · 8 turns · 2m 15s · 45,230 tokens
████░░░░░░░░░░░░ 45,230 / 200,000 (23%)
──────────────────────────────────────────────────────────
▸ › [User] 14:30  Fix the login page validation bug
  › [AI] 1.2s · Read(2) Edit(1) Bash(1) · 15,280 tokens
  › [System] pnpm test ── 12 passed
──────────────────────────────────────────────────────────
↑↓:nav →:expand ←:back d/u:page c:context r:refresh
```

---

## 5. 鍵盤操作對照表

| 模式 | 按鍵 | 動作 |
|------|------|------|
| **所有** | `?` | 開啟/關閉說明視窗 |
| **projects** | `↑` / `↓` | 瀏覽專案列表 |
| **projects** | `→` 或 `Enter` | 選擇專案，進入 sessions |
| **projects** | `q` | 退出程式 |
| **sessions** | `↑` / `↓` | 瀏覽 session 列表 |
| **sessions** | `→` 或 `Enter` | 選擇 session，進入 chat |
| **sessions** | `←` 或 `Esc` | 回到 projects |
| **sessions** | `/` | 啟動 session 過濾搜尋 |
| **chat** | `↑` / `↓` | 逐行捲動（非逐項跳躍） |
| **chat** | `d` / `u` | 向下/上半頁捲動 |
| **chat** | `→` | 展開目前聚焦的項目（AI/User/System） |
| **chat（展開中）** | `↑` / `↓` | 在展開項目內部捲動 |
| **chat（展開中）** | `←` | 收合並離開子項目 |
| **chat** | `/` | 啟動聊天記錄內文搜尋 |
| **chat（搜尋）** | `n` / `N` | 下一個/上一個搜尋結果 |
| **chat** | `c` | 切換 Context 詳情面板 |
| **chat（context panel）** | `↑` / `↓` | 瀏覽 context 類別 |
| **chat（context panel）** | `→` | 展開 context 類別 |
| **chat（subagent）** | `←` | 回到上層（subagent 向上退出） |
| **chat** | `r` | 重新整理目前 session |

---

## 6. 資料流程

```
~/.claude/projects/{encoded-path}/*.jsonl
    ↓ ServiceContext.projectScanner.listSessions()
Session[] (id, firstMessage, createdAt, ...)
    ↓ ServiceContext.sessionParser.parseSession()
ParsedMessage[]
    ↓ ServiceContext.subagentResolver.resolveSubagents()
Process[]（含 subagent 連結）
    ↓ ServiceContext.chunkBuilder.buildChunks()
EnhancedChunk[]
    ↓ transformChunksToConversation()（@renderer/utils/groupTransformer）
SessionConversation → ChatItem[]
    ↓ enhanceAIGroup()（@renderer/utils/aiGroupEnhancer）
EnhancedAIGroup（含 displayItems、linkedTools、lastOutput、summary）
    ↓
store.chatItems[]
    ↓
ChatView → AIItem / UserItem / SystemItem / CompactItem
```

---

## 7. Zustand Store 設計

TUI 使用**單一扁平 store**（非分片設計），因為 TUI 同時只會顯示一個畫面，不需要多分頁隔離。

### 主要狀態欄位

```typescript
interface TuiState {
  // 模式
  focusMode: 'projects' | 'sessions' | 'chat';

  // 專案列表
  projects: Project[];
  selectedProjectIndex: number;
  selectedProjectId: string | null;
  projectsLoading: boolean;
  projectSessionCounts: Map<string, number>;

  // Session 列表
  sessions: Session[];
  selectedSessionIndex: number;
  selectedSessionId: string | null;
  sessionsLoading: boolean;

  // Session 過濾
  sessionFilterActive: boolean;
  sessionFilter: string;

  // 聊天內容
  chatItems: ChatItem[];
  chatScrollOffset: number;         // 目前聚焦的項目索引
  chatItemLineOffset: number;       // 在項目內部的行偏移量（逐行捲動）

  // 展開狀態
  expandedAIGroupIds: Set<string>;
  expandedAIGroupScrollOffsets: Map<string, number>;
  expandedToolIds: Set<string>;
  expandedUserIds: Set<string>;
  expandedSystemIds: Set<string>;
  expandedSystemScrollOffsets: Map<string, number>;

  // Subagent 鑽取
  subagentStack: SubagentStackEntry[];   // 儲存每層的完整狀態
  subagentLabel: string | null;

  // 搜尋
  chatSearchActive: boolean;
  chatSearchQuery: string;
  chatSearchMatches: ChatSearchMatch[];
  currentChatSearchIndex: number;

  // Context 面板
  contextStatsMap: Map<string, ContextStats>;
  contextPhaseInfo: ContextPhaseInfo | null;
  showContextPanel: boolean;
  contextPanelCursorIndex: number;
  expandedContextCategory: string | null;

  // UI 狀態
  showHelp: boolean;
  sessionIsOngoing: boolean;
}
```

---

## 8. 逐行捲動系統

TUI 的聊天捲動採用**逐行**（line-by-line）移動，而非逐項目（item-by-item）跳躍，提供更流暢的閱讀體驗。

### 核心概念

- **`chatScrollOffset`**：目前聚焦的第一個可見 ChatItem 的索引
- **`chatItemLineOffset`**：在目前聚焦項目內部的行位移（0 = 頂部）
- **`estimateItemRows()`**：估算每個 ChatItem 佔用的終端機行數

### 視覺渲染技巧

使用 Ink 的 `overflow="hidden"` 搭配負數 `marginTop` 實現視覺上的行滾動：

```tsx
<Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
  <Box flexDirection="column" marginTop={-chatItemLineOffset}>
    {visibleItems.map(...)}
  </Box>
</Box>
```

### 捲動邏輯

**向下移動（↓）：**
1. 若 `chatItemLineOffset + 1 < itemHeight`：只增加 `chatItemLineOffset`（在項目內移動）
2. 否則：`chatScrollOffset + 1`，`chatItemLineOffset = 0`（移到下一個項目）

**向下移動（↑）：**
1. 若 `chatItemLineOffset > 0`：只減少 `chatItemLineOffset`
2. 否則：`chatScrollOffset - 1`，`chatItemLineOffset = prevItemHeight - 1`

---

## 9. Subagent 鑽取導航

當進入一個 Task 型工具呼叫（subagent），TUI 會將目前完整狀態壓入 `subagentStack`，然後載入該 subagent 的 session 資料：

```typescript
interface SubagentStackEntry {
  chatItems: ChatItem[];
  chatScrollOffset: number;
  chatItemLineOffset: number;
  expandedAIGroupIds: Set<string>;
  expandedAIGroupScrollOffsets: Map<string, number>;
  expandedToolIds: Set<string>;
  expandedUserIds: Set<string>;
  expandedSystemIds: Set<string>;
  expandedSystemScrollOffsets: Map<string, number>;
  contextStatsMap: Map<string, ContextStats>;
  contextPhaseInfo: ContextPhaseInfo | null;
  sessionIsOngoing: boolean;
  label: string; // 導覽列顯示的標籤
}
```

`←` 鍵呼叫 `goBackFromSubagent()`，從 stack pop 並完整還原上一層狀態。

BreadcrumbBar 會自動從 `subagentStack` 和 `subagentLabel` 建構完整路徑：
```
Projects > my-project > Main Session > Subagent A > Subagent B
```

---

## 10. 導覽列（BreadcrumbBar）

導覽列位於標題列正下方，即時反映目前在導覽層次中的位置：

| 模式 | 顯示內容 |
|------|---------|
| projects | `Projects`（青色） |
| sessions | `Projects`（暗色）`>`  `專案名稱`（青色） |
| chat（無子代理）| `Projects > 專案名稱 > Session 標題`（最後一段青色） |
| chat（有子代理）| `Projects > 專案名稱 > Session > Subagent A > Subagent B`（最後一段青色） |

每個段落最多顯示 40 個字元，超過則以 `…` 截斷。

---

## 11. 元件說明

### App.tsx
根佈局元件。掛載時呼叫 `loadProjects()`，根據 `focusMode` 條件式渲染三種主畫面之一。

### ProjectListView.tsx
全寬專案列表。計算捲動起始點（`computeScrollStart`），確保選取項目維持在可見範圍內。

### SessionListView.tsx
全寬 Session 列表，支援：
- 日期分組（今天、昨天、本週、更早）
- 即時過濾（`/` 鍵啟動，`ink-text-input` 處理輸入）
- 連線中（ongoing）session 標記

### ChatView.tsx
全寬聊天記錄瀑布流。包含：
- 統計標頭（進度、圈數、總時間、Token 數）
- Token 進度條（`TokenBar`）
- 搜尋欄（`/` 鍵啟動）
- Context 面板（`c` 鍵切換，僅 AI 項目可用）
- 聊天項目列表（逐行捲動）
- 說明列（操作提示）

### AIItem.tsx
渲染 AI 回應。摺疊狀態顯示摘要；展開後顯示完整的 `displayItems` 陣列，包含思考過程、工具呼叫、子代理呼叫、輸出文字等。

### UserItem.tsx
渲染使用者訊息，支援展開/收合（超過 15 行時截斷）。

### SystemItem.tsx
渲染系統指令輸出，超過 8 行時截斷，展開後支援內部分頁捲動。

### ToolItem.tsx
渲染工具呼叫（Read / Bash / Edit 等），可展開顯示工具輸出預覽。

### CompactItem.tsx
渲染對話壓縮邊界（Compaction Boundary）。

### ContextPanel.tsx
顯示某個 AI 回應的 Context 注入詳情，分 6 個類別（claude-md、mentioned-file、tool-output、thinking-text、team-coordination、user-message）。

### BreadcrumbBar.tsx
導覽列元件，自動從 store 狀態建構路徑文字。

### TokenBar.tsx
ASCII 式 Token 使用量進度條（`████░░░░ 45,230 / 200,000 (23%)`）。

### StatusBar.tsx
底部說明列，依 `focusMode` 顯示對應的按鍵說明。

### HelpOverlay.tsx
按 `?` 觸發的全螢幕說明視窗，列出完整鍵盤操作說明。

### MarkdownText.tsx
在終端機中渲染 Markdown，支援：標題（`#`/`##`/`###`）、粗體（`**`）、行內程式碼（`` ` ``）、圍欄程式碼區塊（```` ``` ````）、有序/無序清單、引言（`>`）。

### LoadingSpinner.tsx
`ink-spinner` 的包裝元件，用於載入資料時顯示旋轉動畫。

---

## 12. Hooks

### useKeymap.ts
集中鍵盤事件分派，在根 `App` 元件中以 `useInput()` 監聽按鍵，根據 `focusMode` 路由至不同處理邏輯。**所有鍵盤邏輯都在此集中管理，避免子元件發生按鍵衝突。**

### useScrollWindow.ts
提供 `useScrollWindow()` hook，根據終端機高度和各項目估算行數，計算目前視窗應顯示的 ChatItem 切片（`startIndex`、`count`）。

也匯出工具函式：
- `estimateItemRows()` — 估算單一項目高度
- `getItemHeight()` — 從 store 狀態快速取得項目高度

### useFileWatcher.ts
訂閱 `ServiceContext.fileWatcher` 的 `file-change` 事件，在活躍 session 的 JSONL 檔案有異動時，自動呼叫 `refreshCurrentSession()`，實現即時更新。

---

## 13. 工具模組

### utils/initServiceContext.ts
工廠函式，建立並啟動本機 `ServiceContext`，供整個 TUI 共用。支援 `CLAUDE_ROOT` 環境變數覆蓋 `~/.claude/` 路徑。

### utils/dateGrouping.ts
將 Session 列表依建立時間分組為「今天」、「昨天」、「本週」、「更早」等類別。

### utils/textWrap.ts
`truncateLines(text, maxLines)` — 截斷文字並回傳剩餘行數，供 UserItem 和 SystemItem 決定是否顯示「展開」提示。

### utils/syntaxHighlight.tsx
在終端機中進行程式碼語法高亮，支援 TypeScript、JavaScript、Python、Rust、Go、Ruby、PHP、SQL、Bash、JSON 等語言。

---

## 14. 建置設定

| 檔案 | 說明 |
|------|------|
| `vite.tui.config.ts` | TUI 專屬的 Vite 建置設定，輸出至 `dist-tui/`，target 為 Node 20 |
| `tsconfig.json` | 含 `@tui/*` → `src/tui/*` 路徑別名 |
| `eslint.config.js` | TUI 的 boundary 規則：`{ from: 'tui', allow: ['tui', 'main', 'shared', 'renderer'] }` |
| `knip.json` | 入口設定含 `src/tui/index.tsx` 和 `vite.tui.config.ts` |

---

## 15. 與 Electron / HTTP 模式的差異

| 面向 | Electron 模式 | HTTP/Docker 模式 | TUI 模式 |
|------|--------------|-----------------|---------|
| 進程架構 | Main + Preload + Renderer (3 進程) | Node.js + Fastify (2 模組) | 單一 Node.js 進程 |
| UI 框架 | React + Chromium | React + Browser | Ink（React for CLI）|
| 通訊方式 | Electron IPC | HTTP + SSE | 直接函式呼叫 |
| 狀態管理 | Zustand（14 個分片）| Zustand（14 個分片）| Zustand（單一扁平 store）|
| 更新方式 | IPC 推送 | SSE 推送 | FileWatcher callback |
| 多分頁 | 支援（最多 4 窗格）| 不支援 | 不支援 |
| SSH 遠端 | 支援 | 不支援 | 不支援 |
