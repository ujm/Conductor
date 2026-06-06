/**
 * ログ取得 REST API ルート
 */

import { Router, type Request, type Response } from "express";
import type { LogService } from "../services/LogService";
import type { ApiError } from "../types";

/** ログ取得ルーターを生成する */
export function createLogsRouter(logService: LogService): Router {
  const router = Router();

  /** GET /api/logs - ログ取得（クエリパラメータ: date=YYYY-MM-DD, agentId=xxx） */
  router.get("/", async (req: Request, res: Response) => {
    const date = typeof req.query["date"] === "string" ? req.query["date"] : undefined;
    const agentId = typeof req.query["agentId"] === "string" ? req.query["agentId"] : undefined;
    try {
      let entries = await logService.getEntries(date);
      if (agentId) {
        entries = entries.filter((e) => e.agentId === agentId);
      }
      res.json(entries);
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  return router;
}
