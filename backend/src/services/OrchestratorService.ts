/**
 * OrchestratorService - パイプライン実行・状態機械・依存解決を担うサービス
 */

import * as path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { CliAdapter } from "../connectors/CliAdapter";
import { RestAdapter } from "../connectors/RestAdapter";
import type { AgentConnector } from "../connectors/AgentConnector";
import type {
  AgentConfig,
  AgentRuntimeState,
  AgentStatus,
  PipelineConfig,
  PipelineNode,
} from "../types";
import { LogService } from "./LogService";
import { ApprovalGateway } from "./ApprovalGateway";
import { readYaml, readYamlOrDefault, writeYaml } from "../utils/yaml";

/** 状態変化イベントのコールバック型 */
type StatusChangeCallback = (nodeId: string, state: AgentRuntimeState) => void;
/** エージェント出力コールバックの型 */
type OutputCallback = (nodeId: string, chunk: string) => void;
/** パイプライン更新コールバックの型 */
type PipelineUpdateCallback = (pipeline: PipelineConfig) => void;

/**
 * 状態遷移が許可されているかを検証する
 * 3.4 の状態定義に基づく遷移ルール
 */
function isValidTransition(from: AgentStatus, to: AgentStatus): boolean {
  const transitions: Record<AgentStatus, AgentStatus[]> = {
    idle: ["running", "waiting"],
    running: ["done", "error", "paused", "approval"],
    waiting: ["running", "idle"],
    paused: ["running", "idle"],
    approval: ["running", "idle"],
    done: ["idle"],
    error: ["idle", "running"],
  };
  return transitions[from]?.includes(to) ?? false;
}

/** パイプライン実行・状態管理サービス */
export class OrchestratorService {
  private pipeline: PipelineConfig | null = null;
  private agents: Map<string, AgentConfig> = new Map();
  private runtimeStates: Map<string, AgentRuntimeState> = new Map();
  private connectors: Map<string, AgentConnector> = new Map();
  private statusChangeListeners: Set<StatusChangeCallback> = new Set();
  private outputListeners: Set<OutputCallback> = new Set();
  private pipelineUpdateListeners: Set<PipelineUpdateCallback> = new Set();

  private readonly projectRoot: string;
  private readonly conductorDir: string;
  private readonly logService: LogService;
  private readonly approvalGateway: ApprovalGateway;

  constructor(
    projectRoot: string,
    logService: LogService,
    approvalGateway: ApprovalGateway,
  ) {
    this.projectRoot = projectRoot;
    this.conductorDir = path.join(projectRoot, ".conductor");
    this.logService = logService;
    this.approvalGateway = approvalGateway;
  }

  /** 設定ファイルを読み込んで初期化する */
  async init(): Promise<void> {
    await this.loadAgents();
    await this.loadPipeline();
  }

  /** エージェント設定を読み込む */
  private async loadAgents(): Promise<void> {
    const { readdir } = await import("node:fs/promises");
    const agentsDir = path.join(this.conductorDir, "agents");

    let files: string[] = [];
    try {
      files = await readdir(agentsDir);
    } catch {
      // agents ディレクトリが存在しなければ空で続行
      return;
    }

    for (const file of files.filter((f) => f.endsWith(".yaml"))) {
      try {
        const config = await readYaml<AgentConfig>(path.join(agentsDir, file));
        this.agents.set(config.id, config);
      } catch (err) {
        void this.logService.logError("orchestrator", `エージェント設定の読み込み失敗: ${file} - ${String(err)}`);
      }
    }
  }

  /** パイプライン設定を読み込む */
  private async loadPipeline(): Promise<void> {
    const pipelinePath = path.join(this.conductorDir, "pipeline.yaml");
    const defaultPipeline: PipelineConfig = { version: 1, name: "Default Pipeline", agents: [] };
    this.pipeline = await readYamlOrDefault<PipelineConfig>(pipelinePath, defaultPipeline);

    for (const node of this.pipeline.agents) {
      this.initRuntimeState(node);
    }
  }

  /** ノードのランタイム状態を初期化する */
  private initRuntimeState(node: PipelineNode): void {
    if (!this.runtimeStates.has(node.id)) {
      this.runtimeStates.set(node.id, {
        nodeId: node.id,
        agentId: node.agent,
        status: "idle",
        progress: 0,
        currentTask: node.task,
        retryCount: 0,
        output: [],
      });
    }
  }

  /**
   * 状態遷移を実行する（不正遷移は例外を投げる）
   */
  private transition(nodeId: string, to: AgentStatus): void {
    const state = this.runtimeStates.get(nodeId);
    if (!state) throw new Error(`ノード ${nodeId} が存在しません`);

    if (!isValidTransition(state.status, to)) {
      throw new Error(`不正な状態遷移: ${nodeId} ${state.status} → ${to}`);
    }

    state.status = to;
    if (to === "idle") {
      state.progress = 0;
      state.retryCount = 0;
    }
    if (to === "running") {
      state.startedAt = new Date().toISOString();
    }

    this.notifyStatusChange(nodeId, state);
    void this.logService.write({
      timestamp: new Date().toISOString(),
      source: "orchestrator",
      level: "info",
      message: `[${nodeId}] 状態遷移: ${to}`,
      agentId: state.agentId,
    });
  }

  /** パイプライン全体を実行する */
  async runPipeline(): Promise<void> {
    if (!this.pipeline) throw new Error("パイプラインが読み込まれていません");

    // 依存関係のないノード（order=1 または depends_on が空）を起動
    const roots = this.pipeline.agents.filter(
      (n) => !n.depends_on || n.depends_on.length === 0,
    );
    await Promise.all(roots.map((n) => this.runNode(n)));
  }

  /** 単一ノードを実行する */
  async runNode(node: PipelineNode): Promise<void> {
    const agentConfig = this.agents.get(node.agent);
    if (!agentConfig) {
      void this.logService.logError("orchestrator", `エージェント設定が見つかりません: ${node.agent}`);
      return;
    }

    const state = this.runtimeStates.get(node.id);
    if (!state) return;

    // 依存関係を解決する
    if (node.depends_on && node.depends_on.length > 0) {
      this.transition(node.id, "waiting");
      const dep = node.depends_on[0];
      const depNode = this.pipeline!.agents.find((n) => n.agent === dep.agent);
      if (!depNode) {
        void this.logService.logError("orchestrator", `依存エージェントが見つかりません: ${dep.agent}`);
        return;
      }

      if (dep.trigger === "approve") {
        this.transition(node.id, "approval");
        const approved = await this.approvalGateway.enqueue(
          node.agent,
          node.id,
          node.task,
          `エージェント ${node.agent} の実行前に承認が必要です`,
          agentConfig.defaults.timeout_minutes,
        );
        if (!approved) {
          void this.logService.logError("orchestrator", `承認が却下されました: ${node.id}`);
          return;
        }
      }
    }

    // コネクターを作成してタスクを実行する
    const connector = this.createConnector(agentConfig);
    this.connectors.set(node.id, connector);

    connector.onOutput((chunk) => {
      state.output.push(chunk);
      this.notifyOutput(node.id, chunk);
      void this.logService.logAgentOutput(agentConfig.id, chunk);
    });

    connector.onComplete((result) => {
      this.transition(node.id, "done");
      state.progress = 100;
      this.notifyStatusChange(node.id, state);
      void this.logService.write({
        timestamp: new Date().toISOString(),
        source: agentConfig.id,
        level: "info",
        message: `完了 (${result.duration_ms}ms)`,
        agentId: agentConfig.id,
      });
      // 次のノードを起動する
      void this.triggerDependents(node.id, "done");
    });

    connector.onError((err) => {
      const maxRetry = agentConfig.defaults.retry_count ?? 2;
      if (state.retryCount < maxRetry) {
        state.retryCount++;
        void this.logService.logError(agentConfig.id, `エラー（リトライ ${state.retryCount}/${maxRetry}）: ${err.message}`, agentConfig.id);
        void connector.start(node.task, [
          ...agentConfig.defaults.context_files,
          ...node.instruction_files,
        ]);
      } else {
        this.transition(node.id, "error");
        void this.logService.logError(agentConfig.id, `エラー（リトライ上限）: ${err.message}`, agentConfig.id);
        void this.triggerDependents(node.id, "error");
      }
    });

    this.transition(node.id, "running");

    const contextFiles = [
      ...agentConfig.defaults.context_files,
      ...node.instruction_files,
    ];

    await connector.start(node.task, contextFiles).catch((err: unknown) => {
      void this.logService.logError("orchestrator", `エージェント起動失敗: ${String(err)}`, agentConfig.id);
      this.transition(node.id, "error");
    });
  }

  /**
   * 指定ノードに依存するノードのうち、trigger 条件が満たされたものを起動する
   */
  private async triggerDependents(completedNodeId: string, trigger: "done" | "error"): Promise<void> {
    if (!this.pipeline) return;

    const completedNode = this.pipeline.agents.find((n) => n.id === completedNodeId);
    if (!completedNode) return;

    const dependents = this.pipeline.agents.filter((n) =>
      n.depends_on?.some(
        (d) => d.agent === completedNode.agent && d.trigger === trigger,
      ),
    );

    await Promise.all(dependents.map((n) => this.runNode(n)));
  }

  /** エージェント設定からコネクターを生成する */
  private createConnector(config: AgentConfig): AgentConnector {
    if (config.type === "cli") {
      return new CliAdapter({ config, projectRoot: this.projectRoot });
    }
    return new RestAdapter({ config });
  }

  /** ノードを ID で停止する */
  async stopNode(nodeId: string): Promise<void> {
    const connector = this.connectors.get(nodeId);
    if (connector) {
      await connector.stop();
      this.transition(nodeId, "idle");
    }
  }

  /** 全ノードを停止する */
  async stopAll(): Promise<void> {
    await Promise.all(
      Array.from(this.connectors.entries()).map(async ([nodeId, connector]) => {
        await connector.stop();
        const state = this.runtimeStates.get(nodeId);
        if (state && state.status === "running") {
          this.transition(nodeId, "idle");
        }
      }),
    );
  }

  /** パイプライン定義を更新・保存する */
  async updatePipeline(pipeline: PipelineConfig): Promise<void> {
    this.pipeline = pipeline;
    const pipelinePath = path.join(this.conductorDir, "pipeline.yaml");
    await writeYaml(pipelinePath, pipeline);

    for (const node of pipeline.agents) {
      this.initRuntimeState(node);
    }

    for (const listener of this.pipelineUpdateListeners) {
      listener(pipeline);
    }
  }

  /** エージェント設定を登録・保存する */
  async registerAgent(config: AgentConfig): Promise<void> {
    this.agents.set(config.id, config);
    const agentPath = path.join(this.conductorDir, "agents", `${config.id}.yaml`);
    await writeYaml(agentPath, config);
  }

  /** 全エージェント設定を取得する */
  getAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  /** パイプライン定義を取得する */
  getPipeline(): PipelineConfig | null {
    return this.pipeline;
  }

  /** 全ノードのランタイム状態を取得する */
  getRuntimeStates(): AgentRuntimeState[] {
    return Array.from(this.runtimeStates.values());
  }

  /** 指定ノードのランタイム状態を取得する */
  getRuntimeState(nodeId: string): AgentRuntimeState | undefined {
    return this.runtimeStates.get(nodeId);
  }

  /** 状態変化を購読する */
  onStatusChange(cb: StatusChangeCallback): () => void {
    this.statusChangeListeners.add(cb);
    return () => this.statusChangeListeners.delete(cb);
  }

  /** エージェント出力を購読する */
  onOutput(cb: OutputCallback): () => void {
    this.outputListeners.add(cb);
    return () => this.outputListeners.delete(cb);
  }

  /** パイプライン更新を購読する */
  onPipelineUpdate(cb: PipelineUpdateCallback): () => void {
    this.pipelineUpdateListeners.add(cb);
    return () => this.pipelineUpdateListeners.delete(cb);
  }

  private notifyStatusChange(nodeId: string, state: AgentRuntimeState): void {
    for (const cb of this.statusChangeListeners) {
      try {
        cb(nodeId, state);
      } catch {
        // リスナーのエラーは無視する
      }
    }
  }

  private notifyOutput(nodeId: string, chunk: string): void {
    for (const cb of this.outputListeners) {
      try {
        cb(nodeId, chunk);
      } catch {
        // リスナーのエラーは無視する
      }
    }
  }

  /** パイプラインIDでノードを ID で取得する */
  getPipelineNode(nodeId: string): PipelineNode | undefined {
    return this.pipeline?.agents.find((n) => n.id === nodeId);
  }

  /** エージェントIDでユニークなパイプラインノードIDを生成して追加する */
  async addPipelineNode(agentId: string, task: string): Promise<PipelineNode> {
    if (!this.pipeline) throw new Error("パイプラインが初期化されていません");

    const node: PipelineNode = {
      id: uuidv4(),
      agent: agentId,
      order: this.pipeline.agents.length + 1,
      task,
      instruction_files: [],
    };

    this.pipeline.agents.push(node);
    this.initRuntimeState(node);
    await this.updatePipeline(this.pipeline);
    return node;
  }
}
