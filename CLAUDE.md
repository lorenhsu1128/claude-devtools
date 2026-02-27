# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Electron desktop app that visualizes Claude Code session execution. Reads raw JSONL session logs from `~/.claude/` and reconstructs them into a structured, searchable interface. Also runs as a standalone HTTP server (Docker/Node.js) without Electron.

## Tech Stack

Electron 40.x, React 18.x, TypeScript 5.x, Tailwind CSS 3.x, Zustand 4.x, Vite (via electron-vite)

## Commands

Always use pnpm (not npm/yarn).

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm typecheck` | Type checking |
| `pnpm lint:fix` | Lint and auto-fix |
| `pnpm format` | Format code |
| `pnpm test` | Run all vitest tests |
| `pnpm test -- test/main/utils/pathDecoder.test.ts` | Run a single test file |
| `pnpm test:watch` | Watch mode |
| `pnpm test:coverage` | Coverage report |
| `pnpm test:coverage:critical` | Critical path coverage (65% threshold) |
| `pnpm test:chunks` | Chunk building tests (tsx, not vitest) |
| `pnpm test:semantic` | Semantic step extraction tests (tsx) |
| `pnpm test:noise` | Noise filtering tests (tsx) |
| `pnpm test:task-filtering` | Task tool filtering tests (tsx) |
| `pnpm fix` | `lint:fix` + `format` |
| `pnpm check` | Full quality gate: `typecheck && lint && test && build` |
| `pnpm quality` | `check` + `format:check` + `knip` (dead code detection) |

## Path Aliases

- `@main/*` → `src/main/*`
- `@renderer/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`
- `@preload/*` → `src/preload/*`

## Architecture

### Dual-Mode Runtime

**Electron mode** (`src/main/index.ts`): Standard three-process Electron app — main (Node.js), preload (bridge), renderer (React/Chromium). Main process manages IPC, file watching, and SSH.

**Standalone mode** (`src/main/standalone.ts`): Fastify HTTP server with SSE push events instead of IPC. No Electron. Used for Docker and remote deployments. Env vars: `HOST`, `PORT`, `CLAUDE_ROOT`, `CORS_ORIGIN`.

The renderer auto-detects mode in `src/renderer/api/index.ts`: if `window.electronAPI` exists → Electron IPC; otherwise → `HttpAPIClient` (SSE + fetch). Both implement the same `ElectronAPI` interface from `@shared/types/api`. Renderer code should always use the `api` proxy, never `window.electronAPI` directly.

### Data Pipeline: JSONL → Display

This is the core flow. Understanding it is essential for working on the codebase.

```
~/.claude/projects/{encoded-path}/*.jsonl
    ↓ SessionParser (line-by-line streaming)
ParsedMessage[] (uuid, type, content, isMeta, timestamp, usage)
    ↓ MessageClassifier
Classified messages: user | system | compact | ai | hardNoise (filtered)
    ↓ ChunkBuilder + ToolExecutionBuilder + ProcessLinker
Chunk[] (UserChunk, AIChunk, SystemChunk, CompactChunk)
    ↓ SemanticStepExtractor
EnhancedChunk[] (+ semanticSteps per AI chunk)
    ↓ [IPC/HTTP transfer to renderer]
    ↓ groupTransformer.ts
ChatItem[] (UserGroup, AIGroup, SystemGroup, CompactGroup)
    ↓ aiGroupEnhancer.ts
EnhancedAIGroup (linkedTools, displayItems, lastOutput, summary)
    ↓ ChatHistory component
Rendered timeline with virtualization
```

Key enrichment in `aiGroupEnhancer.ts`: `linkToolCallsToResults()` pairs tool calls with results; `buildDisplayItems()` produces the flat `AIGroupDisplayItem[]` union (thinking, tool, subagent, output, slash, teammate_message, compact_boundary); `buildSummary()` generates collapsed summary text.

### ServiceContext

Central service bundle (`services/infrastructure/ServiceContext.ts`). One per workspace (local or SSH):

```
ServiceContext
  ├── ProjectScanner    — scans ~/.claude/projects/
  ├── SessionParser     — JSONL → ParsedMessage[]
  ├── SubagentResolver  — locates and links subagent files
  ├── ChunkBuilder      — ParsedMessage[] → Chunk[]
  ├── DataCache         — LRU cache (50 entries, 10min TTL)
  └── FileWatcher       — fs.watch with 100ms debounce
```

`ServiceContextRegistry` holds named contexts (`local`, `ssh-...`) and tracks the active one. All services accept a `FileSystemProvider` — either `LocalFileSystemProvider` or `SshFileSystemProvider` — making SSH transparent.

### Zustand Store (14 slices)

Single store composed in `src/renderer/store/index.ts`:

| Slice | Key State |
|-------|-----------|
| `projectSlice` | `projects[]`, `selectedProjectId` |
| `repositorySlice` | `repositoryGroups`, worktrees |
| `sessionSlice` | `sessions[]`, `selectedSessionId`, pagination |
| `sessionDetailSlice` | `sessionDetail`, `conversation`, per-tab `tabSessionData` |
| `subagentSlice` | subagent data |
| `conversationSlice` | conversation metadata |
| `tabSlice` | `openTabs[]`, `activeTabId` |
| `tabUISlice` | Per-tab UI state (expanded IDs, scroll positions) |
| `paneSlice` | `paneLayout: { panes[], focusedPaneId }` (max 4 panes) |
| `uiSlice` | sidebar visibility, search flags |
| `notificationSlice` | `notifications[]`, `unreadCount` |
| `configSlice` | `appConfig`, trigger configs |
| `connectionSlice` | SSH connection state |
| `contextSlice` | active context ID |

### Per-Tab State Isolation

`tabUISlice` stores independent UI state per tab keyed by `tabId` (expanded groups, scroll positions). `TabUIContext` (React context in `contexts/TabUIContext.tsx`) provides the current `tabId` to descendant components. The `useTabUI()` hook reads from the slice using that `tabId`. This ensures tabs have completely independent expansion/scroll states.

### IPC / HTTP Handler Pattern

`src/main/ipc/handlers.ts` orchestrates domain modules. Each module exports `initialize*Handlers(services)` and `register*Handlers(ipcMain)`. HTTP routes in `src/main/http/` mirror the same domains. IPC channel names centralized in `src/preload/constants/ipcChannels.ts`.

Config handlers return `{ success: boolean, data?, error? }` wrappers (unwrapped by preload's `invokeIpcWithResult<T>`). Other handlers return data directly or null on error.

### Notification Trigger System

Triggers are stored in `~/.claude/claude-devtools-config.json`. Three modes: `error_status` (is_error: true), `content_match` (regex on content fields), `token_threshold` (input/output/total). `FileWatcher` detects JSONL changes → `ErrorDetector` checks new lines against triggers → `NotificationManager` throttles (5s), shows native OS notification, persists to file, and emits events to renderer.

## Data Sources

```
~/.claude/projects/{encoded-path}/*.jsonl  — Session files
~/.claude/todos/{sessionId}.json           — Todo data
~/.claude/claude-devtools-config.json      — App configuration
~/.claude/claude-devtools-notifications.json — Persisted notifications
```

Path encoding: `/Users/name/project` → `-Users-name-project`

## Critical Concepts

### isMeta Flag

- `isMeta: false` = Real user message (creates new chunks, starts new turn)
- `isMeta: true` = Internal message (tool results, system-generated)

### Chunk Structure

Independent chunk types for timeline visualization:
- **UserChunk**: Single user message with metrics
- **AIChunk**: All assistant responses with tool executions and spawned subagents
- **SystemChunk**: Command output/system messages
- **CompactChunk**: System metadata/compaction boundaries

Each chunk has: timestamp, duration, metrics (tokens, cost, tools)

### Task/Subagent Filtering

Task tool_use blocks are filtered when a subagent exists for that Task call. Keep orphaned Task calls (no matching subagent) for visibility.

### Agent Teams

Claude Code's "Orchestrate Teams" feature: multiple sessions coordinate as a team.
- **Process.team?** `{ teamName, memberName, memberColor }` — enriched by SubagentResolver from Task call inputs and `teammate_spawned` tool results
- **Teammate messages** arrive as `<teammate-message teammate_id="..." color="..." summary="...">content</teammate-message>` in user messages (isMeta: false). Detected by `isParsedTeammateMessage()` — excluded from UserChunks, rendered as `TeammateMessageItem` cards
- **Session ongoing detection** treats `SendMessage` shutdown_response (approve: true) and its tool_result as ending events, not ongoing activity
- **Display summary** counts distinct teammates (by name) separately from regular subagents
- **Team tools**: TeamCreate, TaskCreate, TaskUpdate, TaskList, TaskGet, SendMessage, TeamDelete — have readable summaries in `toolSummaryHelpers.ts`

### Visible Context Tracking

Tracks what consumes tokens in Claude's context window across 6 categories (discriminated union on `category` field):

| Category | Type | Source |
|----------|------|--------|
| `claude-md` | `ClaudeMdContextInjection` | CLAUDE.md files (global, project, directory) |
| `mentioned-file` | `MentionedFileInjection` | User @-mentioned files |
| `tool-output` | `ToolOutputInjection` | Tool execution results (Read, Bash, etc.) |
| `thinking-text` | `ThinkingTextInjection` | Extended thinking + text output tokens |
| `team-coordination` | `TeamCoordinationInjection` | Team tools (SendMessage, TaskCreate, etc.) |
| `user-message` | `UserMessageInjection` | User prompt text per turn |

- **Types**: `src/renderer/types/contextInjection.ts`
- **Tracker**: `src/renderer/utils/contextTracker.ts` — `computeContextStats()`, `processSessionContextWithPhases()`
- **Context Phases**: Compaction events reset accumulated injections, tracked via `ContextPhaseInfo`
- **Display surfaces**: `ContextBadge` (per-turn popover), `TokenUsageDisplay` (hover breakdown), `SessionContextPanel` (full panel)

## Architecture Boundaries

`eslint-plugin-boundaries` enforces process isolation:
- **main** can import from `main` + `shared`
- **renderer** can import from `renderer` + `shared`
- **preload** can import from `preload` + `shared`

Cross-process imports are lint errors.

## TypeScript Conventions

### Naming

| Category | Convention | Example |
|----------|------------|---------|
| Services/Components | PascalCase | `ProjectScanner.ts` |
| Utilities | camelCase | `pathDecoder.ts` |
| Constants | UPPER_SNAKE_CASE | `PARALLEL_WINDOW_MS` |
| Type Guards | isXxx | `isRealUserMessage()` |
| Builders | buildXxx | `buildChunks()` |
| Getters | getXxx | `getResponses()` |

### Key Type Guards

```typescript
// Message type guards (src/main/types/messages.ts)
isParsedRealUserMessage(msg)      // isMeta: false, string content
isParsedInternalUserMessage(msg)  // isMeta: true, array content
isAssistantMessage(msg)           // type: "assistant"

// Chunk type guards
isUserChunk(chunk)   isAIChunk(chunk)   isSystemChunk(chunk)   isCompactChunk(chunk)
```

### Barrel Exports

`src/main/services/` and its domain subdirectories have barrel exports via index.ts:
```typescript
import { ChunkBuilder, ProjectScanner } from './services';
```
Note: renderer utils/hooks/types do NOT have barrel exports — import directly from files.

### Import Order

1. External packages
2. Path aliases (@main, @renderer, @shared)
3. Relative imports

## Commit Style

Prefer conventional commits: `feat:`, `fix:`, `chore:`, `docs:`.

## Error Handling

- Main: try/catch, console.error, return safe defaults
- Renderer: error state in Zustand store slices
- IPC: parameter validation, graceful degradation

## Performance

- LRU Cache: Avoid re-parsing large JSONL files (FileWatcher invalidates on change)
- Streaming JSONL: Line-by-line processing with incremental append detection
- Virtual Scrolling: @tanstack/react-virtual for large session/message lists (threshold: 120 items)
- Debounced File Watching: 100ms debounce

## Troubleshooting

### Build Issues
```bash
rm -rf dist dist-electron node_modules
pnpm install
pnpm build
```

### Type Errors
```bash
pnpm typecheck
```

### Test Failures
Check for changes in message parsing or chunk building logic.
