# Technical Specification — @kozen/pipeline

**Version:** 1.0  
**Date:** 2026-06-08  
**Status:** Active  
**Depends on:** PRD.md, engineering-proposal.md

---

## 1. TypeScript Models

### 1.1 IPipelineArgs

```typescript
// src/models/Pipeline.ts
export interface IPipelineArgs extends IArgs {
  template?: string;   // Template name (required for deploy/validate)
  action: string;      // One of: deploy | undeploy | destroy | validate | status
  stack?: string;      // Environment identifier (dev | staging | prod)
  project?: string;    // Project identifier for resource grouping
  config?: string;     // Path to config.json
}
```

### 1.2 IPipeline (runtime context)

```typescript
export interface IPipeline {
  id?: string;              // Unique execution trace ID
  args?: IPipelineArgs;     // CLI arguments
  template?: ITemplate;     // Loaded template definition
  assistant?: IIoC;         // IoC container for component resolution
  stack?: IStackManager;    // Resolved stack manager instance
}
```

### 1.3 IStackOptions

```typescript
// src/models/Stack.ts
export interface IStackOptions extends IComponent {
  orchestrator?: string;                  // "Pulumi" | "node" (default: "node")
  project?: string;                       // Pulumi project name
  name?: string;                          // Stack name
  tags?: Record<string, string>;          // Stack metadata tags
  components?: IComponent[];              // Ordered component list
  program?: () => Promise<any>;           // Pulumi inline program function
  init?: (stack: any) => Promise<any>;    // Pre-deployment setup hook
  end?: () => Promise<any>;              // Post-deployment output hook
  workspace?: {
    url?: string;       // Pulumi backend URL (e.g. s3://kozen-pulumi-stacks)
    runtime?: string;   // "nodejs" (default)
  };
  config?: IStackConfig;
}
```

### 1.4 IStackManager (interface contract)

```typescript
export interface IStackManager {
  readonly config?: IStackOptions;
  deploy(config: IStackOptions): Promise<IResult>;
  undeploy(config: IStackOptions): Promise<IResult>;
  validate(config: IStackOptions): Promise<IResult>;
  status(config: IStackOptions): Promise<IResult>;
  transformInput(options: ITransformOption): Promise<IStruct>;
  transformSetup(options: ITransformOption): Promise<IStruct>;
  transformOutput(options: ITransformOption): Promise<{ items?: IStruct; warns?: IStruct }>;
}
```

### 1.5 IResult (shared)

```typescript
// From @kozen/engine shared models
export interface IResult {
  success?: boolean;
  action?: IAction;
  templateName?: string;
  stackName?: string;
  projectName?: string;
  message?: string;
  timestamp?: Date;
  duration?: number;
  output?: IStruct;
  results?: IResult[];
  errors?: string[];
  error?: Error;
}
```

### 1.6 IMetadata (variable definition)

```typescript
export interface IMetadata {
  name?: string;     // Output key name
  type?: string;     // "environment" | "reference" | "secret" | "static"
  value?: string;    // Source key (env var name, scope key, secret path, or literal value)
  default?: any;     // Fallback if resolution fails
}
```

---

## 2. IoC Token Registry

All tokens registered in `src/configs/ioc.json`, `cli.json`, and `mcp.json`.

| Token | Class | Lifetime | Config file | Description |
|---|---|---|---|---|
| `pipeline:stack:manager` | `StackManager` | transient | ioc.json | Stack manager router (delegates to Pulumi or Node) |
| `pipeline:stack:manager:pulumi` | `StackManagerPulumi` | transient | ioc.json | Pulumi automation backend |
| `pipeline:stack:manager:node` | `StackManagerNode` | transient | ioc.json | Node.js direct execution backend |
| `pipeline:manager` | `PipelineManager` | singleton | ioc.json | Core orchestrator service |
| `core:processor` | `ProcessorService` | singleton | ioc.json | Variable resolution service |
| `pipeline:controller:cli` | `PipelineCLIController` | transient | cli.json | CLI interface controller |
| `pipeline:controller:mcp` | `PipelineMCPController` | transient | mcp.json | MCP interface controller |

### External tokens (must be provided by host application)

| Token | Expected interface | Provided by |
|---|---|---|
| `template:manager` | `ITemplateManager` | Host app or companion module |
| `secret:manager` | `ISecretManager` | `@kozen/secret` or custom |
| `logger:service` | `ILogger` | `@kozen/engine` built-in |
| `IoC` | `IIoC` | `@kozen/engine` built-in |
| `core:file` | `FileService` | `@kozen/engine` built-in |
| `Env` | `IEnv` | `@kozen/engine` built-in |

---

## 3. Template JSON Schema

Templates are stored externally and resolved via `template:manager`. The schema consumed by `PipelineManager` is:

```json
{
  "name": "atlas.basic",
  "description": "MongoDB Atlas cluster deployment",
  "engine": "kozen",
  "stack": {
    "orchestrator": "Pulumi",
    "workspace": {
      "url": "s3://kozen-pulumi-stacks",
      "runtime": "nodejs"
    },
    "input": [
      { "name": "PULUMI_BACKEND_URL", "type": "environment", "value": "PULUMI_BACKEND_URL" },
      { "name": "PULUMI_CONFIG_PASSPHRASE", "type": "secret", "value": "kozen/pulumi/passphrase" }
    ],
    "setup": [
      { "name": "atlas:publicKey", "type": "secret", "value": "kozen/atlas/public-key" },
      { "name": "atlas:privateKey", "type": "secret", "value": "kozen/atlas/private-key" }
    ],
    "components": [
      {
        "name": "Atlas",
        "input": [
          { "name": "orgId", "type": "secret", "value": "kozen/atlas/org-id" },
          { "name": "clusterName", "type": "environment", "value": "KOZEN_STACK", "default": "dev" }
        ],
        "output": [
          { "name": "connectionString", "type": "reference", "value": "connectionString" }
        ]
      }
    ]
  }
}
```

### Variable resolution rules

| `type` | `value` semantics | Resolution source |
|---|---|---|
| `environment` | Environment variable name | `process.env[value]` |
| `reference` | Key in upstream outputs | `scope[value]` (accumulated component outputs) |
| `secret` | Secret path/key | `secret:manager.resolve(value)` |
| `static` (default) | Literal value | `value` as-is |
| `protected` | Alias for `environment` | `process.env[value]` (masked in logs) |

---

## 4. API Contracts

### 4.1 CLI Actions

All actions invoked via `PipelineCLIController.execute(args)`.

| Action | Required args | Optional args | Behavior |
|---|---|---|---|
| `deploy` | `template`, `config` | `stack`, `project` | Deploys all template components; exposes outputs as env vars |
| `undeploy` | `config` | `template`, `stack`, `project` | Destroys running resources; preserves state |
| `destroy` | `config` | `template`, `stack`, `project` | Permanently removes all resources and state |
| `validate` | `template`, `config` | `stack`, `project` | Validates template and credentials without deploying |
| `status` | `config` | `template`, `stack`, `project` | Reports component health and stack state |

### 4.2 CLI Usage

```bash
# Full form
kozen --action=pipeline:<action> --template=<name> --config=cfg/config.json [--stack=<env>] [--project=<id>]

# Short form (module auto-detected)
kozen --module=pipeline --action=<action> --template=<name>
```

### 4.3 MCP Tools

#### `kozen_pipeline_select`

```
Input:  { name: string, format?: "json" | "yaml" }
Output: { content: [{ type: "text", text: string }] }  // JSON-serialized ITemplate
```

#### `kozen_pipeline_list`

```
Input:  { format?: "json" | "table" }
Output: { content: [{ type: "text", text: string }] }  // JSON array of template summaries
```

---

## 5. Environment Variables

### Kozen core variables

| Variable | Default | Description |
|---|---|---|
| `KOZEN_CONFIG` | `cfg/config.json` | Default config file path |
| `KOZEN_ACTION` | — | Default CLI action |
| `KOZEN_STACK` | `dev` | Default stack/environment identifier |
| `KOZEN_PROJECT` | — | Default project identifier |
| `KOZEN_TEMPLATE` | — | Default template name |
| `KOZEN_ENV_ACTION` | `EXPOSE` | Output exposure mode: `EXPOSE` writes outputs to env; any other value skips |

### Pulumi variables (Pulumi orchestrator only)

| Variable | Default | Description |
|---|---|---|
| `PULUMI_BACKEND_URL` | — | Pulumi state backend URL (e.g. `s3://kozen-pulumi-stacks`) |
| `PULUMI_CONFIG_PASSPHRASE` | `K0Z3N-IsSoSecure` ⚠️ | Pulumi stack encryption passphrase — hardcoded fallback is a known gap (see engineering-proposal.md §5) |

### Atlas component variables

| Variable | Description |
|---|---|
| `ATLAS_PUBLIC_KEY` | MongoDB Atlas public API key |
| `ATLAS_PRIVATE_KEY` | MongoDB Atlas private API key |
| `ATLAS_PROJECT_ID` | MongoDB Atlas project ID |

### AWS component variables (EKS, ECR)

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key |
| `AWS_REGION` | AWS region |

---

## 6. Module Entry Point

```typescript
// src/index.ts  (actual current code)
export { ProcessorService } from './services/ProcessorService';

export class PipelineModule extends KzModule {
  public register(config: IConfig | null, opts?: any): Promise<Record<string, IDependency> | null> {
    let dep = {};
    switch (config?.type) {
      case 'mcp':  dep = { ...ioc, ...mcp }; break;
      case 'cli':  dep = { ...ioc, ...cli }; break;
      default:     dep = ioc;                break;
    }
    return Promise.resolve(dep as Record<string, IDependency>);
  }
}
```

Note: `this.fix(dep)` is not called in the current code — this is a known gap documented in engineering-proposal.md §5 (FR-1.x). The `fix()` call is required by the kozen-engine convention to resolve relative `path` entries in IoC config files to absolute paths.

`ProcessorService` is the only class exported for library use. All other classes are internal and resolved through IoC tokens.

---

## 7. Component Interface Contract

Custom components must extend `KzComponent` (`src/controllers/KzComponent.ts`) and register in IoC under a token matching the `name` field in the template JSON.

```typescript
// src/controllers/KzComponent.ts — actual interface
export abstract class KzComponent implements IController {
  // Configures the component with its definition from the template.
  // Must be called before any deploy/undeploy/validate/status operation.
  configure(config: IComponent, dependency?: { assistant: IIoC; logger: ILogger }): KzComponent;

  // Pre-deployment hook: processes the component's `setup` variable list
  // and passes the result to the stack manager for Pulumi config injection.
  setup(input: IStruct, pipeline?: IPipeline): Promise<IResult>;

  // ABSTRACT — must be implemented by every concrete component.
  abstract deploy(input?: IStruct, pipeline?: IPipeline): Promise<IResult>;

  // Optional overrides — default implementations are no-ops.
  undeploy(input?: IStruct, pipeline?: IPipeline): Promise<IResult | void>;
  destroy(input?: IStruct, pipeline?: IPipeline): Promise<IResult | void>;
  validate(input?: IStruct, pipeline?: IPipeline): Promise<IResult | void>;
  status(input?: IStruct, pipeline?: IPipeline): Promise<IResult | void>;

  // ABSTRACT — returns the component's self-describing schema
  // (input/output/setup field definitions, orchestrator, engine version).
  abstract metadata(): Promise<IComponent>;

  // Public utility — resolves variables through ProcessorService.
  transformInput(options: ITransformOption): Promise<IStruct>;

  // Protected utility — generates unique resource name prefix from pipeline context.
  protected getPrefix(pipeline?: IPipeline): string;
}
```

The IoC token under which a component is registered must exactly match the `name` field used in the template JSON component list. Convention: component tokens are PascalCase (`Atlas`, `EKS`); service tokens are `domain:name` lowercase.

---

## 8. Build and Distribution

```
dist/
  src/
    index.js          ← main entry (package.json "main")
    index.d.ts        ← types entry (package.json "types")
    configs/          ← ioc.json, cli.json, mcp.json (copied by tsc)
    docs/
      pipeline.txt    ← copied by copy:txt script
```

**Build command:** `npm run build` (tsc + copyfiles)  
**Publish command:** `npm publish --access public`  
**Pre-publish check:** `npm pack --dry-run` — verify `dist/src/docs/pipeline.txt` is included and `src/` is NOT in the tarball.

---

## 9. tsconfig Requirements

> **Gap:** `tsconfig.json` does not exist at the project root (see engineering-proposal.md §5). `npm run build` will fail until it is created.

The required configuration:

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "esModuleInterop": true,
    "module": "commonjs",
    "target": "ES2020",
    "strict": false
  },
  "include": ["src/**/*.ts"]
}
```

Rules enforced by the kozen-engine convention:
- No `bin/**/*.ts` in `include`
- No `bin` field in `package.json`
- `rootDir: "."` (not `"src"`) so that `dist/src/index.js` matches the `main` field
