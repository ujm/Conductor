/**
 * ApprovalGateway のユニットテスト
 */

import { describe, it, expect } from "vitest";
import { ApprovalGateway } from "../services/ApprovalGateway";

describe("ApprovalGateway", () => {
  it("enqueue した後 approve すると Promise が true で解決される", async () => {
    const gateway = new ApprovalGateway();
    const promise = gateway.enqueue("agent-1", "node-1", "deploy", "context");

    const queue = gateway.getQueue();
    expect(queue).toHaveLength(1);

    const id = queue[0]!.id;
    gateway.approve(id);

    const result = await promise;
    expect(result).toBe(true);
    expect(gateway.getQueue()).toHaveLength(0);
  });

  it("enqueue した後 reject すると Promise が false で解決される", async () => {
    const gateway = new ApprovalGateway();
    const promise = gateway.enqueue("agent-1", "node-1", "deploy", "context");

    const id = gateway.getQueue()[0]!.id;
    gateway.reject(id);

    const result = await promise;
    expect(result).toBe(false);
  });

  it("存在しない ID を approve すると false を返す", () => {
    const gateway = new ApprovalGateway();
    expect(gateway.approve("nonexistent")).toBe(false);
  });

  it("onQueueChange は enqueue 時と approve 時に呼ばれる", async () => {
    const gateway = new ApprovalGateway();
    let callCount = 0;
    gateway.onQueueChange(() => { callCount++; });

    const promise = gateway.enqueue("agent-1", "node-1", "action", "ctx");
    const id = gateway.getQueue()[0]!.id;
    gateway.approve(id);
    await promise;

    expect(callCount).toBe(2);
  });
});
