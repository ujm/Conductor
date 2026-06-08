# Conductor_BlockA_Remaining.docx 実装完了報告

**実施日**: 2026-06-07  
**実装者**: Claude Sonnet 4.6

---

## 実装チェックリスト

### Prompt Library（P-1〜P-12）

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| P-1 | `PromptService` YAML 読み書き（`backend/src/services/PromptService.ts`） | ✅ | list / get / save / delete / resolve / extractVariables 実装済み |
| P-2 | `/api/prompts` 全エンドポイント稼働 | ✅ | GET, POST, PUT, DELETE, POST /resolve, POST /extract の6エンドポイント |
| P-3 | `/api/prompts/:id/resolve` 変数置換 | ✅ | curl で動作確認済み（正常ケース検証） |
| P-4 | `PROMPT_VARIABLE_MISSING` エラー返却 | ✅ | curl で動作確認済み（`{"code":"PROMPT_VARIABLE_MISSING"}`） |
| P-5 | Prompt Library 画面を "prompts" ビューで表示 | ✅ | `BookOpen` アイコンでナビに追加 |
| P-6 | `{{変数名}}` をアンバー色でハイライト | ✅ | `HighlightedTemplate` コンポーネント実装（エスケープ済み） |
| P-7 | 変数入力フォームが動的生成 | ✅ | テンプレート編集時に `{{変数}}` を自動抽出してフォームを生成 |
| P-8 | `file_path` 型変数に 📁 ボタン | ✅ | `<input type="file">` を `createElement` で起動 |
| P-9 | プレビューボタンで解決済みプロンプト表示 | ✅ | 保存済み → `/resolve` API、未保存 → フロントエンドで仮解決 |
| P-10 | "パイプラインで使用" でノードに `prompt_id` を紐付け | ✅ | `UsePipelineModal` → `PUT /api/pipeline` で更新 |
| P-11 | `AgentCard` に 📋 `prompt_id` バッジ表示 | ✅ | `node.prompt_id` があれば amber バッジを表示 |
| P-12 | `OrchestratorService` が `prompt_id` を使って解決済みプロンプトを渡す | ✅ | `buildPrompt(node)` → 両方の `connector.start()` 呼び出し（初回＋リトライ）に反映 |

### StatusBar（S-1〜S-6）

| # | 項目 | 状態 | 備考 |
|---|------|------|------|
| S-1 | StatusBar が全画面下部に表示 | ✅ | `<footer>` として flex 子要素（fixed ではなくレイアウト都合で flex-child を選択） |
| S-2 | 状態カウントがリアルタイム更新 | ✅ | `runtimeStates` を `useAgentStore` から購読（`agent:status` WS イベントで更新） |
| S-3 | 最新イベントがフェードイン表示 | ✅ | `LatestEvent` コンポーネント（opacity 0→1 transition 300ms） |
| S-4 | 承認待ち件数が amber バッジ、クリックで Approvals 画面へ | ✅ | `useNavStore.setView("approvals")` で遷移 |
| S-5 | WS 切断で赤インジケーター＋再接続カウント | ✅ | `useWsStore.isConnected / reconnectCount` で表示制御 |
| S-6 | メインコンテンツが StatusBar に隠れない | ✅ | flex-col レイアウトでコンテンツと StatusBar が別行に収まる |

---

## 主要な設計判断

### StatusBar を `fixed` ではなく flex 子要素として実装
既存レイアウトが `flex-col h-screen` であるため、`<footer>` を flex child に置き換えることで `pb-7` 等のパディング追加が不要になり、コンテンツとの重複も発生しない。

### WS 状態を `wsStore` に持たせる
仕様書では `const { isConnected } = useWebSocket()` と記載されているが、`useWebSocket` を複数箇所で呼ぶと WebSocket が複数本開く（CLAUDE.md の規約違反）。`wsStore.ts` を追加して `useWebSocket` フック内から書き込み、StatusBar は `useWsStore` から読む。

### アクティブビューを `navStore` に移動
StatusBar の「承認待ちクリック → Approvals 画面遷移」を実現するため、`App.tsx` の `useState<ViewId>` を `useNavStore` に移行。StatusBar から `setView()` を呼べる。

### `buildPrompt()` を `runNode()` の先頭で一度だけ解決
アドバイスに従い、リトライ時も同じ `prompt` 文字列を再利用（`connector.start()` 2ヵ所を同一変数で呼ぶ）。`PROMPT_VARIABLE_MISSING` の場合はノードを `error` 状態に遷移させてパイプラインを止める。

### 日本語テンプレート名の slug フォールバック
日本語のみの名前は `slugify()` で空文字になるため、`template-${randomBytes(4).toString("hex")}` にフォールバック（確認済み）。

---

## 作成・変更ファイル一覧

### バックエンド
| ファイル | 変更種別 |
|---------|---------|
| `backend/src/types/prompt.ts` | 新規 |
| `backend/src/utils/slug.ts` | 新規 |
| `backend/src/services/PromptService.ts` | 新規 |
| `backend/src/routes/prompts.ts` | 新規 |
| `backend/src/types.ts` | 更新（`PipelineNode` に `prompt_id`, `prompt_variables` 追加） |
| `backend/src/services/OrchestratorService.ts` | 更新（`PromptService` DI、`buildPrompt()` 追加） |
| `backend/src/index.ts` | 更新（`PromptService` 初期化、`/api/prompts` ルート登録） |

### フロントエンド
| ファイル | 変更種別 |
|---------|---------|
| `frontend/src/types.ts` | 更新（`ViewId`, `PipelineNode.prompt_id`, `PromptTemplate` 追加） |
| `frontend/src/stores/wsStore.ts` | 新規 |
| `frontend/src/stores/navStore.ts` | 新規 |
| `frontend/src/stores/promptStore.ts` | 新規 |
| `frontend/src/hooks/useWebSocket.ts` | 更新（`wsStore` への接続状態書き込み） |
| `frontend/src/components/prompt-library/PromptLibrary.tsx` | 新規 |
| `frontend/src/components/common/StatusBar.tsx` | 新規 |
| `frontend/src/components/pipeline/AgentCard.tsx` | 更新（`prompt_id` バッジ追加） |
| `frontend/src/App.tsx` | 更新（`navStore` 移行、`BookOpen` アイコン、StatusBar 統合） |

---

## 確認済みの動作

- `npx tsc --noEmit` — バックエンド・フロントエンド双方でエラーなし
- `npm test` — 10テスト全て合格
- `curl POST /api/prompts` → テンプレート作成・YAML 保存
- `curl POST /api/prompts/:id/resolve` （正常） → 変数置換済みテキスト返却
- `curl POST /api/prompts/:id/resolve` （`lang` 欠け） → `{"code":"PROMPT_VARIABLE_MISSING"}`
- `curl DELETE /api/prompts/:id` → 204 No Content

---

## 未確認の動作（UI ランタイム）

- P-6: ブラウザでの amber ハイライト表示（コード実装済み、目視未確認）
- P-8: 📁 ボタンのファイルダイアログ動作（コード実装済み、目視未確認）
- S-3: フェードインアニメーション（コード実装済み、目視未確認）
- S-5: WS 切断時の赤インジケーター（コード実装済み、バックエンド停止テスト未実施）
