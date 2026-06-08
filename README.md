# 🚀 Kozen Pipeline: IaC Pipeline Orchestrator for Kozen

Provisioning cloud infrastructure is repetitive, error-prone, and tightly coupled to specific tools. **Kozen Pipeline** solves this by letting you describe your entire infrastructure stack in a declarative JSON template and execute it through a single Kozen command, regardless of whether you use Pulumi, Node.js, MongoDB Atlas, AWS EKS, or Kubernetes.

## ⚡ Key Features

- **Declarative templates**: define infrastructure components, their inputs, setup, and outputs in a single JSON file
- **Dual orchestration backends**: choose Pulumi Automation API for stateful cloud deployments or the lightweight Node.js backend for programmatic pipelines
- **9 built-in components**: Atlas, EKS, ECR, K8Pods, Docker, CLI, API, DemoFirst, DemoSecond
- **Variable resolution engine**: resolves environment, static, reference, secret, and protected variables across component boundaries
- **Full lifecycle management**: deploy, undeploy, destroy, validate, and status in one unified interface
- **CLI and MCP interfaces**: run from a shell script or let an AI assistant inspect your templates via the Model Context Protocol (MCP)
- **Kozen IoC integration**: register once, compose with `@kozen/secret` for managed credentials, extend with custom components

## 🎯 Why Use This?

Managing infrastructure with raw Pulumi programs or raw shell scripts forces you to rebuild the same orchestration logic every project: load config, resolve secrets, execute components, collect outputs. Kozen Pipeline provides that orchestration layer as a reusable module. You write templates; the module handles execution order, variable resolution, and lifecycle transitions.

## 📦 Installation

```bash
npm install @kozen/pipeline
```

Validate your first template without touching any infrastructure:

```bash
npx kozen --moduleLoad=@kozen/pipeline \
  --action=pipeline:validate \
  --template=atlas.basic \
  --envFile=.env
```

**Note:** Kozen Pipeline requires a `template:manager` token registered in the IoC container before deployment. See [Kozen Integration](https://github.com/kozen-labs/pipeline/wiki/Kozen-Integration) for the one-time setup.

## 📚 References

| Resource | Description |
|---|---|
| [Get Started](https://github.com/kozen-labs/pipeline/wiki/Get-Started) | Install, configure, and run your first deployment in under 5 minutes |
| [Configuration](https://github.com/kozen-labs/pipeline/wiki/Configuration) | Template schema, environment variables, variable resolution types |
| [Pipeline via CLI](https://github.com/kozen-labs/pipeline/wiki/Pipeline-via-CLI) | All CLI actions (deploy, undeploy, destroy, validate, status) with examples |
| [Pipeline via MCP](https://github.com/kozen-labs/pipeline/wiki/Pipeline-via-MCP) | Connect to Claude, Cursor, or other AI assistants via MCP |
| [API](https://github.com/kozen-labs/pipeline/wiki/API) | TypeScript interfaces, `ProcessorService`, programmatic usage |
| [Kozen Integration](https://github.com/kozen-labs/pipeline/wiki/Kozen-Integration) | IoC token table, `template:manager` and `secret:manager` setup |
| [POLICY](https://github.com/kozen-labs/pipeline/wiki/POLICY) | Apache-2.0 licence and liability disclaimer |
| [GitHub Repository](https://github.com/kozen-labs/pipeline) | Source code, issues, pull requests |
| [npm: @kozen/pipeline](https://www.npmjs.com/package/@kozen/pipeline) | Package registry |
| [Kozen Engine Wiki](https://github.com/kozen-labs/engine/wiki) | Core framework: IoC container, CLI, MCP, logging |

> This project is open source and distributed under the terms described in the
> [Disclaimer and Usage Policy](https://github.com/kozen-labs/pipeline/wiki/POLICY).
