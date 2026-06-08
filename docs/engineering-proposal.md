# Engineering Proposal — @kozen/pipeline

**Version:** 1.0  
**Date:** 2026-06-08  
**Status:** Active  
**Depends on:** PRD.md

---

## 1. Executive Summary

`@kozen/pipeline` is a Kozen module that provides a declarative, component-based IaC pipeline execution engine. It packages the Pulumi automation API and a direct Node.js executor behind a unified interface, accessible via CLI and MCP.

This document records all architecture decisions (ADRs) and design trade-offs made during the module's initial design and subsequent evolution. It serves as the single source of truth for "why" questions that are not answerable by reading the code.

---

## 2. Repository Structure

```
@kozen/pipeline/
├── src/
│   ├── index.ts                          ← PipelineModule (KzModule entry point)
│   ├── models/
│   │   ├── Pipeline.ts                   ← IPipelineArgs, IPipeline
│   │   └── Stack.ts                      ← IStackOptions, IStackManager, IStackConfig
│   ├── services/
│   │   ├── BaseService.ts                ← PipelineService (transformInput/Output)
│   │   ├── PipelineManager.ts            ← Core orchestrator (deploy/undeploy/destroy/validate/status)
│   │   ├── ProcessorService.ts           ← Variable resolution (env/reference/secret/static)
│   │   ├── StackManager.ts               ← Strategy router (delegates to Pulumi or Node)
│   │   ├── StackManagerPulumi.ts         ← Pulumi Automation API backend
│   │   └── StackManagerNode.ts           ← Node.js direct execution backend
│   ├── controllers/
│   │   ├── KzComponent.ts                ← Abstract component controller base
│   │   ├── PipelineCLIController.ts      ← CLI bridge (5 actions)
│   │   └── PipelineMCPController.ts      ← MCP bridge (2 tools)
│   ├── components/
│   │   ├── Atlas/                        ← MongoDB Atlas component
│   │   ├── EKS/                          ← AWS EKS component
│   │   ├── ECR/                          ← AWS ECR component
│   │   ├── K8Pods/                       ← Kubernetes pods component
│   │   ├── Docker/                       ← Docker build/push component
│   │   ├── CLI/                          ← Shell command component
│   │   ├── API/                          ← HTTP REST component
│   │   ├── DemoFirst/                    ← Demo step 1
│   │   └── DemoSecond/                   ← Demo step 2
│   ├── configs/
│   │   ├── ioc.json                      ← Core IoC registrations
│   │   ├── cli.json                      ← CLI controller registration
│   │   └── mcp.json                      ← MCP controller registration
│   └── docs/
│       └── pipeline.txt                  ← CLI help text
├── docs/                                 ← Engineering documentation (this directory)
├── tmp/wiki/                             ← Initial GitHub Wiki drafts
├── package.json
├── tsconfig.json
├── kozen.js.json                         ← Kozen runtime config (JS)
└── kozen.ts.json                         ← Kozen runtime config (TS/dev)
```

---

## 3. Architecture Decisions (ADRs)

### ADR-001: Adopt the Bridge Pattern for stack backends

**Context:** The module must support both Pulumi (full automation with remote state) and a lightweight Node.js executor (no Pulumi overhead). The two backends share the same operation set but have completely different internals.

**Decision:** Implement `StackManager` as a bridge router that delegates to strategy implementations (`StackManagerPulumi`, `StackManagerNode`) resolved by IoC token. The `orchestrator` field in the template selects the backend at runtime.

**Consequences:**
- Adding a new backend (Terraform, CDK) requires a new class + IoC token, not modification of existing code (Open/Closed Principle).
- `StackManager` hierarchy is exactly two levels deep: base + one subclass each. This satisfies the kozen-engine constraint against hierarchies deeper than two levels.
- Both backends share the `IStackManager` interface contract, enabling tests to mock the backend cleanly.

**Rejected alternatives:**
- Single `StackManager` class with `if orchestrator === "Pulumi"` branches — violates OCP and grows unboundedly.
- Separate npm packages per backend — over-engineering for the current scope.

---

### ADR-002: Variable resolution as a dedicated ProcessorService

**Context:** Templates reference four types of variables (environment, reference, secret, static). These resolution mechanisms differ significantly and need to compose within a single template component definition.

**Decision:** Centralize all variable resolution in `ProcessorService` with a single `process(inputs, scope)` method. The service is registered as IoC token `core:processor` (singleton) and injected wherever variable resolution is needed.

**Consequences:**
- All variable logic is in one place — testable in isolation without deploying infrastructure.
- `ProcessorService.transform()` is the single function to extend when adding a new variable type.
- The `scope` parameter carries upstream component outputs, enabling reference-type chaining between components.

**Rejected alternatives:**
- Inline resolution inside each component — duplicates logic and makes secret fetching untestable.
- A separate resolution pass before deployment — loses the sequential data-flow guarantee between components.

---

### ADR-003: Three separate IoC config files (ioc.json, cli.json, mcp.json)

**Context:** The Kozen engine's `register()` method is called with `config.type = "cli" | "mcp" | undefined`. CLI-specific controllers must not be loaded when running as an MCP server (and vice versa), to avoid unnecessary instantiation.

**Decision:** Split registrations into three files. `ioc.json` contains services shared by all runtime types. `cli.json` adds the CLI controller. `mcp.json` adds the MCP controller. `PipelineModule.register()` merges appropriately based on `config.type`.

**Consequences:**
- MCP runtime never loads CLI controller classes.
- The split is the established pattern in all other `@kozen/*` modules — consistency lowers onboarding friction.

---

### ADR-004: PipelineManager as singleton, StackManager as transient

**Context:** `PipelineManager` holds no mutable per-request state (all state lives in the `IPipeline` runtime context passed as arguments). `StackManager` wraps a Pulumi `Stack` instance that is tied to a single deployment run.

**Decision:** `PipelineManager` lifetime = `singleton`. `StackManager` and all three stack manager variants = `transient`.

**Consequences:**
- The singleton `PipelineManager` is configured once at startup via `configure(config)` and reused across CLI calls in long-running processes.
- Transient `StackManager` instances avoid shared Pulumi state between concurrent pipeline runs.

---

### ADR-005: Template storage delegated to external IoC token

**Context:** Templates can be stored in the file system, MongoDB, S3, or a Git repository. The pipeline module should not dictate storage strategy.

**Decision:** Template loading is delegated entirely to the `template:manager` IoC token. `PipelineManager` resolves this token at runtime; it never imports a concrete template manager class.

**Consequences:**
- The host application registers whichever `ITemplateManager` implementation fits its deployment model.
- The pipeline module has no dependency on any specific storage SDK (no MongoDB, no S3 SDK in `dependencies`).
- This is a hard external dependency — the module will throw at runtime if `template:manager` is not registered.

---

### ADR-006: Secret management delegated to external IoC token

**Context:** Same rationale as ADR-005 applied to secrets. Secrets can come from AWS Secrets Manager, MongoDB CSFLE, Azure Key Vault, or HashiCorp Vault.

**Decision:** `ProcessorService` resolves `secret:manager` lazily on first secret-type variable encountered. If no secret-type variables exist in a template, the `secret:manager` token is never resolved and its absence causes no error.

**Consequences:**
- Templates that use only `environment` and `static` variables can run without `@kozen/secret` installed.
- The lazy resolution avoids startup-time failures when the secret manager service is not configured.

---

### ADR-007: Component IoC token = component name field in template

**Context:** Templates list components by a `name` string. The engine must resolve the correct `KzComponent` subclass for that name.

**Decision:** The `name` field in the template component definition is the exact IoC token under which the component class is registered. `PipelineManager.process()` calls `this.assistant.resolve(component.name)`.

**Consequences:**
- Template authors control component selection by choosing the IoC token name — no separate type field needed.
- Component registration is the host application's responsibility (or provided by default in `ioc.json`).
- Token collision with non-component services is prevented by convention: component tokens use PascalCase (e.g. `Atlas`, `EKS`); service tokens use `domain:name` colon-separated lowercase.

---

### ADR-008: Output exposure via Env service

**Context:** After a pipeline run, downstream processes (CI jobs, other pipelines) need access to the infrastructure outputs (connection strings, cluster IDs, etc.).

**Decision:** `PipelineManager.deploy()` calls `this.envSrv.expose(out.output)` at completion. This behavior is controlled by the `KOZEN_ENV_ACTION` environment variable: `EXPOSE` (default) writes outputs; any other value skips exposure.

**Consequences:**
- Outputs are available as environment variables in the same shell session or CI step.
- The exposure is opt-out, not opt-in — safe default for CI environments.

---

## 4. Import Direction Rules

Imports must flow strictly in one direction to prevent circular dependencies:

```
models  ←  services  ←  controllers  ←  index.ts
                ↑
           components
```

- `models/` imports nothing from this module (only from `@kozen/engine` shared models)
- `services/` imports from `models/` only
- `controllers/` imports from `services/` and `models/` only
- `components/` imports from `models/` only
- `index.ts` imports JSON configs from `./configs/` and re-exports `ProcessorService` from `./services/`; it does NOT import from `./controllers/`
- Cross-service dependencies go through IoC tokens, never direct class imports

---

## 5. Known Gaps (as of v1.0)

These items are explicitly deferred to the roadmap and are not bugs:

| Gap | Location | Roadmap target |
|---|---|---|
| `PipelineManager.destroy()` returns hardcoded success | `PipelineManager.ts:298` | v1 |
| `PipelineManager.validate()` returns hardcoded success | `PipelineManager.ts:317` | v1 |
| `PipelineManager.status()` returns hardcoded success | `PipelineManager.ts:336` | v1 |
| `StackManagerNode.undeploy/validate/status` return `success: false` | `StackManagerNode.ts` | v1 |
| `PipelineModule.register()` does not call `this.fix(dep)` — IoC relative paths are not resolved to absolute | `index.ts:26` | v1 |
| `tsconfig.json` missing at project root — `npm run build` fails | project root | v1 |
| No unit or integration tests | `package.json` test script | v2 |
| `package.json` description says "key vault secret managers" — incorrect | `package.json` | v1 |
| `package.json` keywords include "secret manager", "key vault" — incorrect for this module | `package.json` | v1 |
| `ProcessorService.process()` resolves variables with `Promise.all` — order-dependent reference variables may resolve before upstream values are set | `ProcessorService.ts:174` | v2 |
| Pulumi passphrase hardcoded as fallback `"K0Z3N-IsSoSecure"` | `StackManagerPulumi.ts:88` | v1 |

---

## 6. Extension Points

| Extension | How to implement |
|---|---|
| New stack backend (Terraform) | Create `StackManagerTerraform extends StackManager`, register as `pipeline:stack:manager:terraform`, set `orchestrator: "terraform"` in template |
| New component (CosmosDB) | Create `CosmosDbComponent extends KzComponent`, register as `CosmosDb` in `ioc.json`, use `"name": "CosmosDb"` in template |
| New template storage | Implement `ITemplateManager`, register as `template:manager` in host app IoC |
| New secret backend | Implement `ISecretManager`, register as `secret:manager` in host app IoC (or use `@kozen/secret`) |
| New variable type | Add a `case` in `ProcessorService.transform()` |
