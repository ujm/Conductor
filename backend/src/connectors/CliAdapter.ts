/**
 * CliAdapter - CLI プロセスを起動して制御するエージェントアダプター
 * Claude Code / OpenClaw 等の CLI エージェントに使用する
 */

import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { AgentConnector } from "./AgentConnector";
import type { AgentConfig, AgentStatus, AgentResult } from "../types";

/** CliAdapter の設定 */
export interface CliAdapterOptions {
  config: AgentConfig;
  projectRoot: string;
}

/** CLI プロセスを起動・制御するアダプター */
export class CliAdapter implements AgentConnector {
  private proc: ChildProcess | null = null;
  private status: AgentStatus = "idle";
  private outputCb?: (chunk: string) => void;
  private completeCb?: (result: AgentResult) => void;
  private errorCb?: (err: Error) => void;
  private output: string[] = [];
  private startedAt?: number;
  private readonly config: AgentConfig;
  private readonly projectRoot: string;

  constructor(options: CliAdapterOptions) {
    this.config = options.config;
    this.projectRoot = options.projectRoot;
  }

  /**
   * コンテキストファイルを読み込んでプロンプト文字列を構築する
   */
  private async buildPrompt(task: string, contextFiles: string[]): Promise<string> {
    const contextParts: string[] = [];

    for (const relPath of contextFiles) {
      const absPath = path.join(this.projectRoot, relPath);
      try {
        const content = await fs.readFile(absPath, "utf-8");
        contextParts.push(`## ${relPath}\n\n${content}`);
      } catch {
        // ファイルが存在しない場合は警告のみ（実行は続行）
        contextParts.push(`## ${relPath}\n\n(ファイルが見つかりません)`);
      }
    }

    const contextSection = contextParts.length > 0
      ? `# コンテキスト\n\n${contextParts.join("\n\n---\n\n")}\n\n---\n\n`
      : "";

    return `${contextSection}# タスク指示\n\n${task}`;
  }

  /** タスクを実行開始する */
  async start(task: string, contextFiles: string[]): Promise<void> {
    if (this.status === "running") {
      throw new Error(`エージェント ${this.config.id} は既に実行中です`);
    }

    const prompt = await this.buildPrompt(task, contextFiles);
    const cwd = this.config.connection.cwd
      ? this.config.connection.cwd.replace("{project_root}", this.projectRoot)
      : this.projectRoot;

    const command = this.config.connection.command ?? "claude";
    const baseArgs = this.config.connection.args ?? [];
    const args = [...baseArgs, prompt];

    const envVars: Record<string, string> = { ...process.env } as Record<string, string>;
    if (this.config.connection.env) {
      for (const [key, val] of Object.entries(this.config.connection.env)) {
        const resolved = val.replace(/\{env\.(\w+)\}/g, (_, name: string) => process.env[name] ?? "");
        envVars[key] = resolved;
      }
    }

    this.output = [];
    this.startedAt = Date.now();
    this.status = "running";

    this.proc = spawn(command, args, { cwd, env: envVars, shell: false });

    this.proc.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this.output.push(text);
      this.outputCb?.(text);
    });

    this.proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this.output.push(text);
      this.outputCb?.(text);
    });

    this.proc.on("error", (err: Error) => {
      this.status = "error";
      this.errorCb?.(err);
    });

    this.proc.on("close", (code: number | null) => {
      const duration_ms = Date.now() - (this.startedAt ?? Date.now());
      const exitCode = code ?? 1;

      if (exitCode === 0) {
        this.status = "done";
        const result: AgentResult = {
          agentId: this.config.id,
          exitCode,
          output: this.output.join(""),
          duration_ms,
          completed_at: new Date().toISOString(),
        };
        this.completeCb?.(result);
      } else {
        this.status = "error";
        this.errorCb?.(new Error(`プロセスが exit code ${exitCode} で終了しました`));
      }
    });
  }

  /** 実行中のプロセスを停止する */
  async stop(): Promise<void> {
    if (this.proc && this.status === "running") {
      this.proc.kill("SIGTERM");
      this.status = "idle";
    }
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
