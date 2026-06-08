/**
 * PromptService - プロンプトテンプレートの CRUD と変数解決を担うサービス
 */

import * as path from "node:path";
import * as fs from "node:fs/promises";
import { readYaml, writeYaml } from "../utils/yaml";
import { slugify } from "../utils/slug";
import type { PromptTemplate, PromptVariable } from "../types/prompt";

export const PROMPT_VARIABLE_MISSING = "PROMPT_VARIABLE_MISSING";

export class PromptService {
  private readonly promptsDir: string;

  constructor(conductorDir: string) {
    this.promptsDir = path.join(conductorDir, "prompts");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.promptsDir, { recursive: true });
  }

  private promptPath(id: string): string {
    return path.join(this.promptsDir, `${id}.yaml`);
  }

  async list(): Promise<PromptTemplate[]> {
    let files: string[];
    try {
      files = await fs.readdir(this.promptsDir);
    } catch {
      return [];
    }
    const results: PromptTemplate[] = [];
    for (const file of files.filter((f) => f.endsWith(".yaml"))) {
      try {
        const t = await readYaml<PromptTemplate>(path.join(this.promptsDir, file));
        results.push(t);
      } catch {
        // 壊れたファイルは無視する
      }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(id: string): Promise<PromptTemplate | null> {
    try {
      return await readYaml<PromptTemplate>(this.promptPath(id));
    } catch {
      return null;
    }
  }

  async save(
    template: Omit<PromptTemplate, "id" | "created_at" | "updated_at"> & { id?: string },
  ): Promise<PromptTemplate> {
    const now = new Date().toISOString();
    const id = template.id ?? slugify(template.name);

    let created_at = now;
    if (template.id) {
      const existing = await this.get(id);
      if (existing) {
        created_at = existing.created_at;
      }
    }

    const full: PromptTemplate = {
      id,
      name: template.name,
      template: template.template,
      category: template.category ?? "general",
      tags: template.tags ?? [],
      variables: template.variables ?? {},
      created_at,
      updated_at: now,
    };

    await writeYaml(this.promptPath(id), full);
    return full;
  }

  async delete(id: string): Promise<void> {
    await fs.rm(this.promptPath(id), { force: true });
  }

  /** テンプレート文字列から {{変数名}} を抽出して PromptVariable マップを返す */
  extractVariables(template: string): Record<string, PromptVariable> {
    const vars: Record<string, PromptVariable> = {};
    const matches = template.matchAll(/\{\{(\w+)\}\}/g);
    for (const [, name] of matches) {
      if (name && !vars[name]) {
        vars[name] = { type: "string", label: name, required: true };
      }
    }
    return vars;
  }

  /** テンプレートを変数で解決する。required 変数が欠けている場合は PROMPT_VARIABLE_MISSING エラーを投げる */
  async resolve(id: string, variables: Record<string, string>): Promise<{ promptId: string; resolved: string; variables: Record<string, string> }> {
    const template = await this.get(id);
    if (!template) {
      throw new Error(`プロンプトが見つかりません: ${id}`);
    }

    for (const [varName, varDef] of Object.entries(template.variables)) {
      if (varDef.required && !variables[varName] && !varDef.default) {
        const error = new Error(`必須変数が指定されていません: ${varName}`);
        (error as NodeJS.ErrnoException).code = PROMPT_VARIABLE_MISSING;
        throw error;
      }
    }

    let resolved = template.template;
    for (const [varName, varDef] of Object.entries(template.variables)) {
      const value = variables[varName] ?? varDef.default ?? "";
      resolved = resolved.replaceAll(`{{${varName}}}`, value);
    }

    return { promptId: id, resolved, variables };
  }
}
