/**
 * LogService - JSONL 形式のログ書き込み・配信サービス
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { LogEntry } from "../types";

/** ログ配信コールバックの型 */
type LogStreamCallback = (entry: LogEntry) => void;

/** ログの書き込みと WebSocket への配信を担うサービス */
export class LogService {
  private readonly logDir: string;
  private readonly subscribers: Set<LogStreamCallback> = new Set();

  constructor(logDir: string) {
    this.logDir = logDir;
  }

  /** ログディレクトリを初期化する */
  async init(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });
  }

  /**
   * ログエントリを書き込み、購読者に配信する
   */
  async write(entry: LogEntry): Promise<void> {
    const date = new Date(entry.timestamp).toISOString().slice(0, 10);
    const logFile = path.join(this.logDir, `${date}.jsonl`);

    try {
      await fs.appendFile(logFile, JSON.stringify(entry) + "\n", "utf-8");
    } catch (err) {
      // ログ書き込み失敗は握り潰さず stderr に出力する
      console.error("ログ書き込みエラー:", err);
    }

    for (const cb of this.subscribers) {
      try {
        cb(entry);
      } catch {
        // 購読者側のエラーは無視する
      }
    }
  }

  /**
   * エージェント出力をログに記録するヘルパー
   */
  async logAgentOutput(agentId: string, message: string): Promise<void> {
    await this.write({
      timestamp: new Date().toISOString(),
      source: agentId,
      level: "info",
      message,
      agentId,
    });
  }

  /**
   * エラーをログに記録するヘルパー
   */
  async logError(source: string, message: string, agentId?: string): Promise<void> {
    await this.write({
      timestamp: new Date().toISOString(),
      source,
      level: "error",
      message,
      agentId,
    });
  }

  /**
   * 指定日のログエントリを全件取得する
   */
  async getEntries(date?: string): Promise<LogEntry[]> {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const logFile = path.join(this.logDir, `${targetDate}.jsonl`);

    try {
      const content = await fs.readFile(logFile, "utf-8");
      return content
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line) as LogEntry);
    } catch {
      return [];
    }
  }

  /** ログストリームを購読する */
  subscribe(cb: LogStreamCallback): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }
}
