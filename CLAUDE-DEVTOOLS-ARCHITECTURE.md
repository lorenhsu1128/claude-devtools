# Claude Devtools 詳細專案架構與模組說明文件

這份文件提供了 `claude-devtools` 在 `src/` 目錄下的所有 Process 與 Module 的深度剖析。內容包含整個應用程式的處理架構圖、資料流程圖、與 `~/.claude` 的時序圖，以及前端 UI 與後端邏輯的具體對應關係。

---

## 1. 系統整體架構 (System Architecture)

`claude-devtools` 採用標準的 Electron 三層進程架構 (Main, Preload, Renderer)，並且額外提供了一個 `Standalone` (獨立 HTTP 伺服器) 模式供 Docker 或遠端部署使用。所有進程間共享 `Shared` 模組的型別與常數。

```mermaid
graph TD
    subgraph "Frontend (Renderer Process)"
        UI[React UI Components]
        Store[Zustand Store]
        API[API Layer]
    end

    subgraph "Bridge (Preload Process)"
        IPC[window.electronAPI]
    end

    subgraph "Backend (Main Process)"
        MainEntry[index.ts / IPC Handlers]
        subgraph "Services"
            Infra[Infrastructure: FileWatcher, Config, HttpServer]
            Parsing[Parsing: SessionParser]
            Discovery[Discovery: ProjectScanner]
            Analysis[Analysis: ChunkBuilder]
        end
    end

    subgraph "Data Source"
        LocalFS[~/.claude Local Files]
        RemoteSSH[Remote SSH Server Files]
    end

    UI <-->|State| Store
    UI <-->|Calls| API
    API <-->|IPC Invoke/On| IPC
    IPC <-->|Handle/Send| MainEntry
    MainEntry <--> Services
    
    Infra -- Watch/Read --> LocalFS
    Infra -- SFTP Polling --> RemoteSSH
    Parsing -- Parse JSONL --> LocalFS
```

---

## 2. 各 Process 與 Module 詳細說明

### 2.1 主進程 (Main Process) - `src/main/`

主進程是 Node.js 執行環境，擁有最高權限，負責所有作業系統層級的操作、檔案讀寫、伺服器啟動與資料處理。

#### 核心 Module 與職責

1. **`services/infrastructure/` (基礎設施)**
    * **`FileWatcher.ts`**: 監聽 `~/.claude/projects/` 與 `~/.claude/todos/` 目錄。當有 `.jsonl` 或 `.json` 異動時，會執行增量解析並派發 `file-change` 事件。同時若啟用 SSH 模式，會轉換為 Polling (輪詢) 機制而非 `fs.watch`。
    * **`ServiceContext.ts`**: 封裝了當前運行環境的服務實體（例如區分「本地上下文」與「SSH 連線上下文」），每個上下文擁有自己獨立的 Scanner, Parser, Watcher。
    * **`HttpServer.ts`**: 供 Standalone 模式使用的 Fastify 伺服器，利用 Server-Sent Events (SSE) 替代 IPC 進行前端推播。
    * **`NotificationManager.ts`**: 集中管理通知邏輯，例如偵測到 Claude Code 存取 `.env` 檔案或消耗超過指定的 Token 時發出系統通知。

2. **`services/parsing/` (解析器)**
    * **`SessionParser.ts`**: 核心解析引擎。負責讀取並解析 `~/.claude/projects/projectId/sessionId.jsonl`，將每一行的 JSON 轉換為 `ParsedMessage`。同時負責區分 Tool Calls（如 Read, Bash, Edit）、子代理 (Subagent) 任務，並計算整個對話的 Token Metrics。

3. **`services/discovery/` (探索器)**
    * **`ProjectScanner.ts`**: 負責掃描 `~/.claude/projects/` 底下的所有目錄，解析專案路徑、找出最近活躍的對話 Session，並提供列表。

4. **`services/analysis/` (分析器)**
    * **`ChunkBuilder.ts`**: 專門將原始的 `ParsedMessage` 進行視覺化區塊打包 (Chunking)。將複雜的 Prompt、Response 與 Tool Results 封裝成適合前端 UI 渲染的抽象層。

### 2.2 預載進程 (Preload Process) - `src/preload/`

作為 Main 與 Renderer 之間的橋樑，使用 `contextBridge` 將安全的 API 暴露給前端。

* **`index.ts`**: 定義了 `window.electronAPI`，包含 `sessions.getSessions()`, `config.get()`, `notifications.onNew()` 等介面，嚴格限制了前端能呼叫的 Node.js 功能，確保安全性。

### 2.3 渲染進程 (Renderer Process) - `src/renderer/`

完全基於 HTML/CSS/JS 的前端畫面，使用 React 18, TailwindCSS 與 Zustand 打造的高效能介面。

#### 核心 Module 與職責

* **`api/`**: 封裝 `window.electronAPI`，若在無 Electron 的網頁模式下運行（Standalone），會自動切換為 `fetch` 呼叫 HTTP Server。
* **`store/`**: 控制全域狀態。包含當前所選的 Project、Session、通知列表、以及處理 IPC 廣播進來的狀態更新。
* **`components/` (UI 元件庫)**: (詳見下方 UI 對應區塊)

### 2.4 共用模組 (Shared) - `src/shared/`

* **`types/`**: 定義了貫穿前後端的 interface，如 `FileChangeEvent`, `ParsedMessage`, `ToolCall` 等。

---

## 3. 與 `~/.claude` 目錄的交互過程 (Interaction Sequence)

### 3.1 `~/.claude` 內關鍵實體檔案與用途

`claude-devtools` 的運作高度依賴讀取 Claude Code 在本地端生成的記錄檔。系統透過 `ProjectScanner`、`FileWatcher` 與 `SessionParser` 即時監聽與解析以下檔案：

| 目錄 / 檔案路徑 | 檔案類型 | 檔案作用與核心紀錄內容 | 前端 UI 對應呈現 |
| :--- | :--- | :--- | :--- |
| `~/.claude/projects/` | 目錄 | **專案列表目錄**。存放所有經過 Claude Code 操作的專案資料夾。目錄名稱通常是專案絕對路徑的 Base64 編碼 (Encoded Name)。 | 左側 Sidebar 的 Project 清單與 Worktree 群組分類 |
| `~/.claude/projects/<id>/<sessionId>.jsonl` | JSONL | **主對話紀錄檔**。每一行是一個 JSON 事件物件，詳細記錄完整的交互過程：User Message, Assistant Message, Tool Calls (Read/Edit/Bash 等), Tool Results, Token Metrics 以及記憶體狀態。這是整個應用最核心的資料來源。 | 中央的 Waterfall 對話瀑布流、Token 長條圖分析、以及可展開的 Tool Call Viewer |
| `~/.claude/projects/<id>/<sessionId>/subagents/` | JSONL | **子代理 (Subagent) 紀錄檔**。當主對話透過 `Task` 工具分派任務給 Claude Code 時，會衍生出獨立的子代理，它的所有對話與行為指令會單獨記錄在此目錄下的 `agent-<hash>.jsonl` 中。 | 主對話瀑布流內的 `SubagentCard` (支援點擊展開的巢狀階層式子任務視覺化) |
| `~/.claude/todos/<sessionId>.json` | JSON | **任務清單 (Todo/Task List)**。在對話中若產生 Markdown 核取項目，其完成與否的狀態會被外部記錄在這個 JSON 中同步追蹤。 | (透過 Store 即時追蹤並用於輔助狀態更新廣播) |

### 3.2 即時互動更新時序

當開發者在終端機中使用 Claude Code 產生新的對話或執行 Tool 時，Claude Code 會將 Log 寫入 `~/.claude`。以下是 `claude-devtools` 偵測變化並更新畫面的時序圖。

```mermaid
sequenceDiagram
    participant Terminal as Claude Code CLI
    participant FS as ~/.claude (File System)
    participant Watcher as Main: FileWatcher
    participant Parser as Main: SessionParser
    participant Preload as Preload (IPC)
    participant UI as Renderer (React UI)

    Terminal->>FS: 寫入/更新 projectId/sessionId.jsonl
    FS-->>Watcher: 觸發 fs.watch (或 SSH Polling 偵測到大小改變)
    Watcher->>Watcher: 增量讀取判定 (detectErrorsInSessionFile)
    Watcher->>Preload: 派發 'file-change' 事件
    Preload->>UI: webContents.send('file-change')
    
    UI->>Preload: API 請求最新 Data (getWaterfallData)
    Preload->>Parser: IPC Invoke (解析要求)
    Parser->>FS: 讀取並 Parse sessionId.jsonl
    Parser-->>Preload: 回傳 ParsedSession 與 Token Metrics
    Preload-->>UI: 回傳處理後的 Chunk 陣列
    UI->>UI: Zustand Store 更新，React 重新渲染 (Waterfall)
```

**互動細節：**

1. **監聽階段**: `FileWatcher` 在應用程式啟動時會綁定 `fs.watch` 於 `~/.claude/projects/`。
2. **增量解析 (Incremental Append)**: 為效能考量，`FileWatcher` 會記住上次處理的 `byteSize`，當檔案變大時，只讀取新增加的行數 (`parseAppendedMessages`)，並交由 `ErrorDetector` 捕捉是否發生例外。
3. **UI 提取**: 當 UI 接收到 `file-change` 的通知，Zustand Store 會觸發重新整理，請求 `SessionParser` 重新整理對話與 Context 佔用的詳細分析圖表。

---

## 4. 資料處理流程圖 (Data Flow)

將原始的 JSONL 文本轉換為畫面上看得到的精美卡片的資料流管道：

```mermaid
flowchart TD
    A["Raw .jsonl File<br/>(~/.claude)"] -->|fs.read| B[SessionParser]
    B -->|Parse Lines| C["ParsedMessage[] Array"]
    C -->|Extract Details| D[Calculate Metrics & Tasks]
    
    D --> E[ChunkBuilder]
    E -->|Combine Message + Tools| F[UI Chunks]
    
    F --> G[Renderer API Layer]
    G --> H[Zustand Store]
    H --> I["React Components<br/>(Waterfall, Token Bars)"]
```

---

## 5. 後端模組與前端 UI 對應關係 (UI Mapping)

每個處理過後的模組最終都會呈現在使用者的畫面上。以下是原始資料邏輯如何映射到 `src/renderer/components/` 中的具體畫面位置：

| 後端功能/模組 (Main) | 前端元件/目錄 (Renderer) | 畫面呈現說明 |
| :--- | :--- | :--- |
| **`ProjectScanner`** | `components/sidebar/` | 左側面板。列出所有的 Project (目錄路徑) 與該專案下的對話 Session 紀錄。 |
| **`SessionParser`** (主對話) | `components/chat/` | 主畫面中央的 Waterfall (對話瀑布流)。展示 User 與 Assistant 的互動文字與 Tool Calls。 |
| **`ChunkBuilder` & `ToolExecution`** | `components/chat/ToolCallViewer` | 展開 Tool Call 時看到的詳細內容。包括 Bash 的終端機輸出、Read 的語法高亮代碼、Edit 的 Git Diff 視覺化區塊。 |
| **`SessionParser`** (Subagents) | `components/chat/SubagentCard` | 在指令中如果 Claude Code 呼叫了子代理，會渲染為一個可巢狀展開的樹狀結構卡片，展示子代理做了什麼。 |
| **Token Metrics 計算** | `components/report/` & `Context Badge` | 在每次回覆旁顯示 Context 使用量 (Token 佔用百分比)，點擊後可以看圓餅圖或長條圖 (Stacked Bar) 分析哪些檔案佔用了多少 Token。 |
| **`NotificationManager`** | `components/notifications/` | 右上角的鈴鐺或彈出式通知 (Toast)。當系統偵測到諸如讀取 `.env` 或是出現嚴重 Error 時顯示標記與警報。 |
| **`FileWatcher` (Todos)** | `--` (暫由 Zustand 處理狀態) | 對前端提供 Todo (檢查清單) 或 Task 的即時狀態更新(若未來有實作專屬 UI 區塊)。 |
| **`ConfigManager`** | `components/settings/` | 開啟設定面板，允許調整 Trigger Rules (自訂條件警報)、切換佈景主題或輸入 SSH 連線設定。 |

---

## 6. 核心功能與使用方式 (Features & Usage)

### 6.1 核心特色功能

Claude Devtools 主要設計目的是為了彌補 Claude Code 終端機介面中隱藏的細節，提供以下核心功能：

1. **可視化上下文重建 (Visible Context Reconstruction)**
   * **功能描述**：終端機只能看見簡單的進度條。Devtools 能夠精確解析每次對話（Turn），將 Token 使用量具體拆分為 7 大類：`CLAUDE.md`、`Skills`、`@-mentions`、`Tool I/O`、`Thinking`、`Team` 與 `User Text`。
   * **呈現方式**：每則訊息旁的 Badge，以及統計長條圖（Stacked Bar）。

2. **上下文壓縮視覺化 (Compaction Visualization)**
   * **功能描述**：當對話長度觸及 Token 上限時，Claude Code 會自動進行對話壓縮。透過這個功能，使用者能明確看見上下文何時填滿、何時被壓縮、以及壓縮前後的 Token 變化。

3. **自訂警示通知 (Custom Notification Triggers)**
   * **功能描述**：可自訂正則表達式，當 Claude Code 的行為符合條件時發出系統跨進程通知。
   * **內建預設**：讀取 `.env` 機密檔警告、工具執行錯誤 (`is_error: true`)、以及單次高 Token 消耗警告（預設 8,000 Tokens）。

4. **圖形化 Tool Call 檢視器 (Rich Tool Call Inspector)**
   * **功能描述**：將終端機中簡化的 `Edited 2 files` 或 `Read 3 files` 還原為詳盡易讀的格式。
   * **呈現方式**：Read 具備帶有行號的語法高亮；Edit 提供新增/刪除差異比對 (Inline diff)；Bash 提供完整的終端機標準輸出。

5. **子代理與團隊視覺化 (Team & Subagent Visualization)**
   * **功能描述**：解開終端機經常交錯混亂的多代理人輸出。將每一個 `Task` 生成的子代理獨立為樹狀結構卡片。
   * **功能亮點**：能清楚看見團隊生命週期（`TeamCreate`, `TaskUpdate`, `SendMessage` 等通訊）。

6. **跨 Session 搜尋 (Cross-Session Search)**
   * **功能描述**：支援使用快捷鍵 `Cmd+K` 叫出 Command Palette，能跨越多個對話紀錄做全局搜尋，並高亮關鍵字。

7. **SSH 遠端對話監控 (SSH Remote Sessions)**
   * **功能描述**：支援透過解析 `~/.ssh/config`，無縫連線至遠端主機，掛載遠端的 `~/.claude/` 目錄並直接在本地端圖形介面觀察遠端的 Claude Code 對話狀況。

8. **多窗格排版 (Multi-Pane Layout)**
   * **功能描述**：支援多 Session 左右並排開啟或拖曳分頁，方便比較或多工處理。

---

### 6.2 安裝與使用方式

Claude Devtools 不需要繁瑣的配置，也不需要綁定任何 API Key，因為它直接讀取存在您本機（或 SSH 遠端）的 `.claude` 歷史記錄檔。

#### 1. 桌面端應用程式安裝 (Desktop App)

* **macOS (Homebrew)**:

  ```bash
  brew install --cask claude-devtools
  ```

* **直接下載 (macOS / Windows / Linux)**
  您可以前往 GitHub Releases 頁面下載適用於您作業系統的安裝檔 (支援 `.dmg`, `.exe`, `.AppImage`, `.deb` 等)。

#### 2. 獨立伺服器與 Docker 部署 (Standalone / Docker)

如果您希望將此檢視器運行在無圖形介面的遠端伺服器，或在瀏覽器中開啟：

* **使用 Docker Compose (快速啟動)**:

  ```bash
  docker compose up
  ```

  啟動後，開啟瀏覽器進入 `http://localhost:3456`。

* **使用純 Docker 指令**:

  ```bash
  docker run -p 3456:3456 -v ~/.claude:/data/.claude:ro claude-devtools
  ```

* **使用 Node.js 直接運行 (適用於開發或純 Node 環境)**:

  ```bash
  pnpm install
  pnpm standalone:build
  node dist-standalone/index.cjs
  ```

#### 3. 設定與預設參數

* **掛載路徑**：應用程式預設監聽與讀取使用者家目錄的 `~/.claude`。
* **SSH 連線**：若要監聽遠端主機，可於介面的 Settings 區塊直接選擇您本機 `~/.ssh/config` 內配置好的主機，它會自動開始輪詢 (Polling) 來實現即時更新。
