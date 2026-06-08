/**
 * OpenClaw CLI を呼び出して AI 計画を生成するアダプター
 * `openclaw agent --agent conductor-orchestrator --message "..." --local` を実行する
 */

import { spawn } from "node:child_process";
import type { OrchestratorPlan } from "../types/orchestrate";

interface RunOptions {
  agent: string;
  message: string;
  local?: boolean;
  timeout?: number;
}

export class OpenClawAdapter {
  async planGoal(goal: string): Promise<OrchestratorPlan> {
    const message = [
      `以下のゴールを達成するための実行計画を JSON 形式で立案してください。`,
      ``,
      `ゴール: ${goal}`,
      ``,
      `【出力形式】`,
      `以下の JSON のみを出力してください（前後の説明文は不要）:`,
      `{`,
      `  "plan": [`,
      `    { "id": "step-1", "agent": "claude-code", "task": "...", "depends_on": [] },`,
      `    { "id": "step-2", "agent": "claude-code", "task": "...", "depends_on": ["step-1"] }`,
      `  ],`,
      `  "summary": "計画の概要（1〜2文）"`,
      `}`,
      ``,
      `利用可能なエージェント: claude-code`,
      `depends_on には依存するステップの id を文字列配列で指定してください。`,
    ].join("\n");

    const output = await this.runOpenClaw({
      agent: "conductor-orchestrator",
      message,
      local: true,
      timeout: 120,
    });

    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        `計画 JSON の抽出に失敗しました。出力:\n${output.slice(0, 500)}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`計画 JSON のパースに失敗しました: ${String(e)}`);
    }

    return parsed as OrchestratorPlan;
  }

  private runOpenClaw(opts: RunOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        "agent",
        "--agent",
        opts.agent,
        "--message",
        opts.message,
        "--timeout",
        String(opts.timeout ?? 120),
        ...(opts.local ? ["--local"] : []),
      ];

      const proc = spawn("openclaw", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let killTimer: ReturnType<typeof setTimeout> | null = null;

      // CLI 側タイムアウトより少し長めに設定してプロセスを強制終了する
      if (opts.timeout) {
        killTimer = setTimeout(
          () => {
            proc.kill("SIGTERM");
            reject(
              new Error(
                `openclaw がタイムアウトしました (${opts.timeout}秒)`,
              ),
            );
          },
          (opts.timeout + 15) * 1000,
        );
      }

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("close", (code) => {
        if (killTimer) clearTimeout(killTimer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(
            new Error(
              `openclaw が終了コード ${code ?? "null"} で失敗しました。stderr: ${stderr.slice(0, 300)}`,
            ),
          );
        }
      });

      proc.on("error", (err) => {
        if (killTimer) clearTimeout(killTimer);
        reject(new Error(`openclaw の起動に失敗しました: ${err.message}`));
      });
    });
  }
}
