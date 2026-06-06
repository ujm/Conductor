/**
 * WebSocket イベントハンドラー
 * 5.6 のイベント仕様に準拠する
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { OrchestratorService } from "../services/OrchestratorService";
import type { LogService } from "../services/LogService";
import type { ApprovalGateway } from "../services/ApprovalGateway";
import type { FileWatcher } from "../services/FileWatcher";
import type { PipelineConfig, LogEntry } from "../types";

/** Client→Server のメッセージ型 */
interface ClientMessage {
  type: "pipeline:set" | "agent:run" | "agent:stop";
  payload: unknown;
}

/** サーバー→Client へ送信するイベントの型 */
interface ServerEvent {
  event: string;
  data: unknown;
}

/** 接続中のクライアント全員にブロードキャストする */
function broadcast(wss: WebSocketServer, event: ServerEvent): void {
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/** WebSocket サーバーを初期化してイベントを配線する */
export function setupWebSocket(
  wss: WebSocketServer,
  orchestrator: OrchestratorService,
  logService: LogService,
  approvalGateway: ApprovalGateway,
  fileWatcher: FileWatcher,
): void {
  // エージェント状態変化を購読してブロードキャスト
  orchestrator.onStatusChange((nodeId, state) => {
    broadcast(wss, { event: "agent:status", data: { ...state, nodeId } });
  });

  // エージェント出力を購読してブロードキャスト
  orchestrator.onOutput((nodeId, chunk) => {
    broadcast(wss, {
      event: "agent:output",
      data: { nodeId, chunk, timestamp: new Date().toISOString() },
    });
  });

  // パイプライン更新を購読してブロードキャスト
  orchestrator.onPipelineUpdate((pipeline) => {
    broadcast(wss, { event: "pipeline:update", data: { pipeline } });
  });

  // ログエントリを購読してブロードキャスト
  logService.subscribe((entry: LogEntry) => {
    broadcast(wss, { event: "log:entry", data: entry });
  });

  // 承認キュー変化を購読してブロードキャスト
  approvalGateway.onQueueChange(() => {
    const queue = approvalGateway.getQueue();
    if (queue.length > 0) {
      broadcast(wss, { event: "approval:needed", data: queue[queue.length - 1] });
    }
    broadcast(wss, { event: "approval:queue", data: queue });
  });

  // ファイル変更を購読してブロードキャスト
  fileWatcher.subscribe((fileEvent) => {
    broadcast(wss, { event: "file:changed", data: fileEvent });
  });

  // クライアント接続ハンドラー
  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    // 接続直後に現在のパイプライン状態を送信する
    const pipeline = orchestrator.getPipeline();
    if (pipeline) {
      ws.send(JSON.stringify({ event: "pipeline:update", data: { pipeline } }));
    }

    const states = orchestrator.getRuntimeStates();
    for (const state of states) {
      ws.send(JSON.stringify({ event: "agent:status", data: state }));
    }

    const approvalQueue = approvalGateway.getQueue();
    ws.send(JSON.stringify({ event: "approval:queue", data: approvalQueue }));

    ws.on("message", (rawData: Buffer | string) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(rawData.toString()) as ClientMessage;
      } catch {
        ws.send(JSON.stringify({ event: "error", data: { error: "無効なJSON形式です" } }));
        return;
      }

      handleClientMessage(msg, orchestrator, ws);
    });

    ws.on("error", (err: Error) => {
      console.error("WebSocket クライアントエラー:", err.message);
    });
  });
}

/** クライアントからのメッセージを処理する */
function handleClientMessage(
  msg: ClientMessage,
  orchestrator: OrchestratorService,
  ws: WebSocket,
): void {
  switch (msg.type) {
    case "pipeline:set": {
      const pipeline = msg.payload as PipelineConfig;
      orchestrator.updatePipeline(pipeline).catch((err: unknown) => {
        ws.send(JSON.stringify({ event: "error", data: { error: String(err) } }));
      });
      break;
    }

    case "agent:run": {
      const { nodeId } = msg.payload as { nodeId: string };
      const node = orchestrator.getPipelineNode(nodeId);
      if (node) {
        orchestrator.runNode(node).catch((err: unknown) => {
          ws.send(JSON.stringify({ event: "error", data: { error: String(err) } }));
        });
      }
      break;
    }

    case "agent:stop": {
      const { nodeId } = msg.payload as { nodeId: string };
      orchestrator.stopNode(nodeId).catch((err: unknown) => {
        ws.send(JSON.stringify({ event: "error", data: { error: String(err) } }));
      });
      break;
    }

    default:
      ws.send(JSON.stringify({ event: "error", data: { error: `不明なメッセージタイプ: ${msg.type}` } }));
  }
}
