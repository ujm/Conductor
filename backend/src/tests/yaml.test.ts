/**
 * YAML ユーティリティのユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { readYaml, writeYaml, readYamlOrDefault } from "../utils/yaml";

describe("yaml utils", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "conductor-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it("writeYaml/readYaml でオブジェクトを往復できる", async () => {
    const data = { name: "test", version: 1, items: ["a", "b"] };
    const filePath = path.join(tmpDir, "test.yaml");
    await writeYaml(filePath, data);
    const result = await readYaml<typeof data>(filePath);
    expect(result).toEqual(data);
  });

  it("readYamlOrDefault は存在しないファイルにデフォルト値を返す", async () => {
    const filePath = path.join(tmpDir, "nonexistent.yaml");
    const result = await readYamlOrDefault(filePath, { fallback: true });
    expect(result).toEqual({ fallback: true });
  });

  it("writeYaml は中間ディレクトリを自動作成する", async () => {
    const filePath = path.join(tmpDir, "nested", "deep", "file.yaml");
    await writeYaml(filePath, { ok: true });
    const result = await readYaml<{ ok: boolean }>(filePath);
    expect(result.ok).toBe(true);
  });
});
