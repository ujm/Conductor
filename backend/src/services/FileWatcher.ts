/**
 * FileWatcher - chokidar を使ったファイル変更監視サービス
 */

import chokidar, { type FSWatcher } from "chokidar";
import * as path from "node:path";
import * as fs from "node:fs/promises";

/** ファイル変更イベントの種別 */
export type FileChangeType = "created" | "modified" | "deleted";

/** ファイル変更イベント */
export interface FileChangeEvent {
  path: string;
  type: FileChangeType;
}

/** ファイル変更コールバックの型 */
type FileChangeCallback = (event: FileChangeEvent) => void;

/** ファイルツリーのノード */
export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

/** ファイル変更の監視とファイルツリー管理を行うサービス */
export class FileWatcher {
  private watcher?: FSWatcher;
  private readonly subscribers: Set<FileChangeCallback> = new Set();
  private readonly watchDir: string;

  constructor(watchDir: string) {
    this.watchDir = watchDir;
  }

  /** 監視を開始する */
  start(): void {
    this.watcher = chokidar.watch(this.watchDir, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on("add", (filePath: string) => this.emit({ path: filePath, type: "created" }))
      .on("change", (filePath: string) => this.emit({ path: filePath, type: "modified" }))
      .on("unlink", (filePath: string) => this.emit({ path: filePath, type: "deleted" }));
  }

  /** 監視を停止する */
  async stop(): Promise<void> {
    await this.watcher?.close();
  }

  /** ファイル変更を購読する */
  subscribe(cb: FileChangeCallback): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  /**
   * 指定ディレクトリのファイルツリーを再帰的に取得する
   */
  async getFileTree(dirPath?: string): Promise<FileNode[]> {
    const targetPath = dirPath ?? this.watchDir;
    const nodes: FileNode[] = [];

    let entries;
    try {
      entries = await fs.readdir(targetPath, { withFileTypes: true });
    } catch {
      return nodes;
    }

    for (const entry of entries) {
      const fullPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        const children = await this.getFileTree(fullPath);
        nodes.push({ name: entry.name, path: fullPath, type: "directory", children });
      } else {
        nodes.push({ name: entry.name, path: fullPath, type: "file" });
      }
    }

    return nodes;
  }

  /**
   * ファイルの内容を読み込む
   */
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, "utf-8");
  }

  /**
   * ファイルに内容を書き込む
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, "utf-8");
  }

  private emit(event: FileChangeEvent): void {
    for (const cb of this.subscribers) {
      try {
        cb(event);
      } catch {
        // 購読者側のエラーは無視する
      }
    }
  }
}
