# src/ 目錄結構

## 執行模式與進程架構

### Electron 模式（三進程）
- `main/` - Node.js runtime（檔案系統、IPC、生命週期管理）
- `preload/` - 安全橋接層（contextBridge API）
- `renderer/` - React/Chromium（UI、狀態管理、視覺化）
- `shared/` - 跨進程共用型別與工具函式

### TUI 模式（單一 Node.js 進程）
- `tui/` - Ink（React for CLI）終端機介面，直接呼叫 `main/services/` 核心服務
- 詳細說明請參閱 `src/tui/CLAUDE.md`

## Import Pattern
Use barrel exports from domain folders:
```typescript
import { ChunkBuilder, ProjectScanner } from './services';
```

## IPC Communication
Exposed API via `window.electronAPI`, organized by domain:

| Domain | Methods | Examples |
|--------|---------|---------|
| Sessions | 10 | `getProjects()`, `getSessions()`, `getSessionsPaginated()`, `getSessionDetail()`, `getSessionMetrics()`, `getWaterfallData()`, `getSubagentDetail()`, `searchSessions()`, `getAppVersion()` |
| Repository | 2 | `getRepositoryGroups()`, `getWorktreeSessions()` |
| Validation | 2 | `validatePath()`, `validateMentions()` |
| CLAUDE.md | 3 | `readClaudeMdFiles()`, `readDirectoryClaudeMd()`, `readMentionedFile()` |
| Config | 16 | `config.get()`, `config.update()`, `config.addTrigger()`, `config.openInEditor()`, `config.pinSession()`, `config.unpinSession()`, etc. |
| Notifications | 9 | `notifications.get()`, `notifications.markRead()`, `notifications.onNew()`, etc. |
| Utilities | 7 | `openPath()`, `openExternal()`, `onFileChange()`, `onTodoChange()`, `getZoomFactor()`, `onZoomFactorChanged()` |
| Session | 1 | `session.scrollToLine()` |

Full API signatures in `src/preload/index.ts`, channel constants in `src/preload/constants/ipcChannels.ts`.
