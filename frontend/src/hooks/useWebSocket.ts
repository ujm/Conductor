/**
 * WebSocket 接続管理フック
 * 受信イベントを各 Zustand ストアに反映する
 */

import { useEffect, useRef, useCallback } from "react";
import { useAgentStore } from "../stores/agentStore";
import { usePipelineStore } from "../stores/pipelineStore";
import { useLogStore } from "../stores/logStore";
import { useApprovalStore } from "../stores/approvalStore";
import { useWsStore } from "../stores/wsStore";
import type {
  AgentRuntimeState,
  PipelineConfig,
  LogEntry,
  ApprovalRequest,
  OrchestratorPlan,
} from "../types";

const WS_URL = "ws://localhost:3001/ws";
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

interface ServerEvent {
  event: string;
  data: unknown;
}

/** WebSocket 接続を管理し、受信イベントをストアへ反映するフック */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  const { updateRuntimeState, appendOutput } = useAgentStore();
  const { setPipeline, setGoalState, setPlan, setGoal } = usePipelineStore();
  const { addEntry } = useLogStore();
  const { setQueue } = useApprovalStore();
  const { setConnected, incrementReconnect, resetReconnect } = useWsStore();

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      switch (event.event) {
        case "agent:status":
          updateRuntimeState(event.data as AgentRuntimeState);
          break;

        case "agent:output": {
          const { nodeId, chunk } = event.data as { nodeId: string; chunk: string; timestamp: string };
          appendOutput(nodeId, chunk);
          break;
        }

        case "pipeline:update": {
          const { pipeline } = event.data as { pipeline: PipelineConfig };
          setPipeline(pipeline);
          break;
        }

        case "log:entry":
          addEntry(event.data as LogEntry);
          break;

        case "approval:queue":
          setQueue(event.data as ApprovalRequest[]);
          break;

        case "pipeline:planning": {
          const { goal } = event.data as { goal: string };
          setGoal(goal);
          setGoalState("planning");
          break;
        }

        case "pipeline:plan_ready": {
          const { plan } = event.data as { plan: OrchestratorPlan };
          setPlan(plan);
          setGoalState("awaiting_approval");
          break;
        }

        case "pipeline:orchestration_error":
          setGoalState("idle");
          break;

        default:
          break;
      }
    },
    [updateRuntimeState, appendOutput, setPipeline, addEntry, setQueue, setGoalState, setPlan, setGoal],
  );

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCountRef.current = 0;
      setConnected(true);
      resetReconnect();
      addEntry({
        timestamp: new Date().toISOString(),
        source: "client",
        level: "info",
        message: "WebSocket 接続しました",
      });
    };

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as ServerEvent;
        handleEvent(event);
      } catch {
        // パース失敗は無視する
      }
    };

    ws.onerror = () => {
      // onerror は onclose の前に呼ばれるため、再接続は onclose に任せる
    };

    ws.onclose = () => {
      setConnected(false);
      if (isUnmountedRef.current) return;
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        incrementReconnect();
        addEntry({
          timestamp: new Date().toISOString(),
          source: "client",
          level: "warn",
          message: `WebSocket 切断。${RETRY_DELAY_MS / 1000}秒後に再接続 (${retryCountRef.current}/${MAX_RETRIES})`,
        });
        retryTimerRef.current = setTimeout(connect, RETRY_DELAY_MS);
      } else {
        addEntry({
          timestamp: new Date().toISOString(),
          source: "client",
          level: "error",
          message: "WebSocket 再接続に失敗しました。ページを再読み込みしてください。",
        });
      }
    };
  }, [handleEvent, addEntry, setConnected, incrementReconnect, resetReconnect]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  /** サーバーにメッセージを送信する */
  const send = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { send };
}
