# Roadmap — @kozen/pipeline

**Version:** 1.0  
**Date:** 2026-06-08  
**Status:** Active  
**Depends on:** PRD.md, engineering-proposal.md

---

## Reading Guide

Each iteration lists:
- **Functional Requirements (FR)** with acceptance criteria
- **Non-Functional Requirements (NFR)**
- **Definition of Done** — the checklist that gates moving to the next iteration

Only v1 scope should be active in any given sprint. Do not implement v2 features while v1 acceptance criteria are unmet.

---

## v1 — Stable Core (current)

**Goal:** Close all known gaps in the existing implementation, correct the package metadata, and ship a fully functional 1.0 module that passes manual end-to-end verification.

### Functional Requirements

| FR | Description | Acceptance Criteria |
|---|---|---|
| FR-1.1 | Fix `PipelineManager.destroy()` | Resolves the stack via `stackAdm.undeploy()`, removes state; returns `success: true` with stack name and timestamp |
| FR-1.2 | Fix `PipelineManager.validate()` | Loads the template, resolves all variables via `ProcessorService`, verifies component IoC tokens exist; returns `success: true/false` with error list |
| FR-1.3 | Fix `PipelineManager.status()` | Delegates to `stackAdm.status()`, returns actual stack state; returns `success: true` with stack output |
| FR-1.4 | Fix `StackManagerNode.undeploy()` | Calls `config.program()` if defined; returns `success: true` |
| FR-1.5 | Fix `StackManagerNode.validate()` | Returns `success: true` (Node backend has no Pulumi state to validate); add a comment explaining the no-op |
| FR-1.6 | Fix `StackManagerNode.status()` | Returns `success: true` with a message indicating no persistent state |
| FR-1.7 | Fix `package.json` metadata | Change description from "key vault secret managers" to "IaC pipeline management module for the Kozen framework"; fix keywords to remove "secret manager" and "key vault" |
| FR-1.8 | Remove hardcoded Pulumi passphrase | `PULUMI_CONFIG_PASSPHRASE` fallback must require explicit env var or fail with a clear error message |
| FR-1.9 | Validate `template:manager` token at startup | `PipelineManager.configure()` should attempt to resolve `template:manager` and throw a descriptive error if absent |
| FR-1.10 | Add `this.fix(dep)` in `PipelineModule.register()` | Call `this.fix(dep)` before returning from `register()` to resolve relative `path` entries in IoC config files to absolute paths |
| FR-1.11 | Create `tsconfig.json` at project root | Add `tsconfig.json` with `outDir: "dist"`, `rootDir: "."`, `include: ["src/**/*.ts"]` so that `npm run build` succeeds |

### Non-Functional Requirements

| NFR | Description |
|---|---|
| NFR-1.1 | All log calls carry `flow` ID |
| NFR-1.2 | No hardcoded credentials in source code |
| NFR-1.3 | `npm pack --dry-run` output includes `dist/src/docs/pipeline.txt` and excludes `src/` |
| NFR-1.4 | Module loads cleanly via `npx kozen` with a minimal `kozen.js.json` and registered `template:manager` |

### Definition of Done — v1

- [ ] All FR-1.x acceptance criteria verified manually
- [ ] `npm run build` completes without TypeScript errors
- [ ] `npm pack --dry-run` includes `dist/` and excludes `src/`
- [ ] `kozen --action=pipeline:deploy --template=atlas.basic` deploys a real Atlas cluster end-to-end
- [ ] `kozen --action=pipeline:destroy --template=atlas.basic` removes the cluster
- [ ] `kozen_pipeline_list` MCP tool returns at least one template
- [ ] `package.json` version bumped to 1.0.1 or higher with a changelog entry

---

## v2 — Test Coverage and Reliability

**Goal:** Establish a test suite that covers the core services, fix the variable resolution ordering issue, and add integration tests for the CLI controller.

### Functional Requirements

| FR | Description | Acceptance Criteria |
|---|---|---|
| FR-2.1 | Unit tests for `ProcessorService` | 100% branch coverage for `transform()`: environment, reference, secret, static, protected types; secret fallback on error |
| FR-2.2 | Unit tests for `PipelineManager` | `deploy()`, `undeploy()`, `validate()`, `status()` covered with mocked `IStackManager` and `ITemplateManager` |
| FR-2.3 | Fix variable resolution ordering | `ProcessorService.process()` resolves variables sequentially (not `Promise.all`) so that reference-type variables can read values set by earlier variables in the same batch |
| FR-2.4 | Integration test for CLI controller | `PipelineCLIController.execute()` called with a Node backend template and a real `ProcessorService`; asserts `success: true` result |
| FR-2.5 | Integration test for MCP tools | `kozen_pipeline_select` and `kozen_pipeline_list` return valid JSON with an in-memory template manager |

### Non-Functional Requirements

| NFR | Description |
|---|---|
| NFR-2.1 | Test runner: Jest or Vitest configured in `package.json` |
| NFR-2.2 | Coverage threshold: ≥ 70% lines for `src/services/` |
| NFR-2.3 | CI: GitHub Actions workflow runs tests on every pull request |
| NFR-2.4 | Test files in `test/` directory, not in `src/` |

### Definition of Done — v2

- [ ] `npm test` runs without errors
- [ ] Coverage report shows ≥ 70% lines for `src/services/`
- [ ] FR-2.3 (sequential variable resolution) verified with a test that chains reference-type variables
- [ ] GitHub Actions CI green on main branch

---

## v3 — Extended Component Catalog and Parallel Execution

**Goal:** Add parallel component execution strategy, implement the remaining stub components (DemoFirst, DemoSecond), and publish the module to npm.

### Functional Requirements

| FR | Description | Acceptance Criteria |
|---|---|---|
| FR-3.1 | Parallel execution strategy | Templates can declare `"strategy": "parallel"` in `stack`; `PipelineManager.process()` runs components with `Promise.all` when selected; sequential remains the default |
| FR-3.2 | Register `DemoFirst` and `DemoSecond` in `ioc.json` | Both components are implemented but not registered in `ioc.json`; add their IoC tokens so they are available by default without host-app configuration |
| FR-3.3 | Hybrid execution strategy | Components can declare `"parallel": true` on individual entries; the engine groups adjacent parallel components and executes each group concurrently |
| FR-3.4 | Component `metadata()` registry | MCP tool `kozen_pipeline_components` lists all registered components with their metadata (name, description, input schema) |
| FR-3.5 | npm publication | Module published to npm under `@kozen/pipeline` with `publishConfig.access: "public"` |

### Non-Functional Requirements

| NFR | Description |
|---|---|
| NFR-3.1 | Parallel execution must not break sequential reference-type variable chaining (groups run in order; parallelism is within a group) |
| NFR-3.2 | `npm pack --dry-run` verified before each publish |

### Definition of Done — v3

- [ ] `Promise.all` and sequential group execution verified with a 3-component template
- [ ] `npm install @kozen/pipeline` installs and loads without modification
- [ ] `kozen_pipeline_components` MCP tool lists all 9 components with metadata

---

## v4 — Advanced Features

**Goal:** AI-driven component recommendations, real-time monitoring dashboard, and template marketplace.

### Functional Requirements (preliminary)

| FR | Description |
|---|---|
| FR-4.1 | AI-driven component recommendations via MCP — given a deployment goal, suggest a template |
| FR-4.2 | Real-time monitoring dashboard — stream Pulumi output to a MongoDB collection; visualize in Charts |
| FR-4.3 | Template marketplace — list and install community templates from a central registry |
| FR-4.4 | Multi-cloud parallel execution — run AWS and Atlas components in parallel across different credential contexts |
| FR-4.5 | Advanced dependency resolution — declare `dependsOn` between components; engine topologically sorts execution order |

> v4 FRs are directional only. Acceptance criteria will be defined when v3 is complete.

---

## Iteration Dependency Map

```
v1 (stable core)
  └── v2 (tests + reliability)
        └── v3 (parallel execution + npm publish)
              └── v4 (advanced features)
```

Work on the next iteration only begins after the previous iteration's Definition of Done is fully checked.
