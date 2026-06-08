import { KzModule, IConfig, IDependency } from '@kozen/engine';
import cli from './configs/cli.json';
import ioc from './configs/ioc.json';
import mcp from './configs/mcp.json';
import pkg from '../package.json';

export { ProcessorService } from './services/ProcessorService';

export class PipelineModule extends KzModule {
    constructor() {
        super();
        this.metadata.alias = 'pipeline';
        this.metadata.name = pkg.name;
        this.metadata.version = pkg.version;
        this.metadata.description = pkg.description;
    }

    public register(config: IConfig | null, opts?: any): Promise<Record<string, IDependency> | null> {
        let dep: any = {};
        switch (config?.type) {
            case 'mcp':
                dep = { ...ioc, ...mcp };
                break;
            case 'cli':
                dep = { ...ioc, ...cli };
                break;
            default:
                dep = ioc;
                break;
        }
        this.fix(dep);
        return Promise.resolve(dep as Record<string, IDependency>);
    }
}

export default PipelineModule;
