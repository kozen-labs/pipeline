# Product Requirements Document — @kozen/pipeline

**Version:** 1.0  
**Date:** 2026-06-08  
**Author:** MDB SAT / Kozen Labs  
**Status:** Active

---

## 1. Problem Statement

Infrastructure-as-Code workflows suffer from fragmentation: teams use Pulumi, Terraform, shell scripts, or Kubernetes manifests in isolation, with no unified execution model. Each tool has its own authentication, variable management, and state backend — making cross-platform pipelines brittle and hard to reproduce.

Teams building demo environments, integration tests, or staging stacks on MongoDB Atlas, AWS EKS, and Kubernetes face:
- Repetitive boilerplate for each cloud provider
- No standard way to chain infrastructure steps with data-flow between them
- Secret injection scattered across environment files and CI configurations
- No composable, reusable pipeline definition language that works from both a terminal and an AI assistant

`@kozen/pipeline` solves this by providing a declarative JSON template system with pluggable orchestrators, component-level variable resolution, and a unified CLI + MCP interface — all packaged as a native Kozen module.

---

## 2. Goals

| Goal | Measure of Success |
|---|---|
| Unified pipeline execution for IaC, tests, and data workflows | One CLI invocation deploys an end-to-end MongoDB Atlas + EKS stack |
| Declarative JSON templates replace ad-hoc scripts | A template author needs zero TypeScript knowledge |
| Secret management integrated at variable resolution time | Templates reference secret keys; no credentials appear in template files |
| AI-assistant (MCP) access to pipeline templates | Claude can list, inspect, and invoke templates via registered MCP tools |
| Extensible component system | A new infrastructure target requires only a `KzComponent` subclass |
| Publishable, versioned Kozen module | `npm install @kozen/pipeline` installs a ready-to-use module |

---

## 3. Non-Goals

- The module does not implement its own template storage system (delegated to `template:manager` IoC token, provided externally or by a companion module)
- The module does not implement secret storage (delegated to `secret:manager` IoC token, e.g. `@kozen/secret`)
- Real-time infrastructure monitoring dashboard (roadmap v4)
- Multi-cloud parallel execution across different accounts in one pipeline run (roadmap v3)
- GUI or web interface

---

## 4. Target Personas

### DevOps Engineer — "the operator"
Manages infrastructure lifecycle for demo, staging, and production environments. Needs reproducible, versioned deployments across MongoDB Atlas, AWS, and Kubernetes. Uses the CLI daily.

### Solution Architect — "the template author"
Designs infrastructure topologies for demos and client proofs-of-concept. Writes JSON templates that other engineers consume. Values declarative definitions and clear variable scoping.

### AI Agent / MCP Client — "the assistant"
An AI coding assistant (Claude Code, Claude Desktop) that needs to inspect available pipeline templates, retrieve their structure, and guide users through deployment decisions.

### Platform Engineer — "the module consumer"
Integrates `@kozen/pipeline` as a dependency in a larger Kozen application. Extends the component catalog with custom infrastructure targets.

---

## 5. Feature Overview

### 5.1 Pipeline Execution Engine

The core runtime that reads a JSON template, resolves variables, instantiates components via IoC, and coordinates their deployment through the stack manager.

- **Actions:** `deploy`, `undeploy`, `destroy`, `validate`, `status`
- **Orchestration strategies:** sequential (v1), parallel (v2), hybrid (v3)
- **Flow ID:** every execution carries a unique trace ID through all log calls

### 5.2 Template System

JSON-defined pipeline blueprints stored and retrieved via the `template:manager` interface. Each template declares:
- A component list (ordered, named)
- Input/output variable definitions per component
- Stack backend selection (`orchestrator: "Pulumi" | "node"`)
- Workspace configuration (backend URL, runtime)

### 5.3 Variable Resolution (ProcessorService)

Four resolution types, evaluated at deployment time:
- `environment` — read from `process.env`
- `reference` — resolved from upstream component outputs
- `secret` — fetched from `secret:manager` (AWS Secrets Manager, MongoDB CSFLE, etc.)
- `static` — literal value embedded in the template

### 5.4 Component Catalog

Pre-built `KzComponent` implementations for common infrastructure targets:

| Component | Provider | Capability |
|---|---|---|
| `Atlas` | MongoDB Atlas | Cluster provisioning and management |
| `EKS` | AWS | Elastic Kubernetes Service cluster |
| `ECR` | AWS | Elastic Container Registry |
| `K8Pods` | Kubernetes | Generic pod / deployment management |
| `Docker` | Docker | Container build and push |
| `CLI` | Shell | Arbitrary shell command execution |
| `API` | HTTP | REST API invocation |
| `DemoFirst` | Internal | Demo pipeline step 1 |
| `DemoSecond` | Internal | Demo pipeline step 2 |

### 5.5 Stack Manager Backends

Two orchestration backends, selected per template via the `orchestrator` field:

| Backend | Token | Use case |
|---|---|---|
| `StackManagerPulumi` | `pipeline:stack:manager:pulumi` | Full Pulumi automation with S3 state backend |
| `StackManagerNode` | `pipeline:stack:manager:node` | Direct Node.js execution without Pulumi overhead |

### 5.6 CLI Interface

Exposed via the Kozen CLI binary (`npx kozen`) through `PipelineCLIController`.

```
kozen --action=pipeline:<action> --template=<name> [options]
```

### 5.7 MCP Interface

Two tools registered on the MCP server via `PipelineMCPController`:
- `kozen_pipeline_select` — retrieve a specific template by name
- `kozen_pipeline_list` — list all available templates

---

## 6. Constraints and Dependencies

| Constraint | Detail |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | `@kozen/engine` ≥ 1.1.15 — IoC container, CLI/MCP controllers, base services |
| External: template storage | Requires a registered `template:manager` in the IoC container |
| External: secret management | Requires a registered `secret:manager` for secret-type variables (e.g. `@kozen/secret`) |
| Pulumi backend | Requires valid `PULUMI_BACKEND_URL` and `PULUMI_CONFIG_PASSPHRASE` for Pulumi orchestrator |
| AWS | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` for AWS components (EKS, ECR) |
| MongoDB Atlas | `ATLAS_PUBLIC_KEY`, `ATLAS_PRIVATE_KEY`, `ATLAS_PROJECT_ID` for Atlas component |

---

## 7. Success Metrics (v1 Release)

- A MongoDB Atlas cluster can be deployed and destroyed via `atlas.basic` template in under 10 minutes
- Zero credentials appear in any template JSON file
- `kozen_pipeline_list` MCP tool returns all templates registered in the default template manager
- Module installs cleanly with `npm install @kozen/pipeline` and loads via Kozen IoC without modification
- Unit test coverage ≥ 70% for `ProcessorService` and `PipelineManager`
