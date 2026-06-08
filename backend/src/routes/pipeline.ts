/**
 * パイプライン管理 REST API ルート
 */

import { Router, type Request, type Response } from "express";
import type { OrchestratorService } from "../services/OrchestratorService";
import type { PipelineConfig, ApiError } from "../types";

/** パイプライン管理ルーターを生成する */
export function createPipelineRouter(orchestrator: OrchestratorService): Router {
  const router = Router();

  /** GET /api/pipeline - パイプライン取得 */
  router.get("/", (_req: Request, res: Response) => {
    const pipeline = orchestrator.getPipeline();
    if (!pipeline) {
      const err: ApiError = { error: "パイプラインが初期化されていません", code: "NOT_INITIALIZED" };
      res.status(404).json(err);
      return;
    }
    res.json(pipeline);
  });

  /** PUT /api/pipeline - パイプライン更新 */
  router.put("/", async (req: Request, res: Response) => {
    const pipeline = req.body as PipelineConfig;
    if (!pipeline.version || !pipeline.name || !Array.isArray(pipeline.agents)) {
      const err: ApiError = { error: "version, name, agents は必須です", code: "VALIDATION_ERROR" };
      res.status(400).json(err);
      return;
    }
    try {
      await orchestrator.updatePipeline(pipeline);
      res.json(pipeline);
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  /** POST /api/pipeline/run - パイプライン全体を実行 */
  router.post("/run", (_req: Request, res: Response) => {
    void orchestrator.runPipeline().catch((err: unknown) => {
      console.error("パイプライン実行エラー:", err);
    });
    res.json({ message: "パイプラインを開始しました" });
  });

  /** POST /api/pipeline/stop - 全停止 */
  router.post("/stop", async (_req: Request, res: Response) => {
    try {
      await orchestrator.stopAll();
      res.json({ message: "全エージェントを停止しました" });
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  /** GET /api/pipeline/states - 全ノードのランタイム状態取得 */
  router.get("/states", (_req: Request, res: Response) => {
    res.json(orchestrator.getRuntimeStates());
  });

  /** POST /api/pipeline/agents - パイプラインにノードを追加 */
  router.post("/agents", async (req: Request, res: Response) => {
    const { agentId, task } = req.body as { agentId?: string; task?: string };
    if (!agentId) {
      const err: ApiError = { error: "agentId は必須です", code: "VALIDATION_ERROR" };
      res.status(400).json(err);
      return;
    }
    try {
      await orchestrator.addPipelineNode(agentId, task ?? "");
      const pipeline = orchestrator.getPipeline();
      res.status(201).json(pipeline);
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  /** DELETE /api/pipeline/agents/:nodeId - パイプラインからノードを削除 */
  router.delete("/agents/:nodeId", async (req: Request, res: Response) => {
    const nodeId = req.params["nodeId"] as string;
    try {
      await orchestrator.removePipelineNode(nodeId);
      const pipeline = orchestrator.getPipeline();
      res.json(pipeline);
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  return router;
}
