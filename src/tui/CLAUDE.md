# src/tui/ 目錄說明

TUI（Terminal User Interface）是 claude-devtools 的第三種執行模式，使用 Ink（React for CLI）框架在終端機中提供互動式介面。

---

## 執行方式

```bash
pnpm tui           # 建置並執行
pnpm tui:build     # 僅建置（dist-tui/）
pnpm tui:start     # 執行已建置版本
```

---

## 目錄結構

```
src/tui/
├── index.tsx               # 入口點：初始化 ServiceContext、render App
├── store.ts                # 單一扁平 Zustand store（含所有狀態與 actions）
├── types.ts                # TUI 專用型別
│
├── components/
│   ├── App.tsx             # 根佈局：header + BreadcrumbBar + 主面板 + StatusBar
│   ├── ChatView.tsx        # 全寬聊天瀑布流（逐行捲動）
│   ├── ProjectListView.tsx # 全寬專案列表
│   ├── SessionListView.tsx # 全寬 session 列表（含過濾）
│   │
│   ├── chat/
│   │   ├── AIItem.tsx      # AI 回應（摺疊/展開/子項目導覽）
│   │   ├── UserItem.tsx    # 使用者訊息（超過 15 行截斷）
│   │   ├── SystemItem.tsx  # 系統輸出（MAX_OUTPUT_LINES = 8）
│   │   ├── CompactItem.tsx # 壓縮邊界
│   │   ├── ToolItem.tsx    # 工具呼叫詳情
│   │   └── ContextPanel.tsx # Context 注入面板（6 大類）
│   │
│   └── common/
│       ├── BreadcrumbBar.tsx  # 導覽列（Projects > Project > Session > ...）
│       ├── HelpOverlay.tsx    # ? 鍵說明視窗
│       ├── LoadingSpinner.tsx # ink-spinner 包裝
│       ├── MarkdownText.tsx   # 終端機 Markdown 渲染
│       ├── StatusBar.tsx      # 底部按鍵說明
│       └── TokenBar.tsx       # ASCII Token 進度條
│
├── hooks/
│   ├── useKeymap.ts        # 集中鍵盤分派（所有按鍵邏輯在此）
│   ├── useScrollWindow.ts  # 視窗捲動計算 + estimateItemRows + getItemHeight
│   └── useFileWatcher.ts   # FileWatcher 訂閱（即時更新）
│
└── utils/
    ├── initServiceContext.ts  # createLocalServiceContext() 工廠函式
    ├── dateGrouping.ts        # Session 日期分組（今天/昨天/本週/更早）
    ├── syntaxHighlight.tsx    # 語法高亮（TypeScript/JS/Python/Rust/Go 等）
    └── textWrap.ts            # truncateLines() 文字截斷
```

---

## 版面配置

```
標題列（1行）: claude-devtools TUI
導覽列（1行）: Projects > ProjectName > SessionLabel
主內容區（flexGrow=1）:
  - focusMode='projects' → ProjectListView
  - focusMode='sessions' → SessionListView
  - focusMode='chat'     → ChatView
狀態列（2行）: 按鍵說明
```

`CHROME_ROWS = 9`（標題+導覽+統計+tokenbar+說明列+狀態列的總行數）

---

## Store 架構

**單一扁平 store**，不使用分片，因為 TUI 同時只顯示一個畫面。

### 主要狀態群組

| 群組 | 關鍵欄位 |
|------|---------|
| 模式 | `focusMode: 'projects' \| 'sessions' \| 'chat'` |
| 專案 | `projects`, `selectedProjectId`, `selectedProjectIndex`, `projectsLoading` |
| Session | `sessions`, `selectedSessionId`, `selectedSessionIndex`, `sessionsLoading` |
| Session 過濾 | `sessionFilterActive`, `sessionFilter` |
| 聊天 | `chatItems`, `chatScrollOffset`, `chatItemLineOffset` |
| 展開狀態 | `expandedAIGroupIds`, `expandedToolIds`, `expandedUserIds`, `expandedSystemIds` |
| 展開捲動 | `expandedAIGroupScrollOffsets`, `expandedSystemScrollOffsets` |
| Subagent | `subagentStack`, `subagentLabel` |
| 搜尋 | `chatSearchActive`, `chatSearchQuery`, `chatSearchMatches`, `currentChatSearchIndex` |
| Context | `contextStatsMap`, `contextPhaseInfo`, `showContextPanel` |
| UI | `showHelp`, `sessionIsOngoing` |

### ServiceContext 使用方式

```typescript
// 不使用 React context，改用模組層級 singleton
import { getServiceContext } from '../store';
const ctx = getServiceContext();
const projects = await ctx.projectScanner.scan();
```

---

## 逐行捲動（Line-by-line Scrolling）

**核心概念：**
- `chatScrollOffset`：目前聚焦的 ChatItem 索引
- `chatItemLineOffset`：在該項目內部的行偏移（0 = 頂部）

**視覺效果：** `<Box overflow="hidden"><Box marginTop={-chatItemLineOffset}>...</Box></Box>`

**重設時機：** 切換 session、搜尋跳躍、展開/收合項目、Subagent 鑽取

---

## 鍵盤操作（重要規則）

- **所有按鍵邏輯集中在 `useKeymap.ts`**，子元件不捕捉按鍵（除 TextInput 外）
- `↑/↓` 在 chat 模式中是**逐行移動**，不是逐項跳躍
- `→` 展開或選擇，`←` 收合或返回
- `/` 在 sessions 模式啟動過濾，在 chat 模式啟動搜尋
- 過濾/搜尋啟動時，TextInput 優先接收輸入，只有 `Esc` 會被 hook 攔截

---

## ESLint Boundary 規則

TUI 允許匯入 `renderer` 的純邏輯（groupTransformer、aiGroupEnhancer 等）：
```javascript
{ from: 'tui', allow: ['tui', 'main', 'shared', 'renderer'] }
```

---

## 重要常數

| 常數 | 位置 | 值 | 說明 |
|------|------|----|------|
| `CHROME_ROWS` | `useScrollWindow.ts` | 9 | 非內容區的固定行數 |
| `CHAT_CHROME_ROWS` | `useKeymap.ts` | 10 | 鍵盤邏輯計算用（含保守餘裕）|
| `USER_MAX_TEXT_LINES` | `useScrollWindow.ts` | 15 | UserItem 截斷行數 |
| `SYSTEM_MAX_OUTPUT_LINES` | `useScrollWindow.ts` | 8 | SystemItem 截斷行數 |
| `MAX_OUTPUT_LINES` | `SystemItem.tsx` | 8 | 與上方相同，需保持一致 |
| `MAX_SEGMENT_LEN` | `BreadcrumbBar.tsx` | 40 | 導覽列單段最大字元數 |
