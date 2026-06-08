import { IStackOptions } from './Stack';

export interface ITemplate {
    name?: string;
    description?: string;
    engine?: string;
    stack?: IStackOptions;
}

export interface ITemplateManager {
    load<T = ITemplate>(name: string, opts?: { flow?: string }): Promise<T>;
    list(): Promise<ITemplate[]>;
}
