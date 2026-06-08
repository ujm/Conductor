/**
 * Conductor バックエンド エントリーポイント
 * Express + WebSocket サーバーをポート 3001 で起動する
 */

import "dotenv/config";
import * as http from "node:http";
import * as path from "node:path";
import express from "express";
import { WebSocketServer } from "ws";

import { LogService } from "./services/LogService";
import { ApprovalGateway } from "./services/ApprovalGateway";
import { FileWatcher } from "./services/FileWatcher";
import { OrchestratorService } from "./services/OrchestratorService";
import { PromptService } from "./services/PromptService";

import { createAgentsRouter } from "./routes/agents";
import { createPipelineRouter } from "./routes/pipeline";
import { createTasksRouter } from "./routes/tasks";
import { createLogsRouter } from "./routes/logs";
import { createFilesRouter } from "./routes/files";
import { createApprovalsRouter } from "./routes/approvals";
import { createPromptsRouter } from "./routes/prompts";
import { createOrchestrateRouter } from "./routes/orchestrate";
import { setupWebSocket } from "./ws/handler";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const PROJECT_ROOT = process.env["PROJECT_ROOT"] ?? process.cwd();
const CONDUCTOR_DIR = path.join(PROJECT_ROOT, ".conductor");

async function main(): Promise<void> {
  // サービスを初期化する
  const logService = new LogService(path.join(CONDUCTOR_DIR, "logs"));
  await logService.init();

  const approvalGateway = new ApprovalGateway();

  const fileWatcher = new FileWatcher(PROJECT_ROOT);
  fileWatcher.start();

  const promptService = new PromptService(CONDUCTOR_DIR);
  await promptService.init();

  const orchestrator = new OrchestratorService(PROJECT_ROOT, logService, approvalGateway, promptService);
  await orchestrator.init();

  // Express アプリを構築する
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // CORS を許可する（開発環境用）
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (_req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // REST API ルートを登録する
  app.use("/api/agents", createAgentsRouter(orchestrator));
  app.use("/api/pipeline", createPipelineRouter(orchestrator));
  app.use("/api/tasks", createTasksRouter(CONDUCTOR_DIR));
  app.use("/api/logs", createLogsRouter(logService));
  app.use("/api/files", createFilesRouter(fileWatcher));
  app.use("/api/approvals", createApprovalsRouter(approvalGateway));
  app.use("/api/prompts", createPromptsRouter(promptService));
  app.use("/api/orchestrate", createOrchestrateRouter(orchestrator));

  // ヘルスチェック
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // HTTP サーバーを作成し WebSocket を付加する
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  setupWebSocket(wss, orchestrator, logService, approvalGateway, fileWatcher);

  // 未処理の Promise rejection を記録する
  process.on("unhandledRejection", (reason) => {
    void logService.logError("process", `未処理の Promise rejection: ${String(reason)}`);
    console.error("未処理の Promise rejection:", reason);
  });

  server.listen(PORT, () => {
    console.log(`Conductor バックエンド起動: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`プロジェクトルート: ${PROJECT_ROOT}`);
  });
}

main().catch((err: unknown) => {
  console.error("起動エラー:", err);
  process.exit(1);
});
