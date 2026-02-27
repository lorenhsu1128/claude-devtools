# TUI 實作規格計劃

## Context

claude-devtools 目前只有 Electron 桌面版和 Standalone HTTP 伺服器兩種運行模式。為了讓開發者在終端機中也能快速查看 Claude Code 的 session 執行細節，需要新增 TUI (Terminal User Interface) 作為第三個進入點。TUI 使用 Ink v5 (React for terminal) 框架，直接調用 `@main/services/` 核心邏輯，不經過 Electron IPC 或 HTTP。

**架構決策：** TUI 的 ESLint boundary 設為 `{ from: 'tui', allow: ['tui', 'main', 'shared', 'renderer'] }`，允許直接匯入 `@renderer/utils/` 中的純邏輯（如 `groupTransformer.ts`、`aiGroupEnhancer.ts`），免去大量檔案搬遷。

---

## Phase 1: 基礎建設 — 設定檔、依賴、空殼入口

### 1.1 安裝新依賴

```bash
pnpm add ink@^5 ink-select-input ink-text-input ink-spinner
```

### 1.2 設定檔變更

**`tsconfig.json`** — 新增路徑別名：
```json
"@tui/*": ["./src/tui/*"]
```

**`eslint.config.js`** — 新增 TUI 邊界（約 L100-137）：
```javascript
// boundaries/elements 陣列新增：
{ type: 'tui', pattern: 'src/tui/**', mode: 'folder' }

// boundaries/element-types rules 陣列新增：
{ from: 'tui', allow: ['tui', 'main', 'shared', 'renderer'] }
```
另需新增 `src/tui/**/*.{ts,tsx}` 的 language options 區塊（設定 `globals.node`），以及 import-plugin 設定（參照現有 `import-plugin-main` 區塊）。

**`vitest.config.ts`** — 新增別名和環境覆蓋：
```javascript
// resolve.alias 新增：
'@tui': resolve(__dirname, 'src/tui')

// test 區塊新增：
environmentMatchGlobs: [['test/tui/**', 'node']]
```

**`knip.json`** — 新增入口和路徑：
```json
"entry": [...existing, "src/tui/index.tsx", "vite.tui.config.ts"],
"paths": { "@tui/*": ["./src/tui/*"], ...existing }
```

**`package.json`** — 新增腳本：
```json
"tui": "tsx src/tui/index.tsx",
"tui:build": "vite build --config vite.tui.config.ts",
"tui:start": "node dist-tui/index.cjs"
```

### 1.3 新檔案 `vite.tui.config.ts`

仿照 `vite.standalone.config.ts`：
- 入口：`src/tui/index.tsx`
- 輸出：`dist-tui/`
- 新增 `@tui` 路徑別名，保留 `@main`、`@shared`、`@renderer` 別名
- 保留 `electronStub` 和 `nativeModuleStub` 插件
- `build.target: 'node20'`, `build.ssr: true`

### 1.4 空殼入口 `src/tui/index.tsx`

先驗證 `tsx src/tui/index.tsx` 能正常執行：
```typescript
import React from 'react';
import { render, Text } from 'ink';
render(<Text color="cyan">claude-devtools TUI — Hello World</Text>);
```

### 1.5 驗證

```bash
pnpm tui          # 應印出 Hello World
pnpm typecheck    # 無錯誤
pnpm lint         # 邊界規則通過
```

---

## Phase 2: 資料層 — ServiceContext 與 Zustand Store

### 2.1 ServiceContext 初始化 `src/tui/utils/initServiceContext.ts`

仿照 `src/main/standalone.ts`（L14-23）的初始化模式：

```typescript
import { ServiceContext, LocalFileSystemProvider } from '@main/services';
import { getProjectsBasePath, getTodosBasePath, setClaudeBasePathOverride } from '@main/utils/pathDecoder';

export function createLocalServiceContext(): ServiceContext {
  if (process.env.CLAUDE_ROOT) {
    setClaudeBasePathOverride(process.env.CLAUDE_ROOT);
  }
  const ctx = new ServiceContext({
    id: 'local',
    type: 'local',
    fsProvider: new LocalFileSystemProvider(),
    projectsDir: getProjectsBasePath(),
    todosDir: getTodosBasePath(),
  });
  ctx.start();
  return ctx;
}
```

### 2.2 Zustand Store `src/tui/store.ts`

單一扁平 store（TUI 不需多 tab、不需 slice 分割）：

```typescript
interface TuiState {
  // 焦點模式
  focusMode: 'projects' | 'sessions' | 'chat';

  // 專案
  projects: Project[];
  selectedProjectIndex: number;
  selectedProjectId: string | null;
  projectsLoading: boolean;
  projectsError: string | null;

  // Sessions
  sessions: Session[];
  selectedSessionIndex: number;
  selectedSessionId: string | null;
  sessionsLoading: boolean;

  // 聊天內容
  chatItems: ChatItem[];
  chatScrollOffset: number;
  expandedAIGroupIds: Set<string>;
  chatLoading: boolean;
  sessionIsOngoing: boolean;

  // Actions
  loadProjects(): Promise<void>;
  selectProject(projectId: string): Promise<void>;
  selectSession(sessionId: string): Promise<void>;
  refreshCurrentSession(): Promise<void>;
  setFocusMode(mode: TuiState['focusMode']): void;
  scrollChat(delta: number): void;
  toggleAIGroupExpanded(id: string): void;
}
```

**資料流程（各 action 內部邏輯）：**

1. `loadProjects()` → `serviceContext.projectScanner.scan()` → 存入 `projects`
2. `selectProject(id)` → `serviceContext.projectScanner.listSessions(id)` → 存入 `sessions`，切換 `focusMode: 'sessions'`
3. `selectSession(id)`:
   - `sessionParser.parseSession(projectId, sessionId)` → `ParsedSession`
   - `subagentResolver.resolveSubagents(projectId, sessionId, taskCalls, messages)` → `Process[]`
   - `chunkBuilder.buildChunks(messages, subagents)` → `EnhancedChunk[]`
   - `asEnhancedChunkArray()` 驗證（`@renderer/types/data`）
   - `transformChunksToConversation(chunks, subagents, isOngoing)` → `SessionConversation`（`@renderer/utils/groupTransformer`）
   - 對每個 AIGroup 呼叫 `enhanceAIGroup()`（`@renderer/utils/aiGroupEnhancer`）
   - 存入 `chatItems`，切換 `focusMode: 'chat'`
4. `refreshCurrentSession()` → 重新執行步驟 3，保留 `chatScrollOffset` 和 `expandedAIGroupIds`

**ServiceContext 以模組層級 singleton 持有**（非 React context），在 `index.tsx` 建立後透過 `setServiceContext()` 注入 store。

### 2.3 更新 `src/tui/index.tsx`

```typescript
import { render } from 'ink';
import { createLocalServiceContext } from './utils/initServiceContext';
import { setServiceContext } from './store';
import { App } from './components/App';

const serviceContext = createLocalServiceContext();
setServiceContext(serviceContext);

process.on('SIGINT', () => { serviceContext.dispose(); process.exit(0); });
process.on('SIGTERM', () => { serviceContext.dispose(); process.exit(0); });

render(<App />);
```

---

## Phase 3: 導航外殼 — 雙面板佈局與鍵盤操作

### 3.1 目錄結構

```
src/tui/
├── index.tsx                    # 入口點
├── store.ts                     # Zustand store
├── types.ts                     # TUI 專用類型
├── components/
│   ├── App.tsx                  # 根佈局：header + sidebar/main + status bar
│   ├── Sidebar.tsx              # 左側：專案列表 ↔ session 列表
│   ├── ChatView.tsx             # 右側：捲動式聊天項目
│   ├── chat/
│   │   ├── UserItem.tsx         # 渲染 UserGroup
│   │   ├── AIItem.tsx           # 渲染 AIGroup（摺疊/展開）
│   │   ├── SystemItem.tsx       # 渲染 SystemGroup
│   │   ├── CompactItem.tsx      # 渲染 CompactGroup
│   │   └── ToolItem.tsx         # 渲染 LinkedToolItem
│   └── common/
│       ├── TokenBar.tsx         # ASCII 進度條 ████░░░░
│       ├── StatusBar.tsx        # 底部快捷鍵提示
│       └── LoadingSpinner.tsx   # ink-spinner 包裝
├── hooks/
│   ├── useKeymap.ts             # 集中鍵盤分派
│   ├── useScrollWindow.ts       # offset-based 捲動
│   └── useFileWatcher.ts        # FileWatcher 事件訂閱
└── utils/
    ├── dateGrouping.ts          # Session 日期分組
    ├── textWrap.ts              # 終端機自動換行
    └── initServiceContext.ts    # ServiceContext 工廠
```

### 3.2 版面佈局

```
┌─────────────────────────────────────────────────────┐
│ claude-devtools TUI              [project-name]     │
├──────────────┬──────────────────────────────────────┤
│ Projects     │ Session: fix login bug               │
│              │                                      │
│ > my-app   3 │ [User] 2024-01-15 14:30              │
│   api-svc  7 │ Fix the login page validation...     │
│   docs     2 │                                      │
│              │ [AI] 1.2s · 15.2k tokens             │
│              │ ▸ Read src/auth/login.ts              │
│              │ ▸ Edit src/auth/login.ts              │
│              │ Fixed the validation logic by...      │
│              │                                      │
│              │ ── Compaction: -45.2k freed ──        │
│              │                                      │
│              │ [User] 14:32                          │
│              │ Now add tests                         │
├──────────────┴──────────────────────────────────────┤
│ ↑↓ Navigate  Enter Select  / Search  q Quit        │
└─────────────────────────────────────────────────────┘
```

### 3.3 鍵盤操作模型

使用 Ink `useInput()` hook 在 `App.tsx` 集中處理：

| 模式 | 按鍵 | 動作 |
|------|------|------|
| `projects` | `j/k` 或 `↑/↓` | 瀏覽專案列表 |
| `projects` | `Enter` | 選擇專案 → `sessions` |
| `projects` | `q` | 退出 |
| `sessions` | `j/k` 或 `↑/↓` | 瀏覽 session 列表 |
| `sessions` | `Enter` | 選擇 session → `chat` |
| `sessions` | `Escape` | → `projects` |
| `chat` | `j/k` 或 `↑/↓` | 捲動 ±1 |
| `chat` | `d/u` | 捲動 ±10（半頁） |
| `chat` | `Enter` | 展開/摺疊 AI 群組 |
| `chat` | `r` | 重新整理 |
| `chat` | `Escape` | → `sessions` |
| 所有 | `Tab` | 面板切換 |

### 3.4 捲動實作 (`useScrollWindow.ts`)

Ink 無 `overflow: scroll`，使用 offset-based windowing：
- `scrollOffset` 是第一個可見項目的索引
- 每個 ChatItem 有 `estimateRows(item, columns)` 估算行數
- 依 `process.stdout.rows` 計算可見視窗
- 超長內容截斷並顯示 "...N more lines"

---

## Phase 4: 聊天渲染 — 各 ChatItem 元件

### UserItem
```
[User] 14:30
Fix the login page validation bug
```

### AIItem（摺疊）
```
[AI] 1.2s · 15.2k tokens · Read(2) Edit(1) Bash(1)
```
摘要使用 `enhancedAIGroup.itemsSummary`（由 `buildSummary()` 產生）。

### AIItem（展開）
```
[AI] 1.2s · 15.2k tokens
  ▸ Read src/auth/login.ts (245 lines)
  ▸ Edit src/auth/login.ts (+12 -3)
  ▸ Bash: pnpm test (exit 0)
  ────
  Fixed the validation logic by adding...
```
遍歷 `enhancedAIGroup.displayItems`，依 `item.type` 分派渲染。

### ToolItem
```
▸ Read src/auth/login.ts (245 lines)       # 摺疊
▾ Read src/auth/login.ts (245 lines)       # 展開
  Output: export function validateLogin(...
```
使用 `linkedTools[].callPreview` 和 `linkedTools[].resultPreview`。

### CompactItem
```
── Compaction: -45.2k freed (120k → 75k) ──
```
使用 `compactGroup.tokenDelta`。

### SystemItem
```
[System] pnpm test output: 12 tests passed
```

### TokenBar
```
████████░░░░░░  72.5k / 100k (72%)
```
使用 `formatTokensCompact()`（`@shared/utils/tokenFormatting`）。

---

## Phase 5: 即時更新

### `useFileWatcher.ts`

```typescript
useEffect(() => {
  const handler = (event: FileChangeEvent) => {
    const state = useTuiStore.getState();
    if (state.selectedProjectId === event.projectId) {
      if (state.selectedSessionId === event.sessionId) {
        void state.refreshCurrentSession();
      }
      // 也可能有新 session 出現
    }
  };
  serviceContext.fileWatcher.on('file-change', handler);
  return () => { serviceContext.fileWatcher.off('file-change', handler); };
}, []);
```

---

## 不在初期範圍內

- SSH 遠端 session
- 子代理深入鑽取
- Context injection 追蹤面板
- 通知觸發器
- 搜尋過濾
- 多窗格/多 tab

---

## 可重用的現有模組（直接匯入）

| 模組 | 匯入路徑 | 用途 |
|------|---------|------|
| `transformChunksToConversation` | `@renderer/utils/groupTransformer` | Chunk → ChatItem 轉換 |
| `enhanceAIGroup` | `@renderer/utils/aiGroupEnhancer` | AI 群組顯示增強 |
| `asEnhancedChunkArray` | `@renderer/types/data` | Chunk 類型驗證 |
| `isAssistantMessage` | `@renderer/types/data` | 訊息類型判斷 |
| `formatTokensCompact` | `@shared/utils/tokenFormatting` | Token 格式化 |
| `formatDuration` | `@renderer/utils/formatters` | 時間格式化 |
| `sanitizeDisplayContent` | `@shared/utils/contentSanitizer` | 內容清理 |
| `parseModelString` | `@shared/utils/modelParser` | 模型名稱解析 |

---

## 關鍵檔案參考

| 用途 | 路徑 |
|------|------|
| ServiceContext 初始化範本 | `src/main/standalone.ts` |
| Vite 建置設定範本 | `vite.standalone.config.ts` |
| ESLint 邊界設定 | `eslint.config.js` (L100-137) |
| 核心轉換器 | `src/renderer/utils/groupTransformer.ts` |
| 顯示增強器 | `src/renderer/utils/aiGroupEnhancer.ts` |
| Shared types barrel | `src/shared/types/index.ts` |
| 顯示類型定義 | `src/renderer/types/groups.ts` |
| Token 格式化 | `src/shared/utils/tokenFormatting.ts` |
| 內容清理 | `src/shared/utils/contentSanitizer.ts` |

---

## 驗證方式

```bash
pnpm tui              # TUI 正常啟動，顯示專案列表
pnpm typecheck        # 無型別錯誤
pnpm lint             # 邊界規則通過
pnpm test             # 所有現有測試 + 新 TUI 測試通過
pnpm check            # 完整品質管線
```
