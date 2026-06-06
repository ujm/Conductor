/**
 * RestAdapter - REST API 経由でエージェントを制御するアダプター
 */

import type { AgentConnector } from "./AgentConnector";
import type { AgentConfig, AgentStatus, AgentResult } from "../types";

/** RestAdapter の設定 */
export interface RestAdapterOptions {
  config: AgentConfig;
}

/** REST API 経由で制御するアダプター */
export class RestAdapter implements AgentConnector {
  private status: AgentStatus = "idle";
  private outputCb?: (chunk: string) => void;
  private completeCb?: (result: AgentResult) => void;
  private errorCb?: (err: Error) => void;
  private abortController?: AbortController;
  private readonly config: AgentConfig;

  constructor(options: RestAdapterOptions) {
    this.config = options.config;
  }

  /** タスクを実行開始する */
  async start(task: string, _contextFiles: string[]): Promise<void> {
    if (this.status === "running") {
      throw new Error(`エージェント ${this.config.id} は既に実行中です`);
    }

    const baseUrl = this.config.connection.baseUrl;
    if (!baseUrl) {
      throw new Error(`エージェント ${this.config.id} に baseUrl が設定されていません`);
    }

    this.abortController = new AbortController();
    this.status = "running";
    const startedAt = Date.now();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.connection.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.connection.apiKey}`;
    }

    try {
      const response = await fetch(`${baseUrl}/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({ task }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`REST API エラー: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { output?: string };
      const output = data.output ?? "";

      this.outputCb?.(output);
      this.status = "done";

      const result: AgentResult = {
        agentId: this.config.id,
        exitCode: 0,
        output,
        duration_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      };
      this.completeCb?.(result);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        this.status = "idle";
        return;
      }
      this.status = "error";
      this.errorCb?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /** 実行中のリクエストをキャンセルする */
  async stop(): Promise<void> {
    this.abortController?.abort();
    this.status = "idle";
  }

  /** 現在のステータスを取得する */
  getStatus(): AgentStatus {
    return this.status;
  }

  /** 出力チャンクのコールバックを登録する */
  onOutput(cb: (chunk: string) => void): void {
    this.outputCb = cb;
  }

  /** 正常完了時のコールバックを登録する */
  onComplete(cb: (result: AgentResult) => void): void {
    this.completeCb = cb;
  }

  /** エラー時のコールバックを登録する */
  onError(cb: (err: Error) => void): void {
    this.errorCb = cb;
  }
}
