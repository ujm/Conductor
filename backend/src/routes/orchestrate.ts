/**
 * AI オーケストレーション REST API ルート
 * ゴール入力 → 計画立案 → 承認 → 実行 のフローを管理する
 */

import { Router, type Request, type Response } from "express";
import type { OrchestratorService } from "../services/OrchestratorService";
import type { ApiError } from "../types";

/** AI オーケストレーションルーターを生成する */
export function createOrchestrateRouter(
  orchestrator: OrchestratorService,
): Router {
  const router = Router();

  /** POST /api/orchestrate - ゴールから実行計画を立案する（非同期、WS で通知） */
  router.post("/", (req: Request, res: Response) => {
    const { goal } = req.body as { goal?: string };
    if (!goal || typeof goal !== "string" || goal.trim() === "") {
      const err: ApiError = {
        error: "goal は必須です",
        code: "VALIDATION_ERROR",
      };
      res.status(400).json(err);
      return;
    }

    void orchestrator.planGoal(goal.trim()).catch((err: unknown) => {
      console.error("planGoal エラー:", err);
    });

    res.json({ started: true });
  });

  /** POST /api/orchestrate/approve - 現在の計画を承認して実行する（非同期） */
  router.post("/approve", (_req: Request, res: Response) => {
    void orchestrator.executeApprovedPlan().catch((err: unknown) => {
      console.error("executeApprovedPlan エラー:", err);
    });
    res.json({ started: true });
  });

  /** POST /api/orchestrate/replan - フィードバック付きで再計画する（非同期、WS で通知） */
  router.post("/replan", (req: Request, res: Response) => {
    const { feedback } = req.body as { feedback?: string };
    if (!feedback || typeof feedback !== "string" || feedback.trim() === "") {
      const err: ApiError = {
        error: "feedback は必須です",
        code: "VALIDATION_ERROR",
      };
      res.status(400).json(err);
      return;
    }

    void orchestrator.replanGoal(feedback.trim()).catch((err: unknown) => {
      console.error("replanGoal エラー:", err);
    });

    res.json({ started: true });
  });

  /** GET /api/orchestrate/plan - 現在のドラフト計画を取得する */
  router.get("/plan", async (_req: Request, res: Response) => {
    try {
      const draft = await orchestrator.getDraftPlan();
      res.json(draft ?? null);
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  return router;
}
