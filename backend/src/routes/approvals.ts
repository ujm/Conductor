/**
 * 承認ゲート REST API ルート
 */

import { Router, type Request, type Response } from "express";
import type { ApprovalGateway } from "../services/ApprovalGateway";
import type { ApiError } from "../types";

/** 承認ゲートルーターを生成する */
export function createApprovalsRouter(approvalGateway: ApprovalGateway): Router {
  const router = Router();

  /** GET /api/approvals - 承認待ち一覧取得 */
  router.get("/", (_req: Request, res: Response) => {
    res.json(approvalGateway.getQueue());
  });

  /** POST /api/approvals/:id/approve - 承認 */
  router.post("/:id/approve", (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const ok = approvalGateway.approve(id);
    if (!ok) {
      const err: ApiError = { error: `承認リクエスト ${id} が見つかりません`, code: "NOT_FOUND" };
      res.status(404).json(err);
      return;
    }
    res.json({ message: "承認しました", id });
  });

  /** POST /api/approvals/:id/reject - 却下 */
  router.post("/:id/reject", (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const ok = approvalGateway.reject(id);
    if (!ok) {
      const err: ApiError = { error: `承認リクエスト ${id} が見つかりません`, code: "NOT_FOUND" };
      res.status(404).json(err);
      return;
    }
    res.json({ message: "却下しました", id });
  });

  return router;
}
