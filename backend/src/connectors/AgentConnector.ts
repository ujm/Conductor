/**
 * AgentConnector 抽象インターフェース
 * すべてのエージェントアダプターが実装すべきインターフェース
 */

import type { AgentStatus, AgentResult } from "../types";

/** エージェントコネクターの共通インターフェース */
export interface AgentConnector {
  /** タスクを実行開始する */
  start(task: string, contextFiles: string[]): Promise<void>;
  /** 実行を停止する */
  stop(): Promise<void>;
  /** 現在のステータスを取得する */
  getStatus(): AgentStatus;
  /** 出力チャンクを受け取るコールバックを登録する */
  onOutput(cb: (chunk: string) => void): void;
  /** 正常完了時のコールバックを登録する */
  onComplete(cb: (result: AgentResult) => void): void;
  /** エラー発生時のコールバックを登録する */
  onError(cb: (err: Error) => void): void;
}
