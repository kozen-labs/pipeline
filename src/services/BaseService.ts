import { BaseService, ITransformOption, IStruct } from '@kozen/engine';
import { IOutputResult, IProcessorService } from '../models/Processor';

/**
 * @fileoverview Base Service - Foundation Class for All Services
 * Abstract base class that provides common functionality and dependency injection
 * capabilities for all service classes in the application. This class establishes a consistent
 * pattern for service implementation and ensures proper IoC container integration.
 * All service classes should extend this base class to maintain consistency in dependency
 * management and to benefit from shared functionality across the service layer.
 *
 * @abstract
 * @class BaseService
 * @author MDB SAT
 * @since 1.0.4
 * @version 1.0.5
 */
export class PipelineService extends BaseService {

    /**
     * Transforms component input by processing variables through ProcessorService
     * @protected
     * @param {ITransformOption} options - Component containing input definitions
     * @returns {Promise<IStruct>} Promise resolving to processed input variables
     */
    public async transformInput(options: ITransformOption): Promise<IStruct> {
        const { component, output = {}, key = "input", flow } = options;
        if (!this.assistant) {
            throw new Error("Incorrect dependency injection configuration.");
        }
        const srvVar = await this.assistant.resolve<IProcessorService>('core:processor');
        const input = (srvVar && Array.isArray(component[key]) && await srvVar.process(component[key], output, flow));
        return input || {};
    }

    /**
     * Transforms component input by processing variables through ProcessorService
     * @protected
     * @param {ITransformOption} options - Component containing input definitions
     * @returns {Promise<IOutputResult>} Promise resolving to processed input variables
     */
    public async transformOutput(options: ITransformOption): Promise<IOutputResult> {
        let { component, key = "output", flow, output = {} } = options;
        if (!this.assistant) {
            throw new Error("Incorrect dependency injection configuration.");
        }
        const srvVar = await this.assistant.resolve<IProcessorService>('core:processor');
        const meta = (srvVar && Array.isArray(component[key]) && await srvVar.map(component[key], flow)) as IOutputResult;
        output.items = { ...output.items, ...meta?.items };
        output.warns = { ...output.warns, ...meta?.warns };
        return meta || {};
    }
}