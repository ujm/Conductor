# CONDUCTOR — プロジェクト引き継ぎ資料

> **このファイルの目的**  
> Claude プロジェクト内で共有し、エージェント・別チャットセッション・新しい開発者が  
> 文脈なしでプロジェクトを理解・継続できるようにする。  
> セッション開始時に必ず読むこと。

---

## 1. プロダクト概要

### Conductor とは

**AIエージェント群を人間が指揮するための「コックピット」**

- 複数のAIエージェント（Claude Code / Codex / OpenClaw等）をオーケストレーションする専用ツール
- コーディングツールの枠を超えた汎用AIオーケストレーションプラットフォーム
- **人間の役割**: ゴール入力・計画承認・結果確認のみ（コードを書かない・編集しない）
- **AIの役割**: 計画立案・タスク実行・ファイル生成・レビューなどすべての実作業

### 設計原則

1. **Human-First** — 人間は指揮するだけ
2. **AI-Orchestrated** — OpenClawが計画を立て、Claude Codeが実行する
3. **File-as-Truth** — 指示書・設計書・記憶はMarkdownファイルで管理
4. **Observable** — エージェントの状態・ログ・依存関係を常に可視化
5. **Approval Gate** — 計画は人間が承認してから実行

---

## 2. アーキテクチャ

### 全体構成

```
人間（Conductor UI）
  ↓ ゴール入力
Conductor バックエンド（Node.js + Express, port 3001）
  ↓ openclaw agent --agent conductor-orchestrator --local
conductor-orchestrator（OpenClaw / claude-sonnet-4-6）
  ↓ 計画JSON返却
Conductor バックエンド
  ↓ Pipeline Viewに表示 → 人間が承認
  ↓ CliAdapter経由でClaude Codeを起動
Claude Code CLI（--dangerously-skip-permissions）
  ↓ stdout → WebSocket → LogViewer
Conductor バックエンド → 完了通知
```

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React + TypeScript + Vite（port 5173） |
| UIコンポーネント | Tailwind CSS |
| パイプライン表示 | React Flow (@xyflow/react) |
| 状態管理 | Zustand |
| バックエンド | Node.js + Express + TypeScript |
| リアルタイム通信 | WebSocket (ws) |
| プロセス管理 | node:child_process |
| ファイル監視 | chokidar |
| 設定ファイル | YAML (js-yaml) |
| オーケストレーターAI | OpenClaw 2026.6.1 / conductor-orchestrator |
| コーディングAI | Claude Code CLI |

### ディレクトリ構成

```
/Users/yoshiakigoto/work/Conductor/
├── frontend/                  # React アプリ
│   └── src/
│       ├── pages/             # PipelineView, TaskBoard, FileManager...
│       ├── components/        # AgentCard, StatusBar, PromptLibrary...
│       ├── stores/            # Zustand: agent/pipeline/task/log/prompt/ws/nav
│       └── hooks/             # useWebSocket
├── backend/                   # Node.js サーバー
│   └── src/
│       ├── services/          # OrchestratorService, OpenClawAdapter,
│       │                      # CliAdapter, PromptService, LogService...
│       ├── connectors/        # AgentConnector(i/f), CliAdapter, RestAdapter
│       └── routes/            # agents, pipeline, orchestrate, prompts...
└── .conductor/                # プロジェクト設定（自動生成）
    ├── project.yaml
    ├── pipeline.yaml          # AI生成・動的更新
    ├── agents/                # エージェント設定YAML
    └── prompts/               # プロンプトテンプレート
```

---

## 3. OpenClaw / エージェント設定

### 設定済みエージェント

```
openclaw agents の出力:

- main (default)
  Model: anthropic/claude-sonnet-4-6
  Workspace: ~/.openclaw/workspace

- conductor-orchestrator   ← オーケストレーター専用
  Model: anthropic/claude-sonnet-4-6
  Workspace: ~/.openclaw/workspace/conductor-orchestrator
```

### 認証

```
Auth profile: anthropic:claude-cli (claude-cli/oauth)
Claude CLI の認証情報を自動使用（追加費用なし）
※ 2026年6月15日以降、Pro/MaxプランはAgent SDKクレジット付与
```

### Conductor に登録済みのエージェント

```yaml
# .conductor/agents/claude-code.yaml
id: claude-code
name: メイン
type: cli
connection:
  command: claude
  args: ["--dangerously-skip-permissions"]
  cwd: /Users/yoshiakigoto/work/Conductor
defaults:
  timeout_minutes: 30
  retry_count: 2
  approval_required: false
```

---

## 4. 実装済み機能（現在の状態）

### ✅ 完了済み

| 機能 | 詳細 |
|------|------|
| **Pipeline View** | React Flow ノード表示・D&D順序変更・エージェント追加/削除 |
| **AI-Orchestrated Mode** | ゴール入力 → conductor-orchestratorが計画立案 → 承認 → 実行 |
| **AgentConfig** | エージェント登録・編集（CWD設定含む）・接続テスト |
| **PromptLibrary** | テンプレート管理・{{変数}}ハイライト・Pipeline紐付け |
| **StatusBar** | 全画面下部固定・状態カウンター・最新ログ・WS接続インジケーター |
| **LogViewer** | リアルタイム表示・エージェント別フィルタ |
| **FileManager** | .conductor/ 以下のファイル閲覧・編集 |
| **TaskBoard** | カンバン形式・D&DでステータスChanges |
| **ApprovalQueue** | 承認待ち一覧・承認/却下 |
| **OrchestratorService** | 状態機械・依存解決・リトライ・再実行対応 |
| **WebSocket** | 全イベント実装・自動再接続（×5回） |
| **型チェック** | frontend/backend 両方 tsc --noEmit エラーなし |
| **ユニットテスト** | 10件 vitest 全パス |

### ⚠️ 既知の課題（未修正）

| 課題 | 詳細 | 優先度 |
|------|------|--------|
| ノードの重なり | AI Generated Planのステップが横に重なって表示される | 中 |
| Block B 未着手 | テスト拡充・ドキュメント整備・E2Eテスト | 中 |

---

## 5. 動作確認済みフロー

### エンドツーエンド確認（2026-06-07）

```
入力ゴール:
「/Users/yoshiakigoto/work/Conductor に hello.txt を作成して。
 内容は "Hello from Conductor v2.0" にしてください。」

結果:
- conductor-orchestrator が2ステップの計画を立案
  Step 1: ディレクトリ確認
  Step 2: hello.txt 作成（step-1依存）
- 承認後、Claude Codeが順次実行
- /Users/yoshiakigoto/work/Conductor/hello.txt に
  "Hello from Conductor v2.0" が書き込まれた ✅
```

---

## 6. 起動手順

```bash
# バックエンド起動（ターミナル1）
cd /Users/yoshiakigoto/work/Conductor/backend
npm run dev
# → http://localhost:3001

# フロントエンド起動（ターミナル2）
cd /Users/yoshiakigoto/work/Conductor/frontend
npm run dev
# → http://localhost:5173

# ポート競合エラーが出た場合
lsof -ti:3001 | xargs kill -9
```

---

## 7. 今後のロードマップ

### 直近（次のセッション）

- [ ] **ノード重なり修正**
  - `planToPipeline()` でノードに `position: { x: 100, y: i * 200 }` を設定
  - 縦並びにする

- [ ] **Block B: テスト拡充**
  - ユニットテスト: 10件 → 30件以上
  - コンポーネントテスト: 0件 → 15件以上（@testing-library/react）
  - E2Eテスト: 0件 → 5件（Playwright）

- [ ] **Block B: エラーハンドリング統一**
  - ErrorCode 統一形式
  - ErrorBoundary 実装

- [ ] **Block B: ドキュメント整備**
  - README.md
  - docs/AGENTS.md
  - docs/PIPELINE.md

### 中期（v1.5）

- [ ] Codex（OpenAI REST API）統合
- [ ] parallel trigger（複数エージェント同時実行）
- [ ] 画像・音声AI対応

### 長期（v2.x）

- [ ] Electron デスクトップアプリ化
- [ ] 通知（Slack/GitHub連携）
- [ ] マルチプロジェクト管理
- [ ] 実行履歴・ロールバック

---

## 8. 設計判断の記録

| 判断 | 決定内容 | 理由 |
|------|---------|------|
| アーキテクチャ | 独立したWebアプリ（VSCode拡張ではない） | コーディングの枠を超えた用途のため |
| オーケストレーター | AI指揮モード（OpenClaw） | 人間が指揮するより自律的で効率的 |
| オーケストレーターAI | conductor-orchestrator（Sonnet） | 計画・判断にはOpusより軽量なSonnetで十分 |
| Claude Code起動 | Conductorバックエンドが中継（方式B） | ログ・状態管理をConductorに集約するため |
| エージェント通信 | CLI方式（SDK方式ではない） | 追加費用なし・シンプル・既存実装を活かせる |
| StatusBar実装 | flex-childとして実装（fixedではない） | 既存のflex-col h-screenレイアウトと整合するため |
| WS状態管理 | wsStore に分離（useWebSocket内で書き込み） | 複数箇所でuseWebSocketを呼ぶと複数のWS接続が開くため |
| ナビゲーション | navStore に移行 | StatusBarからsetView()を呼べるようにするため |

---

## 9. ファイル・API早見表

### 主要APIエンドポイント

```
GET    /api/agents                    エージェント一覧
POST   /api/agents                    エージェント登録
PUT    /api/agents/:id                エージェント更新
POST   /api/agents/:id/test           接続テスト

GET    /api/pipeline                  パイプライン取得
PUT    /api/pipeline                  パイプライン更新
POST   /api/pipeline/run              実行開始
POST   /api/pipeline/stop             全停止
POST   /api/pipeline/agents           エージェントノード追加
DELETE /api/pipeline/agents/:nodeId   ノード削除

POST   /api/orchestrate               ゴール → 計画立案
POST   /api/orchestrate/approve       計画承認 → 実行
POST   /api/orchestrate/replan        修正して再計画
GET    /api/orchestrate/plan          現在の計画取得

GET    /api/prompts                   プロンプト一覧
POST   /api/prompts                   新規作成
PUT    /api/prompts/:id               更新
DELETE /api/prompts/:id               削除
POST   /api/prompts/:id/resolve       変数展開

GET    /api/tasks                     タスク一覧
POST   /api/tasks                     タスク作成
PUT    /api/tasks/:id                 タスク更新

GET    /api/files                     ファイルツリー
GET    /api/files/:path               ファイル内容
PUT    /api/files/:path               ファイル更新

POST   /api/approvals/:id/approve     承認
POST   /api/approvals/:id/reject      却下
```

### WebSocketイベント

```
Server → Client:
  agent:status        エージェント状態変化
  agent:output        stdout チャンク
  agent:done          完了
  agent:error         エラー
  approval:needed     承認待ち発生
  pipeline:planning   計画立案中
  pipeline:plan_ready 計画完了（承認待ち）
  pipeline:update     パイプライン更新
  log:entry           ログエントリ追加
  file:changed        ファイル変更

Client → Server:
  pipeline:set        パイプライン順序変更
  agent:run           エージェント実行
  agent:stop          エージェント停止
```

---

## 10. Claude Codeへの指示テンプレート

新しいセッションでClaude Codeに指示を出す際のテンプレート:

```
このファイル（CONDUCTOR_PROJECT.md）を読んだ上で作業してください。

プロジェクトパス: /Users/yoshiakigoto/work/Conductor
バックエンド: Node.js + Express + TypeScript（port 3001）
フロントエンド: React + TypeScript + Vite（port 5173）
TypeScript strict モード必須・any型禁止

【今回の作業】
（ここに具体的な指示を記載）

完了後は以下を報告してください:
- 変更したファイル一覧
- 動作確認結果
- npx tsc --noEmit の結果
```

---

*最終更新: 2026-06-07*  
*更新者: Conductor Project*
