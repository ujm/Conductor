# Conductor

[日本語](README.ja.md)

An orchestration UI for humans to direct AI agents (Claude Code, etc.).

---

## Overview

Conductor is a tool that combines multiple AI agents into pipelines, letting a human manage and supervise their progress. From the UI you define when, in what order, and under what conditions agents run, and you can monitor their output, logs, and file changes in real time while they execute.

This is aimed at engineers who want to use AI agents for real development, research, and automation tasks, but want a human in the loop because fully autonomous execution feels too risky.

---

## Features

### Pipeline Management (Pipeline View)
- Drag and drop agent nodes to reorder and define execution order
- Configure dependencies between nodes (`on:done` / `on:error` / `on:approve` / `parallel`)
- Run or stop the entire pipeline at once, or execute individual nodes
- Real-time display of each agent's state (idle / running / done / error / awaiting approval)
- Progress bar and partial output shown on cards while running

### Task Management (Task Board)
- Manage tasks on a Kanban board (Todo / In Progress / Review / Done / Blocked)
- Drag and drop task cards to change their status
- Color-coded task priority (low / medium / high / critical)
- Support for assigning tasks to agents

### File Management (File Manager)
- Browse the file tree under the project root
- View, edit, and save text files in place
- Edit `.conductor/` configuration files (YAML) directly in the browser

### Log Viewer
- Real-time streaming of agent stdout/stderr
- Filter logs by agent
- Color-coded log levels (info / warn / error / debug)
- Persisted to disk in JSONL format (organized by date)

### Approval Queue
- Nodes with an `on:approve` dependency block execution until a human approves
- Approve or reject with a single button click
- Notification badge shown in the header and navigation when approvals are pending

### Agent Configuration
- Register CLI agents (command, arguments, working directory) from the UI
- Also supports registering REST API agents (Base URL)
- Configure timeout and retry count individually per agent

---

## Architecture

```
Frontend (React + Vite, :5173)
  └── useWebSocket hook (single WebSocket connection)
        ├── Incoming events → Zustand stores (auto-update)
        └── Outgoing messages → Backend

Backend (Express 5 + ws, :3001)
  ├── REST API  /api/*  ← Agent / pipeline / task / file management
  └── WebSocket /ws     ← Broadcasts state changes, output, and logs
```

### Key Components

| Layer | Class / Module | Role |
|---|---|---|
| Service | `OrchestratorService` | Pipeline state machine. Dependency resolution and retry control |
| Service | `ApprovalGateway` | Blocks `on:approve` nodes via Promises |
| Service | `LogService` | JSONL file writes + WebSocket streaming |
| Service | `FileWatcher` | Watches file changes with chokidar |
| Connector | `CliAdapter` | Launches CLI agents via `child_process.spawn` |
| Connector | `RestAdapter` | Calls REST agents via `fetch + AbortController` |
| Frontend | Zustand stores | The single source of state, updated directly by WebSocket events |

### Configuration Files

All configuration is persisted as YAML under the `.conductor/` directory.

```
.conductor/
├── project.yaml          # Project name and root path
├── pipeline.yaml         # Agent order and dependencies
├── agents/
│   └── claude-code.yaml  # Agent connection settings (one file per agent)
└── tasks/
    └── <uuid>.yaml       # Tasks (one file per task)
```

**Example `pipeline.yaml`:**

```yaml
version: 1
name: My Pipeline
agents:
  - id: node-01
    agent: claude-code
    order: 1
    task: "Update the README"
    instruction_files: []
  - id: node-02
    agent: claude-code
    order: 2
    task: "Run the tests"
    depends_on:
      - agent: node-01
        trigger: done       # Starts automatically once node-01 completes
```

**Trigger types:**

| Value | Meaning |
|---|---|
| `done` | Starts automatically when the previous node completes successfully |
| `error` | Starts automatically when the previous node ends with an error |
| `approve` | Waits until a human clicks the approve button |
| `parallel` | No dependency (starts at the same time as the pipeline) |

### Example Agent Configuration File (`agents/*.yaml`)

```yaml
id: claude-code
name: Claude Code
type: cli
icon: "🤖"
color: "#4f8ef7"
connection:
  command: claude
  args:
    - "--dangerously-skip-permissions"
  cwd: "{project_root}"
defaults:
  timeout_minutes: 30
  retry_count: 2
  approval_required: false
  context_files:
    - memory/project-context.md   # File appended to the prompt before execution
```

`{project_root}` and `{env.VAR_NAME}` are resolved by the backend at startup.

---

## Usage

### Prerequisites

- Node.js 20 or later
- Claude Code CLI installed (the `claude` command must be available)

### Installation

```bash
git clone https://github.com/ujm/Conductor.git
cd Conductor

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Running

```bash
# Set PROJECT_ROOT to the path of the project you want to manage
PROJECT_ROOT=/path/to/your/project npm run dev
```

Open `http://localhost:5173` in your browser.

> **Note**  
> `npm run dev` starts both the backend (`:3001`) and frontend (`:5173`) at the same time.  
> Frontend requests to `/api` and `/ws` are forwarded to the backend via the Vite dev proxy.

### Initial Setup

1. The `.conductor/` directory is created automatically if it doesn't exist
2. Register agents from the **Agent Config** screen, or create YAML files directly under `.conductor/agents/`
3. Add nodes and configure dependencies in **Pipeline View**
4. Run the pipeline using the **Run** button in Pipeline View

### Running a Pipeline

1. Open Pipeline View
2. Press the **▶ Run** button on an agent card to run it individually, or **Run Pipeline** in the header to run the whole pipeline
3. Watch real-time output in the Log Viewer
4. Approve or reject `on:approve` nodes from the Approval Queue screen

### Assigning Tasks to Agents

1. Create a new task on the Task Board (Enter key or `+` button)
2. Set the `assigned_agent` field in `.conductor/tasks/<uuid>.yaml`
3. Reference that task YAML in `instruction_files` in the pipeline node configuration

### Testing

```bash
cd backend && npm test
```

---

## Tech Stack

| Area | Technology |
|---|---|
| Backend | Node.js 20 / TypeScript 6 / Express 5 / ws |
| Frontend | React 19 / Vite 8 / TypeScript 6 / Tailwind CSS v4 |
| State Management | Zustand 5 |
| Pipeline UI | React Flow (@xyflow/react) |
| Testing | Vitest |
| Config Format | YAML (js-yaml) |
