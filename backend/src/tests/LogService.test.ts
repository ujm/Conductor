/**
 * LogService のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { LogService } from "../services/LogService";

describe("LogService", () => {
  let tmpDir: string;
  let service: LogService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "conductor-log-test-"));
    service = new LogService(tmpDir);
    await service.init();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it("write でエントリをファイルに保存できる", async () => {
    await service.write({
      timestamp: "2025-06-06T10:00:00.000Z",
      source: "test",
      level: "info",
      message: "hello",
    });

    const entries = await service.getEntries("2025-06-06");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.message).toBe("hello");
  });

  it("subscribe で新しいエントリを受け取れる", async () => {
    const received: string[] = [];
    service.subscribe((entry) => received.push(entry.message));

    await service.write({
      timestamp: new Date().toISOString(),
      source: "test",
      level: "info",
      message: "stream-test",
    });

    expect(received).toContain("stream-test");
  });

  it("unsubscribe 後はエントリを受け取らない", async () => {
    const received: string[] = [];
    const unsubscribe = service.subscribe((entry) => received.push(entry.message));
    unsubscribe();

    await service.write({
      timestamp: new Date().toISOString(),
      source: "test",
      level: "info",
      message: "after-unsubscribe",
    });

    expect(received).toHaveLength(0);
  });
});
