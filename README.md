<p align="center">
  <img src="resources/icons/png/1024x1024.png" alt="claude-devtools" width="120" />
</p>

<h1 align="center">claude-devtools</h1>

<p align="center">
  <a href="https://www.producthunt.com/products/claude-devtools?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-claude-devtools" target="_blank" rel="noopener noreferrer">
    <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1080673&theme=light" alt="claude-devtools - See everything Claude Code hides from your terminal | Product Hunt" width="250" height="54" />
  </a>
</p>

<p align="center">
  <strong><code>終端機什麼都沒告訴你。這裡讓你看清楚一切。</code></strong>
  <br />
  一個桌面應用程式，從你機器上已有的原始 session 紀錄，精確還原 Claude Code 做了什麼——每個檔案路徑、每個工具呼叫、每個 token。
</p>



<p align="center">
  <a href="https://claude-dev.tools"><img src="https://img.shields.io/badge/Website-claude--dev.tools-blue?style=flat-square" alt="Website" /></a>&nbsp;
  <a href="https://github.com/matt1398/claude-devtools/releases/latest"><img src="https://img.shields.io/github/v/release/matt1398/claude-devtools?style=flat-square&label=version&color=blue" alt="Latest Release" /></a>&nbsp;
  <a href="https://github.com/matt1398/claude-devtools/actions/workflows/ci.yml"><img src="https://github.com/matt1398/claude-devtools/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>&nbsp;
  <a href="https://github.com/matt1398/claude-devtools/releases"><img src="https://img.shields.io/github/downloads/matt1398/claude-devtools/total?style=flat-square&color=green" alt="Downloads" /></a>&nbsp;
  <img src="https://img.shields.io/badge/platform-macOS%20(Apple%20Silicon%20%2B%20Intel)%20%7C%20Linux%20%7C%20Windows%20%7C%20Docker-lightgrey?style=flat-square" alt="Platform" />
</p>

<br />

<p align="center">
  <a href="https://claude-dev.tools">
    <img src="https://img.shields.io/badge/Website-claude--dev.tools-171717?logo=googlechrome&logoColor=white&style=flat" alt="Website" height="30" />
  </a>&nbsp;&nbsp;
  <a href="https://github.com/matt1398/claude-devtools/releases/latest">
    <img src="https://img.shields.io/badge/macOS-下載-black?logo=apple&logoColor=white&style=flat" alt="Download for macOS" height="30" />
  </a>&nbsp;&nbsp;
  <a href="https://github.com/matt1398/claude-devtools/releases/latest">
    <img src="https://img.shields.io/badge/Linux-下載-FCC624?logo=linux&logoColor=black&style=flat" alt="Download for Linux" height="30" />
  </a>&nbsp;&nbsp;
  <a href="https://github.com/matt1398/claude-devtools/releases/latest">
    <img src="https://img.shields.io/badge/Windows-下載-0078D4?logo=windows&logoColor=white&style=flat" alt="Download for Windows" height="30" />
  </a>&nbsp;&nbsp;
  <a href="#docker--standalone-部署">
    <img src="https://img.shields.io/badge/Docker-部署-2496ED?logo=docker&logoColor=white&style=flat" alt="Deploy with Docker" height="30" />
  </a>&nbsp;&nbsp;
  <a href="#安裝方式">
    <img src="https://img.shields.io/badge/Homebrew-安裝-FBB040?logo=homebrew&logoColor=white&style=flat" alt="Install with Homebrew" height="30" />
  </a>
</p>

<p align="center">
  <sub>100% 免費開源。無需 API 金鑰。無需設定。下載後直接開啟，即可看清 Claude Code 做了什麼。</sub>
</p>

<br />

<p align="center">
  <video src="https://github.com/user-attachments/assets/2b420b2c-c4af-4d10-a679-c83269f8ee99">
    您的瀏覽器不支援影片標籤。
  </video>
</p>

---

## 安裝方式

### Homebrew（macOS）

```bash
brew install --cask claude-devtools
```

### 直接下載

| 平台 | 下載 | 說明 |
|------|------|------|
| **macOS**（Apple Silicon）| [`.dmg`](https://github.com/matt1398/claude-devtools/releases/latest) | 下載 `arm64` 版本，拖入「應用程式」資料夾。首次啟動：右鍵 → 開啟 |
| **macOS**（Intel）| [`.dmg`](https://github.com/matt1398/claude-devtools/releases/latest) | 下載 `x64` 版本，拖入「應用程式」資料夾。首次啟動：右鍵 → 開啟 |
| **Linux** | [`.AppImage` / `.deb` / `.rpm` / `.pacman`](https://github.com/matt1398/claude-devtools/releases/latest) | 依您的發行版選擇套件格式（可攜式 AppImage 或原生套件管理器格式）|
| **Windows** | [`.exe`](https://github.com/matt1398/claude-devtools/releases/latest) | 標準安裝程式。可能觸發 SmartScreen——點選「更多資訊」→「仍要執行」|
| **Docker** | `docker compose up` | 開啟 `http://localhost:3456`。詳見 [Docker / Standalone 部署](#docker--standalone-部署) |

應用程式從 `~/.claude/` 讀取 session 紀錄——資料已在您的機器上。無需設定、無需 API 金鑰、無需登入。

---

## 為什麼需要這個工具

### Claude Code 不再告訴你它在做什麼。

近期 Claude Code 的更新將詳細的工具輸出替換成了模糊的摘要：`Read 3 files`、`Searched for 1 pattern`、`Edited 2 files`——沒有路徑、沒有內容、沒有行號。Context 使用指示器變成了一個沒有細項的三段式進度條。想要看回詳細資訊，唯一的選項是 `--verbose`——但這會把原始 JSON、內部系統提示和數千行雜訊全部傾倒進你的終端機。

**CLI 沒有中間地帶。** 要麼看太少，要麼看太多。

claude-devtools 還原了被拿走的資訊——結構化、可搜尋，而且完全不修改 Claude Code 本身。它讀取 `~/.claude/` 裡的原始 session 紀錄，重建完整的執行軌跡：每個被讀取的檔案路徑、每個被搜尋的正規表示式、每個被套用的 diff、每個被消耗的 token——整理成一個你真正能夠思考的視覺介面。

### 包裝器問題。

市面上有很多 Claude Code 的 GUI 包裝器——Conductor、Craft Agents、Vibe Kanban、1Code、ccswitch 等等。我全都試過了，沒有一個解決真正的問題：

**它們包裝了 Claude Code。** 它們注入自己的提示、添加自己的抽象層，並改變 Claude 的行為方式。如果你熱愛終端機——我確實如此——你不會想要這樣。你想要的是原汁原味的 Claude Code。

**它們只顯示自己的 session。** 在終端機裡執行了什麼？在它們的介面裡根本不存在。你只能看到透過*它們的*工具執行的內容。終端機和 GUI 是兩個完全不同的世界。

**你無法除錯出錯的地方。** Session 失敗了——但為什麼？Context 填滿太快——但是什麼在消耗它？一個 subagent 生出了 5 個子代理——但它們做了什麼？即使在終端機裡，翻回一個漫長 session 的歷史來重建發生的事情也幾乎是不可能的。

**你無法監控重要的事件。** 想知道 Claude 何時讀取了 `.env`？一個工具呼叫什麼時候超過了 4K tokens 的 context？隊友何時發送了關閉請求？你必須每次、針對每個專案手動設置 hooks。

**claude-devtools 採取了不同的做法。** 它完全不包裝或修改 Claude Code。它讀取你機器上已有的 session 紀錄（`~/.claude/`），並將其轉化為豐富的互動介面——無論 session 是在終端機、IDE 還是其他工具中執行的。

> 零設定。無需 API 金鑰。適用於你執行過的每一個 session。

---

## 主要功能

### :mag: 可見 Context 重建

<img width="100%" alt="context" src="https://github.com/user-attachments/assets/9ff4a5a7-bcf6-47fb-8ca5-d4021540804b" />

Claude Code 不會揭露 context 視窗中實際包含什麼。claude-devtools 對其進行逆向工程。

引擎逐一走過 session 的每個回合，重建完整的 context 注入集合——**CLAUDE.md 檔案**（細分為全域、專案和目錄層級）、**skill 啟動**、**@-提及的檔案**、**工具呼叫的輸入和輸出**、**延伸思考**、**團隊協調開銷**以及**使用者提示文字**。

結果是跨 7 個類別的逐回合 token 歸因估算，呈現在三個地方：每個助理回應上的 **Context 徽章**、帶有百分比細項的 **Token 使用量彈出視窗**，以及專屬的 **Session Context 面板**。

### :chart_with_downwards_trend: 壓縮視覺化

<video src="https://github.com/user-attachments/assets/25281f09-05ed-4f81-97bc-7b1754b08b06" controls="controls" muted="muted" style="max-width: 100%;"></video>

**看見你的 context 觸及上限的那一刻。**

當 Claude Code 達到 context 上限時，它會悄悄壓縮你的對話並繼續。大多數工具甚至不會注意到這件事發生了。

claude-devtools 偵測這些壓縮邊界，測量前後的 token 差異，並視覺化你的 context 在整個 session 過程中如何填充、壓縮和再次填充。你可以精確看到任何時間點視窗中有什麼，以及每次壓縮事件後組成如何變化。

### :bell: 自訂通知觸發器

<video src="https://github.com/user-attachments/assets/3b07b3b4-57af-49ed-9539-be7c56a244f5" controls="controls" muted="muted" style="max-width: 100%;"></video>

定義你希望在何時收到**系統通知**的規則。使用 regex 模式比對、指定顏色，並依觸發器篩選通知匣。

- **內建預設**：`.env 檔案存取警告`、`工具結果錯誤`（`is_error: true`）以及`高 Token 使用量`（預設：8,000 總 tokens）。
- **自訂比對**：針對特定欄位使用 regex，例如 `file_path`、`command`、`prompt`、`content`、`thinking` 或 `text`。
- **敏感檔案監控**：為 `.env`、`secrets`、付款/帳單/stripe 路徑或任何專案特定模式建立警告。
- **雜訊控制**：選擇輸入/輸出/總計 token 閾值、新增忽略模式，並將觸發器範圍限定於選定的儲存庫。

### :hammer_and_wrench: 豐富的工具呼叫檢視器

每個工具呼叫都與其結果配對，顯示在可展開的卡片中。專屬檢視器以原生方式渲染每個工具：
- **Read** 呼叫顯示帶有行號的語法高亮程式碼
- **Edit** 呼叫顯示帶有新增/刪除高亮的行內 diff
- **Bash** 呼叫顯示指令輸出
- **Subagent** 呼叫顯示完整的執行樹，可就地展開

### :busts_in_silhouette: 團隊與 Subagent 視覺化

Claude Code 現在透過 Task 工具生成 subagent，並透過 `TeamCreate`、`SendMessage` 和 `TaskUpdate` 協調整個團隊。在終端機裡，這些全都會崩潰成難以閱讀的資料流。claude-devtools 將其理清。

- **Subagent sessions** 從 Task 工具呼叫中解析出來，渲染為可展開的行內卡片——每個都有自己的工具軌跡、token 指標、持續時間和成本。巢狀 subagent（代理生成代理）渲染為遞迴樹狀結構。
- **隊友訊息**——透過帶有顏色和摘要後設資料的 `SendMessage` 發送——被偵測並渲染為獨特的彩色卡片，與一般使用者訊息分開。每個隊友以名稱和指定顏色識別。
- **團隊生命週期**完全可見：`TeamCreate` 初始化、`TaskCreate`/`TaskUpdate` 協調、`SendMessage` 直接訊息和廣播、關閉請求和回應，以及 `TeamDelete` 拆除。
- **Session 摘要**將不同隊友數量與 subagent 數量分開顯示，讓你一眼就能看出有多少代理參與以及工作如何分配。

### :zap: 指令面板與跨 Session 搜尋

按 **Cmd+K** 開啟 Spotlight 風格的指令面板。跨專案的所有 session 進行搜尋——結果顯示帶有高亮關鍵字的上下文片段。直接導覽至精確的訊息。

### :globe_with_meridians: SSH 遠端 Session

透過 SSH 連接到任何遠端機器，並在那裡檢視正在執行的 Claude Code session——相同的介面，無任何妥協。

claude-devtools 解析你的 `~/.ssh/config` 取得主機別名，支援代理轉發、私鑰和密碼驗證，然後開啟 SFTP 通道從遠端 `~/.claude/` 目錄串流 session 紀錄。每個 SSH 主機都有自己獨立的服務 context，具有獨立的快取、檔案監聽器和解析器。在本機和遠端工作區之間切換是即時的——應用程式在切換前將你的當前狀態快照至 IndexedDB，並在你返回時還原，包括所有分頁。

### :bar_chart: 多窗格佈局

並排開啟多個 session。在窗格之間拖放分頁、分割檢視，並平行比較 session——就像一個適合 AI 對話的正式 IDE。

---

## CLI 隱藏了什麼 vs. claude-devtools 顯示什麼

| 終端機裡你看到的 | claude-devtools 顯示給你的 |
|----------------|--------------------------|
| `Read 3 files` | 精確的檔案路徑、帶有行號的語法高亮內容 |
| `Searched for 1 pattern` | regex 模式、每個符合的檔案及符合的行 |
| `Edited 2 files` | 每個檔案帶有新增/刪除高亮的行內 diff |
| 三段式 context 條 | 跨 7 個類別的逐回合 token 歸因——CLAUDE.md 細項、skills、@-提及、工具輸入輸出、思考、團隊、使用者文字——以及顯示 context 如何填充、壓縮和再填充的壓縮視覺化 |
| 與主執行緒交錯的 subagent 輸出 | 每個代理的獨立執行樹，可就地展開並附有自己的指標 |
| 埋在 session 紀錄中的隊友訊息 | 帶有名稱、訊息和完整團隊生命週期可見性的彩色隊友卡片 |
| 混入正常輸出的關鍵事件 | 針對 `.env` 存取、付款相關檔案路徑、執行錯誤和高 token 使用量的觸發器篩選通知匣 |
| `--verbose` JSON 傾印 | 結構化、可篩選、可導覽的介面——無雜訊 |

---

## TUI 終端機模式

在終端機中直接瀏覽 Claude Code session，無需開啟桌面應用程式。

```bash
pnpm tui
```

### 版面配置

```
┌──────────────────────────────────────────────────────────┐
│  claude-devtools TUI                                     │
│  Projects > my-project > Fix login validation bug        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  (1/24) [LIVE] · 8 turns · 2m 15s · 45,230 tokens       │
│  ████░░░░░░░░░░░░ 45,230 / 200,000 (23%)                │
│  ────────────────────────────────────────────────────    │
│  ▸ › [User] 14:30  Fix the login page validation bug    │
│    › [AI] 1.2s · Read(2) Edit(1) · 15,280 tokens        │
│    › [System] pnpm test ── 12 passed                    │
│                                                          │
│  ────────────────────────────────────────────────────    │
│  ↑↓:nav  →:expand  ←:back  d/u:page  c:context  ?:help │
├──────────────────────────────────────────────────────────┤
│  ↑↓:nav  →:select  ←:back  /:filter  ?:help  q:quit     │
└──────────────────────────────────────────────────────────┘
```

### TUI 操作說明

| 按鍵 | 動作 |
|------|------|
| `↑` / `↓` | 瀏覽列表或逐行捲動聊天記錄 |
| `→` | 選擇項目 / 展開 AI 回應 |
| `←` | 返回上一層 / 收合項目 |
| `d` / `u` | 聊天模式向下/上半頁 |
| `/` | Session 列表過濾 / 聊天記錄搜尋 |
| `c` | 切換 Context 注入詳情面板 |
| `r` | 重新整理目前 session |
| `?` | 說明視窗 |
| `q` | 退出（在專案列表模式）|

### TUI 功能特色

- **三層導覽**：專案列表 → Session 列表 → 聊天記錄
- **導覽列（Breadcrumb）**：即時顯示目前所在位置
- **逐行捲動**：聊天記錄 ↑/↓ 每次移動一行，不會跳項目
- **Subagent 鑽取**：進入 Task 工具呼叫查看子代理詳情，支援多層巢狀
- **即時更新**：監聽 JSONL 檔案變更，自動重新整理進行中的 session
- **Session 過濾**：在 session 列表中按 `/` 即時搜尋
- **聊天搜尋**：在聊天模式按 `/` 搜尋記錄，高亮匹配項目
- **Syntax Highlighting**：程式碼區塊依語言自動上色

---

## Docker / Standalone 部署

不使用 Electron 執行 claude-devtools——在 Docker、遠端伺服器或任何能執行 Node.js 的地方皆可。

### 快速開始（Docker Compose）

```bash
docker compose up
```

在瀏覽器中開啟 `http://localhost:3456`。

### 快速開始（Docker）

```bash
docker build -t claude-devtools .
docker run -p 3456:3456 -v ~/.claude:/data/.claude:ro claude-devtools
```

### 快速開始（Node.js）

```bash
pnpm install
pnpm standalone:build
node dist-standalone/index.cjs
```

### 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `CLAUDE_ROOT` | `~/.claude` | `.claude` 資料目錄的路徑 |
| `HOST` | `0.0.0.0` | 綁定位址 |
| `PORT` | `3456` | 監聽埠號 |
| `CORS_ORIGIN` | `*`（standalone）| CORS 來源政策（`*`、特定來源或逗號分隔的清單）|

### 注意事項

- **即時更新可能比 Electron 慢。** Electron 應用程式使用原生檔案系統監聽器搭配 IPC 即時更新。Docker/standalone 伺服器使用 HTTP 上的 SSE（Server-Sent Events），當 session 正在被寫入時可能會引入些微延遲。
- **自訂 Claude 根目錄路徑。** 如果你的 `.claude` 目錄不在 `~/.claude`，請更新 volume 掛載以指向正確位置：
  ```bash
  # 範例：Claude 根目錄在 /home/user/custom-claude-dir
  docker run -p 3456:3456 -v /home/user/custom-claude-dir:/data/.claude:ro claude-devtools

  # 或使用 docker compose，設定 CLAUDE_DIR 環境變數：
  CLAUDE_DIR=/home/user/custom-claude-dir docker compose up
  ```

### 注重安全性的部署

standalone 伺服器有**零個**對外網路呼叫。如需最大隔離：

```bash
docker run --network none -p 3456:3456 -v ~/.claude:/data/.claude:ro claude-devtools
```

請參閱 [SECURITY.md](SECURITY.md) 以取得完整的網路活動稽核。

---

## 開發

<details>
<summary><strong>從原始碼建置</strong></summary>

<br />

**前置條件：** Node.js 20+、pnpm 10+

```bash
git clone https://github.com/matt1398/claude-devtools.git
cd claude-devtools
pnpm install
pnpm dev
```

應用程式會從 `~/.claude/` 自動探索你的 Claude Code 專案。

#### 建置發行版本

```bash
pnpm dist:mac:arm64  # macOS Apple Silicon (.dmg)
pnpm dist:mac:x64    # macOS Intel (.dmg)
pnpm dist:win        # Windows (.exe)
pnpm dist:linux      # Linux (AppImage/.deb/.rpm/.pacman)
pnpm dist            # macOS + Windows + Linux
```

#### 指令清單

| 指令 | 說明 |
|------|------|
| `pnpm dev` | 開發模式，附熱重載 |
| `pnpm build` | 正式版建置 |
| `pnpm typecheck` | TypeScript 型別檢查 |
| `pnpm lint:fix` | Lint 並自動修正 |
| `pnpm test` | 執行所有測試 |
| `pnpm test:watch` | 監聽模式 |
| `pnpm test:coverage` | 覆蓋率報告 |
| `pnpm check` | 完整品質管線（型別 + lint + 測試 + 建置）|
| `pnpm tui` | 建置並執行 TUI 終端機模式 |

</details>

---

## 貢獻

開發指南請參閱 [CONTRIBUTING.md](CONTRIBUTING.md)。請閱讀我們的[行為準則](CODE_OF_CONDUCT.md)。

## 安全性

IPC handlers 以嚴格的路徑包含檢查驗證所有輸入。檔案讀取被限制在專案根目錄和 `~/.claude`。敏感的憑證路徑被封鎖。詳見 [SECURITY.md](SECURITY.md)。

## 授權條款

[MIT](LICENSE)
