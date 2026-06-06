# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Conductor は AI エージェント（Claude Code、Codex 等）を人間が指揮するためのオーケストレーション UI。バックエンド（Node.js + Express + WebSocket）とフロントエンド（React + Vite）の2つの独立したアプリで構成される。

## Commands

### 開発起動（両方同時）
```bash
# ルートから同時起動（バックグラウンドで並列実行）
npm run dev

# バックエンドのみ（PROJECT_ROOT 指定が必須）
cd backend
PROJECT_ROOT=/path/to/your/project npx ts-node src/index.ts

# フロントエンドのみ
cd frontend
npm run dev
```

### バックエンド
```bash
cd backend
npm test              # vitest run（全テスト）
npm run test:watch    # vitest watch モード
npm run build         # tsc（dist/ へ出力）
npx tsc --noEmit      # 型チェックのみ
```

### フロントエンド
```bash
cd frontend
npm run build         # tsc -b && vite build
npm run lint          # eslint
npx tsc --noEmit      # 型チェックのみ
```

## Architecture

### データフロー

```
フロントエンド (React, :5173)
  └── useWebSocket フック
        ├── 受信イベント → Zustand ストア（自動更新）
        └── 送信メッセージ → バックエンド

バックエンド (Express, :3001)
  ├── REST API  /api/*
  │     └── OrchestratorService を通じてエージェント・パイプライン管理
  └── WebSocket /ws
        └── エージェント状態変化・出力・ログをブロードキャスト
```

Vite の dev proxy が `/api` と `/ws` を `:3001` に転送するため、フロントエンドのコードは相対パスで API を呼べる（`/api/agents` 等）。

### バックエンド層構造

**エントリーポイント** `backend/src/index.ts`：サービスを DI して Express + ws サーバーを起動。`PROJECT_ROOT` 環境変数でプロジェクトルートを指定する。

**サービス層** (`backend/src/services/`)：
- `OrchestratorService` — パイプライン実行の核心。エージェント状態機械（`idle→running→done/error` 等）、依存解決（`depends_on`）、リトライ制御を担う。パイプラインノードごとに `AgentConnector` インスタンスを生成する
- `ApprovalGateway` — `trigger: approve` のノードを Promise ベースでブロックし、`approve(id)` / `reject(id)` で解除する
- `LogService` — JSONL ファイルへの書き込みとリアルタイム WebSocket 配信を担う
- `FileWatcher` — chokidar でプロジェクトルートを監視し、ファイル変更を WebSocket に流す

**コネクター層** (`backend/src/connectors/`)：
- `AgentConnector` — 全アダプターが実装する interface（`start/stop/getStatus/onOutput/onComplete/onError`）
- `CliAdapter` — `child_process.spawn` で CLI エージェントを起動。コンテキストファイルを読み込んでプロンプトに付加してから渡す。exit code 0 = done、非0 = error
- `RestAdapter` — REST API 経由のエージェント用（fetch + AbortController）

### フロントエンド層構造

**状態管理**（`frontend/src/stores/`）：Zustand ストアが唯一の状態源。WebSocket 受信イベントが各ストアを直接更新する。コンポーネントは `fetch` で REST API を叩いてもストアに反映（`setTasks` 等）。

**WebSocket 統合**（`frontend/src/hooks/useWebSocket.ts`）：`App.tsx` で1回だけ呼ぶ。受信イベント名とストア更新の対応：
- `agent:status` → `agentStore.updateRuntimeState`
- `agent:output` → `agentStore.appendOutput`
- `pipeline:update` → `pipelineStore.setPipeline`
- `log:entry` → `logStore.addEntry`
- `approval:queue` → `approvalStore.setQueue`

**Pipeline View**（`frontend/src/components/pipeline/`）：React Flow を使用。`AgentCard` が custom node として登録されている。ノードの D&D 後に `onNodeDragStop` で X 座標順にソートし `pipeline:set` イベントをサーバーに送信。

### 設定ファイル（YAML）

プロジェクトルートの `.conductor/` ディレクトリが全設定の永続化先：

```
.conductor/
├── project.yaml       # プロジェクトメタ情報
├── pipeline.yaml      # パイプライン定義（エージェントの順序・依存関係）
├── agents/            # エージェント設定（1ファイル1エージェント）
│   └── claude-code.yaml
└── tasks/             # タスク定義（1ファイル1タスク）
    └── <uuid>.yaml
```

`pipeline.yaml` の `depends_on[].trigger` が `"approve"` のとき、ノード実行前に `ApprovalGateway` がブロックする。

### TypeScript の制約

- バックエンド：`strict: true`、`any` 型禁止、`path.join()` 必須、`.env` で環境変数管理
- バックエンドは CommonJS（`"module": "commonjs"`）のため、インポートパスに `.js` 拡張子は不要
- フロントエンドは ESM（`"type": "module"`）
- Express 5 + path-to-regexp v8 のため、ワイルドカードルートは `/*paramName` 形式（`/:param(.*)` は不可）
- フロントエンドの `req.params` は `string | string[]` 型のため `as string` キャストが必要

### テスト

テストは `backend/src/tests/` に集約。新しいサービスを追加したら同ディレクトリに `<ServiceName>.test.ts` を作成する。実ファイルシステムを使うテストは `os.tmpdir()` 以下に一時ディレクトリを作成し、`afterEach` で `fs.rm(dir, { recursive: true })` する。
