/**
 * ファイル管理 REST API ルート
 */

import { Router, type Request, type Response } from "express";
import type { FileWatcher } from "../services/FileWatcher";
import type { ApiError } from "../types";

/** ファイル管理ルーターを生成する */
export function createFilesRouter(fileWatcher: FileWatcher): Router {
  const router = Router();

  /** GET /api/files - ファイルツリー取得 */
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const tree = await fileWatcher.getFileTree();
      res.json(tree);
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  /** GET /api/files/* - ファイル内容取得 */
  router.get("/*filePath", async (req: Request, res: Response) => {
    const raw = req.params["filePath"];
    const filePath = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
    try {
      const content = await fileWatcher.readFile(filePath);
      res.json({ path: filePath, content });
    } catch {
      const err: ApiError = { error: `ファイルが見つかりません: ${filePath}`, code: "NOT_FOUND" };
      res.status(404).json(err);
    }
  });

  /** PUT /api/files/* - ファイル更新 */
  router.put("/*filePath", async (req: Request, res: Response) => {
    const raw = req.params["filePath"];
    const filePath = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
    const { content } = req.body as { content?: string };
    if (typeof content !== "string") {
      const err: ApiError = { error: "content は必須です（文字列）", code: "VALIDATION_ERROR" };
      res.status(400).json(err);
      return;
    }
    try {
      await fileWatcher.writeFile(filePath, content);
      res.json({ path: filePath, message: "保存しました" });
    } catch (err) {
      const apiErr: ApiError = { error: String(err), code: "INTERNAL_ERROR" };
      res.status(500).json(apiErr);
    }
  });

  return router;
}
