import { RpcTarget } from "cloudflare:workers";
export type ExecutorFns = Record<string, (...args: unknown[]) => Promise<unknown>>;
export interface ExecutorResult {
    result?: unknown;
    error?: string;
    logs?: string[];
    __stagedResults?: Array<Record<string, unknown>>;
}
/** RPC target that dispatches tool calls from the isolate back to the host. */
export declare class ToolDispatcher extends RpcTarget {
    #private;
    constructor(fns: ExecutorFns);
    call(name: string, argsJson: string): Promise<string>;
}
/** Minimal interface for the Cloudflare Worker Loader binding. */
export interface WorkerLoaderBinding {
    get(name: string, factory: () => unknown): {
        getEntrypoint(): {
            evaluate(dispatcher: ToolDispatcher): Promise<ExecutorResult>;
        };
    };
}
/** Executes code in an isolated V8 Worker via the Worker Loader binding. */
export declare class DynamicWorkerExecutor {
    #private;
    constructor(options: {
        loader: WorkerLoaderBinding;
        timeout?: number;
    });
    execute(code: string, fns: ExecutorFns): Promise<ExecutorResult>;
}
//# sourceMappingURL=dynamic-worker-executor.d.ts.map