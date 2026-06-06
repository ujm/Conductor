/**
 * ApprovalGateway - 承認待ちアクションのキュー管理サービス
 */

import { v4 as uuidv4 } from "uuid";
import type { ApprovalRequest } from "../types";

/** 承認/却下時のコールバック型 */
type ApprovalCallback = (approved: boolean) => void;

/** 承認待ちアクションを管理するサービス */
export class ApprovalGateway {
  private readonly queue: Map<string, ApprovalRequest> = new Map();
  private readonly callbacks: Map<string, ApprovalCallback> = new Map();
  private readonly changeListeners: Set<() => void> = new Set();

  /**
   * 承認待ちにキューイングし、承認/却下を待つ Promise を返す
   */
  enqueue(
    agentId: string,
    pipelineNodeId: string,
    action: string,
    context: string,
    timeoutMinutes?: number,
  ): Promise<boolean> {
    const id = uuidv4();
    const request: ApprovalRequest = {
      id,
      agentId,
      pipelineNodeId,
      action,
      context,
      created_at: new Date().toISOString(),
      timeout_minutes: timeoutMinutes,
    };

    this.queue.set(id, request);
    this.notifyChange();

    return new Promise<boolean>((resolve) => {
      this.callbacks.set(id, resolve);

      if (timeoutMinutes !== undefined && timeoutMinutes > 0) {
        setTimeout(() => {
          if (this.callbacks.has(id)) {
            this.reject(id);
          }
        }, timeoutMinutes * 60 * 1000);
      }
    });
  }

  /**
   * 承認操作を実行する
   */
  approve(id: string): boolean {
    const cb = this.callbacks.get(id);
    if (!cb) return false;

    this.queue.delete(id);
    this.callbacks.delete(id);
    this.notifyChange();
    cb(true);
    return true;
  }

  /**
   * 却下操作を実行する
   */
  reject(id: string): boolean {
    const cb = this.callbacks.get(id);
    if (!cb) return false;

    this.queue.delete(id);
    this.callbacks.delete(id);
    this.notifyChange();
    cb(false);
    return true;
  }

  /** 承認待ちキューの一覧を取得する */
  getQueue(): ApprovalRequest[] {
    return Array.from(this.queue.values());
  }

  /** キュー変更の通知を購読する */
  onQueueChange(cb: () => void): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  private notifyChange(): void {
    for (const cb of this.changeListeners) {
      try {
        cb();
      } catch {
        // リスナーのエラーは無視する
      }
    }
  }
}
