# Conductor

[English](README.md)

AI エージェント（Claude Code 等）を人間が指揮するためのオーケストレーション UI。

---

## 概要

Conductor は、複数の AI エージェントをパイプラインとして組み合わせ、人間がその進行を管理・監督するためのツールです。エージェントを「いつ・どの順で・どんな条件で」動かすかを UI から定義し、実行中の出力・ログ・ファイル変更をリアルタイムで確認できます。

対象ユーザーは、AI エージェントを使って実際の開発・調査・自動化タスクを行いたいが、全自動では不安なため人間の目を挟みたいと考えているエンジニアです。

---

## 出来ること

### パイプライン管理（Pipeline View）
- エージェントノードをドラッグ＆ドロップで並べ替え、実行順を定義
- ノード間の依存関係（`on:done` / `on:error` / `on:approve` / `parallel`）を設定
- パイプライン全体の一括実行・停止、または個々のノード単位での実行
- 各エージェントの状態（idle / running / done / error / approval 待ち）をリアルタイム表示
- 実行中はプログレスバーと出力の一部をカード上に表示

### タスク管理（Task Board）
- カンバン形式（Todo / In Progress / Review / Done / Blocked）でタスクを管理
- タスクカードをドラッグ＆ドロップしてステータスを変更
- タスクの優先度（low / medium / high / critical）を色で識別
- エージェントへのタスク割り当てに対応

### ファイル管理（File Manager）
- プロジェクトルート以下のファイルツリーをブラウズ
- テキストファイルをその場で閲覧・編集・保存
- `.conductor/` の設定ファイル（YAML）もブラウザ上で直接編集可能

### ログ閲覧（Log Viewer）
- エージェントの標準出力・エラーをリアルタイムにストリーミング表示
- エージェント単位のフィルタリング
- ログレベル（info / warn / error / debug）を色で識別
- JSONL 形式でディスクにも永続保存（日付別）

### 承認ゲート（Approval Queue）
- `on:approve` 依存のノードは人間の承認まで実行をブロック
- 承認・却下をボタン一発で実行
- 承認待ちがあるときはヘッダーとナビに通知バッジを表示

### エージェント設定（Agent Config）
- CLI エージェント（コマンド・引数・作業ディレクトリ）を UI から登録
- REST API エージェント（Base URL）の登録にも対応
- タイムアウト・リトライ回数を個別設定

---

## 方式

```
フロントエンド (React + Vite, :5173)
  └── useWebSocket フック（WebSocket 接続 1本）
        ├── 受信イベント → Zustand ストア（自動更新）
        └── 送信メッセージ → バックエンド

バックエンド (Express 5 + ws, :3001)
  ├── REST API  /api/*  ← エージェント・パイプライン・タスク・ファイル管理
  └── WebSocket /ws     ← 状態変化・出力・ログをブロードキャスト
```

### 主要コンポーネント

| レイヤー | クラス / モジュール | 役割 |
|---|---|---|
| サービス | `OrchestratorService` | パイプライン状態機械。依存解決・リトライ制御 |
| サービス | `ApprovalGateway` | `on:approve` ノードを Promise でブロック |
| サービス | `LogService` | JSONL 書き込み + WebSocket ストリーミング |
| サービス | `FileWatcher` | chokidar でファイル変更を監視 |
| コネクター | `CliAdapter` | `child_process.spawn` で CLI エージェントを起動 |
| コネクター | `RestAdapter` | `fetch + AbortController` で REST エージェントを呼び出し |
| フロントエンド | Zustand ストア群 | WebSocket イベントで直接更新される唯一の状態源 |

### 設定ファイル

すべての設定は `.conductor/` ディレクトリに YAML で永続化されます。

```
.conductor/
├── project.yaml          # プロジェクト名・ルートパス
├── pipeline.yaml         # エージェントの順序・依存関係
├── agents/
│   └── claude-code.yaml  # エージェント接続設定（1ファイル1エージェント）
└── tasks/
    └── <uuid>.yaml       # タスク（1ファイル1タスク）
```

**`pipeline.yaml` の例：**

```yaml
version: 1
name: My Pipeline
agents:
  - id: node-01
    agent: claude-code
    order: 1
    task: "READMEを更新してください"
    instruction_files: []
  - id: node-02
    agent: claude-code
    order: 2
    task: "テストを実行してください"
    depends_on:
      - agent: node-01
        trigger: done       # node-01 完了後に自動起動
```

**`trigger` の種類：**

| 値 | 意味 |
|---|---|
| `done` | 前ノードが正常完了したら自動起動 |
| `error` | 前ノードがエラー終了したら自動起動 |
| `approve` | 人間が承認ボタンを押すまで待機 |
| `parallel` | 依存なし（パイプライン開始と同時に起動） |

### エージェント設定ファイル（`agents/*.yaml`）の例

```yaml
id: claude-code
name: Claude Code
type: cli
icon: "🤖"
color: "#4f8ef7"
connection:
  command: claude
  args:
    - "--dangerously-skip-permissions"
  cwd: "{project_root}"
defaults:
  timeout_minutes: 30
  retry_count: 2
  approval_required: false
  context_files:
    - memory/project-context.md   # 実行前にプロンプトへ付加するファイル
```

`{project_root}` や `{env.変数名}` はバックエンドが起動時に解決します。

---

## 使い方

### 前提

- Node.js 20 以上
- Claude Code CLI がインストール済み（`claude` コマンドが使える状態）

### インストール

```bash
git clone https://github.com/ujm/Conductor.git
cd Conductor

# バックエンド依存インストール
cd backend && npm install && cd ..

# フロントエンド依存インストール
cd frontend && npm install && cd ..
```

### 起動

```bash
# PROJECT_ROOT に管理したいプロジェクトのパスを指定
PROJECT_ROOT=/path/to/your/project npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

> **備考**  
> `npm run dev` はバックエンド（`:3001`）とフロントエンド（`:5173`）を同時に起動します。  
> フロントエンドの `/api` および `/ws` へのリクエストは Vite の dev proxy 経由でバックエンドに転送されます。

### 初回設定

1. `.conductor/` ディレクトリがなければ自動生成されます
2. **Agent Config** 画面でエージェントを登録するか、`.conductor/agents/` に YAML を直接作成します
3. **Pipeline View** でノードを追加し、依存関係を設定します
4. Pipeline View の **Run** ボタンでパイプラインを実行します

### パイプラインを実行する

1. Pipeline View を開く
2. エージェントカードの **▶ Run** ボタンを押す（個別実行）、またはヘッダーの **Run Pipeline** で全体実行
3. Log Viewer でリアルタイム出力を確認
4. `on:approve` ノードは Approval Queue 画面で承認 / 却下

### タスクをエージェントに渡す

1. Task Board で新しいタスクを作成（Enter キーまたは `+` ボタン）
2. `.conductor/tasks/<uuid>.yaml` に `assigned_agent` フィールドを設定
3. Pipeline のノード設定でそのタスク YAML を `instruction_files` に指定

### テスト

```bash
cd backend && npm test
```

---

## 技術スタック

| 領域 | 使用技術 |
|---|---|
| バックエンド | Node.js 20 / TypeScript 6 / Express 5 / ws |
| フロントエンド | React 19 / Vite 8 / TypeScript 6 / Tailwind CSS v4 |
| 状態管理 | Zustand 5 |
| パイプライン UI | React Flow (@xyflow/react) |
| テスト | Vitest |
| 設定フォーマット | YAML（js-yaml） |
