/** Prompt Library REST API ルート */

import { Router } from "express";
import type { PromptService } from "../services/PromptService";
import { PROMPT_VARIABLE_MISSING } from "../services/PromptService";
import type { PromptVariable } from "../types/prompt";

export function createPromptsRouter(promptService: PromptService): Router {
  const router = Router();

  // GET /api/prompts - 一覧取得
  router.get("/", async (_req, res) => {
    const templates = await promptService.list();
    res.json(templates);
  });

  // POST /api/prompts/extract - テンプレートから変数抽出（ルートより前に登録）
  router.post("/extract", (req, res) => {
    const { template } = req.body as { template?: string };
    if (!template) {
      res.status(400).json({ error: "template は必須です", code: "MISSING_FIELDS" });
      return;
    }
    const variables = promptService.extractVariables(template);
    res.json({ variables });
  });

  // GET /api/prompts/:id - 単一取得
  router.get("/:id", async (req, res) => {
    const id = req.params["id"] as string;
    const template = await promptService.get(id);
    if (!template) {
      res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
      return;
    }
    res.json(template);
  });

  // POST /api/prompts - 新規作成
  router.post("/", async (req, res) => {
    const body = req.body as {
      name?: string;
      template?: string;
      category?: string;
      tags?: string[];
      variables?: Record<string, PromptVariable>;
    };
    if (!body.name || !body.template) {
      res.status(400).json({ error: "name と template は必須です", code: "MISSING_FIELDS" });
      return;
    }
    const saved = await promptService.save({
      name: body.name,
      template: body.template,
      category: body.category ?? "general",
      tags: body.tags ?? [],
      variables: body.variables ?? promptService.extractVariables(body.template),
    });
    res.status(201).json(saved);
  });

  // PUT /api/prompts/:id - 更新
  router.put("/:id", async (req, res) => {
    const id = req.params["id"] as string;
    const body = req.body as {
      name?: string;
      template?: string;
      category?: string;
      tags?: string[];
      variables?: Record<string, PromptVariable>;
    };
    if (!body.name || !body.template) {
      res.status(400).json({ error: "name と template は必須です", code: "MISSING_FIELDS" });
      return;
    }
    const saved = await promptService.save({
      id,
      name: body.name,
      template: body.template,
      category: body.category ?? "general",
      tags: body.tags ?? [],
      variables: body.variables ?? promptService.extractVariables(body.template),
    });
    res.json(saved);
  });

  // DELETE /api/prompts/:id
  router.delete("/:id", async (req, res) => {
    const id = req.params["id"] as string;
    await promptService.delete(id);
    res.status(204).send();
  });

  // POST /api/prompts/:id/resolve - 変数解決
  router.post("/:id/resolve", async (req, res) => {
    const id = req.params["id"] as string;
    const variables = (req.body as { variables?: Record<string, string> }).variables ?? {};

    try {
      const result = await promptService.resolve(id, variables);
      res.json(result);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === PROMPT_VARIABLE_MISSING) {
        res.status(400).json({ error: e.message, code: PROMPT_VARIABLE_MISSING });
        return;
      }
      res.status(500).json({ error: String(err), code: "INTERNAL_ERROR" });
    }
  });

  return router;
}
