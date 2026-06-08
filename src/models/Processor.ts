import { IMetadata, IStruct } from '@kozen/engine';

export interface IOutputResult {
    items?: IStruct;
    warns?: IStruct;
}

export interface IProcessorService {
    process(inputs: IMetadata[], scope?: IStruct, flow?: string): Promise<IStruct>;
    map(inputs: IMetadata[], flow?: string): Promise<IOutputResult>;
    transform(def: IMetadata | string, scope?: IStruct, result?: IStruct, flow?: string, index?: number): Promise<IStruct>;
}
