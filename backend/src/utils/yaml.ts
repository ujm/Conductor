/**
 * YAML 読み書きユーティリティ
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import yaml from "js-yaml";

/**
 * YAML ファイルを読み込み、型付きオブジェクトとして返す
 */
export async function readYaml<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = yaml.load(content);
  if (parsed === null || parsed === undefined) {
    throw new Error(`YAML ファイルが空または無効です: ${filePath}`);
  }
  return parsed as T;
}

/**
 * オブジェクトを YAML ファイルとして書き込む
 */
export async function writeYaml(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const content = yaml.dump(data, { indent: 2, lineWidth: 120 });
  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * YAML ファイルが存在する場合は読み込み、なければデフォルト値を返す
 */
export async function readYamlOrDefault<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    return await readYaml<T>(filePath);
  } catch {
    return defaultValue;
  }
}
